/**
 * RFC 8785 JSON Canonicalization Scheme (JCS)
 * Produces stable, hashable JSON representation suitable for cryptographic operations.
 *
 * Rules:
 * - Object keys sorted lexicographically
 * - Arrays preserve order UNLESS reordered per contract
 * - No whitespace except within strings
 * - UTF-8 encoding
 * - \n line endings
 */

export interface CanonicalJsonOptions {
  /**
   * If true, sort array elements by their string representation.
   * Only use if contract declares order is non-meaningful.
   */
  sortArrays?: boolean;
}

/**
 * Sort object keys lexicographically (RFC 8785 rule)
 */
function sortKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(v => sortKeys(v));

  const sorted: Record<string, unknown> = {};
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  for (const key of keys) {
    sorted[key] = sortKeys((obj as Record<string, unknown>)[key]);
  }
  return sorted;
}

/**
 * Stringify to canonical form (no whitespace, quoted strings, minimal representation)
 */
function stringifyCanonical(obj: unknown): string {
  if (obj === null) return 'null';
  if (typeof obj === 'boolean') return obj ? 'true' : 'false';
  if (typeof obj === 'number') {
    if (!isFinite(obj)) {
      throw new Error(`Invalid number: ${obj}`);
    }
    // Use JSON.stringify to get consistent number formatting
    return JSON.stringify(obj);
  }
  if (typeof obj === 'string') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    const elements = obj.map(v => stringifyCanonical(v));
    return '[' + elements.join(',') + ']';
  }
  if (typeof obj === 'object') {
    // Sort keys for objects
    const sorted = sortKeys(obj) as Record<string, unknown>;
    const pairs: string[] = [];
    for (const key of Object.keys(sorted)) {
      const value = stringifyCanonical(sorted[key]);
      pairs.push(JSON.stringify(key) + ':' + value);
    }
    return '{' + pairs.join(',') + '}';
  }
  throw new Error(`Cannot canonicalize: ${typeof obj}`);
}

/**
 * Convert any value to canonical JSON bytes (UTF-8)
 * @param payload The value to canonicalize
 * @param options Additional canonicalization rules
 * @returns UTF-8 encoded canonical JSON
 */
export function toCanonicalJson(
  payload: unknown,
  options?: CanonicalJsonOptions
): string {
  let prepared = payload;

  // Sort keys first
  prepared = sortKeys(prepared);

  // Optionally sort arrays (if contract says order is non-meaningful)
  if (options?.sortArrays) {
    prepared = sortArrays(prepared);
  }

  // Stringify without whitespace
  const canonical = stringifyCanonical(prepared);
  return canonical;
}

/**
 * Recursively sort array elements by their canonical string representation
 */
function sortArrays(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    // Sort by canonical string representation of each element
    const sorted = obj
      .map(v => sortArrays(v))
      .sort((a, b) => {
        const aStr = stringifyCanonical(a);
        const bStr = stringifyCanonical(b);
        return aStr.localeCompare(bStr);
      });
    return sorted;
  }

  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    result[key] = sortArrays((obj as Record<string, unknown>)[key]);
  }
  return result;
}

/**
 * Verify that a string is valid canonical JSON (normalized form)
 * @param jsonStr The string to verify
 * @returns true if it matches canonical form, false otherwise
 */
export function isCanonical(jsonStr: string): boolean {
  try {
    const parsed = JSON.parse(jsonStr);
    const canonical = toCanonicalJson(parsed);
    return jsonStr === canonical;
  } catch {
    return false;
  }
}

/**
 * Pretty-print JSON for debugging (not for hashing or transport)
 */
export function toPrettyJson(payload: unknown): string {
  const canonical = toCanonicalJson(payload);
  return JSON.stringify(JSON.parse(canonical), null, 2);
}
