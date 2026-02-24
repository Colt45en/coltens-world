import type { AvatarDNA } from "./types.js";

function isPlainObject(v: any): v is Record<string, any> {
  return v !== null && typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype;
}

export function roundToStep(n: number, step: number): number {
  if (!Number.isFinite(n)) return n;
  return Math.round(n / step) * step;
}

export function canonicalize(value: any, quantizeStep: number): any {
  if (value === null || value === undefined) return value;

  if (typeof value === "number") return roundToStep(value, quantizeStep);

  if (typeof value === "string" || typeof value === "boolean") return value;

  if (Array.isArray(value)) return value.map(v => canonicalize(v, quantizeStep));

  if (isPlainObject(value)) {
    const keys = Object.keys(value).sort();
    const out: Record<string, any> = {};
    for (const k of keys) out[k] = canonicalize(value[k], quantizeStep);
    return out;
  }

  // reject non-JSON types for determinism
  throw new Error(`Non-JSON value in canonicalize: ${Object.prototype.toString.call(value)}`);
}

export function canonicalJSONStringify(obj: any): string {
  // JSON.stringify is deterministic given stable key order and stable numbers
  return JSON.stringify(obj);
}

export function canonicalDNA(dna: AvatarDNA, quantizeStep: number): string {
  const c = canonicalize(dna, quantizeStep);
  return canonicalJSONStringify(c);
}
