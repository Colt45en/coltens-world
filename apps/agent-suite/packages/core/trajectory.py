from __future__ import annotations

from typing import Any, Dict, List, Optional, Literal
from pydantic import BaseModel, Field, ConfigDict

from .action_schema import Action


Locale = Literal["en", "zh", "other"]


class Observation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    # Use either image_path (mobile) or url/html snapshot (web) depending on domain
    image_path: Optional[str] = None
    url: Optional[str] = None
    note: Optional[str] = None


class Step(BaseModel):
    model_config = ConfigDict(extra="forbid")
    obs: Observation
    action: Action


class Trajectory(BaseModel):
    model_config = ConfigDict(extra="forbid")
    task_id: str
    locale: Locale = "en"
    instruction: str
    domain: Literal["web", "desktop", "mobile", "files"] = "web"
    steps: List[Step]
    success: bool = True
    meta: Dict[str, Any] = Field(default_factory=dict)
