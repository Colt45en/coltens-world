/**
 * Nucleus Routes: Physics Stepper (World Core)
 *
 * Tool IDs:
 * - physics.step.v1
 * - physics.snapshot.v1
 */

import {
  PhysicsSnapshotCreatedEventSchema,
  PhysicsStepExecutedEventSchema,
} from "@world-engine/engine/contracts/ledger";
import {
  PhysicsSnapshotSchema,
  PhysicsStepInputSchema,
  PhysicsStepOutputSchema,
} from "@world-engine/engine/contracts/physics";
import { hashPayload } from "@world-engine/engine/determinism";
import { stepPhysics } from "@world-engine/engine/physics";
import { Request, Response, Router } from 'express';
import { z } from 'zod';

const router = Router();

/**
 * In-memory physics world state
 * Key: scene_id, Value: { actors, gravity, damping, tick }
 */
const physicsWorlds = new Map<
  string,
  {
    actors: any[];
    gravity: [number, number, number];
    linearDamping: number;
    angularDamping: number;
    tick: number;
  }
>();

/**
 * Tool: physics.step.v1
 * Execute a single physics timestep
 * Input: world snapshot + forces + timestep params
 * Output: new snapshot + impulses + collisions
 */
router.post('/physics.step.v1', async (req: Request, res: Response) => {
  try {
    const input = PhysicsStepInputSchema.parse(req.body);

    // Extract actor physics states from world snapshot
    const actors = input.world_snapshot.instances.map((instance) => ({
      actor_id: instance.instance_id,
      position: instance.position,
      velocity: (instance.metadata?.velocity as [number, number, number]) ?? [0, 0, 0],
      mass: (instance.metadata?.mass as number) ?? 1,
      isDynamic: (instance.metadata?.isDynamic as boolean) ?? true,
    }));

    // Step simulation
    const { updatedActors, impulses, collisions } = stepPhysics(
      actors,
      input.forces,
      input.timestep
    );

    // Build new world snapshot with updated positions/velocities
    const newInstances = input.world_snapshot.instances.map((instance) => {
      const updatedActor = updatedActors.find((a) => a.actor_id === instance.instance_id);
      if (!updatedActor) return instance;

      return {
        ...instance,
        position: updatedActor.position,
        metadata: {
          ...instance.metadata,
          velocity: updatedActor.velocity,
        },
      };
    });

    // Create new snapshot
    const newSnapPayload = {
      tick: input.world_snapshot.tick + 1,
      scene_id: input.world_snapshot.scene_id,
      recorded_at_utc: new Date().toISOString(),
      instances: newInstances,
    };

    const newSnapshotHash = hashPayload(newSnapPayload);
    const newSnapshotId = `worldsnap:${newSnapshotHash}`;

    // Build output
    const output = {
      world_snapshot: {
        ...newSnapPayload,
        snapshot_id: newSnapshotId,
        instances_hash: hashPayload(newInstances),
        metadata: {
          creator: 'physics.step.v1',
          engineVersion: 'world-core-v1.0.0',
        },
      },
      impulses_applied: impulses,
      collision_events: collisions,
      tick: input.world_snapshot.tick + 1,
      elapsed_ms: input.world_snapshot.tick * input.timestep.dt_ms + input.timestep.dt_ms,
      output_hash: hashPayload({ impulses_applied: impulses, collision_events: collisions }),
    };

    // Verify output matches contract
    const verified = PhysicsStepOutputSchema.safeParse(output);
    if (!verified.success) {
      return res.status(500).json({
        ok: false,
        error: 'Output does not match contract',
        details: verified.error.message,
      });
    }

    // Compute input hash
    const inputHash = input.input_hash || hashPayload(input);

    // Create ledger event
    const ledgerEvent = PhysicsStepExecutedEventSchema.parse({
      event_type: 'physics.step.executed.v1' as const,
      occurred_at_utc: new Date().toISOString(),
      deterministic_context: {
        engineVersion: 'world-core-v1.0.0',
        toolId: 'physics.step.v1',
      },
      data: {
        tick: input.world_snapshot.tick + 1,
        dt_ms: input.timestep.dt_ms,
        input_hash: inputHash,
        output_hash: output.output_hash,
        collision_count: collisions.length,
        impulse_count: impulses.length,
      },
      input_hashes: {
        world_snapshot: hashPayload(input.world_snapshot),
        timestep: hashPayload(input.timestep),
        forces: hashPayload(input.forces),
      },
      output_hashes: {
        new_snapshot: newSnapshotHash,
        impulses: hashPayload(impulses),
        collisions: hashPayload(collisions),
      },
    });

    return res.status(200).json({
      ok: true,
      ...verified.data,
      ledger_event: ledgerEvent,
    });
  } catch (err: any) {
    return res.status(400).json({
      ok: false,
      error: err.message || 'Invalid input',
    });
  }
});

/**
 * Tool: physics.snapshot.v1
 * Create a deterministic physics snapshot from a world snapshot
 * Used for physics-specific verification and replay
 */
router.post('/physics.snapshot.v1', async (req: Request, res: Response) => {
  try {
    const input = z.object({
      world_snapshot: z.unknown(),
      gravity: z.tuple([z.number(), z.number(), z.number()]).optional(),
      linearDamping: z.number().min(0).max(1).optional(),
      angularDamping: z.number().min(0).max(1).optional(),
    }).parse(req.body);

    const worldSnap = input.world_snapshot as any;
    const gravity = input.gravity ?? [0, -9.81e-3, 0];
    const linearDamping = input.linearDamping ?? 0.01;
    const angularDamping = input.angularDamping ?? 0.01;

    // Extract actor states
    const actors = (worldSnap.instances ?? [])
      .map((instance: any) => ({
        actor_id: instance.instance_id,
        position: instance.position,
        velocity: instance.metadata?.velocity ?? [0, 0, 0],
        mass: instance.metadata?.mass ?? 1,
      }))
      .sort((a: any, b: any) => a.actor_id.localeCompare(b.actor_id));

    // Build physics snapshot
    const physicsSnap = {
      source_snapshot_id: worldSnap.snapshot_id,
      tick: worldSnap.tick,
      scene_id: worldSnap.scene_id,
      actors,
      gravity,
      dampings: {
        linear: linearDamping,
        angular: angularDamping,
      },
    };

    const physicsHash = hashPayload(physicsSnap);

    const output = {
      ...physicsSnap,
      physics_hash: physicsHash,
    };

    // Verify output
    const verified = PhysicsSnapshotSchema.safeParse(output);
    if (!verified.success) {
      return res.status(500).json({
        ok: false,
        error: 'Physics snapshot does not match contract',
      });
    }

    // Create ledger event
    const ledgerEvent = PhysicsSnapshotCreatedEventSchema.parse({
      event_type: 'physics.snapshot.created.v1' as const,
      occurred_at_utc: new Date().toISOString(),
      deterministic_context: {
        engineVersion: 'world-core-v1.0.0',
        toolId: 'physics.snapshot.v1',
      },
      data: {
        physics_hash: physicsHash,
        source_snapshot_id: worldSnap.snapshot_id,
        tick: worldSnap.tick,
        actor_count: actors.length,
      },
      input_hashes: {
        world_snapshot: hashPayload(worldSnap),
        gravity: hashPayload(gravity),
      },
      output_hashes: {
        physics_snapshot: physicsHash,
      },
    });

    return res.status(200).json({
      ok: true,
      ...verified.data,
      ledger_event: ledgerEvent,
    });
  } catch (err: any) {
    return res.status(400).json({
      ok: false,
      error: err.message || 'Invalid input',
    });
  }
});

export default router;
