import {
  type TextSignal,
  type HzSignal,
  type ShapeSignal,
  type MusicSignal,
  type Vector3,
  assertTextSignal,
  assertHzSignal,
  assertSignalBase,
  shannonEntropyZ26,
  palindromicity,
  SignalError,
} from "@world-engine/signal-spine-contract";

/* -------------------------- Hz/Music Spectral -------------------------- */
/**
 * These metrics treat the signal sequence as a "distribution" over frequency.
 * - HzSignal: sequence are freqs
 * - MusicSignal: we use freq_hz weighted by amp*dur
 */
export type SpectralMetrics = Readonly<{
  centroid_hz: number;
  spread_hz: number;
  min_hz: number;
  max_hz: number;
  energy: number;
}>;

export function spectralFromHz(hz: HzSignal, opts?: { weight?: (f: number, i: number) => number }): SpectralMetrics {
  assertHzSignal(hz);
  const wFn = opts?.weight ?? ((_: number) => 1);

  let W = 0;
  let sum = 0;
  let sum2 = 0;
  let min = Infinity;
  let max = -Infinity;

  for (let i = 0; i < hz.sequence.length; i++) {
    const f = hz.sequence[i];
    const w = wFn(f, i);
    if (!Number.isFinite(w) || w < 0) throw new SignalError("E_RANGE", "weight must be finite and >= 0");
    W += w;
    sum += w * f;
    sum2 += w * f * f;
    if (f < min) min = f;
    if (f > max) max = f;
  }

  if (W <= 0) throw new SignalError("E_RANGE", "Total weight must be > 0");
  const centroid = sum / W;
  const mean2 = sum2 / W;
  const variance = Math.max(0, mean2 - centroid * centroid);
  return {
    centroid_hz: centroid,
    spread_hz: Math.sqrt(variance),
    min_hz: min,
    max_hz: max,
    energy: W,
  };
}

export function spectralFromMusic(m: MusicSignal): SpectralMetrics {
  assertSignalBase(m);
  if (m.domain !== "music") throw new SignalError("E_DOMAIN", "Expected domain 'music'");
  let W = 0;
  let sum = 0;
  let sum2 = 0;
  let min = Infinity;
  let max = -Infinity;

  for (let i = 0; i < m.sequence.length; i++) {
    const ev = m.sequence[i];
    const w = ev.amp * Math.max(0, ev.dur);
    if (!Number.isFinite(ev.freq_hz) || ev.freq_hz <= 0) throw new SignalError("E_RANGE", `music.freq_hz invalid at ${i}`);
    if (!Number.isFinite(w) || w < 0) throw new SignalError("E_RANGE", `music weight invalid at ${i}`);
    W += w;
    sum += w * ev.freq_hz;
    sum2 += w * ev.freq_hz * ev.freq_hz;
    if (ev.freq_hz < min) min = ev.freq_hz;
    if (ev.freq_hz > max) max = ev.freq_hz;
  }
  if (W <= 0) throw new SignalError("E_RANGE", "music total weight must be > 0");
  const centroid = sum / W;
  const mean2 = sum2 / W;
  const variance = Math.max(0, mean2 - centroid * centroid);
  return {
    centroid_hz: centroid,
    spread_hz: Math.sqrt(variance),
    min_hz: min,
    max_hz: max,
    energy: W,
  };
}

/* --------------------------- Shape Geometry ---------------------------- */

export type ShapeMetrics = Readonly<{
  bbox: { min: Vector3; max: Vector3 };
  path_length: number;
  winding_estimate: number; // 2D winding around origin using (x,y)
  symmetry_score: number; // [0..1], higher is more symmetric
  lobe_estimate: number; // integer-ish
}>;

function bbox(points: ReadonlyArray<Vector3>): { min: Vector3; max: Vector3 } {
  if (points.length === 0) {
    return { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
  }
  let minx = Infinity, miny = Infinity, minz = Infinity;
  let maxx = -Infinity, maxy = -Infinity, maxz = -Infinity;
  for (const p of points) {
    if (p.x < minx) minx = p.x;
    if (p.y < miny) miny = p.y;
    if (p.z < minz) minz = p.z;
    if (p.x > maxx) maxx = p.x;
    if (p.y > maxy) maxy = p.y;
    if (p.z > maxz) maxz = p.z;
  }
  return { min: { x: minx, y: miny, z: minz }, max: { x: maxx, y: maxy, z: maxz } };
}

function dist(a: Vector3, b: Vector3): number {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function unwrapAngle(prev: number, next: number): number {
  // unwrap to keep continuity
  let d = next - prev;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return prev + d;
}

export function shapeMetrics(sig: ShapeSignal, opts?: { assume_closed?: boolean }): ShapeMetrics {
  assertSignalBase(sig);
  if (sig.domain !== "shape") throw new SignalError("E_DOMAIN", "Expected domain 'shape'");

  const pts = sig.sequence;
  const bb = bbox(pts);

  // path length
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += dist(pts[i - 1], pts[i]);
  if (opts?.assume_closed && pts.length > 2) L += dist(pts[pts.length - 1], pts[0]);

  // winding around origin (x,y) via angle unwrap sum / 2π
  if (pts.length < 2) {
    return { bbox: bb, path_length: L, winding_estimate: 0, symmetry_score: 1, lobe_estimate: 0 };
  }

  let anglePrev = Math.atan2(pts[0].y, pts[0].x);
  let unwrapped = anglePrev;
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = Math.atan2(pts[i].y, pts[i].x);
    const u = unwrapAngle(unwrapped, a);
    total += (u - unwrapped);
    unwrapped = u;
  }
  const winding = total / (2 * Math.PI);

  // symmetry score: compare point i with point mirrored across origin at i+N/2 (half-turn symmetry)
  // score = 1 - normalized error, clamped [0..1]
  const N = pts.length;
  let err = 0;
  let base = 0;
  for (let i = 0; i < N; i++) {
    const j = (i + Math.floor(N / 2)) % N;
    const p = pts[i];
    const q = pts[j];
    // half-turn symmetry implies q ≈ -p (in x,y). z ignored.
    const dx = q.x + p.x;
    const dy = q.y + p.y;
    err += dx * dx + dy * dy;
    base += p.x * p.x + p.y * p.y + 1e-12;
  }
  const sym = Math.max(0, Math.min(1, 1 - Math.sqrt(err / base)));

  // lobe estimate: count radius maxima via sign changes of dr
  let lobes = 0;
  if (N >= 3) {
    const r = (i: number) => Math.sqrt(pts[i].x * pts[i].x + pts[i].y * pts[i].y);
    let prevDr = r(1) - r(0);
    for (let i = 2; i < N; i++) {
      const dr = r(i) - r(i - 1);
      if (prevDr > 0 && dr <= 0) lobes++;
      prevDr = dr;
    }
  }

  return {
    bbox: bb,
    path_length: L,
    winding_estimate: winding,
    symmetry_score: sym,
    lobe_estimate: lobes,
  };
}

/* -------------------------- Textual + Cross ---------------------------- */

export type TextMetrics = Readonly<{
  entropy_bits: number;
  palindromicity: number;
  length: number;
}>;

export function textMetrics(t: TextSignal): TextMetrics {
  assertTextSignal(t);
  return {
    entropy_bits: shannonEntropyZ26(t),
    palindromicity: palindromicity(t),
    length: t.sequence.length,
  };
}

/**
 * Cross-modal correlation:
 * - Build 26x26 bigram matrix from TextSignal
 * - Build 26x26 transition matrix from another Z26-like signal (provided as indices 0..25)
 * - Return Pearson correlation between flattened matrices.
 */
export function bigramMatrix26(t: TextSignal): number[] {
  assertTextSignal(t);
  const M = new Array(26 * 26).fill(0);
  for (let i = 1; i < t.sequence.length; i++) {
    const a = t.sequence[i - 1];
    const b = t.sequence[i];
    M[a * 26 + b] += 1;
  }
  return M;
}

export function transitionMatrix26(indices: ReadonlyArray<number>): number[] {
  const M = new Array(26 * 26).fill(0);
  for (let i = 1; i < indices.length; i++) {
    const a = indices[i - 1];
    const b = indices[i];
    if (!Number.isInteger(a) || a < 0 || a > 25) throw new SignalError("E_RANGE", "transition index out of range");
    if (!Number.isInteger(b) || b < 0 || b > 25) throw new SignalError("E_RANGE", "transition index out of range");
    M[a * 26 + b] += 1;
  }
  return M;
}

export function pearsonCorrelation(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new SignalError("E_INVALID", "pearson: length mismatch");
  const n = a.length;
  if (n === 0) return 0;
  let sumA = 0, sumB = 0;
  for (let i = 0; i < n; i++) { sumA += a[i]; sumB += b[i]; }
  const meanA = sumA / n;
  const meanB = sumB / n;

  let num = 0, denA = 0, denB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  const den = Math.sqrt(denA * denB);
  if (den === 0) return 0;
  return num / den;
}

export function crossModalCorrelationTextToIndexTransitions(text: TextSignal, indexTransitions: number[]): number {
  const A = bigramMatrix26(text);
  const B = transitionMatrix26(indexTransitions);
  return pearsonCorrelation(A, B);
}
