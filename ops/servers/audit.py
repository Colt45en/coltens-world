from __future__ import annotations

import json
import threading
import time
from pathlib import Path
from typing import Any, Dict

_LOCK = threading.Lock()


def _repo_root() -> Path:
    # Adjust if your layout differs; this assumes ops/servers/audit.py
    return Path(__file__).resolve().parents[2]


AUDIT_DIR = _repo_root() / ".audit"
AUDIT_DIR.mkdir(parents=True, exist_ok=True)

TOOL_EVENTS_PATH = AUDIT_DIR / "tool-events.ndjson"
DESKTOP_ACTIONS_PATH = AUDIT_DIR / "desktop-actions.ndjson"


def append_ndjson(path: Path | str, event: Dict[str, Any]) -> None:
    if isinstance(path, str):
        path = AUDIT_DIR / path
    event = dict(event)
    event.setdefault("ts_unix", time.time())

    line = json.dumps(event, ensure_ascii=False)
    with _LOCK:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a", encoding="utf-8") as f:
            f.write(line + "\n")
            f.flush()


def audit_tool_event(
    kind: str, trace_id: str, session_id: str, payload: Dict[str, Any]
) -> None:
    append_ndjson(
        TOOL_EVENTS_PATH,
        {
            "kind": kind,
            "trace_id": trace_id,
            "session_id": session_id,
            "payload": payload,
        },
    )


def audit_desktop_action(
    kind: str, trace_id: str, session_id: str, payload: Dict[str, Any]
) -> None:
    append_ndjson(
        DESKTOP_ACTIONS_PATH,
        {
            "kind": kind,
            "trace_id": trace_id,
            "session_id": session_id,
            "payload": payload,
        },
    )
