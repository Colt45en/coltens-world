import { OptimizePromptSchema } from "./prompt-operators/optimizePrompt.schema";
export const PromptOperatorRegistry = {
    "prompt.operator.optimize": OptimizePromptSchema
    // "prompt.operator.diff": DiffPromptSchema,
    // "prompt.operator.validate": ValidatePromptSchema,
};
export function getOperatorSchema(tag) {
    return PromptOperatorRegistry[tag];
}
export function listKnownOperatorTags() {
    return Object.keys(PromptOperatorRegistry).sort();
}
