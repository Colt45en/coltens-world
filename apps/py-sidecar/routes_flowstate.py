#!/usr/bin/env python3
"""
Flowstate Enrichment Routes

Provides lightweight lexicon extraction for flowstate code analysis.
Takes code + flowstate metrics, returns enriched lexicon entries for autonomy system.
"""

from typing import Optional, List
from pydantic import BaseModel, Field
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent))

from utils import stable_id
from ingest import run_ingest
from transform import run_transform

# ============================================================================
# Pydantic Models
# ============================================================================

class FlowstateMetrics(BaseModel):
    """Flowstate metrics from IDE analysis."""
    energy: float = Field(..., description="Energy metric 0-1.5")
    tempo: float = Field(..., description="Tempo metric 0-1")
    tension: int = Field(..., description="Tension metric")
    remainingBraces: int = Field(..., description="Remaining braces")
    mismatchBraces: int = Field(..., description="Mismatched braces")
    keywordCount: int = Field(..., description="Keyword count")
    tokenCount: int = Field(..., description="Token count")
    density: float = Field(..., description="Tokens per line")


class FlowstateEnrichmentRequest(BaseModel):
    """Request for flowstate enrichment."""
    code: str = Field(..., description="Source code to analyze")
    metrics: FlowstateMetrics = Field(..., description="Flowstate metrics")
    language: str = Field(default="TypeScript", description="Programming language")
    topN: int = Field(default=32, ge=1, le=128, description="Top N tokens to extract")
    sessionId: Optional[str] = Field(None, description="Trace session ID")


class EnrichedLexiconEntry(BaseModel):
    """Enriched lexicon entry from flowstate analysis."""
    id: str = Field(..., description="Stable entry ID")
    token: str = Field(..., description="Token/symbol name")
    count: int = Field(..., description="Occurrence count")
    context: str = Field(..., description="First context where found")
    confidence: float = Field(..., description="Confidence 0-1")
    autonomy_tags: List[str] = Field(default_factory=list, description="Tags for autonomy system")


class FlowstateEnrichmentResponse(BaseModel):
    """Response from flowstate enrichment."""
    ok: bool = Field(..., description="Success flag")
    sessionId: Optional[str] = Field(None, description="Trace session ID")
    metrics: Optional[FlowstateMetrics] = Field(None, description="Echo of input metrics")
    entries: List[EnrichedLexiconEntry] = Field(default_factory=list, description="Enriched lexicon")
    determinism_hash: Optional[str] = Field(None, description="Deterministic hash for verification")
    error: Optional[str] = Field(None, description="Error message if !ok")


# ============================================================================
# Enrichment Logic
# ============================================================================

def enrich_flowstate_code(
    code: str,
    metrics: FlowstateMetrics,
    language: str = "TypeScript",
    topN: int = 32,
) -> tuple[List[EnrichedLexiconEntry], str]:
    """
    Extract and enrich lexicon entries from code using flowstate metrics.

    Returns:
        (entries, determinism_hash)
    """
    try:
        # Stage 1: Ingest (extract structure from code)
        evidence = run_ingest(
            source_file="<flowstate-analysis>",
            language=language,
            objective="autonomous lexicon extraction from flowstate metrics",
            text=code
        )

        # Stage 2: Transform (extract lexicon + runes)
        lexicon_rows, rune_rows = run_transform(
            packet=evidence,
            source_text=code
        )

        # Stage 3: Enrich lexicon entries with autonomy tags + metrics context
        enriched = []
        for i, lex_row in enumerate(lexicon_rows[:topN]):
            # Map flowstate metrics to autonomy tags
            autonomy_tags = []
            if metrics.energy > 0.8:
                autonomy_tags.append("high_activity")
            if metrics.tension >= 3:
                autonomy_tags.append("complex_structure")
            if metrics.density > 5.0:
                autonomy_tags.append("dense_code")
            if metrics.keywordCount > metrics.tokenCount * 0.3:
                autonomy_tags.append("control_heavy")

            entry = EnrichedLexiconEntry(
                id=stable_id(lex_row.token),
                token=lex_row.token,
                count=getattr(lex_row, "count", 1),
                context=getattr(lex_row, "first_context", ""),
                confidence=min(1.0, 0.7 + (0.3 * (i / max(topN, 1)))),  # Decay confidence by rank
                autonomy_tags=autonomy_tags,
            )
            enriched.append(entry)

        # Determinism hash from combined evidence
        determinism_key = evidence.get("lexicon_determinism_key", "unknown")

        return enriched, determinism_key

    except Exception as e:
        raise RuntimeError(f"Enrichment failed: {str(e)}")


# ============================================================================
# Factory for FastAPI Integration
# ============================================================================

def create_flowstate_routes(app):
    """Register flowstate enrichment routes with FastAPI app."""

    @app.post("/flowstate/enrich", response_model=FlowstateEnrichmentResponse)
    async def enrich_flowstate(req: FlowstateEnrichmentRequest) -> FlowstateEnrichmentResponse:
        """
        Enrich flowstate code analysis with lexicon extraction and autonomy tags.

        Takes code + metrics from IDE flowstate panel, returns enriched entries
        suitable for autonomous system integration.
        """
        try:
            entries, determinism_hash = enrich_flowstate_code(
                code=req.code,
                metrics=req.metrics,
                language=req.language,
                topN=req.topN,
            )

            return FlowstateEnrichmentResponse(
                ok=True,
                sessionId=req.sessionId,
                metrics=req.metrics,
                entries=entries,
                determinism_hash=determinism_hash,
            )

        except Exception as e:
            return FlowstateEnrichmentResponse(
                ok=False,
                sessionId=req.sessionId,
                error=str(e),
            )

    return app
