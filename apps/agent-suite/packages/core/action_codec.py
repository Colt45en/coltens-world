from __future__ import annotations

import json
from typing import Any, Dict, Tuple
from pydantic import ValidationError

from .action_schema import Action


def dumps_compact(action: Dict[str, Any]) -> str:
    """Compact JSON: no whitespace; stable key ordering."""
    # separators remove whitespace; sort_keys improves determinism for training
    return json.dumps(action, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def loads_and_validate(s: str) -> Tuple[bool, Dict[str, Any], str]:
    """Parse JSON and validate against Action schema.

    Returns: (ok, obj, error)
    """
    try:
        obj = json.loads(s)
        if not isinstance(obj, dict):
            return False, {}, "Action must be a JSON object"
        a = Action.model_validate(obj)
        if not a.is_valid_semantically():
            return (
                False,
                obj,
                "Semantic constraints failed (e.g., 'to' requires 'POINT')",
            )
        return True, a.model_dump(exclude_none=True), ""
    except json.JSONDecodeError as e:
        return False, {}, f"JSON decode error: {e}"
    except ValidationError as e:
        return False, {}, f"Schema validation error: {e}"
    except Exception as e:
        return False, {}, f"Unknown error: {e}"
