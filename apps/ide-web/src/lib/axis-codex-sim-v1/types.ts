// types.ts
// Public schema-facing interfaces for axis-codex-sim/v1

export const AXIS_CODEX_SIM_V1 = "axis-codex-sim/v1" as const;
export type AxisCodexSimSchemaId = typeof AXIS_CODEX_SIM_V1;

export type UInt32 = number & { readonly __uint32: unique symbol };

export type TimelineEventKind = "pulse" | "ramp";

export interface TimelineEventPulse {
  kind: "pulse";
  t_ms: number; // integer >= 0
  value: number; // stimulus amount
  channel?: string; // optional routing label
}

export interface TimelineEventRamp {
  kind: "ramp";
  t0_ms: number; // integer >= 0
  t1_ms: number; // integer >= t0_ms
  v0: number;
  v1: number;
  channel?: string;
}

export type TimelineEvent = TimelineEventPulse | TimelineEventRamp;

export interface TimelineSpec {
  events: TimelineEvent[];
}

export interface HeartParams {
  /**
   * Base capacity (units per step input can fill against).
   * Think of this as your "stable throughput".
   */
  base_capacity: number; // > 0
  /**
   * Upper bound for capacity once resonance boosts it.
   */
  capacity_max: number; // >= base_capacity
  /**
   * Resonance decay time constant in milliseconds.
   * Higher = resonance lasts longer.
   */
  resonance_tau_ms: number; // > 0
  /**
   * How strongly incoming stimulus increases resonance.
   */
  resonance_gain: number; // >= 0
  /**
   * Capacity gain factor from resonance.
   * capacity = base_capacity * (1 + capacity_gain * f(resonance)) clamped to capacity_max
   */
  capacity_gain: number; // >= 0
  /**
   * How quickly stored "fill" drains per step (0..1).
   * drain = fill * fill_drain_rate
   */
  fill_drain_rate: number; // 0..1
  /**
   * Optional numeric quantization to improve replay stability.
   * Example: 1e-6 rounds all internal floats to 6 decimals.
   */
  quantize?: number; // > 0
}

export interface AxisCodexSimV1Config {
  schema: AxisCodexSimSchemaId;
  seed: UInt32; // uint32
  dt_ms: number; // integer > 0
  t_max_ms: number; // integer > 0
  heart: HeartParams;
  timeline: TimelineSpec;
}

export interface HeartState {
  t_ms: number; // integer
  resonance: number; // >= 0
  capacity: number; // >= 0
  fill: number; // [0..capacity]
  coherence: number; // [0..1]
}

export interface StimulusSample {
  t_ms: number; // integer
  total: number; // summed input across channels
  by_channel: Record<string, number>;
}

export interface Frame {
  t_ms: number;
  stimulus: StimulusSample;
  heart: HeartState;
}

/**
 * Export format: stable + replayable.
 * All arrays must be deterministic order, no wall clock.
 */
export interface AxisCodexSimV1Export {
  schema: AxisCodexSimSchemaId;
  config_hash_fnv1a32: string; // 8 hex chars
  frames: Frame[];
}

/** Utility: brand a number as UInt32 after validation */
export function asUInt32(n: number): UInt32 {
  return (n >>> 0) as UInt32;
}
