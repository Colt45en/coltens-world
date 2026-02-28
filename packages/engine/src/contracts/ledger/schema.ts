import { z } from 'zod';

/**
 * Ledger v1 Contracts
 * Append-only event log with deterministic hashing
 * Every meaningful World Core action produces a ledger event
 */

/**
 * Ledger Event Base
 * Common structure for all ledger events
 */
export const LedgerEventBaseSchema = z.object({
  /**
   * Event type (e.g., "mesh.style.ingested.v1")
   * Includes version to allow schema evolution
   */
  event_type: z.string(),
  /**
   * When this event was recorded (UTC; informational only)
   */
  occurred_at_utc: z.string().datetime(),
  /**
   * Context that guarantees determinism
   */
  deterministic_context: z.object({
    /**
     * Engine version (e.g., "world-core-v1.0.0")
     */
    engineVersion: z.string(),
    /**
     * Tool ID that produced this event (e.g., "mesh.validate_asset.v1")
     */
    toolId: z.string(),
  }),
  /**
   * Hash of input payloads
   */
  input_hashes: z.record(z.string()).optional(),
  /**
   * Hash of output payloads
   */
  output_hashes: z.record(z.string()).optional(),
  /**
   * References to artifacts produced (stable-sorted if multiple)
   */
  artifact_refs: z.array(z.object({
    artifact_id: z.string(),
    hash: z.string().regex(/^[a-f0-9]{64}$/),
    type: z.string(),
  })).optional(),
});

export type LedgerEventBase = z.infer<typeof LedgerEventBaseSchema>;

/**
 * Mesh Style Ingested Event
 */
export const MeshStyleIngestedEventSchema = LedgerEventBaseSchema.extend({
  event_type: z.literal('mesh.style.ingested.v1'),
  data: z.object({
    style_id: z.string(),
    style_version: z.string(),
    style_hash: z.string().regex(/^[a-f0-9]{64}$/),
    sealed: z.boolean(),
  }),
});

export type MeshStyleIngestedEvent = z.infer<typeof MeshStyleIngestedEventSchema>;

/**
 * Mesh Asset Validated Event
 */
export const MeshAssetValidatedEventSchema = LedgerEventBaseSchema.extend({
  event_type: z.literal('mesh.asset.validated.v1'),
  data: z.object({
    asset_ref: z.string(),
    style_hash: z.string().regex(/^[a-f0-9]{64}$/),
    report_hash: z.string().regex(/^[a-f0-9]{64}$/),
    ok: z.boolean(),
    violation_count: z.number().int().min(0),
  }),
});

export type MeshAssetValidatedEvent = z.infer<typeof MeshAssetValidatedEventSchema>;

/**
 * Prefab Ingested Event
 */
export const PrefabIngestedEventSchema = LedgerEventBaseSchema.extend({
  event_type: z.literal('prefab.ingested.v1'),
  data: z.object({
    prefab_kind: z.enum(['avatar', 'building']),
    prefab_id: z.string(),
    prefab_hash: z.string().regex(/^[a-f0-9]{64}$/),
    asset_refs_hash: z.string().regex(/^[a-f0-9]{64}$/),
  }),
});

export type PrefabIngestedEvent = z.infer<typeof PrefabIngestedEventSchema>;

/**
 * Prefab Baked Event
 */
export const PrefabBakedEventSchema = LedgerEventBaseSchema.extend({
  event_type: z.literal('prefab.baked.v1'),
  data: z.object({
    prefab_id: z.string(),
    bake_manifest_hash: z.string().regex(/^[a-f0-9]{64}$/),
    style_hash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  }),
});

export type PrefabBakedEvent = z.infer<typeof PrefabBakedEventSchema>;

/**
 * World Snapshot Written Event
 */
export const WorldSnapshotWrittenEventSchema = LedgerEventBaseSchema.extend({
  event_type: z.literal('world.snapshot.written.v1'),
  data: z.object({
    snapshot_id: z.string(),
    snapshot_hash: z.string().regex(/^[a-f0-9]{64}$/),
    tick: z.number().int().min(0),
    scene_id: z.string(),
    instances_count: z.number().int().min(0),
  }),
});

export type WorldSnapshotWrittenEvent = z.infer<typeof WorldSnapshotWrittenEventSchema>;

/**
 * World Replay Executed Event
 */
export const WorldReplayExecutedEventSchema = LedgerEventBaseSchema.extend({
  event_type: z.literal('world.replay.executed.v1'),
  data: z.object({
    request_hash: z.string().regex(/^[a-f0-9]{64}$/),
    result_hash: z.string().regex(/^[a-f0-9]{64}$/),
    start_tick: z.number().int().min(0),
    end_tick: z.number().int().min(0),
    status: z.enum(['success', 'error', 'partial']),
  }),
});

export type WorldReplayExecutedEvent = z.infer<typeof WorldReplayExecutedEventSchema>;

/**
 * Physics Step Executed Event
 */
export const PhysicsStepExecutedEventSchema = LedgerEventBaseSchema.extend({
  event_type: z.literal('physics.step.executed.v1'),
  data: z.object({
    tick: z.number().int().min(0),
    dt_ms: z.number().positive().int(),
    input_hash: z.string().regex(/^[a-f0-9]{64}$/),
    output_hash: z.string().regex(/^[a-f0-9]{64}$/),
    collision_count: z.number().int().min(0),
    impulse_count: z.number().int().min(0),
  }),
});

export type PhysicsStepExecutedEvent = z.infer<typeof PhysicsStepExecutedEventSchema>;

/**
 * Physics Snapshot Created Event
 */
export const PhysicsSnapshotCreatedEventSchema = LedgerEventBaseSchema.extend({
  event_type: z.literal('physics.snapshot.created.v1'),
  data: z.object({
    physics_hash: z.string().regex(/^[a-f0-9]{64}$/),
    source_snapshot_id: z.string(),
    tick: z.number().int().min(0),
    actor_count: z.number().int().min(0),
  }),
});

export type PhysicsSnapshotCreatedEvent = z.infer<typeof PhysicsSnapshotCreatedEventSchema>;

/**
 * Union of all ledger events
 */
export const LedgerEventSchema = z.union([
  MeshStyleIngestedEventSchema,
  MeshAssetValidatedEventSchema,
  PrefabIngestedEventSchema,
  PrefabBakedEventSchema,
  WorldSnapshotWrittenEventSchema,
  WorldReplayExecutedEventSchema,
  PhysicsStepExecutedEventSchema,
  PhysicsSnapshotCreatedEventSchema,
]);

export type LedgerEvent = z.infer<typeof LedgerEventSchema>;

/**
 * Ledger entry: immutable append-only record with deterministic hash chaining
 */
export const LedgerEntrySchema = z.object({
  seq: z.number().int().nonnegative(),
  ts_utc: z.string().datetime(),
  type: z.string(),
  doc_id: z.string().optional(),
  artifact_id: z.string().optional(),
  payload: z.any().nullable(),
  payload_hash: z.string().regex(/^[a-f0-9]{64}$/),
  prev_hash: z.string().regex(/^[a-f0-9]{64}$/),
  entry_hash: z.string().regex(/^[a-f0-9]{64}$/),
});

export type LedgerEntry = z.infer<typeof LedgerEntrySchema>;

/**
 * Ledger input: single entry to append
 */
export const LedgerEventInputSchema = z.object({
  type: z.string(),
  doc_id: z.string().optional(),
  artifact_id: z.string().optional(),
  payload: z.any().optional(),
});

export type LedgerEventInput = z.infer<typeof LedgerEventInputSchema>;

/**
 * Range query: fetch events by index range
 */
export const LedgerRangeQuerySchema = z.object({
  start: z.number(),
  end: z.number(),
});

export type LedgerRangeQuery = z.infer<typeof LedgerRangeQuerySchema>;

/**
 * Stream query: continuous log tail
 */
export const LedgerStreamQuerySchema = z.object({
  after_seq: z.coerce.number().optional().default(0),
  limit: z.coerce.number().optional().default(100),
});

export type LedgerStreamQuery = z.infer<typeof LedgerStreamQuerySchema>;

/**
 * Ledger status
 */
export const LedgerStatusSchema = z.object({
  filePath: z.string(),
  maxSeq: z.number().int().nonnegative(),
  lastHash: z.string().regex(/^[a-f0-9]{64}$/),
});

export type LedgerStatus = z.infer<typeof LedgerStatusSchema>;

/**
 * Verification result for ledger integrity
 */
export const LedgerVerifyResultSchema = z.union([
  z.object({
    ok: z.literal(true),
    checked: z.number().int().nonnegative(),
  }),
  z.object({
    ok: z.literal(false),
    checked: z.number().int().nonnegative(),
    bad_seq: z.number().int().nonnegative(),
    reason: z.string(),
  }),
]);

export type LedgerVerifyResult = z.infer<typeof LedgerVerifyResultSchema>;
