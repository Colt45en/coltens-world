import { z } from "zod";
import { StableIdSchema } from "../buildEvidence.js";

/**
 * World Engine — System Health Contracts
 * Goal: a single, authoritative shape for health snapshots across services.
 */

/** Stable ID type (re-exported from buildEvidence schema) */
export type StableId = z.infer<typeof StableIdSchema>;

/** ISO8601 timestamp with offset */
export const IsoTimeSchema = z.string().datetime({ offset: true });

/** Known services in your architecture */
export const ServiceNameSchema = z.enum([
    "nucleus",
    "ide",
    "preview",
    "sidecar",
    "brain"
]);
export type ServiceName = z.infer<typeof ServiceNameSchema>;

export const HealthStateSchema = z.enum(["up", "degraded", "down", "unknown"]);
export type HealthState = z.infer<typeof HealthStateSchema>;

export const ServiceHealthSchema = z
    .object({
        service: ServiceNameSchema,
        state: HealthStateSchema,

        /** Optional free-text reason; deterministic and short */
        reason: z.string().min(1).max(512).optional(),

        /**
         * Observed endpoint or transport (if applicable)
         * e.g. "http://127.0.0.1:8001/health" or "ws://localhost:3000"
         */
        target: z.string().min(1).max(512).optional(),

        /** Milliseconds to complete check (optional) */
        latencyMs: z.number().int().min(0).max(60_000).optional(),

        /** Semver-ish version if available */
        version: z.string().min(1).max(64).optional()
    })
    .strict();

export type ServiceHealth = z.infer<typeof ServiceHealthSchema>;

/**
 * The snapshot emitted on the bus. This should be:
 * - deterministic frequency (poll interval)
 * - stable schema
 * - safe for UI rendering
 */
export const SystemHealthSnapshotSchema = z
    .object({
        schema: z
            .object({
                name: z.literal("system.health.snapshot"),
                version: z.literal("1.0.0")
            })
            .strict(),

        id: StableIdSchema,
        ts: IsoTimeSchema,
        sessionId: StableIdSchema,

        /** Monotonic counter maintained by Nucleus to show freshness */
        seq: z.number().int().min(0),

        /** Individual service health checks */
        services: z.array(ServiceHealthSchema).min(1),

        /**
         * Optional global summary derived from services:
         * "up" if all up, "degraded" if any degraded, "down" if any down.
         */
        summary: HealthStateSchema
    })
    .strict();

export type SystemHealthSnapshot = z.infer<typeof SystemHealthSnapshotSchema>;

export function parseSystemHealthSnapshot(input: unknown): SystemHealthSnapshot {
    return SystemHealthSnapshotSchema.parse(input);
}

/** Bus type constant (keeps routing stable) */
export const SYSTEM_HEALTH_EVENT_TYPE = "system.health" as const;

/** Bus channel constant */
export const SYSTEM_CHANNEL = "system" as const;
