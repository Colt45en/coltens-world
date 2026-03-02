"""
BRAIN ARCHITECTURE: Digital Twin Cortex → HIPPOCAMPUS (Memory)

Deterministic artifact storage with hash-stable provenance.

Storage layout:
    runtime/artifacts/<case_id>/<artifact_type>/<hash>.<ext>

Examples:
    runtime/artifacts/case_001/case.volume/sha256:abc123.json
    runtime/artifacts/case_001/labels.anatomy/sha256:def456.json
    runtime/artifacts/case_001/vascular.graph/sha256:789abc.json
    runtime/artifacts/case_001/render.frame.svg/sha256:111222.svg

Invariants:
- Same content → same hash → same path (deduplication)
- Immutable: once written, never modified
- Provenance: every artifact traces to source hashes
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict


def canonical_json_bytes(obj: Any) -> bytes:
    """Deterministic JSON serialization: stable key order, no whitespace drift."""
    s = json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return s.encode("utf-8")


def sha256_bytes(b: bytes) -> str:
    """Compute SHA-256 hash with 'sha256:' prefix."""
    return "sha256:" + hashlib.sha256(b).hexdigest()


@dataclass(frozen=True)
class ArtifactRef:
    """Reference to a stored artifact."""

    artifact: str  # Artifact type (e.g., "case.volume", "vascular.graph")
    hash: str  # Content hash (sha256:...)
    path: str  # Relative path from artifacts root


class ArtifactStore:
    """
    Deterministic artifact storage for Digital Twin Cortex.

    Storage structure: runtime/artifacts/<case_id>/<artifact>/<hash>.<ext>
    """

    def __init__(self, root: str = "runtime/artifacts") -> None:
        self.root = Path(root)

    def put_json(self, case_id: str, artifact: str, obj: Dict[str, Any]) -> ArtifactRef:
        """
        Store JSON artifact with deterministic serialization.

        Args:
            case_id: Case identifier
            artifact: Artifact type (e.g., "case.volume")
            obj: JSON-serializable object

        Returns:
            ArtifactRef with hash and path
        """
        b = canonical_json_bytes(obj)
        h = sha256_bytes(b)
        rel = Path(case_id) / artifact / f"{h}.json"
        p = self.root / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(b)
        return ArtifactRef(artifact=artifact, hash=h, path=str(rel).replace("\\", "/"))

    def put_text(
        self, case_id: str, artifact: str, text: str, ext: str = "txt"
    ) -> ArtifactRef:
        """
        Store text artifact (SVG, CSV, etc.).

        Args:
            case_id: Case identifier
            artifact: Artifact type
            text: Text content
            ext: File extension

        Returns:
            ArtifactRef with hash and path
        """
        b = text.encode("utf-8")
        h = sha256_bytes(b)
        rel = Path(case_id) / artifact / f"{h}.{ext}"
        p = self.root / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(b)
        return ArtifactRef(artifact=artifact, hash=h, path=str(rel).replace("\\", "/"))

    def put_bytes(
        self, case_id: str, artifact: str, data: bytes, ext: str = "bin"
    ) -> ArtifactRef:
        """
        Store binary artifact (PNG, ZIP, etc.).

        Args:
            case_id: Case identifier
            artifact: Artifact type
            data: Binary content
            ext: File extension

        Returns:
            ArtifactRef with hash and path
        """
        h = sha256_bytes(data)
        rel = Path(case_id) / artifact / f"{h}.{ext}"
        p = self.root / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)
        return ArtifactRef(artifact=artifact, hash=h, path=str(rel).replace("\\", "/"))

    def read_json(self, ref: ArtifactRef) -> Dict[str, Any]:
        """Read JSON artifact by reference."""
        p = self.root / Path(ref.path)
        return json.loads(p.read_text("utf-8"))

    def read_text(self, ref: ArtifactRef) -> str:
        """Read text artifact by reference."""
        p = self.root / Path(ref.path)
        return p.read_text("utf-8")

    def read_bytes(self, ref: ArtifactRef) -> bytes:
        """Read binary artifact by reference."""
        p = self.root / Path(ref.path)
        return p.read_bytes()

    def exists(self, ref: ArtifactRef) -> bool:
        """Check if artifact exists."""
        p = self.root / Path(ref.path)
        return p.exists()
