import { z } from 'zod';
import { WorldSnapshotSchema } from '../world/schema';

/**
 * Physics Step Input Contract v1
 * Describes the exact state + forces needed to advance physics simulation by one timestep
 *
 * This is the input to physics.step.v1 tool
 */

/**
 * Vector 3D (position, velocity, force)
 */
export const Vec3Schema = z.tuple([z.number(), z.number(), z.number()]);
export type Vec3 = z.infer<typeof Vec3Schema>;

/**
 * Actor forces applied during this step
 */
export const ActorForceSchema = z.object({
  /**
   * Stable actor ID (from world snapshot)
   */
  actor_id: z.string(),
  /**
   * Force vector in world space [x, y, z]
   */
  force: Vec3Schema,
  /**
   * Impulse vector (alternative to force; not both)
   */
  impulse: Vec3Schema.optional(),
});
export type ActorForce = z.infer<typeof ActorForceSchema>;

/**
 * Fixed timestep parameters
 */
export const TimestepParamsSchema = z.object({
  /**
   * Milliseconds to advance (typically 16–33 for 30–60fps)
   * Must be > 0
   */
  dt_ms: z.number().positive().int(),
  /**
   * Gravity acceleration [x, y, z] in world units/ms²
   * Typically [0, -9.81e-3, 0] (Earth gravity normalized to ms)
   */
  gravity: Vec3Schema.default([0, -9.81e-3, 0]),
  /**
   * Linear velocity damping (0–1; 0 = no damping, 1 = instant stop)
   */
  linearDamping: z.number().min(0).max(1).default(0.01),
  /**
   * Angular velocity damping (0–1)
   */
  angularDamping: z.number().min(0).max(1).default(0.01),
});
export type TimestepParams = z.infer<typeof TimestepParamsSchema>;

/**
 * Physics Step Input
 * Combines world state + forces + timestep params
 */
export const PhysicsStepInputSchema = z.object({
  /**
   * Current world snapshot (contains all actor positions, velocities, etc.)
   */
  world_snapshot: WorldSnapshotSchema,
  /**
   * Fixed timestep parameters
   */
  timestep: TimestepParamsSchema,
  /**
   * Forces to apply to actors during this step
   * Array order is not meaningful; not hashed as deterministically ordered
   */
  forces: ActorForceSchema.array().default([]),
  /**
   * Hash of input state for audit trail
   */
  input_hash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
});
export type PhysicsStepInput = z.infer<typeof PhysicsStepInputSchema>;

/**
 * Actor physics state (position, velocity, mass, etc.)
 * Extracted from snapshot instances for physics calculation
 */
export const ActorPhysicsStateSchema = z.object({
  actor_id: z.string(),
  position: Vec3Schema,
  velocity: Vec3Schema,
  /**
   * Mass in kg (0 = static/kinematic)
   */
  mass: z.number().min(0).default(1),
  /**
   * Whether this actor is dynamic (affected by forces) or static (unmovable)
   */
  isDynamic: z.boolean().default(true),
});
export type ActorPhysicsState = z.infer<typeof ActorPhysicsStateSchema>;
