import { z } from "zod";
import { NonEmptyStringSchema, StableIdSchema } from "./primitives";
/**
 * AFR commonly fails on pacing (microstutter + latency).
 * This contract forces you to pick explicit policy knobs.
 */
export const PresentOrderSchema = z.enum([
    "frame_index_order", // always present in ascending frame index order
    "as_ready_but_ordered" // allow ready frames but still enforce ordering (may queue)
]);
export const PacingModeSchema = z.enum([
    "throughput_first",
    "latency_bounded",
    "balanced"
]);
export const PacingPolicySchema = z
    .object({
    id: StableIdSchema,
    mode: PacingModeSchema.default("balanced"),
    /**
     * AFR often needs 1-2 frames in flight per GPU to overlap well,
     * but too many increases latency and variance.
     */
    maxFramesInFlight: z.number().int().min(1).max(8).default(2),
    /** Enforce deterministic present ordering */
    presentOrder: PresentOrderSchema.default("frame_index_order"),
    /**
     * Optional latency budget target in milliseconds.
     * Used by scheduler to clamp frames-in-flight / queue depth.
     */
    latencyBudgetMs: z.number().min(0).optional(),
    /**
     * Deterministic label for logs and evidence.
     */
    label: NonEmptyStringSchema.default("default.pacing")
})
    .strict();
