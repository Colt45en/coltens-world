/**
 * Example: How to run the mutation pipeline
 * This shows how to integrate the pipeline into your agent loop
 */

import { runMutationPipeline } from "./mutationPipeline.runtime.js";
import { createDefaultApprovalPolicy } from "./mutationPipeline.core.js";
import { appliers } from "./appliers.js";
import { createEnvelopeFactory , createRepresentationEnvelopeFactory } from "../representationEvents.js";

// Create envelope factory
const makeEnvelope = createEnvelopeFactory({
  source: "worker.representation-agent",
  clockMs: () => Date.now(),
});

const makeRepEnvelope = createRepresentationEnvelopeFactory(makeEnvelope);

// Example mutation decision from your policy engine
const exampleDecision = {
  actions: [
    {
      type: "lowerLearningRate",
      params: { factor: 0.5 },
      urgency: "high",
      reason: "Gradient explosion detected",
    },
    {
      type: "clipGradients",
      params: { maxNorm: 1.0 },
      urgency: "medium",
      reason: "Prevent gradient explosion",
    },
  ],
  confidence: 0.85,
  triggeredBy: ["gateValidBlameMagnitude", "gateDirectionConsistency"],
  trace: "batch_123: loss increased 15%, direction consistency failed",
};

const ctx = {
  traceId: "trace_abcdef1234",
  spanId: "span_abcdef1234",
  source: "worker.representation-agent",
  makeEnvelope: makeRepEnvelope,
  emit: (env: { type: any; id: any; data: any; }) => console.log("EVENT:", env.type, env.id, env.data),
};

const result = runMutationPipeline(
  {
    batchId: "batch_12345678",
    decision: exampleDecision,
    appliers,
    approvalPolicy: createDefaultApprovalPolicy(),
    humanApprover: (req) => {
      // you can plug UI/human flow here
      // for now: approve everything
      return { approved: true, approvedBy: "human.override", reason: "Approved for test" };
    },
  },
  ctx
);

console.log("Pipeline result:", result);
