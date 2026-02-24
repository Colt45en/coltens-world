/**
 * Policy Module - Rule Enforcement
 *
 * Implements access control policies for sandbox execution:
 * - Rule evaluation (whitelist/blacklist/rate-limit)
 * - Resource isolation
 * - Capability-based access control (CapDAC)
 * - Policy composition and inheritance
 */

import { auditLog } from "./audit";
import type {
    Capability,
    Policy,
    PolicyRule,
    ResourceType
} from "./contracts";

// ============================================================================
// Policy Manager
// ============================================================================

export class PolicyManager {
    private policies: Map<string, Policy> = new Map();
    private defaultPolicy: Policy | null = null;
    private rateLimitState: Map<string, RateLimitBucket> = new Map();

    /**
     * Register a new policy
     */
    registerPolicy(policy: Policy): void {
        if (this.policies.has(policy.id)) {
            throw new Error(`Policy already registered: ${policy.id}`);
        }

        this.policies.set(policy.id, policy);

        if (policy.isDefault) {
            this.defaultPolicy = policy;
        }

        auditLog.policyCreated(policy.id, policy.name, {
            type: "system",
            id: "policy-manager",
        });
    }

    /**
     * Get policy by ID
     */
    getPolicy(policyId: string): Policy | null {
        return this.policies.get(policyId) || null;
    }

    /**
     * Update existing policy
     */
    updatePolicy(id: string, updates: Partial<Policy>): Policy {
        const existing = this.policies.get(id);
        if (!existing) {
            throw new Error(`Policy not found: ${id}`);
        }

        const updated: Policy = {
            ...existing,
            ...updates,
            id: existing.id, // immutable
            createdAt: existing.createdAt, // immutable
            updatedAt: new Date().toISOString(),
        };

        this.policies.set(id, updated);
        auditLog.policyUpdated(id, { type: "system", id: "policy-manager" });

        return updated;
    }

    /**
     * Get default policy (fallback)
     */
    getDefaultPolicy(): Policy {
        if (!this.defaultPolicy) {
            throw new Error("No default policy assigned");
        }
        return this.defaultPolicy;
    }

    /**
     * Evaluate policy against request
     */
    evaluatePolicy(
        policyId: string,
        resourceType: ResourceType,
        _action: string,
        context: Record<string, unknown>
    ): PolicyDecision {
        const policy = this.policies.get(policyId);
        if (!policy || !policy.isActive) {
            return {
                allowed: false,
                reason: `Policy not found or inactive: ${policyId}`,
                ruleFired: null,
            };
        }

        // Sort rules by priority (highest first)
        const sortedRules = [...policy.rules].sort((a, b) => b.priority - a.priority);

        for (const rule of sortedRules) {
            if (rule.resourceType !== resourceType) continue;

            if (!this._matchesCondition(rule, context)) continue;

            switch (rule.action) {
                case "allow":
                    return { allowed: true, reason: "Rule allowed", ruleFired: rule.id };

                case "deny":
                    auditLog.ruleTriggered(rule.id, "deny", String(context.path), {
                        type: "system",
                        id: "policy-manager",
                    });
                    return { allowed: false, reason: "Rule denied", ruleFired: rule.id };

                case "audit":
                    auditLog.ruleTriggered(rule.id, "audit", String(context.path), {
                        type: "system",
                        id: "policy-manager",
                    });
                    return { allowed: true, reason: "Audit rule", ruleFired: rule.id };

                case "ratelimit": {
                    const bucket = this._getRateLimitBucket(rule.id);
                    if (this._checkRateLimit(bucket, rule)) {
                        return { allowed: true, reason: "Rate limit OK", ruleFired: rule.id };
                    } else {
                        auditLog.violationDetected(
                            rule.id,
                            String(context.path),
                            { type: "system", id: "policy-manager" },
                            "Rate limit exceeded"
                        );
                        return { allowed: false, reason: "Rate limit exceeded", ruleFired: rule.id };
                    }
                }
            }
        }

        // Default: block if no rule matched
        return { allowed: false, reason: "No matching rule", ruleFired: null };
    }

    /**
     * Check if sandbox is allowed to use capability
     */
    checkCapability(
        policyId: string,
        capability: Capability,
        context: Record<string, unknown>
    ): boolean {
        const decision = this.evaluatePolicy(policyId, "system", `cap:${capability}`, context);
        return decision.allowed;
    }

    /**
     * List all policies
     */
    listPolicies(): Policy[] {
        return Array.from(this.policies.values());
    }

    /**
     * Internal: match rule conditions
     */
    private _matchesCondition(rule: PolicyRule, context: Record<string, unknown>): boolean {
        if (!rule.condition) return true;

        for (const [key, value] of Object.entries(rule.condition)) {
            const contextValue = context[key];

            // Simple glob matching for paths
            if (typeof value === "string" && typeof contextValue === "string") {
                if (value.includes("*")) {
                    const pattern = value.replace(/\*/g, ".*");
                    const regex = new RegExp(`^${pattern}$`);
                    if (!regex.test(contextValue)) return false;
                } else if (value !== contextValue) {
                    return false;
                }
            } else if (value !== contextValue) {
                return false;
            }
        }

        return true;
    }

    /**
     * Internal: get rate limit bucket
     */
    private _getRateLimitBucket(ruleId: string): RateLimitBucket {
        if (!this.rateLimitState.has(ruleId)) {
            this.rateLimitState.set(ruleId, {
                secondlyCount: 0,
                minutelyCount: 0,
                lastSecond: Date.now(),
                lastMinute: Date.now(),
            });
        }
        return this.rateLimitState.get(ruleId)!;
    }

    /**
     * Internal: check rate limit
     */
    private _checkRateLimit(bucket: RateLimitBucket, rule: PolicyRule): boolean {
        const now = Date.now();

        // Reset counters if time windows passed
        if (now - bucket.lastSecond > 1000) {
            bucket.secondlyCount = 0;
            bucket.lastSecond = now;
        }
        if (now - bucket.lastMinute > 60000) {
            bucket.minutelyCount = 0;
            bucket.lastMinute = now;
        }

        bucket.secondlyCount++;
        bucket.minutelyCount++;

        if (rule.rateLimit) {
            if (bucket.secondlyCount > rule.rateLimit.maxPerSecond) return false;
            if (bucket.minutelyCount > rule.rateLimit.maxPerMinute) return false;
        }

        return true;
    }
}

// ============================================================================
// Policy Decision Result
// ============================================================================

export interface PolicyDecision {
    allowed: boolean;
    reason: string;
    ruleFired: string | null;
}

// ============================================================================
// Rate Limit State
// ============================================================================

interface RateLimitBucket {
    secondlyCount: number;
    minutelyCount: number;
    lastSecond: number;
    lastMinute: number;
}

// ============================================================================
// Pre-defined Policies
// ============================================================================

export const BASELINE_POLICY: Policy = {
    id: "baseline",
    name: "Baseline (Permissive)",
    description: "Allow most operations with logging",
    version: "1.0.0",
    isDefault: true,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    rules: [
        {
            id: "baseline-allow-read",
            resourceType: "file",
            action: "audit",
            condition: { path: "/tmp/*" },
            priority: 10,
            createdAt: new Date().toISOString(),
        },
        {
            id: "baseline-deny-root",
            resourceType: "file",
            action: "deny",
            condition: { path: "/etc/*" },
            priority: 20,
            createdAt: new Date().toISOString(),
        },
    ],
};

export const RESTRICTIVE_POLICY: Policy = {
    id: "restrictive",
    name: "Restrictive (Dangerous Operations Blocked)",
    description: "Block network, file writes, process spawning",
    version: "1.0.0",
    isDefault: false,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    rules: [
        {
            id: "restrictive-deny-network",
            resourceType: "network",
            action: "deny",
            priority: 100,
            createdAt: new Date().toISOString(),
        },
        {
            id: "restrictive-deny-process",
            resourceType: "process",
            action: "deny",
            priority: 100,
            createdAt: new Date().toISOString(),
        },
        {
            id: "restrictive-readonly-files",
            resourceType: "file",
            action: "deny",
            condition: { operation: "write" },
            priority: 90,
            createdAt: new Date().toISOString(),
        },
    ],
};

export const SANDBOX_POLICY: Policy = {
    id: "sandbox",
    name: "Sandbox (Minimal Capabilities)",
    description: "Read-only environment, no networking",
    version: "1.0.0",
    isDefault: false,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    rules: [
        {
            id: "sandbox-allow-readonly",
            resourceType: "file",
            action: "allow",
            condition: { operation: "read", path: "/app/*" },
            priority: 50,
            createdAt: new Date().toISOString(),
        },
        {
            id: "sandbox-deny-writes",
            resourceType: "file",
            action: "deny",
            condition: { operation: "write" },
            priority: 100,
            createdAt: new Date().toISOString(),
        },
        {
            id: "sandbox-deny-network",
            resourceType: "network",
            action: "deny",
            priority: 100,
            createdAt: new Date().toISOString(),
        },
        {
            id: "sandbox-deny-process",
            resourceType: "process",
            action: "deny",
            priority: 100,
            createdAt: new Date().toISOString(),
        },
    ],
};

// ============================================================================
// Global Policy Manager
// ============================================================================

let globalPolicyManager: PolicyManager | null = null;

export function getPolicyManager(): PolicyManager {
    if (!globalPolicyManager) {
        globalPolicyManager = new PolicyManager();
        // Register built-in policies
        globalPolicyManager.registerPolicy(BASELINE_POLICY);
        globalPolicyManager.registerPolicy(RESTRICTIVE_POLICY);
        globalPolicyManager.registerPolicy(SANDBOX_POLICY);
    }
    return globalPolicyManager;
}

export function resetPolicyManager(): void {
    globalPolicyManager = null;
}
