"""Digital Twin Cortex deterministic mesh export."""

# pyright: reportUnknownVariableType=false, reportUnknownMemberType=false, reportUnknownArgumentType=false

from __future__ import annotations

import math
import struct
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from .artifacts import canonical_json_bytes, sha256_bytes

try:
    import numpy as np
except ImportError:
    np = None

try:
    from skimage.measure import marching_cubes as _sk_marching_cubes  # type: ignore
except Exception:
    _sk_marching_cubes = None


def _seed_u64_from_hash(h: str) -> int:
    hx = h.split(":")[-1]
    return int(hx[:16], 16) & 0xFFFFFFFFFFFFFFFF


@dataclass
class DetRng:
    state: int

    def next_u64(self) -> int:
        self.state = (self.state + 0x9E3779B97F4A7C15) & 0xFFFFFFFFFFFFFFFF
        z = self.state
        z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9 & 0xFFFFFFFFFFFFFFFF
        z = (z ^ (z >> 27)) * 0x94D049BB133111EB & 0xFFFFFFFFFFFFFFFF
        return z ^ (z >> 31)

    def rand_float(self) -> float:
        return (self.next_u64() >> 11) * (1.0 / (1 << 53))


def _rng_from_seed(seed_hex: str) -> DetRng:
    return DetRng(_seed_u64_from_hash(seed_hex))


def _qf(x: float, nd: int = 6) -> float:
    y = round(float(x), nd)
    return 0.0 if y == -0.0 else y


def _canon_mesh(
    vertices: Any,
    faces: Any,
    *,
    nd: int = 6,
) -> Tuple[List[Tuple[float, float, float]], List[Tuple[int, int, int]]]:
    if np is None:
        raise ImportError("numpy required")
    if vertices.size == 0 or faces.size == 0:
        return [], []

    vq: Any = np.round(vertices.astype(np.float64), nd)
    row_count = int(vq.shape[0])
    keys: List[Tuple[float, float, float]] = [
        (float(vq[i, 0]), float(vq[i, 1]), float(vq[i, 2])) for i in range(row_count)
    ]
    uniq_map: Dict[Tuple[float, float, float], int] = {}
    for key in keys:
        if key not in uniq_map:
            uniq_map[key] = 0

    sorted_keys = sorted(uniq_map.keys())
    for i, key in enumerate(sorted_keys):
        uniq_map[key] = i

    old_to_new: Any = np.empty((row_count,), dtype=np.int64)
    for i, key in enumerate(keys):
        old_to_new[i] = uniq_map[key]

    f2: Any = old_to_new[faces.astype(np.int64)]
    keep: List[Tuple[int, int, int]] = []
    for a, b, c in f2.tolist():
        if a != b and b != c and a != c:
            keep.append((int(a), int(b), int(c)))

    keep.sort()
    verts_out = [(key[0], key[1], key[2]) for key in sorted_keys]
    return verts_out, keep


def _voxel_surface_tris(
    vol: Any,
    threshold: float,
    *,
    spacing: Tuple[float, float, float] = (1.0, 1.0, 1.0),
    origin: Tuple[float, float, float] = (0.0, 0.0, 0.0),
) -> Tuple[Any, Any]:
    if np is None:
        raise ImportError("numpy required")

    vol = vol.astype(np.float32, copy=False)
    inside = vol >= float(threshold)

    nx, ny, nz = map(int, inside.shape)
    vmap: Dict[Tuple[int, int, int], int] = {}
    verts: List[Tuple[float, float, float]] = []
    tris: List[Tuple[int, int, int]] = []

    def vid(ix: int, iy: int, iz: int) -> int:
        key = (ix, iy, iz)
        idx = vmap.get(key)
        if idx is not None:
            return idx
        x = origin[0] + spacing[0] * ix
        y = origin[1] + spacing[1] * iy
        z = origin[2] + spacing[2] * iz
        idx = len(verts)
        vmap[key] = idx
        verts.append((x, y, z))
        return idx

    for x in range(nx):
        for y in range(ny):
            for z in range(nz):
                if not inside[x, y, z]:
                    continue

                if x == 0 or not inside[x - 1, y, z]:
                    a = vid(x, y, z)
                    b = vid(x, y + 1, z)
                    c = vid(x, y + 1, z + 1)
                    d = vid(x, y, z + 1)
                    tris.append((a, b, c))
                    tris.append((a, c, d))

                if x == nx - 1 or not inside[x + 1, y, z]:
                    a = vid(x + 1, y, z)
                    b = vid(x + 1, y, z + 1)
                    c = vid(x + 1, y + 1, z + 1)
                    d = vid(x + 1, y + 1, z)
                    tris.append((a, b, c))
                    tris.append((a, c, d))

                if y == 0 or not inside[x, y - 1, z]:
                    a = vid(x, y, z)
                    b = vid(x, y, z + 1)
                    c = vid(x + 1, y, z + 1)
                    d = vid(x + 1, y, z)
                    tris.append((a, b, c))
                    tris.append((a, c, d))

                if y == ny - 1 or not inside[x, y + 1, z]:
                    a = vid(x, y + 1, z)
                    b = vid(x + 1, y + 1, z)
                    c = vid(x + 1, y + 1, z + 1)
                    d = vid(x, y + 1, z + 1)
                    tris.append((a, b, c))
                    tris.append((a, c, d))

                if z == 0 or not inside[x, y, z - 1]:
                    a = vid(x, y, z)
                    b = vid(x + 1, y, z)
                    c = vid(x + 1, y + 1, z)
                    d = vid(x, y + 1, z)
                    tris.append((a, b, c))
                    tris.append((a, c, d))

                if z == nz - 1 or not inside[x, y, z + 1]:
                    a = vid(x, y, z + 1)
                    b = vid(x, y + 1, z + 1)
                    c = vid(x + 1, y + 1, z + 1)
                    d = vid(x + 1, y, z + 1)
                    tris.append((a, b, c))
                    tris.append((a, c, d))

    verts_arr = np.array(verts, dtype=np.float64)
    faces_arr = np.array(tris, dtype=np.int64)
    return verts_arr, faces_arr


def _laplacian_smooth(
    verts: List[Tuple[float, float, float]],
    tris: List[Tuple[int, int, int]],
    *,
    iterations: int = 5,
    lam: float = 0.5,
) -> List[Tuple[float, float, float]]:
    if iterations <= 0 or not verts or not tris:
        return verts

    n = len(verts)
    adj: List[List[int]] = [[] for _ in range(n)]
    for a, b, c in tris:
        adj[a].append(b)
        adj[a].append(c)
        adj[b].append(a)
        adj[b].append(c)
        adj[c].append(a)
        adj[c].append(b)

    for i in range(n):
        if adj[i]:
            adj[i] = sorted(set(adj[i]))

    cur = [(float(x), float(y), float(z)) for (x, y, z) in verts]
    for _ in range(iterations):
        nxt: List[Tuple[float, float, float]] = []
        for i in range(n):
            nb = adj[i]
            if not nb:
                nxt.append(cur[i])
                continue
            sx = sy = sz = 0.0
            for j in nb:
                sx += cur[j][0]
                sy += cur[j][1]
                sz += cur[j][2]
            inv = 1.0 / float(len(nb))
            cx = sx * inv
            cy = sy * inv
            cz = sz * inv
            x, y, z = cur[i]
            nxt.append((x + lam * (cx - x), y + lam * (cy - y), z + lam * (cz - z)))
        cur = nxt

    return [(_qf(x), _qf(y), _qf(z)) for (x, y, z) in cur]


def _cluster_decimate(
    verts: List[Tuple[float, float, float]],
    tris: List[Tuple[int, int, int]],
    factor: float,
) -> Tuple[List[Tuple[float, float, float]], List[Tuple[int, int, int]]]:
    if factor >= 1.0 or not verts or not tris:
        return verts, tris
    factor = max(0.05, min(1.0, float(factor)))

    xs = [v[0] for v in verts]
    ys = [v[1] for v in verts]
    zs = [v[2] for v in verts]
    minx, maxx = min(xs), max(xs)
    miny, maxy = min(ys), max(ys)
    minz, maxz = min(zs), max(zs)

    target = max(8, int(len(verts) * factor))
    dx = maxx - minx
    dy = maxy - miny
    dz = maxz - minz
    vol = max(dx * dy * dz, 1e-9)
    cell = (vol / float(target)) ** (1.0 / 3.0)
    if cell <= 0.0 or not math.isfinite(cell):
        cell = 1.0

    buckets: Dict[Tuple[int, int, int], List[int]] = {}
    for i, (x, y, z) in enumerate(verts):
        bx = int(math.floor((x - minx) / cell))
        by = int(math.floor((y - miny) / cell))
        bz = int(math.floor((z - minz) / cell))
        key = (bx, by, bz)
        buckets.setdefault(key, []).append(i)

    keys = sorted(buckets.keys())
    new_verts: List[Tuple[float, float, float]] = []
    old_to_new = [-1] * len(verts)

    for key in keys:
        idxs = buckets[key]
        idxs.sort()
        sx = sy = sz = 0.0
        for i in idxs:
            sx += verts[i][0]
            sy += verts[i][1]
            sz += verts[i][2]
        inv = 1.0 / float(len(idxs))
        vx = _qf(sx * inv)
        vy = _qf(sy * inv)
        vz = _qf(sz * inv)
        ni = len(new_verts)
        new_verts.append((vx, vy, vz))
        for i in idxs:
            old_to_new[i] = ni

    new_tris: List[Tuple[int, int, int]] = []
    for a, b, c in tris:
        na = old_to_new[a]
        nb = old_to_new[b]
        nc = old_to_new[c]
        if na == nb or nb == nc or na == nc:
            continue
        new_tris.append((na, nb, nc))

    new_tris.sort()
    return new_verts, new_tris


def _obj_bytes(
    verts: List[Tuple[float, float, float]],
    tris: List[Tuple[int, int, int]],
) -> bytes:
    lines: List[str] = []
    lines.append("# Digital Twin Cortex - Mesh Export\n")
    lines.append(f"# Vertices: {len(verts)}\n")
    lines.append(f"# Triangles: {len(tris)}\n\n")
    for x, y, z in verts:
        lines.append(f"v {x:.6f} {y:.6f} {z:.6f}\n")
    lines.append("\n")
    for a, b, c in tris:
        lines.append(f"f {a + 1} {b + 1} {c + 1}\n")
    return "".join(lines).encode("utf-8")


def _ply_bytes(
    verts: List[Tuple[float, float, float]],
    tris: List[Tuple[int, int, int]],
) -> bytes:
    lines: List[str] = []
    lines.append("ply\n")
    lines.append("format ascii 1.0\n")
    lines.append("comment Digital Twin Cortex - Mesh Export\n")
    lines.append(f"element vertex {len(verts)}\n")
    lines.append("property float x\nproperty float y\nproperty float z\n")
    lines.append(f"element face {len(tris)}\n")
    lines.append("property list uchar int vertex_indices\n")
    lines.append("end_header\n")
    for x, y, z in verts:
        lines.append(f"{x:.6f} {y:.6f} {z:.6f}\n")
    for a, b, c in tris:
        lines.append(f"3 {a} {b} {c}\n")
    return "".join(lines).encode("utf-8")


def _stl_bytes(
    verts: List[Tuple[float, float, float]],
    tris: List[Tuple[int, int, int]],
) -> bytes:
    header = b"Digital Twin Cortex Mesh Export".ljust(80, b"\x00")
    out = bytearray()
    out += header
    out += struct.pack("<I", len(tris))

    for a, b, c in tris:
        p0 = verts[a]
        p1 = verts[b]
        p2 = verts[c]
        v01 = (p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2])
        v02 = (p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2])

        nx = v01[1] * v02[2] - v01[2] * v02[1]
        ny = v01[2] * v02[0] - v01[0] * v02[2]
        nz = v01[0] * v02[1] - v01[1] * v02[0]

        length = (nx * nx + ny * ny + nz * nz) ** 0.5
        if length > 1e-12:
            nx, ny, nz = nx / length, ny / length, nz / length
        else:
            nx = ny = nz = 0.0

        out += struct.pack("<fff", float(nx), float(ny), float(nz))
        out += struct.pack("<fff", float(p0[0]), float(p0[1]), float(p0[2]))
        out += struct.pack("<fff", float(p1[0]), float(p1[1]), float(p1[2]))
        out += struct.pack("<fff", float(p2[0]), float(p2[1]), float(p2[2]))
        out += struct.pack("<H", 0)

    return bytes(out)


async def export_mesh(args: Dict[str, Any]) -> Dict[str, Any]:
    if np is None:
        raise ImportError("numpy required for mesh export. Install: pip install numpy")

    case_id = str(args["case_id"])
    labels_ref = dict(args["labels_ref"])
    labels_hash = str(labels_ref.get("hash", "sha256:0" * 8))

    target_organ = str(args.get("target_organ", "all"))
    fmt = str(args.get("format", "obj")).lower()
    threshold = float(args.get("threshold", 0.5))
    smooth = bool(args.get("smooth", False))
    smooth_iters = int(args.get("smooth_iterations", 5))
    smooth_lam = float(args.get("smooth_lambda", 0.5))
    decimate_factor = float(args.get("decimate_factor", 1.0))

    if fmt not in ("obj", "stl", "ply"):
        raise ValueError(f"Unsupported format: {fmt}. Use obj, stl, or ply")

    out_dir = Path(args.get("output_dir") or (Path("runtime") / "meshes" / case_id))
    out_dir.mkdir(parents=True, exist_ok=True)

    label_map = {
        1: "heart",
        2: "lungs",
        3: "liver",
        4: "kidneys",
        5: "brain",
    }
    organs = (
        [target_organ]
        if target_organ != "all"
        else [label_map[k] for k in sorted(label_map.keys())]
    )

    mesh_files: List[Dict[str, Any]] = []
    total_verts = 0
    total_tris = 0

    for organ in organs:
        if organ not in label_map.values():
            continue

        dims = args.get("dims", [64, 64, 64])
        nx, ny, nz = int(dims[0]), int(dims[1]), int(dims[2])

        seed_material = sha256_bytes(
            canonical_json_bytes(
                {
                    "labels_hash": labels_hash,
                    "organ": organ,
                    "threshold": threshold,
                    "dims": [nx, ny, nz],
                }
            )
        )
        rng = _rng_from_seed(seed_material)

        vol = np.empty((nx, ny, nz), dtype=np.float32)
        for x in range(nx):
            for y in range(ny):
                for z in range(nz):
                    vol[x, y, z] = 1.0 if (rng.rand_float() > 0.70) else 0.0

        verts_arr: Any
        faces_arr: Any
        if _sk_marching_cubes is not None:
            verts_arr, faces_arr, _normals, _values = _sk_marching_cubes(
                np.transpose(vol, (2, 1, 0)), level=threshold
            )
            verts_arr = verts_arr[:, [2, 1, 0]]
        else:
            verts_arr, faces_arr = _voxel_surface_tris(vol, threshold)

        verts, tris = _canon_mesh(verts_arr, faces_arr, nd=6)
        if not verts or not tris:
            continue

        if smooth:
            verts = _laplacian_smooth(
                verts, tris, iterations=smooth_iters, lam=smooth_lam
            )
            verts_arr2 = np.array(verts, dtype=np.float64)
            faces_arr2 = np.array(tris, dtype=np.int64)
            verts, tris = _canon_mesh(verts_arr2, faces_arr2, nd=6)

        if decimate_factor < 1.0:
            verts, tris = _cluster_decimate(verts, tris, decimate_factor)
            verts_arr3 = np.array(verts, dtype=np.float64)
            faces_arr3 = np.array(tris, dtype=np.int64)
            verts, tris = _canon_mesh(verts_arr3, faces_arr3, nd=6)

        if not verts or not tris:
            continue

        if fmt == "obj":
            blob = _obj_bytes(verts, tris)
        elif fmt == "ply":
            blob = _ply_bytes(verts, tris)
        else:
            blob = _stl_bytes(verts, tris)

        meta: Dict[str, Any] = {
            "artifact": "mesh.export",
            "case_id": case_id,
            "labels_hash": labels_hash,
            "organ": organ,
            "format": fmt,
            "threshold": threshold,
            "smooth": smooth,
            "smooth_iterations": smooth_iters,
            "smooth_lambda": smooth_lam,
            "decimate_factor": decimate_factor,
            "generator": "skimage.marching_cubes"
            if _sk_marching_cubes is not None
            else "voxel_surface",
            "vertices": len(verts),
            "triangles": len(tris),
        }
        mesh_hash = sha256_bytes(
            canonical_json_bytes(
                {
                    "meta": meta,
                    "bytes_sha256": sha256_bytes(blob),
                }
            )
        )

        filename = f"{organ}.{fmt}"
        filepath = out_dir / filename
        filepath.write_bytes(blob)

        mesh_files.append(
            {
                "organ": organ,
                "path": str(filepath).replace("\\", "/"),
                "mesh_hash": mesh_hash,
                "vertices": len(verts),
                "triangles": len(tris),
                "meta": meta,
            }
        )
        total_verts += len(verts)
        total_tris += len(tris)

    return {
        "mesh_files": mesh_files,
        "total_vertices": total_verts,
        "total_triangles": total_tris,
        "output_dir": str(out_dir).replace("\\", "/"),
    }


def register_mesh_tools(store: Optional[Any] = None) -> Dict[str, Any]:
    _ = store
    return {"digital_twin.export_mesh": export_mesh}
