from __future__ import annotations

import json
from typing import Any, Dict, Optional, Tuple, Union, Literal, Annotated

from pydantic import BaseModel, ConfigDict, Field, model_validator

# ---------- Invariants ----------
NORM_MIN = 0
NORM_MAX = 1000

NormInt = Annotated[int, Field(ge=0, le=1000)]
Status = Literal["continue", "finish", "fail"]
Point = Tuple[NormInt, NormInt]

CANONICAL_JSON_KWARGS: Dict[str, Any] = {
    "separators": (",", ":"),
    "sort_keys": True,
    "ensure_ascii": False,
}


def clamp_norm_int(v: int) -> int:
    if v < NORM_MIN:
        return NORM_MIN
    if v > NORM_MAX:
        return NORM_MAX
    return v


class ActionData(BaseModel):
    """
    Canonical compact model action payload (stable keys, strict schema).
    This is what we want models/tools to emit and what Stage II/III evaluate.
    """
    model_config = ConfigDict(extra="forbid", frozen=True)

    POINT: Optional[Point] = None
    TYPE: Optional[str] = None
    PRESS: Optional[str] = None
    STATUS: Status

    def compact_dict(self) -> Dict[str, Any]:
        # Exclude None keys to prevent drift
        return self.model_dump(exclude_none=True)

    def compact_json(self) -> str:
        return json.dumps(self.compact_dict(), **CANONICAL_JSON_KWARGS)

    def pretty_json(self, indent: int = 2) -> str:
        return json.dumps(self.compact_dict(), indent=indent, sort_keys=True, ensure_ascii=False)


class AgentAction(BaseModel):
    """
    Backwards-compatible envelope:
        {"type": "<action_type>", "data": {...compact action...}}

    ALSO supports direct construction with compact keys:
        AgentAction(POINT=[...], TYPE="...", STATUS="continue")

    Determinism rule:
    - Canonical compact representation is ActionData.compact_dict()
    - Canonical compact JSON uses CANONICAL_JSON_KWARGS
    """
    model_config = ConfigDict(extra="forbid", frozen=True)

    # Lock this if you can. If you truly need multiple types, widen this Literal set.
    type: Literal["agent_action"] = "agent_action"
    data: ActionData

    @model_validator(mode="before")
    @classmethod
    def _accept_compact_or_envelope(cls, v: Any) -> Any:
        """
        Accept either:
          A) Envelope dict: {"type": "...", "data": {...}}
          B) Compact dict: {"POINT":..., "TYPE":..., "STATUS":...}
        Normalize into envelope form.
        """
        if isinstance(v, AgentAction):
            return v

        if isinstance(v, dict):
            # Envelope form
            if "type" in v and "data" in v:
                return v

            # Compact form → wrap
            return {"type": "agent_action", "data": v}

        raise TypeError(f"AgentAction expects dict or AgentAction, got: {type(v).__name__}")

    # ---- Parsing helpers ----
    @classmethod
    def from_json(cls, json_str: str) -> "AgentAction":
        obj = json.loads(json_str)
        return cls.model_validate(obj)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AgentAction":
        return cls.model_validate(data)

    @classmethod
    def from_string(cls, string: str) -> "AgentAction":
        return cls.from_json(string)

    # ---- Canonical forms ----
    def compact_dict(self) -> Dict[str, Any]:
        return self.data.compact_dict()

    def compact_json(self) -> str:
        return self.data.compact_json()

    def envelope_dict(self) -> Dict[str, Any]:
        return {"type": self.type, "data": self.compact_dict()}

    def envelope_json(self) -> str:
        return json.dumps(self.envelope_dict(), **CANONICAL_JSON_KWARGS)

    # ---- Compatibility with your existing method names ----
    def to_dict(self) -> Dict[str, Any]:
        # Preserve your existing "envelope" behavior for compatibility
        return self.envelope_dict()

    def to_json(self) -> str:
        # Canonical envelope JSON (stable key ordering, no whitespace)
        return self.envelope_json()

    def to_string(self) -> str:
        return self.to_json()

    def to_string_pretty(self) -> str:
        return json.dumps(self.envelope_dict(), indent=2, sort_keys=True, ensure_ascii=False)

    def __eq__(self, other: Any) -> bool:
        if not isinstance(other, AgentAction):
            return NotImplemented
        # Compare canonical compact payload only (prevents drift via envelope formatting)
        return self.compact_dict() == other.compact_dict()


# ---------- Public API helpers (recommended to export in core/__init__.py) ----------
def compact_action_dumps(action: Union[AgentAction, ActionData, Dict[str, Any]]) -> str:
    """
    Canonical compact JSON (NO envelope) — stable keys, no whitespace, excludes nulls.

    Accepts:
      - AgentAction (envelope)
      - ActionData (compact)
      - dict (either compact or envelope)
    """
    if isinstance(action, AgentAction):
        return action.compact_json()

    if isinstance(action, ActionData):
        return action.compact_json()

    # dict: may be compact or envelope → normalize via AgentAction validator, then dump compact
    normalized = AgentAction.model_validate(action)
    return normalized.compact_json()


def compact_action_loads(s: str) -> AgentAction:
    """
    Loads JSON that may be:
      - envelope: {"type":"agent_action","data":{...}}
      - compact:  {"POINT":[...],"STATUS":"continue",...}

    Returns AgentAction (envelope in memory), with strict ActionData validation.
    """
    obj = json.loads(s)
    return AgentAction.model_validate(obj)
