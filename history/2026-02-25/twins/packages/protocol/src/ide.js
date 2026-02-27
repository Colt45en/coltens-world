import { z } from "zod";
import { SessionIdSchema, TraceIdSchema } from "./types";
// ============================================================================
// IDE CLI RUN - execute pnpm scripts safely
// ============================================================================
export const IdeCliRunRequestSchema = z
    .object({
    type: z.literal("ide.cli.run.request"),
    sessionId: SessionIdSchema,
    traceId: TraceIdSchema.optional(),
    payload: z.object({
        cwd: z.string().optional(),
        command: z.string().min(1),
        timeoutMs: z.number().int().min(1000).max(120000).default(30000),
    }),
})
    .strict();
export const IdeCliRunResponseSchema = z
    .object({
    type: z.literal("ide.cli.run.response"),
    sessionId: SessionIdSchema,
    traceId: TraceIdSchema.optional(),
    payload: z.object({
        ok: z.boolean(),
        exitCode: z.number().int(),
        stdout: z.string(),
        stderr: z.string(),
    }),
})
    .strict();
// ============================================================================
// IDE FS READ - read files safely (docs/, .brain/)
// ============================================================================
export const IdeFsReadRequestSchema = z
    .object({
    type: z.literal("ide.fs.read.request"),
    sessionId: SessionIdSchema,
    traceId: TraceIdSchema.optional(),
    payload: z.object({
        path: z.string().min(1),
        encoding: z.literal("utf8").default("utf8"),
        maxBytes: z.number().int().min(1024).max(5_000_000).default(1_000_000),
    }),
})
    .strict();
export const IdeFsReadResponseSchema = z
    .object({
    type: z.literal("ide.fs.read.response"),
    sessionId: SessionIdSchema,
    traceId: TraceIdSchema.optional(),
    payload: z.object({
        ok: z.boolean(),
        path: z.string(),
        content: z.string().optional(),
        error: z.string().optional(),
    }),
})
    .strict();
