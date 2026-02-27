import { z } from "zod";

/**
 * StreamEvent v1.0
 *
 * Contract between Brain (Python) and Nucleus (Node):
 * - Every event has v, traceId, turnId, seq
 * - Enables ordering, correlation, replay
 */

export const StreamEventType = z.enum([
  "text_chunk",
  "tool_call",
  "tool_result",
  "citation",
  "memory_write",
  "done",
  "error",
]);

export type StreamEventType = z.infer<typeof StreamEventType>;

// ============================================================================
// Base (all events share these fields)
// ============================================================================

export const StreamEventBase = z.object({
  v: z.literal("1.0"),
  traceId: z.string().min(1).max(256).describe("Request trace ID"),
  turnId: z.string().min(1).max(256).describe("Unique per user send (UUID recommended)"),
  seq: z.number().int().nonnegative().describe("0-based monotonic counter"),
  type: StreamEventType,
  ts: z.number().int().positive().optional().describe("Server-side emission timestamp (ms since epoch)"),
});

export type StreamEventBase = z.infer<typeof StreamEventBase>;

// ============================================================================
// Typed Stream Events (discriminated union)
// ============================================================================

export const TextChunkEvent = StreamEventBase.extend({
  type: z.literal("text_chunk"),
  data: z.object({
    text: z.string(),
  }),
});

export const ToolCallEvent = StreamEventBase.extend({
  type: z.literal("tool_call"),
  data: z.object({
    callId: z.string().min(1).describe("Unique tool call ID (for matching results)"),
    name: z.string().min(1).max(256),
    args: z.record(z.string(), z.unknown()).default({}),
    timeoutMs: z.number().int().positive().max(60_000).default(15_000),
    critical: z.boolean().default(false),
  }),
});

export const ToolResultEvent = StreamEventBase.extend({
  type: z.literal("tool_result"),
  data: z.object({
    callId: z.string().min(1).describe("Matches ToolCallEvent.callId"),
    ok: z.boolean(),
    result: z.unknown().optional(),
    error: z.string().optional(),
    durationMs: z.number().int().nonnegative().optional(),
  }),
});

export const CitationEvent = StreamEventBase.extend({
  type: z.literal("citation"),
  data: z.object({
    type: z.enum(["lexicon", "code", "doc", "memory"]),
    ref: z.string(),
    text: z.string().optional(),
  }),
});

export const MemoryWriteEvent = StreamEventBase.extend({
  type: z.literal("memory_write"),
  data: z.object({
    key: z.string(),
    value: z.unknown(),
    ttl: z.number().nonnegative().optional(),
  }),
});

export const DoneEvent = StreamEventBase.extend({
  type: z.literal("done"),
  data: z.object({
    stop_reason: z.enum(["end_turn", "cancelled", "error", "length", "tool_error"]).default("end_turn"),
  }),
});

export const ErrorEvent = StreamEventBase.extend({
  type: z.literal("error"),
  data: z.object({
    error: z.string(),
    code: z.string().optional(),
  }),
});

// ============================================================================
// Union (use this to validate incoming events)
// ============================================================================

export const StreamEvent = z.discriminatedUnion("type", [
  TextChunkEvent,
  ToolCallEvent,
  ToolResultEvent,
  CitationEvent,
  MemoryWriteEvent,
  DoneEvent,
  ErrorEvent,
]);

export type StreamEvent = z.infer<typeof StreamEvent>;

// ============================================================================
// Export for runtime validation
// ============================================================================

export function validateStreamEvent(raw: unknown): StreamEvent | null {
  const result = StreamEvent.safeParse(raw);
  return result.success ? result.data : null;
}

export function serializeStreamEvent(ev: StreamEvent): string {
  return JSON.stringify(ev);
}
