import type { HeartConfig, HeartState } from "./types";

function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n));
}

function round6(n: number): number {
  return Number(n.toFixed(6));
}

export function createInitialHeartState(cfg: HeartConfig): HeartState {
  const resonance = cfg.base_resonance;
  const capacity_scale = clamp(
    1 + cfg.resonance_to_capacity_gain * resonance,
    cfg.min_capacity_scale,
    cfg.max_capacity_scale,
  );
  return {
    resonance: round6(resonance),
    capacity_scale: round6(capacity_scale),
    momentum: round6(resonance),
    pulse_count: 0,
  };
}

export function stepHeart(cfg: HeartConfig, prev: HeartState, dt: number, tickIndex: number): HeartState {
  const t = dt * tickIndex;
  const resonanceRaw = cfg.base_resonance + cfg.pulse_amplitude * Math.sin(2 * Math.PI * cfg.pulse_frequency_hz * t);
  const damping = clamp(cfg.damping, 0, 1);
  const momentum = prev.momentum + (resonanceRaw - prev.momentum) * (1 - damping);
  const resonance = resonanceRaw * (1 - damping) + momentum * damping;
  const capacity_scale = clamp(
    1 + cfg.resonance_to_capacity_gain * resonance,
    cfg.min_capacity_scale,
    cfg.max_capacity_scale,
  );
  return {
    resonance: round6(resonance),
    capacity_scale: round6(capacity_scale),
    momentum: round6(momentum),
    pulse_count: prev.pulse_count + 1,
  };
}
