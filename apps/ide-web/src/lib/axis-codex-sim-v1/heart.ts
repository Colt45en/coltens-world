// heart.ts
// Resonance + capacity scaling (deterministic)

import type { HeartParams, HeartState } from "./types";

function clamp(x: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, x));
}

function q(x: number, quantum?: number): number {
  if (!quantum || quantum <= 0) return x;
  return Math.round(x / quantum) * quantum;
}

/**
 * Smooth monotonic mapping from resonance -> [0..1]
 * (prevents explosive growth while still being sensitive)
 */
function squash01(x: number): number {
  // x>=0 expected
  // 1 - exp(-x) is stable and monotone
  return 1 - Math.exp(-Math.max(0, x));
}

/**
 * Deterministic heart update:
 * - resonance decays with tau
 * - stimulus boosts resonance
 * - capacity scales with resonance (clamped)
 * - fill accumulates stimulus and drains each step
 * - coherence is a stable readout [0..1]
 */
export function stepHeart(
  prev: HeartState,
  params: HeartParams,
  stimulus: number,
  dt_ms: number
): HeartState {
  const tq = params.quantize;

  const t_ms = prev.t_ms + dt_ms;

  const tau = params.resonance_tau_ms;
  const decay = Math.exp(-dt_ms / tau);

  const resonance = q(prev.resonance * decay + stimulus * params.resonance_gain, tq);
  const r01 = q(squash01(resonance), tq);

  const rawCap = params.base_capacity * (1 + params.capacity_gain * r01);
  const capacity = q(clamp(rawCap, params.base_capacity, params.capacity_max), tq);

  // Fill increases with stimulus but cannot exceed capacity
  const fillIn = q(prev.fill + stimulus, tq);
  const drained = q(fillIn - fillIn * params.fill_drain_rate, tq);
  const fill = q(clamp(drained, 0, capacity), tq);

  // Coherence: higher when resonance is healthy and fill isn't saturating
  const fillFrac = capacity > 0 ? clamp(fill / capacity, 0, 1) : 0;
  const coherence = q(
    clamp(0.65 * r01 + 0.35 * (1 - fillFrac), 0, 1),
    tq
  );

  return {
    t_ms,
    resonance,
    capacity,
    fill,
    coherence,
  };
}

export function initialHeartState(params: HeartParams): HeartState {
  const tq = params.quantize;
  const capacity = q(params.base_capacity, tq);
  return {
    t_ms: 0,
    resonance: q(0, tq),
    capacity,
    fill: q(0, tq),
    coherence: q(0, tq),
  };
}
