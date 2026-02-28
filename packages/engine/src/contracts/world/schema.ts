import { z } from 'zod';

/**
 * World Snapshot + Replay v1 Contracts
 * Defines the state of a world at a given tick and replay semantics
 *
 * Contract ID: snapshot_id = "worldsnap:" + sha256(canonical_json(snapshot_payload))
 */

/**
 * Prefab Instance in a world
 * A placement of a prefab with a transform and optionally overridden properties
 */
export const PrefabInstanceSchema = z.object({
  /**
   * Unique identifier for this instance in the world
   */
  instance_id: z.string(),
  /**
   * Content-addressed prefab ID ("prefab:...")
   */
  prefabId: z.string(),
  /**
   * Global position [x, y, z]
   */
  position: z.tuple([z.number(), z.number(), z.number()]),
  /**
   * Global rotation as quaternion [x, y, z, w]
   */
  rotation: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional().default([0, 0, 0, 1]),
  /**
   * Global scale [x, y, z]
   */
  scale: z.tuple([z.number(), z.number(), z.number()]).optional().default([1, 1, 1]),
  /**
   * Optional metadata (e.g., npc_name, team_id, state tags)
   */
  metadata: z.record(z.unknown()).optional(),
});

export type PrefabInstance = z.infer<typeof PrefabInstanceSchema>;

/**
 * World Snapshot v1
 * Complete state of a world at a specific tick
 * Order: instances are stable-sorted by instance_id when serialized
 */
export const WorldSnapshotSchema = z.object({
  /**
   * Content-addressed snapshot ID (set after creation)
   */
  snapshot_id: z.string().optional(),
  /**
   * Simulation tick number
   */
  tick: z.number().int().min(0),
  /**
   * Scene or world identifier
   */
  scene_id: z.string(),
  /**
   * Wall-clock timestamp (informational; NOT used in functional output)
   */
  recorded_at_utc: z.string().datetime().optional(),
  /**
   * All prefab instances in the world (stable-sorted by instance_id)
   */
  instances: z.array(PrefabInstanceSchema),
  /**
   * Hash of instances array for dependency tracking
   */
  instances_hash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  /**
   * Metadata about the snapshot
   */
  metadata: z.object({
    /**
     * Tool or system that created this snapshot
     */
    creator: z.string(),
    /**
     * Engine version (ensures replay determinism across versions)
     */
    engineVersion: z.string(),
  }).optional(),
});

export type WorldSnapshot = z.infer<typeof WorldSnapshotSchema>;

/**
 * Replay Request v1
 * Instruction to replay a world from a snapshot through a range of ticks
 */
export const WorldReplayRequestSchema = z.object({
  /**
   * Starting snapshot ID
   */
  startSnapshotId: z.string(),
  /**
   * Start tick
   */
  startTick: z.number().int().min(0),
  /**
   * End tick (inclusive)
   */
  endTick: z.number().int().min(0),
  /**
   * Optional list of systems to run ("physics", "chat", "animation", etc.)
   */
  systems: z.array(z.string()).optional().default(['physics']),
  /**
   * Hash of this request (for ledger binding)
   */
  request_hash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
});

export type WorldReplayRequest = z.infer<typeof WorldReplayRequestSchema>;

/**
 * Replay Result v1
 * Output of a replay operation
 */
export const WorldReplayResultSchema = z.object({
  /**
   * Request that was replayed
   */
  request_hash: z.string().regex(/^[a-f0-9]{64}$/),
  /**
   * Starting tick
   */
  startTick: z.number().int().min(0),
  /**
   * Ending tick
   */
  endTick: z.number().int().min(0),
  /**
   * Result status
   */
  status: z.enum(['success', 'error', 'partial']),
  /**
   * If error, human-readable message
   */
  errorMessage: z.string().optional(),
  /**
   * Final snapshot after replay (optional; included if requested)
   */
  finalSnapshot: WorldSnapshotSchema.optional(),
  /**
   * Hash of this result (for ledger binding)
   */
  result_hash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
});

export type WorldReplayResult = z.infer<typeof WorldReplayResultSchema>;
