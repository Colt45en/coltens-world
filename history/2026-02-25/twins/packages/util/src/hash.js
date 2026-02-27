/**
 * Browser-safe hashing utilities.
 * - Prefers WebCrypto SHA-256 when available (modern browsers, Node 15+).
 * - Falls back to deterministic FNV-1a 32-bit hash when not (not cryptographically strong, but deterministic).
 */
function toHex(bytes) {
    let out = "";
    for (let i = 0; i < bytes.length; i++) {
        out += bytes[i].toString(16).padStart(2, "0");
    }
    return out;
}
function utf8Bytes(s) {
    if (typeof TextEncoder !== "undefined") {
        return new TextEncoder().encode(s);
    }
    // Extremely rare fallback; keep deterministic
    const arr = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) {
        arr[i] = s.charCodeAt(i) & 0xff;
    }
    return arr;
}
/**
 * FNV-1a 32-bit hash (deterministic fallback, NOT cryptographic).
 * Used when WebCrypto is unavailable.
 */
function fnv1a32(input) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
        hash ^= input[i];
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
    async hashHex(content, opts) {
        const bytes = typeof content === "string" ? utf8Bytes(content) : content;
        const hasWebCrypto = typeof globalThis !== "undefined" &&
            !!globalThis.crypto &&
            !!globalThis.crypto.subtle &&
            typeof globalThis.crypto.subtle.digest === "function";
        let hex;
        if (hasWebCrypto) {
            try {
                // Create a new ArrayBuffer to avoid SharedArrayBuffer issues
                const safeBytes = new Uint8Array(bytes);
                const buf = await globalThis.crypto.subtle.digest("SHA-256", safeBytes);
                hex = toHex(new Uint8Array(buf));
            }
            catch {
                // Fallback if digest fails
                hex = fnv1a32(bytes);
            }
        }
        else {
            hex = fnv1a32(bytes);
        }
        const n = opts?.prefixLen ?? 0;
        return n > 0 ? hex.slice(0, n) : hex;
    },
};
