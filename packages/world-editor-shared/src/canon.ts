/**
 * Canonical sort key generation & deterministic hashing
 * Ensures reproducible, locale-free sorting for documents
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
 * Locale-free canonical sort normalization:
 * - NFKD decomposition
 * - strip diacritics (combining marks)
 * - lowercase
 * - keep letters/numbers => spaces
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
 * Build a deterministic sort key from multiple fields.
 * Returns: { raw (original combined text), key (normalized for sorting), tie (hash for tiebreaking) }
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
