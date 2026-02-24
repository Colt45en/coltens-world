import { z } from "zod";
import { OptimizePromptSchema } from "./prompt-operators/optimizePrompt.schema";
import { OptimizePromptV2Schema } from "./prompt-operators/optimizePrompt.v2.schema";

// Add more operator schemas here as you create them:
// import { DiffPromptSchema } from "./prompt-operators/diffPrompt.schema";
// import { ValidatePromptSchema } from "./prompt-operators/validatePrompt.schema";

export type OperatorTag = string;

export const PromptOperatorRegistry: Record<OperatorTag, z.ZodTypeAny> = {
    "prompt.operator.optimize": OptimizePromptSchema,
    "prompt.operator.optimize@v2": OptimizePromptV2Schema
    // "prompt.operator.diff": DiffPromptSchema,
    // "prompt.operator.validate": ValidatePromptSchema,
};

export function getOperatorSchema(tag: string): z.ZodTypeAny | undefined {
    return PromptOperatorRegistry[tag];
}

export function listKnownOperatorTags(): string[] {
    return Object.keys(PromptOperatorRegistry).sort();
}
