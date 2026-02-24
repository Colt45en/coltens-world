"""BRAIN ARCHITECTURE: Memory + Audit Subsystem → DeterministicEventLog

Hash-chained event log that:
- Maintains cryptographic chain (prev_hash → event → next_hash)
- Appends events to NDJSON file (./runtime/events.v1.ndjson)
- Stores chain head in separate file (./runtime/events.v1.chain)
- Enables tamper detection + replay verification

Used by Nucleus to log all emitted events with deterministic seq ordering.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict

from ..contracts_v1_schema import hash_chain_next
from ..contracts_v1_types import V1EventEnvelope


class DeterministicEventLog:
    def __init__(self, log_path: str = "./runtime/events.v1.ndjson", chain_path: str = "./runtime/events.v1.chain") -> None:
        self.log_path = Path(log_path)
        self.chain_path = Path(chain_path)
        self.log_path.parent.mkdir(parents=True, exist_ok=True)
        self.chain_path.parent.mkdir(parents=True, exist_ok=True)

        self._prev_hash = "0" * 64
        if self.chain_path.exists():
            txt = self.chain_path.read_text(encoding="utf-8").strip()
            if txt:
                self._prev_hash = txt

    @property
    def head_hash(self) -> str:
        return self._prev_hash

    def append(self, event: V1EventEnvelope) -> str:
        next_hash = hash_chain_next(self._prev_hash, event)
        rec: Dict[str, Any] = {
            "v": event.v,
            "event_id": event.event_id,
            "event_type": event.event_type,
            "ts_ms": event.ts_ms,
            "trace_id": event.trace_id,
            "seq": event.seq,
            "payload": event.payload,
            "chain_prev": self._prev_hash,
            "chain_curr": next_hash,
        }
        with self.log_path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(rec, sort_keys=True, separators=(",", ":"), ensure_ascii=False) + "\n")
        self._prev_hash = next_hash
        self.chain_path.write_text(self._prev_hash, encoding="utf-8")
        return next_hash

    def verify_tail(self, last_n: int = 1000) -> bool:
        if not self.log_path.exists():
            return True
        lines = self.log_path.read_text(encoding="utf-8").splitlines()
        if not lines:
            return True
        start = max(0, len(lines) - last_n)
        prev = None
        for i in range(start, len(lines)):
            rec = json.loads(lines[i])
            if prev is not None and rec["chain_prev"] != prev:
                return False
            prev = rec["chain_curr"]
        return True
