/**
 * Evidence Packet Contracts - Deterministic artifact export
 * Captures code + metrics + trace with cryptographic proof
 */
import { z } from "zod";
// ============================================================================
// Cryptographic hash
// ============================================================================
export const EvidenceHashZ = z.object({
    algo: z.literal("sha256"),
    hex: z.string().length(64), // exactly 64 hex chars
});
// ============================================================================
// File attachments (PNG, etc.)
// ============================================================================
export const EvidenceAttachmentZ = z.object({
    name: z.string().min(1).max(256),
    mime: z.string(),
    bytesBase64: z.string(), // raw bytes in base64 (NOT data: URL)
    hash: EvidenceHashZ,
});
// ============================================================================
// Trace events (for runtime context)
// ============================================================================
export const EvidenceTraceEventZ = z.object({
    t_ms: z.number().nonnegative(), // milliseconds since session start
    kind: z.string(), // "action.run", "edit", "export", etc.
    detail: z.record(z.unknown()).optional(),
});
export const EvidenceTraceZ = z.object({
    sessionId: z.string().min(16), // stable per browser device
    traceId: z.string().min(8), // deterministic per packet
    seq: z.number().int().nonnegative(), // monotonic per session
    events: z.array(EvidenceTraceEventZ).max(500),
});
// ============================================================================
// Main evidence packet
// ============================================================================
export const EvidencePacketZ = z.object({
    schema: z.object({
        name: z.literal("evidence.packet"),
        version: z.literal("1.1.0"),
    }),
    // Deterministic identity (derived from payload hash)
    packetId: z.string().min(16),
    // Non-deterministic but valuable timestamp
    createdAt: z.string().datetime(),
    source: z.object({
        system: z.string(), // e.g. "ide-web"
        tool: z.string(), // e.g. "flowstate"
        toolVersion: z.string(),
    }),
    subject: z.object({
        kind: z.enum(["code", "log", "analysis"]),
        languageHint: z.string().optional(),
    }),
    // The actual payload (code + metrics)
    payload: z.object({
        code: z.string(),
        flowstateMetrics: z.unknown(), // validate with FlowstateMetricsZ at call site
    }),
    // Cryptographic hashes for integrity verification
    hashes: z.object({
        payloadCanonical: EvidenceHashZ,
        code: EvidenceHashZ,
        metricsCanonical: EvidenceHashZ,
    }),
    // Session trace: who did what, when (relative to session start)
    trace: EvidenceTraceZ,
    // Optional file attachments (PNG screenshots, etc.)
    attachments: z.array(EvidenceAttachmentZ).max(8).default([]),
});
