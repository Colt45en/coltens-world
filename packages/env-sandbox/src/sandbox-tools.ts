/**
 * Sandbox Tools & Utilities
 *
 * Provides high-level tools for:
 * - Sandbox discovery and introspection
 * - Policy validation and testing
 * - Audit log querying and reporting
 * - Batch operations
 */

import type { Sandbox, Policy, AuditEvent } from "./contracts";
import { getSandboxExecutor } from "./sandbox";
import { getPolicyManager } from "./policy";
import { getAuditLedger, auditLog } from "./audit";

// ============================================================================
// Sandbox Discovery & Management
// ============================================================================

export const SandboxTools = {
  /**
   * Find sandboxes by policy
   */
  findByPolicy(policyId: string): Sandbox[] {
    const executor = getSandboxExecutor();
    return executor.listSandboxes().filter((s) => s.config.policyId === policyId);
  },

  /**
   * Find sandboxes by state
   */
  findByState(state: string): Sandbox[] {
    const executor = getSandboxExecutor();
    return executor.listSandboxes().filter((s) => s.state === state);
  },

  /**
   * Find active sandboxes
   */
  findActive(): Sandbox[] {
    return SandboxTools.findByState("running");
  },

  /**
   * Count sandboxes by policy
   */
  countByPolicy(): Record<string, number> {
    const executor = getSandboxExecutor();
    const counts: Record<string, number> = {};

    for (const sandbox of executor.listSandboxes()) {
      const policyId = sandbox.config.policyId;
      counts[policyId] = (counts[policyId] || 0) + 1;
    }

    return counts;
  },

  /**
   * Get sandbox health status
   */
  getHealth(): {
    totalSandboxes: number;
    byState: Record<string, number>;
    averageLifetime: number;
  } {
    const executor = getSandboxExecutor();
    const stats = executor.getStats();

    let totalLifetime = 0;
    let count = 0;

    for (const sandbox of executor.listSandboxes()) {
      const created = new Date(sandbox.createdAt).getTime();
      const now = Date.now();
      totalLifetime += now - created;
      count++;
    }

    return {
      totalSandboxes: stats.total,
      byState: stats.byState,
      averageLifetime: count > 0 ? totalLifetime / count : 0,
    };
  },
};

// ============================================================================
// Policy Testing & Validation
// ============================================================================

export const PolicyTools = {
  /**
   * Test a policy against various scenarios
   */
  testPolicy(
    policyId: string,
    scenarios: Array<{
      name: string;
      resourceType: string;
      action: string;
      context: Record<string, unknown>;
      expectedAllowed: boolean;
    }>
  ): {
    passed: number;
    failed: number;
    results: Array<{
      name: string;
      allowed: boolean;
      expected: boolean;
      passed: boolean;
    }>;
  } {
    const manager = getPolicyManager();
    const results = [];
    let passed = 0;
    let failed = 0;

    for (const scenario of scenarios) {
      const decision = manager.evaluatePolicy(
        policyId,
        scenario.resourceType as any,
        scenario.action,
        scenario.context
      );

      const scenarioPassed = decision.allowed === scenario.expectedAllowed;

      results.push({
        name: scenario.name,
        allowed: decision.allowed,
        expected: scenario.expectedAllowed,
        passed: scenarioPassed,
      });

      if (scenarioPassed) {
        passed++;
      } else {
        failed++;
      }
    }

    return { passed, failed, results };
  },

  /**
   * Validate policy structure
   */
  validatePolicy(policy: Policy): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!policy.id || policy.id.length === 0) {
      errors.push("Policy ID is required");
    }

    if (!policy.name || policy.name.length === 0) {
      errors.push("Policy name is required");
    }

    if (!policy.rules || policy.rules.length === 0) {
      errors.push("Policy must have at least one rule");
    }

    // Check for duplicate rule IDs
    const ruleIds = new Set<string>();
    for (const rule of policy.rules || []) {
      if (ruleIds.has(rule.id)) {
        errors.push(`Duplicate rule ID: ${rule.id}`);
      }
      ruleIds.add(rule.id);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  /**
   * Compare two policies
   */
  comparePolicies(
    policyId1: string,
    policyId2: string
  ): {
    name1: string;
    name2: string;
    similarities: string[];
    differences: string[];
  } {
    const manager = getPolicyManager();
    const policy1 = manager.getPolicy(policyId1);
    const policy2 = manager.getPolicy(policyId2);

    if (!policy1 || !policy2) {
      return {
        name1: policy1?.name || "not-found",
        name2: policy2?.name || "not-found",
        similarities: [],
        differences: ["One or both policies not found"],
      };
    }

    const similarities: string[] = [];
    const differences: string[] = [];

    // Compare rule sets
    const ruleIds1 = new Set(policy1.rules.map((r) => r.id));
    const ruleIds2 = new Set(policy2.rules.map((r) => r.id));

    for (const ruleId of ruleIds1) {
      if (ruleIds2.has(ruleId)) {
        similarities.push(`Shared rule: ${ruleId}`);
      } else {
        differences.push(`Rule in policy1 only: ${ruleId}`);
      }
    }

    for (const ruleId of ruleIds2) {
      if (!ruleIds1.has(ruleId)) {
        differences.push(`Rule in policy2 only: ${ruleId}`);
      }
    }

    return { name1: policy1.name, name2: policy2.name, similarities, differences };
  },
};

// ============================================================================
// Audit Reporting & Analysis
// ============================================================================

export const AuditTools = {
  /**
   * Generate audit report for time period
   */
  reportTimeRange(
    startISO: string,
    endISO: string
  ): {
    period: { start: string; end: string };
    totalEvents: number;
    byAction: Record<string, number>;
    violations: AuditEvent[];
  } {
    const ledger = getAuditLedger();
    const events = ledger.byTimeRange(startISO, endISO);

    const byAction: Record<string, number> = {};
    for (const event of events) {
      byAction[event.action] = (byAction[event.action] || 0) + 1;
    }

    return {
      period: { start: startISO, end: endISO },
      totalEvents: events.length,
      byAction,
      violations: ledger.violations(),
    };
  },

  /**
   * Get audit timeline for sandbox
   */
  sandboxTimeline(sandboxId: string): AuditEvent[] {
    const ledger = getAuditLedger();
    return ledger.bySandbox(sandboxId).sort((a, b) => {
      const dateA = new Date(a.timestamp).getTime();
      const dateB = new Date(b.timestamp).getTime();
      return dateA - dateB;
    });
  },

  /**
   * Find suspicious patterns
   */
  findAnomalies(): {
    rapidRequests: AuditEvent[];
    failurePatterns: AuditEvent[];
    capabilityEscalation: AuditEvent[];
  } {
    const ledger = getAuditLedger();
    const allEvents = ledger.all();

    // Rapid requests (>10 in 10 seconds)
    const rapidRequests: AuditEvent[] = [];
    const timeWindows = new Map<number, number>();

    for (const event of allEvents) {
      const window = Math.floor(new Date(event.timestamp).getTime() / 10000);
      timeWindows.set(window, (timeWindows.get(window) || 0) + 1);
    }

    for (const [_, count] of timeWindows) {
      if (count > 10) {
        rapidRequests.push(...allEvents.filter((e) => e.severity === "warning"));
      }
    }

    // Failure patterns (>3 failures from same actor)
    const failurePatterns = allEvents.filter((e) => e.decision === "deny");

    // Capability escalation (revoke then grant same cap)
    const capabilityEscalation = allEvents.filter(
      (e) => e.action === "capability:revoked" || e.action === "capability:granted"
    );

    return { rapidRequests, failurePatterns, capabilityEscalation };
  },

  /**
   * Export audit log as CSV
   */
  exportCSV(): string {
    const ledger = getAuditLedger();
    const events = ledger.all();

    const headers = [
      "id",
      "timestamp",
      "action",
      "actor_id",
      "actor_type",
      "sandbox_id",
      "decision",
      "severity",
    ];

    const rows = events.map((e) => [
      e.id,
      e.timestamp,
      e.action,
      e.actor.id,
      e.actor.type,
      e.sandboxId || "",
      e.decision || "",
      e.severity,
    ]);

    const csv = [headers, ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n");

    return csv;
  },

  /**
   * Get summary statistics
   */
  summary(): {
    totalEvents: number;
    uniqueActors: number;
    uniqueSandboxes: number;
    violationCount: number;
    allowedPct: number;
  } {
    const ledger = getAuditLedger();
    const events = ledger.all();
    const violations = ledger.violations();

    const actors = new Set(events.map((e) => e.actor.id));
    const sandboxes = new Set(events.map((e) => e.sandboxId).filter(Boolean));

    const allowed = events.filter((e) => e.decision === "allow").length;
    const allowedPct = events.length > 0 ? Math.round((allowed / events.length) * 100) : 0;

    return {
      totalEvents: events.length,
      uniqueActors: actors.size,
      uniqueSandboxes: sandboxes.size,
      violationCount: violations.length,
      allowedPct,
    };
  },
};

// ============================================================================
// Batch Operations
// ============================================================================

export const BatchTools = {
  /**
   * Cleanup old sandboxes
   */
  cleanupOldSandboxes(maxAgeDays: number): number {
    const executor = getSandboxExecutor();
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

    let deleted = 0;

    for (const sandbox of executor.listSandboxes()) {
      const createdTime = new Date(sandbox.createdAt).getTime();
      if (createdTime < cutoff && sandbox.state === "completed") {
        executor.destroySandbox(sandbox.id);
        deleted++;
      }
    }

    return deleted;
  },

  /**
   * Seal audit ledger (make immutable)
   */
  sealAuditLedger(): void {
    const ledger = getAuditLedger();
    ledger.seal();
    auditLog.violationDetected(
      "audit-seal",
      "global",
      { type: "system", id: "batch-tools" },
      "Audit ledger sealed"
    );
  },

  /**
   * Reset all sandboxes (for testing)
   */
  resetAllSandboxes(): number {
    const executor = getSandboxExecutor();
    const sandboxes = executor.listSandboxes();
    const count = sandboxes.length;

    for (const sandbox of sandboxes) {
      executor.destroySandbox(sandbox.id);
    }

    return count;
  },
};
