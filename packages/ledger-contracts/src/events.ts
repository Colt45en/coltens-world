/**
 * LEDGER CONTRACTS v1
 *
 * Shared event types and schemas for deterministic integration.
 * Single source of truth for Nucleus ↔ AgentHub event language.
 */

import { z } from 'zod';

// ============================================================================
// EVENT ENVELOPE (all events conform to this)
// ============================================================================

export const EventEnvelopeSchema = z.object({
  event_id: z.string(),
  type: z.string(),
  v: z.number().int().positive(),
  ts: z.string().datetime(),
  seq: z.number().int().nonnegative().optional(),
  correlation_id: z.string(),
  call_id: z.string().optional(),
  producer: z.string(),
  payload_hash: z.string(),
  payload: z.record(z.any()),
});

export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;

// ============================================================================
// TOOL EXECUTION EVENTS
// ============================================================================

export const ToolExecuteRequestSchema = z.object({
  event_id: z.string(),
  type: z.literal('tool.execute.request'),
  v: z.literal(1),
  ts: z.string().datetime(),
  correlation_id: z.string(),
  call_id: z.string(),
  producer: z.string(),
  payload_hash: z.string(),
  payload: z.object({
    tool: z.object({
      id: z.string(),
      version: z.string(),
      effect_profile: z.enum(['pure', 'read', 'write', 'external']),
    }),
    args: z.record(z.any()),
  }),
});

export type ToolExecuteRequest = z.infer<typeof ToolExecuteRequestSchema>;

// ============================================================================
// TOOL RESULT EVENTS
// ============================================================================

export const ToolResultSchema = z.object({
  event_id: z.string(),
  type: z.literal('tool.result'),
  v: z.literal(1),
  ts: z.string().datetime(),
  correlation_id: z.string(),
  call_id: z.string(),
  producer: z.string(),
  payload_hash: z.string(),
  payload: z.object({
    ok: z.boolean(),
    result: z.record(z.any()).optional(),
    error: z.string().optional(),
  }),
});

export type ToolResult = z.infer<typeof ToolResultSchema>;

// ============================================================================
// ANY VALID EVENT
// ============================================================================

export const AnyEventSchema = z.union([
  EventEnvelopeSchema,
  ToolExecuteRequestSchema,
  ToolResultSchema,
]);

export type AnyEvent = z.infer<typeof AnyEventSchema>;
