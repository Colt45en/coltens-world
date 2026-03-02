from __future__ import annotations

import argparse
from typing import Any, Dict, List, Optional

from tools._common import ensure_agent_suite_on_path, iter_jsonl, write_jsonl

ensure_agent_suite_on_path()

from packages.core import stage2_metrics  # noqa: E402
from packages.core.model_actions import AgentAction  # noqa: E402


def _parse_action_maybe(obj: Any) -> Optional[AgentAction]:
    try:
        if isinstance(obj, AgentAction):
            return obj
        if isinstance(obj, dict):
            return AgentAction.from_dict(obj)
        if isinstance(obj, str):
            return AgentAction.from_json(obj)
    except Exception:
        return None
    return None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--input",
        required=True,
        help="Stage II episodes JSONL (must include gold_action)",
    )
    ap.add_argument(
        "--pred",
        required=False,
        help="Predictions JSONL (line-aligned). If omitted, assumes input contains pred_action.",
    )
    ap.add_argument("--out", required=True, help="Output metrics JSONL")
    ap.add_argument(
        "--point-tol", type=int, default=25, help="Fuzzy POINT tolerance in norm units"
    )
    args = ap.parse_args()

    episodes = list(iter_jsonl(args.input))
    preds = list(iter_jsonl(args.pred)) if args.pred else episodes

    if len(preds) < len(episodes):
        raise SystemExit(
            f"pred has {len(preds)} lines but input has {len(episodes)} episodes"
        )

    reports: List[Dict[str, Any]] = []

    total = 0
    valid = 0
    strict = 0
    fuzzy = 0
    field_hits = {"POINT": 0, "TYPE": 0, "PRESS": 0, "STATUS": 0}

    for i, ep in enumerate(episodes):
        gold_obj = ep.get("gold_action")
        if gold_obj is None:
            raise SystemExit(f"Missing gold_action on line {i} of --input")

        gold = _parse_action_maybe(gold_obj)
        if gold is None:
            raise SystemExit(f"Invalid gold_action schema on line {i} of --input")

        pred_obj = preds[i].get(
            "pred_action", preds[i].get("pred", preds[i].get("action"))
        )
        pred = _parse_action_maybe(pred_obj) if pred_obj is not None else None

        m = stage2_metrics(gold, pred, point_tol=args.point_tol)
        m["index"] = i
        reports.append(m)

        total += 1
        if m["format_valid"]:
            valid += 1
        if m["strict_match"]:
            strict += 1
        if m["fuzzy_match"]:
            fuzzy += 1

        per = m["per_field_accuracy"]
        for k in field_hits.keys():
            if per.get(k):
                field_hits[k] += 1

    reports.append(
        {
            "summary": {
                "total": total,
                "format_valid_rate": (valid / total) if total else 0.0,
                "strict_match_rate": (strict / total) if total else 0.0,
                "fuzzy_match_rate": (fuzzy / total) if total else 0.0,
                "per_field_accuracy": {
                    k: (field_hits[k] / total) if total else 0.0 for k in field_hits
                },
            }
        }
    )

    write_jsonl(args.out, reports)


if __name__ == "__main__":
    main()
