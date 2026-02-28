import { MeshStyleSpec } from '../contracts/mesh/schema';
import {
    PrefabBakeManifest,
    PrefabSpec
} from '../contracts/prefab/schema';
import { hashList, hashPayload } from '../determinism';

/**
 * Prefab Baker
 * Bakes prefab specs into deterministic manifests
 * Always produces the same manifest hash for the same inputs
 */

export interface BakeOptions {
  /**
   * Style spec to apply during baking
   */
  styleSpec?: MeshStyleSpec;
  /**
   * Whether to validate all asset references exist
   */
  validateAssets?: boolean;
}

/**
 * Bake a prefab spec into a normalized, deterministic manifest
 */
export function bakePrefabSpec(
  prefab: PrefabSpec,
  options?: BakeOptions
): PrefabBakeManifest {
  // Compute prefab hash from canonical JSON
  const prefabHash = hashPayload(prefab);

  // Generate content-addressed ID
  const prefabId = `prefab:${prefabHash}`;

  // Sort asset references deterministically
  const assetRefs = [...prefab.assetRefs].sort();
  const assetRefsHash = hashList(assetRefs);

  // Style hash if style was provided
  const styleHash = options?.styleSpec ? hashPayload(options.styleSpec) : undefined;

  // Extract root transform
  const rootTransform = {
    translation: prefab.root.translation ?? [0, 0, 0],
    rotation: prefab.root.rotation ?? [0, 0, 0, 1],
    scale: prefab.root.scale ?? [1, 1, 1],
  };

  // Validate asset references if requested
  let bakeStatus: 'success' | 'validation_error' | 'asset_missing' | 'other_error' = 'success';
  let bakeMessage: string | undefined;

  if (options?.validateAssets) {
    // In v1, we don't have actual asset storage access, so we skip validation
    // In real implementation, check artifact store
    for (const assetHash of assetRefs) {
      if (!assetHash || assetHash.length !== 64) {
        bakeStatus = 'validation_error';
        bakeMessage = `Invalid asset hash format: ${assetHash}`;
        break;
      }
    }
  }

  // Build manifest
  const manifest: PrefabBakeManifest = {
    prefab_id: prefabId,
    kind: prefab.kind,
    prefab_hash: prefabHash,
    style_hash: styleHash,
    assetRefs,
    assetRefsHash,
    rootTransform,
    bakeStatus,
    bakeMessage,
  };

  return manifest;
}

/**
 * Batch bake multiple prefabs
 * Returns manifests in stable order (sorted by prefab_id)
 */
export function bakePrefabBatch(
  prefabs: PrefabSpec[],
  options?: BakeOptions
): PrefabBakeManifest[] {
  const manifests = prefabs.map(p => bakePrefabSpec(p, options));

  // Stable sort by prefab_id
  manifests.sort((a, b) => a.prefab_id.localeCompare(b.prefab_id));

  return manifests;
}

/**
 * Verify that a manifest matches a prefab spec (for replay/audit)
 */
export function verifyManifestAgainstSpec(
  manifest: PrefabBakeManifest,
  prefab: PrefabSpec
): boolean {
  const expectedHash = hashPayload(prefab);
  return manifest.prefab_hash === expectedHash;
}
