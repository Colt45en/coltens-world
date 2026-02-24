/**
 * Matrix Mathematics — Matrix3 & Matrix4
 * Column-major storage + column-vector multiplication (OpenGL / Three.js style)
 *
 * v' = M · v
 * M · N means "apply N first, then M"
 */



export type Vector2 = [number, number];
export type Vector3 = [number, number, number];
export type Vector4 = [number, number, number, number];
export type Quaternion = [number, number, number, number]; // [x, y, z, w]

const EPS = 1e-6;

function nearlyEqual(a: number, b: number, eps = EPS) {
  return Math.abs(a - b) <= eps;
}

/**
 * 3×3 matrix (column-major)
 * elements:
 * [ m11, m21, m31,
 *   m12, m22, m32,
 *   m13, m23, m33 ]
 */
export class Matrix3 {
  elements: Float32Array;

  constructor(
    n11 = 1, n12 = 0, n13 = 0,
    n21 = 0, n22 = 1, n23 = 0,
    n31 = 0, n32 = 0, n33 = 1
  ) {
    this.elements = new Float32Array(9);
    this.set(n11, n12, n13, n21, n22, n23, n31, n32, n33);
  }

  set(
    n11: number, n12: number, n13: number,
    n21: number, n22: number, n23: number,
    n31: number, n32: number, n33: number
  ): this {
    const te = this.elements;
    te[0] = n11; te[1] = n21; te[2] = n31;
    te[3] = n12; te[4] = n22; te[5] = n32;
    te[6] = n13; te[7] = n23; te[8] = n33;
    return this;
  }

  identity(): this {
    return this.set(
      1, 0, 0,
      0, 1, 0,
      0, 0, 1
    );
  }

  clone(): Matrix3 {
    return new Matrix3().fromArray(this.elements);
  }

  copy(m: Matrix3): this {
    this.elements.set(m.elements);
    return this;
  }

  multiply(m: Matrix3): this {
    return this.multiplyMatrices(this, m);
  }

  premultiply(m: Matrix3): this {
    return this.multiplyMatrices(m, this);
  }

  multiplyMatrices(a: Matrix3, b: Matrix3): this {
    const ae = a.elements;
    const be = b.elements;
    const te = this.elements;

    const a11 = ae[0]!, a12 = ae[3]!, a13 = ae[6]!;
    const a21 = ae[1]!, a22 = ae[4]!, a23 = ae[7]!;
    const a31 = ae[2]!, a32 = ae[5]!, a33 = ae[8]!;

    const b11 = be[0]!, b12 = be[3]!, b13 = be[6]!;
    const b21 = be[1]!, b22 = be[4]!, b23 = be[7]!;
    const b31 = be[2]!, b32 = be[5]!, b33 = be[8]!;

    te[0] = a11 * b11 + a12 * b21 + a13 * b31;
    te[1] = a21 * b11 + a22 * b21 + a23 * b31;
    te[2] = a31 * b11 + a32 * b21 + a33 * b31;

    te[3] = a11 * b12 + a12 * b22 + a13 * b32;
    te[4] = a21 * b12 + a22 * b22 + a23 * b32;
    te[5] = a31 * b12 + a32 * b22 + a33 * b32;

    te[6] = a11 * b13 + a12 * b23 + a13 * b33;
    te[7] = a21 * b13 + a22 * b23 + a23 * b33;
    te[8] = a31 * b13 + a32 * b23 + a33 * b33;

    return this;
  }

  multiplyScalar(s: number): this {
    const te = this.elements;
    for (let i = 0; i < 9; i++) te[i]! *= s;
    return this;
  }

  /**
   * Correct determinant for column-major mapping (consistent with invert()).
   */
  determinant(): number {
    const te = this.elements;

    const n11 = te[0]!, n21 = te[1]!, n31 = te[2]!;
    const n12 = te[3]!, n22 = te[4]!, n32 = te[5]!;
    const n13 = te[6]!, n23 = te[7]!, n33 = te[8]!;

    const t11 = n33 * n22 - n32 * n23;
    const t12 = n32 * n13 - n33 * n12;
    const t13 = n23 * n12 - n22 * n13;

    return n11 * t11 + n21 * t12 + n31 * t13;
  }

  invert(): this {
    const te = this.elements;

    const n11 = te[0]!, n21 = te[1]!, n31 = te[2]!;
    const n12 = te[3]!, n22 = te[4]!, n32 = te[5]!;
    const n13 = te[6]!, n23 = te[7]!, n33 = te[8]!;

    const t11 = n33 * n22 - n32 * n23;
    const t12 = n32 * n13 - n33 * n12;
    const t13 = n23 * n12 - n22 * n13;

    const det = n11 * t11 + n21 * t12 + n31 * t13;

    if (det === 0) {
      te.fill(0);
      return this;
    }

    const detInv = 1 / det;

    te[0] = t11 * detInv;
    te[1] = (n31 * n23 - n33 * n21) * detInv;
    te[2] = (n32 * n21 - n31 * n22) * detInv;

    te[3] = t12 * detInv;
    te[4] = (n33 * n11 - n31 * n13) * detInv;
    te[5] = (n31 * n12 - n32 * n11) * detInv;

    te[6] = t13 * detInv;
    te[7] = (n21 * n13 - n23 * n11) * detInv;
    te[8] = (n22 * n11 - n21 * n12) * detInv;

    return this;
  }

  transpose(): this {
    const te = this.elements;
    let tmp: number;

    tmp = te[1]!; te[1] = te[3]!; te[3] = tmp;
    tmp = te[2]!; te[2] = te[6]!; te[6] = tmp;
    tmp = te[5]!; te[5] = te[7]!; te[7] = tmp;

    return this;
  }

  /**
   * Post-multiply: this = this * S(sx, sy)
   * Applies scaling AFTER the current transform.
   */
  scale(sx: number, sy: number): this {
    const te = this.elements;
    te[0]! *= sx; te[1]! *= sx; te[2]! *= sx; // col1
    te[3]! *= sy; te[4]! *= sy; te[5]! *= sy; // col2
    return this;
  }

  /**
   * Post-multiply: this = this * R(theta)
   * Applies rotation AFTER the current transform.
   */
  rotate(theta: number): this {
    const te = this.elements;
    const c = Math.cos(theta);
    const s = Math.sin(theta);

    // save col1, col2
    const a11 = te[0]!, a21 = te[1]!, a31 = te[2]!;
    const a12 = te[3]!, a22 = te[4]!, a32 = te[5]!;

    // col1' = c*col1 + s*col2
    te[0] = c * a11 + s * a12;
    te[1] = c * a21 + s * a22;
    te[2] = c * a31 + s * a32;

    // col2' = -s*col1 + c*col2
    te[3] = -s * a11 + c * a12;
    te[4] = -s * a21 + c * a22;
    te[5] = -s * a31 + c * a32;

    return this;
  }

  /**
   * Post-multiply: this = this * T(tx, ty)
   * Applies translation AFTER the current transform.
   * Only the last column changes:
   * col3' = col3 + tx*col1 + ty*col2
   */
  translate(tx: number, ty: number): this {
    const te = this.elements;
    te[6]! += tx * te[0]! + ty * te[3]!;
    te[7]! += tx * te[1]! + ty * te[4]!;
    te[8]! += tx * te[2]! + ty * te[5]!;
    return this;
  }

  makeTranslation(x: number | Vector2, y?: number): this {
    const tx = typeof x === "number" ? x : x[0];
    const ty = typeof x === "number" ? (y ?? 0) : x[1];

    return this.set(
      1, 0, tx,
      0, 1, ty,
      0, 0, 1
    );
  }

  /**
   * CCW rotation for column vectors:
   * [ c -s 0
   *   s  c 0
   *   0  0 1 ]
   */
  makeRotation(theta: number): this {
    const c = Math.cos(theta);
    const s = Math.sin(theta);

    return this.set(
      c, -s, 0,
      s,  c, 0,
      0,  0, 1
    );
  }

  makeScale(x: number | Vector2, y?: number): this {
    const sx = typeof x === "number" ? x : x[0];
    const sy = typeof x === "number" ? (y ?? x) : x[1];

    return this.set(
      sx, 0, 0,
      0, sy, 0,
      0, 0, 1
    );
  }

  transformPoint(point: Vector2, out?: Vector2): Vector2 {
    const te = this.elements;
    const x = point[0], y = point[1];

    const ox = te[0]! * x + te[3]! * y + te[6]!;
    const oy = te[1]! * x + te[4]! * y + te[7]!;

    if (out) { out[0] = ox; out[1] = oy; return out; }
    return [ox, oy];
  }

  /**
   * Transform a direction vector (no translation).
   * Fast path: ignores last column.
   */
  transformDirection(dir: Vector2, out?: Vector2): Vector2 {
    const te = this.elements;
    const x = dir[0], y = dir[1];

    const ox = te[0]! * x + te[3]! * y;
    const oy = te[1]! * x + te[4]! * y;

    if (out) { out[0] = ox; out[1] = oy; return out; }
    return [ox, oy];
  }

  equals(matrix: Matrix3): boolean {
    const te = this.elements;
    const me = matrix.elements;
    for (let i = 0; i < 9; i++) if (te[i]! !== me[i]!) return false;
    return true;
  }

  equalsEpsilon(matrix: Matrix3, eps = EPS): boolean {
    const te = this.elements;
    const me = matrix.elements;
    for (let i = 0; i < 9; i++) if (!nearlyEqual(te[i]!, me[i]!, eps)) return false;
    return true;
  }

  fromArray(array: ArrayLike<number>, offset = 0): this {
    const te = this.elements;
    for (let i = 0; i < 9; i++) te[i] = array[offset + i]!;
    return this;
  }

  toArray(array: number[] = [], offset = 0): number[] {
    const te = this.elements;
    for (let i = 0; i < 9; i++) array[offset + i] = te[i]!;
    return array;
  }

  toString(): string {
    const te = this.elements;
    return `Matrix3(\n  ${te[0]!.toFixed(4)}, ${te[3]!.toFixed(4)}, ${te[6]!.toFixed(4)}\n  ${te[1]!.toFixed(4)}, ${te[4]!.toFixed(4)}, ${te[7]!.toFixed(4)}\n  ${te[2]!.toFixed(4)}, ${te[5]!.toFixed(4)}, ${te[8]!.toFixed(4)}\n)`;
  }
}

/**
 * 4×4 matrix (column-major)
 * elements:
 * [ m11, m21, m31, m41,
 *   m12, m22, m32, m42,
 *   m13, m23, m33, m43,
 *   m14, m24, m34, m44 ]
 */
export class Matrix4 {
  elements: Float32Array;

  constructor(
    n11 = 1, n12 = 0, n13 = 0, n14 = 0,
    n21 = 0, n22 = 1, n23 = 0, n24 = 0,
    n31 = 0, n32 = 0, n33 = 1, n34 = 0,
    n41 = 0, n42 = 0, n43 = 0, n44 = 1
  ) {
    this.elements = new Float32Array(16);
    this.set(
      n11, n12, n13, n14,
      n21, n22, n23, n24,
      n31, n32, n33, n34,
      n41, n42, n43, n44
    );
  }

  set(
    n11: number, n12: number, n13: number, n14: number,
    n21: number, n22: number, n23: number, n24: number,
    n31: number, n32: number, n33: number, n34: number,
    n41: number, n42: number, n43: number, n44: number
  ): this {
    const te = this.elements;

    te[0]  = n11; te[4]  = n12; te[8]  = n13; te[12] = n14;
    te[1]  = n21; te[5]  = n22; te[9]  = n23; te[13] = n24;
    te[2]  = n31; te[6]  = n32; te[10] = n33; te[14] = n34;
    te[3]  = n41; te[7]  = n42; te[11] = n43; te[15] = n44;

    return this;
  }

  identity(): this {
    return this.set(
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    );
  }

  clone(): Matrix4 {
    return new Matrix4().fromArray(this.elements);
  }

  copy(m: Matrix4): this {
    this.elements.set(m.elements);
    return this;
  }

  multiply(m: Matrix4): this {
    return this.multiplyMatrices(this, m);
  }

  premultiply(m: Matrix4): this {
    return this.multiplyMatrices(m, this);
  }

  multiplyMatrices(a: Matrix4, b: Matrix4): this {
    const ae = a.elements;
    const be = b.elements;
    const te = this.elements;

    const a11 = ae[0]!, a12 = ae[4]!, a13 = ae[8]!,  a14 = ae[12]!;
    const a21 = ae[1]!, a22 = ae[5]!, a23 = ae[9]!,  a24 = ae[13]!;
    const a31 = ae[2]!, a32 = ae[6]!, a33 = ae[10]!, a34 = ae[14]!;
    const a41 = ae[3]!, a42 = ae[7]!, a43 = ae[11]!, a44 = ae[15]!;

    const b11 = be[0]!, b12 = be[4]!, b13 = be[8]!,  b14 = be[12]!;
    const b21 = be[1]!, b22 = be[5]!, b23 = be[9]!,  b24 = be[13]!;
    const b31 = be[2]!, b32 = be[6]!, b33 = be[10]!, b34 = be[14]!;
    const b41 = be[3]!, b42 = be[7]!, b43 = be[11]!, b44 = be[15]!;

    te[0]  = a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41;
    te[4]  = a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42;
    te[8]  = a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43;
    te[12] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44;

    te[1]  = a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41;
    te[5]  = a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42;
    te[9]  = a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43;
    te[13] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44;

    te[2]  = a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41;
    te[6]  = a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42;
    te[10] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43;
    te[14] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44;

    te[3]  = a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41;
    te[7]  = a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42;
    te[11] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43;
    te[15] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44;

    return this;
  }

  multiplyScalar(s: number): this {
    const te = this.elements;
    for (let i = 0; i < 16; i++) te[i]! *= s;
    return this;
  }

  transpose(): this {
    const te = this.elements;
    let tmp: number;

    tmp = te[1]!;  te[1]  = te[4]!;  te[4]  = tmp;
    tmp = te[2]!;  te[2]  = te[8]!;  te[8]  = tmp;
    tmp = te[6]!;  te[6]  = te[9]!;  te[9]  = tmp;

    tmp = te[3]!;  te[3]  = te[12]!; te[12] = tmp;
    tmp = te[7]!;  te[7]  = te[13]!; te[13] = tmp;
    tmp = te[11]!; te[11] = te[14]!; te[14] = tmp;

    return this;
  }

  /**
   * Post-multiply translate: this = this * T(tx,ty,tz)
   * Only last column changes: col4' = col4 + tx*col1 + ty*col2 + tz*col3
   */
  translate(tx: number, ty: number, tz: number): this {
    const te = this.elements;
    te[12]! += tx * te[0]! + ty * te[4]! + tz * te[8]!;
    te[13]! += tx * te[1]! + ty * te[5]! + tz * te[9]!;
    te[14]! += tx * te[2]! + ty * te[6]! + tz * te[10]!;
    te[15]! += tx * te[3]! + ty * te[7]! + tz * te[11]!;
    return this;
  }

  /**
   * Post-multiply scale: this = this * S(sx,sy,sz)
   */
  scale(sx: number, sy: number, sz: number): this {
    const te = this.elements;
    te[0]! *= sx; te[1]! *= sx; te[2]! *= sx; te[3]! *= sx;   // col1
    te[4]! *= sy; te[5]! *= sy; te[6]! *= sy; te[7]! *= sy;   // col2
    te[8]! *= sz; te[9]! *= sz; te[10]! *= sz; te[11]! *= sz; // col3
    return this;
  }

  /**
   * In-place post-multiply rotations (fast column recombine).
   */
  rotateX(theta: number): this {
    const te = this.elements;
    const c = Math.cos(theta), s = Math.sin(theta);

    const a12 = te[4]!,  a22 = te[5]!,  a32 = te[6]!,  a42 = te[7]!;
    const a13 = te[8]!,  a23 = te[9]!,  a33 = te[10]!, a43 = te[11]!;

    // col2' = c*col2 + s*col3
    te[4]  = c * a12 + s * a13;
    te[5]  = c * a22 + s * a23;
    te[6]  = c * a32 + s * a33;
    te[7]  = c * a42 + s * a43;

    // col3' = -s*col2 + c*col3
    te[8]  = -s * a12 + c * a13;
    te[9]  = -s * a22 + c * a23;
    te[10] = -s * a32 + c * a33;
    te[11] = -s * a42 + c * a43;

    return this;
  }

  rotateY(theta: number): this {
    const te = this.elements;
    const c = Math.cos(theta), s = Math.sin(theta);

    const a11 = te[0]!,  a21 = te[1]!,  a31 = te[2]!,  a41 = te[3]!;
    const a13 = te[8]!,  a23 = te[9]!,  a33 = te[10]!, a43 = te[11]!;

    // col1' = c*col1 - s*col3
    te[0] = c * a11 - s * a13;
    te[1] = c * a21 - s * a23;
    te[2] = c * a31 - s * a33;
    te[3] = c * a41 - s * a43;

    // col3' = s*col1 + c*col3 (use originals!)
    te[8]  = s * a11 + c * a13;
    te[9]  = s * a21 + c * a23;
    te[10] = s * a31 + c * a33;
    te[11] = s * a41 + c * a43;

    return this;
  }

  rotateZ(theta: number): this {
    const te = this.elements;
    const c = Math.cos(theta), s = Math.sin(theta);

    const a11 = te[0]!, a21 = te[1]!, a31 = te[2]!, a41 = te[3]!;
    const a12 = te[4]!, a22 = te[5]!, a32 = te[6]!, a42 = te[7]!;

    // col1' = c*col1 + s*col2
    te[0] = c * a11 + s * a12;
    te[1] = c * a21 + s * a22;
    te[2] = c * a31 + s * a32;
    te[3] = c * a41 + s * a42;

    // col2' = -s*col1 + c*col2
    te[4] = -s * a11 + c * a12;
    te[5] = -s * a21 + c * a22;
    te[6] = -s * a31 + c * a32;
    te[7] = -s * a41 + c * a42;

    return this;
  }

  determinant(): number {
    const te = this.elements;

    const n11 = te[0]!,  n12 = te[4]!,  n13 = te[8]!,  n14 = te[12]!;
    const n21 = te[1]!,  n22 = te[5]!,  n23 = te[9]!,  n24 = te[13]!;
    const n31 = te[2]!,  n32 = te[6]!,  n33 = te[10]!, n34 = te[14]!;
    const n41 = te[3]!,  n42 = te[7]!,  n43 = te[11]!, n44 = te[15]!;

    // Same structure as Three.js (stable + fast)
    return (
      n41 * (
        + n14 * n23 * n32
        - n13 * n24 * n32
        - n14 * n22 * n33
        + n12 * n24 * n33
        + n13 * n22 * n34
        - n12 * n23 * n34
      ) +
      n42 * (
        + n11 * n23 * n34
        - n11 * n24 * n33
        + n14 * n21 * n33
        - n13 * n21 * n34
        + n13 * n24 * n31
        - n14 * n23 * n31
      ) +
      n43 * (
        + n11 * n24 * n32
        - n11 * n22 * n34
        - n14 * n21 * n32
        + n12 * n21 * n34
        + n14 * n22 * n31
        - n12 * n24 * n31
      ) +
      n44 * (
        - n13 * n22 * n31
        - n11 * n23 * n32
        + n11 * n22 * n33
        + n13 * n21 * n32
        - n12 * n21 * n33
        + n12 * n23 * n31
      )
    );
  }

  invert(): this {
    const te = this.elements;

    const n11 = te[0]!,  n21 = te[1]!,  n31 = te[2]!,  n41 = te[3]!;
    const n12 = te[4]!,  n22 = te[5]!,  n32 = te[6]!,  n42 = te[7]!;
    const n13 = te[8]!,  n23 = te[9]!,  n33 = te[10]!, n43 = te[11]!;
    const n14 = te[12]!, n24 = te[13]!, n34 = te[14]!, n44 = te[15]!;

    // cofactors (Three.js style)
    const t11 = n23 * n34 * n42 - n24 * n33 * n42 + n24 * n32 * n43 - n22 * n34 * n43 - n23 * n32 * n44 + n22 * n33 * n44;
    const t12 = n14 * n33 * n42 - n13 * n34 * n42 - n14 * n32 * n43 + n12 * n34 * n43 + n13 * n32 * n44 - n12 * n33 * n44;
    const t13 = n13 * n24 * n42 - n14 * n23 * n42 + n14 * n22 * n43 - n12 * n24 * n43 - n13 * n22 * n44 + n12 * n23 * n44;
    const t14 = n14 * n23 * n32 - n13 * n24 * n32 - n14 * n22 * n33 + n12 * n24 * n33 + n13 * n22 * n34 - n12 * n23 * n34;

    const det = n11 * t11 + n21 * t12 + n31 * t13 + n41 * t14;

    if (det === 0) {
      te.fill(0);
      return this;
    }

    const detInv = 1 / det;

    te[0]  = t11 * detInv;
    te[1]  = (n24 * n33 * n41 - n23 * n34 * n41 - n24 * n31 * n43 + n21 * n34 * n43 + n23 * n31 * n44 - n21 * n33 * n44) * detInv;
    te[2]  = (n22 * n34 * n41 - n24 * n32 * n41 + n24 * n31 * n42 - n21 * n34 * n42 - n22 * n31 * n44 + n21 * n32 * n44) * detInv;
    te[3]  = (n23 * n32 * n41 - n22 * n33 * n41 - n23 * n31 * n42 + n21 * n33 * n42 + n22 * n31 * n43 - n21 * n32 * n43) * detInv;

    te[4]  = t12 * detInv;
    te[5]  = (n13 * n34 * n41 - n14 * n33 * n41 + n14 * n31 * n43 - n11 * n34 * n43 - n13 * n31 * n44 + n11 * n33 * n44) * detInv;
    te[6]  = (n14 * n32 * n41 - n12 * n34 * n41 - n14 * n31 * n42 + n11 * n34 * n42 + n12 * n31 * n44 - n11 * n32 * n44) * detInv;
    te[7]  = (n12 * n33 * n41 - n13 * n32 * n41 + n13 * n31 * n42 - n11 * n33 * n42 - n12 * n31 * n43 + n11 * n32 * n43) * detInv;

    te[8]  = t13 * detInv;
    te[9]  = (n14 * n23 * n41 - n13 * n24 * n41 - n14 * n21 * n43 + n11 * n24 * n43 + n13 * n21 * n44 - n11 * n23 * n44) * detInv;
    te[10] = (n12 * n24 * n41 - n14 * n22 * n41 + n14 * n21 * n42 - n11 * n24 * n42 - n12 * n21 * n44 + n11 * n22 * n44) * detInv;
    te[11] = (n13 * n22 * n41 - n12 * n23 * n41 - n13 * n21 * n42 + n11 * n23 * n42 + n12 * n21 * n43 - n11 * n22 * n43) * detInv;

    te[12] = t14 * detInv;
    te[13] = (n13 * n24 * n31 - n14 * n23 * n31 + n14 * n21 * n33 - n11 * n24 * n33 - n13 * n21 * n34 + n11 * n23 * n34) * detInv;
    te[14] = (n14 * n22 * n31 - n12 * n24 * n31 - n14 * n21 * n32 + n11 * n24 * n32 + n12 * n21 * n34 - n11 * n22 * n34) * detInv;
    te[15] = (n12 * n23 * n31 - n13 * n22 * n31 + n13 * n21 * n32 - n11 * n23 * n32 - n12 * n21 * n33 + n11 * n22 * n33) * detInv;

    return this;
  }

  setPosition(x: number | Vector3, y?: number, z?: number): this {
    const te = this.elements;
    if (typeof x === "number") {
      te[12] = x;
      te[13] = y ?? 0;
      te[14] = z ?? 0;
    } else {
      te[12] = x[0];
      te[13] = x[1];
      te[14] = x[2];
    }
    return this;
  }

  makeTranslation(x: number | Vector3, y?: number, z?: number): this {
    const tx = typeof x === "number" ? x : x[0];
    const ty = typeof x === "number" ? (y ?? 0) : x[1];
    const tz = typeof x === "number" ? (z ?? 0) : x[2];

    return this.set(
      1, 0, 0, tx,
      0, 1, 0, ty,
      0, 0, 1, tz,
      0, 0, 0, 1
    );
  }

  makeRotationX(theta: number): this {
    const c = Math.cos(theta), s = Math.sin(theta);
    return this.set(
      1, 0, 0, 0,
      0, c, -s, 0,
      0, s, c, 0,
      0, 0, 0, 1
    );
  }

  makeRotationY(theta: number): this {
    const c = Math.cos(theta), s = Math.sin(theta);
    return this.set(
      c, 0, s, 0,
      0, 1, 0, 0,
      -s, 0, c, 0,
      0, 0, 0, 1
    );
  }

  makeRotationZ(theta: number): this {
    const c = Math.cos(theta), s = Math.sin(theta);
    return this.set(
      c, -s, 0, 0,
      s,  c, 0, 0,
      0,  0, 1, 0,
      0,  0, 0, 1
    );
  }

  makeScale(x: number | Vector3, y?: number, z?: number): this {
    const sx = typeof x === "number" ? x : x[0];
    const sy = typeof x === "number" ? (y ?? x) : x[1];
    const sz = typeof x === "number" ? (z ?? x) : x[2];

    return this.set(
      sx, 0,  0,  0,
      0,  sy, 0,  0,
      0,  0,  sz, 0,
      0,  0,  0,  1
    );
  }

  makePerspective(left: number, right: number, top: number, bottom: number, near: number, far: number): this {
    const te = this.elements;
    const x = (2 * near) / (right - left);
    const y = (2 * near) / (top - bottom);

    const a = (right + left) / (right - left);
    const b = (top + bottom) / (top - bottom);
    const c = -(far + near) / (far - near);
    const d = -(2 * far * near) / (far - near);

    te[0] = x;  te[4] = 0;  te[8]  = a;  te[12] = 0;
    te[1] = 0;  te[5] = y;  te[9]  = b;  te[13] = 0;
    te[2] = 0;  te[6] = 0;  te[10] = c;  te[14] = d;
    te[3] = 0;  te[7] = 0;  te[11] = -1; te[15] = 0;

    return this;
  }

  makePerspectiveFOV(fovDeg: number, aspect: number, near: number, far: number): this {
    const top = near * Math.tan((fovDeg * Math.PI) / 360);
    const height = 2 * top;
    const width = aspect * height;
    const left = -0.5 * width;
    return this.makePerspective(left, left + width, top, top - height, near, far);
  }

  makeOrthographic(left: number, right: number, top: number, bottom: number, near: number, far: number): this {
    const te = this.elements;
    const w = 1 / (right - left);
    const h = 1 / (top - bottom);
    const p = 1 / (far - near);

    const x = (right + left) * w;
    const y = (top + bottom) * h;
    const z = (far + near) * p;

    te[0] = 2 * w; te[4] = 0;     te[8]  = 0;      te[12] = -x;
    te[1] = 0;     te[5] = 2 * h; te[9]  = 0;      te[13] = -y;
    te[2] = 0;     te[6] = 0;     te[10] = -2 * p; te[14] = -z;
    te[3] = 0;     te[7] = 0;     te[11] = 0;      te[15] = 1;

    return this;
  }

  /**
   * Transform a direction vector (no translation, no divide).
   * Fast path: only upper 3×3, ignores w-component.
   * Ideal for normals, tangents, light directions.
   */
  transformDirection(dir: Vector3, out?: Vector3): Vector3 {
    const te = this.elements;
    const x = dir[0], y = dir[1], z = dir[2];

    const ox = te[0]! * x + te[4]! * y + te[8]!  * z;
    const oy = te[1]! * x + te[5]! * y + te[9]!  * z;
    const oz = te[2]! * x + te[6]! * y + te[10]! * z;

    if (out) { out[0] = ox; out[1] = oy; out[2] = oz; return out; }
    return [ox, oy, oz];
  }

  /**
   * Build a view matrix (camera transform) from eye, target, up.
   * OpenGL/Three.js convention: -Z forward, +Y up.
   *
   * This computes the INVERSE of a lookAt transform (world → view).
   * For an object to "look at" a target, use .invert() after.
   */
  lookAt(eye: Vector3, target: Vector3, up: Vector3): this {
    const te = this.elements;

    // Z-axis = normalized (eye - target) → camera looks -Z
    let zx = eye[0] - target[0];
    let zy = eye[1] - target[1];
    let zz = eye[2] - target[2];

    let len = Math.sqrt(zx * zx + zy * zy + zz * zz);
    if (len === 0) {
      zz = 1;
    } else {
      len = 1 / len;
      zx *= len;
      zy *= len;
      zz *= len;
    }

    // X-axis = normalized(up × Z)
    let xx = up[1] * zz - up[2] * zy;
    let xy = up[2] * zx - up[0] * zz;
    let xz = up[0] * zy - up[1] * zx;

    len = Math.sqrt(xx * xx + xy * xy + xz * xz);
    if (len === 0) {
      // up parallel to view direction, pick arbitrary perpendicular
      if (Math.abs(up[2]) === 1) {
        zx += 0.0001;
      } else {
        zz += 0.0001;
      }
      // recalc Z
      len = Math.sqrt(zx * zx + zy * zy + zz * zz);
      len = 1 / len;
      zx *= len;
      zy *= len;
      zz *= len;
      // recalc X
      xx = up[1] * zz - up[2] * zy;
      xy = up[2] * zx - up[0] * zz;
      xz = up[0] * zy - up[1] * zx;

      len = Math.sqrt(xx * xx + xy * xy + xz * xz);
    }
    len = 1 / len;
    xx *= len;
    xy *= len;
    xz *= len;

    // Y-axis = Z × X (already normalized)
    const yx = zy * xz - zz * xy;
    const yy = zz * xx - zx * xz;
    const yz = zx * xy - zy * xx;

    // Build rotation + translation
    te[0] = xx; te[4] = yx; te[8]  = zx; te[12] = eye[0];
    te[1] = xy; te[5] = yy; te[9]  = zy; te[13] = eye[1];
    te[2] = xz; te[6] = yz; te[10] = zz; te[14] = eye[2];
    te[3] = 0;  te[7] = 0;  te[11] = 0;  te[15] = 1;

    return this;
  }

  /**
   * Compose transform from position, quaternion [x,y,z,w], and scale.
   * Result: M = T(position) · R(quaternion) · S(scale)
   *
   * Quaternion convention: [x, y, z, w] where w is the scalar part.
   */
  compose(position: Vector3, quaternion: Quaternion, scale: Vector3): this {
    const te = this.elements;

    const x = quaternion[0], y = quaternion[1], z = quaternion[2], w = quaternion[3];
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;

    const sx = scale[0], sy = scale[1], sz = scale[2];

    te[0]  = (1 - (yy + zz)) * sx;
    te[1]  = (xy + wz) * sx;
    te[2]  = (xz - wy) * sx;
    te[3]  = 0;

    te[4]  = (xy - wz) * sy;
    te[5]  = (1 - (xx + zz)) * sy;
    te[6]  = (yz + wx) * sy;
    te[7]  = 0;

    te[8]  = (xz + wy) * sz;
    te[9]  = (yz - wx) * sz;
    te[10] = (1 - (xx + yy)) * sz;
    te[11] = 0;

    te[12] = position[0];
    te[13] = position[1];
    te[14] = position[2];
    te[15] = 1;

    return this;
  }

  /**
   * Decompose matrix into position, rotation (quaternion), and scale.
   * Returns { position, quaternion, scale } or writes to out params.
   *
   * Quaternion: [x, y, z, w]
   *
   * Note: Assumes no shear/skew. If matrix has shear, scale extraction may be inaccurate.
   */
  decompose(
    outPosition?: Vector3,
    outQuaternion?: Quaternion,
    outScale?: Vector3
  ): { position: Vector3; quaternion: Quaternion; scale: Vector3 } {
    const te = this.elements;

    // Extract position (last column)
    const position: Vector3 = outPosition ?? [0, 0, 0];
    position[0] = te[12]!;
    position[1] = te[13]!;
    position[2] = te[14]!;

    // Extract scale (column magnitudes)
    let sx = Math.sqrt(te[0]! * te[0]! + te[1]! * te[1]! + te[2]! * te[2]!);
    const sy = Math.sqrt(te[4]! * te[4]! + te[5]! * te[5]! + te[6]! * te[6]!);
    const sz = Math.sqrt(te[8]! * te[8]! + te[9]! * te[9]! + te[10]! * te[10]!);

    // Check for negative scale (determinant < 0)
    const det = this.determinant();
    if (det < 0) sx = -sx;

    const scale: Vector3 = outScale ?? [0, 0, 0];
    scale[0] = sx;
    scale[1] = sy;
    scale[2] = sz;

    // Extract rotation (normalize columns, then quaternion)
    const invSX = sx === 0 ? 0 : 1 / sx;
    const invSY = sy === 0 ? 0 : 1 / sy;
    const invSZ = sz === 0 ? 0 : 1 / sz;

    const m11 = te[0]! * invSX, m12 = te[4]! * invSY, m13 = te[8]! * invSZ;
    const m21 = te[1]! * invSX, m22 = te[5]! * invSY, m23 = te[9]! * invSZ;
    const m31 = te[2]! * invSX, m32 = te[6]! * invSY, m33 = te[10]! * invSZ;

    const quaternion: Quaternion = outQuaternion ?? [0, 0, 0, 1];

    // Convert rotation matrix to quaternion (Shepperd's method)
    const trace = m11 + m22 + m33;

    if (trace > 0) {
      const s = 0.5 / Math.sqrt(trace + 1.0);
      quaternion[3] = 0.25 / s;
      quaternion[0] = (m32 - m23) * s;
      quaternion[1] = (m13 - m31) * s;
      quaternion[2] = (m21 - m12) * s;
    } else if (m11 > m22 && m11 > m33) {
      // Clamp to prevent NaN from numerical instability
      const s = 2.0 * Math.sqrt(Math.max(0, 1.0 + m11 - m22 - m33));
      quaternion[3] = (m32 - m23) / s;
      quaternion[0] = 0.25 * s;
      quaternion[1] = (m12 + m21) / s;
      quaternion[2] = (m13 + m31) / s;
    } else if (m22 > m33) {
      // Clamp to prevent NaN from numerical instability
      const s = 2.0 * Math.sqrt(Math.max(0, 1.0 + m22 - m11 - m33));
      quaternion[3] = (m13 - m31) / s;
      quaternion[0] = (m12 + m21) / s;
      quaternion[1] = 0.25 * s;
      quaternion[2] = (m23 + m32) / s;
    } else {
      // Clamp to prevent NaN from numerical instability
      const s = 2.0 * Math.sqrt(Math.max(0, 1.0 + m33 - m11 - m22));
      quaternion[3] = (m21 - m12) / s;
      quaternion[0] = (m13 + m31) / s;
      quaternion[1] = (m23 + m32) / s;
      quaternion[2] = 0.25 * s;
    }

    return { position, quaternion, scale };
  }

  /**
   * Extract the upper-left 3×3 as a Matrix3 (useful for normals).
   * Optionally takes the inverse-transpose for proper normal transformation.
   *
   * For transforming normals: normalMatrix = (M⁻¹)ᵀ = inverse transpose
   * For tangents/directions: just copy upper 3×3
   *
   * @param inverseTranspose If true, returns (M⁻¹)ᵀ for correct normal transformation
   */
  extractNormalMatrix(out?: Matrix3, inverseTranspose = true): Matrix3 {
    const result = out ?? new Matrix3();
    const te = this.elements;
    const re = result.elements;

    if (inverseTranspose) {
      // Compute inverse transpose of upper 3×3
      // For efficiency, compute inverse of 3×3 in place
      const n11 = te[0]!, n12 = te[4]!, n13 = te[8]!;
      const n21 = te[1]!, n22 = te[5]!, n23 = te[9]!;
      const n31 = te[2]!, n32 = te[6]!, n33 = te[10]!;

      const t11 = n33 * n22 - n32 * n23;
      const t12 = n32 * n13 - n33 * n12;
      const t13 = n23 * n12 - n22 * n13;

      const det = n11 * t11 + n21 * t12 + n31 * t13;

      if (Math.abs(det) < EPS) {
        return result.identity();
      }

      const detInv = 1 / det;

      // Inverse (column-major)
      const i11 = t11 * detInv;
      const i21 = (n31 * n23 - n33 * n21) * detInv;
      const i31 = (n32 * n21 - n31 * n22) * detInv;

      const i12 = t12 * detInv;
      const i22 = (n33 * n11 - n31 * n13) * detInv;
      const i32 = (n31 * n12 - n32 * n11) * detInv;

      const i13 = t13 * detInv;
      const i23 = (n21 * n13 - n23 * n11) * detInv;
      const i33 = (n22 * n11 - n21 * n12) * detInv;

      // Transpose (swap rows ↔ columns)
      re[0] = i11; re[3] = i21; re[6] = i31;
      re[1] = i12; re[4] = i22; re[7] = i32;
      re[2] = i13; re[5] = i23; re[8] = i33;
    } else {
      // Just copy upper 3×3 (for tangents/directions)
      re[0] = te[0]!; re[3] = te[4]!; re[6] = te[8]!;
      re[1] = te[1]!; re[4] = te[5]!; re[7] = te[9]!;
      re[2] = te[2]!; re[5] = te[6]!; re[8] = te[10]!;
    }

    return result;
  }

  /**
   * Transforms a point (x,y,z,1) with perspective divide.
   */
  transformPoint(point: Vector3, out?: Vector3): Vector3 {
    const te = this.elements;
    const x = point[0], y = point[1], z = point[2];

    const iw = 1 / (te[3]! * x + te[7]! * y + te[11]! * z + te[15]!);

    const ox = (te[0]! * x + te[4]! * y + te[8]! * z + te[12]!) * iw;
    const oy = (te[1]! * x + te[5]! * y + te[9]! * z + te[13]!) * iw;
    const oz = (te[2]! * x + te[6]! * y + te[10]! * z + te[14]!) * iw;

    if (out) { out[0] = ox; out[1] = oy; out[2] = oz; return out; }
    return [ox, oy, oz];
  }

  equals(matrix: Matrix4): boolean {
    const te = this.elements;
    const me = matrix.elements;
    for (let i = 0; i < 16; i++) if (te[i]! !== me[i]!) return false;
    return true;
  }

  equalsEpsilon(matrix: Matrix4, eps = EPS): boolean {
    const te = this.elements;
    const me = matrix.elements;
    for (let i = 0; i < 16; i++) if (!nearlyEqual(te[i]!, me[i]!, eps)) return false;
    return true;
  }

  fromArray(array: ArrayLike<number>, offset = 0): this {
    const te = this.elements;
    for (let i = 0; i < 16; i++) te[i] = array[offset + i]!;
    return this;
  }

  toArray(array: number[] = [], offset = 0): number[] {
    const te = this.elements;
    for (let i = 0; i < 16; i++) array[offset + i] = te[i]!;
    return array;
  }

  toString(): string {
    const te = this.elements;
    return `Matrix4(
  ${te[0]!.toFixed(4)}, ${te[4]!.toFixed(4)}, ${te[8]!.toFixed(4)}, ${te[12]!.toFixed(4)}
  ${te[1]!.toFixed(4)}, ${te[5]!.toFixed(4)}, ${te[9]!.toFixed(4)}, ${te[13]!.toFixed(4)}
  ${te[2]!.toFixed(4)}, ${te[6]!.toFixed(4)}, ${te[10]!.toFixed(4)}, ${te[14]!.toFixed(4)}
  ${te[3]!.toFixed(4)}, ${te[7]!.toFixed(4)}, ${te[11]!.toFixed(4)}, ${te[15]!.toFixed(4)}
)`;
  }
}
