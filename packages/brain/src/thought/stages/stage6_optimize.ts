import type { KnowledgeArtifact, ThoughtState } from "../thoughtTypes";
import { KnowledgeArtifactSchema } from "../thoughtTypes";

function stableId(prefix: string): string {
    const ts = new Date().toISOString().replace(/[-:.TZ]/g, "");
    return `${prefix}_${ts}`;
}

export function stageOptimize(state: ThoughtState): { state: ThoughtState; artifact: KnowledgeArtifact } {
    const finalAnswer =
        [
            "## ✅ Thought Pipeline Installed",
            "",
            "Your bot will run: **Concept → Observing Perspective → Self-Questioning → Reasoning → Decision → Optimize**",
            "",
            "### Output Guarantees",
            "- Objective + constraints + tradeoffs + acceptance tests",
            "- Reasoning mode chosen explicitly (deductive/inductive/abductive/mixed)",
            "- Writes a KnowledgeArtifact for usable memory",
            "",
            "### Next Step",
            "Wire `runThoughtPipeline()` into your chat handler and persist artifacts to NDJSON."
        ].join("\n");

    const artifact: KnowledgeArtifact = KnowledgeArtifactSchema.parse({
        id: stableId("KA"),
        createdAt: new Date().toISOString(),
        userGoal: "Create a thought process pipeline that produces best responses and usable knowledge.",
        constraints: state.constraints,
        tradeoffPriority: state.tradeoffPriority,
        facts: state.observations,
        assumptions: state.assumptions,
        uncertainties: ["User did not specify exact memory backend; defaulting to NDJSON/local store."],
        selectedReasoningMode: state.reasoningMode,
        decision: state.draftPlan || "Provide pipeline + artifact generation.",
        acceptanceTestsOrMetrics: state.acceptanceTestsOrMetrics,
        responseSummary: "Delivered staged reasoning pipeline + strict KnowledgeArtifact schema for memory.",
        operatorsUsed: state.operatorsUsed,
        memory: {
            persist: [
                "User wants a lexicon-driven thought pipeline for chatbot responses.",
                "User wants structured knowledge artifacts for memory."
            ],
            ephemeral: ["This specific prompt instance and staging outputs."],
            doNotStore: ["Sensitive personal data (none provided)."]
        }
    });

    return {
        state: {
            ...state,
            stage: "optimize",
            finalAnswer,
            operatorsUsed: [...state.operatorsUsed, "prompt.operator.optimize"]
        },
        artifact
    };
}
