import { z } from "zod";

export type EnvelopeVersion = "1.0";

export type Envelope<TPayload> = {
    v: EnvelopeVersion;
    id: string;
    ts: string;          // ISO
    traceId: string;
    source: "ide-web" | "nucleus" | "brain";
    kind: string;        // "chat.request" | "chat.delta" | ...
    payload: TPayload;
};

export type ChatRequest = {
    convoId: string;
    userId: string;
    persona: string;
    text: string;
    context?: {
        selection?: string;
        openFiles?: string[];
        scene?: {
            mapId?: string;
            playerPos?: [number, number, number];
        };
    };
};

export type LexiconHit = {
    id: string;
    topic: string;
    meaning: string;
    tags: string[];
    confidence: number;
};

export type ToolCall = {
    name: "record_screen" | "record_audio" | "chart_render" | "lexicon_ingest";
    args: Record<string, unknown>;
};

// -------------------- Evidence Block (Deterministic UI Rendering) --------------------
export type EvidenceSchema = {
    name: "brain.chat.evidence";
    version: "1.0.0";
};

export type EvidenceGroundingRow = {
    token: string;      // original token
    lexId: string;      // lexicon entry id
    confidence: number; // 0..1
};

export type EvidenceActionRow = {
    name: ToolCall["name"] | string; // allow forward-compat tool names
    argsPreview: string;             // safe, shallow preview (<=512 chars)
};

export type EvidenceCitation = {
    type: "lexicon";
    ref: string;
};

export type EvidenceBlock = {
    schema: EvidenceSchema;
    grounding: EvidenceGroundingRow[];
    actions: EvidenceActionRow[];
    citations: EvidenceCitation[];
};

export type ChatResponse = {
    convoId: string;
    text: string;
    toolCalls?: ToolCall[];
    lexicon?: {
        hits: LexiconHit[];
        tokenMap: { token: string; lexId: string; confidence: number }[];
    };
    citations?: { type: "lexicon" | "code" | "doc"; ref: string }[];

    // ✅ NEW: structured evidence for deterministic UI rendering
    evidence?: EvidenceBlock;
};

export type ToolResult = {
    convoId: string;
    toolName: ToolCall["name"];
    ok: boolean;
    result: Record<string, unknown>;
    error?: string;
};

// -------------------- Zod Validators (Runtime Contract Validation) --------------------

// Envelope validator
export const EnvelopeSchema = z.object({
    v: z.literal("1.0"),
    id: z.string().min(1),
    ts: z.string().min(1),
    traceId: z.string().min(1),
    source: z.enum(["ide-web", "nucleus", "brain"]),
    kind: z.string().min(1),
    payload: z.unknown()
}).strict();

// Evidence validators
export const EvidenceSchemaSchema = z.object({
    name: z.literal("brain.chat.evidence"),
    version: z.literal("1.0.0")
}).strict();

export const EvidenceGroundingRowSchema = z.object({
    token: z.string().min(1).max(128),
    lexId: z.string().min(1).max(128),
    confidence: z.number().min(0).max(1)
}).strict();

export const EvidenceActionRowSchema = z.object({
    name: z.string().min(1).max(128),
    argsPreview: z.string().max(512)
}).strict();

export const EvidenceCitationSchema = z.object({
    type: z.literal("lexicon"),
    ref: z.string().min(1).max(128)
}).strict();

export const EvidenceBlockSchema = z.object({
    schema: EvidenceSchemaSchema.default({ name: "brain.chat.evidence", version: "1.0.0" }),
    grounding: z.array(EvidenceGroundingRowSchema).default([]),
    actions: z.array(EvidenceActionRowSchema).default([]),
    citations: z.array(EvidenceCitationSchema).default([])
}).strict();

// Core payload validators
export const ToolCallSchema = z.object({
    name: z.enum(["record_screen", "record_audio", "chart_render", "lexicon_ingest"]),
    args: z.record(z.unknown())
}).strict();

export const LexiconHitSchema = z.object({
    id: z.string().min(1),
    topic: z.string().min(1),
    meaning: z.string().min(1),
    tags: z.array(z.string()),
    confidence: z.number().min(0).max(1)
}).strict();

export const ChatResponseSchema = z.object({
    convoId: z.string().min(1),
    text: z.string(),
    toolCalls: z.array(ToolCallSchema).optional(),
    lexicon: z.object({
        hits: z.array(LexiconHitSchema),
        tokenMap: z.array(z.object({
            token: z.string().min(1),
            lexId: z.string().min(1),
            confidence: z.number().min(0).max(1)
        }).strict())
    }).optional(),
    citations: z.array(z.object({
        type: z.enum(["lexicon", "code", "doc"]),
        ref: z.string().min(1)
    }).strict()).optional(),

    // ✅ NEW: structured evidence
    evidence: EvidenceBlockSchema.optional()
}).strict();

export const ChatRequestSchema = z.object({
    convoId: z.string().min(1),
    userId: z.string().min(1),
    persona: z.string().min(1),
    text: z.string().min(1),
    context: z.object({
        selection: z.string().optional(),
        openFiles: z.array(z.string()).optional(),
        scene: z.object({
            mapId: z.string().optional(),
            playerPos: z.tuple([z.number(), z.number(), z.number()]).optional()
        }).optional()
    }).optional()
}).strict();

export const ToolResultSchema = z.object({
    convoId: z.string().min(1),
    toolName: z.enum(["record_screen", "record_audio", "chart_render", "lexicon_ingest"]),
    ok: z.boolean(),
    result: z.record(z.unknown()),
    error: z.string().optional()
}).strict();
