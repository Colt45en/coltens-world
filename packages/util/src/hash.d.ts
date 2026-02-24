/**
 * Browser-safe hashing utilities.
 * - Prefers WebCrypto SHA-256 when available (modern browsers, Node 15+).
 * - Falls back to deterministic FNV-1a 32-bit hash when not (not cryptographically strong, but deterministic).
 */
export declare const HashTools: {
    /**
     * Hash content to hex string.
     * - Uses SHA-256 if WebCrypto is available.
     * - Falls back to FNV-1a 32-bit if not.
     * - Optionally truncate to `prefixLen` characters.
     */
    readonly hashHex: (content: string | Uint8Array, opts?: {
        prefixLen?: number;
    }) => Promise<string>;
};
//# sourceMappingURL=hash.d.ts.map