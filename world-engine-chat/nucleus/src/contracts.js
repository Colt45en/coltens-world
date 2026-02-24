import { z } from "zod";
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
