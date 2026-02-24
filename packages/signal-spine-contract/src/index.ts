export type Domain = "text" | "intervals" | "hz" | "shape" | "music" | "number";

export type Vector3 = Readonly<{ x: number; y: number; z: number }>;
export type ShapeSample = Vector3;
export type Rational = Readonly<{ p: number; q: number }>;
export type MusicEvent = Readonly<{ freq_hz: number; amp: number; dur: number }>;

export type SamplingRate = Readonly<{ kind: "hz"; value: number }> | Readonly<{ kind: "events"; value: null }>;
export type TimeAxis = Readonly<{ kind: "samples"; t0: number; dt: number }>;

export type TraceEntry = Readonly<{
  kind: string;
  name: string;
  at_utc: string;
  details?: unknown;
}>;

export type SignalMetadata = Readonly<{
  id: string;
  schema_version: string;
  created_at_utc: string;
  source: string;
  notes?: string[];
  tags?: string[];
  trace?: TraceEntry[];
}>;

export type Signal<D extends Domain, U extends string, S> = Readonly<{
  domain: D;
  units: U;
  time: TimeAxis;
  sampling_rate: SamplingRate;
  sequence: S;
  metadata: SignalMetadata;
}>;

export type TextSignal = Signal<"text", "z26", number[]>;
export type IntervalSignal = Signal<"intervals", "ratio", Rational[]>;
export type HzSignal = Signal<"hz", "hz", number[]>;
export type ShapeSignal = Signal<"shape", "xyz", ShapeSample[]>;
export type MusicSignal = Signal<"music", "unitless", MusicEvent[]>;
export type NumberSignal = Signal<"number", "unitless", number[]>;

export class SignalError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "SignalError";
    this.code = code;
  }
}

export function nowUtcIso(): string {
  return new Date().toISOString();
}

export function stableStringify(value: unknown): string {
  const stack = new WeakSet<object>();

  const normalize = (input: unknown): unknown => {
    if (input === null || typeof input !== "object") return input;
    if (Array.isArray(input)) return input.map(normalize);
    if (stack.has(input as object)) throw new SignalError("E_INVALID", "Cannot stableStringify circular structure");

    stack.add(input as object);
    const obj = input as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const out: Record<string, unknown> = {};
    for (const key of keys) {
      out[key] = normalize(obj[key]);
    }
    stack.delete(input as object);
    return out;
  };

  return JSON.stringify(normalize(value));
}

export function fnv1a64Hex(input: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;

  for (let i = 0; i < input.length; i++) {
    hash ^= BigInt(input.charCodeAt(i));
    hash = (hash * prime) & mask;
  }
  return hash.toString(16).padStart(16, "0");
}

function normalizeMetadata(base: Partial<SignalMetadata> & { source?: string }, seed: unknown): SignalMetadata {
  const created = base.created_at_utc ?? nowUtcIso();
  const source = base.source ?? "unknown";
  const schema_version = base.schema_version ?? "1.0.0";
  const trace = [...(base.trace ?? [])];
  const tags = base.tags ? [...base.tags] : [];
  const notes = base.notes ? [...base.notes] : [];

  const idSeed = {
    schema_version,
    created,
    source,
    tags,
    notes,
    trace,
    seed,
  };

  return {
    id: base.id ?? `sig_${fnv1a64Hex(stableStringify(idSeed))}`,
    schema_version,
    created_at_utc: created,
    source,
    tags,
    notes,
    trace,
  };
}

export function sealSignal<D extends Domain, U extends string, S>(signal: {
  domain: D;
  units: U;
  time: TimeAxis;
  sampling_rate: SamplingRate;
  sequence: S;
  metadata: Partial<SignalMetadata> & { source?: string };
}): Signal<D, U, S> {
  const metadata = normalizeMetadata(signal.metadata, {
    domain: signal.domain,
    units: signal.units,
    sequence: signal.sequence,
  });

  return {
    domain: signal.domain,
    units: signal.units,
    time: signal.time,
    sampling_rate: signal.sampling_rate,
    sequence: signal.sequence,
    metadata,
  };
}

export function pushTrace<T extends Signal<Domain, string, unknown>>(signal: T, entry: TraceEntry): T {
  const trace = [...(signal.metadata.trace ?? []), entry];
  return {
    ...signal,
    metadata: {
      ...signal.metadata,
      trace,
    },
  };
}

export function assertSignalBase(signal: unknown): asserts signal is Signal<Domain, string, unknown> {
  const s = signal as Partial<Signal<Domain, string, unknown>>;
  if (!s || typeof s !== "object") throw new SignalError("E_INVALID", "Signal must be object");
  if (typeof s.domain !== "string") throw new SignalError("E_INVALID", "Signal.domain missing");
  if (!("sequence" in s)) throw new SignalError("E_INVALID", "Signal.sequence missing");
  if (!s.metadata || typeof s.metadata !== "object") throw new SignalError("E_INVALID", "Signal.metadata missing");
  if (typeof (s.metadata as SignalMetadata).id !== "string") throw new SignalError("E_INVALID", "Signal.metadata.id missing");
}

export function assertTextSignal(signal: unknown): asserts signal is TextSignal {
  assertSignalBase(signal);
  if ((signal as Signal<Domain, string, unknown>).domain !== "text") throw new SignalError("E_DOMAIN", "Expected text domain");

  const seq = (signal as TextSignal).sequence;
  if (!Array.isArray(seq)) throw new SignalError("E_INVALID", "Text sequence must be array");
  for (let i = 0; i < seq.length; i++) {
    const v = seq[i];
    if (!Number.isInteger(v) || v < 0 || v > 25) throw new SignalError("E_RANGE", `Text index out of range at ${i}`);
  }
}

export function assertHzSignal(signal: unknown): asserts signal is HzSignal {
  assertSignalBase(signal);
  if ((signal as Signal<Domain, string, unknown>).domain !== "hz") throw new SignalError("E_DOMAIN", "Expected hz domain");

  const seq = (signal as HzSignal).sequence;
  if (!Array.isArray(seq)) throw new SignalError("E_INVALID", "Hz sequence must be array");
  for (let i = 0; i < seq.length; i++) {
    const v = seq[i];
    if (!Number.isFinite(v) || v <= 0) throw new SignalError("E_RANGE", `Hz value must be > 0 at ${i}`);
  }
}

export function shannonEntropyZ26(text: TextSignal): number {
  assertTextSignal(text);
  const n = text.sequence.length;
  if (n === 0) return 0;

  const counts = new Array<number>(26).fill(0);
  for (const idx of text.sequence) counts[idx] += 1;

  let h = 0;
  for (const c of counts) {
    if (c === 0) continue;
    const p = c / n;
    h -= p * Math.log2(p);
  }
  return h;
}

export function palindromicity(text: TextSignal): number {
  assertTextSignal(text);
  const seq = text.sequence;
  const n = seq.length;
  if (n <= 1) return 1;

  const half = Math.floor(n / 2);
  let matches = 0;
  for (let i = 0; i < half; i++) {
    if (seq[i] === seq[n - 1 - i]) matches++;
  }
  return half === 0 ? 1 : matches / half;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.trunc(a));
  let y = Math.abs(Math.trunc(b));
  while (y !== 0) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x || 1;
}

export function reduceRational(r: Rational): Rational {
  if (!Number.isInteger(r.p) || !Number.isInteger(r.q) || r.q === 0) {
    throw new SignalError("E_RANGE", "Rational must be integer p and non-zero integer q");
  }

  const sign = r.q < 0 ? -1 : 1;
  const p = r.p * sign;
  const q = r.q * sign;
  const g = gcd(p, q);
  return { p: p / g, q: q / g };
}

export type RhoTable = ReadonlyArray<Rational>;

export function makeDefaultRhoTable(): RhoTable {
  const base12: Rational[] = [
    { p: 1, q: 1 },
    { p: 16, q: 15 },
    { p: 9, q: 8 },
    { p: 6, q: 5 },
    { p: 5, q: 4 },
    { p: 4, q: 3 },
    { p: 45, q: 32 },
    { p: 3, q: 2 },
    { p: 8, q: 5 },
    { p: 5, q: 3 },
    { p: 9, q: 5 },
    { p: 15, q: 8 },
  ];

  const out: Rational[] = [];
  for (let i = 0; i < 26; i++) {
    const step = base12[i % base12.length] ?? { p: 1, q: 1 };
    const octaves = Math.floor(i / base12.length);
    out.push(reduceRational({ p: step.p * Math.pow(2, octaves), q: step.q }));
  }
  return out;
}

export function makeTextSignalFromAsciiLetters(
  input: string,
  opts?: { source?: string; tags?: string[]; notes?: string[] }
): TextSignal {
  const seq: number[] = [];
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    let idx = -1;
    if (c >= 65 && c <= 90) idx = c - 65;
    if (c >= 97 && c <= 122) idx = c - 97;
    if (idx >= 0) seq.push(idx);
  }

  if (seq.length === 0) throw new SignalError("E_RANGE", "Text signal requires at least one ASCII letter");

  return sealSignal({
    domain: "text",
    units: "z26",
    time: { kind: "samples", t0: 0, dt: 1 },
    sampling_rate: { kind: "hz", value: 1 },
    sequence: seq,
    metadata: {
      source: opts?.source ?? "text-input",
      tags: opts?.tags,
      notes: opts?.notes,
      schema_version: "1.0.0",
      created_at_utc: nowUtcIso(),
    },
  });
}

export type Converter<I, O> = (input: I) => O;

export type PipelineStep = Readonly<{
  kind: "convert" | "transform";
  converter: Converter<any, any>;
}>;

export function runPipeline<TInput, TOutput = unknown>(input: TInput, steps: ReadonlyArray<PipelineStep>): TOutput {
  let current: unknown = input;
  for (const step of steps) {
    current = step.converter(current);
  }
  return current as TOutput;
}

export function textToIntervalsConverter(rho: RhoTable): Converter<TextSignal, IntervalSignal> {
  const table = rho.map(reduceRational);
  if (table.length === 0) throw new SignalError("E_RANGE", "rho table cannot be empty");

  return (text: TextSignal): IntervalSignal => {
    assertTextSignal(text);
    const seq = text.sequence.map((idx) => table[idx % table.length] ?? { p: 1, q: 1 });

    return pushTrace(
      sealSignal({
        domain: "intervals",
        units: "ratio",
        time: text.time,
        sampling_rate: text.sampling_rate,
        sequence: seq,
        metadata: {
          source: text.metadata.source,
          schema_version: text.metadata.schema_version,
          created_at_utc: nowUtcIso(),
          tags: [...(text.metadata.tags ?? []), "converted"],
          notes: [...(text.metadata.notes ?? []), "text->intervals"],
          trace: [...(text.metadata.trace ?? [])],
        },
      }),
      { kind: "convert", name: "text_to_intervals", at_utc: nowUtcIso(), details: { table_size: table.length } }
    );
  };
}

export function intervalsToHzConverter(rootHz: number): Converter<IntervalSignal, HzSignal> {
  if (!Number.isFinite(rootHz) || rootHz <= 0) throw new SignalError("E_RANGE", "rootHz must be > 0");

  return (intervals: IntervalSignal): HzSignal => {
    if (intervals.domain !== "intervals") throw new SignalError("E_DOMAIN", "Expected intervals domain");

    const seq = intervals.sequence.map((ratio, i) => {
      const rr = reduceRational(ratio);
      const v = rootHz * (rr.p / rr.q);
      if (!Number.isFinite(v) || v <= 0) throw new SignalError("E_RANGE", `Invalid hz at index ${i}`);
      return v;
    });

    return pushTrace(
      sealSignal({
        domain: "hz",
        units: "hz",
        time: intervals.time,
        sampling_rate: intervals.sampling_rate,
        sequence: seq,
        metadata: {
          source: intervals.metadata.source,
          schema_version: intervals.metadata.schema_version,
          created_at_utc: nowUtcIso(),
          tags: [...(intervals.metadata.tags ?? []), "converted"],
          notes: [...(intervals.metadata.notes ?? []), "intervals->hz"],
          trace: [...(intervals.metadata.trace ?? [])],
        },
      }),
      { kind: "convert", name: "intervals_to_hz", at_utc: nowUtcIso(), details: { rootHz } }
    );
  };
}

export function generateStereoLissajousFromHz(
  hz: HzSignal,
  opts: {
    duration_seconds: number;
    sample_rate_hz: number;
    R_L: number[];
    R_R: number[];
    a: number[];
    b: number[];
    envelope?: (t: number) => number;
  }
): ShapeSignal {
  assertHzSignal(hz);
  if (!Number.isFinite(opts.duration_seconds) || opts.duration_seconds <= 0) {
    throw new SignalError("E_RANGE", "duration_seconds must be > 0");
  }
  if (!Number.isFinite(opts.sample_rate_hz) || opts.sample_rate_hz <= 0) {
    throw new SignalError("E_RANGE", "sample_rate_hz must be > 0");
  }

  const n = Math.max(2, Math.floor(opts.duration_seconds * opts.sample_rate_hz));
  const envelope = opts.envelope ?? (() => 1);

  const seq: ShapeSample[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / opts.sample_rate_hz;
    const baseFreq = hz.sequence[i % hz.sequence.length] ?? hz.sequence[0] ?? 1;

    let left = 0;
    let right = 0;

    const harmonics = Math.max(opts.R_L.length, opts.R_R.length, opts.a.length, opts.b.length, 1);
    for (let h = 0; h < harmonics; h++) {
      const rl = opts.R_L[h] ?? 1;
      const rr = opts.R_R[h] ?? 1;
      const al = opts.a[h] ?? 0;
      const br = opts.b[h] ?? 0;

      left += al * Math.sin(2 * Math.PI * baseFreq * rl * t);
      right += br * Math.sin(2 * Math.PI * baseFreq * rr * t);
    }

    const env = envelope(t);
    const gain = Number.isFinite(env) ? env : 1;
    seq[i] = { x: left * gain, y: right * gain, z: 0 };
  }

  return pushTrace(
    sealSignal({
      domain: "shape",
      units: "xyz",
      time: { kind: "samples", t0: 0, dt: 1 / opts.sample_rate_hz },
      sampling_rate: { kind: "hz", value: opts.sample_rate_hz },
      sequence: seq,
      metadata: {
        source: hz.metadata.source,
        schema_version: hz.metadata.schema_version,
        created_at_utc: nowUtcIso(),
        tags: [...(hz.metadata.tags ?? []), "generated", "lissajous"],
        notes: [...(hz.metadata.notes ?? []), "hz->shape(lissajous)"],
        trace: [...(hz.metadata.trace ?? [])],
      },
    }),
    {
      kind: "transform",
      name: "generate_stereo_lissajous_from_hz",
      at_utc: nowUtcIso(),
      details: {
        duration_seconds: opts.duration_seconds,
        sample_rate_hz: opts.sample_rate_hz,
      },
    }
  );
}
