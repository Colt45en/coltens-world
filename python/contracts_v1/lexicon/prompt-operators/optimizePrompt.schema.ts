import { z } from "zod";

export const OptimizePromptSchema = z.object({
    code_process_tag: z.literal("prompt.operator.optimize"),
    objective: z.string().min(1, "objective must be a non-empty string"),
    constraints: z.array(z.string().min(1)).min(1, "constraints must contain at least 1 item"),
    acceptance_tests: z.array(z.string().min(1)).min(1, "acceptance_tests must contain at least 1 item"),
    tradeoffs: z.array(z.string().min(1)).optional(),
    scope: z.string().min(1).optional(),
    createdAt: z.string().datetime().optional(),
    updatedAt: z.string().datetime().optional()
});

export type OptimizePrompt = z.infer<typeof OptimizePromptSchema>;
