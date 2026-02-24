from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field, RootModel, field_validator


# --- Root models ---
class Location(RootModel[List[int]]):
    """
    Normalized screen coordinates in a 0..1000 space: [x, y]
    - [0,0] = top-left
    - [1000,1000] = bottom-right
    """

    @field_validator("root")
    @classmethod
    def _validate_point(cls, v: List[int]) -> List[int]:
        if not isinstance(v, list) or len(v) != 2:
            raise ValueError("loc must be [x, y]")
        x, y = v
        if not (isinstance(x, int) and isinstance(y, int)):
            raise ValueError("loc values must be integers")
        if not (0 <= x <= 1000 and 0 <= y <= 1000):
            raise ValueError("loc values must be within 0..1000")
        return v

    @property
    def x(self) -> int:
        return self.root[0]

    @property
    def y(self) -> int:
        return self.root[1]


ActionKind = Literal[
    "click",
    "doubleClick",
    "rightClick",
    "type",
    "press",
    "hotkey",
    "wait",
    "scroll",
    "launch",
    "focus",
]


class Action(BaseModel):
    kind: ActionKind
    loc: Optional[Location] = None
    text: Optional[str] = None
    key: Optional[str] = None
    keys: Optional[List[str]] = None
    seconds: Optional[float] = None
    delta: Optional[int] = None
    app: Optional[str] = None
    window_title: Optional[str] = None

    @field_validator("loc", mode="before")
    @classmethod
    def _coerce_loc(cls, v):
        if v is None or isinstance(v, Location):
            return v
        return Location(v)

    @field_validator("seconds")
    @classmethod
    def _seconds_nonneg(cls, v):
        if v is None:
            return v
        if v < 0:
            raise ValueError("seconds must be >= 0")
        return v

    @field_validator("delta")
    @classmethod
    def _delta_nonzero(cls, v):
        if v is None:
            return v
        if v == 0:
            raise ValueError("delta must be non-zero")
        return v


class ActionPlan(BaseModel):
    id: str = Field(..., description="Plan id")
    summary: str = Field(..., description="Human-readable plan summary")
    actions: List[Action] = Field(default_factory=list)

# Back-compat alias
UIAction = Action
