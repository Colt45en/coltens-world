import {
  type ShapeSignal,
  type ShapeSample,
  type Vector3,
  type NumberSignal,
  type MusicSignal,
  type MusicEvent,
  type Rational,
  type IntervalSignal,
  sealSignal,
  pushTrace,
  nowUtcIso,
  SignalError,
  reduceRational,
} from "@world-engine/signal-spine-contract";

/* ------------------------------- Helpers ------------------------------ */

function dist(a: Vector3, b: Vector3): number {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerp3(a: Vector3, b: Vector3, t: number): Vector3 {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) };
}

/* ---------------------- 1) Shape -> Arc-length Resample ---------------------- */

export function shapeResampleArcLength(
  shape: ShapeSignal,
  opts: { count: number; closed?: boolean }
): ShapeSignal {
  if (shape.domain !== "shape") throw new SignalError("E_DOMAIN", "Expected domain 'shape'");
  const pts = shape.sequence;
  const n = pts.length;
  if (n < 2) throw new SignalError("E_RANGE", "shape must have >= 2 points");
  if (!Number.isInteger(opts.count) || opts.count < 2) throw new SignalError("E_RANGE", "count must be integer >= 2");

  // cumulative arc-length
  const cum: number[] = new Array(n).fill(0);
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + dist(pts[i - 1], pts[i]);
  let total = cum[n - 1];

  if (opts.closed) {
    total += dist(pts[n - 1], pts[0]);
  }
  if (total <= 0) throw new SignalError("E_RANGE", "total arc-length must be > 0");

  const target: ShapeSample[] = new Array(opts.count);
  for (let k = 0; k < opts.count; k++) {
    const s = (k / (opts.count - 1)) * total;

    // find segment
    if (!opts.closed) {
      // linear scan (deterministic, small n)
      let i = 1;
      while (i < n && cum[i] < s) i++;
      if (i >= n) {
        target[k] = pts[n - 1];
        continue;
      }
      const s0 = cum[i - 1];
      const s1 = cum[i];
      const t = s1 === s0 ? 0 : (s - s0) / (s1 - s0);
      target[k] = lerp3(pts[i - 1], pts[i], t);
    } else {
      // closed: treat last segment to first
      let i = 1;
      while (i < n && cum[i] < s) i++;
      if (i < n) {
        const s0 = cum[i - 1];
        const s1 = cum[i];
        const t = s1 === s0 ? 0 : (s - s0) / (s1 - s0);
        target[k] = lerp3(pts[i - 1], pts[i], t);
      } else {
        // last-to-first segment
        const s0 = cum[n - 1];
        const s1 = total;
        const t = s1 === s0 ? 0 : (s - s0) / (s1 - s0);
        target[k] = lerp3(pts[n - 1], pts[0], t);
      }
    }
  }

  return pushTrace(
    sealSignal({
      ...shape,
      sequence: target,
      metadata: { ...shape.metadata, created_at_utc: nowUtcIso() },
    }),
    { kind: "transform", name: "shape_resample_arc_length", at_utc: nowUtcIso(), details: opts }
  );
}

/* ---------------------- 2) Shape -> Curvature κ(s) ---------------------- */
/**
 * Discrete curvature magnitude using 2D (x,y):
 * κ_i ≈ |(p_{i+1}-p_i) x (p_i - p_{i-1})| / (|p_{i+1}-p_i|^3)
 * We compute stable, bounded estimates.
 */
export function shapeToCurvatureSignal(shape: ShapeSignal, opts?: { closed?: boolean }): NumberSignal {
  if (shape.domain !== "shape") throw new SignalError("E_DOMAIN", "Expected domain 'shape'");
  const pts = shape.sequence;
  const n = pts.length;
  if (n < 3) throw new SignalError("E_RANGE", "shape must have >= 3 points for curvature");

  const closed = !!opts?.closed;
  const get = (i: number) => {
    const idx = ((i % n) + n) % n;
    return pts[idx];
  };

  const curv: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const p0 = closed ? get(i - 1) : pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = closed ? get(i + 1) : pts[Math.min(n - 1, i + 1)];

    const ax = p1.x - p0.x;
    const ay = p1.y - p0.y;
    const bx = p2.x - p1.x;
    const by = p2.y - p1.y;

    const cross = Math.abs(ax * by - ay * bx);
    const denom = Math.pow(Math.max(1e-12, Math.sqrt(bx * bx + by * by)), 3);
    curv[i] = cross / denom;
  }

  return pushTrace(
    sealSignal({
      domain: "number",
      units: "unitless",
      time: shape.time,
      sampling_rate: shape.sampling_rate,
      sequence: curv,
      metadata: {
        schema_version: "1.0.0",
        created_at_utc: nowUtcIso(),
        source: shape.metadata.source,
        notes: ["Discrete curvature estimate from shape (x,y)"],
        tags: ["signal-spine", "convert", "shape->curvature"],
        trace: [...(shape.metadata.trace ?? [])],
      },
    }),
    { kind: "convert", name: "shape_to_curvature", at_utc: nowUtcIso(), details: { closed } }
  );
}

/* ---------------------- 3) Shape -> Arc-speed Rhythm (Music) ---------------------- */
/**
 * Convert arc-speed to rhythm:
 * - compute segment lengths d_i
 * - map d_i to dur via normalization + scale
 * - choose freq from a root + optional mapping
 */
export function shapeToArcSpeedRhythm(
  shape: ShapeSignal,
  opts: {
    root_hz: number;
    amp?: number;
    dur_scale?: number; // multiplies normalized dur
    dur_min?: number;
    dur_max?: number;
    closed?: boolean;
  }
): MusicSignal {
  if (shape.domain !== "shape") throw new SignalError("E_DOMAIN", "Expected domain 'shape'");
  const pts = shape.sequence;
  if (pts.length < 2) throw new SignalError("E_RANGE", "shape must have >= 2 points");
  if (!Number.isFinite(opts.root_hz) || opts.root_hz <= 0) throw new SignalError("E_RANGE", "root_hz must be > 0");

  const amp = opts.amp ?? 1;
  const durScale = opts.dur_scale ?? 1;
  const durMin = opts.dur_min ?? 0.02;
  const durMax = opts.dur_max ?? 1.0;
  if (durMin <= 0 || durMax <= 0 || durMin > durMax) throw new SignalError("E_RANGE", "bad dur bounds");

  const closed = !!opts.closed;
  const segCount = closed ? pts.length : pts.length - 1;

  const d: number[] = new Array(segCount);
  let sum = 0;
  for (let i = 0; i < segCount; i++) {
    const a = pts[i];
    const b = (i === pts.length - 1) ? pts[0] : pts[i + 1];
    const di = dist(a, b);
    d[i] = di;
    sum += di;
  }
  if (sum <= 0) throw new SignalError("E_RANGE", "shape total length must be > 0");

  // normalize to probabilities then map to durations
  const events: MusicEvent[] = new Array(segCount);
  for (let i = 0; i < segCount; i++) {
    const p = d[i] / sum;
    // invert speed->dur intuition: bigger segment => longer duration
    const dur = Math.max(durMin, Math.min(durMax, p * durScale));
    events[i] = { freq_hz: opts.root_hz, amp, dur };
  }

  return pushTrace(
    sealSignal({
      domain: "music",
      units: "unitless",
      time: shape.time,
      sampling_rate: { kind: "events", value: null },
      sequence: events,
      metadata: {
        schema_version: "1.0.0",
        created_at_utc: nowUtcIso(),
        source: shape.metadata.source,
        notes: ["Arc-speed rhythm from shape segment lengths"],
        tags: ["signal-spine", "convert", "shape->music"],
        trace: [...(shape.metadata.trace ?? [])],
      },
    }),
    { kind: "convert", name: "shape_to_arc_speed_rhythm", at_utc: nowUtcIso(), details: opts }
  );
}

/* ---------------------- 4) Curvature -> Interval Coloring ---------------------- */

export type CurvatureColoringSpec = Readonly<{
  // bins in ascending order (length B), returns index in [0..B]
  bins: number[];
  palette: Rational[]; // length B+1
}>;

function binIndex(x: number, bins: number[]): number {
  let i = 0;
  while (i < bins.length && x > bins[i]) i++;
  return i; // 0..bins.length
}

export function curvatureToIntervals(
  curvature: NumberSignal,
  spec: CurvatureColoringSpec
): IntervalSignal {
  if (curvature.domain !== "number") throw new SignalError("E_DOMAIN", "Expected domain 'number' curvature signal");
  if (spec.palette.length !== spec.bins.length + 1) {
    throw new SignalError("E_INVALID", "palette must be bins.length + 1");
  }

  const palette = spec.palette.map(reduceRational);

  const seq: Rational[] = curvature.sequence.map((k: number, i: number) => {
    if (!Number.isFinite(k) || k < 0) throw new SignalError("E_RANGE", `curvature[${i}] must be finite and >= 0`);
    const idx = binIndex(k, spec.bins);
    return palette[idx];
  });

  return pushTrace(
    sealSignal({
      domain: "intervals",
      units: "ratio",
      time: curvature.time,
      sampling_rate: curvature.sampling_rate,
      sequence: seq,
      metadata: {
        schema_version: "1.0.0",
        created_at_utc: nowUtcIso(),
        source: curvature.metadata.source,
        notes: ["Curvature binned into rational interval palette"],
        tags: ["signal-spine", "convert", "curvature->intervals"],
        trace: [...(curvature.metadata.trace ?? [])],
      },
    }),
    { kind: "convert", name: "curvature_to_intervals", at_utc: nowUtcIso(), details: { bins: spec.bins.length } }
  );
}
