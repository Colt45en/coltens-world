"""Analyst: Run deterministic validation gates."""

from __future__ import annotations
import json
from typing import Any

from .contracts import load_schema
from .ids import content_hash
from jsonschema import Draft202012Validator


def canonical_json(obj: Any) -> str:
    """Canonical JSON for deterministic hashing."""
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def schema_validate(name: str, obj: Any) -> list[str]:
    """Validate object against schema; return error messages."""
    schema = load_schema(name)
    v = Draft202012Validator(schema)
    errors = []
    for e in sorted(v.iter_errors(obj), key=lambda x: x.path):
        errors.append(f"{name}: {list(e.path)}: {e.message}")
    return errors


def determinism_hash(obj: Any) -> str:
    """Deterministic content hash."""
    return content_hash(canonical_json(obj))


def _validate_schemas(evidence: dict[str, Any], lex: list[dict[str, Any]], runes: list[dict[str, Any]]) -> dict[str, Any]:
    """Gate 1: Schema validation."""
    errors: list[str] = []
    errors += schema_validate("EvidencePacket", evidence)
    for item in lex:
        errors += schema_validate("LexiconEntry", item)
    for item in runes:
        errors += schema_validate("RuneDecoderRow", item)

    return {
        "gate": "schema",
        "passed": len(errors) == 0,
        "details": [] if len(errors) == 0 else errors[:50],
    }


def _validate_traceability(evidence: dict[str, Any], lex: list[dict[str, Any]], runes: list[dict[str, Any]]) -> dict[str, Any]:
    """Gate 2: Traceability (batch_id + source_id propagation)."""
    trace_ok = True
    for item in lex + runes:
        t = item.get("trace", {})
        if t.get("batch_id") != evidence.get("batch_id"):
            trace_ok = False
            break
        if not t.get("source_id"):
            trace_ok = False
            break

    return {
        "gate": "traceability",
        "passed": trace_ok,
        "details": [] if trace_ok else ["Missing/invalid trace fields."],
    }


def _compute_determinism_hashes(evidence: dict[str, Any], lex: list[dict[str, Any]], runes: list[dict[str, Any]]) -> tuple[dict[str, Any], dict[str, str]]:
    """Gate 3: Determinism (hashes)."""
    hashes = {
        "evidence_hash": determinism_hash(evidence),
        "lexicon_hash": determinism_hash(lex),
        "runes_hash": determinism_hash(runes),
    }
    gate_result = {
        "gate": "determinism",
        "passed": True,
        "details": [hashes],
    }
    return gate_result, hashes


def _validate_confidence(lex: list[dict[str, Any]], runes: list[dict[str, Any]]) -> dict[str, Any]:
    """Gate 4: Confidence policy (either decent mean or review queue populated)."""
    confidences = []
    review_required_count = 0
    for item in lex:
        for c in item["semantics"]["meaning_claims"]:
            confidences.append(float(c["confidence"]))
            if c.get("review_required"):
                review_required_count += 1
    for item in runes:
        for c in item["meaning"]["meaning_claims"]:
            confidences.append(float(c["confidence"]))
            if c.get("review_required"):
                review_required_count += 1

    mean_conf = sum(confidences) / max(1, len(confidences))
    confidence_ok = (mean_conf >= 0.30) or (review_required_count > 0)

    return {
        "gate": "confidence",
        "passed": confidence_ok,
        "details": [{
            "mean_confidence": round(mean_conf, 4),
            "review_required_count": review_required_count,
            "total_claims": len(confidences),
        }],
    }


def _compute_status(gate_results: list[dict[str, Any]]) -> str:
    """Compute status: hard fail (schema, traceability) or soft warn (confidence)."""
    hard_fail = any(g["gate"] in ("schema", "traceability") and not g["passed"] for g in gate_results)
    soft_warn = any(g["gate"] in ("confidence",) and not g["passed"] for g in gate_results)

    if hard_fail:
        return "red"
    elif soft_warn:
        return "yellow"
    else:
        return "green"


def run_gates(evidence: dict[str, Any],
              lex: list[dict[str, Any]],
              runes: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Analyst: Run all gates. Status is COMPUTED FROM GATES ONLY (no vibes).
    """
    gate_results: list[dict[str, Any]] = []

    # Gate 1: Schema validation
    gate_results.append(_validate_schemas(evidence, lex, runes))

    # Gate 2: Traceability
    gate_results.append(_validate_traceability(evidence, lex, runes))

    # Gate 3: Determinism (hashes)
    determinism_gate, hashes = _compute_determinism_hashes(evidence, lex, runes)
    gate_results.append(determinism_gate)

    # Gate 4: Confidence policy
    gate_results.append(_validate_confidence(lex, runes))

    # Compute status
    status = _compute_status(gate_results)

    return {
        "schema_version": "1.0.0",
        "batch_id": evidence["batch_id"],
        "gates": gate_results,
        "status": status,
        "hashes": hashes,
    }
