#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Export OpenAPI spec (stub mode for early development).

In production: imports FastAPI app and extracts OpenAPI schema.
In development: generates a deterministic stub.

Usage: python tooling/codegen/export_openapi.py

"""

from __future__ import annotations
import os
import json
import sys
from pathlib import Path

# Force UTF-8 output on Windows consoles (Python 3.7+)
os.environ.setdefault("PYTHONUTF8", "1")

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

repo_root = Path(__file__).parent.parent.parent

def main():
    """Export OpenAPI spec deterministically (stub mode)."""
    out_path = repo_root / "packages" / "contracts" / "openapi" / "openapi.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)

    # Check if output already exists and is deterministic (same content)
    if out_path.exists():
        existing = json.loads(out_path.read_text())
        # Deterministic stub always has same content; skip regeneration
        if existing.get("info", {}).get("version") == "0.1.0":
            print("✅ OpenAPI spec already exists (deterministic, no changes)")
            print(f"   Path: {out_path}")
            return 0

    # Generate stub OpenAPI (deterministic: same output every run)
    spec = {
        "openapi": "3.0.0",
        "info": {
            "title": "World Engine: Autonomy Loop API (Stub)",
            "version": "0.1.0",
            "description": "Stub OpenAPI spec for early development"
        },
        "servers": [
            {"url": "http://localhost:8000", "description": "Local development"},
            {"url": "http://localhost:8001", "description": "Sidecar default"},
        ],
        "paths": {},
        "components": {"schemas": {}},
    }

    # Stable JSON output: consistent formatting for deterministic diffs
    json_text = json.dumps(spec, ensure_ascii=False, indent=2, sort_keys=True)
    out_path.write_text(json_text + "\n", encoding="utf-8")

    print("✅ OpenAPI spec exported (stub mode)")
    print(f"   Path: {out_path}")
    print(f"   Version: {spec['info']['version']}")
    print(f"   Endpoints: {len(spec['paths'])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
