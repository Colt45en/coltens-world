import { z } from "zod";
import { JsonValueSchema } from "./json.js";

export const ArtifactSaveRequestSchema = z.object({
  docId: z.string().min(1),
  title: z.string().min(1),
  html: z.string().min(1),
  text: z.string().default(""),
  meta: JsonValueSchema.optional(),
});

export type ArtifactSaveRequest = z.infer<typeof ArtifactSaveRequestSchema>;

export const ArtifactSaveResponseSchema = z.object({
  artifact_id: z.string().regex(/^[a-f0-9]{64}$/),
  doc_id: z.string().min(1),
  created_at_utc: z.string().min(1),
  sort_key: z.string(),
  tie_break: z.string(),
  html_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  text_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  manifest_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  artifact_dir: z.string().min(1),
  ledger_seq: z.number().int().positive(),
  ledger_entry_hash: z.string().regex(/^[a-f0-9]{64}$/),
});

export type ArtifactSaveResponse = z.infer<typeof ArtifactSaveResponseSchema>;

export const ArtifactReadResponseSchema = z.object({
  manifest: JsonValueSchema,
  html: z.string(),
  text: z.string(),
});

export type ArtifactReadResponse = z.infer<typeof ArtifactReadResponseSchema>;

export const ArtifactLatestSchema = z.object({
  doc_id: z.string().min(1),
  artifact_id: z.string().regex(/^[a-f0-9]{64}$/),
  created_at_utc: z.string().min(1),
  path: z.string().min(1),
});

export type ArtifactLatest = z.infer<typeof ArtifactLatestSchema>;
