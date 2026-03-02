from __future__ import annotations

from typing import Any, Dict

from .model_actions import AgentAction


def compute_reward(sample: Dict[str, Any]) -> Dict[str, Any]:
    """
    Reward contract:
      -1 => format/schema invalid
       0 => schema ok but wrong
       1 => schema ok and correct

    Supports verification by:
      - gold_action (exact compact match)
      - verifier.target_box with pred POINT inside box
    """
    out: Dict[str, Any] = {"reward": 0, "reason": "wrong_action", "details": {}}

    # Parse pred action
    try:
        pred_obj = sample.get("pred_action", sample.get("pred", sample.get("action")))
        if pred_obj is None:
            raise ValueError("missing pred_action")
        pred = (
            AgentAction.from_dict(pred_obj)
            if isinstance(pred_obj, dict)
            else AgentAction.from_json(pred_obj)
        )
    except Exception as e:
        out["reward"] = -1
        out["reason"] = "format_invalid"
        out["details"] = {"error": str(e)}
        return out

    out["details"]["parsed_action"] = pred.compact_dict()

    # Exact match to gold if provided
    gold_obj = sample.get("gold_action")
    if gold_obj is not None:
        try:
            gold = (
                AgentAction.from_dict(gold_obj)
                if isinstance(gold_obj, dict)
                else AgentAction.from_json(gold_obj)
            )
        except Exception as e:
            out["reward"] = -1
            out["reason"] = "schema_invalid"
            out["details"]["gold_error"] = str(e)
            return out

        out["details"]["gold_action"] = gold.compact_dict()
        if pred.compact_dict() == gold.compact_dict():
            out["reward"] = 1
            out["reason"] = "correct_action"
            return out

    # Box verifier (POINT inside target box)
    verifier = sample.get("verifier") or {}
    target_box = verifier.get("target_box") or verifier.get("box")
    if target_box is not None:
        try:
            x1, y1, x2, y2 = [int(v) for v in target_box]
            pt = pred.compact_dict().get("POINT")
            if pt is None:
                out["details"]["point_in_target_box"] = False
                return out
            x, y = int(pt[0]), int(pt[1])
            inside = (x1 <= x <= x2) and (y1 <= y <= y2)
            out["details"]["point_in_target_box"] = inside
            if inside:
                out["reward"] = 1
                out["reason"] = "correct_action"
                return out
        except Exception as e:
            out["reward"] = -1
            out["reason"] = "schema_invalid"
            out["details"]["verifier_error"] = str(e)
            return out

    return out
