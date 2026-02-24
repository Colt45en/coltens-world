/**
 * mutationPipeline.runtime.ts
 * Runtime: approval + apply + event emission
 *
 * Side effects live here:
 * - calling appliers (mutations)
 * - emitting bus envelopes
 * - using clock for ts/tsMs
 */

import type { RepresentationEnvelope } from "../representationEvents.js";
import { appliers } from "./appliers.js";

import {
  type MutationAction,
  type MutationDecision,
  type ApprovalPolicy,
  createDefaultApprovalPolicy,
  buildApplyPlan,
} from "./mutationPipeline.core.js";

export interface ApplyContext {
  traceId: string;
  spanId: string;
  batchId: string;
}

export interface ApplyActionResult {
  ok: boolean;
  info?: Record<string, unknown>;
  // rollback actions (deterministic list) to run if later failure happens
  rollback?: MutationAction | MutationAction[];
}

export type ActionApplier = (action: MutationAction, ctx: ApplyContext) => ApplyActionResult;

export interface ApplierRegistry {
  // key: action.type
  [actionType: string]: ActionApplier;
}

export interface HumanApprovalRequest {
  batchId: string;
  decision: MutationDecision;
  decisionId: string;
  summary: string;
  actions: MutationAction[];
  reasons: string[];
  riskScore: number;
}

export interface HumanApprovalResponse {
  approved: boolean;
  approvedBy: string;
  reason?: string;
}

export type HumanApprover = (req: HumanApprovalRequest) => HumanApprovalResponse;

export interface MutationPipelineContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  source: string; // e.g. "worker.representation-agent"
  makeEnvelope: (type: string, data: any, span: any) => RepresentationEnvelope;
  emit: (env: RepresentationEnvelope) => void;
  clockMs?: () => number; // injectable
}

function nowMs(clockMs?: () => number): number {
  return (clockMs ?? (() => Date.now()))();
}

function emitProposed(ctx: MutationPipelineContext, batchId: string, decision: MutationDecision) {
  const span = { traceId: ctx.traceId, spanId: ctx.spanId, parentSpanId: ctx.parentSpanId };
  ctx.emit(ctx.makeEnvelope("agent.mutation.proposed", { batchId, decision, proposedBy: "policy-engine.v1" }, span));
}

function emitApproved(
  ctx: MutationPipelineContext,
  batchId: string,
  decision: MutationDecision,
  approvedBy: string,
  approvalReason?: string
) {
  const span = { traceId: ctx.traceId, spanId: ctx.spanId, parentSpanId: ctx.parentSpanId };
  ctx.emit(ctx.makeEnvelope("agent.mutation.approved", { batchId, decision, approvedBy, approvalReason }, span));
}

function emitRejected(
  ctx: MutationPipelineContext,
  batchId: string,
  decision: MutationDecision,
  rejectedBy: string,
  rejectionReason: string
) {
  const span = { traceId: ctx.traceId, spanId: ctx.spanId, parentSpanId: ctx.parentSpanId };
  ctx.emit(ctx.makeEnvelope("agent.mutation.rejected", { batchId, decision, rejectedBy, rejectionReason }, span));
}

function emitApplied(
  ctx: MutationPipelineContext,
  batchId: string,
  decision: MutationDecision,
  appliedActions: MutationAction[],
  success: boolean,
  rollbackInfo?: Record<string, unknown>
) {
  const span = { traceId: ctx.traceId, spanId: ctx.spanId, parentSpanId: ctx.parentSpanId };
  ctx.emit(ctx.makeEnvelope("agent.mutation.applied", {
    batchId,
    decision,
    appliedActions,
    success,
    appliedAt: nowMs(ctx.clockMs),
    rollbackInfo,
  }, span));
}

function toArray<T>(v: T | T[] | undefined): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

export interface RunMutationPipelineArgs {
  batchId: string;
  decision: MutationDecision;
  appliers: ApplierRegistry;

  // Approval policy: if omitted, default is used
  approvalPolicy?: ApprovalPolicy;

  // Optional human approver callback (only needed when requirement="human")
  humanApprover?: HumanApprover;
}

export interface RunMutationPipelineResult {
  decisionId: string;
  approved: boolean;
  applied: boolean;
  success: boolean;
  appliedActions: MutationAction[];
  rollbackInfo?: Record<string, unknown>;
}

/**
 * Full pipeline:
 * proposed → approved/rejected → applied
 */
export function runMutationPipeline(
  args: RunMutationPipelineArgs,
  ctx: MutationPipelineContext
): RunMutationPipelineResult {
  const policy = args.approvalPolicy ?? createDefaultApprovalPolicy();
  const plan = buildApplyPlan(args.decision, policy);

  // Always emit proposed if there are actions (you can choose to emit even when none)
  emitProposed(ctx, args.batchId, args.decision);

  if (plan.actions.length === 0) {
    // nothing to do, auto-approved "no-op"
    emitApproved(ctx, args.batchId, args.decision, "auto.noop", "No actions to apply");
    emitApplied(ctx, args.batchId, args.decision, [], true, { note: "noop" });
    return {
      decisionId: plan.decisionId,
      approved: true,
      applied: true,
      success: true,
      appliedActions: [],
      rollbackInfo: { note: "noop" },
    };
  }

  // Approval step
  if (plan.approval.requirement === "blocked") {
    emitRejected(
      ctx,
      args.batchId,
      args.decision,
      "approval-policy",
      `Blocked by policy. Reasons: ${plan.approval.reasons.join(" | ")}`
    );
    return {
      decisionId: plan.decisionId,
      approved: false,
      applied: false,
      success: false,
      appliedActions: [],
      rollbackInfo: { blockedReasons: plan.approval.reasons, riskScore: plan.approval.riskScore },
    };
  }

  if (plan.approval.requirement === "human") {
    if (!args.humanApprover) {
      emitRejected(
        ctx,
        args.batchId,
        args.decision,
        "approval-policy",
        `Human approval required but no humanApprover provided. Reasons: ${plan.approval.reasons.join(" | ")}`
      );
      return {
        decisionId: plan.decisionId,
        approved: false,
        applied: false,
        success: false,
        appliedActions: [],
        rollbackInfo: { needHuman: true, reasons: plan.approval.reasons, riskScore: plan.approval.riskScore },
      };
    }

    const resp = args.humanApprover({
      batchId: args.batchId,
      decision: args.decision,
      decisionId: plan.decisionId,
      summary: plan.summary,
      actions: plan.actions,
      reasons: plan.approval.reasons,
      riskScore: plan.approval.riskScore,
    });

    if (!resp.approved) {
      emitRejected(
        ctx,
        args.batchId,
        args.decision,
        resp.approvedBy || "human",
        resp.reason || "Rejected by human approver"
      );
      return {
        decisionId: plan.decisionId,
        approved: false,
        applied: false,
        success: false,
        appliedActions: [],
        rollbackInfo: { rejectedBy: resp.approvedBy, reason: resp.reason, reasons: plan.approval.reasons },
      };
    }

    emitApproved(ctx, args.batchId, args.decision, resp.approvedBy, resp.reason);
  } else {
    // auto
    emitApproved(ctx, args.batchId, args.decision, "auto.policy", plan.approval.reasons.join(" | "));
  }

  // Apply step
  const applyCtx: ApplyContext = { traceId: ctx.traceId, spanId: ctx.spanId, batchId: args.batchId };
  const appliedActions: MutationAction[] = [];
  const rollbackStack: MutationAction[] = [];
  const perAction: Array<{ action: MutationAction; ok: boolean; info?: Record<string, unknown> }> = [];

  for (const action of plan.actions) {
    const applier = args.appliers[action.type];
    if (!applier) {
      const rollbackInfo = {
        error: `No applier registered for action.type=${action.type}`,
        appliedActions,
        perAction,
      };
      // Attempt rollback
      const rolledBack = runRollback(rollbackStack, args.appliers, applyCtx);
      emitApplied(ctx, args.batchId, args.decision, appliedActions, false, { ...rollbackInfo, rolledBack });
      return {
        decisionId: plan.decisionId,
        approved: true,
        applied: true,
        success: false,
        appliedActions,
        rollbackInfo: { ...rollbackInfo, rolledBack },
      };
    }

    const result = applier(action, applyCtx);
    perAction.push(result.info !== undefined ? { action, ok: result.ok, info: result.info } : { action, ok: result.ok });

    if (!result.ok) {
      const rollbackInfo = {
        failedAction: action,
        appliedActions,
        perAction,
      };
      const rolledBack = runRollback(rollbackStack, args.appliers, applyCtx);
      emitApplied(ctx, args.batchId, args.decision, appliedActions, false, { ...rollbackInfo, rolledBack });
      return {
        decisionId: plan.decisionId,
        approved: true,
        applied: true,
        success: false,
        appliedActions,
        rollbackInfo: { ...rollbackInfo, rolledBack },
      };
    }

    appliedActions.push(action);
    // add rollback actions (if any) for later failure
    const rollbackActions = toArray(result.rollback);
    // rollback should run reverse chronological: push now, pop later
    for (const ra of rollbackActions) rollbackStack.push(ra);
  }

  // Success
  emitApplied(ctx, args.batchId, args.decision, appliedActions, true, { perAction });
  return {
    decisionId: plan.decisionId,
    approved: true,
    applied: true,
    success: true,
    appliedActions,
    rollbackInfo: { perAction },
  };
}

function runRollback(stack: MutationAction[], appliers: ApplierRegistry, ctx: ApplyContext) {
  const executed: MutationAction[] = [];
  const failures: Array<{ action: MutationAction; error: string }> = [];

  // reverse order rollback
  for (let i = stack.length - 1; i >= 0; i--) {
    const action = stack[i];
    if (!action) continue;
    const applier = appliers[action.type];
    if (!applier) {
      failures.push({ action, error: `No applier for rollback action.type=${action.type}` });
      continue;
    }
    try {
      const r = applier(action, ctx);
      if (!r.ok) failures.push({ action, error: "Rollback applier returned ok=false" });
      else executed.push(action);
    } catch (e: any) {
      failures.push({ action, error: String(e?.message ?? e) });
    }
  }

  return { executed, failures };
}
