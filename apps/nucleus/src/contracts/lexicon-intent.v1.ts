/**
 * Lexicon Intent Contract v1
 * (Stub implementation - to be completed)
 */

import { z } from 'zod';

export const LexiconIntentSchema = z.object({
  type: z.literal('lexicon'),
  vocabulary: z.string(),
  context: z.record(z.any()).optional(),
});

export type LexiconIntent = z.infer<typeof LexiconIntentSchema>;
