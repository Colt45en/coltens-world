import * as crypto from "node:crypto";

/**
 * ContentAddressingService: Compute deterministic SHA-256 hashes
 *
 * Role: Deterministic content-addressing for snapshot deduplication
 * Rule: Same canonical_json → same hash (always)
 *
 * Note: Uses RFC 8785 canonical JSON (caller is responsible for canonical form)
 */
export class ContentAddressingService {
  constructor() {}

  /**
   * Compute SHA-256 hash of a canonical JSON string
   * Returns hex-encoded hash (lowercase)
   */
  hashCanonicalJson(canonical_json: string): string {
    const hash = crypto.createHash("sha256");
    hash.update(canonical_json, "utf-8");
    return hash.digest("hex");
  }

  /**
   * Compute SHA-256 hash of any UTF-8 string
   */
  hashString(data: string): string {
    const hash = crypto.createHash("sha256");
    hash.update(data, "utf-8");
    return hash.digest("hex");
  }

  /**
   * Compute SHA-256 hash of binary data (Buffer)
   */
  hashBuffer(data: Buffer): string {
    const hash = crypto.createHash("sha256");
    hash.update(data);
    return hash.digest("hex");
  }

  /**
   * Verify that a hash matches a canonical_json
   * Used for integrity checking
   */
  verify(canonical_json: string, expected_hash: string): boolean {
    const computed_hash = this.hashCanonicalJson(canonical_json);
    return computed_hash === expected_hash;
  }

  /**
   * Create a content-addressed ID using a prefix
   * Format: "prefix:hash"
   */
  createContentAddressedId(prefix: string, canonical_json: string): string {
    const hash = this.hashCanonicalJson(canonical_json);
    return `${prefix}:${hash}`;
  }

  /**
   * Compare two hashes (handles case-insensitive comparison)
   */
  compareHashes(hash1: string, hash2: string): boolean {
    return hash1.toLowerCase() === hash2.toLowerCase();
  }
}
