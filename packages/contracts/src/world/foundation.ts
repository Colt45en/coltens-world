/**
 * World Engine Foundation Contracts
 *
 * Canonical definitions for a deterministic, ring-based world simulation.
 * Rings enforce data flow direction: Roots → Metaprocess → Thought → Perception
 *
 * All contracts are Zod-validated at boundaries.
 * All IDs are content-addressed (prefix_sha256hash) for deterministic replay.
 */

import { z } from "zod";

// ============ Rings & Core Types ============

export const RingSchema = z.enum(["roots", "metaprocess", "thought", "perception"]);
export type Ring = z.infer<typeof RingSchema>;

/** Content-addressed deterministic ID: <prefix>_<sha256(canonical_json(payload))> */
export const IdSchema = z.string().min(8);

export const IsoUtcSchema = z.string().datetime();

// ============ Roots Ring: Immutable Definitions ============

/** Lexicon term: canonical definition within a ring */
export const LexiconTermSchema = z.object({
  id: IdSchema,
  ring: RingSchema,
  term: z.string().min(1),
  definition: z.string().min(1),
  canonical: z.boolean().default(true),
  created_at_utc: IsoUtcSchema,
  hash: z.string().min(16),
});
export type LexiconTerm = z.infer<typeof LexiconTermSchema>;

/** Immutable truth: not derived, enforced as a fact */
export const AxiomSchema = z.object({
  id: IdSchema,
  ring: z.literal("roots"),
  title: z.string().min(1),
  statement: z.string().min(1),
  created_at_utc: IsoUtcSchema,
  hash: z.string().min(16),
});
export type Axiom = z.infer<typeof AxiomSchema>;

// ============ Metaprocess Ring: Events & Observations ============

/** Input event to be processed deterministically */
export const EventSchema = z.object({
  id: IdSchema,
  type: z.string().min(1),
  ts_utc: IsoUtcSchema,
  actor: z.string().min(1), // "nucleus", "avatar:<id>", "system"
  payload: z.record(z.unknown()),
});
export type Event = z.infer<typeof EventSchema>;

/** Output of a metaprocess pipeline: deterministic observation */
export const ObservationSchema = z.object({
  id: IdSchema,
  pipeline: z.string().min(1),
  ts_utc: IsoUtcSchema,
  kind: z.string().min(1), // e.g. "concept.graph", "metric.entropy", "claim"
  data: z.record(z.unknown()),
});
export type Observation = z.infer<typeof ObservationSchema>;

// ============ Thought Ring: Claims & Beliefs ============

/** Piece of evidence supporting or contradicting a claim */
export const EvidenceSchema = z.object({
  id: IdSchema,
  source_observation_id: IdSchema,
  weight: z.number().finite().min(0).max(1),
  note: z.string().optional(),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

/** Assertion with evidence */
export const ClaimSchema = z.object({
  id: IdSchema,
  ts_utc: IsoUtcSchema,
  subject: z.string().min(1),
  predicate: z.string().min(1),
  object: z.string().min(1),
  confidence: z.number().finite().min(0).max(1),
  evidence: z.array(EvidenceSchema).default([]),
});
export type Claim = z.infer<typeof ClaimSchema>;

/** Belief: set of claims with contradiction tracking */
export const BeliefSchema = z.object({
  id: IdSchema,
  ts_utc: IsoUtcSchema,
  claims: z.array(ClaimSchema),
  contradictions: z.array(z.object({
    claim_id: IdSchema,
    contradicting_claim_id: IdSchema,
    reason: z.string().min(1),
  })).default([]),
});
export type Belief = z.infer<typeof BeliefSchema>;

// ============ Concept Graph (Metaprocess Output) ============

export const ConceptNodeSchema = z.object({
  id: IdSchema,
  label: z.string().min(1),
  frequency: z.number().int().nonnegative(),
});
export type ConceptNode = z.infer<typeof ConceptNodeSchema>;

export const ConceptEdgeSchema = z.object({
  id: IdSchema,
  from: IdSchema,
  to: IdSchema,
  rel: z.string().min(1), // e.g. "co_occurs"
  weight: z.number().finite().min(0),
});
export type ConceptEdge = z.infer<typeof ConceptEdgeSchema>;

export const ConceptGraphSchema = z.object({
  id: IdSchema,
  ts_utc: IsoUtcSchema,
  nodes: z.array(ConceptNodeSchema),
  edges: z.array(ConceptEdgeSchema),
});
export type ConceptGraph = z.infer<typeof ConceptGraphSchema>;

// ============ Avatar: Deterministic Agent Spec ============

export const AvatarSpecSchema = z.object({
  id: IdSchema,
  ts_utc: IsoUtcSchema,
  name: z.string().min(1),
  version: z.string().min(1),
  policy: z.object({
    weights: z.record(z.number().finite()),
    temperature: z.number().finite().min(0).max(1).default(0),
  }),
  sensors: z.array(z.string()).default([]),
  actuators: z.array(z.string()).default([]),
  hash: z.string().min(16),
});
export type AvatarSpec = z.infer<typeof AvatarSpecSchema>;

// ============ Perception Ring: Snapshots & Seals ============

/** Complete deterministic world state snapshot at a moment */
export const SnapshotSchema = z.object({
  id: IdSchema,
  ts_utc: IsoUtcSchema,
  events_applied: z.array(IdSchema),
  observations: z.array(ObservationSchema),
  beliefs: z.array(BeliefSchema),
  render_state: z.record(z.unknown()),
  entropy: z.number().finite().min(0),
  hash: z.string().min(16),
});
export type Snapshot = z.infer<typeof SnapshotSchema>;

/** Content-addressed checkpoint: ties snapshot to ledger head and contracts */
export const SealSchema = z.object({
  id: IdSchema,
  ts_utc: IsoUtcSchema,
  snapshot_id: IdSchema,
  snapshot_hash: z.string().min(16),
  ledger_head_event_id: IdSchema,
  ledger_hash: z.string().min(16),
  contracts_hash: z.string().min(16),
});
export type Seal = z.infer<typeof SealSchema>;

// ============ Deterministic Metadata ============

export const StreamParamsSchema = z.object({
  limit: z.number().int().positive().default(200),
  after_seq: z.number().int().nonnegative().default(0),
});

export const RangeParamsSchema = z.object({
  start: z.number().int().nonnegative().default(0),
  end: z.number().int().nonnegative(),
});
