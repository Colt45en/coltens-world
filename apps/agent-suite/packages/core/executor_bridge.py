from __future__ import annotations

from typing import Any, Dict, List, Tuple, Union

from .coords import denormalize_point
from .model_actions import AgentAction


def model_to_executor(action: Union[AgentAction, Dict[str, Any]], screen_size: Tuple[int, int]) -> List[Dict[str, Any]]:
    """
    Deterministic sequencing:
      1) click (if POINT present and (TYPE or PRESS present))
      2) type  (if TYPE present)
      3) press (if PRESS present)

    If TYPE present without POINT: type into current focus (deterministic policy).
    If PRESS present without POINT: press key (deterministic policy).
    """
    w, h = int(screen_size[0]), int(screen_size[1])
    aa = action if isinstance(action, AgentAction) else AgentAction.from_dict(action)
    d = aa.compact_dict()

    out: List[Dict[str, Any]] = []

    point = d.get("POINT")
    has_type = "TYPE" in d
    has_press = "PRESS" in d

    px = None
    if point is not None:
        x_norm, y_norm = int(point[0]), int(point[1])
        px = denormalize_point(x_norm, y_norm, w, h)

    if px is not None and (has_type or has_press):
        out.append({"kind": "click", "point": [px[0], px[1]], "button": "left"})

    if has_type:
        out.append({"kind": "type", "text": d["TYPE"]})

    if has_press:
        out.append({"kind": "press", "key": d["PRESS"]})

    return out
