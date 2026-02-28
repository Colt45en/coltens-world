import { z } from "zod";

/**
 * Lexicon Intent v1 — Content-addressed persistent snapshot storage
 *
 * Role: Replace in-memory snapshot stores with persistent KV + indexed query
 * Contract: Same snapshot JSON → same hash → deduplication + deterministic queries
 * Determinism: Content addressing + stable sort on queries
 */

// ============================================================================
// Schema Version & Metadata
// ============================================================================

export const LEXICON_INTENT_V1 = {
  schema_version: "1.0.0",
  id_prefix: "lex",
  hash_alg: "SHA-256",
  description: "Content-addressed snapshot storage with indexed query",
} as const;

// ============================================================================
// Snapshot Data Structure
// ============================================================================

/**
 * LexiconSnapshotV1: A stored snapshot with content-addressing info
 */
export const LexiconSnapshotV1Schema = z.object({
  snapshot_id: z.string().describe("SHA-256 hash of canonical_json (content address)"),
  actor_id: z.string().describe("Entity storing this snapshot (e.g., 'actor:123')"),
  snapshot_kind: z.enum(["graphics", "physics", "chat", "world", "custom"]).describe("Snapshot type (graphics_intent, physics_state, etc.)"),
  canonical_json: z.string().describe("RFC 8785 canonical JSON payload"),
  created_at_utc: z.number().describe("Creation timestamp (seconds since epoch)"),
  stored_at_utc: z.number().describe("Storage timestamp (seconds since epoch)"),
  size_bytes: z.number().describe("Size of canonical_json in bytes"),
});

export type LexiconSnapshotV1 = z.infer<typeof LexiconSnapshotV1Schema>;

// ============================================================================
// Store Request/Response
// ============================================================================

/**
 * LexiconStoreRequestV1: Request to store a snapshot
 */
export const LexiconStoreRequestV1Schema = z.object({
  action: z.literal("store").describe("Always 'store' for this request"),
  actor_id: z.string().describe("Entity storing the snapshot"),
  snapshot_kind: z.enum(["graphics", "physics", "chat", "world", "custom"]),
  canonical_json: z.string().describe("RFC 8785 canonical JSON payload"),
  created_at_utc: z.number().describe("Creation timestamp (seconds since epoch)"),
});

export type LexiconStoreRequestV1 = z.infer<typeof LexiconStoreRequestV1Schema>;

/**
 * LexiconStoreResponseV1: Response from store request
 */
export const LexiconStoreResponseV1Schema = z.object({
  success: z.boolean(),
  snapshot_id: z.string().describe("SHA-256 hash ID (content address)"),
  stored_new: z.boolean().describe("true = new snapshot stored; false = already existed (dedup)"),
  action: z.literal("store"),
  message: z.string().optional(),
});

export type LexiconStoreResponseV1 = z.infer<typeof LexiconStoreResponseV1Schema>;

// ============================================================================
// Query Request/Response
// ============================================================================

/**
 * LexiconQueryV1: Request to query snapshots by index
 */
export const LexiconQueryV1Schema = z.object({
  action: z.literal("query").describe("Always 'query' for this request"),
  actor_id: z.string().describe("Filter by actor_id"),
  snapshot_kind: z.enum(["graphics", "physics", "chat", "world", "custom"]).optional().describe("Filter by kind (optional)"),
  created_at_utc_min: z.number().optional().describe("Minimum creation timestamp (inclusive)"),
  created_at_utc_max: z.number().optional().describe("Maximum creation timestamp (inclusive)"),
  limit: z.number().int().min(1).max(10000).default(100).describe("Max results to return"),
  order_by: z.enum(["created_at_asc", "created_at_desc"]).default("created_at_desc").describe("Sort order (deterministic)"),
});

export type LexiconQueryV1 = z.infer<typeof LexiconQueryV1Schema>;

/**
 * LexiconQueryResponseV1: Response from query request
 */
export const LexiconQueryResponseV1Schema = z.object({
  success: z.boolean(),
  snapshots: z.array(LexiconSnapshotV1Schema).describe("Matching snapshots (sorted deterministically)"),
  total_count: z.number().describe("Total matching snapshots (may exceed limit)"),
  query_time_ms: z.number().describe("Query execution time in milliseconds"),
  message: z.string().optional(),
});

export type LexiconQueryResponseV1 = z.infer<typeof LexiconQueryResponseV1Schema>;

// ============================================================================
// Get Request/Response (single snapshot fetch)
// ============================================================================

/**
 * LexiconGetRequestV1: Request to retrieve a single snapshot by ID
 */
export const LexiconGetRequestV1Schema = z.object({
  action: z.literal("get").describe("Always 'get' for this request"),
  snapshot_id: z.string().describe("SHA-256 hash ID to fetch"),
});

export type LexiconGetRequestV1 = z.infer<typeof LexiconGetRequestV1Schema>;

/**
 * LexiconGetResponseV1: Response from get request
 */
export const LexiconGetResponseV1Schema = z.object({
  success: z.boolean(),
  snapshot: LexiconSnapshotV1Schema.optional().describe("Snapshot if found"),
  message: z.string().optional(),
});

export type LexiconGetResponseV1 = z.infer<typeof LexiconGetResponseV1Schema>;

// ============================================================================
// Statistics Request/Response
// ============================================================================

/**
 * LexiconStatsRequestV1: Request storage statistics
 */
export const LexiconStatsRequestV1Schema = z.object({
  action: z.literal("stats").describe("Always 'stats' for this request"),
});

export type LexiconStatsRequestV1 = z.infer<typeof LexiconStatsRequestV1Schema>;

/**
 * LexiconStatsResponseV1: Storage statistics
 */
export const LexiconStatsResponseV1Schema = z.object({
  success: z.boolean(),
  total_snapshots: z.number().describe("Total unique snapshots stored"),
  total_stored_bytes: z.number().describe("Total bytes used by snapshots"),
  total_deduplicated_count: z.number().describe("Total deduplication save count"),
  total_deduplicated_bytes: z.number().describe("Total bytes saved by deduplication"),
});

export type LexiconStatsResponseV1 = z.infer<typeof LexiconStatsResponseV1Schema>;

// ============================================================================
// Ledger Events
// ============================================================================

/**
 * LexiconLedgerEventV1StoredSchema: Snapshot was stored (or deduplicated)
 */
export const LexiconLedgerEventV1StoredSchema = z.object({
  kind: z.literal("stored"),
  actor_id: z.string(),
  snapshot_kind: z.enum(["graphics", "physics", "chat", "world", "custom"]),
  snapshot_id: z.string(),
  size_bytes: z.number(),
  stored_new: z.boolean().describe("true = new; false = dedup"),
  timestamp_utc: z.number(),
});

/**
 * LexiconLedgerEventV1QueriedSchema: Snapshots were queried
 */
export const LexiconLedgerEventV1QueriedSchema = z.object({
  kind: z.literal("queried"),
  actor_id: z.string(),
  snapshot_kind: z.string().optional(),
  result_count: z.number(),
  query_time_ms: z.number(),
  timestamp_utc: z.number(),
});

/**
 * LexiconLedgerEventV1DeduplicatedSchema: Deduplication occurred
 */
export const LexiconLedgerEventV1DeduplicatedSchema = z.object({
  kind: z.literal("deduplicated"),
  actor_id: z.string().optional(),
  snapshot_id: z.string(),
  existing_size_bytes: z.number(),
  bytes_saved: z.number(),
  timestamp_utc: z.number(),
});

/**
 * LexiconLedgerEventV1: Union of all ledger event types
 */
export const LexiconLedgerEventV1Schema = z.union([
  LexiconLedgerEventV1StoredSchema,
  LexiconLedgerEventV1QueriedSchema,
  LexiconLedgerEventV1DeduplicatedSchema,
]);

export type LexiconLedgerEventV1 = z.infer<typeof LexiconLedgerEventV1Schema>;
export type LexiconLedgerEventV1Stored = z.infer<typeof LexiconLedgerEventV1StoredSchema>;
export type LexiconLedgerEventV1Queried = z.infer<typeof LexiconLedgerEventV1QueriedSchema>;
export type LexiconLedgerEventV1Deduplicated = z.infer<typeof LexiconLedgerEventV1DeduplicatedSchema>;

// ============================================================================
// Unified Request/Response Envelopes
// ============================================================================

/**
 * LexiconRequestV1: Any lexicon request
 */
export const LexiconRequestV1Schema = z.union([
  LexiconStoreRequestV1Schema,
  LexiconQueryV1Schema,
  LexiconGetRequestV1Schema,
  LexiconStatsRequestV1Schema,
]);

export type LexiconRequestV1 = z.infer<typeof LexiconRequestV1Schema>;

/**
 * LexiconResponseV1: Any lexicon response
 */
export const LexiconResponseV1Schema = z.union([
  LexiconStoreResponseV1Schema,
  LexiconQueryResponseV1Schema,
  LexiconGetResponseV1Schema,
  LexiconStatsResponseV1Schema,
]);

export type LexiconResponseV1 = z.infer<typeof LexiconResponseV1Schema>;

// ============================================================================
// Tool Result (for Nucleus integration)
// ============================================================================

/**
 * LexiconToolResultV1: Standard result type for Nucleus tools
 */
export const LexiconToolResultV1Schema = z.object({
  success: z.boolean(),
  data: LexiconResponseV1Schema.optional(),
  ledger_event: LexiconLedgerEventV1Schema.optional(),
  message: z.string().optional(),
});

export type LexiconToolResultV1 = z.infer<typeof LexiconToolResultV1Schema>;
