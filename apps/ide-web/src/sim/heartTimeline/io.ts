import { AXIS_CODEX_V1 } from "./axisCodex";
import { validateSimulationExportV1, validateTimelineConfig } from "./schema";
import type { SimulationExportV1, TimelineConfig } from "./types";

function stableNormalize(value: unknown): unknown {
  if (typeof value === "number") return Number(value.toFixed(6));
  if (Array.isArray(value)) return value.map(stableNormalize);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = stableNormalize((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

export function serializeSimulationExportV1(exported: SimulationExportV1): string {
  return JSON.stringify(stableNormalize(exported), null, 2);
}

export function serializeTimelineConfig(config: TimelineConfig): string {
  return JSON.stringify(stableNormalize({ ...config, axis_codex: AXIS_CODEX_V1 }), null, 2);
}

export function parseTimelineConfig(json: string): TimelineConfig {
  const parsed: unknown = JSON.parse(json);
  const result = validateTimelineConfig(parsed);
  if (!result.ok) {
    throw new Error(result.errors.map((e) => `${e.path}: ${e.message}`).join("\n"));
  }
  return parsed as TimelineConfig;
}

export function loadSimulationExportV1(json: string): SimulationExportV1 {
  const parsed: unknown = JSON.parse(json);
  const result = validateSimulationExportV1(parsed);
  if (!result.ok) {
    throw new Error(result.errors.map((e) => `${e.path}: ${e.message}`).join("\n"));
  }
  return parsed as SimulationExportV1;
}
