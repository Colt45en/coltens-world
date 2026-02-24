from __future__ import annotations

import sqlite3
from typing import Any, Dict, Literal

from utils import content_hash_for, stable_id, utc_now_iso


NarrativeMode = Literal["slice_of_life", "rising_action", "conflict", "climax", "falling_action", "resolution"]


def make_decision_record(plan: Dict[str, Any]) -> Dict[str, Any]:
    batch_id = plan["batch_id"]
    status = plan["overall_status"]

    if status == "passed":
        choice = "APPROVED"
        rationale = "All critical gates passed; no blocking conditions."
        approved = True
    elif status == "warning":
        choice = "APPROVED_WITH_WARNINGS"
        rationale = "Critical gates passed but warnings present; review queue may be growing."
        approved = True
    else:
        choice = "BLOCKED"
        rationale = "One or more critical gates failed; batch is not safe to persist as baseline."
        approved = False

    decision_id = stable_id("DECIDE", f"{batch_id}|{choice}|{plan['content_hash']}", length=14)

    out = {
        "batch_id": batch_id,
        "decisions": [
            {
                "decision_id": decision_id,
                "choice": choice,
                "rationale": rationale,
                "authority": "PM / Automation",
                "decided_at": utc_now_iso(),
            }
        ],
        "approved_for_release": approved,
    }
    out["content_hash"] = content_hash_for(out)
    return out


def _count(conn: sqlite3.Connection, sql: str, params: tuple = ()) -> int:
    cur = conn.execute(sql, params)
    return int(cur.fetchone()[0])


def make_weekly_ops_report(
    *,
    conn: sqlite3.Connection,
    week_starting: str,
    narrative_mode: NarrativeMode,
) -> Dict[str, Any]:
    # Simple operational metrics from DB (MVP)
    lex_count = _count(conn, "SELECT COUNT(*) FROM lexicon_entries")
    rune_count = _count(conn, "SELECT COUNT(*) FROM rune_rows")
    review_count = _count(conn, "SELECT COUNT(*) FROM review_queue")

    # Proxy metrics for health
    # - review ratio indicates confidence issues
    review_ratio = (review_count / max(1, lex_count))
    # health score: 1.0 is best, degrade as review ratio rises
    health_score = max(0.0, 1.0 - min(1.0, review_ratio * 2.0))

    # status thresholds (deterministic)
    if health_score >= 0.85:
        status = "green"
    elif health_score >= 0.65:
        status = "yellow"
    else:
        status = "red"

    # narrative text by mode (measured, not vibes)
    if narrative_mode == "slice_of_life":
        what_changed = f"Pipeline persisted {lex_count} lexicon entries and {rune_count} rune rows. Review queue size is {review_count}."
    elif narrative_mode == "rising_action":
        what_changed = f"Pressure rising: review_ratio={review_ratio:.2f} (review={review_count}, lex={lex_count}). Health score drifting to {health_score:.2f}."
    elif narrative_mode == "conflict":
        what_changed = f"Tradeoff detected: higher extraction coverage increases low-confidence items. review_ratio={review_ratio:.2f} suggests classifier/lens tuning needed."
    elif narrative_mode == "climax":
        what_changed = f"Decision point: status={status.upper()} with health_score={health_score:.2f}. If YELLOW/RED persists, tighten confidence gate or improve lenses."
    elif narrative_mode == "falling_action":
        what_changed = f"Mitigation check: current review queue={review_count}. Next step is reducing review_ratio via better tagging + stronger evidence links."
    else:
        what_changed = f"New baseline established: lex={lex_count}, rune={rune_count}, review={review_count}, health={health_score:.2f} ({status})."

    out = {
        "week_starting": week_starting,
        "narrative_mode": narrative_mode,
        "what_changed": what_changed,
        "metrics": [
            {"metric_name": "lexicon_entry_count", "current_value": lex_count, "trend": "stable", "status": status},
            {"metric_name": "rune_row_count", "current_value": rune_count, "trend": "stable", "status": status},
            {"metric_name": "review_queue_count", "current_value": review_count, "trend": "unknown", "status": status},
            {"metric_name": "review_ratio", "current_value": round(review_ratio, 4), "trend": "unknown", "status": status},
            {"metric_name": "health_score", "current_value": round(health_score, 4), "trend": "unknown", "status": status},
        ],
        "unknowns": [],
        "health_score": round(health_score, 4),
        "status": status,
        "next_week_priorities": [
            "Improve process_tag classifier coverage to reduce 'unknown' lines",
            "Strengthen semantic lenses with better evidence links",
            "Tune confidence threshold or policy if review queue grows",
        ],
    }
    out["content_hash"] = content_hash_for(out)
    return out
