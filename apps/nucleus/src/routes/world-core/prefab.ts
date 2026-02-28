/**
 * Nucleus Routes: Prefab System + Baker (World Core)
 *
 * Tool IDs:
 * - prefab.avatar.ingest.v1
 * - prefab.building.ingest.v1
 * - prefab.bake.v1
 * - prefab.get.v1
 */

import {
  PrefabBakedEventSchema,
  PrefabIngestedEventSchema,
} from "@world-engine/engine/contracts/ledger";
import {
  AvatarPrefabSchema,
  BuildingPrefabSchema,
  PrefabBakeManifestSchema,
} from "@world-engine/engine/contracts/prefab";
import { hashPayload } from "@world-engine/engine/determinism";
import { bakePrefabSpec } from "@world-engine/engine/prefab";
import { Request, Response, Router } from 'express';
import { z } from 'zod';

const router = Router();

/**
 * In-memory prefab registry
 * Key: prefab_id, Value: { spec, hash, manifest }
 */
const prefabRegistry = new Map<
  string,
  {
    spec: any;
    hash: string;
    kind: 'avatar' | 'building';
    manifest?: any;
  }
>();

/**
 * Tool: prefab.avatar.ingest.v1
 * Ingest an avatar prefab spec
 */
router.post('/prefab.avatar.ingest.v1', async (req: Request, res: Response) => {
  try {
    const input = AvatarPrefabSchema.parse(req.body);

    // Compute content-addressed ID
    const prefabHash = hashPayload(input);
    const prefabId = `prefab:${prefabHash}`;

    // Check for duplicates
    const existing = prefabRegistry.get(prefabId);
    if (existing && existing.hash !== prefabHash) {
      return res.status(409).json({
        ok: false,
        error: 'Prefab already exists with different spec',
      });
    }

    // Register
    prefabRegistry.set(prefabId, {
      spec: input,
      hash: prefabHash,
      kind: 'avatar',
    });

    // Create ledger event
    const assetRefsHash = hashPayload(input.assetRefs);
    const ledgerEvent = PrefabIngestedEventSchema.parse({
      event_type: 'prefab.ingested.v1' as const,
      occurred_at_utc: new Date().toISOString(),
      deterministic_context: {
        engineVersion: 'world-core-v1.0.0',
        toolId: 'prefab.avatar.ingest.v1',
      },
      data: {
        prefab_kind: 'avatar',
        prefab_id: prefabId,
        prefab_hash: prefabHash,
        asset_refs_hash: assetRefsHash,
      },
      input_hashes: {
        prefab_spec: prefabHash,
      },
      output_hashes: {
        prefab_id: prefabHash,
      },
    });

    return res.status(200).json({
      ok: true,
      prefab_id: prefabId,
      prefab_hash: prefabHash,
      kind: 'avatar',
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
 * Tool: prefab.building.ingest.v1
 * Ingest a building prefab spec
 */
router.post('/prefab.building.ingest.v1', async (req: Request, res: Response) => {
  try {
    const input = BuildingPrefabSchema.parse(req.body);

    const prefabHash = hashPayload(input);
    const prefabId = `prefab:${prefabHash}`;

    const existing = prefabRegistry.get(prefabId);
    if (existing && existing.hash !== prefabHash) {
      return res.status(409).json({
        ok: false,
        error: 'Prefab already exists with different spec',
      });
    }

    prefabRegistry.set(prefabId, {
      spec: input,
      hash: prefabHash,
      kind: 'building',
    });

    const assetRefsHash = hashPayload(input.assetRefs);
    const ledgerEvent = PrefabIngestedEventSchema.parse({
      event_type: 'prefab.ingested.v1' as const,
      occurred_at_utc: new Date().toISOString(),
      deterministic_context: {
        engineVersion: 'world-core-v1.0.0',
        toolId: 'prefab.building.ingest.v1',
      },
      data: {
        prefab_kind: 'building',
        prefab_id: prefabId,
        prefab_hash: prefabHash,
        asset_refs_hash: assetRefsHash,
      },
      input_hashes: {
        prefab_spec: prefabHash,
      },
      output_hashes: {
        prefab_id: prefabHash,
      },
    });

    return res.status(200).json({
      ok: true,
      prefab_id: prefabId,
      prefab_hash: prefabHash,
      kind: 'building',
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
 * Tool: prefab.bake.v1
 * Bake a prefab spec into a deterministic manifest
 */
router.post('/prefab.bake.v1', async (req: Request, res: Response) => {
  try {
    const input = z.object({
      prefab_id: z.string(),
      style_id: z.string().optional(),
    }).parse(req.body);

    // Get prefab from registry
    const entry = prefabRegistry.get(input.prefab_id);
    if (!entry) {
      return res.status(404).json({
        ok: false,
        error: `Prefab not found: ${input.prefab_id}`,
      });
    }

    // Bake prefab
    const manifest = bakePrefabSpec(entry.spec, {
      // style spec would be loaded from style registry if needed
    });

    // Verify manifest
    const verified = PrefabBakeManifestSchema.safeParse(manifest);
    if (!verified.success) {
      return res.status(500).json({
        ok: false,
        error: 'Baked manifest does not match contract',
      });
    }

    // Store manifest in registry
    prefabRegistry.set(input.prefab_id, {
      ...entry,
      manifest: verified.data,
    });

    // Create ledger event
    const ledgerEvent = PrefabBakedEventSchema.parse({
      event_type: 'prefab.baked.v1' as const,
      occurred_at_utc: new Date().toISOString(),
      deterministic_context: {
        engineVersion: 'world-core-v1.0.0',
        toolId: 'prefab.bake.v1',
      },
      data: {
        prefab_id: manifest.prefab_id,
        bake_manifest_hash: hashPayload(manifest),
        style_hash: manifest.style_hash,
      },
      input_hashes: {
        prefab: entry.hash,
      },
      output_hashes: {
        manifest: hashPayload(manifest),
      },
    });

    return res.status(200).json({
      ok: true,
      manifest: verified.data,
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
 * Tool: prefab.get.v1
 * Retrieve a prefab spec or manifest
 */
router.post('/prefab.get.v1', async (req: Request, res: Response) => {
  try {
    const input = z.object({
      prefab_id: z.string(),
      includeManifest: z.boolean().optional().default(false),
    }).parse(req.body);

    const entry = prefabRegistry.get(input.prefab_id);
    if (!entry) {
      return res.status(404).json({
        ok: false,
        error: `Prefab not found: ${input.prefab_id}`,
      });
    }

    return res.status(200).json({
      ok: true,
      prefab: entry.spec,
      kind: entry.kind,
      prefab_hash: entry.hash,
      manifest: input.includeManifest ? entry.manifest : undefined,
    });
  } catch (err: any) {
    return res.status(400).json({
      ok: false,
      error: err.message || 'Invalid input',
    });
  }
});

export default router;
