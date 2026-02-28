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

// Request schemas for lexicon operations
export const LexiconRequestV1Schema = z.object({
  action: z.enum(['store', 'query', 'get', 'stats']),
  vocabulary: z.string(),
  term: z.string().optional(),
  definition: z.string().optional(),
  context: z.record(z.any()).optional(),
});

export type LexiconRequestV1 = z.infer<typeof LexiconRequestV1Schema>;

// Tool result schema
export const LexiconToolResultV1Schema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.any().optional(),
  ledger_event: z.any().optional(),
});

export type LexiconToolResultV1 = z.infer<typeof LexiconToolResultV1Schema>;

// Ledger event schema
export const LexiconLedgerEventV1Schema = z.object({
  event_type: z.literal('lexicon:operation.v1'),
  action: z.enum(['store', 'query']),
  vocabulary: z.string(),
  term: z.string().optional(),
  definition: z.string().optional(),
  timestamp_ms: z.number(),
  event_id: z.string(),
});

export type LexiconLedgerEventV1 = z.infer<typeof LexiconLedgerEventV1Schema>;
