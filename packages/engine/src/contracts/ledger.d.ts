import { z } from "zod";
export declare const LedgerEventInputSchema: z.ZodObject<{
    type: z.ZodString;
    doc_id: z.ZodString;
    artifact_id: z.ZodOptional<z.ZodString>;
    payload: z.ZodOptional<z.ZodType<unknown, z.ZodTypeDef, unknown>>;
}, "strip", z.ZodTypeAny, {
    type: string;
    doc_id: string;
    artifact_id?: string | undefined;
    payload?: unknown;
}, {
    type: string;
    doc_id: string;
    artifact_id?: string | undefined;
    payload?: unknown;
}>;
export type LedgerEventInput = z.infer<typeof LedgerEventInputSchema>;
export declare const LedgerEntrySchema: z.ZodObject<{
    seq: z.ZodNumber;
    ts_utc: z.ZodString;
    type: z.ZodString;
    doc_id: z.ZodString;
    artifact_id: z.ZodOptional<z.ZodString>;
    payload: z.ZodOptional<z.ZodType<unknown, z.ZodTypeDef, unknown>>;
    payload_hash: z.ZodString;
    prev_hash: z.ZodString;
    entry_hash: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: string;
    doc_id: string;
    seq: number;
    ts_utc: string;
    payload_hash: string;
    prev_hash: string;
    entry_hash: string;
    artifact_id?: string | undefined;
    payload?: unknown;
}, {
    type: string;
    doc_id: string;
    seq: number;
    ts_utc: string;
    payload_hash: string;
    prev_hash: string;
    entry_hash: string;
    artifact_id?: string | undefined;
    payload?: unknown;
}>;
export type LedgerEntry = z.infer<typeof LedgerEntrySchema>;
export declare const LedgerStatusSchema: z.ZodObject<{
    filePath: z.ZodString;
    maxSeq: z.ZodNumber;
    lastHash: z.ZodString;
}, "strip", z.ZodTypeAny, {
    filePath: string;
    maxSeq: number;
    lastHash: string;
}, {
    filePath: string;
    maxSeq: number;
    lastHash: string;
}>;
export type LedgerStatus = z.infer<typeof LedgerStatusSchema>;
export declare const LedgerRangeQuerySchema: z.ZodObject<{
    start: z.ZodNumber;
    end: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    start: number;
    end: number;
}, {
    start: number;
    end: number;
}>;
export type LedgerRangeQuery = z.infer<typeof LedgerRangeQuerySchema>;
export declare const LedgerStreamQuerySchema: z.ZodObject<{
    after_seq: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    after_seq: number;
    limit: number;
}, {
    after_seq?: number | undefined;
    limit?: number | undefined;
}>;
export type LedgerStreamQuery = z.infer<typeof LedgerStreamQuerySchema>;
export declare const LedgerVerifyResultSchema: z.ZodObject<{
    ok: z.ZodBoolean;
    checked: z.ZodNumber;
    bad_seq: z.ZodOptional<z.ZodNumber>;
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    ok: boolean;
    checked: number;
    bad_seq?: number | undefined;
    reason?: string | undefined;
}, {
    ok: boolean;
    checked: number;
    bad_seq?: number | undefined;
    reason?: string | undefined;
}>;
export type LedgerVerifyResult = z.infer<typeof LedgerVerifyResultSchema>;
//# sourceMappingURL=ledger.d.ts.map