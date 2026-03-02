from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Literal, Optional, TypedDict, Union


# ---------------------------
# Observations (what the agent sees)
# ---------------------------


@dataclass(frozen=True)
class WebObservation:
    url: str
    title: str
    dom_available: bool
    a11y_available: bool
    screenshot_path: Optional[str] = None


@dataclass(frozen=True)
class FileObservation:
    cwd: str
    allowed_roots: List[str]


@dataclass(frozen=True)
class DesktopObservation:
    platform: str
    active_window_title: Optional[str] = None


Observation = Union[WebObservation, FileObservation, DesktopObservation]


# ---------------------------
# Action DSL (what the agent does)
# ---------------------------

TargetKind = Literal["role", "text", "selector", "point"]


class ActionTarget(TypedDict, total=False):
    kind: TargetKind

    # role-target
    role: str
    name: str

    # text-target
    value: str

    # selector-target
    selector: str

    # point-target
    x: int
    y: int


ActionType = Literal[
    "click",
    "type_text",
    "press_key",
    "scroll",
    "wait",
    "extract",
    "open_path",
    "finish",
]


class Action(TypedDict, total=False):
    type: ActionType
    target: ActionTarget

    # typing
    text: str
    submit: bool

    # key presses
    key: str

    # scroll
    dx: int
    dy: int

    # wait
    ms: int

    # extract
    kind: str

    # open
    path: str

    # finish
    status: str
    result: Dict[str, Any]


def click_role(role: str, name: str) -> Action:
    return {"type": "click", "target": {"kind": "role", "role": role, "name": name}}


def click_text(value: str) -> Action:
    return {"type": "click", "target": {"kind": "text", "value": value}}


def click_selector(selector: str) -> Action:
    return {"type": "click", "target": {"kind": "selector", "selector": selector}}


def click_point(x: int, y: int) -> Action:
    return {"type": "click", "target": {"kind": "point", "x": int(x), "y": int(y)}}


def type_text(text: str, submit: bool = False) -> Action:
    return {"type": "type_text", "text": text, "submit": bool(submit)}


def press_key(key: str) -> Action:
    return {"type": "press_key", "key": key}


def scroll(dx: int = 0, dy: int = 0) -> Action:
    return {"type": "scroll", "dx": int(dx), "dy": int(dy)}


def wait(ms: int) -> Action:
    return {"type": "wait", "ms": int(ms)}


def finish(result: Optional[Dict[str, Any]] = None) -> Action:
    return {"type": "finish", "status": "finish", "result": result or {}}
