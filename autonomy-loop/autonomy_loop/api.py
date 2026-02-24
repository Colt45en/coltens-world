"""FastAPI: HTTP API for autonomy loop."""

from __future__ import annotations
from fastapi import FastAPI
from pydantic import BaseModel

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
app = FastAPI(
    title="Autonomy Loop API",
    version="0.1.0",
    description="Multi-agent knowledge artifact pipeline"
)


class IngestReq(BaseModel):
    source_id: str
    kind: str = "mixed"
    language_hint: str | None = None
    text: str
    fail_on_unknown_tag: bool = False


@app.post("/run_batch")
def run_batch(req: IngestReq):
    """
    Run complete batch: Detective → Alchemist → Analyst → Specialist → PM.
    Returns: Complete artifact bundle.
    """
    evidence = build_evidence_packet(req.text, req.source_id, ExtractConfig(kind=req.kind, language_hint=req.language_hint))
    lex = build_lexicon_entries(evidence)
    runes = build_rune_rows(evidence)
    validated = run_gates(evidence, lex, runes)

    decision = {
        "schema_version": "1.0.0",
        "decision_id": stable_id("decision", evidence["batch_id"], prefix="dec"),
        "batch_id": evidence["batch_id"],
        "created_at": evidence["created_at"],
        "status": validated["status"],
        "accepted_risks": [],
        "policy_versions": {"merge_policy": "1.0.0", "contracts": "1.0.0"},
        "notes": ["Computed status derived ONLY from gate results."],
    }

    con = connect(DB_PATH)
    migrate(con)
    seed_taxonomy_process_tags(con, taxonomy_seed_rows())

    # taxonomy lint
    taxonomy_violations = []
    for r in runes:
        tag = r.get("process_tag", "unknown_tag")
        if req.fail_on_unknown_tag and tag == "unknown_tag":
            taxonomy_violations.append({"rune_id": r.get("rune_id"), "process_tag": tag})
            continue
        if not is_process_tag_allowed(con, tag):
            taxonomy_violations.append({"rune_id": r.get("rune_id"), "process_tag": tag})
    if taxonomy_violations:
        validated["status"] = "red"
        validated["gates"].append({"gate": "taxonomy", "passed": False, "details": taxonomy_violations[:50]})
    else:
        validated["gates"].append({"gate": "taxonomy", "passed": True, "details": []})

    insert_batch(con, evidence, validated, decision)

    # review queue insertion
    created_at = evidence["created_at"]
    batch_id = evidence["batch_id"]
    for entry in lex:
        lex_id = entry["lexicon_id"]
        for claim in entry["semantics"]["meaning_claims"]:
            if claim.get("review_required", False):
                review_id = stable_id("review", batch_id, "lexicon", lex_id, claim["claim_id"], prefix="rev")
                insert_review_item(con, review_id, batch_id, "lexicon", lex_id, claim["claim_id"], f"review_required=true (confidence={claim.get('confidence')})", created_at)
    for row in runes:
        rune_id = row["rune_id"]
        for claim in row["meaning"]["meaning_claims"]:
            if claim.get("review_required", False):
                review_id = stable_id("review", batch_id, "rune", rune_id, claim["claim_id"], prefix="rev")
                insert_review_item(con, review_id, batch_id, "rune", rune_id, claim["claim_id"], f"review_required=true (confidence={claim.get('confidence')})", created_at)

    return {
        "EvidencePacket": evidence,
        "LexiconEntry": lex,
        "RuneDecoderRow": runes,
        "ValidatedPlan": validated,
        "DecisionRecord": decision,
    }


@app.get("/health")
def health():
    """Health check."""
    return {"status": "ok"}


def main():
    """Entry point for API."""
    import uvicorn
    uvicorn.run("autonomy_loop.api:app", host="127.0.0.1", port=8001, reload=False)


if __name__ == "__main__":
    main()
