"""
Autonomy Loop contracts (OpenAPI source of truth).

These Pydantic models define the API boundaries between:
- Nucleus (TypeScript, TS) → requests over HTTP/WS
- Autonomy Loop (Python, PY) → serves via FastAPI

This file is the canonical contract spec. Generate TS types from the OpenAPI output.
"""

from pydantic import BaseModel, Field
from typing import Literal, List, Optional, Any, Dict
from datetime import datetime

# ============================================================================
# 1. REQUEST MODELS (TS → PY)
# ============================================================================


class IngestRequest(BaseModel):
    """Ingest raw text/code into autonomy loop."""

    source_id: str = Field(
        ...,
        min_length=1,
        max_length=256,
        description="Unique source identifier (e.g., file:src/math.ts)",
    )
    kind: Literal["text", "code", "mixed"] = Field("mixed", description="Input kind")
    language_hint: Optional[str] = Field(
        None, description="Language (TypeScript, Python, etc.)"
    )
    text: str = Field(..., min_length=1, description="Raw input text")


class RunBatchRequest(BaseModel):
    """Run full batch: Detective → Alchemist → Analyst → Specialist → PM."""

    source_id: str = Field(..., min_length=1, max_length=256)
    kind: Literal["text", "code", "mixed"] = "mixed"
    language_hint: Optional[str] = None
    text: str = Field(..., min_length=1)
    fail_on_unknown_tag: bool = Field(
        False, description="If set, unknown_tag forces red status"
    )


# ============================================================================
# 2. ARTIFACT MODELS (PY → TS, canonical schemas)
# ============================================================================


class ClaimModel(BaseModel):
    """A graded meaning claim (not truth, but testable claim)."""

    claim_id: str
    claim: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    review_required: bool = False
    falsification_tests: List[str] = []


class EvidencePacketModel(BaseModel):
    """Raw input snapshot with tokenization, claims, objective."""

    schema_version: str = "1.0.0"
    batch_id: str
    created_at: str
    source: Dict[str, Any]
    raw: str
    tokens: Dict[str, List[str]]
    claims: Dict[str, List[ClaimModel]]
    objective: Dict[str, List[str]]


class LexiconEntryModel(BaseModel):
    """Language term with morphology, semantics, and trace."""

    schema_version: str = "1.0.0"
    lexicon_id: str
    language: str
    term: str
    morphology: Dict[str, Any]
    semantics: Dict[str, Any]
    trace: Dict[str, str]


class RuneDecoderRowModel(BaseModel):
    """Code symbol with process tag classification."""

    schema_version: str = "1.0.0"
    rune_id: str
    code_language: str
    symbol: str
    symbol_type: str
    process_tag: str
    meaning: Dict[str, Any]
    use: Dict[str, Any]
    methodology: List[str]
    trace: Dict[str, str]


class GateResultModel(BaseModel):
    """Individual gate validation result."""

    gate: str
    passed: bool
    details: List[Any] = []


class ValidatedPlanModel(BaseModel):
    """Gate validation results with status."""

    schema_version: str = "1.0.0"
    batch_id: str
    gates: List[GateResultModel]
    status: Literal["red", "yellow", "green"]
    hashes: Dict[str, str] = {}
    review_requirements: List[Dict[str, Any]] = []


class DecisionRecordModel(BaseModel):
    """Decision snapshot with policy versions."""

    schema_version: str = "1.0.0"
    decision_id: str
    batch_id: str
    created_at: str
    status: Literal["red", "yellow", "green"]
    accepted_risks: List[str] = []
    policy_versions: Dict[str, str] = {}
    notes: List[str] = []


class RunBatchResponse(BaseModel):
    """Complete batch output (all 5 artifacts)."""

    EvidencePacket: EvidencePacketModel
    LexiconEntry: List[LexiconEntryModel]
    RuneDecoderRow: List[RuneDecoderRowModel]
    ValidatedPlan: ValidatedPlanModel
    DecisionRecord: DecisionRecordModel


# ============================================================================
# 3. QUERY MODELS (TS → PY lookup/batch operations)
# ============================================================================


class TaxonomyListRequest(BaseModel):
    """Query controlled vocabulary (process tags)."""

    active_only: bool = True


class TaxonomyListResponse(BaseModel):
    """List of registered process tags."""

    tags: List[Dict[str, Any]]
    total: int


class ReplayBatchRequest(BaseModel):
    """Regression harness: replay batches and check for determinism drift."""

    n: int = Field(25, ge=1, le=1000, description="Replay last N batches")
    since: Optional[str] = Field(None, description="ISO8601 timestamp lower bound")
    days: Optional[int] = Field(None, ge=1)
    fail_on_unknown_tag: bool = False


class DriftItemModel(BaseModel):
    """Single drift detection result."""

    batch_id: str
    drift_type: str
    details: Dict[str, Any] = {}


class ReplayBatchResponse(BaseModel):
    """Regression report."""

    ok: bool
    checked: int
    drift_count: int = 0
    drift: List[DriftItemModel] = []


# ============================================================================
# 4. ERROR MODELS (Standard error responses)
# ============================================================================


class ErrorResponse(BaseModel):
    """Standard error envelope."""

    error: str
    code: str = "INTERNAL_ERROR"
    details: Optional[Dict[str, Any]] = None
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
