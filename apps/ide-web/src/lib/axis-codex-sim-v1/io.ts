// io.ts
// Stable JSON import/export helpers (deterministic)

import {
    validateAxisCodexSimV1Config,
    validateAxisCodexSimV1Export,
} from "./schema";
import type {
    AxisCodexSimV1Config,
    AxisCodexSimV1Export,
    Frame,
} from "./types";
import { AXIS_CODEX_SIM_V1 } from "./types";

/**
 * Stable stringify:
 * - sorts object keys lexicographically
 * - preserves array order
 * - no whitespace
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(x: any): any {
  if (Array.isArray(x)) return x.map(sortKeysDeep);
  if (x && typeof x === "object") {
    const out: any = {};
    for (const k of Object.keys(x).sort()) out[k] = sortKeysDeep(x[k]);
    return out;
  }
  return x;
}

/**
 * FNV-1a 32-bit hash (sync, deterministic in browser).
 * Returns 8 hex chars lower-case.
 */
export function fnv1a32Hex(s: string): string {
  let h = 0x811c9dc5; // offset
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    // h *= 16777619 (with 32-bit overflow)
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export function parseConfigJson(json: string): AxisCodexSimV1Config {
  const raw = JSON.parse(json);
  return validateAxisCodexSimV1Config(raw);
}

export function exportConfigJson(cfg: AxisCodexSimV1Config): string {
  // Always stable order
  return stableStringify(cfg);
}

export function configHashFnv1a32(cfg: AxisCodexSimV1Config): string {
  return fnv1a32Hex(exportConfigJson(cfg));
}

export function makeExport(
  cfg: AxisCodexSimV1Config,
  frames: Frame[]
): AxisCodexSimV1Export {
  return {
    schema: AXIS_CODEX_SIM_V1,
    config_hash_fnv1a32: configHashFnv1a32(cfg),
    frames,
  };
}

export function exportRunJson(cfg: AxisCodexSimV1Config, frames: Frame[]): string {
  return stableStringify(makeExport(cfg, frames));
}

export function parseExportJson(json: string): AxisCodexSimV1Export {
  const raw = JSON.parse(json);
  return validateAxisCodexSimV1Export(raw);
}
