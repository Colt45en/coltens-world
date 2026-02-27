import { z } from "zod";
import { JsonValueSchema } from "./json.js";

export const ToolCallStatusSchema = z.enum(["ok", "error", "rejected", "timeout"]);

export type ToolCallStatus = z.infer<typeof ToolCallStatusSchema>;

export const ToolCallRecordSchema = z.object({
  call_id: z.string().min(1),
  tool_name: z.string().min(1),
  doc_id: z.string().min(1).optional(),
  artifact_id: z.string().min(1).optional(),
  started_at_utc: z.string().min(1),
  ended_at_utc: z.string().min(1),
  status: ToolCallStatusSchema,
  input: JsonValueSchema.optional(),
  output: JsonValueSchema.optional(),
  error: z.string().optional(),
  input_hash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  output_hash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
});

export type ToolCallRecord = z.infer<typeof ToolCallRecordSchema>;
