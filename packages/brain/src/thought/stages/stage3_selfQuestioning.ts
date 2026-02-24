import type { ThoughtState } from "../thoughtTypes";

export function stageSelfQuestioning(state: ThoughtState): ThoughtState {
    const assumptions: string[] = [];
    const alternatives: string[] = [];
    const questions: string[] = [];

    // Always add core self-questioning probes
    questions.push("What is the user's objective in one sentence?");
    questions.push("What constraints must not be violated?");
    questions.push("What would make this answer wrong or unhelpful?");
    questions.push("What is the cheapest next test to verify uncertain parts?");

    // If user asked for "best/optimized" style, we need objective/constraints/metrics
    if (/\bbest|optimi(z|s)e|fastest|most efficient\b/i.test(state.userMessage)) {
        assumptions.push("User wants improvement, not just explanation.");
        questions.push("What metric defines 'best' here (speed, clarity, cost, safety)?");
        questions.push("What tradeoff is allowed to worsen?");
    }

    // Alternatives: propose different response modes
    alternatives.push("Provide an actionable pipeline + contracts + minimal runnable code.");
    alternatives.push("Provide conceptual explanation + templates only (no code).");
    alternatives.push("Provide both: blueprint + runnable scaffolding.");

    return {
        ...state,
        stage: "reasoning",
        assumptions: [...state.assumptions, ...assumptions],
        alternatives: [...state.alternatives, ...alternatives],
        discriminatingQuestions: [...state.discriminatingQuestions, ...questions],
        operatorsUsed: [...state.operatorsUsed, "prompt.operator.self_questioning"]
    };
}
