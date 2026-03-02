"""Detective: Extract tokens and meaning claims from raw input."""

from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from .ids import stable_id
from .tokenize import extract_words, extract_code_symbols, stable_sorted


@dataclass(frozen=True)
class ExtractConfig:
    kind: str  # "text" | "code" | "mixed"
    language_hint: str | None = None


def build_evidence_packet(
    raw_text: str, source_id: str, cfg: ExtractConfig
) -> dict[str, Any]:
    """
    Detective output: EvidencePacket with tokens, raw claims, unknowns.
    All hashes and IDs are deterministic.
    """
    now = datetime.now(timezone.utc).isoformat()

    # Extract tokens
    words = extract_words(raw_text) if cfg.kind in ("text", "mixed") else []
    symbols = extract_code_symbols(raw_text) if cfg.kind in ("code", "mixed") else []

    # Deterministic ordering for reproducibility
    words_s = stable_sorted([w.strip() for w in words if w.strip()])
    syms_s = stable_sorted([s.strip() for s in symbols if s.strip()])

    batch_id = stable_id("batch", source_id, cfg.kind, raw_text, prefix="batch")

    # Meaning is CLAIMS, not asserted facts (key insight!)
    meaning_claims = []
    for w in stable_sorted(set(words_s)):
        meaning_claims.append(
            {
                "claim_id": stable_id("meaning", w.lower(), prefix="claim"),
                "term": w,
                "claim": f"Meaning unknown yet for '{w}' (placeholder claim must be reviewed).",
                "confidence": 0.15,
                "falsification_tests": [
                    "Check dictionary definition and etymology references.",
                    "Check usage examples in authoritative corpora.",
                ],
                "evidence_links": [],
                "review_required": True,
            }
        )

    return {
        "schema_version": "1.0.0",
        "batch_id": batch_id,
        "created_at": now,
        "source": {
            "source_id": source_id,
            "kind": cfg.kind,
            "language_hint": cfg.language_hint,
        },
        "raw": {
            "text": raw_text,
            "sha_note": "raw text included for traceability (can be removed via retention policy)",
        },
        "tokens": {
            "words": words_s,
            "code_symbols": syms_s,
        },
        "claims": {
            "meaning_claims": meaning_claims,
            "unknowns": [],
        },
        "objective": {
            "metrics": [
                "coverage",
                "precision",
                "latency_ms",
                "dedupe_collision_rate",
                "confidence_mean",
            ],
            "constraints": [
                "schema_valid",
                "deterministic",
                "traceable",
                "no_placeholder_leaks",
            ],
            "acceptance_tests": [
                {"gate": "schema", "threshold": "pass"},
                {"gate": "determinism", "threshold": "pass"},
                {"gate": "traceability", "threshold": "pass"},
                {
                    "gate": "confidence",
                    "threshold": "mean>=0.30 OR review_queue_populated",
                },
            ],
        },
    }
