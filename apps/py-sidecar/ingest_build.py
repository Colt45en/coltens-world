from __future__ import annotations

import json
import hashlib
from dataclasses import dataclass
from typing import Any, Dict, List


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def canonical_json(obj: Any) -> bytes:
    # stable keys, stable separators
    return json.dumps(
        obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False
    ).encode("utf-8")


@dataclass(frozen=True)
class EvidenceClaim:
    claim_type: str
    value: Any
    confidence: float
    source: str
    details: Dict[str, Any]


def build_claims(build_evidence: Dict[str, Any]) -> List[EvidenceClaim]:
    compiler = build_evidence.get("compiler")
    status = build_evidence.get("status")
    bundle_hash = build_evidence.get("bundle_hash")
    typecheck = build_evidence.get("typecheck", {})
    module_graph = build_evidence.get("module_graph", {})

    claims: List[EvidenceClaim] = []

    claims.append(
        EvidenceClaim(
            claim_type="build.compiler",
            value=compiler,
            confidence=1.0,
            source="compiler_evidence",
            details={},
        )
    )

    claims.append(
        EvidenceClaim(
            claim_type="build.status",
            value=status,
            confidence=1.0,
            source="compiler_evidence",
            details={},
        )
    )

    claims.append(
        EvidenceClaim(
            claim_type="build.bundle_hash",
            value=bundle_hash,
            confidence=1.0,
            source="compiler_evidence",
            details={},
        )
    )

    claims.append(
        EvidenceClaim(
            claim_type="build.typecheck.passed",
            value=bool(typecheck.get("passed", False)),
            confidence=1.0,
            source="compiler_evidence",
            details={"errors": typecheck.get("errors", [])},
        )
    )

    claims.append(
        EvidenceClaim(
            claim_type="build.module_graph.summary",
            value={
                "kind": module_graph.get("kind", "none"),
                "nodes": int(module_graph.get("nodes", 0)),
                "edges": int(module_graph.get("edges", 0)),
                "entrypoints": module_graph.get("entrypoints", []),
            },
            confidence=1.0 if module_graph.get("kind") != "none" else 0.6,
            source="compiler_evidence",
            details={},
        )
    )

    # Strong claim: outputs list is canonical + hashable
    outputs = build_evidence.get("outputs", [])
    claims.append(
        EvidenceClaim(
            claim_type="build.outputs.index",
            value={
                "count": len(outputs),
                "sha256": sha256_hex(canonical_json(outputs)),
            },
            confidence=1.0,
            source="compiler_evidence",
            details={"first10": outputs[:10]},
        )
    )

    determinism = build_evidence.get("determinism", {})
    if determinism.get("ranTwice"):
        claims.append(
            EvidenceClaim(
                claim_type="build.determinism.hashStable",
                value=bool(determinism.get("hashStable", False)),
                confidence=1.0,
                source="compiler_evidence",
                details={
                    "first_hash": determinism.get("first_hash"),
                    "second_hash": determinism.get("second_hash"),
                },
            )
        )

    return claims


def to_evidence_packet(build_evidence: Dict[str, Any]) -> Dict[str, Any]:
    """
    Output shape is generic; align this to your lexicon DB insert format.
    """
    claims = build_claims(build_evidence)

    packet = {
        "schemaVersion": "1.0.0",
        "kind": "BuildEvidenceClaims",
        "id": build_evidence.get("id"),
        "ts": build_evidence.get("ts"),
        "source": {
            "compiler": build_evidence.get("compiler"),
            "buildRoot": build_evidence.get("buildRoot"),
            "outDir": build_evidence.get("outDir"),
        },
        "claims": [
            {
                "type": c.claim_type,
                "value": c.value,
                "confidence": c.confidence,
                "source": c.source,
                "details": c.details,
            }
            for c in claims
        ],
        "hash": sha256_hex(
            canonical_json(
                {
                    "id": build_evidence.get("id"),
                    "bundle_hash": build_evidence.get("bundle_hash"),
                    "claims": [c.claim_type for c in claims],
                }
            )
        ),
    }

    return packet


def main(in_path: str, out_path: str) -> None:
    with open(in_path, "r", encoding="utf-8") as f:
        build_evidence = json.load(f)

    packet = to_evidence_packet(build_evidence)

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(packet, f, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")


if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="in_path", required=True)
    ap.add_argument("--out", dest="out_path", required=True)
    args = ap.parse_args()
    main(args.in_path, args.out_path)
