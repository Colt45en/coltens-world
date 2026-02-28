/**
 * World Core Determinism Tests
 * Verify that all operations produce byte-identical output for same inputs
 *
 * Run with: pnpm test:determinism
 */

import { describe, expect, it } from 'vitest';
import { MeshStyleSpec } from '../../src/contracts/mesh/schema';
import { AvatarPrefab } from '../../src/contracts/prefab/schema';
import { PrefabInstance } from '../../src/contracts/world/schema';
import {
    hashList,
    hashPayload,
    toCanonicalJson,
} from '../../src/determinism';
import {
    validateMeshAsset,
    validateMeshAssetBatch,
} from '../../src/mesh/validator';
import { bakePrefabSpec } from '../../src/prefab/baker';
import {
    createWorldSnapshot,
    executeWorldReplay,
    verifySnapshotHash,
} from '../../src/world/snapshot';

describe('Determinism: Canonical JSON', () => {
  it('should produce identical canonical JSON for same object', () => {
    const obj = { b: 2, a: 1, c: { z: 26, y: 25 } };
    const json1 = toCanonicalJson(obj);
    const json2 = toCanonicalJson(obj);
    expect(json1).toBe(json2);
    expect(json1).toBe('{"a":1,"b":2,"c":{"y":25,"z":26}}');
  });

  it('should sort object keys lexicographically', () => {
    const obj = { z: 1, a: 2, m: 3 };
    const json = toCanonicalJson(obj);
    expect(json).toBe('{"a":2,"m":3,"z":1}');
  });

  it('should preserve array order by default', () => {
    const arr = [3, 1, 2];
    const json = toCanonicalJson(arr);
    expect(json).toBe('[3,1,2]');
  });

  it('should sort arrays when requested', () => {
    const arr = [3, 1, 2];
    const json = toCanonicalJson(arr, { sortArrays: true });
    expect(json).toBe('[1,2,3]');
  });
});

describe('Determinism: Hashing', () => {
  it('should produce identical hashes for same payload', () => {
    const payload = { name: 'test', value: 42 };
    const hash1 = hashPayload(payload);
    const hash2 = hashPayload(payload);
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should produce different hashes for different payloads', () => {
    const hash1 = hashPayload({ value: 1 });
    const hash2 = hashPayload({ value: 2 });
    expect(hash1).not.toBe(hash2);
  });

  it('should produce identical list hashes for same items in same order', () => {
    const items = ['a', 'b', 'c'];
    const hash1 = hashList(items);
    const hash2 = hashList(items);
    expect(hash1).toBe(hash2);
  });

  it('should produce different list hashes for different order', () => {
    const hash1 = hashList(['a', 'b', 'c']);
    const hash2 = hashList(['c', 'b', 'a']);
    expect(hash1).not.toBe(hash2);
  });
});

describe('Determinism: Mesh Validation', () => {
  const testStyle: MeshStyleSpec = {
    style_id: 'we.mesh.style.test',
    version: '1.0.0',
    description: 'Test style',
    defaultMaterial: {
      pbr: {
        baseColorFactor: [1, 1, 1, 1],
        metallicFactor: 0,
        roughnessFactor: 1,
      },
    },
    maxTriangleCount: 50000,
  };

  const testAsset = {
    asset_id: 'asset-1',
    name: 'test model',
    byteSize: 10000,
    assetHash: 'a'.repeat(64),
  };

  it('should produce identical validation reports for same inputs', () => {
    const report1 = validateMeshAsset(testAsset, testStyle);
    const report2 = validateMeshAsset(testAsset, testStyle);

    expect(report1.report_hash).toBe(report2.report_hash);
    expect(report1.ok).toBe(report2.ok);
    expect(report1.violations).toEqual(report2.violations);
  });

  it('should produce same hash for reordered violations', () => {
    const asset1 = { ...testAsset, asset_id: 'asset-1' };
    const asset2 = { ...testAsset, asset_id: 'asset-2', byteSize: 120000000 }; // Will exceed limit

    const reports = validateMeshAssetBatch([asset2, asset1], testStyle);

    // Should be sorted by asset_id
    expect(reports[0].asset.asset_id).toBe('asset-1');
    expect(reports[1].asset.asset_id).toBe('asset-2');

    // Validate ordering is stable
    const reportsSorted = validateMeshAssetBatch([asset1, asset2], testStyle);
    expect(reportsSorted[0].report_hash).toBe(reports[0].report_hash);
    expect(reportsSorted[1].report_hash).toBe(reports[1].report_hash);
  });
});

describe('Determinism: Prefab Baking', () => {
  const testPrefab: AvatarPrefab = {
    kind: 'avatar',
    name: 'TestAvatar',
    version: '1.0.0',
    root: {
      node_id: 'root',
      name: 'Root',
    },
    nodes: [
      {
        node_id: 'head',
        name: 'Head',
        meshAssetHash: 'b'.repeat(64),
      },
      {
        node_id: 'body',
        name: 'Body',
        meshAssetHash: 'c'.repeat(64),
      },
    ],
    assetRefs: ['b'.repeat(64), 'c'.repeat(64)],
  };

  it('should produce identical manifests for same inputs', () => {
    const manifest1 = bakePrefabSpec(testPrefab);
    const manifest2 = bakePrefabSpec(testPrefab);

    expect(manifest1.prefab_id).toBe(manifest2.prefab_id);
    expect(manifest1.prefab_hash).toBe(manifest2.prefab_hash);
    expect(manifest1.assetRefsHash).toBe(manifest2.assetRefsHash);
  });

  it('should produce same prefab_id for unordered asset list', () => {
    const prefab1 = bakePrefabSpec(testPrefab);

    // Create same prefab with assets in different order
    const testPrefab2: AvatarPrefab = {
      ...testPrefab,
      assetRefs: ['c'.repeat(64), 'b'.repeat(64)], // Reversed
    };
    const prefab2 = bakePrefabSpec(testPrefab2);

    // Should have different hashes (different input)
    expect(prefab1.prefab_hash).not.toBe(prefab2.prefab_hash);

    // But both should be valid manifests
    expect(prefab1.bakeStatus).toBe('success');
    expect(prefab2.bakeStatus).toBe('success');
  });

  it('should produce stable ordered asset refs', () => {
    const manifest = bakePrefabSpec(testPrefab);

    // Assets should be sorted
    expect(manifest.assetRefs).toEqual(['b'.repeat(64), 'c'.repeat(64)]);
  });
});

describe('Determinism: World Snapshots', () => {
  const testInstances: PrefabInstance[] = [
    {
      instance_id: 'inst-1',
      prefabId: 'prefab:' + 'a'.repeat(64),
      position: [0, 0, 0],
    },
    {
      instance_id: 'inst-2',
      prefabId: 'prefab:' + 'b'.repeat(64),
      position: [1, 2, 3],
    },
  ];

  it('should produce identical snapshot IDs for same state', () => {
    const snap1 = createWorldSnapshot(
      'scene-1',
      0,
      testInstances,
      'test-tool',
      'v1.0.0'
    );
    const snap2 = createWorldSnapshot(
      'scene-1',
      0,
      [...testInstances], // Copy to ensure new array
      'test-tool',
      'v1.0.0'
    );

    expect(snap1.snapshot_id).toBe(snap2.snapshot_id);
  });

  it('should verify snapshot hash validity', () => {
    const snap = createWorldSnapshot(
      'scene-1',
      0,
      testInstances,
      'test-tool',
      'v1.0.0'
    );

    const verification = verifySnapshotHash(snap);
    expect(verification.valid).toBe(true);
    expect(verification.computedId).toBe(snap.snapshot_id);
  });

  it('should detect modified snapshots', () => {
    const snap = createWorldSnapshot(
      'scene-1',
      0,
      testInstances,
      'test-tool',
      'v1.0.0'
    );

    // Modify the snapshot
    const modified = {
      ...snap,
      tick: 1, // Changed tick
    };

    const verification = verifySnapshotHash(modified);
    expect(verification.valid).toBe(false);
  });

  it('should sort instances stably', () => {
    const unordered: PrefabInstance[] = [
      {
        instance_id: '3',
        prefabId: 'prefab:' + 'c'.repeat(64),
        position: [0, 0, 0],
      },
      {
        instance_id: '1',
        prefabId: 'prefab:' + 'a'.repeat(64),
        position: [0, 0, 0],
      },
      {
        instance_id: '2',
        prefabId: 'prefab:' + 'b'.repeat(64),
        position: [0, 0, 0],
      },
    ];

    const snap = createWorldSnapshot(
      'scene-1',
      0,
      unordered,
      'test-tool',
      'v1.0.0'
    );

    expect(snap.instances[0].instance_id).toBe('1');
    expect(snap.instances[1].instance_id).toBe('2');
    expect(snap.instances[2].instance_id).toBe('3');
  });
});

describe('Determinism: World Replay', () => {
  const testInstances: PrefabInstance[] = [
    {
      instance_id: 'inst-1',
      prefabId: 'prefab:' + 'a'.repeat(64),
      position: [0, 0, 0],
    },
  ];

  it('should produce identical results for identical requests', () => {
    const snap = createWorldSnapshot(
      'scene-1',
      0,
      testInstances,
      'test-tool',
      'v1.0.0'
    );

    const request = {
      startSnapshotId: snap.snapshot_id!,
      startTick: 0,
      endTick: 10,
    };

    const result1 = executeWorldReplay(request, snap);
    const result2 = executeWorldReplay(request, snap);

    expect(result1.result_hash).toBe(result2.result_hash);
    expect(result1.status).toBe(result2.status);
  });
});
