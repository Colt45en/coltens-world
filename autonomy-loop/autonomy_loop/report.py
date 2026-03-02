"""PM: Weekly reports with measured facts + narrative modes."""

from __future__ import annotations
from datetime import datetime, timezone
from typing import Any


def iso_now() -> str:
    """ISO 8601 timestamp (UTC)."""
    return datetime.now(timezone.utc).isoformat()


def weekly_report_from_rows(
    rows: list[dict[str, Any]], mode: str = "operations"
) -> dict[str, Any]:
    """
    Generate weekly report from batch validation snapshots.

    Report is FACTS-ONLY: metrics, gates, status derived from data.
    Narrative is a VIEW LAYER that references facts only (no new claims).
    """
    total = len(rows)
    reds = sum(1 for r in rows if r["status"] == "red")
    yellows = sum(1 for r in rows if r["status"] == "yellow")
    greens = sum(1 for r in rows if r["status"] == "green")

    collision_rate = 0.0  # MVP placeholder: compute via dedupe audit later

    base = {
        "schema_version": "1.0.0",
        "generated_at": iso_now(),
        "range": {
            "batches_count": total,
        },
        "metrics": {
            "green": greens,
            "yellow": yellows,
            "red": reds,
            "collision_rate": collision_rate,
        },
        "state": {
            "facts": [
                f"Total batches: {total}",
                f"Gate status: green={greens}, yellow={yellows}, red={reds}",
                f"Collision rate (MVP): {collision_rate}",
            ]
        },
        "conditions": {
            "gates": ["schema", "traceability", "determinism", "confidence"],
        },
        "status": "green"
        if reds == 0 and yellows == 0
        else ("yellow" if reds == 0 else "red"),
        "actions": [],
        "narrative": {"mode": mode, "lines": []},
    }

    # Narrative is a VIEW layer; must reference measured facts only
    if mode == "rising_action":
        base["narrative"]["lines"] = [
            f"Pressure rising: {reds} red batches and {yellows} yellow batches this period.",
            f"Collision rate is {collision_rate} (improve dedupe audit next).",
        ]
        if reds > 0:
            base["actions"].append(
                "Investigate schema/traceability failures first (hard gates)."
            )
        if yellows > 0:
            base["actions"].append(
                "Increase review throughput or raise confidence via evidence links."
            )
    elif mode == "conflict":
        base["narrative"]["lines"] = [
            "Tradeoffs detected (MVP): you can improve speed OR improve precision, but measure both.",
            f"Current status breakdown: green={greens}, yellow={yellows}, red={reds}.",
        ]
        base["actions"].append(
            "Define objective weights for next week (coverage vs precision vs latency)."
        )
    else:  # operations
        base["narrative"]["lines"] = [
            "Operations summary (facts only):",
            f"Ran {total} batches; {reds} failed hard gates; {yellows} had soft warnings.",
        ]
        base["actions"].append(
            "Implement regression harness to replay last N batches in CI."
        )

    return base
