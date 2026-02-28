import {
    MeshAssetRef,
    MeshStyleSpec,
    MeshValidationReport,
    MeshValidationViolation,
} from '../contracts/mesh/schema';
import { hashPayload } from '../determinism';

/**
 * Mesh Validator
 * Validates 3D assets against a mesh style spec
 * Produces deterministic validation reports with stable violation ordering
 */

export interface ValidatorOptions {
  /**
   * Whether to auto-fix minor issues (e.g., normalizing materials)
   */
  autoFix?: boolean;
}

/**
 * Validate a mesh asset against a style spec
 * Always produces the same report hash for the same inputs
 */
export function validateMeshAsset(
  asset: MeshAssetRef,
  style: MeshStyleSpec,
  options?: ValidatorOptions
): MeshValidationReport {
  const violations: MeshValidationViolation[] = [];

  // Check: asset size is reasonable
  if (asset.byteSize < 100) {
    violations.push({
      type: 'asset_size_too_small',
      message: `Asset size ${asset.byteSize} bytes is too small for a valid model`,
      severity: 'error',
    });
  }

  // Check: supported extensions (if style specifies restrictions)
  if (style.allowedExtensions && style.allowedExtensions.length > 0) {
    // In v1, we don't have extension data, so we skip this check
    // In real implementation, parse glTF header or metadata
  }

  // Check: triangle count is within limits
  // In v1 we use asset size as proxy (rough estimate: ~100 bytes per triangle)
  const estimatedTriangles = Math.floor(asset.byteSize / 100);
  if (estimatedTriangles > style.maxTriangleCount) {
    violations.push({
      type: 'triangle_count_exceeded',
      message: `Estimated triangle count ${estimatedTriangles} exceeds limit ${style.maxTriangleCount}`,
      severity: 'error',
    });
  }

  // Check: asset hash format is valid (already validated in schema, but double-check)
  if (!/^[a-f0-9]{64}$/.test(asset.assetHash)) {
    violations.push({
      type: 'invalid_asset_hash',
      message: `Asset hash must be valid SHA-256 hex string`,
      severity: 'error',
    });
  }

  // Stable sort violations by type + message for deterministic output
  violations.sort((a, b) => {
    const aKey = `${a.type}:${a.message}`;
    const bKey = `${b.type}:${b.message}`;
    return aKey.localeCompare(bKey);
  });

  const ok = violations.filter(v => v.severity === 'error').length === 0;

  // Compute style hash
  const styleHash = hashPayload(style);

  // Build report
  const report: MeshValidationReport = {
    asset,
    style_id: style.style_id,
    style_hash: styleHash,
    ok,
    violations,
  };

  // Compute report hash (canonical form of report without the hash itself)
  const reportPayload = {
    asset: report.asset,
    style_id: report.style_id,
    style_hash: report.style_hash,
    ok: report.ok,
    violations: report.violations,
  };
  const reportHash = hashPayload(reportPayload);

  return {
    ...report,
    report_hash: reportHash,
  };
}

/**
 * Batch validate multiple assets against a style spec
 * Returns reports in stable order (sorted by asset_id)
 */
export function validateMeshAssetBatch(
  assets: MeshAssetRef[],
  style: MeshStyleSpec,
  options?: ValidatorOptions
): MeshValidationReport[] {
  // Process all assets
  const reports = assets.map(asset => validateMeshAsset(asset, style, options));

  // Stable sort by asset_id
  reports.sort((a, b) => a.asset.asset_id.localeCompare(b.asset.asset_id));

  return reports;
}
