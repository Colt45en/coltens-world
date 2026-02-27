/**
 * Policy Manager: Rule Evaluation, Rate Limiting, Capabilities
 */

import type { Capability, Decision, Policy, ResourceType } from "./contracts.js";

/**
 * Builtin Policy: BASELINE (minimal restrictions)
 */
export const BASELINE_POLICY: Policy = {
  id: "baseline",
  name: "Baseline",
  version: "1.0.0",
  isActive: true,
  isDefault: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  rules: [
    {
      id: "r1",
      resourceType: "file",
      action: "allow",
      operation: "read",
      priority: 100,
      createdAt: new Date().toISOString(),
      condition: { path: "/workdir/**" },
    },
  ],
};

/**
 * Builtin Policy: RESTRICTIVE (high security)
 */
export const RESTRICTIVE_POLICY: Policy = {
  id: "restrictive",
  name: "Restrictive",
  version: "1.0.0",
  isActive: true,
  isDefault: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  rules: [
    {
      id: "r1",
      resourceType: "file",
      action: "deny",
      operation: "write",
      priority: 100,
      createdAt: new Date().toISOString(),
    },
    {
      id: "r2",
      resourceType: "network",
      action: "deny",
      operation: "connect",
      priority: 100,
      createdAt: new Date().toISOString(),
    },
  ],
};

/**
 * Builtin Policy: SANDBOX (full isolation)
 */
export const SANDBOX_POLICY: Policy = {
  id: "sandbox",
  name: "Sandbox",
  version: "1.0.0",
  isActive: true,
  isDefault: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  rules: [
    {
      id: "r1",
      resourceType: "file",
      action: "deny",
      operation: "read",
      priority: 100,
      createdAt: new Date().toISOString(),
    },
    {
      id: "r2",
      resourceType: "file",
      action: "deny",
      operation: "write",
      priority: 100,
      createdAt: new Date().toISOString(),
    },
    {
      id: "r3",
      resourceType: "network",
      action: "deny",
      operation: "connect",
      priority: 100,
      createdAt: new Date().toISOString(),
    },
    {
      id: "r4",
      resourceType: "process",
      action: "deny",
      operation: "spawn",
      priority: 100,
      createdAt: new Date().toISOString(),
    },
  ],
};

/**
 * RateLimitState: Tracks requests per operation
 */
interface RateLimitState {
  secondCounter: number;
  minuteCounter: number;
  lastSecond: number;
  lastMinute: number;
}

/**
 * PolicyManager: Evaluate rules, apply rate limiting, check capabilities
 */
export class PolicyManager {
  private policies: Map<string, Policy> = new Map();
  private rateLimitStates: Map<string, RateLimitState> = new Map();

  constructor(policies?: Policy[]) {
    // Initialize with builtins
    this.policies.set(BASELINE_POLICY.id, BASELINE_POLICY);
    this.policies.set(RESTRICTIVE_POLICY.id, RESTRICTIVE_POLICY);
    this.policies.set(SANDBOX_POLICY.id, SANDBOX_POLICY);

    // Add custom policies
    if (policies) {
      for (const policy of policies) {
        this.policies.set(policy.id, policy);
      }
    }
  }

  /**
   * Simple glob-like pattern matching (replace for minimatch)
   */
  private matchPattern(path: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexStr = pattern
      .replace(/\./g, "\\.")
      .replace(/\*\*/g, ".*")
      .replace(/\*/g, "[^/]*")
      .replace(/\?/g, ".");

    try {
      const regex = new RegExp(`^${regexStr}$`);
      return regex.test(path);
    } catch {
      return false;
    }
  }

  /**
   * Get a policy by ID
   */
  getPolicy(policyId: string): Policy | null {
    return this.policies.get(policyId) || null;
  }

  /**
   * List all policies
   */
  listPolicies(): Policy[] {
    return Array.from(this.policies.values());
  }

  /**
   * Add a policy
   */
  addPolicy(policy: Policy): void {
    this.policies.set(policy.id, policy);
  }

  /**
   * Evaluate a request against a policy
   */
  evaluate(
    policyId: string,
    resourceType: ResourceType,
    operation: string,
    path?: string
  ): Decision {
    const policy = this.getPolicy(policyId);
    if (!policy) {
      return "deny";
    }

    // Sort rules by priority (lower priority number = higher precedence)
    const sortedRules = [...policy.rules].sort((a, b) => a.priority - b.priority);

    for (const rule of sortedRules) {
      // Check resource type match
      if (rule.resourceType !== resourceType) {
        continue;
      }

      // Check operation match
      if (rule.operation !== operation) {
        continue;
      }

      // Check condition (path pattern if provided)
      if (rule.condition?.path && path) {
        if (!this.matchPattern(path, rule.condition.path)) {
          continue;
        }
      }

      // Match found, return decision
      return rule.action;
    }

    // No matching rule, default deny
    return "deny";
  }

  /**
   * Check if a capability is allowed by policy
   */
  hasCapability(policyId: string, capability: Capability): boolean {
    const policy = this.getPolicy(policyId);
    if (!policy) {
      return false;
    }

    // Map capability to (resourceType, operation)
    const [resourceType, operation] = capability.split(":") as [ResourceType, string];
    const decision = this.evaluate(policyId, resourceType, operation);
    return decision === "allow" || decision === "audit";
  }

  /**
   * Apply rate limiting
   */
  checkRateLimit(policyId: string, ruleId: string): { allowed: boolean; reason?: string } {
    const policy = this.getPolicy(policyId);
    if (!policy) {
      return { allowed: false, reason: "Policy not found" };
    }

    const rule = policy.rules.find((r) => r.id === ruleId);
    if (!rule || !rule.rateLimit) {
      return { allowed: true };
    }

    const key = `${policyId}:${ruleId}`;
    const now = Date.now();
    let state = this.rateLimitStates.get(key);

    if (!state) {
      state = {
        secondCounter: 0,
        minuteCounter: 0,
        lastSecond: now,
        lastMinute: now,
      };
      this.rateLimitStates.set(key, state);
    }

    // Reset counters if time windows have passed
    if (now - state.lastSecond > 1000) {
      state.secondCounter = 0;
      state.lastSecond = now;
    }

    if (now - state.lastMinute > 60000) {
      state.minuteCounter = 0;
      state.lastMinute = now;
    }

    // Check per-second limit
    if (rule.rateLimit.maxPerSecond) {
      if (state.secondCounter >= rule.rateLimit.maxPerSecond) {
        return {
          allowed: false,
          reason: `Rate limit exceeded (max ${rule.rateLimit.maxPerSecond}/sec)`,
        };
      }
      state.secondCounter++;
    }

    // Check per-minute limit
    if (rule.rateLimit.maxPerMinute) {
      if (state.minuteCounter >= rule.rateLimit.maxPerMinute) {
        return {
          allowed: false,
          reason: `Rate limit exceeded (max ${rule.rateLimit.maxPerMinute}/min)`,
        };
      }
      state.minuteCounter++;
    }

    return { allowed: true };
  }
}
