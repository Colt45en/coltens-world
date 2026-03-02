from __future__ import annotations

import math
from typing import Any, Dict, Optional, Tuple

from .grounding_tasks import GroundingTask
from .model_actions import AgentAction


def _point_distance(a: Tuple[int, int], b: Tuple[int, int]) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


def _point_in_box(pt: Tuple[int, int], box: Tuple[int, int, int, int]) -> bool:
    x, y = pt
    x1, y1, x2, y2 = box
    return (x1 <= x <= x2) and (y1 <= y <= y2)


def stage1_metrics(
    task: GroundingTask, pred_point: Optional[Tuple[int, int]]
) -> Dict[str, Any]:
    out: Dict[str, Any] = {
        "task_type": task.task_type,
        "has_target_point": task.target_point is not None,
        "has_target_box": task.target_box is not None,
    }

    if task.target_point is None or pred_point is None:
        out.update({"ok": False, "reason": "missing_point"})
        return out

    dist = _point_distance(task.target_point, pred_point)
    out["ok"] = True
    out["point_distance"] = dist

    if task.target_box is not None:
        out["point_in_box"] = _point_in_box(pred_point, task.target_box)

    return out


def stage2_metrics(
    gold: AgentAction, pred: Optional[AgentAction], point_tol: int = 25
) -> Dict[str, Any]:
    """
    - format_valid: pred parsed/validated
    - strict_match: compact dict exact match
    - fuzzy_match: POINT within tol AND TYPE/PRESS/STATUS exact match (if present)
    - per_field_accuracy: POINT/TYPE/PRESS/STATUS
    """
    gold_d = gold.compact_dict()
    out: Dict[str, Any] = {}

    if pred is None:
        out["format_valid"] = False
        out["strict_match"] = False
        out["fuzzy_match"] = False
        out["per_field_accuracy"] = {
            "POINT": False,
            "TYPE": False,
            "PRESS": False,
            "STATUS": False,
        }
        return out

    pred_d = pred.compact_dict()
    out["format_valid"] = True
    out["strict_match"] = pred_d == gold_d

    # Per-field accuracy (field present in gold must match)
    per = {}
    for key in ("POINT", "TYPE", "PRESS", "STATUS"):
        if key in gold_d:
            per[key] = pred_d.get(key) == gold_d.get(key)
        else:
            per[key] = True  # not required by gold
    out["per_field_accuracy"] = per

    # Fuzzy match
    fuzzy = True
    # STATUS must match
    fuzzy = fuzzy and (pred_d.get("STATUS") == gold_d.get("STATUS"))

    # TYPE / PRESS must match if present in gold
    for k in ("TYPE", "PRESS"):
        if k in gold_d:
            fuzzy = fuzzy and (pred_d.get(k) == gold_d.get(k))

    # POINT fuzzy
    if "POINT" in gold_d:
        gp = tuple(gold_d["POINT"])
        pp = pred_d.get("POINT")
        if pp is None:
            fuzzy = False
        else:
            pp = tuple(pp)
            dx = abs(pp[0] - gp[0])
            dy = abs(pp[1] - gp[1])
            fuzzy = fuzzy and (dx <= point_tol and dy <= point_tol)

    out["fuzzy_match"] = bool(fuzzy)
    return out
