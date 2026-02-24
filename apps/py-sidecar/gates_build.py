from __future__ import annotations
from typing import Any, Dict, List, Tuple


def gate_build_integrity(build_evidence: Dict[str, Any]) -> Tuple[bool, List[str]]:
    errors: List[str] = []
    status = build_evidence.get("status")
    outputs = build_evidence.get("outputs", [])
    bundle_hash = build_evidence.get("bundle_hash")

    if status != "passed":
        errors.append(f"build status is not passed: {status}")

    if not isinstance(outputs, list) or len(outputs) == 0:
        errors.append("no outputs were produced")

    if not isinstance(bundle_hash, str) or len(bundle_hash) != 64:
        errors.append("bundle_hash missing or invalid")

    return (len(errors) == 0), errors


def gate_typecheck_ok(build_evidence: Dict[str, Any]) -> Tuple[bool, List[str]]:
    tc = build_evidence.get("typecheck", {})
    ran = bool(tc.get("ran", False))
    passed = bool(tc.get("passed", False))
    errs = tc.get("errors", [])

    if not ran:
        # In your governance, you might force ran==True for critical namespaces.
        return True, []

    if passed:
        return True, []

    return False, [f"typecheck failed: {errs[:3]}"]


def gate_output_hash_stable(build_evidence: Dict[str, Any]) -> Tuple[bool, List[str]]:
    det = build_evidence.get("determinism", {})
    ran = bool(det.get("ranTwice", False))
    stable = bool(det.get("hashStable", False))

    if not ran:
        # If you require determinism proof, flip this to False.
        return True, []

    if stable:
        return True, []

    return False, [
        f"output hash unstable: {det.get('first_hash')} vs {det.get('second_hash')}"
    ]


def run_all_build_gates(build_evidence: Dict[str, Any]) -> Dict[str, Any]:
    results = {}

    ok, errs = gate_build_integrity(build_evidence)
    results["build_integrity"] = {"passed": ok, "errors": errs}

    ok, errs = gate_typecheck_ok(build_evidence)
    results["typecheck_ok"] = {"passed": ok, "errors": errs}

    ok, errs = gate_output_hash_stable(build_evidence)
    results["output_hash_stable"] = {"passed": ok, "errors": errs}

    overall = all(v["passed"] for v in results.values())
    results["overall"] = {
        "passed": overall,
        "errors": [e for v in results.values() for e in v["errors"]],
    }

    return results
