from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any, Dict, Iterator


def _iter_jsonl(path: Path) -> Iterator[Dict[str, Any]]:
    with path.open("r", encoding="utf-8") as f:
        for i, line in enumerate(f, start=1):
            s = line.strip()
            if not s:
                continue
            try:
                obj = json.loads(s)
            except Exception as e:
                raise ValueError(f"Invalid JSON on line {i} in {path}: {e}") from e
            if isinstance(obj, dict):
                yield obj
            else:
                raise ValueError(f"Expected object on line {i} in {path}")


CHOICES = {"a", "b", "c", "d"}


def _extract_from_text_auto(text: str) -> str | None:
    s = text.strip().lower()
    if s in CHOICES:
        return s
    m = re.search(r"correct\s+answer\s*:\s*([abcd])\b", s)
    if m:
        return m.group(1)
    m = re.search(r"\b([abcd])\b", s)
    if m:
        return m.group(1)
    return None


def _extract_from_text_strict(text: str) -> str | None:
    s = text.strip().lower()
    if s in CHOICES:
        return s
    m = re.fullmatch(
        r"(?:correct\s+answer|answer|choice)\s*[:=-]?\s*([abcd])(?:[\.\)\s].*)?",
        s,
        flags=re.DOTALL,
    )
    if m:
        return m.group(1)
    m = re.search(r'"(?:answer|choice|label)"\s*:\s*"([abcd])"', s)
    if m:
        return m.group(1)
    return None


def _first_str(*values: Any) -> str | None:
    for v in values:
        if isinstance(v, str) and v.strip():
            return v
    return None


def _extract_openai_text(rec: Dict[str, Any]) -> str | None:
    direct = _first_str(rec.get("output_text"))
    if direct:
        return direct

    response = rec.get("response")
    if isinstance(response, dict):
        direct = _first_str(response.get("output_text"))
        if direct:
            return direct
        output = response.get("output")
        if isinstance(output, list):
            parts: list[str] = []
            for item in output:
                if not isinstance(item, dict):
                    continue
                content = item.get("content")
                if isinstance(content, list):
                    for c in content:
                        if not isinstance(c, dict):
                            continue
                        t = _first_str(c.get("text"))
                        if t:
                            parts.append(t)
                t = _first_str(item.get("text"))
                if t:
                    parts.append(t)
            if parts:
                return "\n".join(parts)

    choices = rec.get("choices")
    if isinstance(choices, list) and choices:
        first = choices[0]
        if isinstance(first, dict):
            t = _first_str(first.get("text"))
            if t:
                return t
            msg = first.get("message")
            if isinstance(msg, dict):
                content = msg.get("content")
                if isinstance(content, str):
                    return content
                if isinstance(content, list):
                    parts: list[str] = []
                    for c in content:
                        if isinstance(c, dict):
                            t = _first_str(c.get("text"))
                            if t:
                                parts.append(t)
                    if parts:
                        return "\n".join(parts)
    return None


def _extract_raw_text(rec: Dict[str, Any]) -> str | None:
    return _first_str(
        rec.get("text"),
        rec.get("raw_text"),
        rec.get("output"),
        rec.get("response"),
        rec.get("prediction"),
    )


def _extract_choice(rec: Dict[str, Any], mode: str = "auto") -> str | None:
    if mode == "openai":
        text = _extract_openai_text(rec)
        return _extract_from_text_strict(text) if text else None
    if mode == "raw-text":
        text = _extract_raw_text(rec)
        return _extract_from_text_strict(text) if text else None

    candidate_keys = (
        "answer",
        "pred",
        "prediction",
        "response",
        "output",
        "text",
        "choice",
        "gold_answer",
    )
    value: Any = None
    for k in candidate_keys:
        if k in rec:
            value = rec[k]
            break
    if value is None:
        return None
    if isinstance(value, str):
        return _extract_from_text_auto(value)
    if isinstance(value, dict):
        for k in ("answer", "choice", "label"):
            v = value.get(k)
            if isinstance(v, str) and v.strip().lower() in CHOICES:
                return v.strip().lower()
    return None


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Score predicted multiple-choice answers against quiz_eval.jsonl."
    )
    ap.add_argument(
        "--gold",
        default="datasets/golden_ai_training/quiz_eval.jsonl",
        help="Gold quiz eval JSONL (default: datasets/golden_ai_training/quiz_eval.jsonl)",
    )
    ap.add_argument(
        "--pred",
        required=True,
        help="Predictions JSONL. Each row should include `id` or `question_number`, plus a predicted answer field.",
    )
    ap.add_argument(
        "--format",
        choices=("auto", "openai", "raw-text"),
        default="auto",
        help="Prediction parsing mode. `auto` is permissive; `openai` and `raw-text` are stricter.",
    )
    ap.add_argument("--out", help="Optional path to write per-item scored JSONL.")
    args = ap.parse_args()

    gold_path = Path(args.gold)
    pred_path = Path(args.pred)
    if not gold_path.exists():
        raise SystemExit(f"Gold file not found: {gold_path}")
    if not pred_path.exists():
        raise SystemExit(f"Predictions file not found: {pred_path}")

    gold_by_id: Dict[str, Dict[str, Any]] = {}
    gold_by_qn: Dict[int, Dict[str, Any]] = {}
    for rec in _iter_jsonl(gold_path):
        rec_id = str(rec.get("id", ""))
        qn = int(rec.get("question_number"))
        gold_by_id[rec_id] = rec
        gold_by_qn[qn] = rec

    seen_gold_ids: set[str] = set()
    detailed: list[Dict[str, Any]] = []
    total_preds = 0
    matched = 0
    parsed = 0
    correct = 0
    parse_fail = 0
    unmatched = 0

    for rec in _iter_jsonl(pred_path):
        total_preds += 1
        gold: Dict[str, Any] | None = None
        rec_id = rec.get("id")
        if rec_id is not None and str(rec_id) in gold_by_id:
            gold = gold_by_id[str(rec_id)]
        elif "question_number" in rec:
            try:
                qn = int(rec["question_number"])
            except Exception:
                qn = -1
            gold = gold_by_qn.get(qn)

        if gold is None:
            unmatched += 1
            detailed.append({"status": "unmatched", "pred_record": rec})
            continue

        matched += 1
        seen_gold_ids.add(str(gold["id"]))
        pred_choice = _extract_choice(rec, mode=args.format)
        gold_choice = str(gold.get("gold_answer", "")).lower()

        if pred_choice is None:
            parse_fail += 1
            detailed.append(
                {
                    "status": "parse_fail",
                    "id": gold["id"],
                    "question_number": gold["question_number"],
                    "gold_answer": gold_choice,
                    "pred_record": rec,
                }
            )
            continue

        parsed += 1
        is_correct = pred_choice == gold_choice
        correct += 1 if is_correct else 0
        detailed.append(
            {
                "status": "scored",
                "id": gold["id"],
                "question_number": gold["question_number"],
                "question": gold["question"],
                "gold_answer": gold_choice,
                "pred_answer": pred_choice,
                "correct": is_correct,
            }
        )

    total_gold = len(gold_by_id)
    covered = len(seen_gold_ids)
    unanswered_gold = total_gold - covered
    acc_parsed = (correct / parsed) if parsed else 0.0
    acc_covered = (correct / total_gold) if total_gold else 0.0

    print(f"Gold questions:      {total_gold}")
    print(f"Prediction rows:     {total_preds}")
    print(f"Matched rows:        {matched}")
    print(f"Parsed answers:      {parsed}")
    print(f"Correct answers:     {correct}")
    print(f"Parse failures:      {parse_fail}")
    print(f"Unmatched rows:      {unmatched}")
    print(f"Gold covered:        {covered}")
    print(f"Gold unanswered:     {unanswered_gold}")
    print(f"Accuracy (parsed):   {acc_parsed:.4f}")
    print(f"Accuracy (gold-set): {acc_covered:.4f}")

    if args.out:
        out_path = Path(args.out)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with out_path.open("w", encoding="utf-8", newline="\n") as f:
            for row in detailed:
                f.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")
        print(f"Wrote details:       {out_path}")


if __name__ == "__main__":
    main()
