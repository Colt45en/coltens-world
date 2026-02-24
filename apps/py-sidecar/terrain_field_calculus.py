"""
Terrain Field Calculus - Connect calculus_engine to heightmap analysis

Provides production-grade terrain analysis:
- Gradient fields (slope direction/magnitude)
- Curvature analysis (ridges, valleys, convexity)
- Watershed/flow direction extraction
- Ridge line detection
- Contour/iso-height analysis

Integrates with Noise3D terrain grids (TS/Three.js or Python renderer).
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Callable, List, Tuple, Optional
import json

from calculus_engine import Calculus


@dataclass(frozen=True)
class Vec2:
    x: float
    y: float

    def __add__(self, other: Vec2) -> Vec2:
        return Vec2(self.x + other.x, self.y + other.y)

    def __sub__(self, other: Vec2) -> Vec2:
        return Vec2(self.x - other.x, self.y - other.y)

    def __mul__(self, scalar: float) -> Vec2:
        return Vec2(self.x * scalar, self.y * scalar)

    def magnitude(self) -> float:
        return math.sqrt(self.x * self.x + self.y * self.y)

    def normalized(self) -> Vec2:
        mag = self.magnitude()
        return Vec2(self.x / mag, self.y / mag) if mag > 1e-12 else Vec2(0, 0)

    def to_list(self) -> List[float]:
        return [self.x, self.y]


@dataclass(frozen=True)
class TerrainPoint:
    """Rich terrain analysis at a single point"""
    position: Vec2
    height: float
    gradient: Vec2  # ∇h (slope direction and magnitude)
    slope_angle: float  # radians
    slope_magnitude: float
    curvature_mean: float  # (κ1 + κ2) / 2
    curvature_gaussian: float  # κ1 * κ2
    curvature_max: float  # max principal curvature
    curvature_min: float  # min principal curvature
    flow_direction: Vec2  # normalized downhill direction
    is_ridge: bool
    is_valley: bool
    is_saddle: bool


@dataclass(frozen=True)
class TerrainField:
    """Complete terrain analysis grid"""
    width: int
    height: int
    cell_size: float
    points: List[List[TerrainPoint]]

    def get(self, x: int, y: int) -> Optional[TerrainPoint]:
        if 0 <= x < self.width and 0 <= y < self.height:
            return self.points[y][x]
        return None

    def sample_bilinear(self, x: float, y: float) -> Optional[TerrainPoint]:
        """Sample terrain field with bilinear interpolation"""
        if x < 0 or y < 0 or x >= self.width - 1 or y >= self.height - 1:
            return None

        x0, y0 = int(x), int(y)
        x1, y1 = x0 + 1, y0 + 1
        fx, fy = x - x0, y - y0

        p00 = self.get(x0, y0)
        p10 = self.get(x1, y0)
        p01 = self.get(x0, y1)
        p11 = self.get(x1, y1)

        if not all([p00, p10, p01, p11]):
            return None

        # Bilinear interpolation for height and key fields
        height = (
            p00.height * (1 - fx) * (1 - fy) +
            p10.height * fx * (1 - fy) +
            p01.height * (1 - fx) * fy +
            p11.height * fx * fy
        )

        # Interpolate gradient
        grad_x = (
            p00.gradient.x * (1 - fx) * (1 - fy) +
            p10.gradient.x * fx * (1 - fy) +
            p01.gradient.x * (1 - fx) * fy +
            p11.gradient.x * fx * fy
        )
        grad_y = (
            p00.gradient.y * (1 - fx) * (1 - fy) +
            p10.gradient.y * fx * (1 - fy) +
            p01.gradient.y * (1 - fx) * fy +
            p11.gradient.y * fx * fy
        )

        gradient = Vec2(grad_x, grad_y)
        slope_mag = gradient.magnitude()
        slope_angle = math.atan(slope_mag) if slope_mag > 0 else 0.0

        # Simplified interpolated point (curvature interpolation is approximate)
        return TerrainPoint(
            position=Vec2(x, y),
            height=height,
            gradient=gradient,
            slope_angle=slope_angle,
            slope_magnitude=slope_mag,
            curvature_mean=0.0,  # Would need proper interpolation
            curvature_gaussian=0.0,
            curvature_max=0.0,
            curvature_min=0.0,
            flow_direction=gradient * -1.0 if slope_mag > 0 else Vec2(0, 0),
            is_ridge=False,
            is_valley=False,
            is_saddle=False
        )


class TerrainFieldCalculus:
    """Production terrain analysis using calculus_engine"""

    @staticmethod
    def from_heightmap(
        heightmap: List[List[float]],
        cell_size: float = 1.0,
        *,
        compute_curvature: bool = True,
        ridge_threshold: float = 0.1,
        valley_threshold: float = -0.1
    ) -> TerrainField:
        """
        Analyze a 2D heightmap grid with production-grade calculus.

        Args:
            heightmap: 2D array heightmap[y][x] (row-major)
            cell_size: World-space size of each grid cell
            compute_curvature: Compute Hessian/curvature (expensive but useful)
            ridge_threshold: Mean curvature above this = ridge
            valley_threshold: Mean curvature below this = valley
        """
        height = len(heightmap)
        width = len(heightmap[0]) if height > 0 else 0

        if width == 0 or height == 0:
            raise ValueError("Heightmap must be non-empty")

        def h(pos: List[float]) -> float:
            """Sample height at continuous position with bilinear interpolation"""
            x, y = pos
            # Clamp to valid range
            x = max(0, min(width - 1.001, x))
            y = max(0, min(height - 1.001, y))

            x0, y0 = int(x), int(y)
            x1, y1 = min(x0 + 1, width - 1), min(y0 + 1, height - 1)
            fx, fy = x - x0, y - y0

            # Bilinear interpolation
            h00 = heightmap[y0][x0]
            h10 = heightmap[y0][x1]
            h01 = heightmap[y1][x0]
            h11 = heightmap[y1][x1]

            return (
                h00 * (1 - fx) * (1 - fy) +
                h10 * fx * (1 - fy) +
                h01 * (1 - fx) * fy +
                h11 * fx * fy
            )

        points: List[List[TerrainPoint]] = []

        for y in range(height):
            row: List[TerrainPoint] = []
            for x in range(width):
                pos_world = Vec2(x * cell_size, y * cell_size)
                height_val = heightmap[y][x]

                # Compute gradient using central differences via calculus engine
                grad = Calculus.gradient(h, [float(x), float(y)])
                gradient = Vec2(grad[0] / cell_size, grad[1] / cell_size)
                slope_mag = gradient.magnitude()
                slope_angle = math.atan(slope_mag) if slope_mag > 0 else 0.0

                # Compute flow direction (downhill = -gradient)
                flow_dir = gradient * -1.0 if slope_mag > 0 else Vec2(0, 0)
                if slope_mag > 0:
                    flow_dir = flow_dir.normalized()

                # Curvature analysis (Hessian eigenvalues)
                curv_mean = 0.0
                curv_gaussian = 0.0
                curv_max = 0.0
                curv_min = 0.0
                is_ridge = False
                is_valley = False
                is_saddle = False

                if compute_curvature and 1 <= x < width - 1 and 1 <= y < height - 1:
                    H = Calculus.hessian(h, [float(x), float(y)])
                    # Scale Hessian by cell_size
                    H_scaled = [
                        [H[0][0] / (cell_size * cell_size), H[0][1] / (cell_size * cell_size)],
                        [H[1][0] / (cell_size * cell_size), H[1][1] / (cell_size * cell_size)]
                    ]

                    # Eigenvalues of Hessian (principal curvatures)
                    # For 2x2: λ = (trace ± sqrt(trace² - 4*det)) / 2
                    trace = H_scaled[0][0] + H_scaled[1][1]
                    det = H_scaled[0][0] * H_scaled[1][1] - H_scaled[0][1] * H_scaled[1][0]
                    discriminant = trace * trace - 4 * det

                    if discriminant >= 0:
                        sqrt_d = math.sqrt(discriminant)
                        lambda1 = (trace + sqrt_d) / 2.0
                        lambda2 = (trace - sqrt_d) / 2.0

                        curv_max = max(lambda1, lambda2)
                        curv_min = min(lambda1, lambda2)
                        curv_mean = (lambda1 + lambda2) / 2.0
                        curv_gaussian = lambda1 * lambda2

                        # Classify terrain features
                        # Ridge: high positive mean curvature (both eigenvalues positive)
                        # Valley: high negative mean curvature (both eigenvalues negative)
                        # Saddle: opposite sign eigenvalues (negative Gaussian curvature)

                        if curv_mean > ridge_threshold and curv_gaussian > 0:
                            is_ridge = True
                        elif curv_mean < valley_threshold and curv_gaussian > 0:
                            is_valley = True
                        elif curv_gaussian < -0.001:
                            is_saddle = True

                point = TerrainPoint(
                    position=pos_world,
                    height=height_val,
                    gradient=gradient,
                    slope_angle=slope_angle,
                    slope_magnitude=slope_mag,
                    curvature_mean=curv_mean,
                    curvature_gaussian=curv_gaussian,
                    curvature_max=curv_max,
                    curvature_min=curv_min,
                    flow_direction=flow_dir,
                    is_ridge=is_ridge,
                    is_valley=is_valley,
                    is_saddle=is_saddle
                )
                row.append(point)
            points.append(row)

        return TerrainField(
            width=width,
            height=height,
            cell_size=cell_size,
            points=points
        )

    @staticmethod
    def extract_ridges(field: TerrainField) -> List[List[Vec2]]:
        """Extract ridge lines as polylines"""
        ridges: List[List[Vec2]] = []
        visited = [[False] * field.width for _ in range(field.height)]

        for y in range(field.height):
            for x in range(field.width):
                point = field.get(x, y)
                if point and point.is_ridge and not visited[y][x]:
                    # Trace ridge line
                    line = TerrainFieldCalculus._trace_feature(
                        field, x, y, visited, lambda p: p.is_ridge
                    )
                    if len(line) > 2:  # Only keep substantial ridges
                        ridges.append(line)

        return ridges

    @staticmethod
    def extract_valleys(field: TerrainField) -> List[List[Vec2]]:
        """Extract valley lines as polylines"""
        valleys: List[List[Vec2]] = []
        visited = [[False] * field.width for _ in range(field.height)]

        for y in range(field.height):
            for x in range(field.width):
                point = field.get(x, y)
                if point and point.is_valley and not visited[y][x]:
                    # Trace valley line
                    line = TerrainFieldCalculus._trace_feature(
                        field, x, y, visited, lambda p: p.is_valley
                    )
                    if len(line) > 2:
                        valleys.append(line)

        return valleys

    @staticmethod
    def _trace_feature(
        field: TerrainField,
        start_x: int,
        start_y: int,
        visited: List[List[bool]],
        predicate: Callable[[TerrainPoint], bool]
    ) -> List[Vec2]:
        """Trace a connected feature line (ridge or valley)"""
        line: List[Vec2] = []
        stack = [(start_x, start_y)]

        while stack:
            x, y = stack.pop()
            if visited[y][x]:
                continue

            point = field.get(x, y)
            if not point or not predicate(point):
                continue

            visited[y][x] = True
            line.append(point.position)

            # Check 8-connected neighbors
            for dx in [-1, 0, 1]:
                for dy in [-1, 0, 1]:
                    if dx == 0 and dy == 0:
                        continue
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < field.width and 0 <= ny < field.height:
                        if not visited[ny][nx]:
                            neighbor = field.get(nx, ny)
                            if neighbor and predicate(neighbor):
                                stack.append((nx, ny))

        return line

    @staticmethod
    def compute_flow_accumulation(field: TerrainField) -> List[List[float]]:
        """
        Compute flow accumulation (watershed drainage area).
        Returns grid where each cell contains the number of upstream cells draining to it.
        """
        accumulation = [[1.0] * field.width for _ in range(field.height)]

        # Create list of all points sorted by height (descending)
        points_sorted: List[Tuple[int, int, float]] = []
        for y in range(field.height):
            for x in range(field.width):
                point = field.get(x, y)
                if point:
                    points_sorted.append((x, y, point.height))

        points_sorted.sort(key=lambda p: p[2], reverse=True)

        # Process from highest to lowest
        for x, y, _ in points_sorted:
            point = field.get(x, y)
            if not point:
                continue

            # Flow to steepest downhill neighbor
            flow = point.flow_direction
            if flow.magnitude() < 1e-6:
                continue

            # Find best neighbor in flow direction
            best_x, best_y = x, y
            best_drop = 0.0

            for dx in [-1, 0, 1]:
                for dy in [-1, 0, 1]:
                    if dx == 0 and dy == 0:
                        continue
                    nx, ny = x + dx, y + dy
                    neighbor = field.get(nx, ny)
                    if neighbor:
                        drop = point.height - neighbor.height
                        if drop > best_drop:
                            best_drop = drop
                            best_x, best_y = nx, ny

            # Accumulate flow
            if (best_x, best_y) != (x, y):
                accumulation[best_y][best_x] += accumulation[y][x]

        return accumulation

    @staticmethod
    def export_to_json(field: TerrainField, path: str):
        """Export terrain field analysis to JSON for JS/TS consumption"""
        data = {
            "width": field.width,
            "height": field.height,
            "cell_size": field.cell_size,
            "points": []
        }

        for y in range(field.height):
            for x in range(field.width):
                point = field.get(x, y)
                if point:
                    data["points"].append({
                        "x": x,
                        "y": y,
                        "height": point.height,
                        "gradient": {"x": point.gradient.x, "y": point.gradient.y},
                        "slope_angle": point.slope_angle,
                        "slope_magnitude": point.slope_magnitude,
                        "curvature_mean": point.curvature_mean,
                        "curvature_gaussian": point.curvature_gaussian,
                        "flow_direction": {"x": point.flow_direction.x, "y": point.flow_direction.y},
                        "is_ridge": point.is_ridge,
                        "is_valley": point.is_valley,
                        "is_saddle": point.is_saddle
                    })

        with open(path, 'w') as f:
            json.dump(data, f, indent=2)


# -----------------------------
# Noise3D Integration Bridge
# -----------------------------

class Noise3DIntegration:
    """Bridge between Noise3D terrain generation and field calculus"""

    @staticmethod
    def from_noise3d_simplex(
        width: int,
        height: int,
        scale: float = 0.05,
        octaves: int = 4,
        persistence: float = 0.5,
        lacunarity: float = 2.0,
        seed: Optional[int] = None
    ) -> TerrainField:
        """
        Generate terrain using simplex noise (Python implementation) and analyze it.

        Note: This uses a simple Python noise implementation.
        For production, connect to your Noise3D.ts via WebSocket or file export.
        """
        try:
            # Try to use noise library if available
            import noise  # type: ignore
            heightmap = []
            for y in range(height):
                row = []
                for x in range(width):
                    value = 0.0
                    amplitude = 1.0
                    frequency = scale

                    for _ in range(octaves):
                        nx = x * frequency
                        ny = y * frequency
                        value += noise.snoise2(nx, ny, octaves=1, base=seed or 0) * amplitude
                        amplitude *= persistence
                        frequency *= lacunarity

                    row.append(value)
                heightmap.append(row)

            return TerrainFieldCalculus.from_heightmap(heightmap)

        except ImportError:
            # Fallback: simple sine wave terrain for demonstration
            heightmap = []
            for y in range(height):
                row = []
                for x in range(width):
                    value = (
                        math.sin(x * scale) * math.cos(y * scale) +
                        0.5 * math.sin(x * scale * 2.3) * math.cos(y * scale * 1.7)
                    )
                    row.append(value)
                heightmap.append(row)

            return TerrainFieldCalculus.from_heightmap(heightmap)

    @staticmethod
    def from_noise3d_export(json_path: str) -> TerrainField:
        """
        Load terrain from Noise3D TypeScript export.

        Expected JSON format:
        {
          "width": 256,
          "height": 256,
          "heightmap": [[h00, h01, ...], [h10, h11, ...], ...],
          "cell_size": 1.0
        }
        """
        with open(json_path, 'r') as f:
            data = json.load(f)

        heightmap = data["heightmap"]
        cell_size = data.get("cell_size", 1.0)

        return TerrainFieldCalculus.from_heightmap(heightmap, cell_size)


# -----------------------------
# Example usage
# -----------------------------
if __name__ == "__main__":
    # Example: Generate and analyze simple terrain
    print("=== Terrain Field Calculus Demo ===\n")

    # Create simple test heightmap (crater shape)
    size = 50
    heightmap = []
    for y in range(size):
        row = []
        for x in range(size):
            cx, cy = size / 2, size / 2
            dx, dy = x - cx, y - cy
            r = math.sqrt(dx * dx + dy * dy)
            # Crater: high at edges, low in center
            h = math.exp(-(r - 15) ** 2 / 50) + 0.2 * math.sin(r * 0.5)
            row.append(h)
        heightmap.append(row)

    # Analyze terrain
    print("Analyzing 50x50 crater heightmap...")
    field = TerrainFieldCalculus.from_heightmap(
        heightmap,
        cell_size=1.0,
        compute_curvature=True
    )

    # Find ridge/valley features
    ridges = TerrainFieldCalculus.extract_ridges(field)
    valleys = TerrainFieldCalculus.extract_valleys(field)

    print(f"Found {len(ridges)} ridge lines")
    print(f"Found {len(valleys)} valley lines")

    # Sample a point
    center_point = field.get(25, 25)
    if center_point:
        print("\nCenter point analysis:")
        print(f"  Height: {center_point.height:.3f}")
        print(f"  Slope: {center_point.slope_magnitude:.3f} ({math.degrees(center_point.slope_angle):.1f}°)")
        print(f"  Mean curvature: {center_point.curvature_mean:.3f}")
        print(f"  Gaussian curvature: {center_point.curvature_gaussian:.3f}")
        print(f"  Feature: Ridge={center_point.is_ridge}, Valley={center_point.is_valley}, Saddle={center_point.is_saddle}")

    # Compute flow accumulation (watershed)
    print("\nComputing flow accumulation...")
    flow_accum = TerrainFieldCalculus.compute_flow_accumulation(field)
    max_flow = max(max(row) for row in flow_accum)
    print(f"Max flow accumulation: {max_flow:.0f} cells")

    print("\n✅ Terrain analysis complete!")
