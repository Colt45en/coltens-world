import type { ThoughtState } from "../thoughtTypes";

export function stageConcept(state: ThoughtState): ThoughtState {
    // Minimal deterministic extractor (no ML): split into candidate nouns/phrases.
    // You can replace later with a parser/NER but keep same output contract.
    const msg = state.userMessage;

    const candidates = Array.from(
        new Set(
            msg
                .replace(/[^\w\s-]/g, " ")
                .split(/\s+/)
                .filter((w: string) => w.length >= 4)
                .map((w: string) => w.toLowerCase())
        )
    ).slice(0, 12);

    return {
        ...state,
        stage: "observe_perspective",
        concepts: candidates,
        operatorsUsed: [...state.operatorsUsed, "prompt.primitive.concept"]
    };
}
