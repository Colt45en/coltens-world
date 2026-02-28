/**
 * Physics Stepper v1
 * Fixed timestep deterministic physics simulation
 *
 * Implements:
 * - Euler integration for velocity/position updates
 * - Gravity application
 * - Damping
 * - Simple collision detection stub (ready for Rapier integration)
 * - Deterministic stepping: same input → identical output
 *
 * Note: This v1 uses simple Euler integration + collision stubs.
 * Real implementation with Rapier WASM can be dropped in without changing contracts.
 */

import {
    ActorForce,
    ActorPhysicsState,
    TimestepParams,
    Vec3,
} from '../contracts/physics/step-input';
import { CollisionEvent, ImpulseApplied } from '../contracts/physics/step-output';
import { PrefabInstance } from '../contracts/world/schema';
import { hashPayload } from '../determinism';
import {
    addVec3,
    applyDamping,
    clampVec3,
    distanceVec3,
    magnitudeVec3,
    quantizeVec3,
    scaleVec3,
} from './determinism';

/**
 * Extract actor physics state from prefab instance
 * Reads position/velocity from instance metadata
 */
export function extractPhysicsState(instance: PrefabInstance): ActorPhysicsState {
  const mass = (instance.metadata?.mass as number) ?? 1;
  const velocity: Vec3 = ((instance.metadata?.velocity as Vec3) ?? [0, 0, 0]);
  const isDynamic = (instance.metadata?.isDynamic as boolean) ?? true;

  return {
    actor_id: instance.instance_id,
    position: instance.position,
    velocity,
    mass,
    isDynamic,
  };
}

/**
 * Single physics timestep using Euler integration
 * Deterministic: same inputs → identical state updates
 */
export function stepPhysics(
  actors: ActorPhysicsState[],
  forces: ActorForce[],
  params: TimestepParams
): {
  updatedActors: ActorPhysicsState[];
  impulses: ImpulseApplied[];
  collisions: CollisionEvent[];
} {
  const dt = params.dt_ms / 1000; // Convert ms to seconds
  const gravity = params.gravity;
  const linearDamping = params.linearDamping;
  const angularDamping = params.angularDamping; // Currently unused (no rotation in v1)

  const impulses: ImpulseApplied[] = [];
  const collisions: CollisionEvent[] = [];

  // Map forces by actor_id for O(1) lookup
  const forceMap = new Map<string, Vec3>();
  for (const force of forces) {
    const existingForce = forceMap.get(force.actor_id) ?? [0, 0, 0];
    forceMap.set(force.actor_id, addVec3(existingForce, force.force));
  }

  // Step each dynamic actor
  const updatedActors: ActorPhysicsState[] = actors.map((actor) => {
    if (!actor.isDynamic) {
      // Static actors don't move
      return actor;
    }

    // Compute acceleration from applied forces + gravity
    const appliedForce = forceMap.get(actor.actor_id) ?? [0, 0, 0];
    const mass = actor.mass > 0 ? actor.mass : 1;

    // F = ma → a = F/m
    const forceAccel = scaleVec3(appliedForce, 1 / mass);
    const gravityAccel = gravity; // gravity already in world units
    const totalAccel = addVec3(forceAccel, gravityAccel);

    // Euler integration: v' = v + a*dt
    let newVelocity = addVec3(actor.velocity, scaleVec3(totalAccel, dt));

    // Apply damping
    newVelocity = applyDamping(newVelocity, linearDamping);

    // Quantize to deterministic precision
    newVelocity = quantizeVec3(newVelocity, 6);

    // Position update: x' = x + v*dt
    let newPosition = addVec3(actor.position, scaleVec3(newVelocity, dt));

    // Clamp to reasonable world bounds (prevent NaN/Infinity)
    newPosition = clampVec3(newPosition, -1e4, 1e4);
    newVelocity = clampVec3(newVelocity, -1e4, 1e4);

    // Quantize position for determinism
    newPosition = quantizeVec3(newPosition, 6);

    // Record impulse
    if (appliedForce[0] !== 0 || appliedForce[1] !== 0 || appliedForce[2] !== 0) {
      impulses.push({
        actor_id: actor.actor_id,
        impulse: appliedForce,
        reason: 'applied_force',
      });
    }

    // Gravity impulse (always recorded if not static)
    const gravityImpulse = scaleVec3(gravity, mass * dt);
    if (magnitudeVec3(gravityImpulse) > 0.01) {
      impulses.push({
        actor_id: actor.actor_id,
        impulse: gravityImpulse,
        reason: 'gravity',
      });
    }

    return {
      ...actor,
      position: newPosition,
      velocity: newVelocity,
    };
  });

  // Simple collision detection (stub for v1)
  // In real implementation, use Rapier's collision detection
  const collisionThreshold = 0.5; // Actors collide if closer than this

  for (let i = 0; i < updatedActors.length; i++) {
    for (let j = i + 1; j < updatedActors.length; j++) {
      const a = updatedActors[i]!;
      const b = updatedActors[j]!;
      const dist = distanceVec3(a.position, b.position);

      if (dist < collisionThreshold) {
        // Compute contact normal (direction from A to B)
        const dx = b.position[0] - a.position[0];
        const dy = b.position[1] - a.position[1];
        const dz = b.position[2] - a.position[2];
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const normal: Vec3 = len > 0 ? [dx / len, dy / len, dz / len] : [0, 1, 0];

        // Compute relative velocity
        const relVel: Vec3 = [
          a.velocity[0] - b.velocity[0],
          a.velocity[1] - b.velocity[1],
          a.velocity[2] - b.velocity[2],
        ];

        collisions.push({
          actor_a: a.actor_id,
          actor_b: b.actor_id,
          contact_point: [
            (a.position[0] + b.position[0]) / 2,
            (a.position[1] + b.position[1]) / 2,
            (a.position[2] + b.position[2]) / 2,
          ],
          contact_normal: normal,
          relative_velocity: relVel,
        });
      }
    }
  }

  // Stable sort impulses by actor_id for deterministic output
  impulses.sort((a, b) => a.actor_id.localeCompare(b.actor_id));

  // Stable sort collisions by actor_a + actor_b
  collisions.sort((a, b) => {
    const aKey = `${a.actor_a}:${a.actor_b}`;
    const bKey = `${b.actor_a}:${b.actor_b}`;
    return aKey.localeCompare(bKey);
  });

  return {
    updatedActors,
    impulses,
    collisions,
  };
}

/**
 * Batch stepping: advance physics by multiple ticks
 * Deterministic: same inputs → identical final state
 */
export function stepPhysicsBatch(
  initialActors: ActorPhysicsState[],
  forceSequence: (ActorForce[] | undefined)[],
  params: TimestepParams
): {
  stepsCompleted: number;
  finalActors: ActorPhysicsState[];
  allImpulses: ImpulseApplied[];
  allCollisions: CollisionEvent[];
  stepHashes: string[];
} {
  let currentActors = initialActors;
  const allImpulses: ImpulseApplied[] = [];
  const allCollisions: CollisionEvent[] = [];
  const stepHashes: string[] = [];

  for (let step = 0; step < forceSequence.length; step++) {
    const forces = forceSequence[step] ?? [];
    const { updatedActors, impulses, collisions } = stepPhysics(
      currentActors,
      forces,
      params
    );

    currentActors = updatedActors;
    allImpulses.push(...impulses);
    allCollisions.push(...collisions);

    // Compute hash of this step's output
    const stepPayload = {
      step,
      actors: updatedActors,
      impulses,
      collisions,
    };
    const stepHash = hashPayload(stepPayload);
    stepHashes.push(stepHash);
  }

  return {
    stepsCompleted: forceSequence.length,
    finalActors: currentActors,
    allImpulses,
    allCollisions,
    stepHashes,
  };
}

/**
 * Verify determinism by running same step twice and comparing hashes
 */
export function verifyDeterminism(
  actors: ActorPhysicsState[],
  forces: ActorForce[],
  params: TimestepParams
): boolean {
  const result1 = stepPhysics(actors, forces, params);
  const result2 = stepPhysics(actors, forces, params);

  const hash1 = hashPayload({
    actors: result1.updatedActors,
    impulses: result1.impulses,
    collisions: result1.collisions,
  });

  const hash2 = hashPayload({
    actors: result2.updatedActors,
    impulses: result2.impulses,
    collisions: result2.collisions,
  });

  return hash1 === hash2;
}
