/* eslint-disable no-redeclare */
import { z } from "zod";

const HEX64 = /^[0-9a-f]{64}$/i;

export const SigilCompileFailureCodeV1 = z.enum([
  "SCHEMA_ERROR",
  "TOOL_FAILED",
  "LEDGER_APPEND_FAILED",
]);

export type SigilCompileFailureCodeV1 = z.infer<typeof SigilCompileFailureCodeV1>;

export const SigilCompileFailedStageV1 = z.enum(["parse", "compile", "ledger_append", "unknown"]);

export type SigilCompileFailedStageV1 = z.infer<typeof SigilCompileFailedStageV1>;

export const SigilCompileFailedBodyV1 = z
  .object({
    kind: z.literal("sigil.compile.failed"),
    v: z.literal(1),
    tool: z.literal("sigil.compile.v1"),
    request_id: z.string().min(1).max(200).nullable(),

    program_hash: z.string().regex(HEX64).nullable(),
    doc_id: z.string().min(1).max(400).nullable(),

    stage: SigilCompileFailedStageV1,

    error_code: z.string().min(1).max(80).optional(),

    error: z
      .object({
        code: z.string().min(1).max(80),
        message: z.string().min(1).max(400),
        message_hash: z.string().regex(HEX64),
      })
      .strict(),
  })
  .strict();

export type SigilCompileFailedBodyV1 = z.infer<typeof SigilCompileFailedBodyV1>;
