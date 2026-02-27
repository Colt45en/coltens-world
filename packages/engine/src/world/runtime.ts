/**
 * World Engine Runtime
 *
 * Core deterministic simulation engine:
 * - Accepts ordered events
 * - Runs metaprocess pipelines
 * - Derives beliefs from observations
 * - Computes entropy
 * - Produces snapshot + seal
 *
 * All operations are deterministic; given same inputs and prior state,
 * produces identical snapshot with identical hash.
 */

import type {
  Belief,
  Claim,
  Event,
  Observation,
  Seal,
  Snapshot,
} from "@world-engine/contracts";
import {
  EventSchema,
  IsoUtcSchema,
  ObservationSchema,
  SealSchema,
  SnapshotSchema,
} from "@world-engine/contracts";
import { contentAddressedId, sha256Hex, stableStringify } from "../determinism/canon";

// ============ Pipeline Interface ============

export type Pipeline = {
  name: string;
  run: (args: {
    events: Event[];
    prior: Snapshot | null;
    now_utc: string;
  }) => Observation[];
};

/** Deterministic projection from snapshot to render-friendly state */
export type Renderer = (args: {
  snapshot: Omit<Snapshot, "hash">;
}) => Record<string, unknown>;

/** External ledger head info (for sealing) */
export type LedgerHead = {
  head_event_id: string;
  ledger_hash: string;
};

/** External contracts version info (for sealing) */
export type ContractsInfo = {
  contracts_hash: string;
};

// ============ Default Renderer ============

function defaultRenderer(args: {
  snapshot: Omit<Snapshot, "hash">;
}): Record<string, unknown> {
  // Deterministic projection: high-level state summary
  const totalObservations = args.snapshot.observations.length;
  const totalClaims = args.snapshot.beliefs.reduce((n: number, b: Belief) => n + b.claims.length, 0);

  const topClaims = args.snapshot.beliefs
    .flatMap((b: Belief) => b.claims)
    .slice()
    .sort((a: Claim, b: Claim) => {
      const c = b.confidence - a.confidence;
      return c !== 0 ? c : a.id.localeCompare(b.id);
    })
    .slice(0, 10)
    .map((c: Claim) => ({
      id: c.id,
      subject: c.subject,
      predicate: c.predicate,
      object: c.object,
      confidence: c.confidence,
    }));

  return {
    totals: { observations: totalObservations, claims: totalClaims },
    entropy: args.snapshot.entropy,
    top_claims: topClaims,
  };
}

// ============ Belief Derivation ============

/**
 * Deterministic belief derivation from observations.
 * Treats observations with kind="claim" as claims.
 * Detects contradictions: same (subject, predicate) with different objects.
 */
function deriveBeliefs(args: {
  observations: Observation[];
  now_utc: string;
}): Belief[] {
  const claims: Claim[] = [];

  // Extract claims from observations
  for (const o of args.observations) {
    if (o.kind !== "claim") continue;

    const subject = String(o.data.subject ?? "");
    const predicate = String(o.data.predicate ?? "");
    const object = String(o.data.object ?? "");
    const confidence = clamp01(Number(o.data.confidence ?? 0.5));

    if (!subject || !predicate || !object) continue;

    const base = {
      ts_utc: args.now_utc,
      subject,
      predicate,
      object,
      confidence,
      evidence: [],
    };
    const id = contentAddressedId("claim", base);

    claims.push({
      id,
      ...base,
      evidence: [],
    });
  }

  // Stable sort claims
  claims.sort((a, b) => {
    const sp = (a.subject + "\u0000" + a.predicate).localeCompare(
      b.subject + "\u0000" + b.predicate
    );
    if (sp !== 0) return sp;
    const o = a.object.localeCompare(b.object);
    return o !== 0 ? o : a.id.localeCompare(b.id);
  });

  // Detect contradictions: same (s,p) with different objects
  const contradictions: Array<{
    claim_id: string;
    contradicting_claim_id: string;
    reason: string;
  }> = [];

  const bySP = new Map<string, Claim[]>();
  for (const c of claims) {
    const key = `${c.subject}\u0000${c.predicate}`;
    const list = bySP.get(key) ?? [];
    list.push(c);
    bySP.set(key, list);
  }

  for (const [key, list] of bySP.entries()) {
    const uniqueObjects = new Map<string, Claim[]>();
    for (const c of list) {
      const l = uniqueObjects.get(c.object) ?? [];
      l.push(c);
      uniqueObjects.set(c.object, l);
    }
    if (uniqueObjects.size <= 1) continue;

    // Contradiction pairs
    const objs = Array.from(uniqueObjects.keys()).sort();
    for (let i = 0; i < objs.length; i++) {
      for (let j = i + 1; j < objs.length; j++) {
        const a = uniqueObjects.get(objs[i]!);
        const b = uniqueObjects.get(objs[j]!);
        if (!a || !b) continue;
        for (const ca of a) {
          for (const cb of b) {
            contradictions.push({
              claim_id: ca.id,
              contradicting_claim_id: cb.id,
              reason: `Conflicting objects for same (subject, predicate): ${key.replace(
                "\u0000",
                "/"
              )}`,
            });
          }
        }
      }
    }
  }

  // Stable order
  contradictions.sort((a, b) => {
    const c = a.claim_id.localeCompare(b.claim_id);
    return c !== 0 ? c : a.contradicting_claim_id.localeCompare(b.contradicting_claim_id);
  });

  const beliefCore = {
    ts_utc: args.now_utc,
    claims,
    contradictions,
  };
  const beliefId = contentAddressedId("belief", beliefCore);

  return [
    {
      id: beliefId,
      ...beliefCore,
    },
  ];
}

// ============ Entropy Computation ============

/**
 * Deterministic Shannon entropy over claim distribution.
 * For each (subject, predicate), compute entropy of object distribution.
 */
function computeEntropyFromBeliefs(beliefs: Belief[]): number {
  const claims = beliefs.flatMap((b) => b.claims);

  const bySP = new Map<string, string[]>();
  for (const c of claims) {
    const key = `${c.subject}\u0000${c.predicate}`;
    const list = bySP.get(key) ?? [];
    list.push(c.object);
    bySP.set(key, list);
  }

  let total = 0;
  const keys = Array.from(bySP.keys()).sort();

  for (const k of keys) {
    const objs = bySP.get(k)!;
    const counts = new Map<string, number>();
    for (const o of objs) {
      counts.set(o, (counts.get(o) ?? 0) + 1);
    }

    const n = objs.length;
    const pList = Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, c]) => c / n);

    total += shannonEntropy(pList);
  }

  return Math.max(0, total); // clamp tiny negatives
}

function shannonEntropy(p: number[]): number {
  let h = 0;
  for (const x of p) {
    if (x <= 0) continue;
    h += -x * Math.log(x);
  }
  return h;
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

// ============ World Engine Runtime ============

export class WorldEngineRuntime {
  private readonly pipelines: Pipeline[] = [];
  private renderer: Renderer;

  constructor(args?: { renderer?: Renderer }) {
    this.renderer = args?.renderer ?? defaultRenderer;
  }

  registerPipeline(p: Pipeline): void {
    if (this.pipelines.some((x) => x.name === p.name)) {
      throw new Error(`Pipeline already registered: ${p.name}`);
    }
    this.pipelines.push(p);
    // Stable order
    this.pipelines.sort((a, b) => a.name.localeCompare(b.name));
  }

  setRenderer(r: Renderer): void {
    this.renderer = r;
  }

  /**
   * Apply events to produce a new snapshot deterministically.
   * If prior is null, this is the first snapshot.
   */
  produceSnapshot(args: {
    events: Event[];
    prior: Snapshot | null;
    now_utc: string;
  }): Snapshot {
    IsoUtcSchema.parse(args.now_utc);

    // Validate and sort events deterministically
    const events = args.events
      .map((e) => EventSchema.parse(e))
      .slice()
      .sort((a, b) => {
        const t = a.ts_utc.localeCompare(b.ts_utc);
        return t !== 0 ? t : a.id.localeCompare(b.id);
      });

    // Run pipelines and collect observations
    const observations: Observation[] = [];
    for (const p of this.pipelines) {
      const out = p
        .run({ events, prior: args.prior, now_utc: args.now_utc })
        .map((o) => ObservationSchema.parse(o));

      // Stable order
      out.sort((a, b) => {
        const k = a.kind.localeCompare(b.kind);
        return k !== 0 ? k : a.id.localeCompare(b.id);
      });
      observations.push(...out);
    }

    // Derive beliefs
    const beliefs = deriveBeliefs({ observations, now_utc: args.now_utc });

    // Compute entropy
    const entropy = computeEntropyFromBeliefs(beliefs);

    // Build snapshot without hash
    const snapshotWithoutHash: Omit<Snapshot, "hash"> = {
      id: "snapshot_pending",
      ts_utc: args.now_utc,
      events_applied: events.map((e) => e.id),
      observations,
      beliefs,
      render_state: {},
      entropy,
    };

    // Render
    const render_state = this.renderer({ snapshot: snapshotWithoutHash });

    const snapshotCore = {
      ...snapshotWithoutHash,
      render_state,
    };

    // Content-address snapshot
    const snapshot_id = contentAddressedId("snapshot", snapshotCore);
    const snapshot_hash = sha256Hex(
      stableStringify({ ...snapshotCore, id: snapshot_id })
    );

    const snap: Snapshot = SnapshotSchema.parse({
      ...snapshotCore,
      id: snapshot_id,
      hash: snapshot_hash,
    });

    return snap;
  }

  /**
   * Create a seal: content-addressed checkpoint linking
   * snapshot, ledger head, and contracts version.
   */
  sealSnapshot(args: {
    snapshot: Snapshot;
    now_utc: string;
    ledger: LedgerHead;
    contracts: ContractsInfo;
  }): Seal {
    IsoUtcSchema.parse(args.now_utc);

    const payload = {
      ts_utc: args.now_utc,
      snapshot_id: args.snapshot.id,
      snapshot_hash: args.snapshot.hash,
      ledger_head_event_id: args.ledger.head_event_id,
      ledger_hash: args.ledger.ledger_hash,
      contracts_hash: args.contracts.contracts_hash,
    };

    const seal_id = contentAddressedId("seal", payload);

    const seal: Seal = SealSchema.parse({
      id: seal_id,
      ...payload,
    });

    return seal;
  }
}
