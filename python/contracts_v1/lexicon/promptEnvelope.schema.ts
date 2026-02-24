import { z } from "zod";

/**
 * Minimal shared envelope for any prompt artifact.
 * Operators add their own fields via their schemas.
 *
 * IMPORTANT:
 * - Zod objects strip unknown keys by default.
 * - .passthrough() preserves operator-specific fields when validating only the envelope.
 */
export const PromptEnvelopeSchema = z
  .object({
    code_process_tag: z.string().min(1, "code_process_tag must be a non-empty string"),

    // Optional at the envelope level so legacy artifacts still validate.
    // Operator schemas should override these as literals (making them required there).
    operator: z.string().min(1).optional(),
    operator_version: z.string().min(1).optional(),

    createdAt: z.string().datetime().optional(),
    updatedAt: z.string().datetime().optional()
  })
  .passthrough();

export type PromptEnvelope = z.infer<typeof PromptEnvelopeSchema>;
