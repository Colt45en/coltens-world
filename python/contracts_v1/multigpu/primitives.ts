import { z } from "zod";

/** ---------- Core primitives (stable, small, reusable) ---------- */

export const StableIdSchema = z
    .string()
    .min(3)
    .max(128)
    .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/, "StableId must be URL/filename-safe.");

export type StableId = z.infer<typeof StableIdSchema>;

export const NonEmptyStringSchema = z.string().min(1);

/**
 * Unsigned integer as a decimal string.
 * Used for values that might exceed JS safe integer range or bitwise limits.
 */
export const U64StringSchema = z
    .string()
    .regex(/^(0|[1-9]\d*)$/, "Expected unsigned integer string.");

export type U64String = z.infer<typeof U64StringSchema>;

export const FrameIndexSchema = z.number().int().min(0);
export type FrameIndex = z.infer<typeof FrameIndexSchema>;

export const GpuCountSchema = z.number().int().min(1).max(32);
export type GpuCount = z.infer<typeof GpuCountSchema>;

/**
 * Node IDs 0..63 are common in APIs that use 64-bit masks.
 * You can clamp back to 31 if your backend truly requires it.
 */
export const GpuNodeIdSchema = z.number().int().min(0).max(63);
export type GpuNodeId = z.infer<typeof GpuNodeIdSchema>;

/**
 * DX12-style NodeMask. Keep as decimal string for safety.
 * Supports up to 64 nodes (0..63) without JS bitwise overflow.
 */
export const NodeMaskSchema = U64StringSchema;
export type NodeMask = z.infer<typeof NodeMaskSchema>;

/** ISO8601 timestamp */
export const IsoTimeSchema = z.string().datetime({ offset: true });

/** ---------- Helpers (deterministic routing) ---------- */

/** Deterministic AFR routing: gpuIndex = frameIndex % gpuCount */
export function routeFrameToGpuNode(frameIndex: number, gpuCount: number): number {
    if (!Number.isInteger(frameIndex) || frameIndex < 0) throw new Error("frameIndex must be int >= 0");
    if (!Number.isInteger(gpuCount) || gpuCount < 1) throw new Error("gpuCount must be int >= 1");
    return frameIndex % gpuCount;
}

/** NodeMask for a single nodeId (string-safe, supports 0..63) */
export function nodeMaskForNode(nodeId: number): NodeMask {
    if (!Number.isInteger(nodeId) || nodeId < 0 || nodeId > 63) throw new Error("nodeId must be 0..63");
    const mask = 1n << BigInt(nodeId);
    return mask.toString(10) as NodeMask;
}

/** NodeMask for multiple nodes */
export function nodeMaskForNodes(nodeIds: number[]): NodeMask {
    if (!Array.isArray(nodeIds) || nodeIds.length === 0) throw new Error("nodeIds must be non-empty");
    let mask = 0n;
    for (const id of nodeIds) {
        if (!Number.isInteger(id) || id < 0 || id > 63) throw new Error("nodeId must be 0..63");
        mask |= 1n << BigInt(id);
    }
    return mask.toString(10) as NodeMask;
}
