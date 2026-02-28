/**
 * Nucleus Routes: World Snapshot + Replay (World Core)
 *
 * Tool IDs:
 * - world.snapshot.write.v1
 * - world.snapshot.get.v1
 * - world.replay.v1
 */

import {
  WorldReplayExecutedEventSchema,
  WorldSnapshotWrittenEventSchema,
} from "@coltens-world/engine/contracts/ledger";
import { PrefabInstanceSchema, WorldSnapshotSchema } from "@coltens-world/engine/contracts/world";
import { hashPayload } from "@coltens-world/engine/determinism";
import { createWorldSnapshot, executeWorldReplay } from "@coltens-world/engine/world";
import { Request, Response, Router } from "express";
import { z } from "zod";

const router = Router();

/**
 * In-memory snapshot store
 * Key: snapshot_id, Value: snapshot + metadata
 */
const snapshotStore = new Map<
  string,
  {
    snapshot: any;
    hash: string;
  }
>();

/**
 * Tool: world.snapshot.write.v1
 * Write a new world snapshot
 */
router.post('/world.snapshot.write.v1', async (req: Request, res: Response) => {
  try {
    const input = z.object({
      scene_id: z.string(),
      tick: z.number().int().min(0),
      instances: z.array(PrefabInstanceSchema),
    }).parse(req.body);

    // Create snapshot
    const snapshot = createWorldSnapshot(
      input.scene_id,
      input.tick,
      input.instances,
      'nucleus-world.snapshot.write.v1',
      'world-core-v1.0.0'
    );

    // Verify it has a valid ID
    if (!snapshot.snapshot_id) {
      return res.status(500).json({
        ok: false,
        error: 'Failed to generate snapshot ID',
      });
    }

    // Store snapshot
    const verified = WorldSnapshotSchema.safeParse(snapshot);
    if (!verified.success) {
      return res.status(500).json({
        ok: false,
        error: 'Snapshot does not match contract',
      });
    }

    const snapshotHash = hashPayload({
      tick: snapshot.tick,
      scene_id: snapshot.scene_id,
      recorded_at_utc: snapshot.recorded_at_utc,
      instances: snapshot.instances,
      instances_hash: snapshot.instances_hash,
      metadata: snapshot.metadata,
    });

    snapshotStore.set(snapshot.snapshot_id, {
      snapshot: verified.data,
      hash: snapshotHash,
    });

    // Create ledger event
    const ledgerEvent = WorldSnapshotWrittenEventSchema.parse({
      event_type: 'world.snapshot.written.v1' as const,
      occurred_at_utc: new Date().toISOString(),
      deterministic_context: {
        engineVersion: 'world-core-v1.0.0',
        toolId: 'world.snapshot.write.v1',
      },
      data: {
        snapshot_id: snapshot.snapshot_id,
        snapshot_hash: snapshotHash,
        tick: snapshot.tick,
        scene_id: snapshot.scene_id,
        instances_count: snapshot.instances.length,
      },
      input_hashes: {
        instances: snapshot.instances_hash!,
      },
      output_hashes: {
        snapshot: snapshotHash,
      },
    });

    return res.status(200).json({
      ok: true,
      snapshot_id: snapshot.snapshot_id,
      snapshot_hash: snapshotHash,
      tick: snapshot.tick,
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
 * Tool: world.snapshot.get.v1
 * Retrieve a snapshot
 */
router.post('/world.snapshot.get.v1', async (req: Request, res: Response) => {
  try {
    const input = z.object({
      snapshot_id: z.string(),
    }).parse(req.body);

    const entry = snapshotStore.get(input.snapshot_id);
    if (!entry) {
      return res.status(404).json({
        ok: false,
        error: `Snapshot not found: ${input.snapshot_id}`,
      });
    }

    return res.status(200).json({
      ok: true,
      snapshot: entry.snapshot,
      snapshot_hash: entry.hash,
    });
  } catch (err: any) {
    return res.status(400).json({
      ok: false,
      error: err.message || 'Invalid input',
    });
  }
});

/**
 * Tool: world.replay.v1
 * Execute a world replay
 */
router.post('/world.replay.v1', async (req: Request, res: Response) => {
  try {
    const input = z.object({
      start_snapshot_id: z.string(),
      start_tick: z.number().int().min(0),
      end_tick: z.number().int().min(0),
      systems: z.array(z.string()).optional(),
    }).parse(req.body);

    // Get starting snapshot
    const startEntry = snapshotStore.get(input.start_snapshot_id);
    if (!startEntry) {
      return res.status(404).json({
        ok: false,
        error: `Start snapshot not found: ${input.start_snapshot_id}`,
      });
    }

    // Build replay request
    const replayRequest = {
      startSnapshotId: input.start_snapshot_id,
      startTick: input.start_tick,
      endTick: input.end_tick,
      systems: input.systems || ['physics'],
    };

    const requestHash = hashPayload(replayRequest);

    // Execute replay
    const result = executeWorldReplay(
      { ...replayRequest, request_hash: requestHash },
      startEntry.snapshot
    );

    // Create ledger event
    const ledgerEvent = WorldReplayExecutedEventSchema.parse({
      event_type: 'world.replay.executed.v1' as const,
      occurred_at_utc: new Date().toISOString(),
      deterministic_context: {
        engineVersion: 'world-core-v1.0.0',
        toolId: 'world.replay.v1',
      },
      data: {
        request_hash: requestHash,
        result_hash: result.result_hash!,
        start_tick: input.start_tick,
        end_tick: input.end_tick,
        status: result.status,
      },
      input_hashes: {
        request: requestHash,
        snapshot: startEntry.hash,
      },
      output_hashes: {
        result: result.result_hash!,
      },
    });

    // Store result snapshot if present
    if (result.finalSnapshot) {
      const resultHash = hashPayload({
        tick: result.finalSnapshot.tick,
        scene_id: result.finalSnapshot.scene_id,
        recorded_at_utc: result.finalSnapshot.recorded_at_utc,
        instances: result.finalSnapshot.instances,
        instances_hash: result.finalSnapshot.instances_hash,
        metadata: result.finalSnapshot.metadata,
      });

      if (result.finalSnapshot.snapshot_id) {
        snapshotStore.set(result.finalSnapshot.snapshot_id, {
          snapshot: result.finalSnapshot,
          hash: resultHash,
        });
      }
    }

    return res.status(200).json({
      ok: true,
      status: result.status,
      result_hash: result.result_hash,
      final_snapshot_id: result.finalSnapshot?.snapshot_id,
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
