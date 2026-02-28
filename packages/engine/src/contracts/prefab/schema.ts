import { z } from 'zod';

/**
 * Prefab System v1 Contracts
 * Defines Avatar and Building prefabs as reusable composition units
 *
 * Contract ID: prefab_id = "prefab:" + sha256(canonical_json(prefab_spec))
 */

export const PrefabNodeSchema = z.object({
  /**
   * Unique node identifier within this prefab
   */
  node_id: z.string(),
  /**
   * Node name
   */
  name: z.string(),
  /**
   * Reference to a mesh asset (content hash)
   */
  meshAssetHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  /**
   * Local transform: translation [x, y, z]
   */
  translation: z.tuple([z.number(), z.number(), z.number()]).optional().default([0, 0, 0]),
  /**
   * Local transform: rotation as quaternion [x, y, z, w]
   */
  rotation: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional().default([0, 0, 0, 1]),
  /**
   * Local transform: scale [x, y, z]
   */
  scale: z.tuple([z.number(), z.number(), z.number()]).optional().default([1, 1, 1]),
  /**
   * Material override (optional; PBR color, metallic, roughness)
   */
  material: z.object({
    baseColorFactor: z.array(z.number()).length(4).optional(),
    metallicFactor: z.number().optional(),
    roughnessFactor: z.number().optional(),
  }).optional(),
});

export type PrefabNode = z.infer<typeof PrefabNodeSchema>;

/**
 * Avatar Prefab v1
 * Represents a character or NPC model
 */
export const AvatarPrefabSchema = z.object({
  /**
   * Prefab kind
   */
  kind: z.literal('avatar'),
  /**
   * Human-readable name
   */
  name: z.string(),
  /**
   * Version (semantic)
   */
  version: z.string().refine(v => /^\d+\.\d+\.\d+$/.test(v), 'Must be semantic version'),
  /**
   * Root node containing the hierarchy
   */
  root: PrefabNodeSchema,
  /**
   * Child nodes (stable-sorted by node_id when serialized)
   */
  nodes: z.array(PrefabNodeSchema),
  /**
   * Skeleton joint names if this is rigged (e.g., ["Armature", "Bone.001", ...])
   */
  skeletonJoints: z.array(z.string()).optional().default([]),
  /**
   * Reference to the mesh style spec applied
   */
  meshStyleId: z.string().optional(),
  /**
   * List of asset hashes used in nodes (for dependency tracking)
   */
  assetRefs: z.array(z.string().regex(/^[a-f0-9]{64}$/)),
});

export type AvatarPrefab = z.infer<typeof AvatarPrefabSchema>;

/**
 * Building Prefab v1
 * Represents a structure or prop
 */
export const BuildingPrefabSchema = z.object({
  /**
   * Prefab kind
   */
  kind: z.literal('building'),
  /**
   * Human-readable name
   */
  name: z.string(),
  /**
   * Version (semantic)
   */
  version: z.string().refine(v => /^\d+\.\d+\.\d+$/.test(v), 'Must be semantic version'),
  /**
   * Root node
   */
  root: PrefabNodeSchema,
  /**
   * Child nodes (stable-sorted by node_id when serialized)
   */
  nodes: z.array(PrefabNodeSchema),
  /**
   * Bounding box: min [x, y, z] and max [x, y, z] in local space
   */
  boundingBox: z.object({
    min: z.tuple([z.number(), z.number(), z.number()]),
    max: z.tuple([z.number(), z.number(), z.number()]),
  }).optional(),
  /**
   * Reference to the mesh style spec applied
   */
  meshStyleId: z.string().optional(),
  /**
   * List of asset hashes used in nodes
   */
  assetRefs: z.array(z.string().regex(/^[a-f0-9]{64}$/)),
});

export type BuildingPrefab = z.infer<typeof BuildingPrefabSchema>;

/**
 * Union of prefab types
 */
export const PrefabSpecSchema = z.union([AvatarPrefabSchema, BuildingPrefabSchema]);
export type PrefabSpec = z.infer<typeof PrefabSpecSchema>;

/**
 * Prefab Bake Manifest v1
 * Generated when baking a prefab (normalizing, validating, cementing references)
 * Includes stable ordering of all nodes
 */
export const PrefabBakeManifestSchema = z.object({
  /**
   * Content-addressed ID: "prefab:" + sha256(canonical_json(prefab_spec))
   */
  prefab_id: z.string(),
  /**
   * Kind of prefab
   */
  kind: z.enum(['avatar', 'building']),
  /**
   * Hash of the prefab spec that was baked
   */
  prefab_hash: z.string().regex(/^[a-f0-9]{64}$/),
  /**
   * Hash of the mesh style spec applied during baking
   */
  style_hash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  /**
   * Stable-sorted list of all mesh asset hashes referenced
   */
  assetRefs: z.array(z.string().regex(/^[a-f0-9]{64}$/)),
  /**
   * Hash of the combined asset refs (for dependency tracking)
   */
  assetRefsHash: z.string().regex(/^[a-f0-9]{64}$/),
  /**
   * Root transform (global binding point)
   */
  rootTransform: z.object({
    translation: z.tuple([z.number(), z.number(), z.number()]),
    rotation: z.tuple([z.number(), z.number(), z.number(), z.number()]),
    scale: z.tuple([z.number(), z.number(), z.number()]),
  }),
  /**
   * Bake result: "success" or reason if failed
   */
  bakeStatus: z.enum(['success', 'validation_error', 'asset_missing', 'other_error']),
  /**
   * Human-readable bake message (errors if bakeStatus !== "success")
   */
  bakeMessage: z.string().optional(),
});

export type PrefabBakeManifest = z.infer<typeof PrefabBakeManifestSchema>;
