/**
 * Vector3 - Full-featured 3D vector mathematics
 *
 * Production-grade 3D vector with:
 * - Complete arithmetic operators (+, -, *, /, negate)
 * - Geometric operations (dot, cross, normalize, distance)
 * - Safe handling (no silent failures on divide-by-zero)
 * - Immutable operations (returns new vectors)
 */

export class Vector3 {
  constructor(
    public x: number = 0,
    public y: number = 0,
    public z: number = 0
  ) {}

  // ============================================================================
  // STATIC CONSTRUCTORS
  // ============================================================================

  static readonly zero = new Vector3(0, 0, 0);
  static readonly one = new Vector3(1, 1, 1);
  static readonly up = new Vector3(0, 1, 0);
  static readonly down = new Vector3(0, -1, 0);
  static readonly left = new Vector3(-1, 0, 0);
  static readonly right = new Vector3(1, 0, 0);
  static readonly forward = new Vector3(0, 0, 1);
  static readonly back = new Vector3(0, 0, -1);

  static from(x: number, y: number, z: number): Vector3 {
    return new Vector3(x, y, z);
  }

  static fromArray(arr: [number, number, number]): Vector3 {
    return new Vector3(arr[0], arr[1], arr[2]);
  }

  // ============================================================================
  // ARITHMETIC OPERATORS
  // ============================================================================

  add(other: Vector3): Vector3 {
    return new Vector3(this.x + other.x, this.y + other.y, this.z + other.z);
  }

  subtract(other: Vector3): Vector3 {
    return new Vector3(this.x - other.x, this.y - other.y, this.z - other.z);
  }

  multiply(scalar: number): Vector3 {
    return new Vector3(this.x * scalar, this.y * scalar, this.z * scalar);
  }

  divide(scalar: number): Vector3 {
    if (scalar === 0) {
      throw new Error("Vector3: Division by zero");
    }
    const inv = 1.0 / scalar;
    return new Vector3(this.x * inv, this.y * inv, this.z * inv);
  }

  negate(): Vector3 {
    return new Vector3(-this.x, -this.y, -this.z);
  }

  // ============================================================================
  // GEOMETRIC OPERATIONS
  // ============================================================================

  dot(other: Vector3): number {
    return this.x * other.x + this.y * other.y + this.z * other.z;
  }

  cross(other: Vector3): Vector3 {
    return new Vector3(
      this.y * other.z - this.z * other.y,
      this.z * other.x - this.x * other.z,
      this.x * other.y - this.y * other.x
    );
  }

  magnitude(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  magnitudeSquared(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  normalize(): Vector3 {
    const mag = this.magnitude();
    if (mag === 0) {
      return Vector3.zero;
    }
    return this.divide(mag);
  }

  distanceTo(other: Vector3): number {
    return this.subtract(other).magnitude();
  }

  distanceSquaredTo(other: Vector3): number {
    return this.subtract(other).magnitudeSquared();
  }

  // ============================================================================
  // INTERPOLATION & TRANSFORMS
  // ============================================================================

  lerp(other: Vector3, t: number): Vector3 {
    return this.add(other.subtract(this).multiply(t));
  }

  clamp(min: Vector3, max: Vector3): Vector3 {
    return new Vector3(
      Math.max(min.x, Math.min(max.x, this.x)),
      Math.max(min.y, Math.min(max.y, this.y)),
      Math.max(min.z, Math.min(max.z, this.z))
    );
  }

  // ============================================================================
  // SPHERICAL COORDINATES
  // ============================================================================

  /**
   * Convert from spherical to Cartesian
   * @param radius - Distance from origin
   * @param yaw - Horizontal angle (radians, 0 = +X axis)
   * @param pitch - Vertical angle (radians, 0 = XZ plane)
   */
  static fromSpherical(radius: number, yaw: number, pitch: number): Vector3 {
    const cosPitch = Math.cos(pitch);
    return new Vector3(
      radius * cosPitch * Math.cos(yaw),
      radius * Math.sin(pitch),
      radius * cosPitch * Math.sin(yaw)
    );
  }

  toSpherical(): { radius: number; yaw: number; pitch: number } {
    const radius = this.magnitude();
    const yaw = Math.atan2(this.z, this.x);
    const pitch = Math.asin(this.y / (radius || 1));
    return { radius, yaw, pitch };
  }

  // ============================================================================
  // UTILITY
  // ============================================================================

  equals(other: Vector3, epsilon = 1e-6): boolean {
    return (
      Math.abs(this.x - other.x) < epsilon &&
      Math.abs(this.y - other.y) < epsilon &&
      Math.abs(this.z - other.z) < epsilon
    );
  }

  clone(): Vector3 {
    return new Vector3(this.x, this.y, this.z);
  }

  toArray(): [number, number, number] {
    return [this.x, this.y, this.z];
  }

  toString(decimals = 2): string {
    return `Vector3(${this.x.toFixed(decimals)}, ${this.y.toFixed(
      decimals
    )}, ${this.z.toFixed(decimals)})`;
  }

  // ============================================================================
  // STATIC UTILITIES
  // ============================================================================

  static min(a: Vector3, b: Vector3): Vector3 {
    return new Vector3(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.min(a.z, b.z));
  }

  static max(a: Vector3, b: Vector3): Vector3 {
    return new Vector3(Math.max(a.x, b.x), Math.max(a.y, b.y), Math.max(a.z, b.z));
  }

  static angle(a: Vector3, b: Vector3): number {
    const denom = Math.sqrt(a.magnitudeSquared() * b.magnitudeSquared());
    const EPS = 1e-10;
    if (Math.abs(denom) < EPS) return 0; // Use epsilon comparison for floating point
    const cosTheta = Math.max(-1, Math.min(1, a.dot(b) / denom));
    return Math.acos(cosTheta);
  }

  static project(a: Vector3, b: Vector3): Vector3 {
    const bMagSq = b.magnitudeSquared();
    if (bMagSq === 0) return Vector3.zero;
    return b.multiply(a.dot(b) / bMagSq);
  }

  static reflect(incident: Vector3, normal: Vector3): Vector3 {
    return incident.subtract(normal.multiply(2 * incident.dot(normal)));
  }
}
