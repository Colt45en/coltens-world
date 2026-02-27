import { z } from "zod";
import { SourceRecordSchema } from "./sourceRecord";
import { CanonicalIdSchema, LcidSchema, SemverSchema, Sha256HexSchema, StyleSpecSchema } from "./styleSpec";

/** Common envelope used by Nucleus tool-call lane */
export const ToolNameSchema = z.enum([
  "citation.style.ingest",
  "citation.sources.validate",
  "citation.render",
]);

export const ToolCallEnvelopeSchema = z
  .object({
    call_id: z.string().regex(/^[A-Za-z0-9._:-]{6,128}$/),
    tool: ToolNameSchema,
    input: z.unknown(), // narrowed per-tool below
  })
  .strict();

export type ToolCallEnvelope = z.infer<typeof ToolCallEnvelopeSchema>;

/** ===== citation.style.ingest ===== */

export const CitationStyleIngestInputSchema = z
  .object({
    style_spec: StyleSpecSchema,
    seal: z.boolean().default(false),
  })
  .strict();

export const CitationStyleIngestOutputSchema = z
  .object({
    style_id: CanonicalIdSchema,
    style_version: SemverSchema,
    style_hash: Sha256HexSchema, // sha256(canonical_json(style_spec))
    sealed: z.boolean(),
    sealed_at_utc: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/).optional(),
  })
  .strict();

/** ===== citation.sources.validate ===== */

export const CitationSourcesValidateInputSchema = z
  .object({
    style_id: CanonicalIdSchema,
    lcid: LcidSchema,
    sources: z.array(SourceRecordSchema).min(1),
  })
  .strict();

export const FieldIssueSchema = z
  .object({
    source_id: CanonicalIdSchema,
    source_type: z.string().min(1),
    missing_fields: z.array(z.string().min(1)),
    warnings: z.array(z.string().min(1)),
  })
  .strict();

export const CitationSourcesValidateOutputSchema = z
  .object({
    ok: z.boolean(),
    issues: z.array(FieldIssueSchema),
    normalized_sources_hash: Sha256HexSchema, // sha256(canonical_json(normalized_sources))
  })
  .strict();

/** ===== citation.render ===== */

export const RenderModeSchema = z.enum(["citation", "bibliography"]);
export const RenderFormatSchema = z.enum(["html", "text", "tokens"]);

export const CitationRenderInputSchema = z
  .object({
    style_id: CanonicalIdSchema,
    lcid: LcidSchema,
    mode: RenderModeSchema,
    format: RenderFormatSchema,
    include_trace: z.boolean().default(false),
    sources: z.array(SourceRecordSchema).min(1),
  })
  .strict();

/** Token output for explainable rendering */
export const RenderTokenSchema = z
  .object({
    kind: z.enum(["text", "space", "punct", "open", "close", "link", "field"]),
    value: z.string(),
    source_id: CanonicalIdSchema.optional(),
    field: z.string().optional(),
    rule_id: z.string().optional(),
  })
  .strict();

export const RenderTraceStepSchema = z
  .object({
    step_id: z.string().min(1),
    rule_id: z.string().min(1),
    source_id: CanonicalIdSchema.optional(),
    inputs: z.record(z.string(), z.unknown()),
    outputs: z.array(RenderTokenSchema),
    warnings: z.array(z.string()).default([]),
  })
  .strict();

export const RenderTraceSchema = z
  .object({
    trace_version: z.literal("1.0"),
    style_id: CanonicalIdSchema,
    lcid: LcidSchema,
    mode: RenderModeSchema,
    steps: z.array(RenderTraceStepSchema),
    trace_hash: Sha256HexSchema, // sha256(canonical_json(trace))
  })
  .strict();

export const CitationRenderOutputSchema = z
  .object({
    output: z.union([z.string(), z.array(RenderTokenSchema)]),
    output_hash: Sha256HexSchema, // sha256(bytes(output))
    style_hash: Sha256HexSchema,
    sources_hash: Sha256HexSchema,
    warnings: z.array(z.string()).default([]),
    trace: RenderTraceSchema.optional(),
  })
  .strict();

export type CitationStyleIngestInput = z.infer<typeof CitationStyleIngestInputSchema>;
export type CitationStyleIngestOutput = z.infer<typeof CitationStyleIngestOutputSchema>;
export type CitationSourcesValidateInput = z.infer<typeof CitationSourcesValidateInputSchema>;
export type CitationSourcesValidateOutput = z.infer<typeof CitationSourcesValidateOutputSchema>;
export type CitationRenderInput = z.infer<typeof CitationRenderInputSchema>;
export type CitationRenderOutput = z.infer<typeof CitationRenderOutputSchema>;
export type RenderToken = z.infer<typeof RenderTokenSchema>;
export type RenderMode = z.infer<typeof RenderModeSchema>;
export type RenderFormat = z.infer<typeof RenderFormatSchema>;
