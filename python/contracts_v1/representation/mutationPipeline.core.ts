/**
 * mutationPipeline.core.ts
 * Pure: deterministic planning + approval evaluation
 * - No Date.now()
 * - No emit calls
 * - Fully unit-testable
 */

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

export type ApprovalRequirement = "auto" | "human" | "blocked";

export interface ApprovalPolicyRule {
  // match on action type (exact) or prefix
  actionType?: string;
  actionTypePrefix?: string;
  minUrgency?: Urgency;
  require: ApprovalRequirement;
  reason: string;
}

export interface ApprovalPolicy {
  rules: ApprovalPolicyRule[];
  defaultRequire: ApprovalRequirement;
}

export interface ApprovalEvaluation {
  requirement: ApprovalRequirement;
  reasons: string[];
  // "riskScore" is deterministic heuristic based on actions + urgency
  riskScore: number; // 0..1
}

export interface ApplyPlan {
  decisionId: string; // deterministic hash of decision content
  actions: MutationAction[]; // normalized + sorted + deduped
  approval: ApprovalEvaluation;
  summary: string; // deterministic, human readable
}

// ---------------------------------------------------------------------------
// Deterministic helpers
// ---------------------------------------------------------------------------

const URGENCY_RANK: Record<Urgency, number> = {
  immediate: 3,
  high: 2,
  medium: 1,
  low: 0,
};

const ACTION_PRIORITY: Record<string, number> = {
  // safety/consistency first
  revertUpdate: 0,
  freezeLayer: 1,
  lowerLearningRate: 2,
  clipGradients: 3,
  addRegularization: 4,
  reinitializeUnit: 5,
};

function stableStringify(value: unknown): string {
  // deterministic JSON stringify (sort object keys)
  if (value === null || value === undefined) return String(value);
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

// FNV-1a 64-bit BigInt hash → hex (deterministic, good enough for IDs)
function fnv1a64Hex(input: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let i = 0; i < input.length; i++) {
    hash ^= BigInt(input.charCodeAt(i));
    hash = (hash * prime) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, "0");
}

function maxUrgency(a: Urgency, b: Urgency): Urgency {
  return URGENCY_RANK[a] >= URGENCY_RANK[b] ? a : b;
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

// ---------------------------------------------------------------------------
// Deterministic action merge/dedupe
// ---------------------------------------------------------------------------

export function normalizeActions(actions: MutationAction[]): MutationAction[] {
  const merged = new Map<string, MutationAction>();

  for (const a of actions) {
    const prev = merged.get(a.type);
    if (!prev) {
      merged.set(a.type, { ...a, params: { ...a.params } });
      continue;
    }

    // Compose known action types deterministically
    if (a.type === "lowerLearningRate") {
      const f1 = typeof prev.params.factor === "number" ? (prev.params.factor as number) : 1;
      const f2 = typeof a.params.factor === "number" ? (a.params.factor as number) : 1;
      const factor = clamp01(f1 * f2);
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

    // Default merge: more urgent wins; merge params + reasons
    merged.set(a.type, {
      type: a.type,
      urgency: maxUrgency(prev.urgency, a.urgency),
      reason: `${prev.reason} | ${a.reason}`,
      params: { ...prev.params, ...a.params },
    });
  }

  // Stable order: action priority → urgency desc → type asc
  return Array.from(merged.values()).sort((a, b) => {
    const pa = ACTION_PRIORITY[a.type] ?? 999;
    const pb = ACTION_PRIORITY[b.type] ?? 999;
    if (pa !== pb) return pa - pb;

    const du = URGENCY_RANK[b.urgency] - URGENCY_RANK[a.urgency];
    if (du !== 0) return du;

    return a.type.localeCompare(b.type);
  });
}

// ---------------------------------------------------------------------------
// Approval evaluation
// ---------------------------------------------------------------------------

export function createDefaultApprovalPolicy(): ApprovalPolicy {
  return {
    defaultRequire: "auto",
    rules: [
      // Hard block anything that could destroy state without rollback (example)
      { actionType: "deleteWeights", require: "blocked", reason: "Destructive action blocked by default" },

      // Human approval for risky mutations
      { actionType: "reinitializeUnit", require: "human", reason: "Reinitializing a unit is disruptive" },
      { actionType: "freezeLayer", require: "human", reason: "Freezing a layer changes learning dynamics significantly" },

      // Urgency-based: immediate actions can be human-gated depending on org preference
      { minUrgency: "immediate", require: "human", reason: "Immediate action requires explicit approval" },
    ],
  };
}

function meetsMinUrgency(u: Urgency, minU: Urgency): boolean {
  return URGENCY_RANK[u] >= URGENCY_RANK[minU];
}

export function evaluateApproval(actions: MutationAction[], policy: ApprovalPolicy): ApprovalEvaluation {
  let requirement: ApprovalRequirement = policy.defaultRequire;
  const reasons: string[] = [];

  // deterministic risk heuristic
  let risk = 0;

  for (const a of actions) {
    // risk from urgency
    risk += URGENCY_RANK[a.urgency] * 0.08;

    // risk from action types
    if (a.type === "revertUpdate") risk += 0.10;
    if (a.type === "freezeLayer") risk += 0.18;
    if (a.type === "reinitializeUnit") risk += 0.22;
    if (a.type === "lowerLearningRate") risk += 0.06;
    if (a.type === "clipGradients") risk += 0.05;
    if (a.type === "addRegularization") risk += 0.05;

    for (const rule of policy.rules) {
      const typeMatch =
        (rule.actionType && rule.actionType === a.type) ||
        (rule.actionTypePrefix && a.type.startsWith(rule.actionTypePrefix));

      const urgencyMatch = rule.minUrgency ? meetsMinUrgency(a.urgency, rule.minUrgency) : true;

      if (typeMatch && urgencyMatch) {
        // upgrade requirement deterministically: blocked > human > auto
        const rank = (r: ApprovalRequirement) => (r === "blocked" ? 2 : r === "human" ? 1 : 0);
        if (rank(rule.require) > rank(requirement)) requirement = rule.require;
        reasons.push(`${a.type}:${a.urgency} → ${rule.require} (${rule.reason})`);
      }
    }
  }

  return {
    requirement,
    reasons: reasons.length ? reasons : [`default → ${policy.defaultRequire}`],
    riskScore: clamp01(risk),
  };
}

// ---------------------------------------------------------------------------
// Plan builder
// ---------------------------------------------------------------------------

export function buildApplyPlan(decision: MutationDecision, policy: ApprovalPolicy): ApplyPlan {
  const actions = normalizeActions(decision.actions);

  const decisionId = `dec_${fnv1a64Hex(
    stableStringify({
      actions,
      confidence: decision.confidence,
      triggeredBy: decision.triggeredBy,
      trace: decision.trace,
    })
  )}`;

  const approval = evaluateApproval(actions, policy);

  const summary =
    actions.length === 0
      ? `No actions. decisionId=${decisionId}`
      : `decisionId=${decisionId} require=${approval.requirement} risk=${approval.riskScore.toFixed(
          2
        )} actions=[${actions.map((a) => `${a.type}:${a.urgency}`).join(", ")}]`;

  return { decisionId, actions, approval, summary };
}
