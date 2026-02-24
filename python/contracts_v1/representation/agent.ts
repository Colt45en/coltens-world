/**
 * Agent Decision System (LEGACY COMPATIBILITY)
 *
 * This file provides backward compatibility while migrating to the new pure core + emit adapter architecture.
 * New code should use invariantPolicy.core.ts and invariantPolicy.emit.ts directly.
 */

// Re-export the new pure core
// ============================================================================
// LEGACY COMPATIBILITY (will be removed)
// ============================================================================

import {
  createDefaultInvariantRegistry,
  createDefaultPolicyEngine,
  decidePacket,
  decideBatch,
  type InvariantRegistry,
  type PolicyEngine,
  type RepresentationEvidencePacket,
  type PacketDecision,
  type BatchDecision,
} from "./invariantPolicy.core.js";

import {
  emitPacketDecision,
  emitBatchDecision,
  type AgentContext,
} from "./invariantPolicy.emit.js";

import type { GateResult, GateResults } from "./gates.js";
import type { RepresentationEnvelope } from "../representationEvents.js";

export * from "./invariantPolicy.core";

// Re-export the emit adapter
export * from "./invariantPolicy.emit";

// Legacy interface (deprecated)
export interface AgentDecision {
  packetValidation: GateResults;
  batchValidation?: GateResult;
  mutations: import("./invariantPolicy.core.js").MutationDecision;
  shouldIntervene: boolean;
}

// Legacy interface (deprecated)
export interface EventEmitter {
  (envelope: RepresentationEnvelope): void;
}

// Legacy interface (deprecated)
export interface AgentContextLegacy {
  traceId: string;
  spanId: string;
  batchId?: string;
  emit?: EventEmitter;
}

/**
 * @deprecated Use decidePacket + emitPacketDecision instead
 */
export function decideAgentAction(
  packet: RepresentationEvidencePacket,
  registry: InvariantRegistry,
  policy: PolicyEngine,
  context?: AgentContextLegacy
): AgentDecision {
  const decision = decidePacket(packet, registry, policy);

  // Emit if context provided (legacy behavior)
  if (context?.emit) {
    emitPacketDecision(packet, decision, {
      traceId: context.traceId,
      spanId: context.spanId,
      source: "worker.representation-agent",
      emit: context.emit,
    });
  }

  return {
    packetValidation: decision.packetValidation,
    mutations: decision.mutations,
    shouldIntervene: decision.shouldIntervene,
  };
}

/**
 * @deprecated Use decideBatch + emitBatchDecision instead
 */
export function decideAgentActionBatch(
  packets: RepresentationEvidencePacket[],
  registry: InvariantRegistry,
  policy: PolicyEngine,
  context?: AgentContextLegacy
): AgentDecision & { batchValidation: GateResult; unitValidations: GateResults[] } {
  const batchId = context?.batchId || `batch-${Date.now()}`;
  const decision = decideBatch(batchId, packets, registry, policy, packets.length);

  // Emit if context provided (legacy behavior)
  if (context?.emit) {
    emitBatchDecision(decision, packets, {
      traceId: context.traceId,
      spanId: context.spanId,
      source: "worker.representation-agent",
      emit: context.emit,
    });
  }

  return {
    packetValidation: decision.unitValidations[decision.unitValidations.length - 1] || {},
    batchValidation: decision.batchValidation,
    unitValidations: decision.unitValidations,
    mutations: decision.mutations,
    shouldIntervene: decision.shouldIntervene,
  };
}
