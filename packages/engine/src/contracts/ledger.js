import { z } from "zod";
import { JsonValueSchema } from "./json.js";
export const LedgerEventInputSchema = z.object({
    type: z.string().min(1),
    doc_id: z.string().min(1),
    artifact_id: z.string().min(1).optional(),
    payload: JsonValueSchema.optional(),
});
export const LedgerEntrySchema = z.object({
    seq: z.number().int().positive(),
    ts_utc: z.string().min(1),
    type: z.string().min(1),
    doc_id: z.string().min(1),
    artifact_id: z.string().optional(),
    payload: JsonValueSchema.optional(),
    payload_hash: z.string().regex(/^[a-f0-9]{64}$/),
    prev_hash: z.string().regex(/^(0|[a-f0-9]{64})$/),
    entry_hash: z.string().regex(/^[a-f0-9]{64}$/),
});
export const LedgerStatusSchema = z.object({
    filePath: z.string().min(1),
    maxSeq: z.number().int().nonnegative(),
    lastHash: z.string().regex(/^(0|[a-f0-9]{64})$/),
});
export const LedgerRangeQuerySchema = z.object({
    start: z.coerce.number().int().positive(),
    end: z.coerce.number().int().positive(),
});
export const LedgerStreamQuerySchema = z.object({
    after_seq: z.coerce.number().int().nonnegative().default(0),
    limit: z.coerce.number().int().positive().max(500).default(200),
});
export const LedgerVerifyResultSchema = z.object({
    ok: z.boolean(),
    checked: z.number().int().nonnegative(),
    bad_seq: z.number().int().positive().optional(),
    reason: z.string().optional(),
});
//# sourceMappingURL=ledger.js.map