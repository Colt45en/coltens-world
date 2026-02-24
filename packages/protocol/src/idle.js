/**
 * packages/protocol/src/idle.ts
 *
 * Idle Autonomy Guard protocol: command/effect split
 * - idle.command.v1: sent by Nucleus to Python guard (prompt/approve/revoke)
 * - idle.effect.v1: emitted by Python guard to signal state changes
 *
 * Contract: These schemas are the source of truth for cross-boundary messaging
 */
import { z } from "zod";
// =============================================================================
// idle.command.v1 — from Nucleus to Python Guard
// =============================================================================
export const IdleCommandV1PayloadSchema = z.object({
    mode: z.string().min(1).describe("idle mode name (e.g. 'dream_idle')"),
    action: z
        .enum(["prompt", "approve", "revoke"])
        .describe("command action type"),
    args: z.record(z.any()).optional().describe("action arguments"),
});
// =============================================================================
// idle.effect.v1 — from Python Guard to Nucleus
// =============================================================================
export const IdleEffectV1PayloadSchema = z.object({
    mode: z.string().min(1).describe("idle mode name"),
    status: z
        .enum(["prompted", "approved", "activated", "revoked", "blocked"])
        .describe("effect status"),
    // optional context fields depending on status
    reason: z.string().optional().describe("block reason or revoke reason"),
    prompt_text: z.string().optional().describe("prompt text (for prompted status)"),
    approval_token: z.string().optional().describe("approval token (for approved/activated)"),
    observedCommandId: z.string().optional().describe("envelope ID of command that caused this effect"),
});
// =============================================================================
// Lazy state (persisted to JSON)
// =============================================================================
export const IdleGuardStateSchema = z.object({
    mode: z.string().min(1),
    prompted: z.boolean().default(false),
    prompt_text: z.string().default(""),
    approved: z.boolean().default(false),
    approval_token: z.string().default(""),
    approval_expires_ts: z.number().default(0),
    last_activation_ts: z.number().default(0),
    last_block_reason: z.string().default("never_checked"),
});
