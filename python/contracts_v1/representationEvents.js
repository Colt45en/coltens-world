// ids-and-envelope.ts
// Fully runnable in TS or modern JS (remove types if needed).

import { z } from "zod";

export function toHex32(value) {
  return (value >>> 0).toString(16).padStart(8, "0");
}

function bytesToHex(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, "0");
  return out;
}

function utf8(text) {
  return new TextEncoder().encode(text);
}

/**
 * Real SHA-256 (sync, pure JS)
 * Verified: sha256HexSync("abc") ===
 * ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad
 */
export function sha256HexSync(message) {
  // SHA-256 constants
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);

  // Initial hash values
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  const data = utf8(message);
  const bitLenHi = Math.floor((data.length * 8) / 0x100000000);
  const bitLenLo = (data.length * 8) >>> 0;

  // Pre-processing: padding
  const withOne = data.length + 1;
  const padLen = (withOne % 64 <= 56) ? (56 - (withOne % 64)) : (56 + (64 - (withOne % 64)));
  const totalLen = data.length + 1 + padLen + 8;

  const buf = new Uint8Array(totalLen);
  buf.set(data, 0);
  buf[data.length] = 0x80; // append '1' bit

  // append length (big endian 64-bit)
  const dv = new DataView(buf.buffer);
  dv.setUint32(totalLen - 8, bitLenHi, false);
  dv.setUint32(totalLen - 4, bitLenLo, false);

  const W = new Uint32Array(64);

  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  const ch = (x, y, z) => (x & y) ^ (~x & z);
  const maj = (x, y, z) => (x & y) ^ (x & z) ^ (y & z);
  const s0 = (x) => rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3);
  const s1 = (x) => rotr(x, 17) ^ rotr(x, 19) ^ (x >>> 10);
  const S0 = (x) => rotr(x, 2) ^ rotr(x, 13) ^ rotr(x, 22);
  const S1 = (x) => rotr(x, 6) ^ rotr(x, 11) ^ rotr(x, 25);

  for (let i = 0; i < buf.length; i += 64) {
    // message schedule
    for (let t = 0; t < 16; t++) W[t] = dv.getUint32(i + t * 4, false);
    for (let t = 16; t < 64; t++) {
      const v = (s1(W[t - 2]) + W[t - 7] + s0(W[t - 15]) + W[t - 16]) >>> 0;
      W[t] = v;
    }

    // working vars
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;

    for (let t = 0; t < 64; t++) {
      const T1 = (h + S1(e) + ch(e, f, g) + K[t] + W[t]) >>> 0;
      const T2 = (S0(a) + maj(a, b, c)) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + T1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (T1 + T2) >>> 0;
    }

    // add back
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }

  return (
    toHex32(h0) + toHex32(h1) + toHex32(h2) + toHex32(h3) +
    toHex32(h4) + toHex32(h5) + toHex32(h6) + toHex32(h7)
  );
}

/**
 * Real SHA-256 (async, uses WebCrypto when available; falls back to sync)
 */
export async function sha256Hex(text) {
  const c = (globalThis).crypto;
  if (c?.subtle?.digest) {
    const digest = await c.subtle.digest("SHA-256", utf8(text));
    return bytesToHex(new Uint8Array(digest));
  }
  return sha256HexSync(text);
}

// ---------------------------------------------------------------------------
// Deterministic RNG option (seeded) + crypto/random fallback
// ---------------------------------------------------------------------------

function fnv1a32(seed) {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Mulberry32 PRNG: deterministic, fast, not cryptographic
function mulberry32(seed32) {
  let t = seed32 >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function createIdTools(opts = {}) {
  const mode = opts.mode ?? "crypto";
  const bytesMsgId = opts.bytesMsgId ?? 16;   // 128-bit payload
  const bytesSpanId = opts.bytesSpanId ?? 16; // 128-bit span
  const bytesTraceId = opts.bytesTraceId ?? 16;

  const cryptoObj = (globalThis).crypto;
  const seededRng = mode === "seeded" ? mulberry32(fnv1a32(opts.seed ?? "seed")) : null;

  // monotonic sequence guarantees uniqueness per process even if RNG repeats
  let seq = 0;

  function randomByte() {
    if (mode === "crypto" && cryptoObj?.getRandomValues) {
      const b = new Uint8Array(1);
      cryptoObj.getRandomValues(b);
      return b[0];
    }
    if (mode === "seeded" && seededRng) return Math.floor(seededRng() * 256) & 255;
    return Math.floor(Math.random() * 256) & 255;
  }

  function randomHex(bytes) {
    if (mode === "crypto" && cryptoObj?.getRandomValues) {
      const data = new Uint8Array(bytes);
      cryptoObj.getRandomValues(data);
      return bytesToHex(data);
    }
    let out = "";
    for (let i = 0; i < bytes; i++) out += randomByte().toString(16).padStart(2, "0");
    return out;
  }

  function newId(prefix) {
    seq++;
    // include seq for determinism + uniqueness (especially in seeded mode)
    return `${prefix}_${randomHex(bytesMsgId)}_${seq.toString(36)}`;
  }

  function newSpanId() {
    seq++;
    return `${randomHex(bytesSpanId)}_${seq.toString(36)}`;
  }

  function newTraceId() {
    seq++;
    return `${randomHex(bytesTraceId)}_${seq.toString(36)}`;
  }

  return { randomHex, newId, newSpanId, newTraceId };
}

// ---------------------------------------------------------------------------
// Envelope factory (adds tsMs, injects clock, supports deterministic IDs)
// ---------------------------------------------------------------------------

export function createEnvelopeFactory(opts) {
  const idTools = opts.idTools ?? createIdTools({ mode: "crypto" });
  const clockMs = opts.clockMs ?? (() => Date.now());

  return function makeEnvelope(type, data, span = {}) {
    const tsMs = clockMs();
    const spanId = span.spanId ?? idTools.newSpanId();

    return {
      v: 1,
      id: idTools.newId("msg"),
      ts: new Date(tsMs).toISOString(),
      tsMs,
      type,
      source: opts.source,
      traceId: opts.traceId,
      spanId,
      parentSpanId: span.parentSpanId,
      severity: span.severity ?? "info",
      data,
    };
  };
}

/**
 * Representation Gate Events (extends BusEnvelope)
 * Events for the agentic representation learning system.
 */

// ============================================================================
// REPRESENTATION EVENT TYPES
// ============================================================================

export const RepresentationEventTypeSchema = z.enum([
  "rep.gate.packet.validated",
  "rep.gate.batch.validated",
  "agent.mutation.proposed",
  "agent.mutation.approved",
  "agent.mutation.applied",
  "agent.mutation.rejected",
]);

// Optional but recommended: keep this consistent with your BusEnvelope rules
const SourceSchema = z
  .string()
  .min(3)
  .regex(/^(tooling|apps|worker)\.[a-z0-9-]+$/, "source must be like worker.representation-agent");

// ============================================================================
// SHARED SCHEMAS
// ============================================================================

export const GateResultSchema = z.object({
  status: z.enum(["PASS", "FAIL", "WARN"]),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
  metrics: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export const GateResultsSchema = z.object({
  validBlameMagnitude: GateResultSchema,
  weightUpdateReducedError: GateResultSchema,
  detectorEmergence: GateResultSchema,
  separabilityImprovement: GateResultSchema,
  allPass: z.boolean(),
  anyFail: z.boolean(),
  warningsCount: z.number().int().nonnegative(),
});

export const MutationActionSchema = z.object({
  type: z.string().min(3),
  params: z.record(z.string(), z.unknown()).default({}),
  urgency: z.enum(["immediate", "high", "medium", "low"]),
  reason: z.string().min(1),
});

export const MutationDecisionSchema = z.object({
  actions: z.array(MutationActionSchema),
  confidence: z.number().min(0).max(1),
  triggeredBy: z.array(z.string().min(1)),
  trace: z.string().min(1),
});

// ============================================================================
// EVENT DATA SCHEMAS
// ============================================================================

export const RepGatePacketValidatedDataSchema = z.object({
  packetId: z.string().min(8),
  unitId: z.string().min(8).optional(),
  layerId: z.string().min(8).optional(),
  results: GateResultsSchema,
  packet: z.unknown(), // ✅ allow full replay payload (arrays, nested, etc.)
});

export const RepGateBatchValidatedDataSchema = z.object({
  batchId: z.string().min(8),
  packetCount: z.number().int().positive(),
  batchValidation: GateResultSchema,
  unitResults: z.array(GateResultsSchema),
  windowSize: z.number().int().positive(),
});

export const AgentMutationProposedDataSchema = z.object({
  batchId: z.string().min(8),
  decision: MutationDecisionSchema,
  proposedBy: z.string().min(1),
});

export const AgentMutationApprovedDataSchema = z.object({
  batchId: z.string().min(8),
  decision: MutationDecisionSchema,
  approvedBy: z.string().min(1),
  approvalReason: z.string().optional(),
});

export const AgentMutationAppliedDataSchema = z.object({
  batchId: z.string().min(8),
  decision: MutationDecisionSchema,
  appliedActions: z.array(MutationActionSchema),
  success: z.boolean(),
  appliedAt: z.number().int().nonnegative(), // tsMs
  rollbackInfo: z.record(z.string(), z.unknown()).optional(),
});

export const AgentMutationRejectedDataSchema = z.object({
  batchId: z.string().min(8),
  decision: MutationDecisionSchema,
  rejectedBy: z.string().min(1),
  rejectionReason: z.string().min(1),
});

// ============================================================================
// BASE ENVELOPE (BUS-COMPATIBLE)
// ============================================================================

const BaseRep = z.object({
  v: z.literal(1),
  id: z.string().min(8),
  ts: z.string().datetime(),
  tsMs: z.number().int().nonnegative(),
  type: RepresentationEventTypeSchema, // ✅ locked
  source: SourceSchema,                // ✅ locked
  traceId: z.string().min(8),
  spanId: z.string().min(8),
  parentSpanId: z.string().min(8).optional(),
  severity: z.enum(["debug", "info", "warn", "error"]).default("info"),
  data: z.unknown(),
});

// ============================================================================
// DISCRIMINATED UNION
// ============================================================================

const ERepGatePacket = BaseRep.extend({
  type: z.literal("rep.gate.packet.validated"),
  data: RepGatePacketValidatedDataSchema,
});

const ERepGateBatch = BaseRep.extend({
  type: z.literal("rep.gate.batch.validated"),
  data: RepGateBatchValidatedDataSchema,
});

const EAgentMutationProposed = BaseRep.extend({
  type: z.literal("agent.mutation.proposed"),
  data: AgentMutationProposedDataSchema,
});

const EAgentMutationApproved = BaseRep.extend({
  type: z.literal("agent.mutation.approved"),
  data: AgentMutationApprovedDataSchema,
});

const EAgentMutationApplied = BaseRep.extend({
  type: z.literal("agent.mutation.applied"),
  data: AgentMutationAppliedDataSchema,
});

const EAgentMutationRejected = BaseRep.extend({
  type: z.literal("agent.mutation.rejected"),
  data: AgentMutationRejectedDataSchema,
});

export const RepresentationEnvelopeSchema = z.discriminatedUnion("type", [
  ERepGatePacket,
  ERepGateBatch,
  EAgentMutationProposed,
  EAgentMutationApproved,
  EAgentMutationApplied,
  EAgentMutationRejected,
]);

// export type RepresentationEnvelope = z.infer<typeof RepresentationEnvelopeSchema>;

// ============================================================================
// TYPED FACTORY (plugs into your existing createEnvelopeFactory)
// ============================================================================

// type RepDataByType = {
//   "rep.gate.packet.validated": z.infer<typeof RepGatePacketValidatedDataSchema>;
//   "rep.gate.batch.validated": z.infer<typeof RepGateBatchValidatedDataSchema>;
//   "agent.mutation.proposed": z.infer<typeof AgentMutationProposedDataSchema>;
//   "agent.mutation.approved": z.infer<typeof AgentMutationApprovedDataSchema>;
//   "agent.mutation.applied": z.infer<typeof AgentMutationAppliedDataSchema>;
//   "agent.mutation.rejected": z.infer<typeof AgentMutationRejectedDataSchema>;
// };

// type SpanOpts = {
//   spanId?: string;
//   parentSpanId?: string;
//   severity?: "debug" | "info" | "warn" | "error";
// };

// This matches the signature you already have:
// const makeEnvelope = createEnvelopeFactory({ source, traceId })
// type MakeEnvelopeFn = <TType extends string, TData>(
//   type: TType,
//   data: TData,
//   span?: SpanOpts
// ) => any;

export function createRepresentationEnvelopeFactory(makeEnvelope) {
  return function makeRepEnvelope(type, data, span) {
    const raw = makeEnvelope(type, data, span);
    return RepresentationEnvelopeSchema.parse(raw);
  };
}

// ============================================================================
// EMITTERS (compiler-enforced required fields)
// ============================================================================

export function createRepresentationEmitters(opts) {
  const { makeRepEnvelope, emit } = opts;

  return {
    gatePacketValidated(data, span) {
      emit(makeRepEnvelope("rep.gate.packet.validated", data, span));
    },

    gateBatchValidated(data, span) {
      emit(makeRepEnvelope("rep.gate.batch.validated", data, span));
    },

    mutationProposed(data, span) {
      emit(makeRepEnvelope("agent.mutation.proposed", data, span));
    },

    mutationApproved(data, span) {
      emit(makeRepEnvelope("agent.mutation.approved", data, span));
    },

    mutationApplied(data, span) {
      emit(makeRepEnvelope("agent.mutation.applied", data, span));
    },

    mutationRejected(data, span) {
      emit(makeRepEnvelope("agent.mutation.rejected", data, span));
    },
  };
}
