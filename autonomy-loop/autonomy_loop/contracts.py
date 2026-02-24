"""Load and access JSON schema contracts."""

from __future__ import annotations
import json
from pathlib import Path


CONTRACTS_DIR = Path(__file__).resolve().parent.parent / "contracts" / "v1"


def load_schema(name: str) -> dict:
    """Load a JSON schema by name (e.g., 'EvidencePacket')."""
    p = CONTRACTS_DIR / f"{name}.schema.json"
    return json.loads(p.read_text(encoding="utf-8"))
