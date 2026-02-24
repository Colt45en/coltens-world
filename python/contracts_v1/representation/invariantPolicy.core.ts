/**
 * Invariant Registry + Policy Engine (PURE)
 * - No Date.now(), no I/O, no emit calls
 * - Deterministic outputs for same inputs
 */

import {
  type GateResult,
  type GateResults,
  validateRepresentationPacket,
  validateRepresentationBatch,
  gateDirectionConsistency,
  gateValidBlameMagnitude,
  gateWeightUpdateReducedError,
  gateDetectorEmergence,
  gateRepresentationSeparabilityImprovement,
} from "./gates.js";

// ============================================================================
// CONTRACT
// ============================================================================

export interface RepresentationEvidencePacket {
  id?: string; // optional but recommended
  blameSignal: { delta: number };
  lossBeforeUpdate: number;
  lossAfterUpdate: number;
  metadata: {
    selectivity: number;
    detectorConfidence: number;
    detectorType?: string;
    updatedDirectionCorrect: boolean;
  };
  representationShift: {
    separabilityMetric: number;
    separabilityDelta: number;
  };
}

export type TriggerLevel = "FAIL" | "WARN";
export type Urgency = "immediate" | "high" | "medium" | "low";

export interface MutationAction {
  type: string;
  params: Record<string, unknown>;
  urgency: Urgency;
  reason: string;
}

export interface MutationDecision {
  actions: MutationAction[];
  confidence: number;
  triggeredBy: string[];
  trace: string;
}

export interface PacketDecision {
  packetId: string;
  packetValidation: GateResults;
  mutations: MutationDecision;
  shouldIntervene: boolean;
}

export interface BatchDecision {
  batchId: string;
  packetCount: number;
  windowSize: number;
  batchValidation: GateResult;
  unitValidations: GateResults[];
  mutations: MutationDecision;
  shouldIntervene: boolean;
}

// ============================================================================
// INVARIANTS
// ============================================================================

export type InvariantKind = "packet" | "batch";

export interface PacketInvariant {
  kind: "packet";
  name: string;
  description: string;
  gate: (packet: RepresentationEvidencePacket) => GateResult;
}

export interface BatchInvariant {
  kind: "batch";
  name: string;
  description: string;
  gate: (packets: RepresentationEvidencePacket[]) => GateResult;
}

export type Invariant = PacketInvariant | BatchInvariant;

export class InvariantRegistry {
  private readonly invariants = new Map<string, Invariant>();

  register(inv: Invariant): void {
    this.invariants.set(inv.name, inv);
  }

  get(name: string): Invariant | undefined {
    return this.invariants.get(name);
  }

  list(): Invariant[] {
    // Deterministic ordering regardless of registration order
    return Array.from(this.invariants.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  validatePacket(packet: RepresentationEvidencePacket): Map<string, GateResult> {
    const out = new Map<string, GateResult>();
    for (const inv of this.list()) {
      if (inv.kind !== "packet") continue;
      out.set(inv.name, inv.gate(packet));
    }
    return out;
  }

  validateBatch(packets: RepresentationEvidencePacket[]): Map<string, GateResult> {
    const out = new Map<string, GateResult>();
    for (const inv of this.list()) {
      if (inv.kind !== "batch") continue;
      out.set(inv.name, inv.gate(packets));
    }
    return out;
  }
}

// ============================================================================
// POLICY
// ============================================================================

export interface PolicyRule {
  invariantName: string;
  trigger: TriggerLevel;
  description: string;
  confidenceThreshold?: number;
  // Either static action, or computed action from gate result/context
  action:
    | MutationAction
    | ((args: { result: GateResult; context: PolicyContext }) => MutationAction);
}

export interface PolicyContext {
  packetCount?: number;
  windowSize?: number;
}

const URGENCY_RANK: Record<Urgency, number> = {
  immediate: 3,
  high: 2,
  medium: 1,
  low: 0,
};

function maxUrgency(a: Urgency, b: Urgency): Urgency {
  return URGENCY_RANK[a] >= URGENCY_RANK[b] ? a : b;
}

function mergeActionsDeterministic(actions: MutationAction[]): MutationAction[] {
  // Deterministic compose + dedupe by action.type
  const merged = new Map<string, MutationAction>();

  for (const a of actions) {
    const prev = merged.get(a.type);
    if (!prev) {
      merged.set(a.type, { ...a, params: { ...a.params } });
      continue;
    }

    // Merge logic for known action types
    if (a.type === "lowerLearningRate") {
      const f1 = typeof prev.params.factor === "number" ? (prev.params.factor as number) : 1;
      const f2 = typeof a.params.factor === "number" ? (a.params.factor as number) : 1;
      const factor = Math.max(0, Math.min(1, f1 * f2)); // multiply reductions
      merged.set(a.type, {
        type: a.type,
        urgency: maxUrgency(prev.urgency, a.urgency),
        reason: `${prev.reason} | ${a.reason}`,
        params: { factor },
      });
      continue;
    }

    if (a.type === "clipGradients") {
      const n1 = typeof prev.params.maxNorm === "number" ? (prev.params.maxNorm as number) : Infinity;
      const n2 = typeof a.params.maxNorm === "number" ? (a.params.maxNorm as number) : Infinity;
      const maxNorm = Math.min(n1, n2);
      merged.set(a.type, {
        type: a.type,
        urgency: maxUrgency(prev.urgency, a.urgency),
        reason: `${prev.reason} | ${a.reason}`,
        params: { maxNorm },
      });
      continue;
    }

    if (a.type === "addRegularization") {
      // keep highest weight
      const w1 = typeof prev.params.weight === "number" ? (prev.params.weight as number) : 0;
      const w2 = typeof a.params.weight === "number" ? (a.params.weight as number) : 0;
      const weight = Math.max(w1, w2);
      merged.set(a.type, {
        type: a.type,
        urgency: maxUrgency(prev.urgency, a.urgency),
        reason: `${prev.reason} | ${a.reason}`,
        params: { ...prev.params, ...a.params, weight },
      });
      continue;
    }

    // Unknown types: keep the more urgent one, merge reasons
    merged.set(a.type, {
      ...prev,
      urgency: maxUrgency(prev.urgency, a.urgency),
      reason: `${prev.reason} | ${a.reason}`,
      params: { ...prev.params, ...a.params },
    });
  }

  // Stable order: urgency desc, then type asc
  return Array.from(merged.values()).sort((a, b) => {
    const du = URGENCY_RANK[b.urgency] - URGENCY_RANK[a.urgency];
    return du !== 0 ? du : a.type.localeCompare(b.type);
  });
}

export class PolicyEngine {
  private rules: PolicyRule[] = [];

  addRule(rule: PolicyRule): void {
    this.rules.push(rule);
  }

  decideMutations(gateResults: Map<string, GateResult>, context: PolicyContext = {}): MutationDecision {
    // Deterministic ordering over rules
    const rules = [...this.rules].sort((a, b) => {
      const n = a.invariantName.localeCompare(b.invariantName);
      if (n !== 0) return n;
      return a.trigger.localeCompare(b.trigger);
    });

    const rawActions: MutationAction[] = [];
    const triggeredBy: string[] = [];
    const confidences: number[] = [];

    for (const rule of rules) {
      const result = gateResults.get(rule.invariantName);
      if (!result) continue;

      const okTrigger =
        result.status === rule.trigger &&
        (rule.confidenceThreshold === undefined || result.confidence >= rule.confidenceThreshold);

      if (!okTrigger) continue;

      const action =
        typeof rule.action === "function"
          ? rule.action({ result, context })
          : rule.action;

      rawActions.push(action);
      triggeredBy.push(`${rule.invariantName}:${result.status}`);
      confidences.push(result.confidence);
    }

    const actions = mergeActionsDeterministic(rawActions);
    const confidence =
      confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 1.0;

    const trace =
      actions.length === 0
        ? `No mutations triggered. Confidence ${(confidence * 100).toFixed(1)}%`
        : `TriggeredBy=[${triggeredBy.join(", ")}] Actions=[${actions
            .map((a) => `${a.type}:${a.urgency}`)
            .join(", ")}] Confidence ${(confidence * 100).toFixed(1)}%`;

    return { actions, confidence, triggeredBy, trace };
  }
}

// ============================================================================
// DEFAULT SETUP
// ============================================================================

export function createDefaultInvariantRegistry(): InvariantRegistry {
  const r = new InvariantRegistry();

  r.register({
    kind: "packet",
    name: "validBlameMagnitude",
    gate: gateValidBlameMagnitude,
    description: "Blame magnitude not exploding/vanishing",
  });

  r.register({
    kind: "packet",
    name: "weightUpdateReducedError",
    gate: gateWeightUpdateReducedError,
    description: "Loss decreases after update",
  });

  r.register({
    kind: "packet",
    name: "detectorEmergence",
    gate: gateDetectorEmergence,
    description: "Unit selectivity/confidence indicates detector formation",
  });

  r.register({
    kind: "packet",
    name: "separabilityImprovement",
    gate: gateRepresentationSeparabilityImprovement,
    description: "Separability improves (no regression/stall)",
  });

  // ✅ batch invariant
  r.register({
    kind: "batch",
    name: "directionConsistency",
    gate: (packets) => gateDirectionConsistency(packets),
    description: "Correctness/flip stability across a window",
  });

  return r;
}

export function createDefaultPolicyEngine(): PolicyEngine {
  const p = new PolicyEngine();

  // Blame magnitude
  p.addRule({
    invariantName: "validBlameMagnitude",
    trigger: "FAIL",
    description: "Reduce LR on gradient explosion",
    action: { type: "lowerLearningRate", params: { factor: 0.5 }, urgency: "immediate", reason: "Gradient explosion" },
  });

  p.addRule({
    invariantName: "validBlameMagnitude",
    trigger: "WARN",
    description: "Clip gradients on vanishing/dead",
    action: { type: "clipGradients", params: { maxNorm: 1.0 }, urgency: "high", reason: "Vanishing/dead blame" },
  });

  // Loss update
  p.addRule({
    invariantName: "weightUpdateReducedError",
    trigger: "FAIL",
    description: "Revert update if loss increased",
    action: { type: "revertUpdate", params: {}, urgency: "immediate", reason: "Loss increased" },
  });

  p.addRule({
    invariantName: "weightUpdateReducedError",
    trigger: "WARN",
    description: "Slightly lower LR on flat loss",
    action: { type: "lowerLearningRate", params: { factor: 0.9 }, urgency: "medium", reason: "Loss unchanged" },
  });

  // Separability
  p.addRule({
    invariantName: "separabilityImprovement",
    trigger: "FAIL",
    description: "Freeze layer on regression",
    action: { type: "freezeLayer", params: { layerIndex: -1 }, urgency: "high", reason: "Separability regressed" },
  });

  p.addRule({
    invariantName: "separabilityImprovement",
    trigger: "WARN",
    description: "Add L2 on stall",
    action: { type: "addRegularization", params: { type: "l2", weight: 0.01 }, urgency: "medium", reason: "Separability stalled" },
  });

  // Detector emergence
  p.addRule({
    invariantName: "detectorEmergence",
    trigger: "WARN",
    description: "Reinit unit on weak detector",
    action: { type: "reinitializeUnit", params: { unitIndex: -1 }, urgency: "low", reason: "Weak detector emergence" },
  });

  // ✅ Direction consistency (window-level stability)
  p.addRule({
    invariantName: "directionConsistency",
    trigger: "WARN",
    description: "Dampen oscillation / improve stability",
    action: { type: "lowerLearningRate", params: { factor: 0.85 }, urgency: "high", reason: "Oscillation/instability in window" },
  });

  return p;
}

// ============================================================================
// PURE DECISION FUNCTIONS
// ============================================================================

function stableIdFromPacket(packet: RepresentationEvidencePacket): string {
  // Pure + deterministic: prefer packet.id if present, otherwise stable fallback
  // (Caller can supply a real hash id upstream if desired.)
  if (packet.id && packet.id.length >= 8) return packet.id;
  // fallback: deterministic-ish signature
  const d = packet.blameSignal.delta;
  const b = packet.lossBeforeUpdate;
  const a = packet.lossAfterUpdate;
  return `pkt_${Math.abs(Math.imul(((d * 1e6) | 0) ^ ((b * 1e6) | 0), 2654435761)).toString(16).padStart(8, "0")}_${Math.abs(((a * 1e6) | 0)).toString(16).padStart(8, "0")}`.slice(0, 32);
}

export function decidePacket(
  packet: RepresentationEvidencePacket,
  registry: InvariantRegistry,
  policy: PolicyEngine
): PacketDecision {
  const packetId = stableIdFromPacket(packet);
  const packetValidation = validateRepresentationPacket(packet);
  const gateResults = registry.validatePacket(packet);
  const mutations = policy.decideMutations(gateResults);

  return {
    packetId,
    packetValidation,
    mutations,
    shouldIntervene: mutations.actions.length > 0,
  };
}

export function decideBatch(
  batchId: string,
  packets: RepresentationEvidencePacket[],
  registry: InvariantRegistry,
  policy: PolicyEngine,
  windowSize: number
): BatchDecision {
  const { batchValidation, unitResults } = validateRepresentationBatch(packets);

  const gateResults = new Map<string, GateResult>();

  // batch invariants
  const batchInv = registry.validateBatch(packets);
  for (const [k, v] of batchInv.entries()) gateResults.set(k, v);

  // packet invariants (use last packet as "current state")
  if (packets.length > 0) {
    const lastPacket = packets[packets.length - 1];
    if (lastPacket !== undefined) {
      for (const [k, v] of (registry.validatePacket(lastPacket)).entries()) gateResults.set(k, v);
    }
  }

  const mutations = policy.decideMutations(gateResults, { packetCount: packets.length, windowSize });

  return {
    batchId,
    packetCount: packets.length,
    windowSize,
    batchValidation,
    unitValidations: unitResults,
    mutations,
    shouldIntervene: mutations.actions.length > 0,
  };
}
