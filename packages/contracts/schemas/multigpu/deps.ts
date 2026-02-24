import { z } from "zod";
import {
    FrameIndexSchema,
    GpuNodeIdSchema,
    NonEmptyStringSchema,
    StableIdSchema
} from "./primitives";

/**
 * Cross-GPU dependency = something produced on GPU A for frame P
 * that must be available on GPU B for frame C.
 *
 * This is the heart of AFR correctness.
 */

export const ResourceIdSchema = StableIdSchema;
export type ResourceId = z.infer<typeof ResourceIdSchema>;

export const ResourceClassSchema = z.enum([
    "texture",
    "buffer",
    "rtv",
    "uav",
    "descriptor_heap",
    "unknown"
]);
export type ResourceClass = z.infer<typeof ResourceClassSchema>;

export const CrossGpuCopyTimingSchema = z.enum([
    "end_of_frame_producer",
    "before_pass_consumer",
    "explicit_stage"
]);
export type CrossGpuCopyTiming = z.infer<typeof CrossGpuCopyTimingSchema>;

export const CrossGpuDependencySchema = z
    .object({
        id: StableIdSchema,

        resourceId: ResourceIdSchema,
        resourceClass: ResourceClassSchema.default("unknown"),

        producerFrameIndex: FrameIndexSchema,
        consumerFrameIndex: FrameIndexSchema,

        producerNodeId: GpuNodeIdSchema,
        consumerNodeId: GpuNodeIdSchema,

        /**
         * Why this dependency exists (deterministic and human-auditable).
         * Example: "TAA history required for temporal resolve"
         */
        reason: NonEmptyStringSchema,

        timing: CrossGpuCopyTimingSchema.default("end_of_frame_producer"),

        /**
         * Optional logical stages/passes:
         * - producerPassId: where it is finalized
         * - consumerPassId: where it is first read
         */
        producerPassId: StableIdSchema.optional(),
        consumerPassId: StableIdSchema.optional()
    })
    .strict();

export type CrossGpuDependency = z.infer<typeof CrossGpuDependencySchema>;

export const CrossGpuDependencyManifestSchema = z
    .object({
        id: StableIdSchema,
        description: NonEmptyStringSchema.optional(),
        dependencies: z.array(CrossGpuDependencySchema).default([])
    })
    .strict();

export type CrossGpuDependencyManifest = z.infer<typeof CrossGpuDependencyManifestSchema>;
