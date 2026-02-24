import { z } from "zod";

/**
 * BusEnvelope v1 (hardened)
 * Deterministic message container for all subsystems.
 */

const NamespacedTypeSchema = z
  .string()
  .min(3)
  .regex(/^[a-z][a-z0-9.-]+$/, "type must be lowercase namespaced: a.b.c");

const SourceSchema = z
  .string()
  .min(3)
  .regex(/^(tooling|apps|worker)\.[a-z0-9-]+$/, "source must be like apps.ide-web");

export const BusEnvelopeV1Schema = z.object({
  v: z.literal(1),
  id: z.string().min(8),
  ts: z.string().datetime(),
  tsMs: z.number().int().nonnegative(), // ✅ better ordering + determinism
  type: NamespacedTypeSchema,
  source: SourceSchema,
  traceId: z.string().min(8),
  spanId: z.string().min(8),
  parentSpanId: z.string().min(8).optional(),
  severity: z.enum(["debug", "info", "warn", "error"]).default("info"),
  data: z.unknown(),
});

/** Strong typing for pipeline event types */
export const PipelineEventTypeSchema = z.enum([
  "pipeline.run.started",
  "pipeline.run.completed",
  "pipeline.stage.started",
  "pipeline.stage.completed",
  "pipeline.explain.request",
  "pipeline.explain.response",
]);

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

/** Shared shapes used inside envelope.data */
export const PipelineRunStartedDataSchema = z.object({
  runId: z.string().min(8),
  kind: z.enum(["prose", "code"]),
  inputHash: z.string().length(64),
});

export const PipelineRunCompletedDataSchema = z.object({
  runId: z.string().min(8),
  kind: z.enum(["prose", "code"]),
  inputHash: z.string().length(64),
  msTotal: z.number().nonnegative(),
  chosenId: z.string().min(8).nullable(),
});

export const PipelineStageStartedDataSchema = z.object({
  runId: z.string().min(8),
  stage: PipelineStageSchema,
});

export const PipelineStageCompletedDataSchema = z
  .object({
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
  })
  .superRefine((v, ctx) => {
    // ✅ invariant: if ok=false, error must exist
    if (!v.ok && !v.error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "error is required when ok=false",
        path: ["error"],
      });
    }
  });

export const PipelineExplainRequestDataSchema = z.object({
  runId: z.string().min(8),
  candidateId: z.string().min(8),
});

export const PipelineExplainResponseDataSchema = z.object({
  runId: z.string().min(8),
  candidateId: z.string().min(8),
  explanation: z.record(z.string(), z.unknown()),
});

// ----------------------------------------------------------------------------
// ✅ TRUE TYPE->DATA DISCRIMINATION
// ----------------------------------------------------------------------------

const Base = BusEnvelopeV1Schema.omit({ type: true, data: true });

const ERunStarted = Base.extend({
  type: z.literal("pipeline.run.started"),
  data: PipelineRunStartedDataSchema,
});

const ERunCompleted = Base.extend({
  type: z.literal("pipeline.run.completed"),
  data: PipelineRunCompletedDataSchema,
});

const EStageStarted = Base.extend({
  type: z.literal("pipeline.stage.started"),
  data: PipelineStageStartedDataSchema,
});

const EStageCompleted = Base.extend({
  type: z.literal("pipeline.stage.completed"),
  data: PipelineStageCompletedDataSchema,
});

const EExplainReq = Base.extend({
  type: z.literal("pipeline.explain.request"),
  data: PipelineExplainRequestDataSchema,
});

const EExplainRes = Base.extend({
  type: z.literal("pipeline.explain.response"),
  data: PipelineExplainResponseDataSchema,
});

/**
 * Pipeline envelope validator (type-discriminated)
 * ✅ Now `type` enforces correct `data` schema.
 */
export const PipelineEnvelopeSchema = z.discriminatedUnion("type", [
  ERunStarted,
  ERunCompleted,
  EStageStarted,
  EStageCompleted,
  EExplainReq,
  EExplainRes,
]);

export type PipelineEnvelope = z.infer<typeof PipelineEnvelopeSchema>;
export type PipelineEventType = z.infer<typeof PipelineEventTypeSchema>;
export type PipelineStage = z.infer<typeof PipelineStageSchema>;

// ----------------------------------------------------------------------------
// ✅ Optional: strongly typed builder (prevents mismatched type/data at compile time)
// ----------------------------------------------------------------------------

type DataByType = {
  "pipeline.run.started": z.infer<typeof PipelineRunStartedDataSchema>;
  "pipeline.run.completed": z.infer<typeof PipelineRunCompletedDataSchema>;
  "pipeline.stage.started": z.infer<typeof PipelineStageStartedDataSchema>;
  "pipeline.stage.completed": z.infer<typeof PipelineStageCompletedDataSchema>;
  "pipeline.explain.request": z.infer<typeof PipelineExplainRequestDataSchema>;
  "pipeline.explain.response": z.infer<typeof PipelineExplainResponseDataSchema>;
};

export function makePipelineEnvelope<T extends keyof DataByType>(args: {
  id: string;
  ts: string;
  tsMs: number;
  type: T;
  source: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  severity?: "debug" | "info" | "warn" | "error";
  data: DataByType[T];
}): PipelineEnvelope {
  // Zod will still validate at runtime ✅
  return PipelineEnvelopeSchema.parse({
    v: 1,
    severity: "info",
    ...args,
  });
}

export function makePipelineEnvelope(args) {
  // Zod will still validate at runtime ✅
  return PipelineEnvelopeSchema.parse({
    v: 1,
    severity: "info",
    ...args,
  });
}
