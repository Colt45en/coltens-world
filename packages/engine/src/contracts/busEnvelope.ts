import { z } from "zod";

/**
 * BusEnvelope v1
 * Deterministic message container for all subsystems.
 *
 * Rules:
 * - id must be unique per message
 * - type is namespaced: "pipeline.stage.started"
 * - source is stable: "tooling.unifiedRunner" | "apps.ide-web" | "apps.nucleus" | "worker.brain"
 * - traceId groups a whole run
 */

export const BusEnvelopeV1Schema = z.object({
    v: z.literal(1),
    id: z.string().min(8),
    ts: z.string().datetime(),
    type: z.string().min(3),
    source: z.string().min(3),
    traceId: z.string().min(8),
    spanId: z.string().min(8),
    parentSpanId: z.string().min(8).optional(),
    severity: z.enum(["debug", "info", "warn", "error"]).default("info"),
    data: z.unknown(),
});

export type BusEnvelopeV1 = z.infer<typeof BusEnvelopeV1Schema>;

/** Strong typing for pipeline event types */
export const PipelineEventTypeSchema = z.enum([
    "pipeline.run.started",
    "pipeline.run.completed",
    "pipeline.stage.started",
    "pipeline.stage.completed",
    "pipeline.explain.request",
    "pipeline.explain.response",
]);

export type PipelineEventType = z.infer<typeof PipelineEventTypeSchema>;

/** Common "stage" identifiers */
export const PipelineStageSchema = z.enum([
    "prose.decompose",
    "prose.superpose",
    "prose.collapse",
    "prose.synthesize",
    "code.decompose",
    "code.synthesize",
    "memory.write",
]);

export type PipelineStage = z.infer<typeof PipelineStageSchema>;

/** Shared shapes used inside envelope.data */
export const PipelineRunStartedDataSchema = z.object({
    runId: z.string().min(8),
    kind: z.enum(["prose", "code"]),
    inputHash: z.string().length(64),
});

export type PipelineRunStartedData = z.infer<typeof PipelineRunStartedDataSchema>;

export const PipelineRunCompletedDataSchema = z.object({
    runId: z.string().min(8),
    kind: z.enum(["prose", "code"]),
    inputHash: z.string().length(64),
    msTotal: z.number().nonnegative(),
    chosenId: z.string().min(8).nullable(),
});

export type PipelineRunCompletedData = z.infer<typeof PipelineRunCompletedDataSchema>;

export const PipelineStageStartedDataSchema = z.object({
    runId: z.string().min(8),
    stage: PipelineStageSchema,
});

export type PipelineStageStartedData = z.infer<typeof PipelineStageStartedDataSchema>;

export const PipelineStageCompletedDataSchema = z.object({
    runId: z.string().min(8),
    stage: PipelineStageSchema,
    ok: z.boolean(),
    ms: z.number().nonnegative(),
    stats: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
    error: z
        .object({
            code: z.string(),
            message: z.string(),
        })
        .optional(),
});

export type PipelineStageCompletedData = z.infer<typeof PipelineStageCompletedDataSchema>;

export const PipelineExplainRequestDataSchema = z.object({
    runId: z.string().min(8),
    candidateId: z.string().min(8),
});

export type PipelineExplainRequestData = z.infer<typeof PipelineExplainRequestDataSchema>;

export const PipelineExplainResponseDataSchema = z.object({
    runId: z.string().min(8),
    candidateId: z.string().min(8),
    explanation: z.record(z.string(), z.unknown()),
});

export type PipelineExplainResponseData = z.infer<typeof PipelineExplainResponseDataSchema>;

/**
 * Pipeline envelope validator (type-discriminated)
 * You can use this in Nucleus / UI to validate inbound messages.
 */
export const PipelineEnvelopeSchema = BusEnvelopeV1Schema.extend({
    type: PipelineEventTypeSchema,
    data: z.union([
        PipelineRunStartedDataSchema,
        PipelineRunCompletedDataSchema,
        PipelineStageStartedDataSchema,
        PipelineStageCompletedDataSchema,
        PipelineExplainRequestDataSchema,
        PipelineExplainResponseDataSchema,
    ]),
});

export type PipelineEnvelope = z.infer<typeof PipelineEnvelopeSchema>;
