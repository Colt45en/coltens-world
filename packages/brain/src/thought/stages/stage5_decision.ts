import type { ThoughtState } from "../thoughtTypes";

export function stageDecision(state: ThoughtState): ThoughtState {
    const constraints = [
        "No vague answers",
        "Prefer runnable code and strict schemas",
        "Avoid unnecessary placeholders",
        "Produce usable knowledge artifacts"
    ];

    const tradeoffPriority = ["correctness", "clarity", "actionability", "brevity"];

    const acceptanceTestsOrMetrics = [
        "Response includes a pipeline with clear stages",
        "Includes a KnowledgeArtifact schema and example output",
        "Stages are deterministic and testable",
        "Uses lexicon process tags in trace"
    ];

    const decision =
        "Deliver a runnable thought-pipeline module + a memory artifact generator. " +
        "Answer will include code, a sample artifact output, and integration notes.";

    return {
        ...state,
        stage: "optimize",
        constraints,
        tradeoffPriority,
        acceptanceTestsOrMetrics,
        draftPlan: `${state.draftPlan}\nDecision: ${decision}`,
        operatorsUsed: [...state.operatorsUsed, "prompt.operator.decision"]
    };
}
