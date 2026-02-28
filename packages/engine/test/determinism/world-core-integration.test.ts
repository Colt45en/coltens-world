/**
 * World Core Integration Test
 * End-to-end test: Mesh Style → Prefab Bake → World Snapshot → Replay
 *
 * Verifies:
 * - Contracts parse correctly
 * - Deterministic hashing across repeated operations
 * - Ledger events are produced with stable structure
 * - Content-addressed IDs are reproducible
 */

import { describe, expect, it } from 'vitest';
import {
    LedgerEventBaseSchema,
    MeshStyleIngestedEventSchema,
    PrefabIngestedEventSchema,
    WorldSnapshotWrittenEventSchema
} from '../../src/contracts/ledger/schema';
import {
    MeshStyleSpecSchema
} from '../../src/contracts/mesh/schema';
import {
    AvatarPrefabSchema
} from '../../src/contracts/prefab/schema';
import {
    hashList,
    hashPayload,
    toCanonicalJson,
} from '../../src/determinism';
import { validateMeshAsset } from '../../src/mesh/validator';
import { bakePrefabSpec } from '../../src/prefab/baker';
import {
    createWorldSnapshot,
    executeWorldReplay,
    verifySnapshotHash,
} from '../../src/world/snapshot';

describe('World Core: Full Integration', () => {
  // Test data fixtures
  const testStyle = {
    style_id: 'we.mesh.style.integration-test',
    version: '1.0.0',
    description: 'Integration test mesh style',
    sealed: false,
    defaultMaterial: {
      pbr: {
        baseColorFactor: [0.8, 0.8, 0.8, 1.0],
        metallicFactor: 0.0,
        roughnessFactor: 0.8,
      },
    },
    maxTriangleCount: 100000,
  };

  const testAsset = {
    asset_id: 'asset:abc123',
    assetHash: 'a'.repeat(64), // Valid SHA-256 hex
    name: 'test_model.glb',
    byteSize: 50000,
    format: 'glb',
  };

  const testAvatarPrefab = {
    name: 'Hero Avatar',
    description: 'Test hero avatar',
    assetRefs: [testAsset],
    boundingBox: {
      min: [-1, -2, -1],
      max: [1, 2, 1],
    },
  };

  const testInstance = {
    instance_id: 'inst:001',
    prefabId: 'prefab:test001',
    position: [0, 0, 0],
    rotation: [0, 0, 0, 1],
    scale: [1, 1, 1],
  };

  it('should parse mesh style spec', () => {
    const parsed = MeshStyleSpecSchema.safeParse(testStyle);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.style_id).toBe('we.mesh.style.integration-test');
    }
  });

  it('should validate mesh asset deterministically', () => {
    const report1 = validateMeshAsset(testAsset, testStyle);
    const report2 = validateMeshAsset(testAsset, testStyle);

    // Hashes must match
    expect(report1.report_hash).toBe(report2.report_hash);
    expect(report1.ok).toBe(report2.ok);
    expect(report1.violations.length).toBe(report2.violations.length);
  });

  it('should ingest mesh style with ledger event', () => {
    const styleHash = hashPayload(testStyle);
    const ledgerEvent = {
      event_type: 'mesh.style.ingested.v1',
      occurred_at_utc: new Date().toISOString(),
      deterministic_context: {
        engineVersion: 'world-core-v1.0.0',
        toolId: 'mesh.style.ingest.v1',
      },
      data: {
        style_id: testStyle.style_id,
        style_version: testStyle.version,
        style_hash: styleHash,
        sealed: false,
      },
      input_hashes: {
        style_spec: styleHash,
      },
      output_hashes: {
        style_hash: styleHash,
      },
    };

    const parsed = MeshStyleIngestedEventSchema.safeParse(ledgerEvent);
    expect(parsed.success).toBe(true);
  });

  it('should parse avatar prefab spec', () => {
    const parsed = AvatarPrefabSchema.safeParse(testAvatarPrefab);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe('Hero Avatar');
    }
  });

  it('should bake prefab deterministically', () => {
    const manifest1 = bakePrefabSpec(testAvatarPrefab, 'avatar', testStyle);
    const manifest2 = bakePrefabSpec(testAvatarPrefab, 'avatar', testStyle);

    // Manifests should be identical
    expect(manifest1.manifest_hash).toBe(manifest2.manifest_hash);
    expect(toCanonicalJson(manifest1)).toBe(toCanonicalJson(manifest2));
  });

  it('should ingest prefab with ledger event', () => {
    const prefabHash = hashPayload(testAvatarPrefab);
    const assetRefsHash = hashPayload(testAvatarPrefab.assetRefs);
    const ledgerEvent = {
      event_type: 'prefab.ingested.v1',
      occurred_at_utc: new Date().toISOString(),
      deterministic_context: {
        engineVersion: 'world-core-v1.0.0',
        toolId: 'prefab.avatar.ingest.v1',
      },
      data: {
        prefab_kind: 'avatar',
        prefab_id: `prefab:${prefabHash}`,
        prefab_hash: prefabHash,
        asset_refs_hash: assetRefsHash,
      },
      input_hashes: {
        prefab_spec: prefabHash,
      },
      output_hashes: {
        prefab_id: prefabHash,
      },
    };

    const parsed = PrefabIngestedEventSchema.safeParse(ledgerEvent);
    expect(parsed.success).toBe(true);
  });

  it('should create world snapshot deterministically', () => {
    const snap1 = createWorldSnapshot(
      'scene:test',
      0,
      [testInstance],
      'test.tool',
      'world-core-v1.0.0'
    );
    const snap2 = createWorldSnapshot(
      'scene:test',
      0,
      [testInstance],
      'test.tool',
      'world-core-v1.0.0'
    );

    // Same inputs → same snapshot hash
    expect(snap1.snapshot_id).toBe(snap2.snapshot_id);
    expect(snap1.instances_hash).toBe(snap2.instances_hash);
  });

  it('should verify snapshot hash correctly', () => {
    const snapshot = createWorldSnapshot(
      'scene:test',
      5,
      [testInstance],
      'test.tool',
      'world-core-v1.0.0'
    );

    const verification = verifySnapshotHash(snapshot);
    expect(verification.valid).toBe(true);
    expect(verification.computedId).toBe(snapshot.snapshot_id);
  });

  it('should write snapshot with ledger event', () => {
    const snapshot = createWorldSnapshot(
      'scene:test',
      0,
      [testInstance],
      'test.tool',
      'world-core-v1.0.0'
    );

    const snapshotHash = hashPayload({
      tick: snapshot.tick,
      scene_id: snapshot.scene_id,
      recorded_at_utc: snapshot.recorded_at_utc,
      instances: snapshot.instances,
      instances_hash: snapshot.instances_hash,
      metadata: snapshot.metadata,
    });

    const ledgerEvent = {
      event_type: 'world.snapshot.written.v1',
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
        instances: snapshot.instances_hash,
      },
      output_hashes: {
        snapshot: snapshotHash,
      },
    };

    const parsed = WorldSnapshotWrittenEventSchema.safeParse(ledgerEvent);
    expect(parsed.success).toBe(true);
  });

  it('should execute world replay and return result hash', () => {
    const snapshot = createWorldSnapshot(
      'scene:test',
      0,
      [testInstance],
      'test.tool',
      'world-core-v1.0.0'
    );

    const request = {
      startSnapshotId: snapshot.snapshot_id,
      startTick: 0,
      endTick: 10,
      systems: ['physics'],
    };

    const result1 = executeWorldReplay(request, snapshot);
    const result2 = executeWorldReplay(request, snapshot);

    // Same request → same result hash
    expect(result1.result_hash).toBe(result2.result_hash);
    expect(result1.status).toBe('success');
  });

  it('should handle stable list hashing', () => {
    const list1 = [
      { id: 'a', value: 1 },
      { id: 'b', value: 2 },
      { id: 'c', value: 3 },
    ];
    const list2 = [
      { id: 'c', value: 3 },
      { id: 'a', value: 1 },
      { id: 'b', value: 2 },
    ];

    const hash1 = hashList(list1);
    const hash2 = hashList(list2);

    // Different order → different hash (order is meaningful for lists)
    expect(hash1).not.toBe(hash2);
  });

  it('should produce canonical JSON with stable serialization', () => {
    const obj = { z: 26, a: 1, m: { y: 25, x: 24 } };
    const json1 = toCanonicalJson(obj);
    const json2 = toCanonicalJson(obj);

    expect(json1).toBe(json2);
    // Keys must be sorted, no whitespace
    expect(json1).toBe('{"a":1,"m":{"x":24,"y":25},"z":26}');
  });

  it('should parse all ledger event types', () => {
    const events = [
      {
        event_type: 'mesh.style.ingested.v1',
        occurred_at_utc: new Date().toISOString(),
        deterministic_context: { engineVersion: 'v1', toolId: 'mesh.style.ingest.v1' },
        data: { style_id: 'test', style_hash: 'a'.repeat(64), sealed: false },
      },
      {
        event_type: 'prefab.ingested.v1',
        occurred_at_utc: new Date().toISOString(),
        deterministic_context: { engineVersion: 'v1', toolId: 'prefab.ingest.v1' },
        data: { prefab_kind: 'avatar', prefab_id: 'p1', prefab_hash: 'a'.repeat(64) },
      },
      {
        event_type: 'world.snapshot.written.v1',
        occurred_at_utc: new Date().toISOString(),
        deterministic_context: { engineVersion: 'v1', toolId: 'world.snapshot.write.v1' },
        data: { snapshot_id: 's1', snapshot_hash: 'a'.repeat(64), tick: 0, scene_id: 'sc1' },
      },
    ];

    events.forEach(event => {
      const parsed = LedgerEventBaseSchema.safeParse(event);
      expect(parsed.success).toBe(true);
    });
  });
});
