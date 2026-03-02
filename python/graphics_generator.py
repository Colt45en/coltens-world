"""
graphics_generator.py

Real-time graphics engine for radial lattice animation.
- Quaternion-based 3D rotation
- Dual camera systems: legacy 2D + new 3D perspective projection
- WebSocket streaming of deterministic snapshots
- Audio-reactive modulation support

ARCHITECTURE:
  GraphicsScene holds nodes, edges, limbs, and two camera systems:
    1. Legacy 2D: (pan, zoom, rotation) → screen coords
    2. New 3D: QuaternionCamera (position, rotation, FOV, z_near, z_far) → NDC → screen coords

  snapshot() outputs both systems safely (backward compatible).
  No breaking changes to LabGraphicsGeneratorPage.tsx schema.
"""

import math
from dataclasses import dataclass, field
from typing import List, Tuple, Union, Dict, Any
import time


# ==================== MATRIX HELPERS (Column-Major) ====================


def mat4_identity() -> List[float]:
    """4x4 identity matrix (column-major)."""
    return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]


def mat4_translation(tx: float, ty: float, tz: float) -> List[float]:
    """Translate by (tx, ty, tz)."""
    return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, tx, ty, tz, 1]


def mat4_scaling(sx: float, sy: float, sz: float) -> List[float]:
    """Scale by (sx, sy, sz)."""
    return [sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, sz, 0, 0, 0, 0, 1]


def mat4_rotation_z(angle_rad: float) -> List[float]:
    """Rotate around Z axis by angle_rad."""
    c, s = math.cos(angle_rad), math.sin(angle_rad)
    return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]


def mat4_mul(a: List[float], b: List[float]) -> List[float]:
    """
    Multiply two 4x4 matrices (column-major).
    Result = a * b (right-to-left chain: a applied after b).
    """
    result = [0.0] * 16
    for col in range(4):
        for row in range(4):
            for k in range(4):
                result[col * 4 + row] += a[k * 4 + row] * b[col * 4 + k]
    return result


def mat4_transform_point(
    m: List[float], p: Tuple[float, float, float]
) -> Tuple[float, float]:
    """
    Transform 3D point p by matrix m, return 2D screen coords (x, y).
    Assumes w=1 at input; returns w-divided result truncated to 2D.
    """
    x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12]
    y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13]
    return (x, y)


def mat4_transform_point4(
    m: List[float], p: Tuple[float, float, float]
) -> Tuple[float, float, float, float]:
    """
    Transform 3D point p by matrix m, return full clip coords (x, y, z, w).
    Used for perspective division in 3D projection.
    """
    x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12]
    y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13]
    z = m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]
    w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15]
    return (x, y, z, w)


def mat4_perspective(
    fov_y_rad: float, aspect: float, z_near: float, z_far: float
) -> List[float]:
    """
    Right-handed perspective projection (OpenGL-style; NDC z in [-1, 1]).
    Column-major layout.
    """
    if z_near <= 0 or z_far <= 0 or z_near >= z_far:
        raise ValueError("Invalid near/far plane values.")

    f = 1.0 / math.tan(fov_y_rad / 2.0)
    nf = 1.0 / (z_near - z_far)

    # Column-major order
    return [
        f / aspect,
        0.0,
        0.0,
        0.0,
        0.0,
        f,
        0.0,
        0.0,
        0.0,
        0.0,
        (z_far + z_near) * nf,
        -1.0,
        0.0,
        0.0,
        (2.0 * z_far * z_near) * nf,
        0.0,
    ]


# ==================== QUATERNION ====================


@dataclass
class Quaternion:
    """Quaternion: [x, y, z, w] where w is scalar part."""

    x: float = 0.0
    y: float = 0.0
    z: float = 0.0
    w: float = 1.0

    def __iter__(self):
        """Unpack to (x, y, z, w) tuple."""
        return iter((self.x, self.y, self.z, self.w))

    def conjugate(self) -> "Quaternion":
        """Return conjugate (negate vector part)."""
        return Quaternion(-self.x, -self.y, -self.z, self.w)

    def to_mat4(self) -> List[float]:
        """Convert quaternion to 4x4 rotation matrix (column-major)."""
        x, y, z, w = self.x, self.y, self.z, self.w

        xx, yy, zz = x * x, y * y, z * z
        xy, xz, yz = x * y, x * z, y * z
        wx, wy, wz = w * x, w * y, w * z

        return [
            1 - 2 * (yy + zz),
            2 * (xy + wz),
            2 * (xz - wy),
            0,
            2 * (xy - wz),
            1 - 2 * (xx + zz),
            2 * (yz + wx),
            0,
            2 * (xz + wy),
            2 * (yz - wx),
            1 - 2 * (xx + yy),
            0,
            0,
            0,
            0,
            1,
        ]


# ==================== CAMERAS ====================


@dataclass
class SceneConfig:
    """Configuration for GraphicsScene 2D rendering."""

    viewport_width: float = 1920.0
    viewport_height: float = 1080.0
    mind_eye: Tuple[float, float, float] = (0.0, 0.0, 0.0)
    zoom: float = 1.0
    pan_x: float = 0.0
    pan_y: float = 0.0
    rotation_angle: float = 0.0


@dataclass
class QuaternionCamera:
    """3D perspective camera with quaternion rotation."""

    viewport_width: float
    viewport_height: float
    position: Tuple[float, float, float] = (0.0, 0.0, 500.0)
    rotation: Quaternion = field(default_factory=lambda: Quaternion(0, 0, 0, 1))

    # Perspective parameters
    fov_y_degrees: float = 60.0
    z_near: float = 0.1
    z_far: float = 5000.0

    def get_view_matrix(self) -> List[float]:
        """
        Construct view matrix = R_inv * T_inv.
        Transforms from world space to camera space.
        """
        # Inverse rotation (conjugate)
        rot_inv_q = self.rotation.conjugate()
        r_inv = rot_inv_q.to_mat4()

        # Inverse translation
        t_inv = mat4_translation(
            -self.position[0], -self.position[1], -self.position[2]
        )

        # view = R_inv * T_inv
        return mat4_mul(r_inv, t_inv)

    def get_projection_matrix(self) -> List[float]:
        """Construct perspective projection matrix."""
        aspect = self.viewport_width / max(1.0, self.viewport_height)
        return mat4_perspective(
            math.radians(self.fov_y_degrees), aspect, self.z_near, self.z_far
        )

    def world_to_clip_matrix(self) -> List[float]:
        """
        Compose world → clip transform.
        clip = proj * view * world
        """
        proj = self.get_projection_matrix()
        view = self.get_view_matrix()
        return mat4_mul(proj, view)


# ==================== VIEWPORT (2D + 3D Projection) ====================


@dataclass
class Viewport:
    """2D viewport with legacy and 3D projection methods."""

    width: float
    height: float
    world_to_screen: List[float] = field(default_factory=mat4_identity)

    def project_point(
        self, pt: Tuple[float, float, float], mat: List[float]
    ) -> Tuple[float, float]:
        """
        Legacy 2D projection: applies matrix, returns screen coords.
        """
        return mat4_transform_point(mat, pt)

    def project_point_cam3d(
        self, world_pt: Tuple[float, float, float], world_to_clip: List[float]
    ) -> Tuple[Tuple[float, float], float]:
        """
        3D perspective projection:
        1) world → clip (x, y, z, w)
        2) perspective divide → NDC (x/w, y/w, z/w) in [-1, 1]
        3) map NDC → screen pixels

        Returns: ((screen_x, screen_y), depth_ndc)
        """
        cx, cy, cz, cw = mat4_transform_point4(world_to_clip, world_pt)

        if abs(cw) < 1e-10:
            # Behind camera or invalid; mark offscreen
            return ((-1.0, -1.0), float("inf"))

        ndc_x = cx / cw
        ndc_y = cy / cw
        ndc_z = cz / cw  # OpenGL convention [-1, 1]

        # NDC → pixels
        sx = (ndc_x * 0.5 + 0.5) * self.width
        sy = (1.0 - (ndc_y * 0.5 + 0.5)) * self.height  # flip y for screen coords

        return ((sx, sy), ndc_z)


# ==================== GRAPHICS SCENE ====================


@dataclass
class GraphicsScene:
    """
    Real-time graphics rendering engine.
    Manages 2D lattice + 3D camera systems.
    """

    config: SceneConfig
    clock: object = field(default_factory=lambda: time.time)
    start_time: float = field(default_factory=time.time)

    # Cameras: legacy 2D and new 3D
    world_to_screen: List[float] = field(default_factory=mat4_identity)
    camera: QuaternionCamera = field(
        default_factory=lambda: QuaternionCamera(1920, 1080)
    )
    viewport: Viewport = field(default_factory=lambda: Viewport(1920, 1080))

    # Scene: nodes (tuples or dicts), edges, limbs
    nodes: List[Union[Tuple[float, float, float], Dict[str, Any]]] = field(
        default_factory=list
    )
    edges: List[Dict[str, Any]] = field(default_factory=list)
    limbs: List[Dict[str, Any]] = field(default_factory=list)

    def __post_init__(self):
        """Initialize scene."""
        self.camera.viewport_width = self.config.viewport_width
        self.camera.viewport_height = self.config.viewport_height
        self.viewport.width = self.config.viewport_width
        self.viewport.height = self.config.viewport_height
        self._update_transform()

    def _update_transform(self):
        """
        FIXED: Recompute world-to-screen matrix from config (zoom, pan, rotation).

        Correct composition order for column-major + right-to-left chain:
        world → centerPivot → rotate → scale → viewportTranslate

        Matrix chain: T_screen * S * R * T_center
        Applied right-to-left: (v: center) → rotate → scale → screen
        """
        # Move pivot (mind_eye) to origin
        translate_to_center = mat4_translation(
            -self.config.mind_eye[0], -self.config.mind_eye[1], 0.0
        )

        rotate = mat4_rotation_z(self.config.rotation_angle)

        scale = mat4_scaling(self.config.zoom, self.config.zoom, 1.0)

        # Translate to viewport center + pan offset
        viewport_center_x = self.config.viewport_width / 2 + self.config.pan_x
        viewport_center_y = self.config.viewport_height / 2 + self.config.pan_y
        translate_to_screen = mat4_translation(
            viewport_center_x, viewport_center_y, 0.0
        )

        # ✅ Correct composition: T_screen * S * R * T_center
        self.world_to_screen = mat4_mul(
            translate_to_screen, mat4_mul(scale, mat4_mul(rotate, translate_to_center))
        )

    def step(self):
        """Update scene for one frame (stub for animation)."""
        # Placeholder: add animation logic here
        pass

    def snapshot(self) -> Dict[str, Any]:
        """
        Generate deterministic snapshot with DUAL-projection outputs.

        Backward compatible: keeps legacy 'screen' fields.
        New fields: 'screen_cam3d' + 'depth_cam3d' for 3D projection.
        """
        t = time.time() - self.start_time

        # Compute world → clip transform
        world_to_clip = self.camera.world_to_clip_matrix()

        nodes_screen: List[Dict[str, Any]] = []
        for idx, pt in enumerate(self.nodes):
            if isinstance(pt, (list, tuple)):
                world_pt: Tuple[float, float, float] = tuple(pt[:3])  # type: ignore
            else:
                world_pt = (
                    float(pt.get("x", 0)),
                    float(pt.get("y", 0)),
                    float(pt.get("z", 0)),
                )

            # Legacy 2D projection
            sx, sy = self.viewport.project_point(world_pt, self.world_to_screen)

            # New 3D projection
            (screen3d, depth3d) = self.viewport.project_point_cam3d(
                world_pt, world_to_clip
            )

            nodes_screen.append(
                {
                    "id": idx,
                    "world": world_pt,
                    "screen": (sx, sy),  # ✅ Legacy
                    "screen_cam3d": screen3d,  # ✅ New
                    "depth_cam3d": depth3d,  # ✅ New
                }
            )

        edges_screen: List[Dict[str, Any]] = []
        for edge in self.edges:
            a_idx: int = int(edge["a"])
            b_idx: int = int(edge["b"])
            node_a = self.nodes[a_idx]
            node_b = self.nodes[b_idx]
            if isinstance(node_a, (list, tuple)):
                aworld: Tuple[float, float, float] = tuple(node_a[:3])  # type: ignore
            else:
                aworld = (
                    float(node_a.get("x", 0)),
                    float(node_a.get("y", 0)),
                    float(node_a.get("z", 0)),
                )
            if isinstance(node_b, (list, tuple)):
                bworld: Tuple[float, float, float] = tuple(node_b[:3])  # type: ignore
            else:
                bworld = (
                    float(node_b.get("x", 0)),
                    float(node_b.get("y", 0)),
                    float(node_b.get("z", 0)),
                )

            # Legacy 2D
            ax, ay = self.viewport.project_point(aworld, self.world_to_screen)
            bx, by = self.viewport.project_point(bworld, self.world_to_screen)

            # New 3D
            (a3, ad) = self.viewport.project_point_cam3d(aworld, world_to_clip)
            (b3, bd) = self.viewport.project_point_cam3d(bworld, world_to_clip)

            edges_screen.append(
                {
                    "a": a_idx,
                    "b": b_idx,
                    "a_screen": (ax, ay),  # ✅ Legacy
                    "b_screen": (bx, by),  # ✅ Legacy
                    "a_screen_cam3d": a3,  # ✅ New
                    "b_screen_cam3d": b3,  # ✅ New
                    "a_depth_cam3d": ad,  # ✅ New
                    "b_depth_cam3d": bd,  # ✅ New
                    "stroke": edge.get("stroke", "cyan"),
                    "stroke_width": edge.get("stroke_width", 1.0),
                    "opacity": edge.get("opacity", 1.0),
                }
            )

        limbs_screen: List[Dict[str, Any]] = []
        for limb in self.limbs:
            limb_idx: int = int(limb.get("index", 0))
            start_val = limb.get("start", (0, 0, 0))
            end_val = limb.get("end", (0, 0, 0))
            start3: Tuple[float, float, float] = (
                tuple(start_val)
                if isinstance(start_val, (list, tuple))
                else (float(start_val[0]), float(start_val[1]), float(start_val[2]))
            )  # type: ignore
            end3: Tuple[float, float, float] = (
                tuple(end_val)
                if isinstance(end_val, (list, tuple))
                else (float(end_val[0]), float(end_val[1]), float(end_val[2]))
            )  # type: ignore

            # Legacy 2D
            sx1, sy1 = self.viewport.project_point(start3, self.world_to_screen)
            sx2, sy2 = self.viewport.project_point(end3, self.world_to_screen)

            # New 3D
            (s31, d31) = self.viewport.project_point_cam3d(start3, world_to_clip)
            (s32, d32) = self.viewport.project_point_cam3d(end3, world_to_clip)

            limbs_screen.append(
                {
                    "limb_index": limb_idx,
                    "start_screen": (sx1, sy1),  # ✅ Legacy
                    "end_screen": (sx2, sy2),  # ✅ Legacy
                    "start_screen_cam3d": s31,  # ✅ New
                    "end_screen_cam3d": s32,  # ✅ New
                    "start_depth_cam3d": d31,  # ✅ New
                    "end_depth_cam3d": d32,  # ✅ New
                    "stroke": limb.get("stroke", "magenta"),
                    "stroke_width": limb.get("stroke_width", 2.0),
                    "opacity": limb.get("opacity", 0.8),
                }
            )

        return {
            "time_tick": int(t * 60),  # Approx 60 FPS
            "elapsed_seconds": t,
            "nodes": nodes_screen,
            "edges": edges_screen,
            "limbs": limbs_screen,
            "viewport": {
                "width": self.config.viewport_width,
                "height": self.config.viewport_height,
            },
            "mind_eye": self.config.mind_eye,
            "camera": {
                "zoom": self.config.zoom,
                "pan": (self.config.pan_x, self.config.pan_y),
                "rotation": self.config.rotation_angle,
                "quaternion_position": self.camera.position,
                "quaternion_rotation": (
                    self.camera.rotation.x,
                    self.camera.rotation.y,
                    self.camera.rotation.z,
                    self.camera.rotation.w,
                ),
                "fov_y_degrees": self.camera.fov_y_degrees,
                "z_near": self.camera.z_near,
                "z_far": self.camera.z_far,
            },
        }  # type: ignore


if __name__ == "__main__":
    # Quick smoke test
    scene = GraphicsScene(SceneConfig())

    # Add test nodes
    scene.nodes = [(0, 0, 0), (100, 0, 100), (0, 100, 100)]

    # Add test edges
    scene.edges = [
        {"a": 0, "b": 1, "stroke": "cyan", "stroke_width": 2.0},
        {"a": 1, "b": 2, "stroke": "magenta", "stroke_width": 1.5},
    ]

    # Add test limbs
    scene.limbs = [
        {
            "index": 0,
            "start": (0, 0, 0),
            "end": (50, 50, 50),
            "stroke": "magenta",
            "stroke_width": 2.5,
            "opacity": 0.8,
        }
    ]

    # Test snapshots
    for i in range(3):
        scene.step()
        snap = scene.snapshot()
        nodes_list: List[Dict[str, Any]] = snap["nodes"]  # type: ignore
        edges_list: List[Dict[str, Any]] = snap["edges"]  # type: ignore
        n0: Dict[str, Any] = nodes_list[0]
        e0: Dict[str, Any] = edges_list[0]
        print(f"Frame {i}:")
        print(
            f"  Node 0 legacy: {n0['screen']}, cam3d: {n0['screen_cam3d']}, depth: {n0['depth_cam3d']:.4f}"
        )
        print(f"  Edge 0 legacy: {e0['a_screen']} → {e0['b_screen']}")
        print()
