from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, Iterator

from quiz_eval_cli import _extract_choice, _extract_openai_text, _extract_raw_text


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
            if not isinstance(obj, dict):
                raise ValueError(f"Expected object on line {i} in {path}")
            yield obj


def _extract_id_fields(rec: Dict[str, Any]) -> tuple[str | None, int | None]:
    rec_id = None
    qn = None

    for key in ("id", "custom_id"):
        if key in rec and rec[key] is not None:
            rec_id = str(rec[key])
            break

    if rec_id is None:
        meta = rec.get("metadata")
        if isinstance(meta, dict):
            for key in ("id", "custom_id"):
                if key in meta and meta[key] is not None:
                    rec_id = str(meta[key])
                    break

    for key in ("question_number", "qnum", "question_num"):
        if key in rec:
            try:
                qn = int(rec[key])
                break
            except Exception:
                pass

    if qn is None:
        meta = rec.get("metadata")
        if isinstance(meta, dict):
            for key in ("question_number", "qnum", "question_num"):
                if key in meta:
                    try:
                        qn = int(meta[key])
                        break
                    except Exception:
                        pass

    return rec_id, qn


def _extract_raw_payload_text(rec: Dict[str, Any], fmt: str) -> str | None:
    if fmt == "openai":
        return _extract_openai_text(rec)
    if fmt == "raw-text":
        return _extract_raw_text(rec)
    for key in ("text", "output_text", "prediction", "response", "output"):
        v = rec.get(key)
        if isinstance(v, str):
            return v
    return None


def main() -> None:
    ap = argparse.ArgumentParser(description="Convert model generation JSONL into normalized quiz prediction JSONL for quiz_eval_cli.py.")
    ap.add_argument("--in", dest="in_path", required=True, help="Input generations JSONL")
    ap.add_argument("--out", required=True, help="Output normalized predictions JSONL")
    ap.add_argument("--format", choices=("auto", "openai", "raw-text"), default="auto", help="Input generation format for answer extraction")
    ap.add_argument("--gold", help="Optional gold quiz_eval.jsonl used to fill missing id/question_number by row order")
    ap.add_argument("--skip-unparsed", action="store_true", help="Drop rows where a choice cannot be parsed")
    args = ap.parse_args()

    in_path = Path(args.in_path)
    out_path = Path(args.out)
    if not in_path.exists():
        raise SystemExit(f"Input file not found: {in_path}")

    gold_rows: list[Dict[str, Any]] = []
    if args.gold:
        gold_path = Path(args.gold)
        if not gold_path.exists():
            raise SystemExit(f"Gold file not found: {gold_path}")
        gold_rows = list(_iter_jsonl(gold_path))

    converted: list[Dict[str, Any]] = []
    total = 0
    parsed = 0
    skipped = 0
    order_filled = 0

    for idx, rec in enumerate(_iter_jsonl(in_path), start=1):
        total += 1
        rec_id, qn = _extract_id_fields(rec)
        if (rec_id is None or qn is None) and idx <= len(gold_rows):
            gold = gold_rows[idx - 1]
            if rec_id is None and "id" in gold:
                rec_id = str(gold["id"])
                order_filled += 1
            if qn is None and "question_number" in gold:
                try:
                    qn = int(gold["question_number"])
                    order_filled += 1
                except Exception:
                    pass

        pred_choice = _extract_choice(rec, mode=args.format)
        raw_text = _extract_raw_payload_text(rec, args.format)

        if pred_choice is None and args.skip_unparsed:
            skipped += 1
            continue

        if pred_choice is not None:
            parsed += 1

        out_rec: Dict[str, Any] = {"source_index": idx}
        if rec_id is not None:
            out_rec["id"] = rec_id
        if qn is not None:
            out_rec["question_number"] = qn
        if pred_choice is not None:
            out_rec["prediction"] = pred_choice
        if raw_text is not None:
            out_rec["text"] = raw_text
        out_rec["parse_status"] = "ok" if pred_choice is not None else "unparsed"
        converted.append(out_rec)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8", newline="\n") as f:
        for rec in converted:
            f.write(json.dumps(rec, ensure_ascii=False, sort_keys=True) + "\n")

    print(f"Input rows:         {total}")
    print(f"Converted rows:     {len(converted)}")
    print(f"Parsed answers:     {parsed}")
    print(f"Skipped unparsed:   {skipped}")
    print(f"Order-filled IDs/Q: {order_filled}")
    print(f"Wrote:              {out_path}")


if __name__ == "__main__":
    main()
