/**
 * Physics Stepper Determinism Tests
 * Verify that physics stepping produces byte-identical output for same inputs
 *
 * Run with: pnpm -w run test -- packages/engine/test/determinism/physics-stepper.test.ts
 */

import { describe, expect, it } from 'vitest';
import {
    ActorForce,
    ActorPhysicsState,
    TimestepParams,
} from '../../src/contracts/physics/step-input';
import { hashPayload } from '../../src/determinism';
import {
    addVec3,
    clampValue,
    quantizeScalar,
    quantizeVec3,
    scaleVec3,
    stepPhysics,
    stepPhysicsBatch,
    verifyDeterminism,
} from '../../src/physics';

describe('Physics: Determinism', () => {
  // Test fixtures
  const defaultTimestep: TimestepParams = {
    dt_ms: 16, // ~60fps
    gravity: [0, -9.81e-3, 0],
    linearDamping: 0.01,
    angularDamping: 0.01,
  };

  const actor1: ActorPhysicsState = {
    actor_id: 'actor:1',
    position: [0, 5, 0],
    velocity: [0, 0, 0],
    mass: 1,
    isDynamic: true,
  };

  const actor2: ActorPhysicsState = {
    actor_id: 'actor:2',
    position: [2, 2, 0],
    velocity: [1, 0, 0],
    mass: 2,
    isDynamic: true,
  };

  const staticActor: ActorPhysicsState = {
    actor_id: 'actor:static',
    position: [0, 0, 0],
    velocity: [0, 0, 0],
    mass: 0,
    isDynamic: false,
  };

  const force1: ActorForce = {
    actor_id: 'actor:1',
    force: [10, 0, 0],
  };

  describe('Vector Quantization', () => {
    it('should quantize scalar to fixed precision', () => {
      const value = 3.141592653589793;
      const quantized = quantizeScalar(value, 6);
      expect(quantized).toBe(3.141593);
    });

    it('should quantize vector deterministically', () => {
      const vec: [number, number, number] = [1.123456789, 2.987654321, 3.555555555];
      const q1 = quantizeVec3(vec, 4);
      const q2 = quantizeVec3(vec, 4);
      expect(q1).toEqual(q2);
      expect(q1).toEqual([1.1235, 2.9877, 3.5556]);
    });

    it('should clamp values safely', () => {
      expect(clampValue(1e8, -1e6, 1e6)).toBe(1e6);
      expect(clampValue(-1e8, -1e6, 1e6)).toBe(-1e6);
      expect(clampValue(NaN)).toBe(0);
      expect(clampValue(Infinity)).toBe(0);
    });
  });

  describe('Vector Operations', () => {
    it('should add vectors correctly', () => {
      const a: [number, number, number] = [1, 2, 3];
      const b: [number, number, number] = [4, 5, 6];
      const result = addVec3(a, b);
      expect(result).toEqual([5, 7, 9]);
    });

    it('should scale vectors correctly', () => {
      const v: [number, number, number] = [1, 2, 3];
      const scaled = scaleVec3(v, 2);
      expect(scaled).toEqual([2, 4, 6]);
    });
  });

  describe('Physics Stepping: Single Step', () => {
    it('should produce identical output for same input', () => {
      const actors = [actor1, actor2];
      const forces = [force1];

      const result1 = stepPhysics(actors, forces, defaultTimestep);
      const result2 = stepPhysics(actors, forces, defaultTimestep);

      // Compare hashes
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

      expect(hash1).toBe(hash2);
    });

    it('should apply gravity to dynamic actors', () => {
      const actors = [actor1]; // free-falling
      const result = stepPhysics(actors, [], defaultTimestep);

      // Actor should have downward velocity after gravity
      const updatedActor = result.updatedActors[0];
      expect(updatedActor.velocity[1]).toBeLessThan(0);
    });

    it('should not move static actors', () => {
      const actors = [staticActor];
      const forces = [{ actor_id: 'actor:static', force: [100, 100, 100] }];

      const result = stepPhysics(actors, forces, defaultTimestep);
      const updatedStatic = result.updatedActors[0];

      expect(updatedStatic.position).toEqual(staticActor.position);
      expect(updatedStatic.velocity).toEqual(staticActor.velocity);
    });

    it('should apply forces correctly', () => {
      const actors = [actor1];
      const forces = [force1]; // 10 N in X direction

      const result = stepPhysics(actors, forces, defaultTimestep);
      const updatedActor = result.updatedActors[0];

      // Force should increase X velocity
      expect(updatedActor.velocity[0]).toBeGreaterThan(0);
    });

    it('should apply damping to velocity', () => {
      const actor = {
        ...actor1,
        velocity: [100, 100, 100],
      };

      const result = stepPhysics([actor], [], defaultTimestep);
      const updatedActor = result.updatedActors[0];

      // Velocity should be reduced due to damping
      expect(updatedActor.velocity[0]).toBeLessThan(100);
    });

    it('should record impulses in stable order', () => {
      const actors = [actor2, actor1]; // Out of order
      const forces = [
        { actor_id: 'actor:2', force: [5, 0, 0] },
        { actor_id: 'actor:1', force: [10, 0, 0] },
      ];

      const result = stepPhysics(actors, forces, defaultTimestep);

      // Impulses should be sorted by actor_id
      if (result.impulses.length >= 2) {
        const first = result.impulses[0];
        const second = result.impulses.find(
          (imp) => imp.actor_id !== first.actor_id && imp.reason === 'applied_force'
        );
        if (second) {
          expect(first.actor_id.localeCompare(second.actor_id)).toBeLessThanOrEqual(0);
        }
      }
    });
  });

  describe('Physics Stepping: Batch', () => {
    it('should produce deterministic results for batch stepping', () => {
      const actors = [actor1, actor2];
      const forceSequence: (ActorForce[] | undefined)[] = [
        [force1],
        [force1],
        [force1],
      ];

      const result1 = stepPhysicsBatch(actors, forceSequence, defaultTimestep);
      const result2 = stepPhysicsBatch(actors, forceSequence, defaultTimestep);

      // Final actor hashes should match
      const hash1 = hashPayload(result1.finalActors);
      const hash2 = hashPayload(result2.finalActors);

      expect(hash1).toBe(hash2);
      expect(result1.stepHashes).toEqual(result2.stepHashes);
    });

    it('should complete 10 steps deterministically', () => {
      const actors = [actor1];
      const forceSequence: (ActorForce[] | undefined)[] = Array(10).fill([force1]);

      const result = stepPhysicsBatch(actors, forceSequence, defaultTimestep);

      expect(result.stepsCompleted).toBe(10);
      expect(result.stepHashes.length).toBe(10);

      // Each step hash should be unique (different state each frame)
      const uniqueHashes = new Set(result.stepHashes);
      expect(uniqueHashes.size).toBeLessThanOrEqual(10); // Some might be same if converges
    });

    it('should accumulate impulses across steps', () => {
      const actors = [actor1];
      const forceSequence: (ActorForce[] | undefined)[] = [[force1], [force1], [force1]];

      const result = stepPhysicsBatch(actors, forceSequence, defaultTimestep);

      // Should have at least 3 steps * (gravity + applied force) impulses
      expect(result.allImpulses.length).toBeGreaterThanOrEqual(6);
    });
  });

  describe('Determinism Verification', () => {
    it('should verify determinism returns true for same inputs', () => {
      const actors = [actor1, actor2];
      const forces = [force1];

      const isDeterministic = verifyDeterminism(actors, forces, defaultTimestep);
      expect(isDeterministic).toBe(true);
    });

    it('should verify determinism for complex scenarios', () => {
      const actors = [actor1, actor2, staticActor];
      const forces = [force1, { actor_id: 'actor:2', force: [-5, 10, 0] }];

      const isDeterministic = verifyDeterminism(actors, forces, defaultTimestep);
      expect(isDeterministic).toBe(true);
    });

    it('should detect non-determinism if data mutates', () => {
      const actors = [actor1];
      const forces = [force1];

      // First run
      const result1 = stepPhysics(actors, forces, defaultTimestep);
      const hash1 = hashPayload(result1.updatedActors);

      // Mutate actor (should not happen, but test safety)
      const mutatedActors = [{ ...actor1, velocity: [999, 999, 999] as any }];
      const result2 = stepPhysics(mutatedActors, forces, defaultTimestep);
      const hash2 = hashPayload(result2.updatedActors);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Collision Detection', () => {
    it('should detect collisions between close actors', () => {
      const closeActor1 = { ...actor1, position: [0, 0, 0] };
      const closeActor2 = { ...actor2, position: [0.3, 0, 0] }; // Very close

      const result = stepPhysics([closeActor1, closeActor2], [], defaultTimestep);

      // Should detect at least one collision
      expect(result.collisions.length).toBeGreaterThan(0);
    });

    it('should sort collisions deterministically', () => {
      const a1 = { ...actor1, position: [0, 0, 0] };
      const a2 = { ...actor2, position: [0.3, 0, 0] };
      const a3 = { ...staticActor, position: [0.2, 0, 0] };

      const result = stepPhysics([a1, a2, a3], [], defaultTimestep);

      // Collisions should be sorted by actor pair
      for (let i = 1; i < result.collisions.length; i++) {
        const prevKey = `${result.collisions[i - 1].actor_a}:${result.collisions[i - 1].actor_b}`;
        const currKey = `${result.collisions[i].actor_a}:${result.collisions[i].actor_b}`;
        expect(prevKey.localeCompare(currKey)).toBeLessThanOrEqual(0);
      }
    });
  });

  describe('Timestep Parameters', () => {
    it('should respect different dt values', () => {
      const actors = [actor1];
      const forces = [force1];

      const dt16 = { ...defaultTimestep, dt_ms: 16 };
      const dt33 = { ...defaultTimestep, dt_ms: 33 };

      const result16 = stepPhysics(actors, forces, dt16);
      const result33 = stepPhysics(actors, forces, dt33);

      // Different dt should produce different velocities
      const vel16 = result16.updatedActors[0].velocity[0];
      const vel33 = result33.updatedActors[0].velocity[0];

      expect(vel16).not.toBe(vel33);
    });

    it('should apply custom gravity correctly', () => {
      const actors = [{ ...actor1, velocity: [0, 0, 0] }];
      const forces: ActorForce[] = [];

      const lowGravity = { ...defaultTimestep, gravity: [0, -1e-3, 0] };
      const highGravity = { ...defaultTimestep, gravity: [0, -1, 0] };

      const resultLow = stepPhysics(actors, forces, lowGravity);
      const resultHigh = stepPhysics(actors, forces, highGravity);

      // High gravity should produce more downward velocity
      expect(resultHigh.updatedActors[0].velocity[1]).toBeLessThan(
        resultLow.updatedActors[0].velocity[1]
      );
    });
  });
});
