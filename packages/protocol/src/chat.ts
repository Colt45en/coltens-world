/**
 * Chat Protocol — Bus envelope contracts for agentic chat
 *
 * - ChatRequest: user message → brain
 * - ToolCall: brain request → UI or Nucleus
 * - ToolResult: tool response → brain
 * - ChatResponse: brain response → UI
 *
 * All messages wrapped in Envelope<T> with v, id, ts, traceId, source, kind, payload.
 */

import { z } from "zod";

// ============================================================================
// Base Envelope (all messages use this)
// ============================================================================

export const ChatEnvelopeSchema = z.object({
    v: z.literal("1.0"),
    id: z.string().describe("UUID or snowflake ID for this message"),
    ts: z.string().describe("ISO 8601 timestamp"),
    traceId: z.string().describe("Correlation ID for request/response chains"),
    source: z.enum(["ide-web", "nucleus", "brain", "system"]).describe("Where message originated"),
    kind: z.string().describe("Message type (e.g., 'chat.request', 'chat.response', 'tool.call')"),
    payload: z.unknown().describe("Type-specific payload"),
});

export interface ChatEnvelope<T = any> {
    v: "1.0";
    id: string;
    ts: string;
    traceId: string;
    source: "ide-web" | "nucleus" | "brain" | "system";
    kind: string;
    payload: T;
}

export type Envelope<T = any> = ChatEnvelope<T>;  // Alias for backward compatibility

// ============================================================================
// Chat Request (IDE → Nucleus → Brain)
// ============================================================================

export const ChatRequestSchema = z.object({
    convoId: z.string().describe("Conversation ID (UUID or local ID)"),
    userId: z.string().describe("User ID for auth + memory lookup"),
    text: z.string().describe("Raw user input"),
    persona: z
        .enum(["general", "proactive", "delegator", "reasoning", "storyteller", "code"])
        .default("general"),
    recentHistory: z
        .array(
            z.object({
                role: z.enum(["user", "bot"]),
                content: z.string(),
            })
        )
        .optional()
        .default([])
        .describe("Last N messages for context"),
    context: z
        .object({
            selection: z.string().optional().describe("Selected text in editor"),
            openFiles: z.array(z.string()).optional().describe("List of open file paths"),
            scene: z
                .object({
                    mapId: z.string().optional(),
                    playerPos: z.tuple([z.number(), z.number(), z.number()]).optional(),
                    visibleEntities: z.array(z.string()).optional(),
                })
                .optional()
                .describe("World state snapshot"),
        })
        .optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

// ============================================================================
// Tool Call (Brain → UI/Nucleus)
// ============================================================================

export const ToolCallSchema = z.object({
    name: z.string().describe("Tool identifier (e.g., 'record_screen', 'query_lexicon')"),
    args: z.record(z.string(), z.unknown()).describe("Tool-specific arguments"),
    timeout: z.number().default(30000).describe("Timeout in ms"),
    critical: z.boolean().default(false).describe("If true, fail the response if tool fails"),
});

export type ToolCall = z.infer<typeof ToolCallSchema>;

// ============================================================================
// Tool Result (UI/Nucleus → Brain)
// ============================================================================

export const ToolResultSchema = z.object({
    name: z.string().describe("Tool name (matches ToolCall.name)"),
    ok: z.boolean().describe("Success/failure flag"),
    artifactUrl: z.string().optional().describe("Link to artifact (blob:, file://, http://)"),
    data: z.unknown().optional().describe("Arbitrary tool output data"),
    error: z.string().optional().describe("Error message if ok=false"),
    durationMs: z.number().optional().describe("Execution time"),
});

export type ToolResult = z.infer<typeof ToolResultSchema>;

// ============================================================================
// Chat Response (Brain → Nucleus → IDE)
// ============================================================================

export const CitationSchema = z.object({
    type: z.enum(["lexicon", "code", "doc", "memory"]),
    ref: z.string().describe("Lexicon entry ID, file path, or memory key"),
    text: z.string().optional().describe("Display text for citation"),
});

export type Citation = z.infer<typeof CitationSchema>;

export const MemoryWriteSchema = z.object({
    key: z.string().describe("Memory key (e.g., 'user.name', 'project.tech_stack')"),
    value: z.unknown().describe("Serializable value to store"),
    ttl: z.number().optional().describe("Time-to-live in seconds (optional)"),
});

export type MemoryWrite = z.infer<typeof MemoryWriteSchema>;

export const ChatResponseSchema = z.object({
    convoId: z.string(),
    text: z.string().describe("Response text (markdown)"),
    toolCalls: z.array(ToolCallSchema).optional().default([]),
    toolResults: z.array(ToolResultSchema).optional().default([]).describe("Results from executed tools"),
    citations: z.array(CitationSchema).optional().default([]),
    memoryWrites: z.array(MemoryWriteSchema).optional().default([]),
    sentiment: z.enum(["positive", "negative", "neutral"]).optional(),
    stop_reason: z.enum(["end_turn", "tool_use", "error", "max_tokens"]).default("end_turn"),
});

export type ChatResponse = z.infer<typeof ChatResponseSchema>;

// ============================================================================
// Streaming Chat Event (for chunked responses)
// ============================================================================

export const ChatStreamEventSchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("text_chunk"),
        chunk: z.string().describe("Partial response text"),
    }),
    z.object({
        type: z.literal("tool_call"),
        call: ToolCallSchema,
    }),
    z.object({
        type: z.literal("tool_result"),
        result: ToolResultSchema,
    }),
    z.object({
        type: z.literal("citation"),
        citation: CitationSchema,
    }),
    z.object({
        type: z.literal("memory_write"),
        write: MemoryWriteSchema,
    }),
    z.object({
        type: z.literal("done"),
        stop_reason: z.enum(["end_turn", "tool_use", "error", "max_tokens"]),
    }),
]);

export type ChatStreamEvent = z.infer<typeof ChatStreamEventSchema>;

// ============================================================================
// Brain Chat Protocol (IDE ↔ Nucleus ↔ Brain, streamed mode)
// ============================================================================

export type BrainChatMode = "assistant" | "operator" | "ide-help";

export const BrainChatContextSchema = z.object({
    currentRoute: z.string().optional().describe("Current IDE route/page"),
    selectedFiles: z.array(z.string()).optional().describe("Open file paths"),
    selectionText: z.string().optional().describe("Selected text in editor"),
    openPanels: z.array(z.string()).optional().describe("Active lab panels"),
}).strict();

export type BrainChatContext = z.infer<typeof BrainChatContextSchema>;

export const BrainChatRequestSchema = z.object({
    traceId: z.string().min(8).describe("Correlation ID for binding stream chunks"),
    message: z.string().min(1).describe("User input"),
    mode: z.enum(["assistant", "operator", "ide-help"]).optional().default("assistant"),
    context: BrainChatContextSchema.optional(),
}).strict();

export type BrainChatRequest = z.infer<typeof BrainChatRequestSchema>;

export const BrainChatDeltaSchema = z.object({
    traceId: z.string().min(8).describe("Links back to request"),
    seq: z.number().int().nonnegative().describe("Chunk sequence number"),
    deltaText: z.string().describe("Streaming text chunk"),
}).strict();

export type BrainChatDelta = z.infer<typeof BrainChatDeltaSchema>;

export const BrainChatDoneSchema = z.object({
    traceId: z.string().min(8),
    finalText: z.string().describe("Complete response text"),
    toolsUsed: z.array(z.string()).optional().default([]).describe("Operator IDs invoked"),
    audit: z.object({
        latency_ms: z.number().nonnegative(),
        operatorExecuted: z.object({
            operatorId: z.string(),
            ok: z.boolean(),
        }).optional(),
    }).optional(),
}).strict();

export type BrainChatDone = z.infer<typeof BrainChatDoneSchema>;

export const BrainChatErrorSchema = z.object({
    traceId: z.string().min(8),
    code: z.string().describe("Error code (e.g., CHAT_FAIL, OPERATOR_TIMEOUT)"),
    message: z.string().describe("Human-readable error"),
}).strict();

export type BrainChatError = z.infer<typeof BrainChatErrorSchema>;

// ============================================================================
// Helper functions
// ============================================================================

export function createEnvelope<T>(
    kind: string,
    payload: T,
    traceId: string,
    source: ChatEnvelope["source"] = "system"
): ChatEnvelope<T> {
    return {
        v: "1.0",
        id: `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        ts: new Date().toISOString(),
        traceId,
        source,
        kind,
        payload,
    };
}

export function createChatRequest(
    convoId: string,
    userId: string,
    text: string,
    traceId: string,
    persona: ChatRequest["persona"] = "general",
    context?: ChatRequest["context"]
): ChatEnvelope<ChatRequest> {
    const payload: ChatRequest = {
        convoId,
        userId,
        text,
        persona,
        context,
        recentHistory: [],
    };
    return createEnvelope("chat.request", payload, traceId, "ide-web");
}

export function createChatResponse(
    convoId: string,
    text: string,
    traceId: string
): ChatEnvelope<ChatResponse> {
    const payload: ChatResponse = {
        convoId,
        text, toolCalls: [],
        toolResults: [],
        citations: [],
        memoryWrites: [], stop_reason: "end_turn",
    };
    return createEnvelope("chat.response", payload, traceId, "brain");
}
