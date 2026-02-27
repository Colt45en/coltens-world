/**
 * Deterministic Core Primitives
 *
 * Ensures same object → same JSON representation → same hash, always.
 * No randomness, no undefined, stable key ordering.
 */

import crypto from "node:crypto";

export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [k: string]: Json };

/**
 * Recursively canonicalize a value to JSON-compatible form.
 * - Drops undefined (deterministically)
 * - Sorts object keys alphabetically
 * - Preserves null, bools, numbers, strings, arrays
 */
export function canonicalize(value: unknown): unknown {
  if (value === null) return null;
  if (value === undefined) return undefined; // Will be dropped during stringify

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`Non-finite number not allowed in canonical JSON: ${value}`);
    }
    return value;
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const out: Record<string, unknown> = {};
    for (const k of keys) {
      const v = obj[k];
      if (typeof v === "undefined") continue; // drop undefined deterministically
      const c = canonicalize(v);
      if (typeof c !== "undefined") {
        out[k] = c;
      }
    }
    return out;
  }

  throw new Error(`Unsupported type in canonical JSON: ${typeof value}`);
}

/**
 * Deterministic JSON stringify: sorted keys, no undefined.
 * Same object → same string, always.
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

/**
 * SHA256 hash of input, returned as lowercase hex string.
 */
export function sha256Hex(input: string | Uint8Array): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

/**
 * Content-addressed ID: <prefix>_<sha256(canonical_json(payload))>
 *
 * Same payload → same ID, enabling deduplication and deterministic naming.
 */
export function contentAddressedId(prefix: string, payload: unknown): string {
  const canonical = stableStringify(payload);
  const hash = sha256Hex(canonical);
  return `${prefix}_${hash}`;
}

/**
 * Compare two values by their canonical forms (for equality checks).
 */
export function canonicalEqual(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b);
}
