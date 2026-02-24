/**
 * NUCLEUS APPROVAL STATE MACHINE
 *
 * Approval state is managed entirely through ledger events.
 * This module:
 * 1. Monitors ApprovalRequested events
 * 2. Waits for user decision (from UI → /approvals/decide)
 * 3. Emits ApprovalDecision to ledger
 * 4. Tracks approval state for querying
 */

import type { AnyEvent, EventEnvelope } from '@world-engine/ledger-contracts';
import crypto from 'node:crypto';

type ApprovalDecisionValue = 'approved' | 'rejected' | 'expired';

type ApprovalRequestedEvent = EventEnvelope & {
  type: 'approval.requested';
  payload: EventEnvelope['payload'] & {
    approval_id: string;
  };
};

type ApprovalDecisionEvent = EventEnvelope & {
  type: 'approval.decision';
  payload: EventEnvelope['payload'] & {
    approval_id: string;
    decision: ApprovalDecisionValue;
    actor?: string;
    rationale?: string;
  };
};

function isApprovalRequested(event: AnyEvent): event is ApprovalRequestedEvent {
  return event.type === 'approval.requested';
}

export interface ApprovalRecord {
  approval_id: string;
  requested_at: string | number;
  decision: 'pending' | 'approved' | 'rejected' | 'expired';
  decided_at?: string | number;
  actor?: string;
  rationale?: string;
}

/**
 * In-memory approval cache.
 * Truth is in the ledger; this is for fast queries.
 */
export class ApprovalStateMachine {
  private approvals: Map<string, ApprovalRecord> = new Map();

  /**
   * Process an ApprovalRequested event.
   * Record as "pending" in the cache.
   */
  public onApprovalRequested(event: ApprovalRequestedEvent): void {
    const approval_id = event.payload.approval_id;
    this.approvals.set(approval_id, {
      approval_id,
      requested_at: event.ts || Date.now(),
      decision: 'pending',
    });
  }

  /**
   * Process an ApprovalDecision event.
   * Update the state machine and mark as decided.
   */
  public onApprovalDecision(event: ApprovalDecisionEvent): void {
    const approval_id = event.payload.approval_id;
    const record = this.approvals.get(approval_id);

    if (!record) {
      // First time seeing this approval; create record
      this.approvals.set(approval_id, {
        approval_id,
        requested_at: event.ts || Date.now(),
        decision: event.payload.decision as 'approved' | 'rejected' | 'expired',
        decided_at: event.ts || Date.now(),
        ...(event.payload.actor ? { actor: event.payload.actor } : {}),
        ...(event.payload.rationale ? { rationale: event.payload.rationale } : {}),
      });
    } else {
      // Update existing
      record.decision = event.payload.decision as 'approved' | 'rejected' | 'expired';
      record.decided_at = event.ts || Date.now();
      if (event.payload.actor !== undefined) record.actor = event.payload.actor;
      if (event.payload.rationale !== undefined) record.rationale = event.payload.rationale;
    }
  }

  /**
   * Query approval status.
   */
  public getApproval(approval_id: string): ApprovalRecord | undefined {
    return this.approvals.get(approval_id);
  }

  /**
   * List all pending approvals.
   */
  public listPending(): ApprovalRecord[] {
    return Array.from(this.approvals.values()).filter(a => a.decision === 'pending');
  }

  /**
   * Rebuild cache from ledger events.
   * (Call this on startup to sync.)
   */
  public rebuildFromEvents(events: AnyEvent[]): void {
    this.approvals.clear();

    for (const event of events) {
      if (isApprovalRequested(event)) {
        this.onApprovalRequested(event);
      } else if (event.type === 'approval.decision') {
        this.onApprovalDecision(event as ApprovalDecisionEvent);
      }
    }
  }
}

/**
 * REST API handlers for approval decisions.
 */
export function createApprovalRoutes(
  stateMachine: ApprovalStateMachine,
  appendEventFn: (event: any) => Promise<number>
) {
  return {
    /**
     * GET /approvals/pending
     * List all pending approvals.
     */
    listPending: async (req: any, res: any) => {
      try {
        const pending = stateMachine.listPending();
        res.json({
          success: true,
          pending,
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    },

    /**
     * GET /approvals/:approval_id
     * Query approval status.
     */
    getApproval: async (req: any, res: any) => {
      try {
        const approval_id = req.params.approval_id;
        const record = stateMachine.getApproval(approval_id);

        if (!record) {
          return res.status(404).json({ success: false, error: 'Approval not found' });
        }

        res.json({
          success: true,
          approval: record,
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    },

    /**
     * POST /approvals/:approval_id/decide
     * Record an approval decision.
     *
     * Body: { decision: "approved" | "rejected", actor: string, rationale?: string }
     */
    decide: async (req: any, res: any) => {
      try {
        const approval_id = req.params.approval_id;
        const { decision, actor, rationale } = req.body;

        if (!['approved', 'rejected'].includes(decision)) {
          return res.status(400).json({ success: false, error: 'Invalid decision' });
        }

        const record = stateMachine.getApproval(approval_id);
        if (!record) {
          return res.status(404).json({ success: false, error: 'Approval not found' });
        }

        if (record.decision !== 'pending') {
          return res.status(400).json({
            success: false,
            error: `Approval already decided: ${record.decision}`,
          });
        }

        // Emit ApprovalDecision event
        const event: Omit<ApprovalDecisionEvent, 'seq'> = {
          event_id: crypto.randomUUID(),
          type: 'approval.decision',
          v: 1,
          ts: new Date().toISOString(),
          correlation_id: req.body.correlation_id || crypto.randomUUID(),
          producer: 'nucleus',
          payload_hash: '', // Will be computed by ledger
          payload: {
            approval_id,
            decision: decision as 'approved' | 'rejected',
            actor,
            rationale,
            metadata: {
              ip: req.ip,
              user_agent: req.get('user-agent'),
            },
          },
        };

        const seq = await appendEventFn(event);

        // Update state machine
        stateMachine.onApprovalDecision(event);

        res.json({
          success: true,
          approval_id,
          decision,
          seq,
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    },
  };
}

/**
 * Example usage:
 *
 * const stateMachine = new ApprovalStateMachine();
 * const routes = createApprovalRoutes(stateMachine, ledger.append);
 *
 * app.get('/approvals/pending', routes.listPending);
 * app.get('/approvals/:approval_id', routes.getApproval);
 * app.post('/approvals/:approval_id/decide', routes.decide);
 */
