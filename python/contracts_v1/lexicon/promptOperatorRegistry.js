import { OptimizePromptSchema } from "./prompt-operators/optimizePrompt.schema";
import { OptimizePromptV2Schema } from "./prompt-operators/optimizePrompt.v2.schema";

export const PromptOperatorRegistry = {
    "prompt.operator.optimize": OptimizePromptSchema,
    "prompt.operator.optimize@v2": OptimizePromptV2Schema
    // "prompt.operator.diff": DiffPromptSchema,
    // "prompt.operator.validate": ValidatePromptSchema,
};
export function getOperatorSchema(tag) {
    return PromptOperatorRegistry[tag];
}
export function listKnownOperatorTags() {
    return Object.keys(PromptOperatorRegistry).sort();
}
