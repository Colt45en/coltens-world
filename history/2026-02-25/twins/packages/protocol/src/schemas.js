import { z } from "zod";
/**
 * Envelope validation with backward compatibility
 *
 * Handshake (system.hello): nonce/auth optional (server doesn't validate yet)
 * All other messages: server enforces nonce + auth (see wsHub.ts middleware)
 */
const AuthSchema = z.discriminatedUnion("kind", [
    z.object({
        kind: z.literal("session"),
        token: z.string().min(16).max(256),
    }),
    z.object({
        kind: z.literal("hmac"),
        token: z.string().min(16).max(256),
        sig: z.string().min(16).max(512),
    }),
]);
export const EnvelopeSchema = z
    .object({
    v: z.number().int().min(1),
    id: z.string().min(1),
    type: z.string().min(1),
    ts: z.number().int().nonnegative(),
    from: z.object({
        role: z.string().min(1), // NOT validated here; role derived from session
        instanceId: z.string().min(1),
    }),
    sessionId: z.string().min(1),
    payload: z.unknown(),
    // v2: optional in schema (enforced by wsHub middleware)
    nonce: z.string().min(8).max(128).optional(),
    auth: AuthSchema.optional(),
    caps: z.array(z.string().min(1)).max(128).optional(),
    trace: z
        .object({
        parentId: z.string().min(1).optional(),
        spanId: z.string().min(1).optional(),
    })
        .optional(),
})
    // Allow extra keys for forward compatibility
    .passthrough();
