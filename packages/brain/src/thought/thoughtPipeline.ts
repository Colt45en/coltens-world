import { stageConcept } from "./stages/stage1_concept";
import { stageObservePerspective } from "./stages/stage2_perspective";
import { stageSelfQuestioning } from "./stages/stage3_selfQuestioning";
import { stageReasoning } from "./stages/stage4_reasoning";
import { stageDecision } from "./stages/stage5_decision";
import { stageOptimize } from "./stages/stage6_optimize";
import { ThoughtStateSchema, type ThoughtState } from "./thoughtTypes";

export function runThoughtPipeline(userMessage: string) {
    let state: ThoughtState = ThoughtStateSchema.parse({
        userMessage,
        stage: "concept",
        operatorsUsed: []
    });

    state = stageConcept(state);
    state = stageObservePerspective(state);
    state = stageSelfQuestioning(state);
    state = stageReasoning(state);
    state = stageDecision(state);

    const { state: finalState, artifact } = stageOptimize(state);

    return { finalAnswer: finalState.finalAnswer, artifact, debugState: finalState };
}
