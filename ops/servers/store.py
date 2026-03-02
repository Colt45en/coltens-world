from __future__ import annotations

import json
import sqlite3
import time
import uuid
from pathlib import Path
from typing import Any, Dict, Optional

DB_PATH = Path(__file__).resolve().parents[2] / ".audit" / "approvals.db"


def _get_conn():
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("""
        CREATE TABLE IF NOT EXISTS pending_approvals (
            approval_id TEXT PRIMARY KEY,
            trace_id TEXT,
            session_id TEXT,
            action_json TEXT,
            reason TEXT,
            created_ts REAL
        )
    """)
    conn.commit()
    return conn


def create_pending(
    trace_id: str, session_id: str, action_json: str, reason: str
) -> str:
    approval_id = f"appr-{uuid.uuid4().hex}"
    with _get_conn() as conn:
        conn.execute(
            "INSERT INTO pending_approvals (approval_id, trace_id, session_id, action_json, reason, created_ts) VALUES (?, ?, ?, ?, ?, ?)",
            (approval_id, trace_id, session_id, action_json, reason, time.time()),
        )
        conn.commit()
    return approval_id


def get_pending(approval_id: str) -> Optional[Dict[str, Any]]:
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT trace_id, session_id, action_json, reason, created_ts FROM pending_approvals WHERE approval_id = ?",
            (approval_id,),
        ).fetchone()
        if row:
            return {
                "trace_id": row[0],
                "session_id": row[1],
                "action": json.loads(row[2]),
                "reason": row[3],
                "created_ts": row[4],
            }
    return None


def delete_pending(approval_id: str) -> None:
    with _get_conn() as conn:
        conn.execute(
            "DELETE FROM pending_approvals WHERE approval_id = ?", (approval_id,)
        )
        conn.commit()
