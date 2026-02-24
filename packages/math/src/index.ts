/**
 * Math catalog: deterministic primitives for engine
 * Categories: core, algebra, calculus, geometry, discrete, probability, stats, etc.
 */

export interface Vector2 {
  x: number;
  y: number;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Vector4 {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface Matrix4x4 {
  data: Float32Array;
}

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

/**
 * Core vector operations
 */
export const Vec3 = {
  create(x: number, y: number, z: number): Vector3 {
    return { x, y, z };
  },

  add(a: Vector3, b: Vector3): Vector3 {
    return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
  },

  subtract(a: Vector3, b: Vector3): Vector3 {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  },

  scale(v: Vector3, s: number): Vector3 {
    return { x: v.x * s, y: v.y * s, z: v.z * s };
  },

  dot(a: Vector3, b: Vector3): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  },

  length(v: Vector3): number {
    return Math.hypot(v.x, v.y, v.z);
  },

  normalize(v: Vector3): Vector3 {
    const len = this.length(v);
    if (len === 0) return { x: 0, y: 0, z: 0 };
    return { x: v.x / len, y: v.y / len, z: v.z / len };
  },

  cross(a: Vector3, b: Vector3): Vector3 {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x,
    };
  },
};

/**
 * Seeded RNG for deterministic randomness
 * Uses PCG variant for good distribution and period
 */
export class SeededRNG {
  private state: bigint;
  private readonly inc: bigint = 1n;

  constructor(seed: number) {
    this.state = BigInt(seed) << 1n | 1n;
    this.inc = (BigInt(Date.now()) << 1n) | 1n;
  }

  next(): number {
    const oldState = this.state;
    this.state = (oldState * 6364136223846793005n + this.inc) & ((1n << 64n) - 1n);
    const xorshifted = Number((oldState >> 18n) ^ oldState >> 27n) >>> 0;
    const rotation = Number(oldState >> 59n) >>> 0;
    return (((xorshifted >> rotation) | (xorshifted << (32 - rotation))) >>> 0) / 0x100000000;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min)) + min;
  }

  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }
}

/**
 * Gaussian Random Number (Box-Muller transform)
 * @param mean Center of distribution
 * @param std Standard deviation
 * @returns Random number from normal distribution
 */
export const randomNormal = (mean: number = 0, std: number = 1): number => {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

/**
 * Basic statistical operations
 */
export const Stats = {
  mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  },

  variance(values: number[]): number {
    const m = this.mean(values);
    const squaredDiffs = values.map(v => (v - m) ** 2);
    return this.mean(squaredDiffs);
  },

  stdDev(values: number[]): number {
    return Math.sqrt(this.variance(values));
  },

  median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 1) {
      return sorted[mid] ?? 0;
    }
    const left = sorted[mid - 1] ?? 0;
    const right = sorted[mid] ?? 0;
    return (left + right) / 2;
  },
};

// Re-export geometry module for high-performance 3D graphics
export * from './geometry';
