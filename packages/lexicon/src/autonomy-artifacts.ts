import { z } from "zod";

export const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const IsoDateTimeSchema = z.string().datetime();

export const ProcessTagSchema = z.enum([
    "define",
    "call",
    "import",
    "export",
    "assign",
    "type_decl",
    "control_flow",
    "literal",
    "unknown",
]);

export const TokenTypeSchema = z.enum(["word", "symbol", "string", "number", "whitespace", "comment"]);

export const TokenSchema = z.object({
    token: z.string().min(1),
    token_type: TokenTypeSchema,
    count: z.number().int().min(1),
    initial_confidence: z.number().min(0).max(1),
});

export const MeaningClaimSchema = z.object({
    claim: z.string().min(1),
    confidence: z.number().min(0).max(1),
    source_ref: z.string().min(1),
});

export const EvidencePacketSchema = z.object({
    batch_id: z.string().min(1),
    ingested_at: IsoDateTimeSchema,
    language: z.string().min(1),
    objective: z.string().min(1),
    source_file: z.string().min(1),
    content_hash: z.string().min(6),
    tokens: z.array(TokenSchema),
    meaning_claims: z.array(MeaningClaimSchema),
    unknowns: z.array(z.string()),
});

export const MorphologySchema = z.object({
    root: z.string().min(1),
    affixes: z.array(z.string()),
    pos: z.string().min(1),
});

export const SemanticLensSchema = z.object({
    lens_name: z.string().min(1),
    meaning: z.string().min(1),
    confidence: z.number().min(0).max(1),
    evidence_links: z.array(z.string()).default([]),
});

export const LexiconEntrySchema = z.object({
    entry_id: z.string().min(1),
    term: z.string().min(1),
    language: z.string().min(1),
    namespace: z.string().min(1),
    morphology: MorphologySchema,
    semantic_lenses: z.array(SemanticLensSchema),
    overall_confidence: z.number().min(0).max(1),
    review_required: z.boolean(),
});

export const RuneDecoderRowSchema = z.object({
    rune_id: z.string().min(1),
    symbol: z.string().min(1),
    language: z.string().min(1),
    namespace: z.string().min(1),
    process_tag: ProcessTagSchema,
    tag_confidence: z.number().min(0).max(1),
    meaning: z.string().min(1),
    methodologies: z.array(z.string()),
    evidence_links: z.array(z.string()).default([]),
});

export const GateResultSchema = z.object({
    gate_name: z.string().min(1),
    passed: z.boolean(),
    severity: z.enum(["critical", "warning"]),
    details: z.record(z.any()),
});

export const ValidatedPlanSchema = z.object({
    batch_id: z.string().min(1),
    gates: z.array(GateResultSchema),
    overall_status: z.enum(["passed", "warning", "failed"]),
    content_hash: z.string().min(6),
});

export const DecisionRecordSchema = z.object({
    batch_id: z.string().min(1),
    decisions: z.array(
        z.object({
            decision_id: z.string().min(1),
            choice: z.enum(["APPROVED", "APPROVED_WITH_WARNINGS", "BLOCKED"]),
            rationale: z.string().min(1),
            authority: z.string().min(1),
            decided_at: IsoDateTimeSchema,
        })
    ),
    approved_for_release: z.boolean(),
    content_hash: z.string().min(6),
});

export const WeeklyOpsReportSchema = z.object({
    week_starting: IsoDateSchema,
    narrative_mode: z.enum(["slice_of_life", "rising_action", "conflict", "climax", "falling_action", "resolution"]),
    what_changed: z.string().min(1),
    metrics: z.array(
        z.object({
            metric_name: z.string().min(1),
            current_value: z.union([z.number(), z.string(), z.boolean()]),
            trend: z.string().min(1),
            status: z.string().min(1),
        })
    ),
    unknowns: z.array(z.any()),
    health_score: z.number().min(0).max(1),
    status: z.string().min(1),
    next_week_priorities: z.array(z.string()),
    content_hash: z.string().min(6),
});

export type EvidencePacket = z.infer<typeof EvidencePacketSchema>;
export type LexiconEntry = z.infer<typeof LexiconEntrySchema>;
export type RuneDecoderRow = z.infer<typeof RuneDecoderRowSchema>;
export type ValidatedPlan = z.infer<typeof ValidatedPlanSchema>;
export type DecisionRecord = z.infer<typeof DecisionRecordSchema>;
export type WeeklyOpsReport = z.infer<typeof WeeklyOpsReportSchema>;
