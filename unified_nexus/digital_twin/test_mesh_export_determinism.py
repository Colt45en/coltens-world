from __future__ import annotations

import asyncio
from pathlib import Path

from .mesh_export import export_mesh


def test_export_mesh_is_deterministic(tmp_path: Path) -> None:
    args = {
        "case_id": "case_det_001",
        "labels_ref": {"hash": "sha256:9f" + "0" * 62},
        "target_organ": "heart",
        "format": "obj",
        "threshold": 0.5,
        "smooth": True,
        "smooth_iterations": 3,
        "smooth_lambda": 0.4,
        "decimate_factor": 0.8,
        "dims": [24, 24, 24],
        "output_dir": str(tmp_path / "meshes"),
    }

    first = asyncio.run(export_mesh(args))
    second = asyncio.run(export_mesh(args))

    assert len(first["mesh_files"]) > 0
    assert len(second["mesh_files"]) > 0

    first_mesh = first["mesh_files"][0]
    second_mesh = second["mesh_files"][0]

    assert first_mesh["organ"] == second_mesh["organ"]
    assert first_mesh["mesh_hash"] == second_mesh["mesh_hash"]
    assert first_mesh["vertices"] == second_mesh["vertices"]
    assert first_mesh["triangles"] == second_mesh["triangles"]

    p1 = Path(first_mesh["path"])
    p2 = Path(second_mesh["path"])
    assert p1.read_bytes() == p2.read_bytes()
