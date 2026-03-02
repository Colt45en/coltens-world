"""
geometry_engine.py

Production-grade 3D geometry math core (deterministic, robust)

- Vector3 (immutable-ish ops)
- Triangle / Plane / Ray primitives
- Ray-plane and Ray-triangle intersections (Möller–Trumbore)
- Sphere-sphere collision + resolution (single-body and split modes)
- Point-in-triangle test (XZ projection) with degeneracy guards
- Deterministic raycast results (sorted by t)
- Centralized metrics (frame vs total counters)

Requires: numpy (for transform matrices convenience)

HOTSPOT FIXES:
  ✅ Degenerate triangle guards (XZ projection, ray-triangle)
  ✅ Deterministic epsilon (EPS = 1e-9) used globally
  ✅ Normalized rays/planes (direction_unit, normal_unit) stored once
  ✅ Ray-triangle intersection (Möller–Trumbore) for picking/terrain
  ✅ Dual collision resolution (single-body push or split correction)
  ✅ Sane frame/total metrics (reset frame each update())
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Tuple, List, Dict, Any, Optional, Iterable
import math
import numpy as np

EPS = 1e-9  # Global epsilon for all comparisons


# ============================================================================
# Vector3
# ============================================================================
@dataclass(frozen=True, slots=True)
class Vector3:
    """Immutable 3D vector."""

    x: float
    y: float
    z: float

    # --- basic ops ---
    def __add__(self, other: "Vector3") -> "Vector3":
        return Vector3(self.x + other.x, self.y + other.y, self.z + other.z)

    def __sub__(self, other: "Vector3") -> "Vector3":
        return Vector3(self.x - other.x, self.y - other.y, self.z - other.z)

    def __mul__(self, scalar: float) -> "Vector3":
        if not isinstance(scalar, (int, float)):
            raise TypeError("Vector3 can only be multiplied by a scalar.")
        return Vector3(
            self.x * float(scalar), self.y * float(scalar), self.z * float(scalar)
        )

    def __rmul__(self, scalar: float) -> "Vector3":
        return self.__mul__(scalar)

    def __neg__(self) -> "Vector3":
        return Vector3(-self.x, -self.y, -self.z)

    def __repr__(self) -> str:
        return f"Vector3({self.x:.4f}, {self.y:.4f}, {self.z:.4f})"

    # --- algebra ---
    def dot(self, other: "Vector3") -> float:
        """Dot product."""
        return self.x * other.x + self.y * other.y + self.z * other.z

    def cross(self, other: "Vector3") -> "Vector3":
        """Cross product (right-hand rule)."""
        return Vector3(
            self.y * other.z - self.z * other.y,
            self.z * other.x - self.x * other.z,
            self.x * other.y - self.y * other.x,
        )

    def magnitude(self) -> float:
        """Euclidean length."""
        return math.sqrt(self.x * self.x + self.y * self.y + self.z * self.z)

    def magnitude_sq(self) -> float:
        """Squared magnitude (faster when you don't need sqrt)."""
        return self.x * self.x + self.y * self.y + self.z * self.z

    def normalize(self) -> "Vector3":
        """Return unit vector or zero if degenerate."""
        mag = self.magnitude()
        if mag < EPS:
            return Vector3(0.0, 0.0, 0.0)
        inv = 1.0 / mag
        return Vector3(self.x * inv, self.y * inv, self.z * inv)

    def distance_to(self, other: "Vector3") -> float:
        """Euclidean distance to another point."""
        return (self - other).magnitude()

    def to_array(self) -> np.ndarray:
        """Export to numpy array [x, y, z]."""
        return np.array([self.x, self.y, self.z], dtype=float)

    @classmethod
    def from_array(cls, arr: np.ndarray) -> "Vector3":
        """Import from numpy array or 3-tuple."""
        arr = np.asarray(arr, dtype=float).reshape(3)
        return cls(float(arr[0]), float(arr[1]), float(arr[2]))

    def as_tuple(self) -> Tuple[float, float, float]:
        """Export to (x, y, z) tuple."""
        return (self.x, self.y, self.z)


# ============================================================================
# Primitives (Triangle, Plane, Ray)
# ============================================================================
@dataclass(frozen=True, slots=True)
class Triangle:
    """Three vertices defining a triangle in 3D."""

    a: Vector3
    b: Vector3
    c: Vector3

    def area(self) -> float:
        """Return triangle area (0 if degenerate)."""
        ab = self.b - self.a
        ac = self.c - self.a
        return 0.5 * ab.cross(ac).magnitude()

    def normal(self) -> Vector3:
        """Return unit normal (right-hand rule a→b→c)."""
        ab = self.b - self.a
        ac = self.c - self.a
        return ab.cross(ac).normalize()

    def centroid(self) -> Vector3:
        """Return center of mass (average of three vertices)."""
        return Vector3(
            (self.a.x + self.b.x + self.c.x) / 3.0,
            (self.a.y + self.b.y + self.c.y) / 3.0,
            (self.a.z + self.b.z + self.c.z) / 3.0,
        )

    def is_degenerate(self) -> bool:
        """Check if triangle is nearly flat (area → 0)."""
        ab = self.b - self.a
        ac = self.c - self.a
        return ab.cross(ac).magnitude_sq() < (EPS * EPS)


@dataclass(frozen=True, slots=True)
class Plane:
    """Plane defined by a point and normal vector."""

    point: Vector3
    normal: Vector3
    normal_unit: Vector3 = field(init=False)

    def __post_init__(self):
        """Normalize and cache the unit normal."""
        nu = self.normal.normalize()
        object.__setattr__(self, "normal_unit", nu)

    def distance_to_point(self, p: Vector3) -> float:
        """Return unsigned distance from point to plane."""
        diff = p - self.point
        return abs(self.normal_unit.dot(diff))

    def signed_distance(self, p: Vector3) -> float:
        """Return signed distance (positive = normal side, negative = opposite)."""
        diff = p - self.point
        return self.normal_unit.dot(diff)

    def project_point(self, p: Vector3) -> Vector3:
        """Project point onto plane along normal."""
        d = self.signed_distance(p)
        return p - self.normal_unit * d


@dataclass(frozen=True, slots=True)
class Ray:
    """Ray defined by origin and direction."""

    origin: Vector3
    direction: Vector3
    direction_unit: Vector3 = field(init=False)

    def __post_init__(self):
        """Normalize and cache the unit direction."""
        du = self.direction.normalize()
        object.__setattr__(self, "direction_unit", du)

    def point_at(self, t: float) -> Vector3:
        """Return point at parameter t along the ray."""
        return self.origin + self.direction_unit * t

    def intersect_plane(self, plane: Plane) -> Optional[Tuple[Vector3, float]]:
        """
        Intersect ray with plane.
        Returns (point, t) for t >= 0, or None if parallel/behind.
        """
        denom = self.direction_unit.dot(plane.normal_unit)
        if abs(denom) < EPS:
            return None  # parallel to plane

        t = (plane.point - self.origin).dot(plane.normal_unit) / denom
        if t < 0:
            return None  # intersection behind ray origin

        return (self.point_at(t), t)

    def intersect_ground(self) -> Optional[Tuple[Vector3, float]]:
        """
        Intersect ray with y=0 ground plane.
        Convenience method for terrain queries.
        """
        if abs(self.direction_unit.y) < EPS:
            return None

        t = -self.origin.y / self.direction_unit.y
        if t < 0:
            return None

        return (self.point_at(t), t)

    def intersect_triangle(self, tri: Triangle) -> Optional[Tuple[Vector3, float]]:
        """
        Möller–Trumbore ray-triangle intersection.
        Robust, deterministic, handles degenerate triangles.

        Returns (point, t) for t >= 0, or None.
        """
        if tri.is_degenerate():
            return None

        v0, v1, v2 = tri.a, tri.b, tri.c
        e1 = v1 - v0
        e2 = v2 - v0

        pvec = self.direction_unit.cross(e2)
        det = e1.dot(pvec)

        if abs(det) < EPS:
            return None  # ray parallel to triangle

        inv_det = 1.0 / det
        tvec = self.origin - v0
        u = tvec.dot(pvec) * inv_det

        if u < 0.0 or u > 1.0:
            return None  # outside triangle

        qvec = tvec.cross(e1)
        v = self.direction_unit.dot(qvec) * inv_det

        if v < 0.0 or (u + v) > 1.0:
            return None  # outside triangle

        t = e2.dot(qvec) * inv_det
        if t < 0:
            return None  # intersection behind ray

        return (self.point_at(t), t)


# ============================================================================
# Transforms
# ============================================================================
class SpatialTransforms:
    """Rotation and affine transformation utilities."""

    @staticmethod
    def rotation_matrix_x(angle: float) -> np.ndarray:
        """3×3 rotation around X axis (radians)."""
        c = math.cos(angle)
        s = math.sin(angle)
        return np.array([[1, 0, 0], [0, c, -s], [0, s, c]], dtype=float)

    @staticmethod
    def rotation_matrix_y(angle: float) -> np.ndarray:
        """3×3 rotation around Y axis (radians)."""
        c = math.cos(angle)
        s = math.sin(angle)
        return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]], dtype=float)

    @staticmethod
    def rotation_matrix_z(angle: float) -> np.ndarray:
        """3×3 rotation around Z axis (radians)."""
        c = math.cos(angle)
        s = math.sin(angle)
        return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]], dtype=float)

    @staticmethod
    def euler_to_rotation_matrix(pitch: float, yaw: float, roll: float) -> np.ndarray:
        """
        Euler angles (pitch, yaw, roll) to 3×3 rotation matrix.
        Composition: Rz(roll) * Ry(yaw) * Rx(pitch)
        """
        rx = SpatialTransforms.rotation_matrix_x(pitch)
        ry = SpatialTransforms.rotation_matrix_y(yaw)
        rz = SpatialTransforms.rotation_matrix_z(roll)
        return rz @ ry @ rx

    @staticmethod
    def transform_vector(v: Vector3, m3: np.ndarray) -> Vector3:
        """Apply 3×3 rotation/scale matrix to vector."""
        m3 = np.asarray(m3, dtype=float).reshape(3, 3)
        out = m3 @ v.to_array()
        return Vector3.from_array(out)

    @staticmethod
    def transform_points(points: Iterable[Vector3], m3: np.ndarray) -> List[Vector3]:
        """Apply 3×3 matrix to list of points."""
        m3 = np.asarray(m3, dtype=float).reshape(3, 3)
        out: List[Vector3] = []
        for p in points:
            out.append(SpatialTransforms.transform_vector(p, m3))
        return out


# ============================================================================
# Raycast Result
# ============================================================================
@dataclass
class RayHit:
    """Single hit from raycast query."""

    kind: str  # 'ground' | 'plane_i' | 'triangle_i'
    point: Vector3
    t: float

    def as_tuple(self) -> Tuple[str, Tuple[float, float, float], float]:
        """Export as (kind, (x, y, z), t)."""
        return (self.kind, self.point.as_tuple(), self.t)


# ============================================================================
# Engine (Stateful Geometry Registry)
# ============================================================================
class GeometryEngine:
    """
    Stateful registry of triangles, planes, rays with deterministic queries.

    DESIGN:
    - Add geometry once, query many times (triangle mesh, collision queries)
    - Raycast always returns sorted results (deterministic)
    - Metrics track frame vs total (reset frame each update())
    - No silent NaNs or divisions by zero (guard all edge cases)
    """

    def __init__(self):
        self.triangles: List[Triangle] = []
        self.planes: List[Plane] = []
        self.rays: List[Ray] = []

        # Total counters (cumulative)
        self.total = {
            "triangles_added": 0,
            "planes_added": 0,
            "rays_created": 0,
            "intersections": 0,
            "transforms_applied": 0,
        }

        # Frame counters (reset each update())
        self.frame = {k: 0 for k in self.total.keys()}

        # Cached standard planes
        self._ground_plane = Plane(Vector3(0, 0, 0), Vector3(0, 1, 0))

    def _frame_inc(self, key: str, amount: int = 1) -> None:
        """Increment both frame and total counters."""
        self.frame[key] += amount
        self.total[key] += amount

    # ---- Geometry Addition ----

    def add_triangle(self, a: Vector3, b: Vector3, c: Vector3) -> Triangle:
        """Add triangle to registry, return reference."""
        tri = Triangle(a, b, c)
        self.triangles.append(tri)
        self._frame_inc("triangles_added", 1)
        return tri

    def add_plane(self, point: Vector3, normal: Vector3) -> Plane:
        """Add plane to registry, return reference."""
        pl = Plane(point, normal)
        self.planes.append(pl)
        self._frame_inc("planes_added", 1)
        return pl

    def create_ray(self, origin: Vector3, direction: Vector3) -> Ray:
        """Create and register ray, return reference."""
        ray = Ray(origin, direction)
        self.rays.append(ray)
        self._frame_inc("rays_created", 1)
        return ray

    # ---- Collision Tests ----

    def sphere_sphere_collision(
        self, c1: Vector3, r1: float, c2: Vector3, r2: float
    ) -> bool:
        """Check if two spheres overlap."""
        d2 = (c1 - c2).magnitude_sq()
        rr = r1 + r2
        return d2 < rr * rr

    def resolve_sphere_collision(
        self, pos1: Vector3, r1: float, pos2: Vector3, r2: float
    ) -> Vector3:
        """
        Resolve penetration: push pos1 fully out of pos2.
        Returns corrected position for sphere 1.
        """
        delta = pos1 - pos2
        d2 = delta.magnitude_sq()
        min_d = r1 + r2

        if d2 >= (min_d * min_d):
            return pos1  # no overlap

        if d2 < EPS * EPS:
            # Centers coincide; use deterministic fallback normal
            normal = Vector3(1, 0, 0)
            dist = 0.0
        else:
            dist = math.sqrt(d2)
            normal = delta * (1.0 / dist)

        penetration = min_d - dist
        return pos1 + normal * penetration

    def resolve_sphere_sphere(
        self, pos1: Vector3, r1: float, pos2: Vector3, r2: float, split: float = 0.5
    ) -> Tuple[Vector3, Vector3]:
        """
        Resolve penetration by splitting correction between both spheres.

        Args:
            split: correction split factor [0, 1]
                   0.0 = only move pos2
                   0.5 = split equally (default)
                   1.0 = only move pos1

        Returns: (corrected_pos1, corrected_pos2)
        """
        split = max(0.0, min(1.0, split))
        delta = pos1 - pos2
        d2 = delta.magnitude_sq()
        min_d = r1 + r2

        if d2 >= min_d * min_d:
            return (pos1, pos2)  # no overlap

        if d2 < EPS * EPS:
            n = Vector3(1, 0, 0)
            dist = 0.0
        else:
            dist = math.sqrt(d2)
            n = delta * (1.0 / dist)

        pen = min_d - dist
        corr = n * pen

        return (pos1 + corr * split, pos2 - corr * (1.0 - split))

    # ---- Point Tests ----

    def point_in_triangle_2d(self, point: Vector3, tri: Triangle) -> bool:
        """
        Point-in-triangle test in XZ plane using barycentric coordinates.
        Guards against degenerate triangles.
        """
        # Project to XZ (ignore y)
        px, pz = point.x, point.z
        ax, az = tri.a.x, tri.a.z
        bx, bz = tri.b.x, tri.b.z
        cx, cz = tri.c.x, tri.c.z

        v0x, v0z = cx - ax, cz - az
        v1x, v1z = bx - ax, bz - az
        v2x, v2z = px - ax, pz - az

        dot00 = v0x * v0x + v0z * v0z
        dot01 = v0x * v1x + v0z * v1z
        dot02 = v0x * v2x + v0z * v2z
        dot11 = v1x * v1x + v1z * v1z
        dot12 = v1x * v2x + v1z * v2z

        denom = dot00 * dot11 - dot01 * dot01

        if abs(denom) < EPS:
            return False  # degenerate in XZ

        inv = 1.0 / denom
        u = (dot11 * dot02 - dot01 * dot12) * inv
        v = (dot00 * dot12 - dot01 * dot02) * inv

        return (u >= 0.0) and (v >= 0.0) and (u + v <= 1.0)

    # ---- Raycasting ----

    def raycast(
        self,
        ray: Ray,
        include_ground: bool = True,
        include_planes: bool = True,
        include_triangles: bool = True,
    ) -> List[RayHit]:
        """
        Cast ray against all geometry, return sorted hits.
        Results sorted by t (distance), then by kind name (deterministic).
        """
        hits: List[RayHit] = []

        if include_ground:
            hit = ray.intersect_plane(self._ground_plane)
            if hit:
                p, t = hit
                hits.append(RayHit("ground", p, t))
                self._frame_inc("intersections", 1)

        if include_planes:
            for i, pl in enumerate(self.planes):
                hit = ray.intersect_plane(pl)
                if hit:
                    p, t = hit
                    hits.append(RayHit(f"plane_{i}", p, t))
                    self._frame_inc("intersections", 1)

        if include_triangles:
            for i, tri in enumerate(self.triangles):
                hit = ray.intersect_triangle(tri)
                if hit:
                    p, t = hit
                    hits.append(RayHit(f"triangle_{i}", p, t))
                    self._frame_inc("intersections", 1)

        # Deterministic sort: by t (distance), then by kind
        hits.sort(key=lambda h: (h.t, h.kind))
        return hits

    def nearest_hit(self, ray: Ray, **kwargs: bool) -> Optional[RayHit]:
        """Return the closest hit, or None."""
        hits = self.raycast(ray, **kwargs)
        return hits[0] if hits else None

    # ---- Statistics ----

    def calculate_surface_area(self) -> float:
        """Sum total surface area of all triangles."""
        return sum(t.area() for t in self.triangles)

    def clear_temporary_data(self) -> None:
        """Clear ray list (keep triangles/planes)."""
        self.rays.clear()

    def update(self, dt: float) -> Dict[str, float]:
        """
        Snapshot frame metrics and reset frame counters.
        Should be called once per frame.

        Returns: frame_metrics dict with counters + computed values.
        """
        # Capture frame counters before reset
        frame_metrics: Dict[str, float] = {k: float(v) for k, v in self.frame.items()}

        # Reset frame counters for next frame
        self.frame = {k: 0 for k in self.total.keys()}

        # Add computed metrics
        frame_metrics["dt"] = float(dt)
        frame_metrics["total_triangles"] = float(len(self.triangles))
        frame_metrics["total_planes"] = float(len(self.planes))
        frame_metrics["total_rays"] = float(len(self.rays))
        frame_metrics["surface_area"] = float(self.calculate_surface_area())

        return frame_metrics

    def get_geometry_stats(self) -> Dict[str, Any]:
        """Return complete geometry statistics."""
        return {
            "triangles": len(self.triangles),
            "planes": len(self.planes),
            "rays": len(self.rays),
            "total_surface_area": self.calculate_surface_area(),
            "total_metrics": dict(self.total),
        }


# ============================================================================
# Demo / Self-test
# ============================================================================
if __name__ == "__main__":
    eng = GeometryEngine()

    print("=== Geometry Engine Demo ===\n")

    # Add a triangle in XZ plane at y=0
    tri = eng.add_triangle(
        Vector3(0, 0, 0),
        Vector3(5, 0, 0),
        Vector3(0, 0, 5),
    )
    print(f"Triangle: area={tri.area():.2f}, normal={tri.normal()}")

    # Add a vertical plane at x=2 (normal along +X)
    pl = eng.add_plane(Vector3(2, 0, 0), Vector3(1, 0, 0))
    print(f"Plane added at {pl.point}, normal={pl.normal_unit}\n")

    # Cast ray from above downward
    print("--- Raycast Test ---")
    ray = eng.create_ray(Vector3(1, 10, 1), Vector3(0, -1, 0))
    hits = eng.raycast(ray)
    print(f"Ray from {ray.origin} in direction {ray.direction}")
    print(f"Hits ({len(hits)} total, sorted by t):")
    for h in hits:
        print(f"  {h.as_tuple()}")

    # Point-in-triangle test
    print("\n--- Point-in-Triangle Test (XZ projection) ---")
    p_inside = Vector3(1, 0, 1)
    p_outside = Vector3(10, 0, 10)
    print(
        f"Point {p_inside.as_tuple()} in triangle: {eng.point_in_triangle_2d(p_inside, tri)}"
    )
    print(
        f"Point {p_outside.as_tuple()} in triangle: {eng.point_in_triangle_2d(p_outside, tri)}"
    )

    # Collision test
    print("\n--- Sphere-Sphere Collision ---")
    c1, r1 = Vector3(0, 0, 0), 2.0
    c2, r2 = Vector3(3, 0, 0), 2.0
    overlaps = eng.sphere_sphere_collision(c1, r1, c2, r2)
    print(f"Sphere({c1.as_tuple()}, r={r1}) vs Sphere({c2.as_tuple()}, r={r2})")
    print(f"Overlaps: {overlaps}")

    if overlaps:
        resolved1 = eng.resolve_sphere_collision(c1, r1, c2, r2)
        resolved1a, resolved1b = eng.resolve_sphere_sphere(c1, r1, c2, r2, split=0.5)
        print(f"  Push c1 out of c2: {resolved1.as_tuple()}")
        print(f"  Split correction: {resolved1a.as_tuple()}, {resolved1b.as_tuple()}")

    # Frame metrics
    print("\n--- Metrics ---")
    frame_metrics = eng.update(0.016)
    print(f"Frame metrics: {frame_metrics}")
    print(f"Total stats: {eng.get_geometry_stats()}")
    print("\nDone!")
