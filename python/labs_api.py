#!/usr/bin/env python3
"""
World Engine Labs API — FastAPI service wrapper.

Exposes lab generation as HTTP endpoints with deterministic hashing + manifests.

Usage (local dev):
    cd "coltens world/python"
    pip install -r requirements.txt
    uvicorn labs_api:app --reload --port 8787

Usage (from Nucleus/AgentHub tool_call):
    agent_py.labs.list → GET http://localhost:8787/labs/list
    agent_py.labs.generate → POST http://localhost:8787/labs/generate

Environment:
    LABS_OUTPUT_DIR (default: "labs")
    LABS_HOST (default: "127.0.0.1")
    LABS_PORT (default: 8787)
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

# Import your existing lab generator
# Adjust import path if it's in a different location
try:
    from lab_generator import LabGenerator
except ImportError:
    # Fallback: assume it's in cwd
    sys.path.insert(0, str(Path(__file__).parent))
    from lab_generator import LabGenerator

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)


def sha256_file(p: Path) -> Tuple[str, int]:
    """Compute SHA256 hash + size of a file."""
    h = hashlib.sha256()
    total = 0
    with p.open("rb") as f:
        while True:
            b = f.read(1024 * 1024)  # 1MB chunks
            if not b:
                break
            total += len(b)
            h.update(b)
    return h.hexdigest(), total


# ============================================================================
# Request/Response Models (match TS contracts)
# ============================================================================


class LabsGenerateRequest(BaseModel):
    """Request to generate lab(s). All fields optional."""
    lab_id: Optional[str] = Field(
        default=None,
        description="If omitted, generate all labs"
    )
    output_dir: str = Field(
        default="labs",
        min_length=1,
        description="Output directory for generated labs"
    )
    write_manifest: bool = Field(
        default=True,
        description="Write manifest.json per lab"
    )


class FileHash(BaseModel):
    """File hash + metadata."""
    path: str
    sha256: str
    bytes: int


class GeneratedLab(BaseModel):
    """One generated lab with files + hashes."""
    lab_id: str
    dir: str
    files: List[FileHash]


class LabsGenerateResponse(BaseModel):
    """Response from generation."""
    ok: bool
    generated: List[GeneratedLab]
    catalog_path: str


class LabsListResponse(BaseModel):
    """List of available labs."""
    labs: List[str]


# ============================================================================
# FastAPI App
# ============================================================================


app = FastAPI(
    title="World Engine Labs API",
    version="1.0.0",
    description="Deterministic lab generation with SHA256 hashing + manifests"
)


@app.get("/labs/list", response_model=LabsListResponse)
def list_labs() -> LabsListResponse:
    """
    List all available labs.

    Returns:
        LabsListResponse with lab IDs.
    """
    try:
        gen = LabGenerator()
        return LabsListResponse(labs=list(gen.labs.keys()))
    except Exception as e:
        logger.error(f"Failed to list labs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/labs/generate", response_model=LabsGenerateResponse)
def generate(req: LabsGenerateRequest) -> LabsGenerateResponse:
    """
    Generate one or all labs with deterministic output.

    Args:
        req: LabsGenerateRequest with optional lab_id + output_dir.

    Returns:
        LabsGenerateResponse with generated labs, file hashes, and catalog path.

    Raises:
        HTTPException: if lab_id unknown or generation fails.
    """
    try:
        gen = LabGenerator()

        # Normalize output directory
        out_root = Path(req.output_dir).resolve()
        out_root.mkdir(parents=True, exist_ok=True)
        logger.info(f"Labs output directory: {out_root}")

        # Determine which labs to generate
        lab_ids = [req.lab_id] if req.lab_id else list(gen.labs.keys())

        generated: List[GeneratedLab] = []
        catalog: Dict[str, Dict[str, str]] = {}
        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

        # Generate each lab
        for lab_id in lab_ids:
            if lab_id not in gen.labs:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unknown lab_id: {lab_id}. Available: {list(gen.labs.keys())}"
                )

            logger.info(f"Generating lab: {lab_id}")
            payload = gen.generate_lab(lab_id)

            # Create lab folder
            lab_dir = out_root / lab_id
            lab_dir.mkdir(parents=True, exist_ok=True)

            # Write files
            starter = lab_dir / f"{lab_id}_starter.py"
            test = lab_dir / f"{lab_id}_test.py"
            readme = lab_dir / f"{lab_id}_README.md"

            starter.write_text(payload["main_code"], encoding="utf-8")
            test.write_text(payload["test_code"], encoding="utf-8")
            readme.write_text(payload["readme"], encoding="utf-8")

            # Compute hashes
            files = []
            for fp in [starter, test, readme]:
                sh, sz = sha256_file(fp)
                files.append(FileHash(path=fp.name, sha256=sh, bytes=sz))
                logger.debug(f"  {fp.name}: {sh[:16]}... ({sz} bytes)")

            # Write manifest per lab
            if req.write_manifest:
                manifest = {
                    "lab_id": lab_id,
                    "generated_at_utc": now,
                    "files": [
                        {
                            "path": f.path,
                            "sha256": f.sha256,
                            "bytes": f.bytes
                        }
                        for f in files
                    ]
                }
                manifest_path = lab_dir / "manifest.json"
                manifest_path.write_text(
                    json.dumps(manifest, indent=2),
                    encoding="utf-8"
                )
                logger.debug(f"  manifest.json written")

            # Record in response + catalog
            generated.append(
                GeneratedLab(lab_id=lab_id, dir=str(lab_dir), files=files)
            )
            catalog[lab_id] = {
                "dir": str(lab_dir),
                "readme": str(readme),
                "starter": str(starter),
                "test": str(test),
                "manifest": str(lab_dir / "manifest.json") if req.write_manifest else ""
            }

        # Write global catalog
        catalog_path = out_root / "_catalog.json"
        catalog_data = {
            "generated_at_utc": now,
            "lab_count": len(generated),
            "labs": catalog
        }
        catalog_path.write_text(
            json.dumps(catalog_data, indent=2),
            encoding="utf-8"
        )
        logger.info(f"Catalog written: {catalog_path}")

        return LabsGenerateResponse(
            ok=True,
            generated=generated,
            catalog_path=str(catalog_path)
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
def health() -> Dict[str, str]:
    """Health check."""
    return {"status": "ok"}


# ============================================================================
# Local dev entry point
# ============================================================================

if __name__ == "__main__":
    import uvicorn

    host = os.getenv("LABS_HOST", "127.0.0.1")
    port = int(os.getenv("LABS_PORT", "8787"))

    logger.info(f"Starting Labs API on {host}:{port}")
    uvicorn.run(app, host=host, port=port)
