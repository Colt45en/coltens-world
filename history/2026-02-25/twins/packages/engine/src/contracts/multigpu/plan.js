import { z } from "zod";
import { CrossGpuDependencyManifestSchema } from "./deps";
import { PacingPolicySchema } from "./pacing";
import { FrameIndexSchema, GpuCountSchema, NonEmptyStringSchema, StableIdSchema } from "./primitives";
import { FrameSyncPlanSchema } from "./sync";
import { FrameWorkBundleSchema } from "./work";
/**
 * The top-level MultiGPU plan for a frame.
 * This is your "RenderFramePlan but MultiGPU-aware."
 */
export const MultiGpuFramePlanSchema = z
    .object({
    schema: z
        .object({
        name: z.literal("engine.multigpu.frame_plan"),
        version: z.string().regex(/^\d+\.\d+\.\d+$/, "Expected semver like 1.2.3")
    })
        .strict(),
    id: StableIdSchema,
    frameIndex: FrameIndexSchema,
    gpuCount: GpuCountSchema,
    /**
     * Partition strategy used for this plan.
     * Start with AFR; keep open for SFR/split-pass later.
     */
    partitionStrategy: z.enum(["afr", "sfr", "split_pass", "asymmetric"]).default("afr"),
    /**
     * Work submissions for this frame (may include copy/present submissions).
     */
    work: FrameWorkBundleSchema,
    /**
     * Cross-GPU dependency transfers required for correctness.
     */
    deps: CrossGpuDependencyManifestSchema,
    /**
     * Synchronization edges derived from work+deps (or authored explicitly).
     */
    sync: FrameSyncPlanSchema,
    /**
     * Pacing/latency rules for stable output.
     */
    pacing: PacingPolicySchema,
    /**
     * Deterministic note describing intent for audits.
     */
    note: NonEmptyStringSchema.optional()
})
    .strict();
export function parseMultiGpuFramePlan(input) {
    return MultiGpuFramePlanSchema.parse(input);
}
