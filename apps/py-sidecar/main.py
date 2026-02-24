#!/usr/bin/env python3
"""
Autonomy Loop Pipeline Server
Enhanced main.py for py-sidecar integration with Nucleus routing.

Provides HTTP endpoints to trigger pipeline execution and query results.
Integrates with Nucleus WebSocket hub for real-time gateway updates.
"""

import json
import os
import sys
from pathlib import Path
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

# Add py-sidecar to path
sys.path.insert(0, str(Path(__file__).parent))

from utils import stable_id
from ingest import run_ingest
from transform import run_transform
from gates import run_gates
from persist import open_db, upsert_batch, upsert_lexicon_entries, upsert_rune_rows
from report import make_decision_record, make_weekly_ops_report
from routes_flowstate import create_flowstate_routes
from routes_agent import setup_agent_system

# ============================================================================
# Pydantic Models (Request/Response)
# ============================================================================

class PipelineRequest(BaseModel):
    """Request to run the autonomy loop pipeline."""
    input_file: str = Field(..., description="Path to source file to ingest")
    language: str = Field(default="TypeScript", description="Programming language")
    objective: str = Field(
        default="extract and analyze code structure",
        description="Ingestion objective for knowledge refinery"
    )
    output_dir: str = Field(
        default="pipeline_results",
        description="Directory to write artifacts"
    )
    narrative_mode: str = Field(
        default="slice_of_life",
        description="Weekly report narrative mode"
    )
    min_confidence: float = Field(
        default=0.80,
        description="Minimum confidence threshold for approval"
    )

class PipelineResponse(BaseModel):
    """Response from pipeline execution."""
    success: bool
    batch_id: str
    decision: str  # APPROVED, APPROVED_WITH_WARNINGS, or BLOCKED
    artifacts: dict
    gates: dict
    governance: dict
    timestamp: str

class QueryRequest(BaseModel):
    """Request to query lexicon."""
    term: Optional[str] = None
    language: str = "TypeScript"
    namespace: Optional[str] = None
    min_confidence: float = 0.80
    limit: int = 50

# ============================================================================
# FastAPI App Setup
# ============================================================================

app = FastAPI(
    title="Autonomy Loop Pipeline",
    description="Deterministic knowledge refinery for code understanding",
    version="1.0.0"
)

# Register flowstate enrichment routes
create_flowstate_routes(app)

# Database connection (shared across requests)
db_path = os.path.join(os.path.dirname(__file__), "world.db")

# ============================================================================
# Endpoints
# ============================================================================

@app.post("/pipeline/run", response_model=PipelineResponse)
async def run_pipeline(req: PipelineRequest) -> PipelineResponse:
    """
    Execute the full autonomy loop pipeline: Detective → Alchemist → Analyst → Specialist → PM

    Returns:
    - batch_id: Deterministic batch identifier
    - decision: APPROVED, APPROVED_WITH_WARNINGS, or BLOCKED
    - artifacts: Dictionary of output file paths
    - gates: Gate results (critical/warning)
    - governance: Approval status + review queue info
    """
    try:
        # Ensure output directory exists
        Path(req.output_dir).mkdir(parents=True, exist_ok=True)

        # ===== STAGE 1: DETECTIVE (Ingest) =====
        with open(req.input_file, "r", encoding="utf-8") as f:
            source_text = f.read()

        evidence = run_ingest(
            source_file=req.input_file,
            language=req.language,
            objective=req.objective,
            text=source_text
        )

        # Write evidence artifact
        evidence_path = Path(req.output_dir) / "evidence_packet.json"
        with open(evidence_path, "w") as f:
            json.dump(evidence, f, indent=2, sort_keys=True)

        # ===== STAGE 2: ALCHEMIST (Transform) =====
        lexicon_rows, rune_rows = run_transform(
            packet=evidence,
            source_text=source_text
        )

        # Write lexicon and rune artifacts
        lex_path = Path(req.output_dir) / "lexicon_entries.json"
        with open(lex_path, "w") as f:
            json.dump([row.model_dump() for row in lexicon_rows], f, indent=2, sort_keys=True)

        rune_path = Path(req.output_dir) / "rune_rows.json"
        with open(rune_path, "w") as f:
            json.dump([row.model_dump() for row in rune_rows], f, indent=2, sort_keys=True)

        # ===== STAGE 3: ANALYST (Gates) =====
        gates, overall_status = run_gates(
            lexicon_rows=lexicon_rows,
            rune_rows=rune_rows,
            expected_lex_hash=evidence.get("lexicon_determinism_key"),
            expected_rune_hash=evidence.get("rune_process_determinism_key")
        )

        # Write validated plan
        plan_path = Path(req.output_dir) / "validated_plan.json"
        with open(plan_path, "w") as f:
            json.dump({
                "gates": [g.model_dump() for g in gates],
                "overall_status": overall_status,
            }, f, indent=2, sort_keys=True)

        # ===== STAGE 4: PM (Decision + Report) =====
        decision_record = make_decision_record(
            overall_status=overall_status,
            lex_count=len(lexicon_rows),
            rune_count=len(rune_rows),
            gates=[g.model_dump() for g in gates]
        )

        decision_path = Path(req.output_dir) / "decision_record.json"
        with open(decision_path, "w") as f:
            json.dump(decision_record, f, indent=2, sort_keys=True)

        # Weekly ops report
        weekly_report = make_weekly_ops_report(
            mode=req.narrative_mode,
            lex_count=len(lexicon_rows),
            rune_count=len(rune_rows),
            review_count=sum(1 for e in lexicon_rows if getattr(e, "review_required", False)),
            gates=[g.model_dump() for g in gates]
        )

        report_path = Path(req.output_dir) / "weekly_ops_report.json"
        with open(report_path, "w") as f:
            json.dump(weekly_report, f, indent=2, sort_keys=True)

        # ===== STAGE 5: SPECIALIST (Persist) =====
        batch_id = stable_id("batch", f"{req.language}|{datetime.utcnow().isoformat()}")
        approved_for_release = decision_record.get("approved_for_release", False)

        merge_result = None
        if approved_for_release:
            db_conn = open_db(db_path)
            try:
                # Upsert batch
                upsert_batch(
                    conn=db_conn,
                    batch_id=batch_id,
                    language=req.language,
                    objective=req.objective,
                    source_file=req.input_file,
                    status="approved" if overall_status == "passed" else "approved_with_warnings"
                )

                # Upsert lexicon entries
                enqueued_count = upsert_lexicon_entries(
                    conn=db_conn,
                    batch_id=batch_id,
                    entries=lexicon_rows
                )

                # Upsert rune rows
                upsert_rune_rows(
                    conn=db_conn,
                    batch_id=batch_id,
                    runes=rune_rows
                )

                db_conn.commit()

                merge_result = {
                    "batch_id": batch_id,
                    "entries_upserted": len(lexicon_rows),
                    "runes_upserted": len(rune_rows),
                    "entries_enqueued_for_review": enqueued_count,
                    "merge_policy": "v2.0",
                    "timestamp": datetime.utcnow().isoformat()
                }
            finally:
                db_conn.close()

            merge_path = Path(req.output_dir) / "merge_result.json"
            with open(merge_path, "w") as f:
                json.dump(merge_result, f, indent=2, sort_keys=True)

        # ===== RESPONSE =====
        return PipelineResponse(
            success=True,
            batch_id=batch_id,
            decision=decision_record.get("choice", "BLOCKED"),
            artifacts={
                "evidence_packet": str(evidence_path),
                "lexicon_entries": str(lex_path),
                "rune_rows": str(rune_path),
                "validated_plan": str(plan_path),
                "decision_record": str(decision_path),
                "weekly_ops_report": str(report_path),
                "merge_result": str(merge_path) if merge_result else None,
            },
            gates={g.name: {"passed": g.passed, "severity": g.severity} for g in gates},
            governance={
                "overall_status": overall_status,
                "approved_for_release": approved_for_release,
                "batch_id": batch_id,
            },
            timestamp=datetime.utcnow().isoformat()
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline failed: {str(e)}")

@app.get("/pipeline/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "online",
        "service": "autonomy-loop-pipeline",
        "version": "1.0.0",
        "db_path": db_path,
        "db_exists": os.path.exists(db_path)
    }

# ============================================================================
# Setup Agent System
# ============================================================================
setup_agent_system(app)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3002)
