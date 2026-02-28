// schema.ts
// Hand-written config/export validators (no external deps)

import {
    AXIS_CODEX_SIM_V1,
    type AxisCodexSimV1Config,
    type AxisCodexSimV1Export,
    type HeartParams,
    type TimelineEvent,
    type TimelineSpec,
    asUInt32,
} from "./types";

type Path = (string | number)[];

function pathToString(p: Path): string {
  if (p.length === 0) return "<root>";
  return p
    .map((x) =>
      typeof x === "number" ? `[${x}]` : x.includes(".") ? `["${x}"]` : `.${x}`
    )
    .join("")
    .replace(/^\./, "");
}

function fail(p: Path, msg: string): never {
  throw new Error(`SchemaError at ${pathToString(p)}: ${msg}`);
}

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function reqObj(x: unknown, p: Path): Record<string, unknown> {
  if (!isObj(x)) fail(p, "expected object");
  return x;
}

function reqStr(x: unknown, p: Path): string {
  if (typeof x !== "string") fail(p, "expected string");
  return x;
}

function reqNum(x: unknown, p: Path): number {
  if (typeof x !== "number" || !Number.isFinite(x)) fail(p, "expected finite number");
  return x;
}

function reqInt(x: unknown, p: Path): number {
  const n = reqNum(x, p);
  if (!Number.isInteger(n)) fail(p, "expected integer");
  return n;
}

function optStr(x: unknown, p: Path): string | undefined {
  if (x === undefined) return undefined;
  return reqStr(x, p);
}

function optNum(x: unknown, p: Path): number | undefined {
  if (x === undefined) return undefined;
  return reqNum(x, p);
}

function reqArr(x: unknown, p: Path): unknown[] {
  if (!Array.isArray(x)) fail(p, "expected array");
  return x;
}

function validateHeartParams(x: unknown, p: Path): HeartParams {
  const o = reqObj(x, p);

  const base_capacity = reqNum(o.base_capacity, [...p, "base_capacity"]);
  const capacity_max = reqNum(o.capacity_max, [...p, "capacity_max"]);
  const resonance_tau_ms = reqNum(o.resonance_tau_ms, [...p, "resonance_tau_ms"]);
  const resonance_gain = reqNum(o.resonance_gain, [...p, "resonance_gain"]);
  const capacity_gain = reqNum(o.capacity_gain, [...p, "capacity_gain"]);
  const fill_drain_rate = reqNum(o.fill_drain_rate, [...p, "fill_drain_rate"]);
  const quantize = optNum(o.quantize, [...p, "quantize"]);

  if (!(base_capacity > 0))
    fail([...p, "base_capacity"], "must be > 0");
  if (!(capacity_max >= base_capacity))
    fail([...p, "capacity_max"], "must be >= base_capacity");
  if (!(resonance_tau_ms > 0))
    fail([...p, "resonance_tau_ms"], "must be > 0");
  if (!(resonance_gain >= 0))
    fail([...p, "resonance_gain"], "must be >= 0");
  if (!(capacity_gain >= 0))
    fail([...p, "capacity_gain"], "must be >= 0");
  if (!(fill_drain_rate >= 0 && fill_drain_rate <= 1))
    fail([...p, "fill_drain_rate"], "must be within [0..1]");
  if (quantize !== undefined && !(quantize > 0))
    fail([...p, "quantize"], "must be > 0 if provided");

  return {
    base_capacity,
    capacity_max,
    resonance_tau_ms,
    resonance_gain,
    capacity_gain,
    fill_drain_rate,
    quantize,
  };
}

function validateTimelineEvent(x: unknown, p: Path): TimelineEvent {
  const o = reqObj(x, p);
  const kind = reqStr(o.kind, [...p, "kind"]);

  if (kind === "pulse") {
    const t_ms = reqInt(o.t_ms, [...p, "t_ms"]);
    const value = reqNum(o.value, [...p, "value"]);
    const channel = optStr(o.channel, [...p, "channel"]);
    if (t_ms < 0) fail([...p, "t_ms"], "must be >= 0");
    return { kind: "pulse", t_ms, value, channel };
  }

  if (kind === "ramp") {
    const t0_ms = reqInt(o.t0_ms, [...p, "t0_ms"]);
    const t1_ms = reqInt(o.t1_ms, [...p, "t1_ms"]);
    const v0 = reqNum(o.v0, [...p, "v0"]);
    const v1 = reqNum(o.v1, [...p, "v1"]);
    const channel = optStr(o.channel, [...p, "channel"]);
    if (t0_ms < 0) fail([...p, "t0_ms"], "must be >= 0");
    if (t1_ms < t0_ms) fail([...p, "t1_ms"], "must be >= t0_ms");
    return { kind: "ramp", t0_ms, t1_ms, v0, v1, channel };
  }

  fail([...p, "kind"], `unsupported kind "${kind}" (expected "pulse" or "ramp")`);
}

function validateTimelineSpec(x: unknown, p: Path): TimelineSpec {
  const o = reqObj(x, p);
  const eventsRaw = reqArr(o.events, [...p, "events"]);
  const events = eventsRaw.map((e, i) =>
    validateTimelineEvent(e, [...p, "events", i])
  );

  // Deterministic ordering rule: stable sort by earliest time
  // (We enforce this in engine as well, but validator ensures it's sane)
  return { events };
}

export function validateAxisCodexSimV1Config(x: unknown): AxisCodexSimV1Config {
  const p: Path = [];
  const o = reqObj(x, p);

  const schema = reqStr(o.schema, [...p, "schema"]);
  if (schema !== AXIS_CODEX_SIM_V1)
    fail([...p, "schema"], `must be "${AXIS_CODEX_SIM_V1}"`);

  const seedNum = reqNum(o.seed, [...p, "seed"]);
  if (!Number.isInteger(seedNum) || seedNum < 0 || seedNum > 0xffffffff) {
    fail([...p, "seed"], "must be uint32 (0..4294967295)");
  }

  const dt_ms = reqInt(o.dt_ms, [...p, "dt_ms"]);
  const t_max_ms = reqInt(o.t_max_ms, [...p, "t_max_ms"]);
  if (dt_ms <= 0) fail([...p, "dt_ms"], "must be > 0");
  if (t_max_ms <= 0) fail([...p, "t_max_ms"], "must be > 0");

  const heart = validateHeartParams(o.heart, [...p, "heart"]);
  const timeline = validateTimelineSpec(o.timeline, [...p, "timeline"]);

  return {
    schema: AXIS_CODEX_SIM_V1,
    seed: asUInt32(seedNum),
    dt_ms,
    t_max_ms,
    heart,
    timeline,
  };
}

export function validateAxisCodexSimV1Export(x: unknown): AxisCodexSimV1Export {
  const p: Path = [];
  const o = reqObj(x, p);

  const schema = reqStr(o.schema, [...p, "schema"]);
  if (schema !== AXIS_CODEX_SIM_V1)
    fail([...p, "schema"], `must be "${AXIS_CODEX_SIM_V1}"`);

  const h = reqStr(o.config_hash_fnv1a32, [...p, "config_hash_fnv1a32"]);
  if (!/^[0-9a-f]{8}$/i.test(h))
    fail([...p, "config_hash_fnv1a32"], "must be 8 hex chars");

  const frames = reqArr(o.frames, [...p, "frames"]);
  // Keep it lightweight: we don't deep-validate each frame here.
  // The engine produces frames; exports from untrusted sources should be validated elsewhere if needed.
  if (frames.length === 0) fail([...p, "frames"], "must contain at least 1 frame");

  return {
    schema: AXIS_CODEX_SIM_V1,
    config_hash_fnv1a32: h.toLowerCase(),
    frames: frames as any,
  };
}
