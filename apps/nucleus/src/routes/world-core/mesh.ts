/**
 * Nucleus Routes: Mesh Style + Validation (World Core)
 *
 * Tool IDs:
 * - mesh.style.ingest.v1
 * - mesh.style.get.v1
 * - mesh.validate_asset.v1
 */

import {
  MeshAssetValidatedEventSchema,
  MeshStyleIngestedEventSchema,
} from "@world-engine/engine/contracts/ledger";
import {
  MeshAssetRefSchema,
  MeshStyleSpecSchema,
  MeshValidationReportSchema,
} from "@world-engine/engine/contracts/mesh";
import { hashPayload } from "@world-engine/engine/determinism";
import { validateMeshAsset } from "@world-engine/engine/mesh";
import { Request, Response, Router } from 'express';
import { z } from 'zod';

const router = Router();

/**
 * In-memory style registry (would be persistent DB in production)
 */
const styleRegistry = new Map<string, { spec: any; hash: string; sealed: boolean }>();

/**
 * Tool: mesh.style.ingest.v1
 * Ingest and register a mesh style spec
 */
router.post('/mesh.style.ingest.v1', async (req: Request, res: Response) => {
  try {
    const input = MeshStyleSpecSchema.parse(req.body);

    // Compute canonical hash
    const styleHash = hashPayload(input);
    const styleId = input.style_id;

    // Check for duplicate (same style_id, same hash = OK; different hash = error)
    const existing = styleRegistry.get(styleId);
    if (existing && existing.hash !== styleHash) {
      return res.status(409).json({
        ok: false,
        error: 'Style already exists with different spec',
      });
    }

    // Register (or re-register with same spec)
    styleRegistry.set(styleId, {
      spec: input,
      hash: styleHash,
      sealed: input.sealed || false,
    });

    // Create ledger event
    const ledgerEvent = MeshStyleIngestedEventSchema.parse({
      event_type: 'mesh.style.ingested.v1' as const,
      occurred_at_utc: new Date().toISOString(),
      deterministic_context: {
        engineVersion: 'world-core-v1.0.0',
        toolId: 'mesh.style.ingest.v1',
      },
      data: {
        style_id: styleId,
        style_version: input.version,
        style_hash: styleHash,
        sealed: input.sealed || false,
      },
      input_hashes: {
        style_spec: styleHash,
      },
      output_hashes: {
        style_hash: styleHash,
      },
    });

    return res.status(200).json({
      ok: true,
      style_id: styleId,
      style_hash: styleHash,
      sealed: input.sealed || false,
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
 * Tool: mesh.style.get.v1
 * Retrieve a registered style spec
 */
router.post('/mesh.style.get.v1', async (req: Request, res: Response) => {
  try {
    const input = z.object({ style_id: z.string() }).parse(req.body);

    const entry = styleRegistry.get(input.style_id);
    if (!entry) {
      return res.status(404).json({
        ok: false,
        error: 'Style not found',
      });
    }

    return res.status(200).json({
      ok: true,
      style: entry.spec,
      style_hash: entry.hash,
      sealed: entry.sealed,
    });
  } catch (err: any) {
    return res.status(400).json({
      ok: false,
      error: err.message || 'Invalid input',
    });
  }
});

/**
 * Tool: mesh.validate_asset.v1
 * Validate a mesh asset against a style spec
 */
router.post('/mesh.validate_asset.v1', async (req: Request, res: Response) => {
  try {
    const input = z.object({
      asset: MeshAssetRefSchema,
      style_id: z.string(),
    }).parse(req.body);

    // Get style spec
    const styleEntry = styleRegistry.get(input.style_id);
    if (!styleEntry) {
      return res.status(404).json({
        ok: false,
        error: `Style not found: ${input.style_id}`,
      });
    }

    // Run validation
    const report = validateMeshAsset(input.asset, styleEntry.spec);

    // Verify report matches contract
    const verified = MeshValidationReportSchema.safeParse(report);
    if (!verified.success) {
      return res.status(500).json({
        ok: false,
        error: 'Validation report does not match contract',
      });
    }

    // Create ledger event
    const ledgerEvent = MeshAssetValidatedEventSchema.parse({
      event_type: 'mesh.asset.validated.v1' as const,
      occurred_at_utc: new Date().toISOString(),
      deterministic_context: {
        engineVersion: 'world-core-v1.0.0',
        toolId: 'mesh.validate_asset.v1',
      },
      data: {
        asset_ref: input.asset.asset_id,
        style_hash: styleEntry.hash,
        report_hash: report.report_hash!,
        ok: report.ok,
        violation_count: report.violations.length,
      },
      input_hashes: {
        asset: input.asset.assetHash,
        style: styleEntry.hash,
      },
      output_hashes: {
        report: report.report_hash!,
      },
    });

    return res.status(200).json({
      ok: true,
      report: verified.data,
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
