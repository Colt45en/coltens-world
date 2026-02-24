import { z } from "zod";
import { FrameIndexSchema, GpuNodeIdSchema, NodeMaskSchema, NonEmptyStringSchema, StableIdSchema } from "./primitives";
/**
 * A unit of work the engine intends to submit to a specific GPU node.
 * This is API-agnostic (DX12/Vulkan). The backend adapter translates it.
 */
export const GpuWorkKindSchema = z.enum([
    "graphics",
    "compute",
    "copy",
    "present"
]);
export const WorkSubmissionIdSchema = StableIdSchema;
export const GpuWorkSubmissionSchema = z
    .object({
    id: WorkSubmissionIdSchema,
    frameIndex: FrameIndexSchema,
    /** Which node will execute this work */
    nodeId: GpuNodeIdSchema,
    /** Optional explicit NodeMask for APIs that use it (DX12 linked nodes) */
    nodeMask: NodeMaskSchema.optional(),
    kind: GpuWorkKindSchema,
    /**
     * Deterministic label for tracing and evidence packets.
     * Example: "frame.102.graphics.main"
     */
    label: NonEmptyStringSchema,
    /**
     * Backend-specific command buffer references are NOT allowed in contracts.
     * Use logical refs and let the backend map them.
     */
    logicalPassId: StableIdSchema.optional(),
    logicalQueueId: StableIdSchema.optional(),
    /**
     * Dependency edges to other submissions (same or other GPU).
     * The sync plan will resolve these into fences/semaphores.
     */
    dependsOn: z.array(WorkSubmissionIdSchema).default([])
})
    .strict();
/** Convenience: a frame's work grouped by node */
export const FrameWorkBundleSchema = z
    .object({
    frameIndex: FrameIndexSchema,
    submissions: z.array(GpuWorkSubmissionSchema).min(1)
})
    .strict();
