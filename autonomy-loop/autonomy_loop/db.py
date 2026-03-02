"""Database persistence: SQLite with indexes and review queue."""

from __future__ import annotations
import sqlite3
from typing import Any
import json
from pathlib import Path
from datetime import datetime, timezone


def connect(db_path: str) -> sqlite3.Connection:
    """Open SQLite connection with WAL and foreign keys enabled."""
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(db_path)
    con.execute("PRAGMA journal_mode=WAL;")
    con.execute("PRAGMA foreign_keys=ON;")
    return con


def migrate(con: sqlite3.Connection) -> None:
    """Create schema if not exists."""
    con.executescript("""
    CREATE TABLE IF NOT EXISTS batches (
      batch_id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      source_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      evidence_json TEXT NOT NULL,
      validated_plan_json TEXT NOT NULL,
      decision_record_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS lexicon_entries (
      lexicon_id TEXT PRIMARY KEY,
      language TEXT NOT NULL,
      term TEXT NOT NULL,
      batch_id TEXT NOT NULL,
      entry_json TEXT NOT NULL,
      UNIQUE(language, term),
      FOREIGN KEY(batch_id) REFERENCES batches(batch_id)
    );

    CREATE TABLE IF NOT EXISTS rune_rows (
      rune_id TEXT PRIMARY KEY,
      code_language TEXT NOT NULL,
      symbol TEXT NOT NULL,
      process_tag TEXT NOT NULL,
      batch_id TEXT NOT NULL,
      row_json TEXT NOT NULL,
      UNIQUE(code_language, symbol, process_tag),
      FOREIGN KEY(batch_id) REFERENCES batches(batch_id)
    );

    -- Taxonomy registry (governance spine)
    CREATE TABLE IF NOT EXISTS taxonomy_process_tags (
      tag TEXT PRIMARY KEY,
      description TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS review_queue (
      review_id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      artifact_type TEXT NOT NULL,
      artifact_id TEXT NOT NULL,
      claim_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL,
      resolved_at TEXT,
      resolution_note TEXT,
      FOREIGN KEY(batch_id) REFERENCES batches(batch_id)
    );

    CREATE INDEX IF NOT EXISTS idx_batches_created ON batches(created_at);
    CREATE INDEX IF NOT EXISTS idx_review_open ON review_queue(status, created_at);
    CREATE INDEX IF NOT EXISTS idx_lexicon_term ON lexicon_entries(term);
    CREATE INDEX IF NOT EXISTS idx_rune_symbol ON rune_rows(symbol);
    CREATE INDEX IF NOT EXISTS idx_rune_process_tag ON rune_rows(process_tag);
    """)
    con.commit()


def insert_batch(
    con: sqlite3.Connection,
    evidence: dict[str, Any],
    validated_plan: dict[str, Any],
    decision_record: dict[str, Any],
) -> None:
    """Insert batch and all artifacts in one transaction."""
    con.execute(
        "INSERT OR REPLACE INTO batches"
        "(batch_id, created_at, source_id, kind, evidence_json, validated_plan_json, decision_record_json) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (
            evidence["batch_id"],
            evidence["created_at"],
            evidence["source"]["source_id"],
            evidence["source"]["kind"],
            json.dumps(
                evidence, ensure_ascii=False, sort_keys=True, separators=(",", ":")
            ),
            json.dumps(
                validated_plan,
                ensure_ascii=False,
                sort_keys=True,
                separators=(",", ":"),
            ),
            json.dumps(
                decision_record,
                ensure_ascii=False,
                sort_keys=True,
                separators=(",", ":"),
            ),
        ),
    )
    con.commit()


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def seed_taxonomy_process_tags(
    con: sqlite3.Connection, tags: list[tuple[str, str]]
) -> None:
    """
    Ensure the controlled vocabulary exists in DB (idempotent).
    tags: [(tag, description)]
    """
    now = _iso_now()
    con.executemany(
        "INSERT OR IGNORE INTO taxonomy_process_tags(tag, description, active, created_at) VALUES (?, ?, 1, ?)",
        [(t, d, now) for (t, d) in tags],
    )
    con.commit()


def is_process_tag_allowed(con: sqlite3.Connection, tag: str) -> bool:
    if tag == "unknown_tag":
        return True
    cur = con.execute(
        "SELECT 1 FROM taxonomy_process_tags WHERE tag = ? AND active = 1 LIMIT 1",
        (tag,),
    )
    return cur.fetchone() is not None


def insert_review_item(
    con: sqlite3.Connection,
    review_id: str,
    batch_id: str,
    artifact_type: str,
    artifact_id: str,
    claim_id: str,
    reason: str,
    created_at: str,
) -> None:
    con.execute(
        "INSERT OR IGNORE INTO review_queue(review_id, batch_id, artifact_type, artifact_id, claim_id, reason, status, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, 'open', ?)",
        (review_id, batch_id, artifact_type, artifact_id, claim_id, reason, created_at),
    )
    con.commit()
