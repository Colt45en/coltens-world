"""CLI: Command-line interface for autonomy loop."""

from __future__ import annotations
import sys
import json
from datetime import datetime, timedelta, timezone
from typing import Any
import typer

from .extract import build_evidence_packet, ExtractConfig
from .transform import build_lexicon_entries, build_rune_rows, taxonomy_seed_rows
from .validate import run_gates
from .ids import stable_id
from .db import (
    connect,
    migrate,
    insert_batch,
    seed_taxonomy_process_tags,
    is_process_tag_allowed,
    insert_review_item,
)


DB_PATH = "data/autonomy_loop.sqlite"
app = typer.Typer(add_completion=False, help="Autonomy Loop CLI")


def _read_stdin() -> str:
    """Read all of stdin."""
    return sys.stdin.read()


def _print_json(obj: Any, pretty: bool) -> None:
    if pretty:
        print(json.dumps(obj, ensure_ascii=False, indent=2, sort_keys=True))
    else:
        # CI-friendly: single line deterministic JSON
        print(
            json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        )


def _parse_since(since: str | None, days: int | None) -> str | None:
    """
    Returns ISO timestamp lower bound (UTC) or None.
    since: ISO 8601 datetime string, e.g. 2026-02-11T00:00:00+00:00
    days: lookback window in days
    """
    if since and days:
        raise typer.BadParameter("Use either --since or --days, not both.")
    if since:
        # Accept as-is; caller responsible for UTC if desired.
        return since
    if days is not None:
        return (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    return None


@app.command()
def ingest(
    source_id: str = typer.Option(..., help="Unique source identifier"),
    kind: str = typer.Option("mixed", help="text | code | mixed"),
    language_hint: str | None = typer.Option(
        None, help="Language (e.g., TypeScript, Python)"
    ),
    ci_json: bool = typer.Option(False, help="Emit single-line JSON (CI-friendly)."),
):
    """
    Ingest: Extract EvidencePacket from stdin.
    Output: EvidencePacket JSON to stdout.
    """
    raw = _read_stdin()
    evidence = build_evidence_packet(
        raw, source_id, ExtractConfig(kind=kind, language_hint=language_hint)
    )
    _print_json(evidence, pretty=not ci_json)


@app.command()
def run_batch(
    source_id: str = typer.Option(..., help="Unique source identifier"),
    kind: str = typer.Option("mixed", help="text | code | mixed"),
    fail_on_unknown_tag: bool = typer.Option(
        False,
        help="If set, unknown_tag becomes a taxonomy gate failure (forces red).",
    ),
    ci_json: bool = typer.Option(False, help="Emit single-line JSON (CI-friendly)."),
    language_hint: str | None = typer.Option(None, help="Language hint"),
):
    """
    Run full batch: Detective → Alchemist → Analyst → Specialist → PM.
    Output: Complete bundle (Evidence + Lexicon + Runes + ValidatedPlan + DecisionRecord).
    """
    raw = _read_stdin()
    evidence = build_evidence_packet(
        raw, source_id, ExtractConfig(kind=kind, language_hint=language_hint)
    )
    lex = build_lexicon_entries(evidence)
    runes = build_rune_rows(evidence)
    validated = run_gates(evidence, lex, runes)

    decision = {  # type: ignore
        "schema_version": "1.0.0",
        "decision_id": stable_id("decision", evidence["batch_id"], prefix="dec"),
        "batch_id": evidence["batch_id"],
        "created_at": evidence["created_at"],
        "status": validated["status"],
        "accepted_risks": [],
        "policy_versions": {
            "merge_policy": "1.0.0",
            "contracts": "1.0.0",
        },
        "notes": [
            "Computed status derived ONLY from gate results.",
        ],
    }

    con = connect(DB_PATH)
    migrate(con)
    # ---- Taxonomy registry seed (governance) ----
    seed_taxonomy_process_tags(con, taxonomy_seed_rows())

    # ---- Taxonomy lint (hard stop only if unknown_tag is disallowed later) ----
    # For MVP: unknown_tag is allowed but should drive review/weekly action.
    taxonomy_violations = []
    for r in runes:
        tag = r.get("process_tag", "unknown_tag")
        if fail_on_unknown_tag and tag == "unknown_tag":
            taxonomy_violations.append(
                {"rune_id": r.get("rune_id"), "process_tag": tag}
            )
            continue
        if not is_process_tag_allowed(con, tag):
            taxonomy_violations.append(
                {"rune_id": r.get("rune_id"), "process_tag": tag}
            )
    if taxonomy_violations:
        # This is a governance failure: we produced a tag not in registry and not unknown_tag.
        # Or unknown_tag is disallowed (tight governance mode).
        # Force status to red (hard governance failure).
        validated["status"] = "red"
        validated["gates"].append(
            {
                "gate": "taxonomy",
                "passed": False,
                "details": taxonomy_violations[:50],
            }
        )
    else:
        validated["gates"].append(
            {
                "gate": "taxonomy",
                "passed": True,
                "details": [],
            }
        )

    insert_batch(con, evidence, validated, decision)

    # ---- Review queue insertion (low-confidence / review_required claims) ----
    created_at = evidence["created_at"]
    batch_id = evidence["batch_id"]

    # Lexicon claim reviews
    for entry in lex:
        lex_id = entry["lexicon_id"]
        for claim in entry["semantics"]["meaning_claims"]:
            if claim.get("review_required", False):
                review_id = stable_id(
                    "review",
                    batch_id,
                    "lexicon",
                    lex_id,
                    claim["claim_id"],
                    prefix="rev",
                )
                insert_review_item(
                    con=con,
                    review_id=review_id,
                    batch_id=batch_id,
                    artifact_type="lexicon",
                    artifact_id=lex_id,
                    claim_id=claim["claim_id"],
                    reason=f"review_required=true (confidence={claim.get('confidence')})",
                    created_at=created_at,
                )

    # Rune claim reviews
    for row in runes:
        rune_id = row["rune_id"]
        for claim in row["meaning"]["meaning_claims"]:
            if claim.get("review_required", False):
                review_id = stable_id(
                    "review", batch_id, "rune", rune_id, claim["claim_id"], prefix="rev"
                )
                insert_review_item(
                    con=con,
                    review_id=review_id,
                    batch_id=batch_id,
                    artifact_type="rune",
                    artifact_id=rune_id,
                    claim_id=claim["claim_id"],
                    reason=f"review_required=true (confidence={claim.get('confidence')})",
                    created_at=created_at,
                )

    # Output bundle (MVP)
    bundle: dict[str, Any] = {
        "EvidencePacket": evidence,
        "LexiconEntry": lex,
        "RuneDecoderRow": runes,
        "ValidatedPlan": validated,
        "DecisionRecord": decision,
    }
    _print_json(bundle, pretty=not ci_json)


@app.command()
def weekly_report(
    days: int = typer.Option(7, help="Look back N days"),
    since: str | None = typer.Option(
        None, help="ISO8601 timestamp lower bound (overrides --days)."
    ),
    mode: str = typer.Option(
        "operations", help="operations | rising_action | conflict"
    ),
    ci_json: bool = typer.Option(False, help="Emit single-line JSON (CI-friendly)."),
):
    """
    Generate WeeklyOpsReport from recent batches.
    Output: WeeklyOpsReport JSON to stdout.
    """
    from .report import weekly_report_from_rows

    con = connect(DB_PATH)
    migrate(con)
    seed_taxonomy_process_tags(con, taxonomy_seed_rows())

    lb = _parse_since(since, days)
    if lb is None:
        lb = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    cur = con.execute(
        "SELECT validated_plan_json FROM batches WHERE created_at >= ? ORDER BY created_at ASC",
        (lb,),
    )
    rows = []
    for (vp,) in cur.fetchall():
        vp_obj = json.loads(vp)
        rows.append({"status": vp_obj.get("status", "red")})

    report = weekly_report_from_rows(rows, mode=mode)
    _print_json(report, pretty=not ci_json)


@app.command()
def taxonomy_list(active_only: bool = typer.Option(True, help="Show only active tags")):
    """
    Show the controlled vocabulary in DB (taxonomy registry).
    """
    con = connect(DB_PATH)
    migrate(con)
    seed_taxonomy_process_tags(con, taxonomy_seed_rows())
    if active_only:
        cur = con.execute(
            "SELECT tag, description, active, created_at FROM taxonomy_process_tags WHERE active = 1 ORDER BY tag ASC"
        )
    else:
        cur = con.execute(
            "SELECT tag, description, active, created_at FROM taxonomy_process_tags ORDER BY tag ASC"
        )
    out = [
        {"tag": t, "description": d, "active": bool(a), "created_at": c}
        for (t, d, a, c) in cur.fetchall()
    ]
    _print_json(out, pretty=True)


@app.command()
def replay_last(
    n: int = typer.Option(25, help="Replay last N batches"),
    since: str | None = typer.Option(
        None, help="ISO8601 timestamp lower bound (limits which batches are replayed)."
    ),
    days: int | None = typer.Option(
        None, help="Replay only batches in the last N days (alternative to --since)."
    ),
    fail_on_unknown_tag: bool = typer.Option(
        False,
        help="If set, unknown_tag becomes a taxonomy violation during replay.",
    ),
    ci_json: bool = typer.Option(False, help="Emit single-line JSON (CI-friendly)."),
):
    """
    Regression harness: replay last N batches from DB and ensure determinism hashes match.
    Fails (exit code 1) if any drift is detected.
    """
    from .transform import build_lexicon_entries, build_rune_rows
    from .validate import run_gates

    con = connect(DB_PATH)
    migrate(con)
    seed_taxonomy_process_tags(con, taxonomy_seed_rows())

    lb = _parse_since(since, days)
    if lb is None:
        cur = con.execute(
            "SELECT batch_id, evidence_json, validated_plan_json FROM batches ORDER BY created_at DESC LIMIT ?",
            (n,),
        )
    else:
        cur = con.execute(
            "SELECT batch_id, evidence_json, validated_plan_json FROM batches WHERE created_at >= ? ORDER BY created_at DESC LIMIT ?",
            (lb, n),
        )
    rows = cur.fetchall()
    drift = []

    for batch_id, ev_json, vp_json in rows:
        evidence = json.loads(ev_json)
        prev_vp = json.loads(vp_json)
        prev_hashes = prev_vp.get("hashes", {})

        lex = build_lexicon_entries(evidence)
        runes = build_rune_rows(evidence)
        vp = run_gates(evidence, lex, runes)

        # Taxonomy lint consistency: any non-registered tag (except unknown_tag) is drift-worthy.
        tax_bad = []
        for r in runes:
            tag = r.get("process_tag", "unknown_tag")
            if fail_on_unknown_tag and tag == "unknown_tag":
                tax_bad.append({"rune_id": r.get("rune_id"), "process_tag": tag})
                continue
            if not is_process_tag_allowed(con, tag):
                tax_bad.append({"rune_id": r.get("rune_id"), "process_tag": tag})

        if tax_bad:
            drift.append(
                {
                    "batch_id": batch_id,
                    "type": "taxonomy_violation",
                    "details": tax_bad[:20],
                }
            )
            continue

        if vp.get("hashes") != prev_hashes:
            drift.append(
                {
                    "batch_id": batch_id,
                    "type": "hash_drift",
                    "prev_hashes": prev_hashes,
                    "new_hashes": vp.get("hashes"),
                }
            )

    if drift:
        _print_json(
            {
                "ok": False,
                "checked": len(rows),
                "drift_count": len(drift),
                "drift": drift,
            },
            pretty=not ci_json,
        )
        raise typer.Exit(code=1)
    _print_json({"ok": True, "checked": len(rows)}, pretty=not ci_json)


def main():
    """Entry point for CLI."""
    app()


if __name__ == "__main__":
    main()
