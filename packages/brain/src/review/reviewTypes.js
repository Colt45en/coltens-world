import { z } from "zod";
export const IsoDateTimeSchema = z.string().refine((s) => !Number.isNaN(Date.parse(s)), {
    message: "Invalid ISO datetime",
});
export const ReviewKindSchema = z.enum(["lexicon.entry.suggestion", "artifact.suggestion"]);
export const ReviewStatusSchema = z.enum(["pending", "approved", "rejected"]);
export const ReviewQueueItemSchema = z.object({
    schemaVersion: z.literal("1.0.0"),
    id: z.string().min(4),
    createdAt: IsoDateTimeSchema,
    kind: ReviewKindSchema,
    status: ReviewStatusSchema,
    reason: z.string().min(1),
    payload: z.unknown(),
});
export const ReviewDecisionSchema = z.object({
    schemaVersion: z.literal("1.0.0"),
    decisionId: z.string().min(6),
    itemId: z.string().min(4),
    decidedAt: IsoDateTimeSchema,
    decision: z.enum(["approve", "reject"]),
    reviewer: z.string().min(1),
    reason: z.string().min(1),
    effects: z.object({
        wroteMemory: z.boolean(),
        wroteLexiconEntry: z.boolean(),
        rebuiltLexiconIndex: z.boolean(),
        updatedQueue: z.boolean(),
    }),
});
/**
 * Lexicon entry contract (minimal but strict enough to be useful).
 * If your repo already has a lexicon schema in packages/lexicon, you can swap to that later.
 */
export const LexiconEntrySchema = z.object({
    schemaVersion: z.literal("1.0.0"),
    id: z.string().min(6),
    canonicalTerm: z.string().min(1),
    code_process_tag: z.string().min(3),
    type: z.enum(["operator", "concept", "system"]),
    meaning: z.string().min(1),
    use: z.array(z.string().min(1)).default([]),
    methodology: z.array(z.string().min(1)).default([]),
    examples: z.array(z.string().min(1)).default([]),
    anti_patterns: z.array(z.string().min(1)).default([]),
    tests_validation: z.array(z.string().min(1)).default([]),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
});
/**
 * Knowledge artifact (minimal, matches your seeding output shape).
 * If you already have a more complete artifact schema, plug it in here.
 */
export const KnowledgeArtifactSchema = z.object({
    schemaVersion: z.literal("1.0.0"),
    artifactId: z.string().min(6),
    createdAt: IsoDateTimeSchema,
    operator: z.string().min(3),
    concept: z.string().min(1),
    summary: z.string().min(1),
    payload: z.unknown(),
    provenance: z.object({
        pipelineVersion: z.string().min(1),
        lexiconIndexHash: z.string().min(16),
        seed: z.number().int(),
        configHash: z.string().min(16),
        source: z.object({
            kind: z.enum(["seed", "chat", "cli"]),
            ref: z.string().min(1),
        }),
    }),
    tags: z.array(z.string().min(1)).default([]),
    status: z.enum(["canonical", "pending"]).default("canonical"),
});
