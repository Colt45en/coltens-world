from __future__ import annotations

import json
from typing import Any, Dict, Iterator, List, Literal, Optional, Tuple

from pydantic import BaseModel, ConfigDict, field_validator

from .model_actions import clamp_norm_int

TaskType = Literal["text2point", "fun2point", "bbox2text"]
Point = Tuple[int, int]
Box = Tuple[int, int, int, int]


class GroundingTask(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: int = 1
    task_type: TaskType
    image_path: str
    screen_size: Tuple[int, int]  # (w,h)

    target_text: Optional[str] = None
    target_function: Optional[str] = None
    target_point: Optional[Point] = None
    target_box: Optional[Box] = None

    @field_validator("screen_size")
    @classmethod
    def _validate_screen(cls, v: Tuple[int, int]) -> Tuple[int, int]:
        w, h = int(v[0]), int(v[1])
        if w <= 0 or h <= 0:
            raise ValueError("screen_size must be positive (w,h)")
        return (w, h)

    @field_validator("target_point")
    @classmethod
    def _validate_point(cls, v: Optional[Point]) -> Optional[Point]:
        if v is None:
            return None
        x, y = int(v[0]), int(v[1])
        return (clamp_norm_int(x), clamp_norm_int(y))

    @field_validator("target_box")
    @classmethod
    def _validate_box(cls, v: Optional[Box]) -> Optional[Box]:
        if v is None:
            return None
        x1, y1, x2, y2 = (clamp_norm_int(int(v[0])), clamp_norm_int(int(v[1])),
                          clamp_norm_int(int(v[2])), clamp_norm_int(int(v[3])))
        if x1 > x2:
            raise ValueError("target_box must satisfy x1<=x2")
        if y1 > y2:
            raise ValueError("target_box must satisfy y1<=y2")
        return (x1, y1, x2, y2)


def iter_jsonl(path: str) -> Iterator[Dict[str, Any]]:
    with open(path, "rt", encoding="utf-8") as f:
        for line in f:
            s = line.strip()
            if not s:
                continue
            yield json.loads(s)


def load_grounding_jsonl(path: str) -> List[GroundingTask]:
    out: List[GroundingTask] = []
    for obj in iter_jsonl(path):
        out.append(GroundingTask.model_validate(obj))
    return out
