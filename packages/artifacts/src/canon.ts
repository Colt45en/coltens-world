import { createHash } from "node:crypto";

/**
 * FNV-1a inspired: deterministic tie-breaking
 * Uses SHA256 sliced (more portable than BigInt)
 */
export function fnv1a64Hex(input: string): string {
  const h = createHash("sha256").update(input).digest("hex");
  return h.slice(0, 16);
}

/**
 * Locale-free canonical sort normalization:
 * - NFKD decomposition
 * - strip diacritics (combining marks)
 * - lowercase
 * - keep letters/numbers only
 * - collapse whitespace
 */
export function normalizeForKey(s: string): string {
  let t = s.normalize("NFKD");
  t = t.replace(/\p{M}/gu, "");
  t = t.toLowerCase();
  t = t.replace(/[^\p{L}\p{N}]+/gu, " ");
  t = t.trim().replace(/\s+/g, " ");
  return t;
}

/**
 * Build a deterministic sort key from multiple fields
 * Result: { raw (original), key (normalized), tie (hash for tiebreaking) }
 */
export function buildCanonicalSortKey(
  fields: string[],
  tieId: string
): { raw: string; key: string; tie: string } {
  const raw = fields.map((x) => x.trim()).filter(Boolean).join(" ");
  const key = normalizeForKey(raw);
  const tie = fnv1a64Hex(tieId);
  return { raw, key, tie };
}
