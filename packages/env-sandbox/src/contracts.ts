/**
 * Env-Sandbox Contract Types
 *
 * Defines Zod schemas for sandboxed execution governance:
 * - Environment policies (whitelist/blacklist rules)
 * - Audit events (append-only ledger)
 * - Execution sandboxes (isolated contexts)
 * - Capability tokens (access control)
 */

import { z } from "zod";

// ============================================================================
// Capability & Access Control
// ============================================================================

export const CapabilitySchema = z.enum([
    "read:env",
    "write:env",
    "delete:env",
    "read:memory",
    "write:memory",
    "execute:code",
    "network:http",
    "network:dns",
    "file:read",
    "file:write",
    "file:delete",
    "process:spawn",
    "process:kill",
    "system:info",
]);

export type Capability = z.infer<typeof CapabilitySchema>;

export const AccessLevelSchema = z.enum([
    "unrestricted",
    "restricted",
    "readonly",
    "blocked",
]);

export type AccessLevel = z.infer<typeof AccessLevelSchema>;

// ============================================================================
// Policies
// ============================================================================

export const ResourceTypeSchema = z.enum([
    "environment",
    "memory",
    "code",
    "network",
    "file",
    "process",
    "system",
]);

export type ResourceType = z.infer<typeof ResourceTypeSchema>;

export const PolicyRuleSchema = z.object({
    id: z.string().min(1).describe("Unique rule ID"),
    resourceType: ResourceTypeSchema,
    action: z.enum(["allow", "deny", "audit", "ratelimit"]).describe("Action to take"),
    condition: z.record(z.unknown()).optional().describe("Match conditions (e.g. { path: '/tmp/*' })"),
    rateLimit: z.object({
        maxPerSecond: z.number().positive(),
        maxPerMinute: z.number().positive(),
    }).optional().describe("Rate limit if action is 'ratelimit'"),
    priority: z.number().int().min(0).describe("Higher = evaluated first"),
    createdAt: z.string().datetime().describe("Rule creation timestamp"),
});

export type PolicyRule = z.infer<typeof PolicyRuleSchema>;

export const PolicySchema = z.object({
    id: z.string().min(1).describe("Policy ID (e.g. 'baseline', 'restrictive')"),
    name: z.string().describe("Human-readable name"),
    description: z.string().optional(),
    rules: z.array(PolicyRuleSchema).describe("Ordered list of rules"),
    isDefault: z.boolean().default(false).describe("Use as default for new sandboxes"),
    isActive: z.boolean().default(true).describe("Policy is enforced"),
    version: z.string().regex(/^\d+\.\d+\.\d+$/).describe("SemVer version"),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});

export type Policy = z.infer<typeof PolicySchema>;

// ============================================================================
// Audit & Compliance
// ============================================================================

export const AuditActionSchema = z.enum([
    "policy:created",
    "policy:updated",
    "policy:deleted",
    "sandbox:created",
    "sandbox:executed",
    "sandbox:destroyed",
    "resource:accessed",
    "resource:modified",
    "capability:granted",
    "capability:revoked",
    "rule:triggered",
    "violation:detected",
]);

export type AuditAction = z.infer<typeof AuditActionSchema>;

export const AuditEventSchema = z.object({
    id: z.string().uuid().describe("Unique event ID"),
    timestamp: z.string().datetime().describe("Event timestamp (UTC)"),
    action: AuditActionSchema,
    actor: z.object({
        type: z.enum(["system", "user", "service"]),
        id: z.string(),
        name: z.string().optional(),
    }),
    sandboxId: z.string().optional().describe("Affected sandbox ID"),
    policyId: z.string().optional().describe("Affected policy ID"),
    resource: z.object({
        type: ResourceTypeSchema,
        path: z.string(),
        metadata: z.record(z.unknown()).optional(),
    }).optional(),
    ruleId: z.string().optional().describe("Triggered rule ID"),
    decision: z.enum(["allow", "deny"]).optional(),
    metadata: z.record(z.unknown()).optional().describe("Additional context"),
    severity: z.enum(["info", "warning", "error", "critical"]).default("info"),
});

export type AuditEvent = z.infer<typeof AuditEventSchema>;

// Append-only, never modified
export const AuditLogSchema = z.object({
    entries: z.array(AuditEventSchema).describe("Immutable audit events"),
    hash: z.string().optional().describe("Merkle-style hash chain"),
    sealed: z.boolean().default(false).describe("Finalized (no more appends)"),
});

export type AuditLog = z.infer<typeof AuditLogSchema>;

// ============================================================================
// Sandbox Execution Context
// ============================================================================

export const SandboxStateSchema = z.enum([
    "created",
    "initialized",
    "running",
    "paused",
    "completed",
    "failed",
    "destroyed",
]);

export type SandboxState = z.infer<typeof SandboxStateSchema>;

export const SandboxConfigSchema = z.object({
    id: z.string().min(1).describe("Unique sandbox ID"),
    name: z.string().optional(),
    policyId: z.string().describe("Policy to enforce"),
    capabilities: z.array(CapabilitySchema).describe("Granted capabilities"),
    environmentVars: z.record(z.string()).optional().describe("Isolated env vars"),
    memoryLimit: z.number().positive().optional().describe("MB"),
    diskLimit: z.number().positive().optional().describe("MB"),
    cpuLimit: z.number().positive().max(100).optional().describe("% of 1 CPU"),
    timeout: z.number().positive().optional().describe("Milliseconds"),
    networkAllowed: z.boolean().default(false),
    codexRules: z.record(z.unknown()).optional().describe("Codex system rules for sandbox"),
});

export type SandboxConfig = z.infer<typeof SandboxConfigSchema>;

export const SandboxExecutionResultSchema = z.object({
    sandboxId: z.string(),
    state: SandboxStateSchema,
    startedAt: z.string().datetime(),
    completedAt: z.string().datetime().optional(),
    exitCode: z.number().int().optional().describe("0 = success"),
    stdout: z.string().optional(),
    stderr: z.string().optional(),
    memoryUsed: z.number().optional().describe("MB"),
    cpuTime: z.number().optional().describe("Milliseconds"),
    violations: z.array(AuditEventSchema).optional().describe("Policy violations during execution"),
});

export type SandboxExecutionResult = z.infer<typeof SandboxExecutionResultSchema>;

export const SandboxSchema = z.object({
    id: z.string().min(1),
    name: z.string().optional(),
    config: SandboxConfigSchema,
    state: SandboxStateSchema.default("created"),
    result: SandboxExecutionResultSchema.optional(),
    createdAt: z.string().datetime(),
    metadata: z.record(z.unknown()).optional(),
});

export type Sandbox = z.infer<typeof SandboxSchema>;

// ============================================================================
// Execution & Invocation
// ============================================================================

export const ExecutionRequestSchema = z.object({
    sandboxId: z.string(),
    code: z.string().describe("Code to execute (TypeScript/Python/bash)"),
    language: z.enum(["typescript", "python", "bash", "json"]),
    args: z.record(z.unknown()).optional().describe("Arguments to pass"),
    timeout: z.number().positive().optional().describe("Override sandbox timeout"),
});

export type ExecutionRequest = z.infer<typeof ExecutionRequestSchema>;

export const ExecutionResponseSchema = z.object({
    success: z.boolean(),
    sandboxId: z.string(),
    result: z.unknown().optional().describe("Execution result"),
    error: z.string().optional(),
    auditEvent: AuditEventSchema,
});

export type ExecutionResponse = z.infer<typeof ExecutionResponseSchema>;

// ============================================================================
// Validation Helpers
// ============================================================================

export function validateCapability(cap: unknown): Capability {
    return CapabilitySchema.parse(cap);
}

export function validatePolicy(p: unknown): Policy {
    return PolicySchema.parse(p);
}

export function validateAuditEvent(e: unknown): AuditEvent {
    return AuditEventSchema.parse(e);
}

export function validateSandbox(s: unknown): Sandbox {
    return SandboxSchema.parse(s);
}

export function validateExecutionRequest(r: unknown): ExecutionRequest {
    return ExecutionRequestSchema.parse(r);
}
