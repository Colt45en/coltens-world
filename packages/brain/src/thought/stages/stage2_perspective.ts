import type { ThoughtState } from "../thoughtTypes";

export function stageObservePerspective(state: ThoughtState): ThoughtState {
    // Deterministic rule: treat sentences with "is/are" as interpretations unless they include numbers/quotes/commands.
    const lines = state.userMessage.split(/\n+/).map((s: string) => s.trim()).filter(Boolean);

    const observations: string[] = [];
    const interpretations: string[] = [];

    for (const l of lines) {
        const hasNumbers = /\d/.test(l);
        const hasDirective = /\b(make|build|create|convert|write|explain|optimize|generate)\b/i.test(l);
        if (hasNumbers || hasDirective) observations.push(l);
        else interpretations.push(l);
    }

    const frames: string[] = [];
    if (/\b(always|never|must|should)\b/i.test(state.userMessage)) frames.push("normative/constraint-heavy frame");
    if (/\bworried|afraid|anxious|mad|angry|excited\b/i.test(state.userMessage)) frames.push("emotion-present frame");

    return {
        ...state,
        stage: "self_questioning",
        observations,
        interpretations,
        frames,
        operatorsUsed: [...state.operatorsUsed, "prompt.operator.observe.perspective"]
    };
}
