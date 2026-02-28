import {
    PrefabInstance,
    WorldReplayRequest,
    WorldReplayResult,
    WorldSnapshot,
} from '../contracts/world/schema';
import { hashList, hashPayload } from '../determinism';

/**
 * World Snapshot + Replay Runtime
 * Manages world state snapshots and replay operations with deterministic hashing
 */

/**
 * Create a world snapshot from a set of prefab instances
 */
export function createWorldSnapshot(
  sceneId: string,
  tick: number,
  instances: PrefabInstance[],
  creatorTool: string,
  engineVersion: string
): WorldSnapshot {
  // Stable sort instances by instance_id
  const sortedInstances = [...instances].sort((a, b) =>
    a.instance_id.localeCompare(b.instance_id)
  );

  // Compute instances hash
  const instancesHash = hashList(sortedInstances);

  // Build snapshot
  const snapshot: WorldSnapshot = {
    tick,
    scene_id: sceneId,
    recorded_at_utc: new Date().toISOString(),
    instances: sortedInstances,
    instances_hash: instancesHash,
    metadata: {
      creator: creatorTool,
      engineVersion,
    },
  };

  // Compute snapshot hash (canonical form without snapshot_id field)
  const snapshotPayload = {
    tick: snapshot.tick,
    scene_id: snapshot.scene_id,
    recorded_at_utc: snapshot.recorded_at_utc,
    instances: snapshot.instances,
    instances_hash: snapshot.instances_hash,
    metadata: snapshot.metadata,
  };
  const snapshotHash = hashPayload(snapshotPayload);
  const snapshotId = `worldsnap:${snapshotHash}`;

  return {
    ...snapshot,
    snapshot_id: snapshotId,
  };
}

/**
 * Verify that a snapshot's hash is valid
 */
export function verifySnapshotHash(snapshot: WorldSnapshot): {
  valid: boolean;
  computedId: string;
} {
  const snapshotPayload = {
    tick: snapshot.tick,
    scene_id: snapshot.scene_id,
    recorded_at_utc: snapshot.recorded_at_utc,
    instances: snapshot.instances,
    instances_hash: snapshot.instances_hash,
    metadata: snapshot.metadata,
  };
  const snapshotHash = hashPayload(snapshotPayload);
  const computedId = `worldsnap:${snapshotHash}`;

  return {
    valid: snapshot.snapshot_id === computedId,
    computedId,
  };
}

/**
 * Execute a replay operation
 * In v1, this is a "identity replay" — returns the snapshot as-is
 * Real implementation would step through tick range and apply physics, chat, etc.
 */
export function executeWorldReplay(
  request: WorldReplayRequest,
  snapshot: WorldSnapshot
): WorldReplayResult {
  // Compute request hash if not provided
  const requestPayload = {
    startSnapshotId: request.startSnapshotId,
    startTick: request.startTick,
    endTick: request.endTick,
    systems: request.systems,
  };
  const requestHash = request.request_hash || hashPayload(requestPayload);

  // In v1, we just validate the request and return success
  const startTickValid = request.startTick <= snapshot.tick;
  const endTickValid = request.endTick >= request.startTick;

  if (!startTickValid || !endTickValid) {
    const resultPayload = {
      request_hash: requestHash,
      startTick: request.startTick,
      endTick: request.endTick,
      status: 'error' as const,
      errorMessage: 'Invalid tick range for replay',
    };
    return {
      ...resultPayload,
      result_hash: hashPayload(resultPayload),
    };
  }

  // Success: identity replay (snapshot is returned as-is)
  // In real implementation, would apply systems (physics, chat, etc.) and produce new snapshot
  const resultPayload = {
    request_hash: requestHash,
    startTick: request.startTick,
    endTick: request.endTick,
    status: 'success' as const,
    finalSnapshot: snapshot,
  };
  const resultHash = hashPayload(resultPayload);

  return {
    ...resultPayload,
    result_hash: resultHash,
  };
}

/**
 * Batch create snapshots (deterministic for same input)
 */
export function createSnapshotBatch(
  sceneId: string,
  ticks: number[],
  instancesList: PrefabInstance[][],
  creatorTool: string,
  engineVersion: string
): WorldSnapshot[] {
  if (ticks.length !== instancesList.length) {
    throw new Error('Tick and instances arrays must have same length');
  }

  const snapshots = ticks.map((tick, i) =>
    createWorldSnapshot(sceneId, tick, instancesList[i], creatorTool, engineVersion)
  );

  // Stable sort by snapshot_id
  snapshots.sort((a, b) =>
    (a.snapshot_id || '').localeCompare(b.snapshot_id || '')
  );

  return snapshots;
}
