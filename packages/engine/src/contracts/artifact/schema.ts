import { z } from 'zod';

/**
 * Artifact v1 Contract
 * Content-addressed storage for binary and JSON assets
 *
 * Every artifact has a deterministic ID: "artifact:" + sha256(raw_bytes)
 */

/**
 * Artifact Metadata
 * Describes an artifact without storing it
 */
export const ArtifactMetadataSchema = z.object({
  /**
   * Content-addressed ID: "artifact:" + sha256(raw_bytes)
   */
  artifact_id: z.string(),
  /**
   * MIME type or artifact type (e.g., "model/gltf-binary", "application/json")
   */
  type: z.string(),
  /**
   * Human-readable name (for bookkeeping, not identity)
   */
  name: z.string().optional(),
  /**
   * Size in bytes
   */
  byteSize: z.number().int().min(0),
  /**
   * SHA-256 hash of raw bytes (hex)
   */
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  /**
   * When this artifact was created/ingested
   */
  created_at_utc: z.string().datetime().optional(),
  /**
   * Additional metadata (e.g., generator_version, source_url)
   */
  metadata: z.record(z.unknown()).optional(),
});

export type ArtifactMetadata = z.infer<typeof ArtifactMetadataSchema>;

/**
 * Artifact Store Operation
 * Result of storing or retrieving an artifact
 */
export const ArtifactStoreOpSchema = z.object({
  /**
   * Operation type: "store", "retrieve", "verify"
   */
  operation: z.enum(['store', 'retrieve', 'verify']),
  /**
   * Artifact metadata
   */
  metadata: ArtifactMetadataSchema,
  /**
   * Success flag
   */
  ok: z.boolean(),
  /**
   * If error, human-readable message
   */
  errorMessage: z.string().optional(),
});

export type ArtifactStoreOp = z.infer<typeof ArtifactStoreOpSchema>;

/**
 * Artifact Reference
 * Used in contracts to point to stored artifacts by hash
 */
export const ArtifactRefSchema = z.object({
  /**
   * Content-addressed ID
   */
  artifact_id: z.string(),
  /**
   * SHA-256 hash (same as in artifact_id after "artifact:" prefix, but explicit)
   */
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  /**
   * MIME type or artifact type
   */
  type: z.string(),
  /**
   * Optional friendly name
   */
  name: z.string().optional(),
});

export type ArtifactRef = z.infer<typeof ArtifactRefSchema>;
