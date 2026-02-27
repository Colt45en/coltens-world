/**
 * Helpers & Utilities
 * Common functions for WEGC operations
 */

import { createHash } from "node:crypto";
import type { Quat as QuatType, Vec3 as Vec3Type } from "./contract.types.js";

/**
 * Compute SHA256 hash of canonical state
 */
export function hashCanonicalState(state: string): string {
  return createHash("sha256").update(state).digest("hex");
}

/**
 * Canonical stringify for deterministic hashing
 */
export function canonicalStringify(obj: any): string {
  if (typeof obj !== "object" || obj === null) {
    if (typeof obj === "string") return JSON.stringify(obj);
    if (typeof obj === "number") {
      // Round to fixed precision for stability
      if (!Number.isFinite(obj)) return "null";
      return Math.round(obj * 1e10) / 1e10 + "";
    }
    return String(obj);
  }

  if (Array.isArray(obj)) {
    return "[" + obj.map((v) => canonicalStringify(v)).join(",") + "]";
  }

  // Sort keys deterministically
  const keys = Object.keys(obj).sort();
  let result = "{";

  for (let i = 0; i < keys.length; i++) {
    if (i > 0) result += ",";
    const key = keys[i]!;
    result += JSON.stringify(key) + ":" + canonicalStringify(obj[key]);
  }

  result += "}";
  return result;
}

/**
 * Validate avatar ID format
 */
export function isValidAvatarId(id: string): boolean {
  return /^[a-z0-9]{8,32}$/.test(id);
}

/**
 * Generate unique avatar ID
 */
export function generateAvatarId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";

  for (let i = 0; i < 16; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }

  return result;
}

/**
 * Clamp value to range
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Vec3 operations
 */
export const Vec3 = {
  zero: (): Vec3Type => ({ x: 0, y: 0, z: 0 }),
  one: (): Vec3Type => ({ x: 1, y: 1, z: 1 }),
  distance: (a: Vec3Type, b: Vec3Type): number => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  },
  magnitude: (v: Vec3Type): number => {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  },
  normalize: (v: Vec3Type): Vec3Type => {
    const mag = Vec3.magnitude(v);
    if (mag < 0.0001) return { x: 0, y: 0, z: 0 };
    return { x: v.x / mag, y: v.y / mag, z: v.z / mag };
  },
  add: (a: Vec3Type, b: Vec3Type): Vec3Type => ({
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z,
  }),
  subtract: (a: Vec3Type, b: Vec3Type): Vec3Type => ({
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z,
  }),
  scale: (v: Vec3Type, s: number): Vec3Type => ({
    x: v.x * s,
    y: v.y * s,
    z: v.z * s,
  }),
  dot: (a: Vec3Type, b: Vec3Type): number => {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  },
  cross: (a: Vec3Type, b: Vec3Type): Vec3Type => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }),
  lerp: (a: Vec3Type, b: Vec3Type, t: number): Vec3Type => ({
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
  }),
};

/**
 * Quat operations
 */
export const Quat = {
  identity: (): QuatType => ({ x: 0, y: 0, z: 0, w: 1 }),
  multiply: (a: QuatType, b: QuatType): QuatType => ({
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  }),
  inverse: (q: QuatType): QuatType => {
    const len2 = q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w;
    return {
      x: -q.x / len2,
      y: -q.y / len2,
      z: -q.z / len2,
      w: q.w / len2,
    };
  },
  conjugate: (q: QuatType): QuatType => ({
    x: -q.x,
    y: -q.y,
    z: -q.z,
    w: q.w,
  }),
  normalize: (q: QuatType): QuatType => {
    const len = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
    if (len < 0.0001) return Quat.identity();
    return {
      x: q.x / len,
      y: q.y / len,
      z: q.z / len,
      w: q.w / len,
    };
  },
  fromAxisAngle: (axis: Vec3Type, angle: number): QuatType => {
    const halfAngle = angle / 2;
    const sin = Math.sin(halfAngle);
    return {
      x: axis.x * sin,
      y: axis.y * sin,
      z: axis.z * sin,
      w: Math.cos(halfAngle),
    };
  },
};

/**
 * Timing utilities
 */
export const Time = {
  now: (): number => Date.now(),
  nanoNow: (): number => process.hrtime.bigint().toString().slice(-9) as any, // Platform specific
  deltaSeconds: (startMs: number, endMs: number = Date.now()): number => (endMs - startMs) / 1000,
};

/**
 * Assert deterministic behavior
 */
export function assertDeterministic(runs: any[][], fieldName: string): boolean {
  if (runs.length < 2) return true;

  const first = canonicalStringify(runs[0]);

  for (let i = 1; i < runs.length; i++) {
    const current = canonicalStringify(runs[i]);
    if (first !== current) {
      console.warn(`Determinism violation in ${fieldName}: Run 0 != Run ${i}`);
      return false;
    }
  }

  return true;
}
