/**
 * Canonicalization & Stable Hashing
 * Deterministic key generation for sorting and deduplication
 */

import type { Json } from "../contracts/formatting.js";

/**
 * FNV-1a 64-bit hash (deterministic, non-cryptographic)
 * Used for stable tie-breaking in sort keys
 */
export function fnv1a64Hex(input: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const bytes = new TextEncoder().encode(input);
  for (const b of bytes) {
    hash ^= BigInt(b);
    hash = (hash * prime) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, "0");
}

/**
 * Stable JSON stringify with lexicographically sorted object keys.
 * Produces the same output for equivalent objects regardless of insertion order.
 */
export function stableStringify(v: Json): string {
  if (v === null) return "null";
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : JSON.stringify(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;

  const obj = v as Record<string, Json>;
  const keys = Object.keys(obj).sort();
  const body = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k] ?? null)}`).join(",");
  return `{${body}}`;
}

/**
 * Normalize for sorting keys:
 * - Unicode NFKD decomposition
 * - strip combining marks (diacritics)
 * - lowercase
 * - keep letters/numbers, collapse others to spaces
 * - collapse whitespace
 *
 * Result is locale-independent and can be safely compared across systems.
 */
export function normalizeForKey(s: string): string {
  let t = s.normalize("NFKD");
  t = t.replace(/\p{M}/gu, "");
  t = t.toLowerCase();
  t = t.replace(/[^\p{L}\p{N}]+/gu, " ");
  t = t.trim().replace(/\s+/g, " ");
  return t;
}
