import type { ClarifyPlan, MemoryPlan, NucleusPlan, NucleusQuery, RetrievePlan, ToolPlan } from "@world-engine/nucleus-contracts";

export function buildPlan(intent: NucleusPlan["intent"] | "clarify", q: NucleusQuery): NucleusPlan {
  const text = q.query_text.trim();

  if (intent === "retrieve") {
    const plan: RetrievePlan = {
      intent: "retrieve",
      top_k: 6,
      query: text,
      rationale: "Retrieve top evidence chunks from lexicon/docs/code to answer with citations"
    };
    return plan;
  }

  if (intent === "tool") {
    const plan: ToolPlan = {
      intent: "tool",
      tool_id: "unknown",
      args: {},
      rationale: "User requested an action; match an allowlisted tool and run with validated args",
      dry_run: true
    };
    return plan;
  }

  if (intent === "memory") {
    const plan: MemoryPlan = {
      intent: "memory",
      proposed: {
        version: "nucleus.memory_item.v1",
        memory_id: "pending" as MemoryPlan["proposed"]["memory_id"],
        kind: "decision",
        statement: text,
        evidence_refs: [],
        confidence: 0.6,
        created_at_utc: q.timestamp_utc
      },
      rationale: "Propose a memory item; requires explicit approval before it is committed"
    };
    return plan;
  }

  const plan: ClarifyPlan = {
    intent: "clarify",
    question: "I can do this a few ways — what do you mean specifically?",
    options: [
      "Retrieve info with citations",
      "Run an allowlisted tool (build/test/export)",
      "Store a decision/fact into memory (requires approval)"
    ],
    rationale: "Ambiguity gate to avoid incorrect action"
  };
  return plan;
}
