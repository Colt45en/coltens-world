/**
 * FlowState Contracts - Code visualization & telemetry
 * Deterministic metrics for code analysis (energy, tempo, tension)
 */
import { z } from "zod";
// ============================================================================
// Token histogram
// ============================================================================
export const FlowstateTokenCountZ = z.object({
    token: z.string(),
    count: z.number().int().nonnegative(),
});
// ============================================================================
// Metrics payload (deterministic output)
// ============================================================================
export const FlowstateMetricsZ = z.object({
    schema: z.object({
        name: z.literal("flowstate.metrics"),
        version: z.literal("1.0.0"),
    }),
    input: z.object({
        textLength: z.number().int().nonnegative(),
        lineCount: z.number().int().positive(),
    }),
    metrics: z.object({
        energy: z.number().min(0).max(1.5), // normalized (allow slight overflow)
        tempo: z.number().min(0).max(1), // symbol + operation density
        tension: z.number().int().nonnegative(), // remaining + mismatch*2
        remainingBraces: z.number().int().nonnegative(),
        mismatchBraces: z.number().int().nonnegative(),
        keywordCount: z.number().int().nonnegative(),
        tokenCount: z.number().int().nonnegative(),
        density: z.number().nonnegative(), // tokens per line
    }),
    topTokens: z.array(FlowstateTokenCountZ).max(128),
});
// ============================================================================
// Request (bus command)
// ============================================================================
export const FlowstateAnalyzeRequestZ = z.object({
    schema: z.object({
        name: z.literal("flowstate.analyze.request"),
        version: z.literal("1.0.0"),
    }),
    code: z.string(),
    topN: z.number().int().min(1).max(128).default(32),
});
