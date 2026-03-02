from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, TypedDict

from .contracts_v1_schema import hash_chain_next
from .contracts_v1_types import V1EventEnvelope


class EventRecord(TypedDict, total=False):
    v: int
    event_id: str
    event_type: str
    ts_ms: int
    trace_id: str
    seq: int
    payload: Dict[str, Any]
    chain_prev: str
    chain_curr: str


def read_events(log_path: Path) -> List[EventRecord]:
    events: List[EventRecord] = []
    for line_no, line in enumerate(
        log_path.read_text(encoding="utf-8").splitlines(), start=1
    ):
        if not line.strip():
            continue
        try:
            rec = json.loads(line)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Invalid JSON at line {line_no}: {exc}") from exc
        events.append(rec)
    return events


def ensure_schema(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS v1_events (
            seq INTEGER PRIMARY KEY,
            event_id TEXT NOT NULL,
            event_type TEXT NOT NULL,
            ts_ms INTEGER NOT NULL,
            trace_id TEXT NOT NULL,
            payload_json BLOB NOT NULL,
            chain_prev TEXT NOT NULL,
            chain_curr TEXT NOT NULL
        )
        """
    )
    conn.commit()


def replay(log_path: Path, out_db: Path) -> Dict[str, Any]:
    events = read_events(log_path)
    out_db.parent.mkdir(parents=True, exist_ok=True)
    if out_db.exists():
        out_db.unlink()

    conn = sqlite3.connect(str(out_db))
    ensure_schema(conn)

    prev_seq = 0
    prev_chain = "0" * 64

    for idx, rec in enumerate(events, start=1):
        seq_value = rec.get("seq")
        if seq_value is None:
            raise ValueError(f"Missing seq at line {idx}")
        seq = int(seq_value)
        if seq <= prev_seq:
            raise ValueError(f"Non-monotonic seq at line {idx}: {seq} <= {prev_seq}")

        chain_prev = str(rec.get("chain_prev", ""))
        if chain_prev != prev_chain:
            raise ValueError(
                f"Chain break at line {idx}: expected {prev_chain}, got {chain_prev}"
            )

        event_type_value = rec.get("event_type")
        ts_ms_value = rec.get("ts_ms")
        trace_id_value = rec.get("trace_id")
        event_id_value = rec.get("event_id")
        if (
            event_type_value is None
            or ts_ms_value is None
            or trace_id_value is None
            or event_id_value is None
        ):
            raise ValueError(f"Missing required event fields at line {idx}")

        payload = dict(rec.get("payload", {}))

        envelope = V1EventEnvelope(
            v=1,
            event_type=str(event_type_value),
            ts_ms=int(ts_ms_value),
            trace_id=str(trace_id_value),
            seq=seq,
            payload=payload,
            event_id=str(event_id_value),
        )
        computed_chain = hash_chain_next(prev_chain, envelope)
        chain_curr = str(rec.get("chain_curr", ""))
        if computed_chain != chain_curr:
            raise ValueError(
                f"Chain hash mismatch at line {idx}: expected {computed_chain}, got {chain_curr}"
            )

        payload_json = json.dumps(
            envelope.payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False
        ).encode("utf-8")
        conn.execute(
            """
            INSERT INTO v1_events(seq, event_id, event_type, ts_ms, trace_id, payload_json, chain_prev, chain_curr)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                envelope.seq,
                envelope.event_id,
                envelope.event_type,
                envelope.ts_ms,
                envelope.trace_id,
                payload_json,
                chain_prev,
                chain_curr,
            ),
        )

        prev_seq = seq
        prev_chain = chain_curr

    conn.commit()
    conn.close()

    return {
        "ok": True,
        "events": len(events),
        "head_seq": prev_seq,
        "head_chain": prev_chain,
        "out_db": str(out_db),
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Replay v1 Nexus event log into a fresh SQLite DB"
    )
    parser.add_argument("--log", required=True, help="Path to runtime/events.v1.ndjson")
    parser.add_argument("--out-db", required=True, help="Output SQLite DB path")
    args = parser.parse_args()

    summary = replay(Path(args.log), Path(args.out_db))
    print(json.dumps(summary, sort_keys=True))


if __name__ == "__main__":
    main()
