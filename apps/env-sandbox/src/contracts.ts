/**
 * Env-Sandbox Contracts: Type Definitions & Zod Schemas
 *
 * Single source of truth for all types in the system.
 * Zod schemas enable runtime validation at boundaries.
 * Implements policy-based governance, audit ledger, and process isolation.
 */

import { z } from "zod";

// ===== Capabilities =====
export const CapabilitySchema = z.enum([
  "read:env",
  "read:fs",
  "write:fs",
  "write:memory",
  "execute:code",
  "execute:child_process",
  "execute:worker",
  "network:client",
]);
export type Capability = z.infer<typeof CapabilitySchema>;

// ===== Resource Types =====
export const ResourceTypeSchema = z.enum(["file", "process", "network", "system", "sandbox"]);
export type ResourceType = z.infer<typeof ResourceTypeSchema>;

// ===== Policy Decision =====
export const DecisionSchema = z.enum(["allow", "deny", "audit", "ratelimit"]);
export type Decision = z.infer<typeof DecisionSchema>;

// ===== Severity Levels =====
export const SeveritySchema = z.enum(["info", "warning", "high", "critical"]);
export type Severity = z.infer<typeof SeveritySchema>;

// ===== Rate Limiting =====
export const RateLimitSchema = z
  .object({
    maxPerSecond: z.number().int().positive().optional(),
    maxPerMinute: z.number().int().positive().optional(),
  })
  .strict();

// ===== Rule Conditions =====
export const RuleConditionSchema = z
  .object({
    path: z.string().optional(), // glob-like: /tmp/*, **/*.json
    capability: CapabilitySchema.optional(),
    networkAllowed: z.boolean().optional(),
  })
  .strict();

// ===== Policy Rule =====
export const PolicyRuleSchema = z
  .object({
    id: z.string().min(1),
    resourceType: ResourceTypeSchema,
    action: DecisionSchema,
    operation: z.string().min(1),
    condition: RuleConditionSchema.optional(),
    priority: z.number().int().default(100),
    rateLimit: RateLimitSchema.optional(),
    createdAt: z.string().min(1),
  })
  .strict();
export type PolicyRule = z.infer<typeof PolicyRuleSchema>;

// ===== Policy =====
export const PolicySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    version: z.string().min(1),
    isActive: z.boolean(),
    isDefault: z.boolean(),
    rules: z.array(PolicyRuleSchema),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
  })
  .strict();
export type Policy = z.infer<typeof PolicySchema>;

// ===== Sandbox State =====
export const SandboxStateSchema = z.enum([
  "created",
  "initialized",
  "running",
  "completed",
  "failed",
  "destroyed",
]);
export type SandboxState = z.infer<typeof SandboxStateSchema>;

// ===== Sandbox Config =====
export const SandboxConfigSchema = z
  .object({
    policyId: z.string().min(1),
    capabilities: z.array(CapabilitySchema),
    memoryLimit: z.number().int().positive().default(512),
    diskLimit: z.number().int().positive().default(100),
    cpuLimit: z.number().int().positive().max(100).default(50),
    timeout: z.number().int().positive().default(30000),
    networkAllowed: z.boolean().default(false),
  })
  .strict();
export type SandboxConfig = z.infer<typeof SandboxConfigSchema>;

// ===== Sandbox =====
export const SandboxSchema = z
  .object({
    id: z.string().min(1),
    config: SandboxConfigSchema,
    state: SandboxStateSchema,
    createdAt: z.string().min(1),
    metadata: z.record(z.any()).optional(),
  })
  .strict();
export type Sandbox = z.infer<typeof SandboxSchema>;

// ===== Language =====
export const LanguageSchema = z.enum(["javascript", "typescript", "python", "bash", "json"]);
export type Language = z.infer<typeof LanguageSchema>;

// ===== Execution Request =====
export const ExecutionRequestSchema = z
  .object({
    sandboxId: z.string().min(1),
    language: LanguageSchema,
    code: z.string().min(1),
    args: z.record(z.any()).default({}),
  })
  .strict();
export type ExecutionRequest = z.infer<typeof ExecutionRequestSchema>;

// ===== Execution Response =====
export const ExecutionResponseSchema = z
  .object({
    ok: z.boolean(),
    stdout: z.string(),
    stderr: z.string(),
    result: z.any().optional(),
    exitCode: z.number().int().optional(),
    durationMs: z.number().int().nonnegative(),
  })
  .strict();
export type ExecutionResponse = z.infer<typeof ExecutionResponseSchema>;

// ===== Audit Event =====
export const AuditEventSchema = z
  .object({
    id: z.string().min(1),
    atUtc: z.string().min(1),
    action: z.string().min(1),
    actor: z.string().min(1),
    resourceType: ResourceTypeSchema,
    resource: z.record(z.any()).default({}),
    decision: z.enum(["allow", "deny", "audit"]),
    severity: SeveritySchema.default("info"),
    reason: z.string().optional(),
    sandboxId: z.string().optional(),
    prevHash: z.string().optional(),
    hash: z.string().optional(),
  })
  .strict();
export type AuditEvent = z.infer<typeof AuditEventSchema>;
