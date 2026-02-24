"""Deterministic stable ID generation."""

from __future__ import annotations
import hashlib


def stable_id(*parts: str, prefix: str = "id") -> str:
    """
    Deterministic stable ID from canonical parts.
    Uses SHA256 hash for determinism across runs.
    """
    raw = "\u241f".join(parts).encode("utf-8")  # unit separator-like
    h = hashlib.sha256(raw).hexdigest()[:24]
    return f"{prefix}_{h}"


def content_hash(canonical_json: str) -> str:
    """Deterministic hash of JSON content."""
    return hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()
