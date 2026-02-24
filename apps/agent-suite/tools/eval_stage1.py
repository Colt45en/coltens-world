from __future__ import annotations

import argparse
from typing import Any, Dict, List, Optional, Tuple

from tools._common import ensure_agent_suite_on_path, iter_jsonl, write_jsonl

ensure_agent_suite_on_path()

from packages.core import GroundingTask, stage1_metrics
from packages.core.model_actions import AgentAction


def _extract_pred_point(obj: Dict[str, Any]) -> Optional[Tuple[int, int]]:
    # 1) explicit pred_point
    if "pred_point" in obj and obj["pred_point"] is not None:
        x, y = obj["pred_point"]
        return (int(x), int(y))

    # 2) action-like dict (compact/envelope)
    try:
        aa = AgentAction.from_dict(obj)
        d = aa.compact_dict()
        if "POINT" in d:
            x, y = d["POINT"]
            return (int(x), int(y))
    except Exception:
        pass

    # 3) nested action field
    for k in ("pred_action", "action", "pred"):
        if k in obj and isinstance(obj[k], dict):
            return _extract_pred_point(obj[k])

    return None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True, help="Stage I grounding tasks JSONL")
    ap.add_argument("--pred", required=False, help="Predictions JSONL (line-aligned). If omitted, assumes input contains predictions.")
    ap.add_argument("--out", required=True, help="Output report JSONL")
    args = ap.parse_args()

    tasks_raw = list(iter_jsonl(args.input))
    tasks: List[GroundingTask] = [GroundingTask.model_validate(x) for x in tasks_raw]

    preds_raw: List[Dict[str, Any]]
    if args.pred:
        preds_raw = list(iter_jsonl(args.pred))
        if len(preds_raw) < len(tasks):
            raise SystemExit(f"pred has {len(preds_raw)} lines but input has {len(tasks)} tasks")
    else:
        preds_raw = tasks_raw  # input carries predictions

    reports: List[Dict[str, Any]] = []
    ok_count = 0
    total = 0

    for i, task in enumerate(tasks):
        pred_point = _extract_pred_point(preds_raw[i])
        m = stage1_metrics(task, pred_point)
        m["index"] = i
        m["image_path"] = task.image_path
        reports.append(m)

        total += 1
        if m.get("ok"):
            ok_count += 1

    # Append summary record as last line
    reports.append({
        "summary": {
            "total": total,
            "ok": ok_count,
            "ok_rate": (ok_count / total) if total else 0.0,
        }
    })

    write_jsonl(args.out, reports)


if __name__ == "__main__":
    main()
