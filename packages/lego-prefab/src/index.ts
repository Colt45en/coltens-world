export const LDU = {
  MM_PER_LDU: 0.4,
  STUD_PITCH: 20,
  PLATE_H: 8,
  BRICK_H: 24,
  STUD_D: 12,
  STUD_R: 6,
  STUD_H: 4,
  TUBE_OUTER_D: 14,
  TUBE_OUTER_R: 7,
  TUBE_INNER_D: 10,
  TUBE_INNER_R: 5,
  TECHNIC_HOLE_D: 12,
  TECHNIC_HOLE_R: 6,
  HALF_STUD: 10,
  HALF_PLATE: 4,
} as const;

export function lduToMm(ldu: number): number {
  return ldu * LDU.MM_PER_LDU;
}

export type Vec3 = { x: number; y: number; z: number };
export type Mat4 = number[];
export type Tri = { a: Vec3; b: Vec3; c: Vec3; n?: Vec3 };
export type Mesh = { tris: Tri[] };

export function v3(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

function subtract(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function normalize(vector: Vec3): Vec3 {
  const magnitude = Math.hypot(vector.x, vector.y, vector.z);
  if (magnitude === 0) return { x: 0, y: 0, z: 0 };
  return { x: vector.x / magnitude, y: vector.y / magnitude, z: vector.z / magnitude };
}

function pushTriangle(out: Mesh, a: Vec3, b: Vec3, c: Vec3): void {
  const tri: Tri = { a, b, c };
  tri.n = computeNormal(tri);
  out.tris.push(tri);
}

export function computeNormal(triangle: Tri): Vec3 {
  const ab = subtract(triangle.b, triangle.a);
  const ac = subtract(triangle.c, triangle.a);
  return normalize(cross(ab, ac));
}

export function mesh(): Mesh {
  return { tris: [] };
}

export function mergeMeshes(...meshes: Mesh[]): Mesh {
  const out = mesh();
  for (const oneMesh of meshes) out.tris.push(...oneMesh.tris);
  return out;
}

export function m4Identity(): Mat4 {
  return [1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1];
}

export function m4Mul(a: Mat4, b: Mat4): Mat4 {
  const result = new Array<number>(16).fill(0);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += (a[k * 4 + row] ?? 0) * (b[col * 4 + k] ?? 0);
      }
      result[col * 4 + row] = sum;
    }
  }
  return result;
}

export function m4Translate(tx: number, ty: number, tz: number): Mat4 {
  return [1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    tx, ty, tz, 1];
}

export function m4RotateX(radians: number): Mat4 {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [1, 0, 0, 0,
    0, cosine, sine, 0,
    0, -sine, cosine, 0,
    0, 0, 0, 1];
}

export function m4RotateY(radians: number): Mat4 {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [cosine, 0, -sine, 0,
    0, 1, 0, 0,
    sine, 0, cosine, 0,
    0, 0, 0, 1];
}

export function m4RotateZ(radians: number): Mat4 {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [cosine, sine, 0, 0,
    -sine, cosine, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1];
}

export function m4Scale(sx: number, sy: number, sz: number): Mat4 {
  return [sx, 0, 0, 0,
    0, sy, 0, 0,
    0, 0, sz, 0,
    0, 0, 0, 1];
}

export function transformPoint(matrix: Mat4, point: Vec3): Vec3 {
  return {
    x: (matrix[0] ?? 0) * point.x + (matrix[4] ?? 0) * point.y + (matrix[8] ?? 0) * point.z + (matrix[12] ?? 0),
    y: (matrix[1] ?? 0) * point.x + (matrix[5] ?? 0) * point.y + (matrix[9] ?? 0) * point.z + (matrix[13] ?? 0),
    z: (matrix[2] ?? 0) * point.x + (matrix[6] ?? 0) * point.y + (matrix[10] ?? 0) * point.z + (matrix[14] ?? 0),
  };
}

export function transformMesh(inputMesh: Mesh, matrix: Mat4): Mesh {
  const out = mesh();
  for (const triangle of inputMesh.tris) {
    const transformed: Tri = {
      a: transformPoint(matrix, triangle.a),
      b: transformPoint(matrix, triangle.b),
      c: transformPoint(matrix, triangle.c),
    };
    transformed.n = computeNormal(transformed);
    out.tris.push(transformed);
  }
  return out;
}

export function box(sizeX: number, sizeY: number, sizeZ: number): Mesh {
  const halfX = sizeX / 2;
  const halfY = sizeY / 2;
  const halfZ = sizeZ / 2;

  const p = {
    nnn: v3(-halfX, -halfY, -halfZ),
    nnp: v3(-halfX, -halfY, halfZ),
    npn: v3(-halfX, halfY, -halfZ),
    npp: v3(-halfX, halfY, halfZ),
    pnn: v3(halfX, -halfY, -halfZ),
    pnp: v3(halfX, -halfY, halfZ),
    ppn: v3(halfX, halfY, -halfZ),
    ppp: v3(halfX, halfY, halfZ),
  };

  const faces: [Vec3, Vec3, Vec3, Vec3][] = [
    [p.pnn, p.ppn, p.ppp, p.pnp],
    [p.nnn, p.nnp, p.npp, p.npn],
    [p.npn, p.npp, p.ppp, p.ppn],
    [p.nnn, p.pnn, p.pnp, p.nnp],
    [p.nnp, p.pnp, p.ppp, p.npp],
    [p.nnn, p.npn, p.ppn, p.pnn],
  ];

  const out = mesh();
  for (const [a, b, c, d] of faces) {
    const t1: Tri = { a, b, c };
    const t2: Tri = { a, b: c, c: d };
    t1.n = computeNormal(t1);
    t2.n = computeNormal(t2);
    out.tris.push(t1, t2);
  }
  return out;
}

export function cylinder(radius: number, height: number, segments = 32, cap = true): Mesh {
  const out = mesh();
  const halfHeight = height / 2;

  for (let segmentIndex = 0; segmentIndex < segments; segmentIndex++) {
    const theta0 = (segmentIndex / segments) * Math.PI * 2;
    const theta1 = ((segmentIndex + 1) / segments) * Math.PI * 2;
    const x0 = Math.cos(theta0) * radius;
    const y0 = Math.sin(theta0) * radius;
    const x1 = Math.cos(theta1) * radius;
    const y1 = Math.sin(theta1) * radius;

    const p0b = v3(x0, y0, -halfHeight);
    const p1b = v3(x1, y1, -halfHeight);
    const p1t = v3(x1, y1, halfHeight);
    const p0t = v3(x0, y0, halfHeight);

    const sideA: Tri = { a: p0b, b: p1b, c: p1t };
    const sideB: Tri = { a: p0b, b: p1t, c: p0t };
    sideA.n = computeNormal(sideA);
    sideB.n = computeNormal(sideB);
    out.tris.push(sideA, sideB);
  }

  if (cap) {
    const topCenter = v3(0, 0, halfHeight);
    const bottomCenter = v3(0, 0, -halfHeight);

    for (let segmentIndex = 0; segmentIndex < segments; segmentIndex++) {
      const theta0 = (segmentIndex / segments) * Math.PI * 2;
      const theta1 = ((segmentIndex + 1) / segments) * Math.PI * 2;

      const p0 = v3(Math.cos(theta0) * radius, Math.sin(theta0) * radius, halfHeight);
      const p1 = v3(Math.cos(theta1) * radius, Math.sin(theta1) * radius, halfHeight);
      const q0 = v3(Math.cos(theta0) * radius, Math.sin(theta0) * radius, -halfHeight);
      const q1 = v3(Math.cos(theta1) * radius, Math.sin(theta1) * radius, -halfHeight);

      const topTri: Tri = { a: topCenter, b: p0, c: p1 };
      const bottomTri: Tri = { a: bottomCenter, b: q1, c: q0 };
      topTri.n = computeNormal(topTri);
      bottomTri.n = computeNormal(bottomTri);
      out.tris.push(topTri, bottomTri);
    }
  }

  return out;
}

export function tube(radiusOuter: number, radiusInner: number, height: number, segments = 32): Mesh {
  const out = mesh();
  const halfHeight = height / 2;

  for (let segmentIndex = 0; segmentIndex < segments; segmentIndex++) {
    const theta0 = (segmentIndex / segments) * Math.PI * 2;
    const theta1 = ((segmentIndex + 1) / segments) * Math.PI * 2;

    const c0 = Math.cos(theta0);
    const s0 = Math.sin(theta0);
    const c1 = Math.cos(theta1);
    const s1 = Math.sin(theta1);

    const o0b = v3(c0 * radiusOuter, s0 * radiusOuter, -halfHeight);
    const o1b = v3(c1 * radiusOuter, s1 * radiusOuter, -halfHeight);
    const o1t = v3(c1 * radiusOuter, s1 * radiusOuter, halfHeight);
    const o0t = v3(c0 * radiusOuter, s0 * radiusOuter, halfHeight);

    const i0b = v3(c0 * radiusInner, s0 * radiusInner, -halfHeight);
    const i1b = v3(c1 * radiusInner, s1 * radiusInner, -halfHeight);
    const i1t = v3(c1 * radiusInner, s1 * radiusInner, halfHeight);
    const i0t = v3(c0 * radiusInner, s0 * radiusInner, halfHeight);

    const tris: Tri[] = [
      { a: o0b, b: o1b, c: o1t },
      { a: o0b, b: o1t, c: o0t },
      { a: i0b, b: i1t, c: i1b },
      { a: i0b, b: i0t, c: i1t },
      { a: o0t, b: o1t, c: i1t },
      { a: o0t, b: i1t, c: i0t },
      { a: o0b, b: i1b, c: o1b },
      { a: o0b, b: i0b, c: i1b },
    ];

    for (const tri of tris) {
      tri.n = computeNormal(tri);
      out.tris.push(tri);
    }
  }

  return out;
}

export function studCenter(studI: number, studJ: number, studsX: number, studsY: number): Vec3 {
  const x = (-studsX / 2 + 0.5 + studI) * LDU.STUD_PITCH;
  const y = (-studsY / 2 + 0.5 + studJ) * LDU.STUD_PITCH;
  return v3(x, y, 0);
}

export type SystemPieceOpts = {
  studsX: number;
  studsY: number;
  platesH: number;
  withStuds?: boolean;
  withTubes?: boolean;
};

export function systemRect(opts: SystemPieceOpts): Mesh {
  const sizeX = opts.studsX * LDU.STUD_PITCH;
  const sizeY = opts.studsY * LDU.STUD_PITCH;
  const sizeZ = opts.platesH * LDU.PLATE_H;
  const withStuds = opts.withStuds ?? true;
  const withTubes = opts.withTubes ?? opts.platesH >= 3;

  const parts: Mesh[] = [box(sizeX, sizeY, sizeZ)];

  if (withStuds) {
    for (let studJ = 0; studJ < opts.studsY; studJ++) {
      for (let studI = 0; studI < opts.studsX; studI++) {
        const center = studCenter(studI, studJ, opts.studsX, opts.studsY);
        const stud = cylinder(LDU.STUD_R, LDU.STUD_H, 32, true);
        parts.push(transformMesh(stud, m4Translate(center.x, center.y, sizeZ / 2 + LDU.STUD_H / 2)));
      }
    }
  }

  if (withTubes && opts.studsX >= 2 && opts.studsY >= 2) {
    for (let row = 0; row < opts.studsY - 1; row++) {
      for (let col = 0; col < opts.studsX - 1; col++) {
        const x = (-opts.studsX / 2 + 1 + col) * LDU.STUD_PITCH;
        const y = (-opts.studsY / 2 + 1 + row) * LDU.STUD_PITCH;
        const undersideTube = tube(LDU.TUBE_OUTER_R, LDU.TUBE_INNER_R, LDU.STUD_H, 32);
        parts.push(transformMesh(undersideTube, m4Translate(x, y, -sizeZ / 2 + LDU.STUD_H / 2)));
      }
    }
  }

  return mergeMeshes(...parts);
}

export function wedgeSlope(sizeX: number, sizeY: number, sizeZ: number, lowAtNegX = true): Mesh {
  const halfX = sizeX / 2;
  const halfY = sizeY / 2;
  const halfZ = sizeZ / 2;
  const b0 = v3(-halfX, -halfY, -halfZ);
  const b1 = v3(halfX, -halfY, -halfZ);
  const b2 = v3(halfX, halfY, -halfZ);
  const b3 = v3(-halfX, halfY, -halfZ);
  const lowZ = -halfZ;
  const highZ = halfZ;
  const t0 = v3(-halfX, -halfY, lowAtNegX ? lowZ : highZ);
  const t3 = v3(-halfX, halfY, lowAtNegX ? lowZ : highZ);
  const t1 = v3(halfX, -halfY, lowAtNegX ? highZ : lowZ);
  const t2 = v3(halfX, halfY, lowAtNegX ? highZ : lowZ);

  const out = mesh();

  pushTriangle(out, b0, b2, b1); pushTriangle(out, b0, b3, b2);
  pushTriangle(out, b0, b1, t1); pushTriangle(out, b0, t1, t0);
  pushTriangle(out, b3, t2, b2); pushTriangle(out, b3, t3, t2);
  pushTriangle(out, b0, t0, t3); pushTriangle(out, b0, t3, b3);
  pushTriangle(out, b1, b2, t2); pushTriangle(out, b1, t2, t1);
  pushTriangle(out, t0, t1, t2); pushTriangle(out, t0, t2, t3);

  return out;
}

export function systemSlope(opts: {
  studsX: number;
  studsY: number;
  platesH: number;
  lowAtNegX?: boolean;
  withStuds?: boolean;
}): Mesh {
  const sizeX = opts.studsX * LDU.STUD_PITCH;
  const sizeY = opts.studsY * LDU.STUD_PITCH;
  const sizeZ = opts.platesH * LDU.PLATE_H;
  const withStuds = opts.withStuds ?? true;

  const parts: Mesh[] = [wedgeSlope(sizeX, sizeY, sizeZ, opts.lowAtNegX ?? true)];

  if (withStuds) {
    for (let studJ = 0; studJ < opts.studsY; studJ++) {
      for (let studI = 0; studI < opts.studsX; studI++) {
        const center = studCenter(studI, studJ, opts.studsX, opts.studsY);
        const t = (center.x + sizeX / 2) / sizeX;
        const topZ = (opts.lowAtNegX ?? true) ? (-sizeZ / 2 + sizeZ * t) : (sizeZ / 2 - sizeZ * t);
        const stud = cylinder(LDU.STUD_R, LDU.STUD_H, 32, true);
        parts.push(transformMesh(stud, m4Translate(center.x, center.y, topZ + LDU.STUD_H / 2)));
      }
    }
  }

  return mergeMeshes(...parts);
}

export function arcBand(
  innerR: number,
  outerR: number,
  height: number,
  theta0: number,
  theta1: number,
  segments = 48,
): Mesh {
  const out = mesh();
  const halfHeight = height / 2;

  for (let segmentIndex = 0; segmentIndex < segments; segmentIndex++) {
    const ratio0 = segmentIndex / segments;
    const ratio1 = (segmentIndex + 1) / segments;
    const angle0 = theta0 + (theta1 - theta0) * ratio0;
    const angle1 = theta0 + (theta1 - theta0) * ratio1;

    const o0b = v3(Math.cos(angle0) * outerR, Math.sin(angle0) * outerR, -halfHeight);
    const o1b = v3(Math.cos(angle1) * outerR, Math.sin(angle1) * outerR, -halfHeight);
    const o1t = v3(Math.cos(angle1) * outerR, Math.sin(angle1) * outerR, halfHeight);
    const o0t = v3(Math.cos(angle0) * outerR, Math.sin(angle0) * outerR, halfHeight);

    const i0b = v3(Math.cos(angle0) * innerR, Math.sin(angle0) * innerR, -halfHeight);
    const i1b = v3(Math.cos(angle1) * innerR, Math.sin(angle1) * innerR, -halfHeight);
    const i1t = v3(Math.cos(angle1) * innerR, Math.sin(angle1) * innerR, halfHeight);
    const i0t = v3(Math.cos(angle0) * innerR, Math.sin(angle0) * innerR, halfHeight);

    pushTriangle(out, o0b, o1b, o1t); pushTriangle(out, o0b, o1t, o0t);
    pushTriangle(out, i0b, i1t, i1b); pushTriangle(out, i0b, i0t, i1t);
    pushTriangle(out, o0t, o1t, i1t); pushTriangle(out, o0t, i1t, i0t);
    pushTriangle(out, o0b, i1b, o1b); pushTriangle(out, o0b, i0b, i1b);
  }

  return out;
}

export function systemArcTile(opts: {
  innerStudRadius: number;
  thicknessStuds: number;
  platesH: number;
  startDeg: number;
  endDeg: number;
}): Mesh {
  return arcBand(
    opts.innerStudRadius * LDU.STUD_PITCH,
    (opts.innerStudRadius + opts.thicknessStuds) * LDU.STUD_PITCH,
    opts.platesH * LDU.PLATE_H,
    (opts.startDeg * Math.PI) / 180,
    (opts.endDeg * Math.PI) / 180,
    72,
  );
}

export function technicBeam(opts: {
  holes: number;
  thickness: number;
  height: number;
  withHoles?: boolean;
}): Mesh {
  const pitch = LDU.STUD_PITCH;
  const length = opts.holes * pitch;
  const base = box(length, opts.thickness, opts.height);
  if (opts.withHoles === false) return base;

  const parts: Mesh[] = [base];
  for (let index = 0; index < opts.holes; index++) {
    const x = (-(opts.holes - 1) / 2 + index) * pitch;
    const hole = tube(LDU.TECHNIC_HOLE_R, LDU.TECHNIC_HOLE_R - 2, opts.thickness, 48);
    parts.push(transformMesh(hole, m4Mul(m4Translate(x, 0, 0), m4RotateX(Math.PI / 2))));
  }
  return mergeMeshes(...parts);
}

export function snotTransform(opts: {
  rotateXDeg?: number;
  rotateYDeg?: number;
  rotateZDeg?: number;
  translateLdu?: Vec3;
}): Mat4 {
  const x = ((opts.rotateXDeg ?? 0) * Math.PI) / 180;
  const y = ((opts.rotateYDeg ?? 0) * Math.PI) / 180;
  const z = ((opts.rotateZDeg ?? 0) * Math.PI) / 180;
  const translate = opts.translateLdu ?? v3(0, 0, 0);
  return m4Mul(m4Translate(translate.x, translate.y, translate.z), m4Mul(m4RotateZ(z), m4Mul(m4RotateY(y), m4RotateX(x))));
}

export function hingeTransform(opts: {
  pivot: Vec3;
  axis: "x" | "y" | "z";
  angleDeg: number;
}): Mat4 {
  const angle = (opts.angleDeg * Math.PI) / 180;
  let rotation: Mat4;
  switch (opts.axis) {
    case "x":
      rotation = m4RotateX(angle);
      break;
    case "y":
      rotation = m4RotateY(angle);
      break;
    default:
      rotation = m4RotateZ(angle);
      break;
  }
  return m4Mul(m4Translate(opts.pivot.x, opts.pivot.y, opts.pivot.z), m4Mul(rotation, m4Translate(-opts.pivot.x, -opts.pivot.y, -opts.pivot.z)));
}

export function meshToOBJ(inputMesh: Mesh, opts?: { name?: string; scaleMm?: boolean }): string {
  const name = opts?.name ?? "mesh";
  const scaleMm = opts?.scaleMm ?? false;
  const lines: string[] = [`# ${name}`, `o ${name}`];

  for (const triangle of inputMesh.tris) {
    const n = triangle.n ?? computeNormal(triangle);
    lines.push(`vn ${n.x.toFixed(6)} ${n.y.toFixed(6)} ${n.z.toFixed(6)}`);
  }

  let vertexCount = 0;
  const emitVertex = (point: Vec3): number => {
    const x = scaleMm ? lduToMm(point.x) : point.x;
    const y = scaleMm ? lduToMm(point.y) : point.y;
    const z = scaleMm ? lduToMm(point.z) : point.z;
    lines.push(`v ${x.toFixed(6)} ${y.toFixed(6)} ${z.toFixed(6)}`);
    vertexCount++;
    return vertexCount;
  };

  let triIndex = 0;
  for (const triangle of inputMesh.tris) {
    const i0 = emitVertex(triangle.a);
    const i1 = emitVertex(triangle.b);
    const i2 = emitVertex(triangle.c);
    const normalIndex = triIndex + 1;
    lines.push(`f ${i0}//${normalIndex} ${i1}//${normalIndex} ${i2}//${normalIndex}`);
    triIndex++;
  }

  return `${lines.join("\n")}\n`;
}

export function systemRound(opts: {
  diameterStuds: number;
  platesH: number;
  studsPattern?: "none" | "center" | "grid";
  underside?: "none" | "tube" | "ring";
  segments?: number;
}): Mesh {
  const diameterStuds = opts.diameterStuds;
  const height = opts.platesH * LDU.PLATE_H;
  const radiusOuter = (diameterStuds * LDU.STUD_PITCH) / 2;
  const segments = opts.segments ?? 72;
  const studsPattern = opts.studsPattern ?? (diameterStuds === 1 ? "center" : "grid");
  const underside = opts.underside ?? (opts.platesH >= 3 ? "tube" : "none");

  const parts: Mesh[] = [cylinder(radiusOuter, height, segments, true)];

  if (studsPattern === "center") {
    parts.push(transformMesh(cylinder(LDU.STUD_R, LDU.STUD_H, 32, true), m4Translate(0, 0, height / 2 + LDU.STUD_H / 2)));
  } else if (studsPattern === "grid") {
    const stud = cylinder(LDU.STUD_R, LDU.STUD_H, 32, true);
    for (let row = 0; row < diameterStuds; row++) {
      for (let col = 0; col < diameterStuds; col++) {
        const x = (-diameterStuds / 2 + 0.5 + col) * LDU.STUD_PITCH;
        const y = (-diameterStuds / 2 + 0.5 + row) * LDU.STUD_PITCH;
        if (Math.hypot(x, y) <= radiusOuter - LDU.STUD_R) {
          parts.push(transformMesh(stud, m4Translate(x, y, height / 2 + LDU.STUD_H / 2)));
        }
      }
    }
  }

  if (underside === "tube") {
    parts.push(transformMesh(tube(LDU.TUBE_OUTER_R, LDU.TUBE_INNER_R, LDU.STUD_H, 48), m4Translate(0, 0, -height / 2 + LDU.STUD_H / 2)));
  } else if (underside === "ring") {
    const ringOuter = Math.max(radiusOuter - 2, LDU.TUBE_OUTER_R + 2);
    const ringInner = ringOuter - 4;
    parts.push(transformMesh(tube(ringOuter, ringInner, LDU.STUD_H, 96), m4Translate(0, 0, -height / 2 + LDU.STUD_H / 2)));
  }

  return mergeMeshes(...parts);
}

export function systemArch(opts: {
  widthStuds: number;
  depthStuds: number;
  heightPlates: number;
  openingWidthStuds: number;
  openingBasePlates: number;
  wallLdu?: number;
  segments?: number;
  withStuds?: boolean;
}): Mesh {
  const width = opts.widthStuds * LDU.STUD_PITCH;
  const depth = opts.depthStuds * LDU.STUD_PITCH;
  const height = opts.heightPlates * LDU.PLATE_H;
  const openingWidth = opts.openingWidthStuds * LDU.STUD_PITCH;
  const openingBaseHeight = opts.openingBasePlates * LDU.PLATE_H;
  const wall = opts.wallLdu ?? 4;
  const segments = opts.segments ?? 48;

  const frame = box(width, depth, height);
  const archBandMesh = arcBand(openingWidth / 2, openingWidth / 2 + wall, depth, 0, Math.PI, segments);
  const springY = -height / 2 + wall + openingBaseHeight;

  const archRot = m4RotateX(Math.PI / 2);
  const archPos = m4Translate(0, springY, 0);

  const sideLeft = box(wall, depth, openingBaseHeight + wall);
  const sideRight = box(wall, depth, openingBaseHeight + wall);
  const sideY = -height / 2 + (openingBaseHeight + wall) / 2;
  const sideX = openingWidth / 2 + wall / 2;

  const parts: Mesh[] = [
    frame,
    transformMesh(archBandMesh, m4Mul(archPos, archRot)),
    transformMesh(sideLeft, m4Translate(-sideX, 0, sideY)),
    transformMesh(sideRight, m4Translate(sideX, 0, sideY)),
  ];

  if (opts.withStuds ?? true) {
    const stud = cylinder(LDU.STUD_R, LDU.STUD_H, 32, true);
    for (let row = 0; row < opts.depthStuds; row++) {
      for (let col = 0; col < opts.widthStuds; col++) {
        const x = (-opts.widthStuds / 2 + 0.5 + col) * LDU.STUD_PITCH;
        const y = (-opts.depthStuds / 2 + 0.5 + row) * LDU.STUD_PITCH;
        parts.push(transformMesh(stud, m4Translate(x, y, height / 2 + LDU.STUD_H / 2)));
      }
    }
  }

  return mergeMeshes(...parts);
}

export type Vec2 = { x: number; y: number };
export function v2(x: number, y: number): Vec2 { return { x, y }; }

function polygonArea(poly: Vec2[]): number {
  let area = 0;
  for (let index = 0; index < poly.length; index++) {
    const p = poly[index]!;
    const q = poly[(index + 1) % poly.length]!;
    area += p.x * q.y - q.x * p.y;
  }
  return area / 2;
}

function ensureCCW(poly: Vec2[]): Vec2[] {
  return polygonArea(poly) >= 0 ? poly : [...poly].reverse();
}

function triangulateConvex(poly: Vec2[]): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let index = 1; index < poly.length - 1; index++) out.push([0, index, index + 1]);
  return out;
}

export function extrudePolygon(polyInput: Vec2[], height: number): Mesh {
  const poly = ensureCCW(polyInput);
  const halfHeight = height / 2;
  const out = mesh();
  const tris = triangulateConvex(poly);

  const top = poly.map((point) => v3(point.x, point.y, halfHeight));
  const bottom = poly.map((point) => v3(point.x, point.y, -halfHeight));

  for (const [i0, i1, i2] of tris) pushTriangle(out, top[i0]!, top[i1]!, top[i2]!);
  for (const [i0, i1, i2] of tris) pushTriangle(out, bottom[i0]!, bottom[i2]!, bottom[i1]!);

  for (let index = 0; index < poly.length; index++) {
    const next = (index + 1) % poly.length;
    pushTriangle(out, bottom[index]!, bottom[next]!, top[next]!);
    pushTriangle(out, bottom[index]!, top[next]!, top[index]!);
  }

  return out;
}

export function technicAxleProfileMesh(opts?: {
  lengthLdu?: number;
  acrossTips?: number;
  armThick?: number;
}): Mesh {
  const length = opts?.lengthLdu ?? LDU.STUD_PITCH * 4;
  const across = opts?.acrossTips ?? LDU.TECHNIC_HOLE_D;
  const armThick = opts?.armThick ?? 6;

  const halfAcross = across / 2;
  const halfArm = armThick / 2;

  const profile: Vec2[] = [
    v2(halfArm, halfAcross),
    v2(-halfArm, halfAcross),
    v2(-halfArm, halfArm),
    v2(-halfAcross, halfArm),
    v2(-halfAcross, -halfArm),
    v2(-halfArm, -halfArm),
    v2(-halfArm, -halfAcross),
    v2(halfArm, -halfAcross),
    v2(halfArm, -halfArm),
    v2(halfAcross, -halfArm),
    v2(halfAcross, halfArm),
    v2(halfArm, halfArm),
  ];

  const raw = extrudePolygon(profile, length);
  return transformMesh(raw, m4RotateX(-Math.PI / 2));
}

export function axleLengthL(nL: number): number {
  return nL * LDU.STUD_PITCH;
}

export function technicAxleMesh(opts: { nL: number; acrossTips?: number; armThick?: number }): Mesh {
  return technicAxleProfileMesh({
    lengthLdu: axleLengthL(opts.nL),
    ...(opts.acrossTips !== undefined && { acrossTips: opts.acrossTips }),
    ...(opts.armThick !== undefined && { armThick: opts.armThick }),
  });
}

export function hingePlateLeaf(opts: {
  studsX: number;
  studsY: number;
  platesH?: number;
  knuckles: number;
  leaf: "A" | "B";
  barrelOuterR?: number;
  barrelInnerR?: number;
  barrelLenLdu?: number;
  hingeEdge?: "posX" | "negX";
  withStuds?: boolean;
}): Mesh {
  const platesH = opts.platesH ?? 1;
  const base = systemRect({
    studsX: opts.studsX,
    studsY: opts.studsY,
    platesH,
    withStuds: opts.withStuds ?? true,
    withTubes: false,
  });

  const sizeX = opts.studsX * LDU.STUD_PITCH;
  const sizeY = opts.studsY * LDU.STUD_PITCH;
  const hingeEdge = opts.hingeEdge ?? "posX";
  const edgeX = hingeEdge === "posX" ? sizeX / 2 : -sizeX / 2;
  const outerR = opts.barrelOuterR ?? 6;
  const innerR = opts.barrelInnerR ?? 4;
  const knuckleLen = opts.barrelLenLdu ?? sizeY / opts.knuckles;
  const gap = 1;
  const usableY = sizeY - gap * (opts.knuckles - 1);
  const segmentLen = usableY / opts.knuckles;

  const parts: Mesh[] = [base];
  const knuckleMesh = transformMesh(tube(outerR, innerR, knuckleLen, 48), m4RotateX(Math.PI / 2));

  for (let idx = 0; idx < opts.knuckles; idx++) {
    const isEven = idx % 2 === 0;
    if ((opts.leaf === "A" && !isEven) || (opts.leaf === "B" && isEven)) continue;

    const centerY = -sizeY / 2 + segmentLen / 2 + idx * (segmentLen + gap);
    const x = edgeX + (hingeEdge === "posX" ? outerR : -outerR);
    parts.push(transformMesh(knuckleMesh, m4Translate(x, centerY, 0)));
  }

  return mergeMeshes(...parts);
}

export function hingePlateAssembly(opts: {
  studsX: number;
  studsY: number;
  platesH?: number;
  knuckles?: number;
  hingeEdge?: "posX" | "negX";
  withStuds?: boolean;
  withPin?: boolean;
  pinR?: number;
}): Mesh {
  const knuckles = opts.knuckles ?? 5;
  const hingeEdge = opts.hingeEdge ?? "posX";
  const leafA = hingePlateLeaf({
    studsX: opts.studsX,
    studsY: opts.studsY,
    ...(opts.platesH !== undefined && { platesH: opts.platesH }),
    knuckles,
    leaf: "A",
    hingeEdge,
    ...(opts.withStuds !== undefined && { withStuds: opts.withStuds }),
  });

  const sizeX = opts.studsX * LDU.STUD_PITCH;
  const leafB = transformMesh(leafA, m4Mul(m4Translate(hingeEdge === "posX" ? sizeX : -sizeX, 0, 0), m4Scale(-1, 1, 1)));
  const parts: Mesh[] = [leafA, leafB];

  if (opts.withPin ?? true) {
    const pinR = opts.pinR ?? 3.5;
    const sizeY = opts.studsY * LDU.STUD_PITCH;
    const pin = transformMesh(cylinder(pinR, sizeY + 4, 48, true), m4RotateX(Math.PI / 2));
    const x = hingeEdge === "posX" ? sizeX / 2 + 6 : -sizeX / 2 - 6;
    parts.push(transformMesh(pin, m4Translate(x, 0, 0)));
  }

  return mergeMeshes(...parts);
}

export type PrefabKind =
  | "brick_2x4"
  | "slope_2x2"
  | "arc_tile_90"
  | "technic_beam_7"
  | "round_2x2"
  | "arch_4x2"
  | "hinge_2x4"
  | "axle_8L";

export function generatePrefab(kind: PrefabKind): Mesh {
  switch (kind) {
    case "brick_2x4":
      return systemRect({ studsX: 2, studsY: 4, platesH: 3, withStuds: true, withTubes: true });
    case "slope_2x2":
      return systemSlope({ studsX: 2, studsY: 2, platesH: 3, lowAtNegX: true, withStuds: true });
    case "arc_tile_90":
      return systemArcTile({ innerStudRadius: 1, thicknessStuds: 1, platesH: 1, startDeg: 0, endDeg: 90 });
    case "technic_beam_7":
      return technicBeam({ holes: 7, thickness: 12, height: LDU.BRICK_H, withHoles: true });
    case "round_2x2":
      return systemRound({ diameterStuds: 2, platesH: 3, studsPattern: "grid", underside: "ring" });
    case "arch_4x2":
      return systemArch({ widthStuds: 4, depthStuds: 2, heightPlates: 6, openingWidthStuds: 2, openingBasePlates: 2, wallLdu: 4, withStuds: true });
    case "hinge_2x4":
      return hingePlateAssembly({ studsX: 2, studsY: 4, platesH: 1, knuckles: 5, hingeEdge: "posX", withPin: true });
    case "axle_8L":
      return technicAxleMesh({ nL: 8 });
    default:
      return systemRect({ studsX: 1, studsY: 1, platesH: 1 });
  }
}

// ============================================================
// HIGH-FIDELITY TECHNIC PRIMITIVES (LDraw-like visuals)
// - axle stop rings
// - pin grooves
// - friction ridges
// - semi-reduced axle hole variants
// ============================================================

export function extrudePolygonWall(polyIn: Vec2[], height: number): Mesh {
  const poly = ensureCCW(polyIn);
  const hz = height / 2;
  const out = mesh();

  const top: Vec3[] = poly.map((p) => v3(p.x, p.y, +hz));
  const bot: Vec3[] = poly.map((p) => v3(p.x, p.y, -hz));

  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length;
    const a = bot[i]!;
    const b = bot[j]!;
    const c = top[j]!;
    const d = top[i]!;
    pushTriangle(out, a, b, c);
    pushTriangle(out, a, c, d);
  }
  return out;
}

export type AxleHoleVariant =
  | "round"
  | "axle_full"
  | "axle_semi_reduced"
  | "axle_reduced";

export function technicHoleProfile(opts?: {
  variant?: AxleHoleVariant;
  radius?: number;
  segments?: number;
  inset?: number;
}): Vec2[] {
  const variant = opts?.variant ?? "round";
  const R = opts?.radius ?? LDU.TECHNIC_HOLE_R;
  const seg = Math.max(24, opts?.segments ?? 64);

  if (variant === "round") {
    const poly: Vec2[] = [];
    for (let i = 0; i < seg; i++) {
      const t = (i / seg) * Math.PI * 2;
      poly.push(v2(Math.cos(t) * R, Math.sin(t) * R));
    }
    return poly;
  }

  if (variant === "axle_full") {
    const across = R * 2;
    const clearance = 0.6;
    const a = across / 2 + clearance;
    const thick = 6 + clearance;
    const t = thick / 2;

    return ensureCCW([
      v2(+t, +a),
      v2(-t, +a),
      v2(-t, +t),
      v2(-a, +t),
      v2(-a, -t),
      v2(-t, -t),
      v2(-t, -a),
      v2(+t, -a),
      v2(+t, -t),
      v2(+a, -t),
      v2(+a, +t),
      v2(+t, +t),
    ]);
  }

  const insetDefault = variant === "axle_semi_reduced" ? 1.0 : 1.8;
  const inset = opts?.inset ?? insetDefault;
  const xMax = R - inset;

  const pts: Vec2[] = [];
  for (let i = 0; i < seg; i++) {
    const t = (i / seg) * Math.PI * 2;
    let x = Math.cos(t) * R;
    const y = Math.sin(t) * R;
    if (x > xMax) x = xMax;
    if (x < -xMax) x = -xMax;
    pts.push(v2(x, y));
  }

  const clean: Vec2[] = [];
  const eps = 1e-6;
  for (const p of pts) {
    const last = clean[clean.length - 1];
    if (!last || Math.abs(p.x - last.x) > eps || Math.abs(p.y - last.y) > eps) clean.push(p);
  }
  return ensureCCW(clean);
}

export function technicHoleLinerMesh(opts?: {
  variant?: AxleHoleVariant;
  radius?: number;
  depth?: number;
  segments?: number;
  inset?: number;
}): Mesh {
  const poly = technicHoleProfile(opts);
  const depth = opts?.depth ?? LDU.STUD_PITCH;
  return extrudePolygonWall(poly, depth);
}

export function axleStopRingMesh(opts?: {
  ringRadius?: number;
  ringWidth?: number;
  segments?: number;
}): Mesh {
  const r = opts?.ringRadius ?? LDU.TECHNIC_HOLE_R + 2.0;
  const w = opts?.ringWidth ?? 4.0;
  const seg = opts?.segments ?? 48;
  const ring = cylinder(r, w, seg, true);
  return transformMesh(ring, m4RotateX(Math.PI / 2));
}

export function axleGrooveBandMesh(opts?: {
  outerRadius?: number;
  innerRadius?: number;
  width?: number;
  segments?: number;
}): Mesh {
  const outer = opts?.outerRadius ?? LDU.TECHNIC_HOLE_R - 0.2;
  const inner = opts?.innerRadius ?? outer - 1.2;
  const w = opts?.width ?? 2.0;
  const seg = opts?.segments ?? 48;

  const band = tube(outer, inner, w, seg);
  return transformMesh(band, m4RotateX(Math.PI / 2));
}

export function technicPinMesh(opts?: {
  lengthLdu?: number;
  radius?: number;
  segments?: number;
  grooveCount?: number;
  grooveWidth?: number;
  grooveDepth?: number;
  frictionRibs?: number;
  ribWidth?: number;
  ribHeight?: number;
}): Mesh {
  const L = opts?.lengthLdu ?? 3 * LDU.STUD_PITCH;
  const r = opts?.radius ?? LDU.TECHNIC_HOLE_R - 0.4;
  const seg = opts?.segments ?? 64;

  const base = transformMesh(cylinder(r, L, seg, true), m4RotateX(Math.PI / 2));
  const parts: Mesh[] = [base];

  const gCount = opts?.grooveCount ?? 2;
  const gW = opts?.grooveWidth ?? 2.0;
  const gDepth = opts?.grooveDepth ?? 0.8;

  if (gCount > 0) {
    for (let i = 0; i < gCount; i++) {
      const t = (i + 1) / (gCount + 1);
      const y = -L / 2 + t * L;
      const band = axleGrooveBandMesh({
        outerRadius: r,
        innerRadius: Math.max(0.1, r - gDepth),
        width: gW,
        segments: 48,
      });
      parts.push(transformMesh(band, m4Translate(0, y, 0)));
    }
  }

  const ribCount = opts?.frictionRibs ?? 3;
  if (ribCount > 0) {
    const ribW = opts?.ribWidth ?? 1.2;
    const ribH = opts?.ribHeight ?? 0.7;
    const rib = box(ribW, L, ribH);

    for (let i = 0; i < ribCount; i++) {
      const ang = (i / ribCount) * Math.PI * 2;
      const x = Math.cos(ang) * (r + ribH / 2);
      const z = Math.sin(ang) * (r + ribH / 2);
      const R = m4RotateY(ang);
      const T = m4Translate(x, 0, z);
      parts.push(transformMesh(rib, m4Mul(T, R)));
    }
  }

  return mergeMeshes(...parts);
}

export function technicAxleMeshHiFi(opts: {
  nL: number;
  acrossTips?: number;
  armThick?: number;
  endStop?: boolean;
  centerStop?: boolean;
  customRings?: { y: number; radius?: number; width?: number }[];
  grooveCount?: number;
  grooveWidth?: number;
  grooveDepth?: number;
}): Mesh {
  const L = axleLengthL(opts.nL);

  const axle = technicAxleProfileMesh({
    lengthLdu: L,
    ...(opts.acrossTips !== undefined && { acrossTips: opts.acrossTips }),
    ...(opts.armThick !== undefined && { armThick: opts.armThick }),
  });

  const parts: Mesh[] = [axle];

  if (opts.endStop ?? true) {
    const ring = axleStopRingMesh({ ringRadius: LDU.TECHNIC_HOLE_R + 2.2, ringWidth: 4.0 });
    const y = +L / 2 - 6;
    parts.push(transformMesh(ring, m4Translate(0, y, 0)));
  }

  if (opts.centerStop ?? false) {
    const ring = axleStopRingMesh({ ringRadius: LDU.TECHNIC_HOLE_R + 2.0, ringWidth: 4.0 });
    parts.push(transformMesh(ring, m4Translate(0, 0, 0)));
  }

  if (opts.customRings && opts.customRings.length > 0) {
    for (const r of opts.customRings) {
      const ring = axleStopRingMesh({
        ringRadius: r.radius ?? LDU.TECHNIC_HOLE_R + 2.0,
        ringWidth: r.width ?? 4.0,
      });
      parts.push(transformMesh(ring, m4Translate(0, r.y, 0)));
    }
  }

  const gCount = opts.grooveCount ?? 0;
  if (gCount > 0) {
    const gW = opts.grooveWidth ?? 2.0;
    const gD = opts.grooveDepth ?? 0.9;

    for (let i = 0; i < gCount; i++) {
      const t = (i + 1) / (gCount + 1);
      const y = -L / 2 + t * L;

      const band = axleGrooveBandMesh({
        outerRadius: LDU.TECHNIC_HOLE_R - 0.15,
        innerRadius: Math.max(0.1, LDU.TECHNIC_HOLE_R - 0.15 - gD),
        width: gW,
        segments: 64,
      });
      parts.push(transformMesh(band, m4Translate(0, y, 0)));
    }
  }

  return mergeMeshes(...parts);
}

export function technicBeamHiFi(opts: {
  holes: number;
  thickness: number;
  height: number;
  holeVariant?: AxleHoleVariant;
  holeDepthLdu?: number;
}): Mesh {
  const N = opts.holes;
  const pitch = LDU.STUD_PITCH;
  const length = (N - 1) * pitch + pitch;
  const body = box(length, opts.thickness, opts.height);
  const parts: Mesh[] = [body];

  const holeVariant = opts.holeVariant ?? "round";
  const holeDepth = opts.holeDepthLdu ?? opts.thickness;

  const liner = technicHoleLinerMesh({
    variant: holeVariant,
    radius: LDU.TECHNIC_HOLE_R,
    depth: holeDepth,
    segments: 64,
  });
  const rot = m4RotateX(Math.PI / 2);

  for (let i = 0; i < N; i++) {
    const x = (-(N - 1) / 2 + i) * pitch;
    const tr = m4Translate(x, 0, 0);
    parts.push(transformMesh(liner, m4Mul(tr, rot)));
  }

  return mergeMeshes(...parts);
}

// ============================================================
// PRIMITIVE REGISTRY (Reusable mesh IDs) + INVOLUTE GEARS
// ============================================================

export class PrimitiveRegistry {
  private builders = new Map<string, (params: unknown) => Mesh>();
  private cache = new Map<string, Mesh>();

  register(id: string, builder: (params: unknown) => Mesh): void {
    if (this.builders.has(id)) throw new Error(`Primitive already registered: ${id}`);
    this.builders.set(id, builder);
  }

  get(id: string, params: unknown = {}): Mesh {
    const b = this.builders.get(id);
    if (!b) throw new Error(`Unknown primitive: ${id}`);

    const key = `${id}::${stableStringify(params)}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const m = b(params);
    this.cache.set(key, m);
    return m;
  }

  has(id: string): boolean {
    return this.builders.has(id);
  }

  clearCache(): void {
    this.cache.clear();
  }
}

function stableStringify(x: unknown): string {
  if (x === null) return "null";
  const t = typeof x;
  if (t === "number" || t === "boolean") return String(x);
  if (t === "string") return JSON.stringify(x);
  if (Array.isArray(x)) return `[${x.map(stableStringify).join(",")}]`;
  if (t === "object") {
    const obj = x as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
  }
  return JSON.stringify(x);
}

export const PRIMS = new PrimitiveRegistry();

function area2(poly: Vec2[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!;
    const q = poly[(i + 1) % poly.length]!;
    a += p.x * q.y - q.x * p.y;
  }
  return a;
}

function isCCW(poly: Vec2[]): boolean {
  return area2(poly) > 0;
}

function cross2(a: Vec2, b: Vec2, c: Vec2): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function pointInTri(p: Vec2, a: Vec2, b: Vec2, c: Vec2): boolean {
  const ab = cross2(a, b, p);
  const bc = cross2(b, c, p);
  const ca = cross2(c, a, p);
  const eps = 1e-12;
  return ab >= -eps && bc >= -eps && ca >= -eps;
}

function cleanPolygon(polyIn: Vec2[]): Vec2[] {
  if (polyIn.length < 3) return polyIn.slice();
  const eps = 1e-9;

  const deduped: Vec2[] = [];
  for (const p of polyIn) {
    const last = deduped[deduped.length - 1];
    if (!last || Math.abs(p.x - last.x) > eps || Math.abs(p.y - last.y) > eps) {
      deduped.push(p);
    }
  }

  if (deduped.length > 2) {
    const first = deduped[0]!;
    const last = deduped[deduped.length - 1]!;
    if (Math.abs(first.x - last.x) <= eps && Math.abs(first.y - last.y) <= eps) {
      deduped.pop();
    }
  }

  if (deduped.length < 3) return deduped;

  const cleaned: Vec2[] = [];
  for (let i = 0; i < deduped.length; i++) {
    const prev = deduped[(i - 1 + deduped.length) % deduped.length];
    const cur = deduped[i];
    const next = deduped[(i + 1) % deduped.length];
    const turn = Math.abs(cross2(prev!, cur!, next!));
    if (turn > eps) cleaned.push(cur!);
  }

  return cleaned.length >= 3 ? cleaned : deduped;
}

function triangulateEarClip(polyIn: Vec2[]): [number, number, number][] {
  const normalized = cleanPolygon(polyIn);
  if (normalized.length < 3) return [];
  const poly = isCCW(normalized) ? normalized.slice() : normalized.slice().reverse();

  const n = poly.length;
  const idx = Array.from({ length: n }, (_, i) => i);
  const tris: [number, number, number][] = [];

  const isConvexAt = (iPrev: number, iCur: number, iNext: number): boolean => {
    const a = poly[iPrev]!;
    const b = poly[iCur]!;
    const c = poly[iNext]!;
    return cross2(a, b, c) > 1e-12;
  };

  let guard = 0;
  while (idx.length > 3) {
    if (guard++ > 100000) throw new Error("Ear clipping failed: possible self-intersection");

    let earFound = false;
    for (let k = 0; k < idx.length; k++) {
      const iPrev = idx[(k - 1 + idx.length) % idx.length]!;
      const iCur = idx[k]!;
      const iNext = idx[(k + 1) % idx.length]!;

      if (!isConvexAt(iPrev, iCur, iNext)) continue;

      const a = poly[iPrev]!;
      const b = poly[iCur]!;
      const c = poly[iNext]!;

      let hasPointInside = false;
      for (let m = 0; m < idx.length; m++) {
        const iP = idx[m]!;
        if (iP === iPrev || iP === iCur || iP === iNext) continue;
        if (pointInTri(poly[iP]!, a, b, c)) {
          hasPointInside = true;
          break;
        }
      }
      if (hasPointInside) continue;

      tris.push([iPrev!, iCur!, iNext!]);
      idx.splice(k, 1);
      earFound = true;
      break;
    }

    if (!earFound) throw new Error("Ear clipping failed: no ear found (polygon likely invalid)");
  }

  tris.push([idx[0]!, idx[1]!, idx[2]!]);
  return tris;
}

export function extrudePolygonGeneral(polyIn: Vec2[], height: number): Mesh {
  const poly = ensureCCW(polyIn);
  const hz = height / 2;

  const out = mesh();
  const top: Vec3[] = poly.map((p) => v3(p.x, p.y, +hz));
  const bot: Vec3[] = poly.map((p) => v3(p.x, p.y, -hz));

  let capTris: [number, number, number][];
  try {
    capTris = triangulateEarClip(poly);
  } catch {
    capTris = triangulateConvex(poly);
  }

  for (const [i0, i1, i2] of capTris) pushTriangle(out, top[i0]!, top[i1]!, top[i2]!);
  for (const [i0, i1, i2] of capTris) pushTriangle(out, bot[i0]!, bot[i2]!, bot[i1]!);

  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length;
    const a = bot[i]!;
    const b = bot[j]!;
    const c = top[j]!;
    const d = top[i]!;
    pushTriangle(out, a, b, c);
    pushTriangle(out, a, c, d);
  }

  return out;
}

export const AXLEHOLE_PRIMS = {
  ROUND: "we.technic.hole.round",
  AXLE_FULL: "we.technic.hole.axle_full",
  AXLE_SEMI_REDUCED: "we.technic.hole.axle_semi_reduced",
  AXLE_REDUCED: "we.technic.hole.axle_reduced",
} as const;

function holeWallMeshFromVariant(params: {
  variant: AxleHoleVariant;
  radius?: number;
  depth: number;
  segments?: number;
  inset?: number;
}): Mesh {
  return technicHoleLinerMesh({
    variant: params.variant,
    radius: params.radius ?? LDU.TECHNIC_HOLE_R,
    depth: params.depth,
    segments: params.segments ?? 96,
    ...(params.inset !== undefined && { inset: params.inset }),
  });
}

export function registerAxleholePrimitives(): void {
  if (PRIMS.has(AXLEHOLE_PRIMS.ROUND)) return;

  PRIMS.register(AXLEHOLE_PRIMS.ROUND, (p: unknown) => {
    const params = p as { depth?: number; radius?: number; segments?: number };
    return holeWallMeshFromVariant({
      variant: "round",
      depth: params.depth ?? LDU.STUD_PITCH,
      ...(params.radius !== undefined && { radius: params.radius }),
      ...(params.segments !== undefined && { segments: params.segments }),
    });
  });

  PRIMS.register(AXLEHOLE_PRIMS.AXLE_FULL, (p: unknown) => {
    const params = p as { depth?: number; radius?: number; segments?: number };
    return holeWallMeshFromVariant({
      variant: "axle_full",
      depth: params.depth ?? LDU.STUD_PITCH,
      ...(params.radius !== undefined && { radius: params.radius }),
      ...(params.segments !== undefined && { segments: params.segments }),
    });
  });

  PRIMS.register(AXLEHOLE_PRIMS.AXLE_SEMI_REDUCED, (p: unknown) => {
    const params = p as { depth?: number; radius?: number; segments?: number; inset?: number };
    return holeWallMeshFromVariant({
      variant: "axle_semi_reduced",
      depth: params.depth ?? LDU.STUD_PITCH,
      ...(params.radius !== undefined && { radius: params.radius }),
      ...(params.segments !== undefined && { segments: params.segments }),
      ...(params.inset !== undefined && { inset: params.inset }),
    });
  });

  PRIMS.register(AXLEHOLE_PRIMS.AXLE_REDUCED, (p: unknown) => {
    const params = p as { depth?: number; radius?: number; segments?: number; inset?: number };
    return holeWallMeshFromVariant({
      variant: "axle_reduced",
      depth: params.depth ?? LDU.STUD_PITCH,
      ...(params.radius !== undefined && { radius: params.radius }),
      ...(params.segments !== undefined && { segments: params.segments }),
      ...(params.inset !== undefined && { inset: params.inset }),
    });
  });
}

export function placeAxleholePrimitiveY(opts: {
  id: string;
  x: number;
  y: number;
  z: number;
  depth: number;
  radius?: number;
  segments?: number;
  inset?: number;
}): Mesh {
  registerAxleholePrimitives();
  const liner = PRIMS.get(opts.id, {
    depth: opts.depth,
    radius: opts.radius,
    segments: opts.segments,
    inset: opts.inset,
  });
  const rot = m4RotateX(Math.PI / 2);
  const tr = m4Translate(opts.x, opts.y, opts.z);
  return transformMesh(liner, m4Mul(tr, rot));
}

export function technicBeamPrims(opts: {
  holes: number;
  thickness: number;
  height: number;
  primitiveId?: string;
  radius?: number;
  segments?: number;
  inset?: number;
}): Mesh {
  registerAxleholePrimitives();

  const N = opts.holes;
  const pitch = LDU.STUD_PITCH;
  const length = (N - 1) * pitch + pitch;

  const body = box(length, opts.thickness, opts.height);
  const parts: Mesh[] = [body];

  const pid = opts.primitiveId ?? AXLEHOLE_PRIMS.ROUND;

  for (let i = 0; i < N; i++) {
    const x = (-(N - 1) / 2 + i) * pitch;
    parts.push(placeAxleholePrimitiveY({
      id: pid,
      x,
      y: 0,
      z: 0,
      depth: opts.thickness,
      ...(opts.radius !== undefined && { radius: opts.radius }),
      ...(opts.segments !== undefined && { segments: opts.segments }),
      ...(opts.inset !== undefined && { inset: opts.inset }),
    }));
  }

  return mergeMeshes(...parts);
}

export type SpurGearOpts = {
  teeth: number;
  moduleLdu: number;
  pressureAngleDeg?: number;
  thicknessLdu: number;
  addendum?: number;
  dedendum?: number;
  backlashLdu?: number;
  involuteSteps?: number;
  arcSteps?: number;
};

function involutePolarAngle(t: number): number {
  return t - Math.atan(t);
}

function involuteRadius(rb: number, t: number): number {
  return rb * Math.sqrt(1 + t * t);
}

function involutePoint(rb: number, t: number): Vec2 {
  const r = involuteRadius(rb, t);
  const ang = involutePolarAngle(t);
  return v2(Math.cos(ang) * r, Math.sin(ang) * r);
}

function rotate2(p: Vec2, ang: number): Vec2 {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return v2(p.x * c - p.y * s, p.x * s + p.y * c);
}

function arcPoints(r: number, a0: number, a1: number, steps: number): Vec2[] {
  const pts: Vec2[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = a0 + (a1 - a0) * t;
    pts.push(v2(Math.cos(a) * r, Math.sin(a) * r));
  }
  return pts;
}

export function spurGearOutline(opts: SpurGearOpts): Vec2[] {
  const z = opts.teeth;
  if (z < 6) throw new Error("teeth too small for stable involute outline");

  const m = opts.moduleLdu;
  const phi = ((opts.pressureAngleDeg ?? 20) * Math.PI) / 180;
  const add = (opts.addendum ?? 1.0) * m;
  const ded = (opts.dedendum ?? 1.25) * m;

  const rp = (m * z) / 2;
  const rb = rp * Math.cos(phi);
  const ra = rp + add;
  const rr = Math.max(0.1, rp - ded);

  const backlash = opts.backlashLdu ?? 0.3;
  const s = Math.PI * m / 2;
  const alpha0 = (s / 2) / rp;
  const alpha = Math.max(0.001, alpha0 - backlash / (2 * rp));

  const tOuter = Math.sqrt((ra * ra) / (rb * rb) - 1);
  const tBase = 0;
  const steps = opts.involuteSteps ?? 16;
  const arcStepsN = opts.arcSteps ?? 8;

  const tPitch = Math.sqrt((rp * rp) / (rb * rb) - 1);
  const angPitch = involutePolarAngle(tPitch);
  const rotRight = +alpha - angPitch;

  const rightFlank: Vec2[] = [];
  const leftFlank: Vec2[] = [];

  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const t = tBase + (tOuter - tBase) * u;
    const p = involutePoint(rb, t);
    rightFlank.push(rotate2(p, rotRight));
    leftFlank.push(rotate2(v2(p.x, -p.y), -rotRight));
  }

  const pR = rightFlank[rightFlank.length - 1]!;
  const pL = leftFlank[leftFlank.length - 1]!;
  const aR = Math.atan2(pR.y, pR.x);
  let aL = Math.atan2(pL.y, pL.x);

  if (aL <= aR) aL += Math.PI * 2;
  const outerArc = arcPoints(ra, aR, aL, arcStepsN);

  const baseR = rightFlank[0]!;
  const baseL = leftFlank[0]!;
  const angBaseR = Math.atan2(baseR.y, baseR.x);
  const angBaseL = Math.atan2(baseL.y, baseL.x);

  const rootR = v2(Math.cos(angBaseR) * rr, Math.sin(angBaseR) * rr);
  const rootL = v2(Math.cos(angBaseL) * rr, Math.sin(angBaseL) * rr);

  const tooth: Vec2[] = [];
  tooth.push(rootR);
  tooth.push(...rightFlank.slice(1));
  tooth.push(...outerArc.slice(1, -1));
  tooth.push(...leftFlank.slice().reverse().slice(1));
  tooth.push(rootL);

  return ensureCCW(tooth);
}

export function spurGearOutlineFull(opts: SpurGearOpts): Vec2[] {
  const z = opts.teeth;
  const m = opts.moduleLdu;
  const ded = (opts.dedendum ?? 1.25) * m;

  const rp = (m * z) / 2;
  const rr = Math.max(0.1, rp - ded);

  const tooth = spurGearOutline(opts);
  const dTheta = (Math.PI * 2) / z;
  const arcStepsN = opts.arcSteps ?? 8;

  const toothRootStart = tooth[0]!;
  const toothRootEnd = tooth[tooth.length - 1]!;

  const outline: Vec2[] = [];

  for (let k = 0; k < z; k++) {
    const theta = k * dTheta;
    const nextTheta = (k + 1) * dTheta;

    const tPts = tooth.map((p) => rotate2(p, theta));

    if (outline.length === 0) outline.push(...tPts);
    else outline.push(...tPts.slice(1));

    const end = rotate2(toothRootEnd, theta);
    const startNext = rotate2(toothRootStart, nextTheta);

    const a0 = Math.atan2(end.y, end.x);
    let a1 = Math.atan2(startNext.y, startNext.x);
    if (a1 <= a0) a1 += Math.PI * 2;

    const rootArc = arcPoints(rr, a0, a1, arcStepsN);
    outline.push(...rootArc.slice(1));
  }

  return ensureCCW(outline);
}

export function spurGearMesh(opts: SpurGearOpts): Mesh {
  const outline = spurGearOutlineFull(opts);
  return extrudePolygonGeneral(outline, opts.thicknessLdu);
}

export function spurGearPitchRadius(teeth: number, moduleLdu: number): number {
  return (moduleLdu * teeth) / 2;
}

export function spurGearCenterDistance(aTeeth: number, bTeeth: number, moduleLdu: number): number {
  return spurGearPitchRadius(aTeeth, moduleLdu) + spurGearPitchRadius(bTeeth, moduleLdu);
}

// ============================================================
// STRAIGHT BEVEL GEARS (Involute outline lofted on a cone frustum)
// ============================================================

export function loftPolygonTaper(polyIn: Vec2[], zTop: number, zBot: number, scaleTop: number, scaleBot: number): Mesh {
  const poly = ensureCCW(polyIn);

  const out = mesh();
  const top: Vec3[] = poly.map((p) => v3(p.x * scaleTop, p.y * scaleTop, zTop));
  const bot: Vec3[] = poly.map((p) => v3(p.x * scaleBot, p.y * scaleBot, zBot));

  let capTris: [number, number, number][];
  try {
    capTris = triangulateEarClip(poly);
  } catch {
    capTris = triangulateConvex(poly);
  }

  for (const [i0, i1, i2] of capTris) pushTriangle(out, top[i0]!, top[i1]!, top[i2]!);
  for (const [i0, i1, i2] of capTris) pushTriangle(out, bot[i0]!, bot[i2]!, bot[i1]!);

  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length;
    const a = bot[i]!;
    const b = bot[j]!;
    const c = top[j]!;
    const d = top[i]!;
    pushTriangle(out, a, b, c);
    pushTriangle(out, a, c, d);
  }

  return out;
}

export type BevelGearOpts = {
  teeth: number;
  moduleLdu: number;
  pressureAngleDeg?: number;
  faceWidthLdu: number;
  thicknessLdu?: number;
  coneAngleDeg?: number;
  addendum?: number;
  dedendum?: number;
  backlashLdu?: number;
  involuteSteps?: number;
  arcSteps?: number;
  withHub?: boolean;
  hubRadiusLdu?: number;
  hubWidthLdu?: number;
  axleHolePrimitiveId?: string;
  axleHoleInset?: number;
  axleHoleSegments?: number;
};

export function bevelGearMesh(opts: BevelGearOpts): Mesh {
  const zTeeth = opts.teeth;
  if (zTeeth < 6) throw new Error("bevelGearMesh: teeth too small for stable involute");

  const m = opts.moduleLdu;
  const w = opts.thicknessLdu ?? opts.faceWidthLdu;
  const coneAng = ((opts.coneAngleDeg ?? 45) * Math.PI) / 180;

  const rp = spurGearPitchRadius(zTeeth, m);
  const dr = w * Math.tan(coneAng);
  const rpSmall = rp - dr;
  const minScale = 0.15;
  const scaleSmall = Math.max(minScale, rpSmall / rp);

  const outline = spurGearOutlineFull({
    teeth: zTeeth,
    moduleLdu: m,
    pressureAngleDeg: opts.pressureAngleDeg ?? 20,
    thicknessLdu: 1,
    addendum: opts.addendum ?? 1.0,
    dedendum: opts.dedendum ?? 1.25,
    backlashLdu: opts.backlashLdu ?? 0.25,
    involuteSteps: opts.involuteSteps ?? 18,
    arcSteps: opts.arcSteps ?? 10,
  });

  const zTop = +w / 2;
  const zBot = -w / 2;
  const gear = loftPolygonTaper(outline, zTop, zBot, 1.0, scaleSmall);

  const parts: Mesh[] = [gear];

  if (opts.withHub ?? true) {
    registerAxleholePrimitives();

    const hubR = opts.hubRadiusLdu ?? LDU.TECHNIC_HOLE_R + 6;
    const hubW = opts.hubWidthLdu ?? w * 0.75;

    const hub = cylinder(hubR, hubW, 96, true);
    parts.push(transformMesh(hub, m4Translate(0, 0, 0)));

    const pid = opts.axleHolePrimitiveId ?? AXLEHOLE_PRIMS.AXLE_SEMI_REDUCED;
    const liner = PRIMS.get(pid, {
      depth: hubW,
      radius: LDU.TECHNIC_HOLE_R,
      segments: opts.axleHoleSegments ?? 128,
      inset: opts.axleHoleInset,
    });

    parts.push(transformMesh(liner, m4Translate(0, 0, 0)));
  }

  return mergeMeshes(...parts);
}

export function bevelGearPairCenterDistanceApprox(teethA: number, teethB: number, moduleLdu: number): number {
  return spurGearPitchRadius(teethA, moduleLdu) + spurGearPitchRadius(teethB, moduleLdu);
}
