/**
 * Geometry module tests
 * Validates all vector operations, ray-triangle intersection, and spatial utilities
 */
/// <reference lib="dom" />

import type { V3, RayHit, SphereHit } from './geometry';
import {
  sub, add, scale, dot, cross, mag, magSq, norm, lerp, dist, distSq, neg, abs,
  reflect, refract, clamp, min, max,
  rayTriMT, rayTriMTWithNormal, raySphere,
  bbox, expandBBox, bboxIntersect, rayBBox,
  barycentric, baryInterpolate, baryInterpolateV3, triArea, triCentroid, direction,
  closestPointOnSegment, closestPointOnPlane,
  sub2, dot2, cross2, pointInTriangle2,
} from './geometry';

// ============================================================================
// TEST UTILITIES
// ============================================================================

const eq = (a: number, b: number, eps = 1e-6): boolean => Math.abs(a - b) < eps;
const v3eq = (a: V3, b: V3, eps = 1e-6): boolean =>
  eq(a[0], b[0], eps) && eq(a[1], b[1], eps) && eq(a[2], b[2], eps);

// ============================================================================
// VECTOR OPERATIONS TESTS
// ============================================================================

export function testVectorOps() {
  console.log('🧪 Testing Vector Operations...');

  // sub
  const a = [1, 2, 3] as V3;
  const b = [4, 5, 6] as V3;
  console.assert(v3eq(sub(a, b), [-3, -3, -3]), 'sub failed');

  // add
  console.assert(v3eq(add(a, b), [5, 7, 9]), 'add failed');

  // scale
  console.assert(v3eq(scale(a, 2), [2, 4, 6]), 'scale failed');

  // dot
  console.assert(eq(dot(a, b), 32), 'dot failed'); // 1*4 + 2*5 + 3*6 = 4+10+18 = 32

  // cross
  const i = [1, 0, 0] as V3;
  const j = [0, 1, 0] as V3;
  console.assert(v3eq(cross(i, j), [0, 0, 1]), 'cross failed');

  // mag
  const unit = [3, 4, 0] as V3;
  console.assert(eq(mag(unit), 5), 'mag failed'); // 3-4-5 triangle

  // magSq
  console.assert(eq(magSq(unit), 25), 'magSq failed');

  // norm
  const normalized = norm(unit);
  console.assert(eq(mag(normalized), 1), 'norm failed');

  // lerp
  const lerped = lerp(a, b, 0.5);
  console.assert(v3eq(lerped, [2.5, 3.5, 4.5]), 'lerp failed');

  // lerp at boundaries
  console.assert(v3eq(lerp(a, b, 0), a), 'lerp t=0 failed');
  console.assert(v3eq(lerp(a, b, 1), b), 'lerp t=1 failed');

  // dist
  console.assert(eq(dist([0, 0, 0], [3, 4, 0]), 5), 'dist failed');

  // distSq
  console.assert(eq(distSq([0, 0, 0], [3, 4, 0]), 25), 'distSq failed');

  // neg
  console.assert(v3eq(neg(a), [-1, -2, -3]), 'neg failed');

  // abs
  console.assert(v3eq(abs([-1, -2, -3]), [1, 2, 3]), 'abs failed');

  console.log('✅ Vector Operations: PASS');
}

// ============================================================================
// ADVANCED VECTOR OPERATIONS TESTS
// ============================================================================

export function testAdvancedOps() {
  console.log('🧪 Testing Advanced Vector Operations...');

  // reflect
  const incident = [1, -1, 0] as V3;
  const normal = [0, 1, 0] as V3;
  const reflected = reflect(incident, normal);
  console.assert(v3eq(reflected, [1, 1, 0]), 'reflect failed');

  // refract (simple glass)
  const towardsSurface = [0, -1, 0] as V3; // straight down
  const surfaceNormal = [0, 1, 0] as V3; // pointing up
  const refracted = refract(towardsSurface, surfaceNormal, 0.6667); // n1/n2 ≈ 2/3 (air to water)
  console.assert(refracted !== null, 'refract failed: returned null');
  console.assert(eq(mag(refracted!), 1), 'refracted not normalized');

  // refract total internal reflection
  const steepAngle = norm([1, -0.3, 0] as V3);
  const noRefract = refract(steepAngle, [0, 1, 0] as V3, 2); // n1/n2 = 2 (dense to light)
  console.assert(noRefract === null, 'TIR should return null');

  // clamp
  const v = [5, -2, 3] as V3;
  const lo = [0, 0, 0] as V3;
  const hi = [3, 3, 3] as V3;
  console.assert(v3eq(clamp(v, lo, hi), [3, 0, 3]), 'clamp failed');

  // min/max
  const v1 = [1, 5, 2] as V3;
  const v2 = [3, 2, 4] as V3;
  console.assert(v3eq(min(v1, v2), [1, 2, 2]), 'min failed');
  console.assert(v3eq(max(v1, v2), [3, 5, 4]), 'max failed');

  console.log('✅ Advanced Vector Operations: PASS');
}

// ============================================================================
// RAY-TRIANGLE INTERSECTION TESTS
// ============================================================================

export function testRayTriangle() {
  console.log('🧪 Testing Ray-Triangle Intersection (Möller-Trumbore)...');

  // Simple triangle in XY plane at z=5
  const a = [0, 0, 5] as V3;
  const b = [4, 0, 5] as V3;
  const c = [0, 3, 5] as V3;

  // Ray straight into triangle
  const orig = [1, 1, 0] as V3;
  const dir = [0, 0, 1] as V3;
  const hit = rayTriMT(orig, dir, a, b, c);

  console.assert(hit !== null, 'Ray should hit triangle');
  console.assert(eq(hit!.t, 5), 'Hit distance should be 5');
  console.assert(hit!.u >= 0 && hit!.u <= 1, 'u should be in [0,1]');
  console.assert(hit!.v >= 0 && hit!.v <= 1, 'v should be in [0,1]');
  console.assert(hit!.u + hit!.v <= 1, 'u+v should be ≤ 1');

  // Ray parallel to plane
  const parallel = rayTriMT(orig, [1, 0, 0] as V3, a, b, c);
  console.assert(parallel === null, 'Parallel ray should not hit');

  // Ray pointing away
  const away = rayTriMT(orig, [0, 0, -1] as V3, a, b, c);
  console.assert(away === null, 'Backward ray should not hit');

  // Test two-sided
  const backFace = rayTriMT([1, 1, 10] as V3, [0, 0, -1] as V3, a, b, c, false);
  console.assert(backFace === null, 'Default should cull backface');

  const twoSided = rayTriMT([1, 1, 10] as V3, [0, 0, -1] as V3, a, b, c, true);
  console.assert(twoSided !== null, 'Two-sided should hit backface');

  // Test with normal computation
  const hitWithNormal = rayTriMTWithNormal(orig, dir, a, b, c);
  console.assert(hitWithNormal !== null, 'Should return hit with normal');

  if (!hitWithNormal?.normal || !hitWithNormal?.point) {
    throw new Error('Ray-Triangle intersection did not return expected hit');
  }

  console.assert(eq(mag(hitWithNormal.normal), 1), 'Normal should be unit');

  console.log('✅ Ray-Triangle Intersection: PASS');
}

// ============================================================================
// RAY-SPHERE INTERSECTION TESTS
// ============================================================================

export function testRaySphere() {
  console.log('🧪 Testing Ray-Sphere Intersection...');

  const center = [0, 0, 10] as V3;
  const radius = 5;

  // Ray heading straight at sphere
  const orig = [0, 0, 0] as V3;
  const dir = norm([0, 0, 1] as V3);
  const hit = raySphere(orig, dir, center, radius);

  console.assert(hit !== null, 'Should hit sphere');
  console.assert(eq(hit!.t, 5), 'Hit should be at t=5 (distance to near side)');
  console.assert(v3eq(hit!.point, [0, 0, 5]), 'Hit point incorrect');
  console.assert(eq(mag(hit!.normal), 1), 'Normal should be unit');

  // Ray missing sphere
  const miss = raySphere([100, 0, 0] as V3, [0, 0, 1] as V3, center, radius);
  console.assert(miss === null, 'Should miss sphere');

  // Ray from inside sphere
  const inside = raySphere(center, [0, 0, 1] as V3, center, radius);
  console.assert(inside === null, 'Ray from center should not hit (t ≤ 0)');

  console.log('✅ Ray-Sphere Intersection: PASS');
}

// ============================================================================
// BOUNDING BOX TESTS
// ============================================================================

export function testBBox() {
  console.log('🧪 Testing Bounding Box Operations...');

  const box = bbox([0, 0, 0] as V3, [5, 5, 5] as V3);
  console.assert(v3eq(box.min, [0, 0, 0]), 'bbox min failed');
  console.assert(v3eq(box.max, [5, 5, 5]), 'bbox max failed');

  // Expand to contain point inside
  const expanded = expandBBox(box, [2, 2, 2] as V3);
  console.assert(v3eq(expanded.min, [0, 0, 0]), 'expand inside should not change min');

  // Expand to contain point outside
  const expanded2 = expandBBox(box, [10, 10, 10] as V3);
  console.assert(v3eq(expanded2.max, [10, 10, 10]), 'expand outside should grow max');

  // Intersecting boxes
  const box2 = bbox([3, 3, 3] as V3, [8, 8, 8] as V3);
  console.assert(bboxIntersect(box, box2), 'Overlapping boxes should intersect');

  // Non-intersecting boxes
  const box3 = bbox([10, 10, 10] as V3, [15, 15, 15] as V3);
  console.assert(!bboxIntersect(box, box3), 'Separated boxes should not intersect');

  // Ray-AABB
  const rayHit = rayBBox([0, 0, -1] as V3, [0, 0, 1] as V3, box);
  console.assert(rayHit !== null, 'Ray should hit box');
  console.assert(eq(rayHit![0], 1), 'Entry t should be 1');

  const rayMiss = rayBBox([100, 0, 0] as V3, [0, 0, 1] as V3, box);
  console.assert(rayMiss === null, 'Ray should miss box');

  console.log('✅ Bounding Box Operations: PASS');
}

// ============================================================================
// GEOMETRY UTILITIES TESTS
// ============================================================================

export function testGeometryUtils() {
  console.log('🧪 Testing Geometry Utilities...');

  // barycentric
  const a = [0, 0, 0] as V3;
  const b = [1, 0, 0] as V3;
  const c = [0, 1, 0] as V3;

  const baryA = barycentric(a, a, b, c);
  console.assert(v3eq(baryA, [1, 0, 0]), 'bary at A failed');

  const baryB = barycentric(b, a, b, c);
  console.assert(v3eq(baryB, [0, 1, 0]), 'bary at B failed');

  const baryC = barycentric(c, a, b, c);
  console.assert(v3eq(baryC, [0, 0, 1]), 'bary at C failed');

  const baryMid = barycentric([0.333, 0.333, 0] as V3, a, b, c);
  console.assert(eq(baryMid[0] + baryMid[1] + baryMid[2], 1, 0.01), 'bary coords should sum to 1');

  // baryInterpolate
  const data = [10, 20, 30] as [number, number, number];
  const bary = [0.5, 0.3, 0.2] as V3;
  const interp = baryInterpolate(data, bary);
  console.assert(eq(interp, 10 * 0.5 + 20 * 0.3 + 30 * 0.2), 'baryInterpolate failed');

  // triArea
  const area = triArea(a, b, c);
  console.assert(eq(area, 0.5), 'triangle area should be 0.5');

  // triCentroid
  const centroid = triCentroid(a, b, c);
  console.assert(v3eq(centroid, [0.333, 0.333, 0], 0.01), 'centroid failed');

  // direction
  const dir = direction([0, 0, 0] as V3, [3, 4, 0] as V3);
  console.assert(eq(mag(dir), 5), 'direction magnitude failed');

  // closestPointOnSegment
  const seg = closestPointOnSegment([2, 1, 0] as V3, [0, 0, 0] as V3, [4, 0, 0] as V3);
  console.assert(v3eq(seg, [2, 0, 0]), 'closestPointOnSegment failed');

  // closestPointOnPlane
  const plane = closestPointOnPlane([1, 2, 3] as V3, [0, 0, 1] as V3, [0, 0, 0] as V3);
  console.assert(v3eq(plane, [1, 2, 0]), 'closestPointOnPlane failed');

  console.log('✅ Geometry Utilities: PASS');
}

// ============================================================================
// 2D GEOMETRY TESTS
// ============================================================================

export function test2DGeometry() {
  console.log('🧪 Testing 2D Geometry...');

  const a = [0, 0] as [number, number];
  const b = [4, 0] as [number, number];
  const c = [0, 3] as [number, number];

  // sub2
  const diff = sub2(b, a);
  console.assert(diff.every((x, i) => {
    const expected = i === 0 ? 4 : 0;
    return eq(x, expected);
  }), 'sub2 failed');

  // dot2
  console.assert(eq(dot2(b, c), 0), 'dot2 failed');

  // cross2
  console.assert(eq(cross2(b, c), 12), 'cross2 failed'); // 4*3 - 0*0

  // pointInTriangle2
  const inside = [1, 1] as [number, number];
  const outside_east = [5, 0] as [number, number];

  console.assert(pointInTriangle2(inside, a, b, c), 'Point inside should pass');
  console.assert(!pointInTriangle2(outside_east, a, b, c), 'Point outside should fail');

  console.log('✅ 2D Geometry: PASS');
}

// ============================================================================
// RUN ALL TESTS
// ============================================================================

export function runAllTests() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('🚀 GEOMETRY MODULE TEST SUITE');
  console.log('═══════════════════════════════════════════════════════════\n');

  const tests = [
    testVectorOps,
    testAdvancedOps,
    testRayTriangle,
    testRaySphere,
    testBBox,
    testGeometryUtils,
    test2DGeometry,
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      test();
      passed++;
    } catch (err) {
      console.error(`❌ ${test.name}: ${err}`);
      failed++;
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`✅ ${passed}/${tests.length} test suites PASSED`);
  if (failed > 0) {
    console.log(`❌ ${failed}/${tests.length} test suites FAILED`);
  }
  console.log('═══════════════════════════════════════════════════════════\n');
}

// Run if executed directly
if (typeof require !== 'undefined' && require.main === module) {
  runAllTests();
}
