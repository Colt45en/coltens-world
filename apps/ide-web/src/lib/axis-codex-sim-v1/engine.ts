// engine.ts
// Deterministic simulation loop for axis-codex-sim/v1

import { initialHeartState, stepHeart } from "./heart";
import type {
    AxisCodexSimV1Config,
    Frame,
    HeartState,
    StimulusSample,
    TimelineEvent,
} from "./types";

function clamp(x: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, x));
}

function q(x: number, quantum?: number): number {
  if (!quantum || quantum <= 0) return x;
  return Math.round(x / quantum) * quantum;
}

/**
 * Seeded deterministic PRNG (xorshift32)
 */
export class XorShift32 {
  private s: number;
  constructor(seedU32: number) {
    this.s = seedU32 >>> 0;
    if (this.s === 0) this.s = 0x6d2b79f5; // avoid zero lock
  }
  nextU32(): number {
    let x = this.s;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.s = x >>> 0;
    return this.s;
  }
  next01(): number {
    // [0,1)
    return (this.nextU32() >>> 0) / 0x100000000;
  }
}

type PreparedEvent =
  | { kind: "pulse"; t_ms: number; value: number; channel: string }
  | {
      kind: "ramp";
      t0_ms: number;
      t1_ms: number;
      v0: number;
      v1: number;
      channel: string;
    };

function normalizeChannel(ch?: string): string {
  return ch && ch.trim().length > 0 ? ch.trim() : "default";
}

function prepareEvents(events: TimelineEvent[]): PreparedEvent[] {
  const out: PreparedEvent[] = [];
  for (const e of events) {
    if (e.kind === "pulse") {
      out.push({
        kind: "pulse",
        t_ms: e.t_ms,
        value: e.value,
        channel: normalizeChannel(e.channel),
      });
    } else {
      out.push({
        kind: "ramp",
        t0_ms: e.t0_ms,
        t1_ms: e.t1_ms,
        v0: e.v0,
        v1: e.v1,
        channel: normalizeChannel(e.channel),
      });
    }
  }

  // Deterministic sort:
  // pulses by t_ms, ramps by t0_ms; tie-break by channel then kind
  out.sort((a, b) => {
    const ta = a.kind === "pulse" ? a.t_ms : a.t0_ms;
    const tb = b.kind === "pulse" ? b.t_ms : b.t0_ms;
    if (ta !== tb) return ta - tb;
    if (a.channel !== b.channel) return a.channel.localeCompare(b.channel);
    if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
    return 0;
  });

  return out;
}

function evalRampAt(
  t_ms: number,
  e: Extract<PreparedEvent, { kind: "ramp" }>
): number {
  if (t_ms < e.t0_ms) return 0;
  if (t_ms > e.t1_ms) return 0;

  const span = e.t1_ms - e.t0_ms;
  if (span <= 0) return e.v1;

  const u = (t_ms - e.t0_ms) / span;
  return e.v0 + (e.v1 - e.v0) * clamp(u, 0, 1);
}

function stimulusAt(
  t_ms: number,
  evs: PreparedEvent[],
  quantize?: number
): StimulusSample {
  const by: Record<string, number> = Object.create(null);
  let total = 0;

  for (const e of evs) {
    if (e.kind === "pulse") {
      if (e.t_ms === t_ms) {
        const v = q(e.value, quantize);
        by[e.channel] = q((by[e.channel] ?? 0) + v, quantize);
      }
    } else {
      const v = q(evalRampAt(t_ms, e), quantize);
      if (v !== 0) by[e.channel] = q((by[e.channel] ?? 0) + v, quantize);
    }
  }

  for (const k of Object.keys(by).sort()) total = q(total + by[k], quantize);

  return { t_ms, total, by_channel: by };
}

export class AxisCodexSimEngineV1 {
  readonly cfg: AxisCodexSimV1Config;
  readonly prng: XorShift32;

  private events: PreparedEvent[];
  private heart: HeartState;
  private t_ms: number;

  constructor(cfg: AxisCodexSimV1Config) {
    this.cfg = cfg;
    this.prng = new XorShift32(cfg.seed as unknown as number);
    this.events = prepareEvents(cfg.timeline.events);
    this.heart = initialHeartState(cfg.heart);
    this.t_ms = 0;
  }

  get timeMs(): number {
    return this.t_ms;
  }

  get heartState(): HeartState {
    return this.heart;
  }

  /**
   * Single deterministic step. Produces one frame.
   */
  step(): Frame {
    const qn = this.cfg.heart.quantize;

    const stim = stimulusAt(this.t_ms, this.events, qn);

    // Optional: you can add seeded micro-noise deterministically if desired:
    // const noise = (this.prng.next01() - 0.5) * 0.0;
    // const stimTotal = q(stim.total + noise, qn);
    const stimTotal = stim.total;

    const nextHeart = stepHeart(this.heart, this.cfg.heart, stimTotal, this.cfg.dt_ms);
    this.heart = nextHeart;
    this.t_ms = nextHeart.t_ms;

    return {
      t_ms: nextHeart.t_ms,
      stimulus: stim,
      heart: nextHeart,
    };
  }

  /**
   * Run for N steps deterministically.
   */
  runSteps(steps: number): Frame[] {
    if (!Number.isInteger(steps) || steps < 0)
      throw new Error("steps must be integer >= 0");
    const frames: Frame[] = [];
    for (let i = 0; i < steps; i++) frames.push(this.step());
    return frames;
  }

  /**
   * Run until t_max_ms (inclusive-ish) using dt_ms.
   * We emit frames per step; time starts at 0 and first frame is at dt_ms.
   */
  runToEnd(): Frame[] {
    const maxSteps = Math.floor(this.cfg.t_max_ms / this.cfg.dt_ms);
    return this.runSteps(maxSteps);
  }
}
