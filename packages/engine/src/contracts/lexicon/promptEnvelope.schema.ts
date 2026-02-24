import { z } from "zod";

/**
 * Minimal shared envelope for any prompt artifact.
 * Operators add their own fields via their schemas.
 */
export const PromptEnvelopeSchema = z.object({
    code_process_tag: z.string().min(1, "code_process_tag must be a non-empty string"),
    createdAt: z.string().datetime().optional(),
    updatedAt: z.string().datetime().optional()
});

export type PromptEnvelope = z.infer<typeof PromptEnvelopeSchema>;
