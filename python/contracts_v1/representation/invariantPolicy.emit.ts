/**
 * Integration adapter: emits Representation events
 * This is where Date/clock/IDs are allowed.
 */

import type { PacketDecision, BatchDecision, MutationDecision, RepresentationEvidencePacket } from "./invariantPolicy.core";
import type { RepresentationEnvelope } from "../representationEvents.js"; // your schema output
import { makeRepresentationEnvelope } from "../representationEvents.js";

export interface AgentContext {
  traceId: string;
  spanId: string;
  source: string; // "worker.representation-agent"
  parentSpanId?: string;
  emit: (env: RepresentationEnvelope) => void;
}

export function emitPacketDecision(
  packet: RepresentationEvidencePacket,
  decision: PacketDecision,
  ctx: AgentContext
) {
  const env = makeRepresentationEnvelope({
    id: `msg_${decision.packetId}_${Date.now()}`,
    ts: new Date().toISOString(),
    tsMs: Date.now(),
    type: "rep.gate.packet.validated",
    source: ctx.source,
    traceId: ctx.traceId,
    spanId: ctx.spanId,
    parentSpanId: ctx.parentSpanId,
    data: {
      packetId: decision.packetId,
      results: decision.packetValidation,
      packet, // full replay payload
    },
  });

  ctx.emit(env);

  if (decision.mutations.actions.length > 0) {
    emitMutationProposed(decision.packetId, decision.mutations, ctx);
  }
}

export function emitBatchDecision(
  decision: BatchDecision,
  packets: unknown, // optional replay window if you want
  ctx: AgentContext
) {
  const batchEnv = makeRepresentationEnvelope({
    id: `msg_batch_${decision.batchId}_${Date.now()}`,
    ts: new Date().toISOString(),
    tsMs: Date.now(),
    type: "rep.gate.batch.validated",
    source: ctx.source,
    traceId: ctx.traceId,
    spanId: ctx.spanId,
    parentSpanId: ctx.parentSpanId,
    data: {
      batchId: decision.batchId,
      packetCount: decision.packetCount,
      batchValidation: decision.batchValidation,
      unitResults: decision.unitValidations,
      windowSize: decision.windowSize,
    },
  });

  ctx.emit(batchEnv);

  if (decision.mutations.actions.length > 0) {
    emitMutationProposed(decision.batchId, decision.mutations, ctx);
  }
}

function emitMutationProposed(batchId: string, decision: MutationDecision, ctx: AgentContext) {
  const env = makeRepresentationEnvelope({
    id: `msg_mut_${batchId}_proposed_${Date.now()}`,
    ts: new Date().toISOString(),
    tsMs: Date.now(),
    type: "agent.mutation.proposed",
    source: ctx.source,
    traceId: ctx.traceId,
    spanId: ctx.spanId,
    parentSpanId: ctx.parentSpanId,
    data: {
      batchId,
      decision,
      proposedBy: "policy-engine.v1",
    },
  });

  ctx.emit(env);
}
