import crypto from 'node:crypto';

/**
 * Chat Determinism Utilities
 *
 * Provides:
 * - Vector clocks for causal ordering across channels
 * - Deterministic hashing for messages, presence, sessions
 * - Stable sorting for snapshots + batch operations
 * - Canonical JSON serialization
 */

/**
 * Vector Clock — tracks causal relationships
 *
 * Each user maintains a logical timestamp per channel.
 * Used to detect causally unordered events.
 */
export type VectorClock = Record<string, number>;

/**
 * Initialize vector clock for a user
 */
export function initVectorClock(userId: string): VectorClock {
  return { [userId]: 0 };
}

/**
 * Increment user's logical clock
 */
export function incrementClock(clock: VectorClock, userId: string): VectorClock {
  return {
    ...clock,
    [userId]: (clock[userId] ?? 0) + 1,
  };
}

/**
 * Merge two vector clocks (pointwise max)
 *
 * Used when receiving a message from another user.
 */
export function mergeClock(clock1: VectorClock, clock2: VectorClock): VectorClock {
  const merged: VectorClock = { ...clock1 };
  for (const [userId, timestamp] of Object.entries(clock2)) {
    merged[userId] = Math.max(merged[userId] ?? 0, timestamp);
  }
  return merged;
}

/**
 * Check if clock1 causally precedes clock2
 *
 * clock1 < clock2 iff clock1[u] <= clock2[u] for all u, and at least one is strict <
 */
export function happensBefore(clock1: VectorClock, clock2: VectorClock): boolean {
  const allKeys = new Set([...Object.keys(clock1), ...Object.keys(clock2)]);
  let hasStrict = false;
  for (const key of allKeys) {
    const t1 = clock1[key] ?? 0;
    const t2 = clock2[key] ?? 0;
    if (t1 > t2) return false; // clock1 is not ≤ clock2
    if (t1 < t2) hasStrict = true;
  }
  return hasStrict;
}

/**
 * Check if two clocks are concurrent (neither causally precedes the other)
 */
export function areConcurrent(clock1: VectorClock, clock2: VectorClock): boolean {
  return !happensBefore(clock1, clock2) && !happensBefore(clock2, clock1);
}

/**
 * Canonical JSON stringify for deterministic hashing
 *
 * Rules (RFC 8785):
 * - Object keys sorted lexicographically
 * - No whitespace
 * - UTF-8 encoding
 * - Arrays preserve order
 */
export function canonicalJSON(obj: unknown): string {
  if (obj === null) return 'null';
  if (typeof obj === 'boolean') return obj ? 'true' : 'false';
  if (typeof obj === 'number') {
    if (Number.isNaN(obj) || !Number.isFinite(obj)) {
      return 'null'; // JSON doesn't support NaN/Infinity
    }
    return Number.isInteger(obj) ? obj.toString() : JSON.stringify(obj);
  }
  if (typeof obj === 'string') return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    const items = obj.map((item) => canonicalJSON(item)).join(',');
    return `[${items}]`;
  }
  if (typeof obj === 'object') {
    const keys = Object.keys(obj as Record<string, unknown>).sort();
    const items = keys.map((key) => {
      const value = (obj as Record<string, unknown>)[key];
      return `${JSON.stringify(key)}:${canonicalJSON(value)}`;
    });
    return `{${items.join(',')}}`;
  }
  return 'null';
}

/**
 * SHA-256 hash of canonical JSON
 */
export function hashCanonical(obj: unknown): string {
  const canonical = canonicalJSON(obj);
  return crypto.createHash('sha256').update(canonical, 'utf-8').digest('hex');
}

/**
 * Content-addressed ID generation
 *
 * Format: chat:<entity_type>:<hash>
 */
export function generateChatId(entityType: string, obj: unknown): string {
  const hash = hashCanonical(obj);
  return `chat:${entityType}:${hash}`;
}

/**
 * Deterministic message hash
 *
 * Combines sender, channel, text, sequence, timestamp.
 * Ensures replay produces identical message IDs.
 */
export function hashMessage(
  senderId: string,
  channelId: string,
  text: string,
  sequence: number,
  timestampMs: number,
): string {
  return hashCanonical({
    sender_id: senderId,
    channel_id: channelId,
    text,
    sequence,
    timestamp_ms: timestampMs,
  });
}

/**
 * Deterministic presence hash
 */
export function hashPresence(
  userId: string,
  channelId: string,
  status: string,
  onlineSinceMs: number,
): string {
  return hashCanonical({
    user_id: userId,
    channel_id: channelId,
    status,
    online_since_ms: onlineSinceMs,
  });
}

/**
 * Deterministic session hash
 */
export function hashSession(
  userId: string,
  startedAtMs: number,
  deviceId?: string,
): string {
  return hashCanonical({
    user_id: userId,
    started_at_ms: startedAtMs,
    device_id: deviceId,
  });
}

/**
 * Stable sort for list of objects by key
 *
 * Used to ensure deterministic ordering of lists in snapshots.
 */
export function stableSort<T extends Record<string, unknown>>(
  items: T[],
  sortKey: keyof T,
): T[] {
  return [...items].sort((a, b) => {
    const aVal = String(a[sortKey]);
    const bVal = String(b[sortKey]);
    return aVal.localeCompare(bVal);
  });
}

/**
 * Stable sort by multiple keys
 *
 * Example: sort messages by (channel_id, sequence)
 */
export function stableSortBy<T extends Record<string, unknown>>(
  items: T[],
  keys: (keyof T)[],
): T[] {
  return [...items].sort((a, b) => {
    for (const key of keys) {
      const aVal = String(a[key]);
      const bVal = String(b[key]);
      const cmp = aVal.localeCompare(bVal);
      if (cmp !== 0) return cmp;
    }
    return 0;
  });
}

/**
 * Deterministic list hash
 *
 * Hashes a list of items (e.g., message IDs in a snapshot).
 * Order matters!
 */
export function hashList(items: string[]): string {
  return hashCanonical(items);
}

/**
 * FNV-1a hash for fast batch hashing
 *
 * Used for quick determinism checking without full SHA-256.
 */
export function fnv1aHash(data: string): number {
  const FNV_PRIME = 16777619;
  const OFFSET_BASIS = 2166136261;

  let hash = OFFSET_BASIS;
  for (let i = 0; i < data.length; i++) {
    hash ^= data.charCodeAt(i);
    hash = (hash * FNV_PRIME) >>> 0; // Keep 32-bit
  }
  return hash;
}
