from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional

from .utils import ensure_dir, now_iso


@dataclass
class AuditLogger:
    audit_file: Path

    def __post_init__(self) -> None:
        ensure_dir(self.audit_file.parent)

    def log(self, event: str, payload: Dict[str, Any]) -> None:
        rec = {"ts": now_iso(), "event": event, "payload": payload}
        with self.audit_file.open("a", encoding="utf-8") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")

    def log_action(self, action: Dict[str, Any], ok: bool, detail: Optional[Dict[str, Any]] = None) -> None:
        self.log("action", {"action": action, "ok": ok, "detail": detail or {}})
