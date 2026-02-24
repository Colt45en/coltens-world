import { z } from "zod";
import { FrameIndexSchema, GpuNodeIdSchema, NonEmptyStringSchema, StableIdSchema } from "./primitives";
import { WorkSubmissionIdSchema } from "./work";
/**
 * A backend-agnostic synchronization plan. DX12 maps to fences, Vulkan to semaphores/fences.
 * The plan explicitly encodes ordering edges and the primitive to use.
 */
export const SyncPrimitiveSchema = z.enum([
    "fence", // DX12 fence / VkFence
    "semaphore" // VkSemaphore-like (timeline or binary)
]);
export const SyncEdgeSchema = z
    .object({
    id: StableIdSchema,
    /**
     * A dependency edge between two work submissions.
     * - "toSubmissionId" MUST exist in this frame's work bundle.
     * - "fromSubmissionId" may be external (previous frame / other plan) depending on validator mode.
     */
    fromSubmissionId: WorkSubmissionIdSchema,
    toSubmissionId: WorkSubmissionIdSchema,
    fromNodeId: GpuNodeIdSchema,
    toNodeId: GpuNodeIdSchema,
    frameIndex: FrameIndexSchema,
    primitive: SyncPrimitiveSchema.default("fence"),
    /**
     * Deterministic label for tracing / evidence packets.
     */
    label: NonEmptyStringSchema
})
    .strict();
export const FrameSyncPlanSchema = z
    .object({
    frameIndex: FrameIndexSchema,
    edges: z.array(SyncEdgeSchema).default([])
})
    .strict();
