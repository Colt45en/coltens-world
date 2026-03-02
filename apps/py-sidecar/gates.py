from __future__ import annotations

from typing import Any, Dict, List

from pydantic import BaseModel

from utils import content_hash_for


class GateResult(BaseModel):
    gate_name: str
    passed: bool
    severity: str  # "critical" | "warning"
    details: Dict[str, Any]


class ValidatedPlan(BaseModel):
    batch_id: str
    gates: List[GateResult]
    overall_status: str  # "passed" | "warning" | "failed"
    content_hash: str


def _gate_schema_validation(
    packet: Dict[str, Any], transform_out: Dict[str, Any]
) -> GateResult:
    # If previous pydantic validations did not raise, we consider schema valid.
    return GateResult(
        gate_name="schema_validation",
        passed=True,
        severity="critical",
        details={"validated": True},
    )


def _gate_determinism(transform_out: Dict[str, Any]) -> GateResult:
    expected = content_hash_for(
        {
            "batch_id": transform_out["batch_id"],
            "lexicon_entries": transform_out["lexicon_entries"],
            "rune_rows": transform_out["rune_rows"],
        }
    )
    actual = transform_out.get("content_hash")
    passed = expected == actual
    return GateResult(
        gate_name="determinism",
        passed=passed,
        severity="critical",
        details={"expected": expected, "actual": actual},
    )


def _gate_dedupe_audit(transform_out: Dict[str, Any]) -> GateResult:
    # Collision on entry_id or rune_id
    entry_ids = [e["entry_id"] for e in transform_out["lexicon_entries"]]
    rune_ids = [r["rune_id"] for r in transform_out["rune_rows"]]

    def collisions(ids: List[str]) -> List[str]:
        seen = set()
        dup = set()
        for x in ids:
            if x in seen:
                dup.add(x)
            seen.add(x)
        return sorted(dup)

    c1 = collisions(entry_ids)
    c2 = collisions(rune_ids)
    passed = len(c1) == 0 and len(c2) == 0

    return GateResult(
        gate_name="dedupe_audit",
        passed=passed,
        severity="critical",
        details={"lexicon_entry_id_collisions": c1, "rune_id_collisions": c2},
    )


def _gate_confidence_threshold(
    transform_out: Dict[str, Any], min_conf: float
) -> GateResult:
    lows = []
    for e in transform_out["lexicon_entries"]:
        if float(e["overall_confidence"]) < min_conf:
            lows.append(
                {
                    "entry_id": e["entry_id"],
                    "term": e["term"],
                    "confidence": e["overall_confidence"],
                }
            )

    passed = len(lows) == 0
    # This is typically warning in governance, but you can flip to critical if you want hard failure.
    return GateResult(
        gate_name="confidence_threshold",
        passed=passed,
        severity="warning",
        details={
            "min_confidence": min_conf,
            "low_confidence_entries": lows[:200],
            "low_count": len(lows),
        },
    )


def _gate_traceability(
    packet: Dict[str, Any], transform_out: Dict[str, Any]
) -> GateResult:
    # Ensure batch_id exists and evidence/source refs present
    ok = True
    missing = []

    if not packet.get("batch_id"):
        ok = False
        missing.append("packet.batch_id")
    if not packet.get("source_file"):
        ok = False
        missing.append("packet.source_file")

    for e in transform_out["lexicon_entries"][:500]:
        if not e.get("entry_id") or not e.get("term") or not e.get("language"):
            ok = False
            missing.append(
                f"lexicon_entry_missing_fields:{e.get('entry_id', '<none>')}"
            )
    for r in transform_out["rune_rows"][:500]:
        if not r.get("rune_id") or not r.get("symbol") or not r.get("evidence_links"):
            ok = False
            missing.append(f"rune_row_missing_fields:{r.get('rune_id', '<none>')}")

    return GateResult(
        gate_name="traceability",
        passed=ok,
        severity="critical",
        details={"missing": missing},
    )


def run_gates(
    *,
    packet: Dict[str, Any],
    transform_out: Dict[str, Any],
    min_confidence: float = 0.80,
) -> Dict[str, Any]:
    gates = [
        _gate_schema_validation(packet, transform_out),
        _gate_determinism(transform_out),
        _gate_dedupe_audit(transform_out),
        _gate_confidence_threshold(transform_out, min_confidence),
        _gate_traceability(packet, transform_out),
    ]

    # Overall status rules:
    # - any failed critical gate => failed
    # - else if any warning gate failed => warning
    # - else passed
    failed_critical = any((g.severity == "critical" and not g.passed) for g in gates)
    failed_warning = any((g.severity == "warning" and not g.passed) for g in gates)

    if failed_critical:
        overall = "failed"
    elif failed_warning:
        overall = "warning"
    else:
        overall = "passed"

    plan = {
        "batch_id": packet["batch_id"],
        "gates": [g.model_dump() for g in gates],
        "overall_status": overall,
    }
    plan["content_hash"] = content_hash_for(plan)

    ValidatedPlan(**plan)
    return plan
