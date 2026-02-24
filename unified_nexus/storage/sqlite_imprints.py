"""BRAIN ARCHITECTURE: Memory + Audit Subsystem → SQLiteImprintStore

Event mirror storage that:
- Persists all nucleus events to SQLite (./runtime/nexus.db)
- Stores events with seq, event_id, event_type, ts_ms, trace_id, payload
- Enables structured queries over event history
- Supports memory retrieval and learning writeback

Used by Nucleus._emit() to mirror events to persistent storage.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any, Dict, Optional

from ..contracts_v1_types import V1Imprint
from ..contracts_v1_schema import canonical_json_bytes, sha256_hex


class SQLiteImprintStore:
    def __init__(self, db_path: str = "./runtime/nexus.db") -> None:
        self.db_path = db_path
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self.conn.execute("PRAGMA journal_mode=WAL;")
        self.conn.execute("PRAGMA synchronous=NORMAL;")
        self._init_schema()

    def _init_schema(self) -> None:
        self.conn.execute(
            """
            CREATE TABLE IF NOT EXISTS imprints (
                imprint_id TEXT PRIMARY KEY,
                ts_ms INTEGER NOT NULL,
                trace_id TEXT NOT NULL,
                kind TEXT NOT NULL,
                data_json BLOB NOT NULL,
                data_hash TEXT NOT NULL
            )
            """
        )
        self.conn.execute(
            """
            CREATE TABLE IF NOT EXISTS events_mirror (
                seq INTEGER PRIMARY KEY,
                event_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                ts_ms INTEGER NOT NULL,
                trace_id TEXT NOT NULL,
                payload_json BLOB NOT NULL,
                payload_hash TEXT NOT NULL
            )
            """
        )
        self.conn.commit()

    def put_imprint(self, imprint: V1Imprint) -> None:
        data_json = canonical_json_bytes(imprint.data)
        data_hash = sha256_hex(data_json)
        self.conn.execute(
            """
            INSERT OR REPLACE INTO imprints(imprint_id, ts_ms, trace_id, kind, data_json, data_hash)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (imprint.imprint_id, imprint.ts_ms, imprint.trace_id, imprint.kind, data_json, data_hash),
        )
        self.conn.commit()

    def mirror_event(self, *, seq: int, event_id: str, event_type: str, ts_ms: int, trace_id: str, payload: Dict[str, Any]) -> None:
        payload_json = canonical_json_bytes(payload)
        payload_hash = sha256_hex(payload_json)
        self.conn.execute(
            """
            INSERT OR REPLACE INTO events_mirror(seq, event_id, event_type, ts_ms, trace_id, payload_json, payload_hash)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (seq, event_id, event_type, ts_ms, trace_id, payload_json, payload_hash),
        )
        self.conn.commit()

    def get_latest_imprint_by_kind(self, kind: str) -> Optional[V1Imprint]:
        row = self.conn.execute(
            """
            SELECT imprint_id, ts_ms, trace_id, kind, data_json
            FROM imprints
            WHERE kind = ?
            ORDER BY ts_ms DESC
            LIMIT 1
            """,
            (kind,),
        ).fetchone()
        if not row:
            return None
        import json

        return V1Imprint(v=1, imprint_id=row[0], ts_ms=row[1], trace_id=row[2], kind=row[3], data=json.loads(row[4]))
