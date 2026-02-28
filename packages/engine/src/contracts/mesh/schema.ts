import { z } from 'zod';

/**
 * Mesh Style Spec v1 Contract
 * Defines rules for valid 3D assets (glTF/glb format with PBR materials)
 *
 * Contract ID: "we.mesh.style.core" (human) or style_hash (canonical)
 */

export const MeshMaterialSpecSchema = z.object({
  /**
   * PBR material model
   */
  pbr: z.object({
    /**
     * Base color as RGBA (0-1 range normalized)
     * Array order: [R, G, B, A]
     */
    baseColorFactor: z.array(z.number().min(0).max(1)).length(4).optional().default([1, 1, 1, 1]),
    /**
     * Metallic factor (0-1)
     */
    metallicFactor: z.number().min(0).max(1).optional().default(0),
    /**
     * Roughness factor (0-1)
     */
    roughnessFactor: z.number().min(0).max(1).optional().default(1),
  }),
  /**
   * Texture references (optional; not validated in this v1)
   */
  textures: z.record(z.string()).optional(),
});

export const MeshStyleSpecSchema = z.object({
  /**
   * Style identifier (human-readable; e.g., "we.mesh.style.core" or "we.mesh.style.urban")
   */
  style_id: z.string().min(1),
  /**
   * Version of this style spec (semantic versioning)
   */
  version: z.string().refine(v => /^\d+\.\d+\.\d+$/.test(v), 'Must be semantic version'),
  /**
   * Description of style rules
   */
  description: z.string(),
  /**
   * Default material rules for assets conforming to this style
   */
  defaultMaterial: MeshMaterialSpecSchema,
  /**
   * Allowed glTF extensions (e.g., "KHR_materials_unlit", "KHR_materials_ior")
   */
  allowedExtensions: z.array(z.string()).optional().default([]),
  /**
   * Maximum allowed triangle count per asset
   */
  maxTriangleCount: z.number().int().min(100).optional().default(100000),
  /**
   * Whether to auto-generate collider meshes
   */
  autoGenerateColliders: z.boolean().optional().default(true),
  /**
   * Sealed = immutable and ready for use
   */
  sealed: z.boolean().optional().default(false),
});

export type MeshStyleSpec = z.infer<typeof MeshStyleSpecSchema>;
export type MeshMaterialSpec = z.infer<typeof MeshMaterialSpecSchema>;

/**
 * Mesh Asset Reference (used in validation)
 * Points to a glb file (via content hash or URL)
 */
export const MeshAssetRefSchema = z.object({
  /**
   * Unique identifier for this asset (content hash preferred)
   */
  asset_id: z.string(),
  /**
   * Asset name
   */
  name: z.string(),
  /**
   * Size in bytes
   */
  byteSize: z.number().int().min(1),
  /**
   * SHA-256 hash of raw .glb bytes
   */
  assetHash: z.string().regex(/^[a-f0-9]{64}$/),
});

export type MeshAssetRef = z.infer<typeof MeshAssetRefSchema>;

/**
 * Mesh Validation Report v1
 * Generated when validating an asset against a style spec
 * Order: violations are stable-sorted by asset_id + violation_type
 */
export const MeshValidationViolationSchema = z.object({
  /**
   * Type of violation (e.g., "triangle_count_exceeded", "unsupported_extension")
   */
  type: z.string(),
  /**
   * Human-readable message
   */
  message: z.string(),
  /**
   * Severity: "warning" or "error"
   */
  severity: z.enum(['warning', 'error']),
});

export const MeshValidationReportSchema = z.object({
  /**
   * Reference to the asset validated
   */
  asset: MeshAssetRefSchema,
  /**
   * Reference to the style spec used for validation
   */
  style_id: z.string(),
  /**
   * Hash of the style spec applied
   */
  style_hash: z.string().regex(/^[a-f0-9]{64}$/),
  /**
   * Overall validation result
   */
  ok: z.boolean(),
  /**
   * Violations found (stable-sorted)
   */
  violations: z.array(MeshValidationViolationSchema),
  /**
   * Hash of this report (for ledger binding)
   */
  report_hash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
});

export type MeshValidationViolation = z.infer<typeof MeshValidationViolationSchema>;
export type MeshValidationReport = z.infer<typeof MeshValidationReportSchema>;
