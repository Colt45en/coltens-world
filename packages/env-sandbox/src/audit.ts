/**
 * Audit Module - Append-Only Logging
 *
 * Implements an immutable audit trail for all sandbox operations.
 * Supports:
 * - Append-only event ledger
 * - Hash chain verification (optional)
 * - Query by action, actor, time range
 * - Sealed ledgers (immutable)
 */

import { randomUUID } from "node:crypto";
import type { AuditEvent, AuditLog } from "./contracts";
import { AuditEventSchema, AuditLogSchema } from "./contracts";

// ============================================================================
// Audit Persistence (File-based)
// ============================================================================

import * as fs from "node:fs";
import * as path from "node:path";

export class AuditLedger {
  private entries: AuditEvent[] = [];
  private sealed: boolean = false;
  private hashChain: string[] = [];

  /**
   * Append an event to the ledger (fails if sealed)
   */
  append(event: Omit<AuditEvent, "id" | "timestamp">): AuditEvent {
    if (this.sealed) {
      throw new Error("Cannot append to sealed audit ledger");
    }

    const fullEvent: AuditEvent = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      ...event,
    };

    // Validate against schema
    const validated = AuditEventSchema.parse(fullEvent);

    this.entries.push(validated);

    // Optionally build hash chain for verification
    if (this._hashEnabled()) {
      const hash = this._computeHash(validated);
      this.hashChain.push(hash);
    }

    return validated;
  }

  /**
   * Query events by action
   */
  byAction(action: string): AuditEvent[] {
    return this.entries.filter((e) => e.action === action);
  }

  /**
   * Query events by actor
   */
  byActor(actorId: string): AuditEvent[] {
    return this.entries.filter((e) => e.actor.id === actorId);
  }

  /**
   * Query events by sandbox
   */
  bySandbox(sandboxId: string): AuditEvent[] {
    return this.entries.filter((e) => e.sandboxId === sandboxId);
  }

  /**
   * Query events in time range
   */
  byTimeRange(startISO: string, endISO: string): AuditEvent[] {
    const start = new Date(startISO).getTime();
    const end = new Date(endISO).getTime();
    return this.entries.filter((e) => {
      const t = new Date(e.timestamp).getTime();
      return t >= start && t <= end;
    });
  }

  /**
   * Query violations (severity >= error)
   */
  violations(): AuditEvent[] {
    return this.entries.filter(
      (e) => e.severity === "error" || e.severity === "critical"
    );
  }

  /**
   * Seal the ledger (no more appends allowed)
   */
  seal(): void {
    this.sealed = true;
  }

  /**
   * Get all entries
   */
  all(): AuditEvent[] {
    return [...this.entries];
  }

  /**
   * Get ledger as serializable object
   */
  toJSON(): AuditLog {
    return {
      entries: [...this.entries],
      hash: this.hashChain.length > 0 ? this.hashChain[this.hashChain.length - 1] : undefined,
      sealed: this.sealed,
    };
  }

  /**
   * Load from JSON
   */
  static fromJSON(data: AuditLog): AuditLedger {
    const ledger = new AuditLedger();
    const validated = AuditLogSchema.parse(data);

    ledger.entries = [...validated.entries];
    ledger.sealed = validated.sealed;

    return ledger;
  }

  /**
   * Internal: check if hash chain is enabled
   */
  private _hashEnabled(): boolean {
    return process.env.AUDIT_HASH_CHAIN === "true";
  }

  /**
   * Internal: simple hash for verification (not cryptographic)
   */
  private _computeHash(event: AuditEvent): string {
    const json = JSON.stringify(event);
    let hash = 0;
    for (let i = 0; i < json.length; i++) {
      const char = json.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // keep as 32-bit int
    }
    return Math.abs(hash).toString(16);
  }
}

// ============================================================================
// Global Audit Instance
// ============================================================================

let globalAuditLedger: AuditLedger | null = null;

/**
 * Get or create global audit ledger
 */
export function getAuditLedger(): AuditLedger {
  if (!globalAuditLedger) {
    globalAuditLedger = new AuditLedger();
  }
  return globalAuditLedger;
}

/**
 * Reset audit ledger (for testing)
 */
export function resetAuditLedger(): void {
  globalAuditLedger = null;
}

// ============================================================================
// Convenience Loggers
// ============================================================================

export const auditLog = {
  policyCreated(policyId: string, name: string, actor: { type: "system" | "user" | "service"; id: string }) {
    return getAuditLedger().append({
      action: "policy:created",
      actor,
      policyId,
      metadata: { name },
      severity: "info",
    });
  },

  policyUpdated(policyId: string, actor: { type: "system" | "user" | "service"; id: string }) {
    return getAuditLedger().append({
      action: "policy:updated",
      actor,
      policyId,
      severity: "info",
    });
  },

  sandboxCreated(sandboxId: string, name: string | undefined, policyId: string, actor: { type: "system" | "user" | "service"; id: string }) {
    return getAuditLedger().append({
      action: "sandbox:created",
      actor,
      sandboxId,
      policyId,
      metadata: { name },
      severity: "info",
    });
  },

  sandboxExecuted(sandboxId: string, actor: { type: "system" | "user" | "service"; id: string }, exitCode?: number) {
    return getAuditLedger().append({
      action: "sandbox:executed",
      actor,
      sandboxId,
      metadata: { exitCode },
      severity: "info",
    });
  },

  resourceAccessed(
    type: "environment" | "memory" | "code" | "network" | "file" | "process" | "system",
    path: string,
    actor: { type: "system" | "user" | "service"; id: string },
    allowed: boolean
  ) {
    return getAuditLedger().append({
      action: "resource:accessed",
      actor,
      resource: { type, path },
      decision: allowed ? "allow" : "deny",
      severity: allowed ? "info" : "warning",
    });
  },

  ruleTriggered(
    ruleId: string,
    action: "allow" | "deny" | "audit" | "ratelimit",
    resourcePath: string,
    actor: { type: "system" | "user" | "service"; id: string }
  ) {
    return getAuditLedger().append({
      action: "rule:triggered",
      actor,
      ruleId,
      resource: { type: "system", path: resourcePath },
      metadata: { action },
      severity: "info",
    });
  },

  violationDetected(
    ruleId: string,
    resourcePath: string,
    actor: { type: "system" | "user" | "service"; id: string },
    reason: string
  ) {
    return getAuditLedger().append({
      action: "violation:detected",
      actor,
      ruleId,
      resource: { type: "system", path: resourcePath },
      metadata: { reason },
      severity: "warning",
    });
  },

  capabilityGranted(capability: string, actor: { type: "system" | "user" | "service"; id: string }, target: string) {
    return getAuditLedger().append({
      action: "capability:granted",
      actor,
      metadata: { capability, target },
      severity: "info",
    });
  },

  capabilityRevoked(capability: string, actor: { type: "system" | "user" | "service"; id: string }, target: string) {
    return getAuditLedger().append({
      action: "capability:revoked",
      actor,
      metadata: { capability, target },
      severity: "warning",
    });
  },
};

export async function saveAuditLedger(filePath: string): Promise<void> {
  const ledger = getAuditLedger();
  const data = ledger.toJSON();
  await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

export async function loadAuditLedger(filePath: string): Promise<void> {
  if (!fs.existsSync(filePath)) {
    console.warn(`[audit] File not found: ${filePath}`);
    return;
  }
  const data = JSON.parse(await fs.promises.readFile(filePath, "utf8"));
  const ledger = AuditLedger.fromJSON(data);
  globalAuditLedger = ledger;
}

export function getAuditLogPath(): string {
  const dir = process.env.AUDIT_LOG_DIR || "./logs/audit";
  const filename = `audit-${new Date().toISOString().split("T")[0]}.json`;
  return path.join(dir, filename);
}

export async function rotateAuditLogs(): Promise<void> {
  const logPath = getAuditLogPath();
  const dir = path.dirname(logPath);

  if (!fs.existsSync(dir)) {
    await fs.promises.mkdir(dir, { recursive: true });
  }

  await saveAuditLedger(logPath);
  console.log(`[audit] Rotated audit log: ${logPath}`);
}
