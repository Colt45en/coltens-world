import crypto from 'node:crypto';
import { toCanonicalJson } from './canonical-json';

/**
 * Compute SHA-256 hash of canonical JSON representation
 * @param payload The value to hash
 * @returns hex-encoded SHA-256 digest
 */
export function hashPayload(payload: unknown): string {
  const canonical = toCanonicalJson(payload);
  return hashString(canonical);
}

/**
 * Compute SHA-256 hash of a UTF-8 string
 * @param data The string to hash
 * @returns hex-encoded SHA-256 digest
 */
export function hashString(data: string): string {
  return crypto.createHash('sha256').update(data, 'utf-8').digest('hex');
}

/**
 * Compute SHA-256 hash of raw bytes
 * @param data The bytes to hash
 * @returns hex-encoded SHA-256 digest
 */
export function hashBytes(data: Buffer | Uint8Array): string {
  return crypto.createHash('sha256').update(Buffer.from(data)).digest('hex');
}

/**
 * Verify that a payload matches a known hash
 * @param payload The value to verify
 * @param expectedHash The expected SHA-256 hash (hex)
 * @returns true if hash matches, false otherwise
 */
export function verifyPayloadHash(payload: unknown, expectedHash: string): boolean {
  const computed = hashPayload(payload);
  return computed === expectedHash;
}

/**
 * Hash a set of hashes together deterministically
 * Useful for combining input hashes into a composite hash
 * @param hashes Array of hex-encoded SHA-256 hashes
 * @returns Combined hash
 */
export function combineHashes(hashes: string[]): string {
  // Sort hashes to ensure deterministic ordering
  const sorted = [...hashes].sort();
  return hashString(sorted.join(''));
}

/**
 * Compute a deterministic hash for a list of items
 * @param items Items that will be JSON-canonicalized
 * @returns Combined hash of all items (order-sensitive)
 */
export function hashList<T>(items: T[]): string {
  const canonical = toCanonicalJson(items);
  return hashString(canonical);
}

/**
 * Content-addressed ID generator
 * Produces stable IDs for entities based on their canonical representation
 */
export function generateContentId(prefix: string, payload: unknown): string {
  const hash = hashPayload(payload);
  return `${prefix}:${hash}`;
}
