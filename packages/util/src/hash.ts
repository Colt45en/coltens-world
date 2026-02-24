/**
 * Browser-safe hashing utilities.
 * - Prefers WebCrypto SHA-256 when available (modern browsers, Node 15+).
 * - Falls back to deterministic FNV-1a 32-bit hash when not (not cryptographically strong, but deterministic).
 */

// Ensure TextEncoder is available in Node.js environment
function getTextEncoder(): typeof TextEncoder | null {
  // Check if TextEncoder is globally available (browser or Node 18+)
  if (typeof globalThis !== "undefined" && (globalThis as { TextEncoder?: typeof TextEncoder }).TextEncoder) {
    return (globalThis as { TextEncoder: typeof TextEncoder }).TextEncoder;
  }
  // Return null if unavailable; we'll handle it in utf8Bytes
  return null;
}

const TextEncoderImpl = getTextEncoder();

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const element of bytes) {
    out += element!.toString(16).padStart(2, "0");
  }
  return out;
}

function utf8Bytes(s: string): Uint8Array {
  if (TextEncoderImpl) {
    return new TextEncoderImpl().encode(s);
  }
  // Extremely rare fallback; keep deterministic
  const arr = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) {
    arr[i] = s.codePointAt(i)! & 0xff;
  }
  return arr;
}

/**
 * FNV-1a 32-bit hash (deterministic fallback, NOT cryptographic).
 * Used when WebCrypto is unavailable.
 */
function fnv1a32(input: Uint8Array): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input[i]!;
    hash = Math.imul(hash, 0x01000193);
  }
  // unsigned 32-bit hex
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export const HashTools = {
  /**
   * Hash content to hex string.
   * - Uses SHA-256 if WebCrypto is available.
   * - Falls back to FNV-1a 32-bit if not.
   * - Optionally truncate to `prefixLen` characters.
   */
  async hashHex(
    content: string | Uint8Array,
    opts?: { prefixLen?: number }
  ): Promise<string> {
    const bytes = typeof content === "string" ? utf8Bytes(content) : content;

    const hasWebCrypto =
      typeof globalThis !== "undefined" &&
      !!(globalThis as any).crypto &&
      !!(globalThis as any).crypto.subtle &&
      typeof (globalThis as any).crypto.subtle.digest === "function";

    let hex: string;

    if (hasWebCrypto) {
      try {
        // Create a new ArrayBuffer to avoid SharedArrayBuffer issues
        const safeBytes = new Uint8Array(bytes);
        const buf = await globalThis.crypto!.subtle!.digest("SHA-256", safeBytes);
        hex = toHex(new Uint8Array(buf as ArrayBuffer));
      } catch {
        // Fallback if digest fails
        hex = fnv1a32(bytes);
      }
    } else {
      hex = fnv1a32(bytes);
    }

    const n = opts?.prefixLen ?? 0;
    return n > 0 ? hex.slice(0, n) : hex;
  },
} as const;
