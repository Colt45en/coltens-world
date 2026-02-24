from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional

from .action_schema import Action
from .normalize import ScreenSize, BBox, point_in_norm_bbox


@dataclass(frozen=True)
class StepMetrics:
    type_match: bool
    exact_match: bool
    point_in_box: Optional[bool] = None


def _action_type(a: Dict[str, Any]) -> str:
    try:
        act = Action.model_validate(a)
        return act.action_type()
    except Exception:
        return "INVALID"


def type_match(pred: Dict[str, Any], gold: Dict[str, Any]) -> bool:
    return _action_type(pred) == _action_type(gold)


def exact_match(pred: Dict[str, Any], gold: Dict[str, Any]) -> bool:
    # Strict dict match after schema normalization.
    try:
        p = Action.model_validate(pred).model_dump(exclude_none=True)
        g = Action.model_validate(gold).model_dump(exclude_none=True)
    except Exception:
        return False
    return p == g


def step_metrics(
    pred: Dict[str, Any],
    gold: Dict[str, Any],
    screen: Optional[ScreenSize] = None,
    gold_bbox_px: Optional[BBox] = None,
) -> StepMetrics:
    tm = type_match(pred, gold)
    em = exact_match(pred, gold)

    pib = None
    if screen and gold_bbox_px:
        try:
            act = Action.model_validate(pred)
            if act.POINT is None:
                pib = False
            else:
                pib = point_in_norm_bbox((act.POINT[0], act.POINT[1]), gold_bbox_px, screen)
        except Exception:
            pib = False

    return StepMetrics(type_match=tm, exact_match=em, point_in_box=pib)
