import { AXIS_CODEX_V1 } from "./axisCodex";
import type { SimulationExportV1, TimelineConfig, VectorObject } from "./types";

export type ValidationError = { path: string; message: string };

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isVec3(v: unknown): v is [number, number, number] {
  return Array.isArray(v) && v.length === 3 && v.every(isFiniteNumber);
}

function validateVectorObject(v: unknown, path: string, out: ValidationError[]): v is VectorObject {
  if (!isObject(v)) {
    out.push({ path, message: "must be object" });
    return false;
  }
  if (typeof v.id !== "string" || !v.id) out.push({ path: `${path}.id`, message: "must be non-empty string" });
  if (!isVec3(v.position)) out.push({ path: `${path}.position`, message: "must be vec3" });
  if (!isVec3(v.velocity)) out.push({ path: `${path}.velocity`, message: "must be vec3" });
  if (!isVec3(v.axis_bias)) out.push({ path: `${path}.axis_bias`, message: "must be vec3" });
  if (!isFiniteNumber(v.energy)) out.push({ path: `${path}.energy`, message: "must be finite number" });
  if (typeof v.active !== "boolean") out.push({ path: `${path}.active`, message: "must be boolean" });
  if (!Array.isArray(v.tags) || !v.tags.every((t) => typeof t === "string")) out.push({ path: `${path}.tags`, message: "must be string[]" });
  return true;
}

function validateConfig(v: unknown, path: string, out: ValidationError[]): v is TimelineConfig {
  if (!isObject(v)) {
    out.push({ path, message: "must be object" });
    return false;
  }

  if (!Number.isInteger(v.tick_count) || (v.tick_count as number) < 0) out.push({ path: `${path}.tick_count`, message: "must be integer >= 0" });
  if (!isFiniteNumber(v.dt_seconds) || (v.dt_seconds as number) <= 0) out.push({ path: `${path}.dt_seconds`, message: "must be > 0" });
  if (!Number.isInteger(v.snapshot_every_ticks) || (v.snapshot_every_ticks as number) <= 0) out.push({ path: `${path}.snapshot_every_ticks`, message: "must be integer > 0" });
  if (!Number.isInteger(v.base_capacity) || (v.base_capacity as number) < 0) out.push({ path: `${path}.base_capacity`, message: "must be integer >= 0" });
  if (!Number.isInteger(v.seed) || (v.seed as number) < 0) out.push({ path: `${path}.seed`, message: "must be integer >= 0" });

  if (!isObject(v.axis_codex)) {
    out.push({ path: `${path}.axis_codex`, message: "must be object" });
  } else {
    const axisCodex = v.axis_codex as Record<string, unknown>;
    (["x", "y", "z"] as const).forEach((k) => {
      if (axisCodex[k] !== AXIS_CODEX_V1[k]) out.push({ path: `${path}.axis_codex.${k}`, message: `must equal "${AXIS_CODEX_V1[k]}"` });
    });
  }

  if (!isObject(v.heart)) {
    out.push({ path: `${path}.heart`, message: "must be object" });
  } else {
    const heart = v.heart as Record<string, unknown>;
    ([
      "base_resonance",
      "pulse_amplitude",
      "pulse_frequency_hz",
      "damping",
      "min_capacity_scale",
      "max_capacity_scale",
      "resonance_to_capacity_gain",
    ] as const).forEach((k) => {
      if (!isFiniteNumber(heart[k])) out.push({ path: `${path}.heart.${k}`, message: "must be finite number" });
    });
  }

  if (!Array.isArray(v.initial_objects)) out.push({ path: `${path}.initial_objects`, message: "must be array" });
  else v.initial_objects.forEach((obj, i) => validateVectorObject(obj, `${path}.initial_objects[${i}]`, out));

  return true;
}

export function validateTimelineConfig(input: unknown): { ok: boolean; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  validateConfig(input, "$", errors);
  return { ok: errors.length === 0, errors };
}

export function validateSimulationExportV1(input: unknown): { ok: boolean; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  if (!isObject(input)) return { ok: false, errors: [{ path: "$", message: "must be object" }] };
  if (input.schema !== "axis-codex-sim/v1") errors.push({ path: "$.schema", message: 'must equal "axis-codex-sim/v1"' });
  if (!isObject(input.metadata)) errors.push({ path: "$.metadata", message: "must be object" });
  if (input.metadata && isObject(input.metadata)) {
    if (input.metadata.engine_name !== "heart-timeline-engine") errors.push({ path: "$.metadata.engine_name", message: 'must equal "heart-timeline-engine"' });
    if (input.metadata.engine_version !== "0.1.0") errors.push({ path: "$.metadata.engine_version", message: 'must equal "0.1.0"' });
    if (input.metadata.generated_by !== "cpp" && input.metadata.generated_by !== "ts") errors.push({ path: "$.metadata.generated_by", message: 'must be "cpp" or "ts"' });
    if (!Number.isInteger(input.metadata.generated_at_unix_ms)) errors.push({ path: "$.metadata.generated_at_unix_ms", message: "must be integer" });
    if (!Number.isInteger(input.metadata.deterministic_seed)) errors.push({ path: "$.metadata.deterministic_seed", message: "must be integer" });
  }
  validateConfig(input.config, "$.config", errors);
  if (!Array.isArray(input.tick_log)) errors.push({ path: "$.tick_log", message: "must be array" });
  if (!Array.isArray(input.snapshots)) errors.push({ path: "$.snapshots", message: "must be array" });
  return { ok: errors.length === 0, errors };
}

export function isSimulationExportV1(input: unknown): input is SimulationExportV1 {
  return validateSimulationExportV1(input).ok;
}
