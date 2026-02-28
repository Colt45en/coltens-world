import { z } from 'zod';
import { WorldSnapshotSchema } from '../world/schema';
import { Vec3Schema } from './step-input';

/**
 * Physics Step Output Contract v1
 * Describes the result of advancing physics simulation by one timestep
 *
 * This is the output from physics.step.v1 tool
 */

/**
 * Collision event between two actors
 */
export const CollisionEventSchema = z.object({
  /**
   * First actor ID
   */
  actor_a: z.string(),
  /**
   * Second actor ID
   */
  actor_b: z.string(),
  /**
   * Contact point in world space [x, y, z]
   */
  contact_point: Vec3Schema,
  /**
   * Contact normal (pointing from A to B)
   */
  contact_normal: Vec3Schema,
  /**
   * Relative velocity at contact
   */
  relative_velocity: Vec3Schema,
});
export type CollisionEvent = z.infer<typeof CollisionEventSchema>;

/**
 * Impulse applied to actor during step
 */
export const ImpulseAppliedSchema = z.object({
  actor_id: z.string(),
  /**
   * Impulse vector [x, y, z]
   */
  impulse: Vec3Schema,
  /**
   * Reason: "gravity"|"applied_force"|"collision"|"constraint"
   */
  reason: z.enum(['gravity', 'applied_force', 'collision', 'constraint']),
});
export type ImpulseApplied = z.infer<typeof ImpulseAppliedSchema>;

/**
 * Physics Step Output
 */
export const PhysicsStepOutputSchema = z.object({
  /**
   * World snapshot after physics step
   */
  world_snapshot: WorldSnapshotSchema,
  /**
   * All impulses applied during this step (per-actor, stable-sorted)
   */
  impulses_applied: ImpulseAppliedSchema.array().default([]),
  /**
   * All detected collision events (stable-sorted by actor_a + actor_b)
   */
  collision_events: CollisionEventSchema.array().default([]),
  /**
   * Tick that was advanced to
   */
  tick: z.number().int().min(0),
  /**
   * Milliseconds elapsed in simulation
   */
  elapsed_ms: z.number().min(0),
  /**
   * Hash of output state (canonical snapshot + impulses + collisions)
   */
  output_hash: z.string().regex(/^[a-f0-9]{64}$/),
});
export type PhysicsStepOutput = z.infer<typeof PhysicsStepOutputSchema>;

/**
 * Physics Snapshot Contract v1
 * Extracted from world snapshot; contains only physics-relevant state
 * Used for determinism verification and physics-specific replay
 */
export const PhysicsSnapshotSchema = z.object({
  /**
   * Snapshot ID this was derived from
   */
  source_snapshot_id: z.string(),
  /**
   * World tick
   */
  tick: z.number().int().min(0),
  /**
   * Scene ID
   */
  scene_id: z.string(),
  /**
   * Actor physics states (stable-sorted by actor_id)
   */
  actors: z.object({
    actor_id: z.string(),
    position: Vec3Schema,
    velocity: Vec3Schema,
    mass: z.number().min(0),
  }).array(),
  /**
   * Gravity used [x, y, z]
   */
  gravity: Vec3Schema,
  /**
   * Damping parameters
   */
  dampings: z.object({
    linear: z.number().min(0).max(1),
    angular: z.number().min(0).max(1),
  }),
  /**
   * Hash of this physics snapshot
   */
  physics_hash: z.string().regex(/^[a-f0-9]{64}$/),
});
export type PhysicsSnapshot = z.infer<typeof PhysicsSnapshotSchema>;
