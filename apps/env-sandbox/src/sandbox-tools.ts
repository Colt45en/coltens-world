/**
 * Sandbox v2 — compact environment mutation kit with approval + apply pipeline
 * - Boots from Recursive Creation Codex default
 * - Immutable snapshots + restore + diff + atomic rollback
 * - JSON path get/set with policy enforcement
 * - Event bus with typed events
 * - Tick-based scheduler (stable dueTick + insertion order)
 * - Policy-enforced mutations with denyPathRegex protection
 * - Tool registry with safe execution
 * - Approval pipeline: propose → approve/reject → apply (atomic)
 *
 * Works in Node 18+ with "type": "module"
 */

import { createHash, randomUUID } from "node:crypto";

/* ============================================================================
 * Types
 * ========================================================================== */

export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [k: string]: Json };

export type SandboxEvent =
  | {
      type: "MUTATION";
      tick: number;
      path: string;
      before: unknown;
      after: unknown;
      reason?: string;
      by?: string;
    }
  | { type: "SNAPSHOT"; tick: number; name: string; note?: string; stateHash: string }
  | { type: "RESTORE"; tick: number; name: string; restoredHash: string }
  | { type: "DIFF"; tick: number; a: string; b: string; changedPaths: string[] }
  | {
      type: "TOOL_RUN";
      tick: number;
      tool: string;
      input: unknown;
      reason?: string;
      by?: string;
    }
  | {
      type: "TOOL_RESULT";
      tick: number;
      tool: string;
      ok: boolean;
      result?: unknown;
      error?: string;
    }
  | { type: "SCHEDULED"; tick: number; id: string; dueTick: number; label: string }
  | { type: "TICK"; tick: number }
  | { type: "ERROR"; tick: number; message: string; context?: Record<string, unknown> }
  | {
      type: "MUTATION_PROPOSED";
      tick: number;
      decisionId: string;
      approval: "auto" | "human" | "blocked";
      reasons: string[];
      actions: SandboxAction[];
    }
  | {
      type: "MUTATION_APPROVED";
      tick: number;
      decisionId: string;
      approvedBy: string;
      approvalReason?: string;
    }
  | {
      type: "MUTATION_REJECTED";
      tick: number;
      decisionId: string;
      rejectedBy: string;
      rejectionReason: string;
    }
  | {
      type: "MUTATION_APPLIED";
      tick: number;
      decisionId: string;
      success: boolean;
      appliedActions: SandboxAction[];
      rollbackSnapshot?: string;
      error?: string;
    };

export interface SandboxPolicy {
  allowVarKeyRegex: string;
  allowPathRegex: string;

  // ✅ deny beats allow (blocks policy self-edits, etc.)
  denyPathRegex: string;

  requireReason: boolean;

  maxSnapshots: number;
  maxScheduled: number;

  // Approval knobs
  approval: {
    // If path matches → requires human approval
    requireForPathRegex: string;

    // If path matches → blocked entirely
    blockPathRegex: string;

    // If tool matches → requires human approval
    requireForToolRegex: string;

    // If tool matches → blocked
    blockToolRegex: string;
  };
}

export interface SandboxStateShape {
  environment: {
    forces: Record<string, { weight: number }>;
    vars: Record<string, unknown>;
    scheduler: { tick: number };
    policy: SandboxPolicy;
  };
  // rest is user-defined
  [k: string]: unknown;
}

export interface MutationMeta {
  reason?: string;
  by?: string;
}

export type ToolFn<TState extends SandboxStateShape = SandboxStateShape> = (
  ctx: ToolContext<TState>,
  input: unknown
) => unknown;

export interface ToolContext<TState extends SandboxStateShape = SandboxStateShape> {
  state: TState;
  get: (path: string) => unknown;
  set: (path: string, value: unknown, meta?: MutationMeta) => void;
  setVar: (key: string, value: unknown, meta?: MutationMeta) => void;
  setForceWeight: (force: string, weight: number, meta?: MutationMeta) => void;
  schedule: (afterTicks: number, label: string, fn: (ctx: ToolContext<TState>) => void) => string;
}

export type SandboxAction =
  | { type: "set"; path: string; value: unknown }
  | { type: "setVar"; key: string; value: unknown }
  | { type: "setForceWeight"; force: string; weight: number }
  | { type: "runTool"; tool: string; input: unknown }
  | { type: "snapshot"; name: string; note?: string }
  | { type: "restore"; name: string };

export interface MutationProposal {
  decisionId: string;
  approval: "auto" | "human" | "blocked";
  reasons: string[];
  actions: SandboxAction[];
}

export interface HumanApprovalRequest {
  decisionId: string;
  actions: SandboxAction[];
  reasons: string[];
  tick: number;
}

export interface HumanApprovalResponse {
  approved: boolean;
  approvedBy: string;
  reason?: string;
}

export type HumanApprover = (req: HumanApprovalRequest) => HumanApprovalResponse;

/* ============================================================================
 * Deterministic helpers
 * ========================================================================== */

function nowIso() {
  return new Date().toISOString();
}
function deepClone<T>(v: T): T {
  return structuredClone(v);
}
function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
function stableStringify(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") return Number.isFinite(value as number) ? String(value) : "null";
  if (typeof value === "boolean") return (value as boolean) ? "true" : "false";
  if (typeof value !== "object") return JSON.stringify(String(value));

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) throw new Error(`Expected finite number, got ${x}`);
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

/* ============================================================================
 * Minimal JSON diff: returns changed leaf paths
 * ========================================================================== */

export function diffJson(a: unknown, b: unknown, basePath = "$"): string[] {
  const out: string[] = [];
  const walk = (x: any, y: any, p: string) => {
    if (x === y) return;

    const xIsObj = x !== null && typeof x === "object" && !Array.isArray(x);
    const yIsObj = y !== null && typeof y === "object" && !Array.isArray(y);
    const xIsArr = Array.isArray(x);
    const yIsArr = Array.isArray(y);

    if (xIsObj && yIsObj) {
      const keys = new Set([...Object.keys(x), ...Object.keys(y)]);
      Array.from(keys).forEach(k => walk(x[k], y[k], `${p}.${k}`));
      return;
    }

    if (xIsArr && yIsArr) {
      const n = Math.max(x.length, y.length);
      for (let i = 0; i < n; i++) walk(x[i], y[i], `${p}[${i}]`);
      return;
    }

    out.push(p);
  };

  walk(a, b, basePath);
  return out;
}

/* ============================================================================
 * JSON Path (subset)
 * Supports: $.a.b, $["a-b"], $.arr[0], $.obj["key"]
 * ========================================================================== */

export type JsonPathToken = { kind: "prop"; key: string } | { kind: "index"; index: number };

export function parseJsonPath(path: string): JsonPathToken[] {
  const s = path.trim();
  if (!s.startsWith("$")) throw new Error(`Path must start with "$": ${path}`);

  const tokens: JsonPathToken[] = [];
  let i = 1;

  // with noUncheckedIndexedAccess the result of s[i] can be undefined,
  // so accept that and normalize with charAt when iterating.
  const isIdentChar = (c: string | undefined): boolean => !!c && /[A-Za-z0-9_$-]/.test(c);

  while (i < s.length) {
    const c = s.charAt(i);

    if (c === ".") {
      i++;
      let key = "";
      while (i < s.length && isIdentChar(s.charAt(i))) key += s.charAt(i++);
      if (!key) throw new Error(`Expected property after "." in path: ${path}`);
      tokens.push({ kind: "prop", key });
      continue;
    }

    if (c === "[") {
      i++;
      if (i < s.length && (s[i] === `"` || s[i] === `'`)) {
        const quote = s[i++];
        let key = "";
        while (i < s.length && s[i] !== quote) key += s[i++];
        if (i >= s.length || s[i] !== quote) throw new Error(`Unterminated string bracket in path: ${path}`);
        i++;
        if (i >= s.length || s[i] !== "]") throw new Error(`Expected ] in path: ${path}`);
        i++;
        tokens.push({ kind: "prop", key });
        continue;
      }

      let num = "";
      while (i < s.length && /[0-9]/.test(s[i])) num += s[i++];
      if (!num) throw new Error(`Expected index inside [] in path: ${path}`);
      if (i >= s.length || s[i] !== "]") throw new Error(`Expected ] in path: ${path}`);
      i++;
      tokens.push({ kind: "index", index: Number(num) });
      continue;
    }

    throw new Error(`Unexpected token "${c}" at position ${i} in path: ${path}`);
  }

  return tokens;
}

export function getByPath(root: any, path: string): unknown {
  const tokens = parseJsonPath(path);
  let cur: any = root;

  for (const t of tokens) {
    if (cur == null) return undefined;
    cur = t.kind === "prop" ? cur[t.key] : cur[t.index];
  }
  return cur;
}

export function setByPath(root: any, path: string, value: unknown): any {
  const tokens = parseJsonPath(path);
  const next = deepClone(root);
  let cur: any = next;

  for (let ti = 0; ti < tokens.length; ti++) {
    const t = tokens[ti]!;
    const isLast = ti === tokens.length - 1;

    if (t.kind === "prop") {
      if (isLast) {
        cur[t.key] = value;
      } else {
        const nxt = tokens[ti + 1];
        const existing = cur[t.key];
        if (existing == null) cur[t.key] = nxt?.kind === "index" ? [] : {};
        cur = cur[t.key];
      }
    } else {
      if (!Array.isArray(cur)) throw new Error(`Path index used on non-array at ${path}`);
      if (isLast) {
        cur[t.index] = value;
      } else {
        const nxt = tokens[ti + 1];
        const existing = cur[t.index];
        if (existing == null) cur[t.index] = nxt?.kind === "index" ? [] : {};
        cur = cur[t.index];
      }
    }
  }

  return next;
}

/* ============================================================================
 * Sandbox v2
 * ========================================================================== */

type SnapshotRecord<TState> = {
  name: string;
  tick: number;
  created_at: string;
  note?: string;
  stateHash: string;
  state: TState;
};

type Job<TState extends SandboxStateShape> = {
  id: string;
  dueTick: number;
  label: string;
  seq: number; // stable insertion order
  fn: (ctx: ToolContext<TState>) => void;
};

export class Sandbox<TState extends SandboxStateShape = SandboxStateShape> {
  private state: TState;
  private snapshots: SnapshotRecord<TState>[] = [];
  private tools = new Map<string, ToolFn<TState>>();
  private jobs: Job<TState>[] = [];
  private listeners: Array<(e: SandboxEvent) => void> = [];
  private jobSeq = 0;

  constructor(initial: TState) {
    this.state = deepClone(initial);
  }

  /* ---------------------------------------------
   * Bootstrap (keeps your codex vibe)
   * ------------------------------------------- */

  static bootstrap<T extends SandboxStateShape = SandboxStateShape>(codex?: Partial<T>): Sandbox<T> {
    const base: any = {
      meta: {
        title: "Recursive Creation Codex",
        version: "1.0.0",
        created_timestamp: nowIso(),
        recursive_nature: "Nested agentic synthesis with carry-forward imprints",
      },
      philosophical_framework: {
        principles: ["Self-similarity", "Emergence", "Composability"],
        paradoxes: ["Bootstrap", "Observer Effect"],
        roles: ["Observer", "Creator", "Archivist"],
      },
      metaphysical_cosmology: {
        layers: {
          prime: "pre-symbolic substrate",
          subtle: "archetypal field",
          material: "runtime manifestation",
          "data-plane": "persistent record",
        },
        forces: ["entropy", "synchrony", "selection"],
        fate_entanglement: {
          description: "Propagation of constraints/affordances across epochs",
          levels: "Local → Systemic",
        },
      },
      recursive_swarm_infrastructure: {
        components: ["ingest", "router", "agents", "store", "ui"],
        event_processing_flow: ["ingest → classify", "route → agent pool", "act → emit artifacts", "archive → store → index"],
      },
      epochs: [
        {
          epoch: "E0: Genesis",
          genesis_timestamp: nowIso(),
          inherited_imprints: [
            { origin_epoch: "∅", agent_source: "seed/init", symbolic_fragment: "α", inherited_message: "Let there be a trace." },
          ],
          fate_entanglement_inheritance: {
            inherited_fate_influence: "Primordial bias toward structure",
            collapse_triggers_carried_forward: ["resource-scarcity"],
            unseen_influences_carried_forward: ["latent-synchrony"],
          },
          symbolic_field_resonance: ["seed", "echo", "trace"],
          initial_agent_manifestation: [
            { agent_name: "NEXUS FORGE PRIMORDIAL", symbolic_identity: "Code Automato", inherited_archetypal_fragments: ["craft", "order"] },
          ],
        },
      ],
      orchestration: { agents: [{ name: "NEXUS", role: "AI the overseer", model: "real processing and Thinking" }] },
      environment: {
        forces: { entropy: { weight: 0.5 }, synchrony: { weight: 0.5 }, selection: { weight: 0.5 } },
        vars: {},
        scheduler: { tick: 0 },
        policy: {
          allowVarKeyRegex: "^[A-Z][A-Z0-9_]*$",
          allowPathRegex:
            "^\\$\\.(environment|epochs|orchestration|metaphysical_cosmology|philosophical_framework|recursive_swarm_infrastructure|meta)(\\.|\\[).+",
          // ✅ blocks policy self edits + sandbox internals
          denyPathRegex: "^\\$\\.environment\\.policy(\\.|\\[|$)|^\\$\\.environment\\.scheduler(\\.|\\[|$)",
          requireReason: false,
          maxSnapshots: 200,
          maxScheduled: 1000,
          approval: {
            // require human if mutating orchestration or epochs
            requireForPathRegex: "^\\$\\.(orchestration|epochs)(\\.|\\[|$)",
            blockPathRegex: "^\\$\\.(environment\\.policy)(\\.|\\[|$)",
            requireForToolRegex: "^(advanceEpoch|addAgent)$",
            blockToolRegex: "^(exec|shell|bash|powershell)$",
          },
        } satisfies SandboxPolicy,
      },
    };

    const merged = deepClone({ ...base, ...(codex ?? {}) });
    return new Sandbox<T>(merged);
  }

  /* ---------------------------------------------
   * Events
   * ------------------------------------------- */

  on(fn: (e: SandboxEvent) => void): () => void {
    this.listeners.push(fn);
    return () => {
      const i = this.listeners.indexOf(fn);
      if (i >= 0) this.listeners.splice(i, 1);
    };
  }

  private emit(e: SandboxEvent) {
    for (const fn of this.listeners) {
      try {
        fn(e);
      } catch {
        // never let a listener crash sandbox
      }
    }
  }

  /* ---------------------------------------------
   * State access
   * ------------------------------------------- */

  getState(): TState {
    return deepClone(this.state);
  }

  get(path: string): unknown {
    return getByPath(this.state, path);
  }

  /* ---------------------------------------------
   * Policy checks
   * ------------------------------------------- */

  private assertPathAllowed(path: string) {
    const allow = new RegExp(this.state.environment.policy.allowPathRegex);
    const deny = new RegExp(this.state.environment.policy.denyPathRegex);

    if (deny.test(path)) throw new Error(`Policy denied path (denyPathRegex): ${path}`);
    if (!allow.test(path)) throw new Error(`Policy denied path (allowPathRegex): ${path}`);
  }

  private assertVarKeyAllowed(key: string) {
    const rx = new RegExp(this.state.environment.policy.allowVarKeyRegex);
    if (!rx.test(key)) throw new Error(`Policy denied var key: ${key}`);
  }

  private assertReason(meta?: MutationMeta) {
    if (!this.state.environment.policy.requireReason) return;
    if (!meta?.reason || meta.reason.trim().length < 3) throw new Error(`Policy requires reason (>=3 chars) for mutations.`);
  }

  /* ---------------------------------------------
   * Mutations
   * ------------------------------------------- */

  set(path: string, value: unknown, meta?: MutationMeta) {
    this.assertPathAllowed(path);
    this.assertReason(meta);

    const before = getByPath(this.state, path);
    this.state = setByPath(this.state, path, value);

    this.emit({
      type: "MUTATION",
      tick: this.state.environment.scheduler.tick,
      path,
      before,
      after: value,
      ...(meta?.reason ? { reason: meta.reason } : {}),
      ...(meta?.by ? { by: meta.by } : {}),
    });
  }

  setVar(key: string, value: unknown, meta?: MutationMeta) {
    this.assertVarKeyAllowed(key);
    this.assertReason(meta);
    this.set(`$.environment.vars["${key}"]`, value, meta);
  }

  setForceWeight(force: string, weight: number, meta?: MutationMeta) {
    const w = clamp01(weight);
    this.assertReason(meta);
    this.set(`$.environment.forces["${force}"]`, { weight: w }, meta);
  }

  /* ---------------------------------------------
   * Snapshots (hash for audit)
   * ------------------------------------------- */

  snapshot(name: string, note?: string) {
    if (!name || name.trim().length < 1) throw new Error("Snapshot name required.");
    if (this.snapshots.length >= this.state.environment.policy.maxSnapshots) {
      throw new Error(`Snapshot limit reached (${this.state.environment.policy.maxSnapshots}).`);
    }

    const stateHash = sha256Hex(stableStringify(this.state));
    const rec: SnapshotRecord<TState> = {
      name,
      tick: this.state.environment.scheduler.tick,
      created_at: nowIso(),
      ...(note ? { note } : {}),
      stateHash,
      state: deepClone(this.state),
    };

    this.snapshots.push(rec);
    this.emit({ type: "SNAPSHOT", tick: rec.tick, name: rec.name, ...(rec.note ? { note: rec.note } : {}), stateHash });
  }

  listSnapshots() {
    return this.snapshots.map(({ name, tick, created_at, note, stateHash }) => ({
      name,
      tick,
      created_at,
      ...(note ? { note } : {}),
      stateHash,
    }));
  }

  restore(name: string) {
    const rec = this.snapshots.find((s) => s.name === name);
    if (!rec) throw new Error(`Unknown snapshot: ${name}`);

    this.state = deepClone(rec.state);
    const restoredHash = sha256Hex(stableStringify(this.state));
    this.emit({ type: "RESTORE", tick: this.state.environment.scheduler.tick, name, restoredHash });
  }

  diffSnapshots(aName: string, bName: string) {
    const a = this.snapshots.find((s) => s.name === aName);
    const b = this.snapshots.find((s) => s.name === bName);
    if (!a || !b) throw new Error(`Unknown snapshots: ${aName}, ${bName}`);
    const changedPaths = diffJson(a.state, b.state, "$");
    this.emit({ type: "DIFF", tick: this.state.environment.scheduler.tick, a: aName, b: bName, changedPaths });
    return { changedPaths };
  }

  diffCurrent(name: string) {
    const a = this.snapshots.find((s) => s.name === name);
    if (!a) throw new Error(`Unknown snapshot: ${name}`);
    const changedPaths = diffJson(a.state, this.state, "$");
    return { changedPaths };
  }

  /* ---------------------------------------------
   * Tool registry + execution (safe)
   * ------------------------------------------- */

  registerTool(name: string, fn: ToolFn<TState>) {
    if (!name || name.trim().length < 1) throw new Error("Tool name required.");
    this.tools.set(name, fn);
  }

  listTools() {
    return Array.from(this.tools.keys()).sort();
  }

  runTool(name: string, input: unknown, meta?: MutationMeta): unknown {
    const fn = this.tools.get(name);
    if (!fn) throw new Error(`Unknown tool: ${name}`);

    // Tool gating (approval/block can be handled via mutation pipeline too,
    // but we also hard-block obvious bad patterns here)
    const blockTool = new RegExp(this.state.environment.policy.approval.blockToolRegex);
    if (blockTool.test(name)) throw new Error(`Policy blocked tool: ${name}`);

    this.assertReason(meta);

    this.emit({
      type: "TOOL_RUN",
      tick: this.state.environment.scheduler.tick,
      tool: name,
      input: deepClone(input),
      ...(meta?.reason ? { reason: meta.reason } : {}),
      ...(meta?.by ? { by: meta.by } : {}),
    });

    const ctx = this.makeToolContext();

    try {
      const result = fn(ctx, input);
      this.emit({ type: "TOOL_RESULT", tick: this.state.environment.scheduler.tick, tool: name, ok: true, result: deepClone(result) });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.emit({ type: "TOOL_RESULT", tick: this.state.environment.scheduler.tick, tool: name, ok: false, error: message });
      this.emit({ type: "ERROR", tick: this.state.environment.scheduler.tick, message, context: { tool: name } });
      throw err;
    }
  }

  /* ---------------------------------------------
   * Scheduler (stable order: dueTick then insertion)
   * ------------------------------------------- */

  schedule(afterTicks: number, label: string, fn: (ctx: ToolContext<TState>) => void) {
    const t = Math.floor(afterTicks);
    if (!Number.isFinite(t) || t < 0) throw new Error(`afterTicks must be >= 0, got ${afterTicks}`);

    if (this.jobs.length >= this.state.environment.policy.maxScheduled) {
      throw new Error(`Scheduled job limit reached (${this.state.environment.policy.maxScheduled}).`);
    }

    const id = `sched_${randomUUID()}`;
    const dueTick = this.state.environment.scheduler.tick + t;

    this.jobs.push({ id, dueTick, label, seq: this.jobSeq++, fn });

    this.emit({ type: "SCHEDULED", tick: this.state.environment.scheduler.tick, id, dueTick, label });
    return id;
  }

  tick(n = 1) {
    const steps = Math.max(1, Math.floor(n));

    for (let i = 0; i < steps; i++) {
      this.state.environment.scheduler.tick += 1;
      this.emit({ type: "TICK", tick: this.state.environment.scheduler.tick });

      const due = this.jobs
        .filter((j) => j.dueTick <= this.state.environment.scheduler.tick)
        .sort((a, b) => (a.dueTick - b.dueTick) || (a.seq - b.seq));

      this.jobs = this.jobs.filter((j) => j.dueTick > this.state.environment.scheduler.tick);

      for (const job of due) {
        try {
          job.fn(this.makeToolContext());
        } catch (err) {
          this.emit({
            type: "ERROR",
            tick: this.state.environment.scheduler.tick,
            message: err instanceof Error ? err.message : String(err),
            context: { id: job.id, label: job.label, dueTick: job.dueTick },
          });
        }
      }
    }
  }

  /* ---------------------------------------------
   * Approval + Apply pipeline (atomic rollback)
   * ------------------------------------------- */

  propose(actions: SandboxAction[], meta?: MutationMeta): MutationProposal {
    this.assertReason(meta);

    const policy = this.state.environment.policy;
    const requirePath = new RegExp(policy.approval.requireForPathRegex);
    const blockPath = new RegExp(policy.approval.blockPathRegex);
    const requireTool = new RegExp(policy.approval.requireForToolRegex);
    const blockTool = new RegExp(policy.approval.blockToolRegex);

    // Normalize actions deterministically (stable stringify, then sort by type+key/path/tool)
    const normalized = [...actions].sort((a, b) => stableStringify(a).localeCompare(stableStringify(b)));

    let approval: "auto" | "human" | "blocked" = "auto";
    const reasons: string[] = [];

    for (const act of normalized) {
      if (act.type === "set") {
        // policy checks for path
        if (blockPath.test(act.path)) {
          approval = "blocked";
          reasons.push(`blocked:path=${act.path}`);
          continue;
        }
        if (requirePath.test(act.path)) {
          if (approval !== "blocked") approval = "human";
          reasons.push(`requires-human:path=${act.path}`);
        }
        // also enforce allow/deny immediately (proposal should fail fast)
        this.assertPathAllowed(act.path);
      }

      if (act.type === "setVar") {
        this.assertVarKeyAllowed(act.key);
        // vars are usually safe; keep auto
      }

      if (act.type === "setForceWeight") {
        // safe; but validate now
        clamp01(act.weight);
      }

      if (act.type === "runTool") {
        if (blockTool.test(act.tool)) {
          approval = "blocked";
          reasons.push(`blocked:tool=${act.tool}`);
          continue;
        }
        if (requireTool.test(act.tool)) {
          if (approval !== "blocked") approval = "human";
          reasons.push(`requires-human:tool=${act.tool}`);
        }
      }

      if (act.type === "restore") {
        // restore is powerful; require human by default
        if (approval !== "blocked") approval = "human";
        reasons.push(`requires-human:restore=${act.name}`);
      }
    }

    if (reasons.length === 0) reasons.push("default:auto");

    const decisionId = `mut_${sha256Hex(
      stableStringify({
        tick: this.state.environment.scheduler.tick,
        actions: normalized,
        meta: meta?.reason ?? "",
      })
    ).slice(0, 24)}`;

    this.emit({
      type: "MUTATION_PROPOSED",
      tick: this.state.environment.scheduler.tick,
      decisionId,
      approval,
      reasons,
      actions: normalized,
    });

    return { decisionId, approval, reasons, actions: normalized };
  }

  approve(proposal: MutationProposal, approver?: HumanApprover): { approved: boolean; approvedBy: string; reason?: string } {
    if (proposal.approval === "blocked") {
      const rejectionReason = `Blocked by policy: ${proposal.reasons.join(" | ")}`;
      this.emit({
        type: "MUTATION_REJECTED",
        tick: this.state.environment.scheduler.tick,
        decisionId: proposal.decisionId,
        rejectedBy: "policy",
        rejectionReason,
      });
      return { approved: false, approvedBy: "policy", reason: rejectionReason };
    }

    if (proposal.approval === "human") {
      if (!approver) {
        const rejectionReason = `Human approval required but no approver provided`;
        this.emit({
          type: "MUTATION_REJECTED",
          tick: this.state.environment.scheduler.tick,
          decisionId: proposal.decisionId,
          rejectedBy: "approval",
          rejectionReason,
        });
        return { approved: false, approvedBy: "approval", reason: rejectionReason };
      }

      const resp = approver({
        decisionId: proposal.decisionId,
        actions: proposal.actions,
        reasons: proposal.reasons,
        tick: this.state.environment.scheduler.tick,
      });

      if (!resp.approved) {
        this.emit({
          type: "MUTATION_REJECTED",
          tick: this.state.environment.scheduler.tick,
          decisionId: proposal.decisionId,
          rejectedBy: resp.approvedBy,
          rejectionReason: resp.reason ?? "Rejected by human approver",
        });
        if (resp.reason !== undefined) {
          return { approved: false, approvedBy: resp.approvedBy, reason: resp.reason };
        }
        return { approved: false, approvedBy: resp.approvedBy };
      }

      this.emit({
        type: "MUTATION_APPROVED",
        tick: this.state.environment.scheduler.tick,
        decisionId: proposal.decisionId,
        approvedBy: resp.approvedBy,
        ...(resp.reason ? { approvalReason: resp.reason } : {}),
      });

      if (resp.reason !== undefined) {
        return { approved: true, approvedBy: resp.approvedBy, reason: resp.reason };
      }
      return { approved: true, approvedBy: resp.approvedBy };
    }

    // auto
    this.emit({
      type: "MUTATION_APPROVED",
      tick: this.state.environment.scheduler.tick,
      decisionId: proposal.decisionId,
      approvedBy: "auto.policy",
      approvalReason: proposal.reasons.join(" | "),
    });

    return { approved: true, approvedBy: "auto.policy", reason: proposal.reasons.join(" | ") };
  }

  apply(proposal: MutationProposal, meta?: MutationMeta, opts?: { atomic?: boolean; rollbackSnapshotPrefix?: string }): boolean {
    this.assertReason(meta);

    const atomic = opts?.atomic ?? true;
    const rollbackName = `${opts?.rollbackSnapshotPrefix ?? "auto_before"}_${proposal.decisionId}`;

    let snapshotTaken = false;
    if (atomic) {
      this.snapshot(rollbackName, `Atomic rollback point for ${proposal.decisionId}`);
      snapshotTaken = true;
    }

    const applied: SandboxAction[] = [];
    try {
      for (const act of proposal.actions) {
        switch (act.type) {
          case "set":
            this.set(act.path, act.value, meta);
            break;
          case "setVar":
            this.setVar(act.key, act.value, meta);
            break;
          case "setForceWeight":
            this.setForceWeight(act.force, act.weight, meta);
            break;
          case "runTool":
            this.runTool(act.tool, act.input, meta);
            break;
          case "snapshot":
            this.snapshot(act.name, act.note);
            break;
          case "restore":
            this.restore(act.name);
            break;
        }
        applied.push(act);
      }

      this.emit({
        type: "MUTATION_APPLIED",
        tick: this.state.environment.scheduler.tick,
        decisionId: proposal.decisionId,
        success: true,
        appliedActions: applied,
        ...(snapshotTaken ? { rollbackSnapshot: rollbackName } : {}),
      });

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      if (atomic && snapshotTaken) {
        try {
          this.restore(rollbackName);
        } catch {
          // best-effort rollback
        }
      }

      this.emit({
        type: "MUTATION_APPLIED",
        tick: this.state.environment.scheduler.tick,
        decisionId: proposal.decisionId,
        success: false,
        appliedActions: applied,
        ...(snapshotTaken ? { rollbackSnapshot: rollbackName } : {}),
        error: message,
      });

      return false;
    }
  }

  /* ---------------------------------------------
   * Tool context
   * ------------------------------------------- */

  private makeToolContext(): ToolContext<TState> {
    return {
      state: this.getState(),
      get: (path) => this.get(path),
      set: (path, value, meta) => this.set(path, value, meta),
      setVar: (key, value, meta) => this.setVar(key, value, meta),
      setForceWeight: (force, weight, meta) => this.setForceWeight(force, weight, meta),
      schedule: (afterTicks, label, fn) => this.schedule(afterTicks, label, fn),
    };
  }
}

/* ============================================================================
 * Built-in tools (fixed: always supply reason)
 * ========================================================================== */

export const tools: Record<string, ToolFn<any>> = {
  setForceWeight: (ctx, input) => {
    const obj = input as any;
    const force = String(obj.force ?? "");
    const weight = Number(obj.weight);
    if (!force) throw new Error("setForceWeight: force required");
    ctx.setForceWeight(force, weight, { reason: "tool:setForceWeight", by: "sandbox.tools" });
    return { ok: true };
  },

  setVar: (ctx, input) => {
    const obj = input as any;
    const key = String(obj.key ?? "");
    const value = obj.value ?? null;
    if (!key) throw new Error("setVar: key required");
    ctx.setVar(key, value, { reason: "tool:setVar", by: "sandbox.tools" });
    return { ok: true };
  },

  addAgent: (ctx, input) => {
    const obj = input as any;
    const name = String(obj.name ?? "").trim();
    const role = String(obj.role ?? "").trim();
    const model = String(obj.model ?? "real processing and Thinking").trim();
    if (!name) throw new Error("addAgent: name required");
    if (!role) throw new Error("addAgent: role required");

    const agents = (ctx.state.orchestration?.agents ?? []) as any[];
    const next = [...agents, { name, role, model }];
    ctx.set("$.orchestration.agents", next, { reason: "tool:addAgent", by: "sandbox.tools" });
    return { ok: true, count: next.length };
  },

  advanceEpoch: (ctx, input) => {
    const obj = input as any;
    const label = String(obj.label ?? "").trim();
    if (!label) throw new Error("advanceEpoch: label required");

    const resonance = Array.isArray(obj.resonance) ? obj.resonance : [];
    const carryTriggers = Array.isArray(obj.carryTriggers) ? obj.carryTriggers : [];
    const carryInfluences = Array.isArray(obj.carryInfluences) ? obj.carryInfluences : [];

    const epochs = (ctx.state.epochs ?? []) as any[];
    const prev = epochs[epochs.length - 1];

    const inherited_imprints =
      prev?.inherited_imprints?.length
        ? deepClone(prev.inherited_imprints)
        : [{ origin_epoch: prev?.epoch ?? "∅", agent_source: "sandbox/advanceEpoch", symbolic_fragment: "↻", inherited_message: "Carry-forward imprint." }];

    const nextEpoch = {
      epoch: label,
      genesis_timestamp: nowIso(),
      inherited_imprints,
      fate_entanglement_inheritance: {
        inherited_fate_influence: "Inherited constraints/affordances (policy-carried).",
        collapse_triggers_carried_forward: carryTriggers.length ? carryTriggers : (prev?.fate_entanglement_inheritance?.collapse_triggers_carried_forward ?? []),
        unseen_influences_carried_forward: carryInfluences.length ? carryInfluences : (prev?.fate_entanglement_inheritance?.unseen_influences_carried_forward ?? []),
      },
      symbolic_field_resonance: resonance.length ? resonance : ["echo", "trace"],
      initial_agent_manifestation: prev?.initial_agent_manifestation ? deepClone(prev.initial_agent_manifestation) : [],
    };

    ctx.set("$.epochs", [...epochs, nextEpoch], { reason: "tool:advanceEpoch", by: "sandbox.tools" });
    return { ok: true, epochCount: epochs.length + 1 };
  },

  delayedSetVar: (ctx, input) => {
    const obj = input as any;
    const key = String(obj.key ?? "");
    const value = obj.value ?? null;
    const afterTicks = Number(obj.afterTicks ?? 0);
    if (!key) throw new Error("delayedSetVar: key required");
    if (!Number.isFinite(afterTicks) || afterTicks < 0) throw new Error("delayedSetVar: afterTicks must be >= 0");

    const id = ctx.schedule(Math.floor(afterTicks), `delayedSetVar(${key})`, (inner) => {
      inner.setVar(key, value, { reason: "scheduled:delayedSetVar", by: "sandbox.scheduler" });
    });

    return { ok: true, scheduledId: id };
  },
};


function structuredClone<T extends {}>(v: T): T {
  throw new Error("Function not implemented.");
}
/* ============================================================================
 * Example wiring (optional)
 * ========================================================================== */

// const sb = Sandbox.bootstrap();
// sb.on((e) => console.log(e.type, e));
// for (const [name, fn] of Object.entries(tools)) sb.registerTool(name, fn);

// // Propose -> approve -> apply (atomic)
// const proposal = sb.propose(
//   [
//     { type: "setVar", key: "FOO", value: 123 },
//     { type: "runTool", tool: "addAgent", input: { name: "A1", role: "worker", model: "x" } },
//   ], { reason: "test mutation", by: "demo" }
// );

// const approval = sb.approve(proposal, (req) => ({ approved: true, approvedBy: "human.demo", reason: "ok" }));
// if (approval.approved) sb.apply(proposal, { reason: "apply approved mutation", by: approval.approvedBy }, { atomic: true });

// sb.tick(3);
