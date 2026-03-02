from __future__ import annotations

import json
import sqlite3
from typing import Any, Dict, List, Optional, Tuple

from utils import stable_id, utc_now_iso


SCHEMA_SQL = """
PRAGMA journal_mode=WAL;

CREATE TABLE IF NOT EXISTS batches (
  batch_id TEXT PRIMARY KEY,
  ingested_at TEXT NOT NULL,
  language TEXT NOT NULL,
  objective TEXT NOT NULL,
  source_file TEXT NOT NULL,
  content_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lexicon_entries (
  entry_id TEXT PRIMARY KEY,
  term TEXT NOT NULL,
  language TEXT NOT NULL,
  namespace TEXT NOT NULL,
  morphology_json TEXT NOT NULL,
  semantic_lenses_json TEXT NOT NULL,
  overall_confidence REAL NOT NULL,
  review_required INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lex_term_lang_ns ON lexicon_entries(term, language, namespace);
CREATE INDEX IF NOT EXISTS idx_lex_review ON lexicon_entries(review_required);

CREATE TABLE IF NOT EXISTS rune_rows (
  rune_id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  language TEXT NOT NULL,
  namespace TEXT NOT NULL,
  process_tag TEXT NOT NULL,
  tag_confidence REAL NOT NULL,
  meaning TEXT NOT NULL,
  methodologies_json TEXT NOT NULL,
  evidence_links_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rune_symbol_lang_tag ON rune_rows(symbol, language, process_tag);

CREATE TABLE IF NOT EXISTS merge_history (
  decision_id TEXT PRIMARY KEY,
  from_ids_json TEXT NOT NULL,
  to_id TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  reason TEXT NOT NULL,
  decided_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS review_queue (
  queue_id TEXT PRIMARY KEY,
  item_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  priority TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_review_item ON review_queue(item_type, item_id);
"""


class MergePolicy:
    """
    v2.0: confidence-based
    Merge if min(confA, confB) > threshold (default 0.8)
    Keep higher confidence row.
    """

    def __init__(self, version: str = "2.0", threshold: float = 0.8):
        self.version = version
        self.threshold = threshold

    def should_merge(self, a_conf: float, b_conf: float) -> Tuple[bool, str]:
        m = min(a_conf, b_conf)
        if m > self.threshold:
            return True, f"min_confidence({m:.2f}) > {self.threshold:.2f}"
        return False, f"min_confidence({m:.2f}) <= {self.threshold:.2f}"


def _j(obj: Any) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def open_db(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys=ON;")
    conn.executescript(SCHEMA_SQL)
    return conn


def upsert_batch(conn: sqlite3.Connection, packet: Dict[str, Any]) -> None:
    conn.execute(
        """
        INSERT OR REPLACE INTO batches(batch_id, ingested_at, language, objective, source_file, content_hash)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            packet["batch_id"],
            packet["ingested_at"],
            packet["language"],
            packet["objective"],
            packet["source_file"],
            packet["content_hash"],
        ),
    )


def _get_existing_lex(
    conn: sqlite3.Connection, term: str, language: str, namespace: str
) -> Optional[Tuple[str, float]]:
    cur = conn.execute(
        "SELECT entry_id, overall_confidence FROM lexicon_entries WHERE term=? AND language=? AND namespace=?",
        (term, language, namespace),
    )
    row = cur.fetchone()
    return (row[0], float(row[1])) if row else None


def _log_merge(
    conn: sqlite3.Connection,
    from_ids: List[str],
    to_id: str,
    policy_version: str,
    reason: str,
) -> None:
    decision_id = stable_id(
        "merge",
        "|".join(sorted(from_ids)) + "->" + to_id + "|" + policy_version,
        length=12,
    )
    conn.execute(
        """
        INSERT OR REPLACE INTO merge_history(decision_id, from_ids_json, to_id, policy_version, reason, decided_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            decision_id,
            _j(sorted(from_ids)),
            to_id,
            policy_version,
            reason,
            utc_now_iso(),
        ),
    )


def _enqueue_review(
    conn: sqlite3.Connection,
    item_type: str,
    item_id: str,
    reason: str,
    priority: str = "medium",
) -> None:
    queue_id = stable_id("rq", f"{item_type}|{item_id}|{reason}", length=12)
    conn.execute(
        """
        INSERT OR REPLACE INTO review_queue(queue_id, item_type, item_id, reason, priority, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (queue_id, item_type, item_id, reason, priority, utc_now_iso()),
    )


def upsert_lexicon_entries(
    conn: sqlite3.Connection, entries: List[Dict[str, Any]], policy: MergePolicy
) -> Dict[str, Any]:
    merges = []
    rejects = []

    for e in entries:
        term = e["term"]
        language = e["language"]
        namespace = e["namespace"]
        new_id = e["entry_id"]
        new_conf = float(e["overall_confidence"])

        existing = _get_existing_lex(conn, term, language, namespace)
        if existing and existing[0] != new_id:
            old_id, old_conf = existing
            ok, reason = policy.should_merge(old_conf, new_conf)
            if ok:
                # Keep higher confidence
                keep = e if new_conf >= old_conf else None
                if keep is not None:
                    # Replace record by deleting old primary key if different
                    conn.execute(
                        "DELETE FROM lexicon_entries WHERE entry_id=?", (old_id,)
                    )
                    _log_merge(conn, [old_id, new_id], new_id, policy.version, reason)
                    merges.append(
                        {"from": [old_id, new_id], "to": new_id, "reason": reason}
                    )
                else:
                    # Keep old: record merge history pointing to old
                    _log_merge(conn, [old_id, new_id], old_id, policy.version, reason)
                    merges.append(
                        {"from": [old_id, new_id], "to": old_id, "reason": reason}
                    )
                    continue
            else:
                rejects.append(
                    {"existing_id": old_id, "new_id": new_id, "reason": reason}
                )
                # Policy v1 behavior would throw; v2 logs and keeps both? You requested governance-driven.
                # Here we DO NOT create duplicates for same key; we reject the new record.
                continue

        conn.execute(
            """
            INSERT OR REPLACE INTO lexicon_entries(
              entry_id, term, language, namespace,
              morphology_json, semantic_lenses_json,
              overall_confidence, review_required, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                new_id,
                term,
                language,
                namespace,
                _j(e["morphology"]),
                _j(e["semantic_lenses"]),
                new_conf,
                1 if e["review_required"] else 0,
                utc_now_iso(),
            ),
        )

        if e["review_required"]:
            _enqueue_review(
                conn,
                "lexicon",
                new_id,
                f"Low confidence ({new_conf:.2f})",
                priority="medium",
            )

    return {"merges": merges, "rejects": rejects, "policy_version": policy.version}


def upsert_rune_rows(conn: sqlite3.Connection, rows: List[Dict[str, Any]]) -> None:
    for r in rows:
        conn.execute(
            """
            INSERT OR REPLACE INTO rune_rows(
              rune_id, symbol, language, namespace, process_tag,
              tag_confidence, meaning,
              methodologies_json, evidence_links_json, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                r["rune_id"],
                r["symbol"],
                r["language"],
                r["namespace"],
                r["process_tag"],
                float(r["tag_confidence"]),
                r["meaning"],
                _j(r["methodologies"]),
                _j(r.get("evidence_links", [])),
                utc_now_iso(),
            ),
        )
