/**
 * Sandbox Tools: Analytics & Reporting
 *
 * - SandboxTools: health metrics, execution stats
 * - PolicyTools: policy validation, rule analysis
 * - AuditTools: audit summary, CSV export
 */

import { getAuditLedger } from "./audit.js";
import type { Policy } from "./contracts.js";
import { SandboxExecutor } from "./sandbox.js";

/**
 * SandboxTools: Health metrics and statistics
 */
export class SandboxTools {
  constructor(private executor: SandboxExecutor) {}

  /**
   * Get health status of a sandbox
   */
  getHealth(sandboxId: string): {
    id: string;
    state: string;
    uptime: number;
    createdAt: string;
  } | null {
    const sandbox = this.executor.getSandbox(sandboxId);
    if (!sandbox) {
      return null;
    }

    const createdTime = new Date(sandbox.createdAt).getTime();
    const uptime = Date.now() - createdTime;

    return {
      id: sandbox.id,
      state: sandbox.state,
      uptime,
      createdAt: sandbox.createdAt,
    };
  }

  /**
   * Get all sandbox health statuses
   */
  getAllHealth(): Array<{
    id: string;
    state: string;
    uptime: number;
    createdAt: string;
  }> {
    return this.executor.listSandboxes().map((sandbox) => {
      const createdTime = new Date(sandbox.createdAt).getTime();
      const uptime = Date.now() - createdTime;

      return {
        id: sandbox.id,
        state: sandbox.state,
        uptime,
        createdAt: sandbox.createdAt,
      };
    });
  }

  /**
   * Get execution statistics
   */
  getStats(): {
    totalSandboxes: number;
    runningCount: number;
    completedCount: number;
    failedCount: number;
  } {
    const sandboxes = this.executor.listSandboxes();
    return {
      totalSandboxes: sandboxes.length,
      runningCount: sandboxes.filter((s) => s.state === "running").length,
      completedCount: sandboxes.filter((s) => s.state === "completed").length,
      failedCount: sandboxes.filter((s) => s.state === "failed").length,
    };
  }
}

/**
 * PolicyTools: Policy validation and analysis
 */
export class PolicyTools {
  /**
   * Validate a policy against the schema
   */
  validatePolicy(policy: Policy): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check basic structure
    if (!policy.id || typeof policy.id !== "string") {
      errors.push("Policy must have a non-empty id");
    }

    if (!policy.name || typeof policy.name !== "string") {
      errors.push("Policy must have a non-empty name");
    }

    if (!policy.version || typeof policy.version !== "string") {
      errors.push("Policy must have a non-empty version");
    }

    if (!Array.isArray(policy.rules)) {
      errors.push("Policy must have a rules array");
    } else {
      for (let i = 0; i < policy.rules.length; i++) {
        const rule = policy.rules[i]!;

        if (!rule.id || typeof rule.id !== "string") {
          errors.push(`Rule ${i} must have a non-empty id`);
        }

        if (!rule.resourceType || typeof rule.resourceType !== "string") {
          errors.push(`Rule ${i} must have a resourceType`);
        }

        if (!rule.action || !["allow", "deny", "audit", "ratelimit"].includes(rule.action)) {
          errors.push(`Rule ${i} must have action in [allow, deny, audit, ratelimit]`);
        }

        if (!rule.operation || typeof rule.operation !== "string") {
          errors.push(`Rule ${i} must have a non-empty operation`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get rule count by decision
   */
  getRuleStats(policy: Policy): {
    allowRules: number;
    denyRules: number;
    auditRules: number;
    rateLimitRules: number;
  } {
    return {
      allowRules: policy.rules.filter((r) => r.action === "allow").length,
      denyRules: policy.rules.filter((r) => r.action === "deny").length,
      auditRules: policy.rules.filter((r) => r.action === "audit").length,
      rateLimitRules: policy.rules.filter((r) => r.action === "ratelimit").length,
    };
  }
}

/**
 * AuditTools: Audit log analysis and export
 */
export class AuditTools {
  /**
   * Get audit summary
   */
  summary(): {
    totalEvents: number;
    violations: number;
    byAction: Record<string, number>;
    bySeverity: Record<string, number>;
  } {
    const ledger = getAuditLedger();
    const events = ledger.getEvents();
    const violations = ledger.violations();

    const byAction: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    for (const event of events) {
      byAction[event.action] = (byAction[event.action] || 0) + 1;
      bySeverity[event.severity] = (bySeverity[event.severity] || 0) + 1;
    }

    return {
      totalEvents: events.length,
      violations: violations.length,
      byAction,
      bySeverity,
    };
  }

  /**
   * Export audit log as CSV
   */
  exportAsCSV(): string {
    const ledger = getAuditLedger();
    const events = ledger.getEvents();

    // CSV header
    const headers = [
      "id",
      "atUtc",
      "action",
      "actor",
      "resourceType",
      "decision",
      "severity",
      "sandboxId",
      "reason",
    ];

    // CSV rows
    const rows = events.map((event) => [
      event.id,
      event.atUtc,
      event.action,
      event.actor,
      event.resourceType,
      event.decision,
      event.severity,
      event.sandboxId || "",
      event.reason || "",
    ]);

    // Format as CSV
    const csvContent = [
      headers.map((h) => `"${h}"`).join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    return csvContent;
  }

  /**
   * Verify audit ledger integrity
   */
  verifyIntegrity(): {
    valid: boolean;
    brokenAt: number | null;
  } {
    const ledger = getAuditLedger();
    return ledger.verifyHashChain();
  }
}
