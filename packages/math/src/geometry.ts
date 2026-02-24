/**
 * High-performance 3D geometry utilities
 * Tuple-based vectors ([x, y, z]) for optimal cache locality and performance
 * Core algorithms: Möller-Trumbore ray-triangle, barycentric coordinates, collision detection
 */

// ============================================================================
// TYPES
// ============================================================================

export type V3 = [number, number, number];
export type V2 = [number, number];

export interface RayHit {
  t: number;
  u: number;
  v: number;
  w?: number; // computed lazily: 1 - u - v
  normal?: V3;
  point?: V3;
}

export interface SphereHit extends RayHit {
  normal: V3;
  point: V3;
}

export interface BBox {
  min: V3;
  max: V3;
}

// ============================================================================
// CORE VECTOR OPERATIONS
// ============================================================================

/**
 * Vector subtraction: a - b
 */
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

/**
 * Vector addition: a + b
 */
export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/**
 * Scalar multiplication: v * s
 */
export const scale = (v: V3, s: number): V3 => [v[0] * s, v[1] * s, v[2] * s];

/**
 * Dot product: a · b
 */
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * Cross product: a × b
 */
export const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/**
 * Magnitude (length): |v|
 */
export const mag = (v: V3): number => Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);

/**
 * Squared magnitude: |v|²  (faster when comparison is sufficient)
 */
export const magSq = (v: V3): number => v[0] * v[0] + v[1] * v[1] + v[2] * v[2];

/**
 * Normalize: v̂ = v / |v|
 */
export const norm = (v: V3): V3 => {
  const m = mag(v);
  return m === 0 ? [0, 0, 0] : [v[0] / m, v[1] / m, v[2] / m];
};

/**
 * Linear interpolation: a + t(b - a)
 */
export const lerp = (a: V3, b: V3, t: number): V3 => [
  a[0] + t * (b[0] - a[0]),
  a[1] + t * (b[1] - a[1]),
  a[2] + t * (b[2] - a[2]),
];

/**
 * Distance between two points
 */
export const dist = (a: V3, b: V3): number => mag(sub(b, a));

/**
 * Squared distance (faster for comparisons)
 */
export const distSq = (a: V3, b: V3): number => magSq(sub(b, a));

/**
 * Negative of a vector: -v
 */
export const neg = (v: V3): V3 => [-v[0], -v[1], -v[2]];

/**
 * Vector absolute value: |v|_component
 */
export const abs = (v: V3): V3 => [Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2])];

// ============================================================================
// ADVANCED VECTOR OPERATIONS
// ============================================================================

/**
 * Reflect: r = v - 2(v · n)n
 * @param v Incident direction
 * @param n Surface normal (should be normalized)
 */
export const reflect = (v: V3, n: V3): V3 => {
  const d = 2 * dot(v, n);
  return [v[0] - d * n[0], v[1] - d * n[1], v[2] - d * n[2]];
};

/**
 * Refract with Snell's law: t = (n1/n2)v + ((n1/n2)cosθ - cosθ')n
 * @param v Incident direction (should be normalized)
 * @param n Surface normal (should be normalized)
 * @param eta Ratio of refractive indices (n1/n2)
 */
export const refract = (v: V3, n: V3, eta: number): V3 | null => {
  const c1 = -dot(v, n);
  const k = 1 - eta * eta * (1 - c1 * c1);
  if (k < 0) return null; // Total internal reflection
  const c2 = Math.sqrt(k);
  return add(scale(v, eta), scale(n, eta * c1 - c2));
};

/**
 * Clamp vector components: [min(max(x, lo), hi), ...]
 */
export const clamp = (v: V3, lo: V3, hi: V3): V3 => [
  Math.max(lo[0], Math.min(v[0], hi[0])),
  Math.max(lo[1], Math.min(v[1], hi[1])),
  Math.max(lo[2], Math.min(v[2], hi[2])),
];

/**
 * Component-wise minimum
 */
export const min = (a: V3, b: V3): V3 => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])];

/**
 * Component-wise maximum
 */
export const max = (a: V3, b: V3): V3 => [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])];

// ============================================================================
// RAY-TRIANGLE INTERSECTION (Möller-Trumbore)
// ============================================================================

/**
 * Ray-triangle intersection using Möller-Trumbore algorithm
 * One-sided (backface culling) by default; set twoSided=true for double-sided
 *
 * @param orig Ray origin
 * @param dir Ray direction (should be normalized for proper distance scaling)
 * @param a Triangle vertex A
 * @param b Triangle vertex B
 * @param c Triangle vertex C
 * @param twoSided If false (default), only hit front-facing triangles
 * @returns RayHit with t (distance), u,v (barycentric), or null if no hit
 */
export function rayTriMT(
  orig: V3,
  dir: V3,
  a: V3,
  b: V3,
  c: V3,
  twoSided = false
): RayHit | null {
  const eps = 1e-8;
  const ab = sub(b, a);
  const ac = sub(c, a);
  const p = cross(dir, ac);
  const det = dot(ab, p);

  // Backface culling by default; allow two-sided if requested
  if (!twoSided) {
    if (det < eps) return null;
  } else {
    if (Math.abs(det) < eps) return null;
  }

  // Use stricter denominator check for numerical stability
  if (Math.abs(det) < 1e-12) return null;
  const invDet = 1.0 / det;
  const tvec = sub(orig, a);
  const u = dot(tvec, p) * invDet;
  if (u < 0 || u > 1) return null;

  const q = cross(tvec, ab);
  const v = dot(dir, q) * invDet;
  if (v < 0 || u + v > 1) return null;

  const t = dot(ac, q) * invDet;
  if (t <= eps) return null; // behind or too close

  return { t, u, v };
}

/**
 * Ray-triangle intersection with surface normal computation
 * Includes computed intersection point and smooth normal
 */
export function rayTriMTWithNormal(
  orig: V3,
  dir: V3,
  a: V3,
  b: V3,
  c: V3,
  twoSided = false
): RayHit | null {
  const hit = rayTriMT(orig, dir, a, b, c, twoSided);
  if (!hit) return hit;

  // Compute intersection point
  hit.point = add(orig, scale(dir, hit.t));

  // Compute triangle normal (front-facing)
  const ab = sub(b, a);
  const ac = sub(c, a);
  hit.normal = norm(cross(ab, ac));

  // Compute barycentric w
  hit.w = 1 - hit.u - hit.v;

  return hit;
}

// ============================================================================
// RAY-SPHERE INTERSECTION
// ============================================================================

/**
 * Ray-sphere intersection
 * @param orig Ray origin
 * @param dir Ray direction (should be normalized)
 * @param center Sphere center
 * @param radius Sphere radius
 * @returns SphereHit (with normal and point computed) or null
 */
export function raySphere(orig: V3, dir: V3, center: V3, radius: number): SphereHit | null {
  const oc = sub(orig, center);
  const a = dot(dir, dir);
  const b = 2 * dot(oc, dir);
  const c = dot(oc, oc) - radius * radius;
  const disc = b * b - 4 * a * c;

  if (disc < 0) return null;

  const t = (-b - Math.sqrt(disc)) / (2 * a);
  if (t <= 1e-8) return null; // behind or too close

  const point = add(orig, scale(dir, t));
  const normal = norm(sub(point, center));

  return { t, u: 0, v: 0, w: 0, point, normal };
}

// ============================================================================
// BOUNDING BOXES
// ============================================================================

/**
 * Create AABB from min and max corners
 */
export const bbox = (min: V3, max: V3): BBox => ({ min, max });

/**
 * Expand AABB to contain a point
 */
export const expandBBox = (box: BBox, p: V3): BBox => ({
  min: min(box.min, p),
  max: max(box.max, p),
});

/**
 * AABB-AABB intersection test
 */
export const bboxIntersect = (a: BBox, b: BBox): boolean =>
  a.min[0] <= b.max[0] &&
  a.max[0] >= b.min[0] &&
  a.min[1] <= b.max[1] &&
  a.max[1] >= b.min[1] &&
  a.min[2] <= b.max[2] &&
  a.max[2] >= b.min[2];

/**
 * Ray-AABB intersection (slab method)
 */
export function rayBBox(orig: V3, dir: V3, box: BBox): [number, number] | null {
  const invDir: V3 = [1 / dir[0], 1 / dir[1], 1 / dir[2]];
  const min = box.min;
  const max = box.max;

  let tMin = (min[0] - orig[0]) * invDir[0];
  let tMax = (max[0] - orig[0]) * invDir[0];

  if (tMin > tMax) [tMin, tMax] = [tMax, tMin];

  let tyMin = (min[1] - orig[1]) * invDir[1];
  let tyMax = (max[1] - orig[1]) * invDir[1];

  if (tyMin > tyMax) [tyMin, tyMax] = [tyMax, tyMin];

  if (tMin > tyMax || tyMin > tMax) return null;

  tMin = Math.max(tMin, tyMin);
  tMax = Math.min(tMax, tyMax);

  let tzMin = (min[2] - orig[2]) * invDir[2];
  let tzMax = (max[2] - orig[2]) * invDir[2];

  if (tzMin > tzMax) [tzMin, tzMax] = [tzMax, tzMin];

  if (tMin > tzMax || tzMin > tMax) return null;

  tMin = Math.max(tMin, tzMin);
  tMax = Math.min(tMax, tzMax);

  return [tMin, tMax];
}

// ============================================================================
// GEOMETRY UTILITIES
// ============================================================================

/**
 * Compute barycentric coordinates (u, v, w) for point p in triangle abc
 * Useful for texture mapping, smooth shading, etc.
 */
export function barycentric(p: V3, a: V3, b: V3, c: V3): V3 {
  const ab = sub(b, a);
  const ac = sub(c, a);
  const ap = sub(p, a);

  const ab_ab = dot(ab, ab);
  const ab_ac = dot(ab, ac);
  const ac_ac = dot(ac, ac);
  const ap_ab = dot(ap, ab);
  const ap_ac = dot(ap, ac);

  const denom = ab_ab * ac_ac - ab_ac * ab_ac;
  if (Math.abs(denom) < 1e-10) return [0, 0, 1]; // degenerate

  const v = (ac_ac * ap_ab - ab_ac * ap_ac) / denom;
  const w = (ab_ab * ap_ac - ab_ac * ap_ab) / denom;
  const u = 1 - v - w;

  return [u, v, w];
}

/**
 * Interpolate vertex data using barycentric coordinates
 * @param data Array of 3 values at vertices [a, b, c]
 * @param bary Barycentric coordinates [u, v, w]
 */
export const baryInterpolate = (data: [number, number, number], bary: V3): number =>
  data[0] * bary[0] + data[1] * bary[1] + data[2] * bary[2];

/**
 * Interpolate vectors using barycentric coordinates
 */
export const baryInterpolateV3 = (data: [V3, V3, V3], bary: V3): V3 => [
  data[0][0] * bary[0] + data[1][0] * bary[1] + data[2][0] * bary[2],
  data[0][1] * bary[0] + data[1][1] * bary[1] + data[2][1] * bary[2],
  data[0][2] * bary[0] + data[1][2] * bary[1] + data[2][2] * bary[2],
];

/**
 * Triangle area (half the cross product magnitude)
 */
export const triArea = (a: V3, b: V3, c: V3): number => mag(cross(sub(b, a), sub(c, a))) * 0.5;

/**
 * Triangle centroid (average of vertices)
 */
export const triCentroid = (a: V3, b: V3, c: V3): V3 => scale(add(add(a, b), c), 1 / 3);

/**
 * Direction from a to b with optional clamping distance
 */
export const direction = (from: V3, to: V3, maxDist?: number): V3 => {
  const d = sub(to, from);
  const len = mag(d);
  if (len === 0) return [0, 0, 0];
  const normalized = [d[0] / len, d[1] / len, d[2] / len] as V3;
  return maxDist !== undefined && len > maxDist ? scale(normalized, maxDist) : d;
};

/**
 * Closest point on line segment AB to point P
 */
export const closestPointOnSegment = (p: V3, a: V3, b: V3): V3 => {
  const ab = sub(b, a);
  const ap = sub(p, a);
  const k = Math.max(0, Math.min(1, dot(ap, ab) / dot(ab, ab)));
  return add(a, scale(ab, k));
};

/**
 * Closest point on plane (defined by normal n and point p0) to point p
 */
export const closestPointOnPlane = (p: V3, n: V3, p0: V3): V3 => {
  const d = dot(sub(p, p0), n);
  return sub(p, scale(n, d));
};

// ============================================================================
// 2D OPERATIONS (bonus, for 2D geometry)
// ============================================================================

/**
 * 2D subtraction
 */
export const sub2 = (a: V2, b: V2): V2 => [a[0] - b[0], a[1] - b[1]];

/**
 * 2D dot product
 */
export const dot2 = (a: V2, b: V2) => a[0] * b[0] + a[1] * b[1];

/**
 * 2D cross product (returns scalar for 2D orientation)
 */
export const cross2 = (a: V2, b: V2) => a[0] * b[1] - a[1] * b[0];

/**
 * 2D point-in-triangle test (barycentric)
 */
export const pointInTriangle2 = (p: V2, a: V2, b: V2, c: V2): boolean => {
  const c0 = cross2(sub2(b, a), sub2(p, a));
  const c1 = cross2(sub2(c, b), sub2(p, b));
  const c2 = cross2(sub2(a, c), sub2(p, c));

  return (c0 >= 0 && c1 >= 0 && c2 >= 0) || (c0 <= 0 && c1 <= 0 && c2 <= 0);
};
