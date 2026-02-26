/**
 * Hash utilities for deterministic avatar identification
 * Uses SHA-256 for content-addressed storage and versioning.
 */
import crypto from "node:crypto";

export function sha256HexBytes(bytes: Uint8Array): string {
  const h = crypto.createHash("sha256");
  h.update(bytes);
  return h.digest("hex");
}

export function sha256HexString(s: string): string {
  const h = crypto.createHash("sha256");
  h.update(s, "utf8");
  return h.digest("hex");
}

/**
 * Canonical JSON encoding (matches Python json.dumps with sort_keys=True)
 * Deterministic: same object → same canonical form
 */
function canonicalJson(obj: unknown): string {
  const sorted = sortKeys(obj);
  const str = JSON.stringify(sorted);
  // Remove all whitespace except within strings
  let result = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      result += char;
      escaped = true;
      continue;
    }
    if (char === '"') {
      result += char;
      inString = !inString;
      continue;
    }
    if (!inString && /\s/.test(char)) {
      continue;
    }
    result += char;
  }
  return result;
}

function sortKeys(obj: unknown): unknown {
  if (typeof obj !== "object" || obj === null || obj instanceof Date) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sortKeys);
  }
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = sortKeys((obj as Record<string, unknown>)[key]);
  }
  return sorted;
}

/**
 * Compute SHA-256 hash of object (deterministic via canonical JSON).
 */
export function hashObject(obj: unknown): string {
  const canonical = canonicalJson(obj);
  return crypto.createHash("sha256").update(canonical, "utf-8").digest("hex");
}

/**
 * Compute SHA-256 hash of buffer.
 */
export function hashBuffer(buf: ArrayBuffer | Uint8Array): string {
  let data: Uint8Array;
  if (buf instanceof ArrayBuffer) {
    data = new Uint8Array(buf);
  } else {
    data = buf;
  }
  return crypto.createHash("sha256").update(data).digest("hex");
}
