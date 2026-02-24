/**
 * Ledger Routes Handler
 *
 * Handles:
 * - POST /ledger/append
 * - POST /ledger/append-batch
 * - GET /ledger/stream
 * - GET /ledger/range
 * - GET /ledger/call/:call_id
 * - GET /ledger/status
 * - GET /approvals/pending
 * - GET /approvals/:approval_id
 * - POST /approvals/:approval_id/decide
 */

import { Ledger } from '../ledger/ledger';
import { ApprovalStateMachine } from '../approvals/state-machine';
import type { AnyEvent } from '@world-engine/ledger-contracts';
import { URL } from 'node:url';

export function createLedgerRoutes(ledger: Ledger, approvals: ApprovalStateMachine) {
  return async (req: any, res: any): Promise<boolean> => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    const method = req.method;

    // POST /ledger/append
    if (method === 'POST' && pathname === '/ledger/append') {
      try {
        const body = await parseBody(req);
        const event = body as AnyEvent;
        const seq = await ledger.append(event);

        // Propagate to approvals state machine
        if (event.type === 'approval.requested') {
          approvals.onApprovalRequested(event as any);
        } else if (event.type === 'approval.decision') {
          approvals.onApprovalDecision(event as any);
        }

        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ seq, event_id: event.event_id }));
        return true;
      } catch (error) {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: String(error) }));
        return true;
      }
    }

    // POST /ledger/append-batch
    if (method === 'POST' && pathname === '/ledger/append-batch') {
      try {
        const body = await parseBody(req);
        const { events } = body as { events: AnyEvent[] };
        const seqs = await ledger.appendBatch(events);

        // Propagate events to approvals
        for (const event of events) {
          if (event.type === 'approval.requested') {
            approvals.onApprovalRequested(event as any);
          } else if (event.type === 'approval.decision') {
            approvals.onApprovalDecision(event as any);
          }
        }

        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ seqs, count: events.length }));
        return true;
      } catch (error) {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: String(error) }));
        return true;
      }
    }

    // GET /ledger/stream
    if (method === 'GET' && pathname === '/ledger/stream') {
      try {
        const after_seq = parseInt(url.searchParams.get('after_seq') || '0');
        const limit = parseInt(url.searchParams.get('limit') || '100');
        const events = await ledger.stream(after_seq, limit);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ events, count: events.length }));
        return true;
      } catch (error) {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: String(error) }));
        return true;
      }
    }

    // GET /ledger/range
    if (method === 'GET' && pathname === '/ledger/range') {
      try {
        const start_seq = parseInt(url.searchParams.get('start_seq') || '1');
        const end_seq = parseInt(url.searchParams.get('end_seq') || '10000');
        const events = await ledger.range(start_seq, end_seq);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ events, count: events.length }));
        return true;
      } catch (error) {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: String(error) }));
        return true;
      }
    }

    // GET /ledger/call/:call_id
    const callIdMatch = pathname.match(/^\/ledger\/call\/([^/]+)$/);
    if (method === 'GET' && callIdMatch) {
      try {
        const call_id = callIdMatch[1];
        if (!call_id) {
          res.writeHead(400, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing call_id' }));
          return true;
        }
        const history = await ledger.callHistory(call_id);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ call_id, events: history }));
        return true;
      } catch (error) {
        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Call not found' }));
        return true;
      }
    }

    // GET /ledger/status
    if (method === 'GET' && pathname === '/ledger/status') {
      try {
        const maxSeq = await ledger.maxSeq();
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ max_seq: maxSeq, mode: 'production' }));
        return true;
      } catch (error) {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: String(error) }));
        return true;
      }
    }

    // GET /approvals/pending
    if (method === 'GET' && pathname === '/approvals/pending') {
      try {
        const pending = approvals.listPending();
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ pending }));
        return true;
      } catch (error) {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: String(error) }));
        return true;
      }
    }

    // GET /approvals/:approval_id
    const approvalIdMatch = pathname.match(/^\/approvals\/([^/]+)$/);
    if (method === 'GET' && approvalIdMatch) {
      try {
        const approval_id = approvalIdMatch[1];
        if (!approval_id) {
          res.writeHead(400, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing approval_id' }));
          return true;
        }
        const approval = approvals.getApproval(approval_id);
        if (!approval) {
          res.writeHead(404, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: 'Approval not found' }));
          return true;
        }
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(approval));
        return true;
      } catch (error) {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: String(error) }));
        return true;
      }
    }

    // POST /approvals/:approval_id/decide
    const decideMatch = pathname.match(/^\/approvals\/([^/]+)\/decide$/);
    if (method === 'POST' && decideMatch) {
      try {
        const approval_id = decideMatch[1];
        if (!approval_id) {
          res.writeHead(400, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing approval_id' }));
          return true;
        }
        const body = await parseBody(req);
        const { decision, actor, rationale } = body as any;

        // Record decision as an event in the ledger
        const event = {
          event_id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'approval.decision' as const,
          v: 1,
          ts: new Date().toISOString(),
          correlation_id: approval_id,
          producer: 'nucleus:user-approval',
          payload_hash: 'computed-below',
          payload: {
            approval_id,
            decision,
            actor,
            rationale,
          },
        };

        // Compute hash
        event.payload_hash = ledger.computePayloadHash(event.payload);

        // Append to ledger
        const seq = await ledger.append(event as Omit<AnyEvent, 'seq'>);

        // Update state machine
        approvals.onApprovalDecision(event as any);

        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ seq, approval_id, decision }));
        return true;
      } catch (error) {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: String(error) }));
        return true;
      }
    }

    // Not handled by ledger routes
    return false;
  };
}

/**
 * Parse request body as JSON
 */
function parseBody(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: Buffer) => {
      data += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

export async function initializeLedger(): Promise<{ ledger: Ledger; approvals: ApprovalStateMachine }> {
  const ledger = new Ledger({
    db_path: process.env.LEDGER_DB || 'runtime/nucleus-ledger.db',
  });
  await ledger.init();

  const approvals = new ApprovalStateMachine();

  // Rebuild approvals cache from ledger on startup
  const allEvents = await ledger.range(1, 100000);
  approvals.rebuildFromEvents(allEvents);

  return { ledger, approvals };
}
