import type { ThoughtState } from "../thoughtTypes";

export function stageReasoning(state: ThoughtState): ThoughtState {
    // Choose mode based on task type
    const msg = state.userMessage.toLowerCase();
    let mode: ThoughtState["reasoningMode"] = "mixed";

    if (/\bprove|must|therefore|deduce\b/.test(msg)) mode = "deductive";
    else if (/\blikely|trend|pattern|generally\b/.test(msg)) mode = "inductive";
    else if (/\bexplain|cause|why\b/.test(msg)) mode = "abductive";
    else mode = "mixed";

    const draftPlan =
        "Produce a structured response pipeline using lexicon operators: concept → perspective → self-questioning → reasoning → decision → optimize. " +
        "Also emit a KnowledgeArtifact record for memory, with acceptance tests and storage rules.";

    return {
        ...state,
        stage: "decision",
        reasoningMode: mode,
        draftPlan,
        operatorsUsed: [...state.operatorsUsed, "prompt.operator.reasoning"]
    };
}
