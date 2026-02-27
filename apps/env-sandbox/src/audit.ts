/**
 * Audit Ledger: Append-Only, Hash-Chained Event Log
 *
 * - All events are immutable once written
 * - Hash chain provides integrity verification
 * - Sealing prevents further modifications
 * - Canonical JSON for deterministic serialization
 */

import crypto from "node:crypto";
import type { AuditEvent, ResourceType, Severity } from "./contracts.js";
import { AuditEventSchema } from "./contracts.js";

/**
 * Canonical JSON serialization (stable key order, no whitespace)
 */
function canonicalJSON(obj: any): string {
  const stack: any[] = [];
  const keys = new Set<any>();

  return JSON.stringify(obj, (key: string, value: any) => {
    if (typeof value === "object" && value !== null) {
      if (stack.includes(value)) {
        throw new Error("Circular reference in audit event");
      }
      stack.push(value);
      keys.clear();
    }
    return value;
  });
}

/**
 * SHA256 hash (hex string)
 */
function hashEvent(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * AuditLedger: Append-only log with hash chaining
 */
export class AuditLedger {
  private events: AuditEvent[] = [];
  private sealed = false;
  private sealHash: string | null = null;

  /**
   * Append a new event to the ledger
   */
  append(event: Omit<AuditEvent, "id" | "hash" | "prevHash">): AuditEvent {
    if (this.sealed) {
      throw new Error("Ledger is sealed; no further events can be appended");
    }

    // Generate ID
    const id = crypto.randomBytes(16).toString("hex");

    // Get prevHash from last event
    const prevEvent = this.events[this.events.length - 1];
    const prevHash = prevEvent?.hash || "";

    // Create canonical JSON for hashing (without id, hash, prevHash)
    const eventData = {
      atUtc: event.atUtc,
      action: event.action,
      actor: event.actor,
      resourceType: event.resourceType,
      resource: event.resource || {},
      decision: event.decision,
      severity: event.severity || "info",
      reason: event.reason,
      sandboxId: event.sandboxId,
    };

    const canonical = canonicalJSON(eventData);
    const hash = hashEvent(canonical);

    const auditEvent: AuditEvent = {
      id,
      atUtc: event.atUtc,
      action: event.action,
      actor: event.actor,
      resourceType: event.resourceType,
      resource: event.resource || {},
      decision: event.decision,
      severity: event.severity || "info",
      reason: event.reason,
      sandboxId: event.sandboxId,
      prevHash: prevHash || undefined,
      hash,
    };

    // Validate
    AuditEventSchema.parse(auditEvent);

    this.events.push(auditEvent);
    return auditEvent;
  }

  /**
   * Seal the ledger (prevent future append)
   */
  seal(): string {
    if (this.sealed) {
      return this.sealHash!;
    }

    const lastEvent = this.events[this.events.length - 1];
    const finalHash = lastEvent?.hash || "";
    this.sealHash = hashEvent(finalHash + "|SEALED");
    this.sealed = true;
    return this.sealHash;
  }

  /**
   * Verify hash chain integrity
   */
  verifyHashChain(): { valid: boolean; brokenAt: number | null } {
    let prevHash = "";

    for (let i = 0; i < this.events.length; i++) {
      const event = this.events[i]!;

      // Expected prevHash
      if (event.prevHash !== (prevHash || undefined)) {
        return { valid: false, brokenAt: i };
      }

      // Recompute hash
      const eventData = {
        atUtc: event.atUtc,
        action: event.action,
        actor: event.actor,
        resourceType: event.resourceType,
        resource: event.resource,
        decision: event.decision,
        severity: event.severity,
        reason: event.reason,
        sandboxId: event.sandboxId,
      };

      const canonical = canonicalJSON(eventData);
      const expectedHash = hashEvent(canonical);

      if (event.hash !== expectedHash) {
        return { valid: false, brokenAt: i };
      }

      prevHash = event.hash;
    }

    return { valid: true, brokenAt: null };
  }

  /**
   * Get all events
   */
  getEvents(): AuditEvent[] {
    return [...this.events];
  }

  /**
   * Filter events by action
   */
  byAction(action: string): AuditEvent[] {
    return this.events.filter((e) => e.action === action);
  }

  /**
   * Filter events by sandbox
   */
  bySandbox(sandboxId: string): AuditEvent[] {
    return this.events.filter((e) => e.sandboxId === sandboxId);
  }

  /**
   * Get violation events (deny or high/critical severity)
   */
  violations(): AuditEvent[] {
    return this.events.filter(
      (e) => e.decision === "deny" || e.severity === "high" || e.severity === "critical"
    );
  }

  /**
   * Export as JSON
   */
  export(): object {
    return {
      version: "1.0.0",
      sealed: this.sealed,
      sealHash: this.sealHash,
      eventCount: this.events.length,
      events: this.events,
    };
  }

  /**
   * Get size (number of events)
   */
  size(): number {
    return this.events.length;
  }

  /**
   * Check if sealed
   */
  isSealed(): boolean {
    return this.sealed;
  }
}

/**
 * Global audit ledger instance
 */
let globalLedger: AuditLedger | null = null;

/**
 * Initialize or get global ledger
 */
export function getAuditLedger(): AuditLedger {
  if (!globalLedger) {
    globalLedger = new AuditLedger();
  }
  return globalLedger;
}

/**
 * Reset global ledger (for testing)
 */
export function resetAuditLedger(): void {
  globalLedger = null;
}

/**
 * Convenience function: audit an event
 */
export function auditLog(
  action: string,
  actor: string,
  resourceType: ResourceType,
  decision: "allow" | "deny" | "audit",
  resource: Record<string, any> = {},
  severity: Severity = "info",
  sandboxId?: string,
  reason?: string
): AuditEvent {
  const ledger = getAuditLedger();
  return ledger.append({
    atUtc: new Date().toISOString(),
    action,
    actor,
    resourceType,
    resource,
    decision,
    severity,
    sandboxId,
    reason,
  });
}
