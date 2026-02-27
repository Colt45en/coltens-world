import { z } from "zod";
export const ProtocolVersion = z.literal("1.0.0");
export const MsgMeta = z.object({
    v: ProtocolVersion,
    ts: z.number().int(),
    requestId: z.string().min(8).optional(),
    traceId: z.string().min(8).optional(),
    source: z.string().min(1).optional(),
});
/**
 * Envelope builder for typed messages
 *
 * ⚠️ CONSTRAINT: All envelope payloads MUST be JSON-serializable
 * This ensures compatibility with:
 * - Network serialization (WS, HTTP)
 * - Persistence (files, databases)
 * - Worker messaging
 * - Event logging
 *
 * Use coerceJsonValue() or requireJsonValue() to validate payloads before wrapping.
 */
export const Envelope = (payload) => z.object({
    meta: MsgMeta,
    ...payload.shape,
});
