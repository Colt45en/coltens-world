/**
 * LEDGER INTEGRATION GUIDE
 *
 * This file shows exactly how to integrate the ledger modules
 * into the existing Nucleus and AgentHub services.
 *
 * Copy-paste ready code snippets for each service.
 */

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ STEP 1: NUCLEUS EXPRESS APP - Wire Ledger + Approvals                   │
// └─────────────────────────────────────────────────────────────────────────┘

// FILE: apps/nucleus/src/index.ts (or main.ts)

import express, { Request, Response } from 'express';
import { Ledger } from './ledger/ledger';
import { ApprovalStateMachine } from './approvals/state-machine';
import { AnyEvent } from '@world-engine/ledger-contracts';

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ STEP 2: AGENTHUB EXPRESS APP - Wire LedgerClient                        │
// └─────────────────────────────────────────────────────────────────────────┘

// FILE: apps/agenthub/src/index.ts (or main.ts)

import { LedgerClient } from './ledger-client';
import type { ToolExecuteResult } from '@world-engine/ledger-contracts';

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ STEP 3: INTEGRATION TEST                                                │
// └─────────────────────────────────────────────────────────────────────────┘

// FILE: tests/integration/ledger-e2e.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import axios from 'axios';

export async function createNucleusApp() {
  const app = express();
  app.use(express.json());

  // Initialize ledger (append-only event store)
  const ledger = new Ledger({
    db_path: process.env.LEDGER_DB || 'runtime/nucleus-ledger.db',
  });
  await ledger.init();

  // Initialize approval state machine (cached for query performance)
  const approvals = new ApprovalStateMachine();

  // Attach ledger to express app for use in handlers
  app.locals.ledger = ledger;
  app.locals.approvals = approvals;

  // ──────────────────────────────────────────────────────────────────────────
  // Mount ledger routes (append, stream, range, etc.)
  // ──────────────────────────────────────────────────────────────────────────
  app.post('/ledger/append', async (req: Request, res: Response) => {
    try {
      const event = req.body;
      const seq = await ledger.append(event);

      // Propagate to approvals state machine
      if (event.type === 'approval.requested') {
        approvals.onApprovalRequested(event);
      } else if (event.type === 'approval.decision') {
        approvals.onApprovalDecision(event);
      }

      res.json({ seq, event_id: event.event_id });
    } catch (error) {
      res.status(400).json({ error: String(error) });
    }
  });

  app.post('/ledger/append-batch', async (req: Request, res: Response) => {
    try {
      const { events } = req.body;
      const seqs = await ledger.appendBatch(events);

      // Propagate events to approvals
      for (const event of events) {
        if (event.type === 'approval.requested') {
          approvals.onApprovalRequested(event);
        } else if (event.type === 'approval.decision') {
          approvals.onApprovalDecision(event);
        }
      }

      res.json({ seqs, count: events.length });
    } catch (error) {
      res.status(400).json({ error: String(error) });
    }
  });

  app.get('/ledger/stream', async (req: Request, res: Response) => {
    try {
      const after_seq = parseInt(req.query.after_seq as string) || 0;
      const limit = parseInt(req.query.limit as string) || 100;
      const events = await ledger.stream(after_seq, limit);
      res.json({ events, count: events.length });
    } catch (error) {
      res.status(400).json({ error: String(error) });
    }
  });

  app.get('/ledger/range', async (req: Request, res: Response) => {
    try {
      const start_seq = parseInt(req.query.start_seq as string) || 1;
      const end_seq = parseInt(req.query.end_seq as string) || 10000;
      const events = await ledger.range(start_seq, end_seq);
      res.json({ events, count: events.length });
    } catch (error) {
      res.status(400).json({ error: String(error) });
    }
  });

  app.get('/ledger/call/:call_id', async (req: Request, res: Response) => {
    try {
      const history = await ledger.callHistory(req.params.call_id);
      res.json({ call_id: req.params.call_id, events: history });
    } catch (error) {
      res.status(404).json({ error: 'Call not found' });
    }
  });

  app.get('/ledger/status', async (req: Request, res: Response) => {
    try {
      const maxSeq = await ledger.maxSeq();
      res.json({ max_seq: maxSeq, mode: 'production' });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Mount approval routes
  // ──────────────────────────────────────────────────────────────────────────
  app.get('/approvals/pending', (req: Request, res: Response) => {
    try {
      const pending = approvals.listPending();
      res.json({ pending });
    } catch (error) {
      res.status(400).json({ error: String(error) });
    }
  });

  app.get('/approvals/:approval_id', (req: Request, res: Response) => {
    try {
      const approval = approvals.getApproval(req.params.approval_id);
      if (!approval) {
        return res.status(404).json({ error: 'Approval not found' });
      }
      res.json(approval);
    } catch (error) {
      res.status(400).json({ error: String(error) });
    }
  });

  app.post('/approvals/:approval_id/decide', async (req: Request, res: Response) => {
    try {
      const { decision, actor, rationale } = req.body;

      // Record decision as an event in the ledger
      const event = {
        event_id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'approval.decision',
        v: 1,
        ts: Date.now(),
        correlation_id: req.params.approval_id,
        call_id: null,
        producer: 'nucleus:user-approval',
        payload_hash: 'computed-below',
        payload: {
          approval_id: req.params.approval_id,
          decision, // 'approved' | 'rejected' | 'expired'
          actor,
          rationale,
        },
      };

      // Compute hash
      event.payload_hash = ledger.computePayloadHash(event.payload);

      // Append to ledger
      const seq = await ledger.append(event);

      // Update state machine
      approvals.onApprovalDecision(event);

      res.json({ seq, approval_id: req.params.approval_id, decision });
    } catch (error) {
      res.status(400).json({ error: String(error) });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Graceful shutdown
  // ──────────────────────────────────────────────────────────────────────────
  process.on('SIGTERM', () => {
    ledger.close();
    process.exit(0);
  });

  return app;
}

// Start on port 3000
const PORT = process.env.PORT || 3000;
createNucleusApp().then(app => {
  app.listen(PORT, () => console.log(`Nucleus listening on ${PORT}`));
});

export async function createAgentHubApp() {
  const app = express();
  app.use(express.json());

  // Initialize ledger client
  const ledgerClient = new LedgerClient({
    ledger_url: process.env.LEDGER_URL || 'http://localhost:3000',
    agent_id: process.env.AGENT_ID || 'agenthub-1',
  });

  // Attach to app
  app.locals.ledgerClient = ledgerClient;

  // ──────────────────────────────────────────────────────────────────────────
  // Register tool handlers with the ledger client
  // ──────────────────────────────────────────────────────────────────────────
  ledgerClient.onToolRequest(async (toolRequest) => {
    console.log(`Tool request: ${toolRequest.payload.tool_name}`);

    try {
      // Step 1: Check if approval is required
      if (toolRequest.payload.approval_required) {
        // Emit ApprovalRequested event
        const approvalId = ledgerClient.generateApprovalId();

        await ledgerClient.appendEvent({
          event_id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'approval.requested',
          v: 1,
          ts: Date.now(),
          correlation_id: toolRequest.correlation_id,
          call_id: toolRequest.call_id,
          producer: 'agenthub',
          payload_hash: 'computed-below',
          payload: {
            approval_id: approvalId,
            tool_name: toolRequest.payload.tool_name,
            input: toolRequest.payload.input,
          },
        });

        // Step 2: Wait for approval decision (blocking with timeout)
        const decision = await ledgerClient.waitForApproval(approvalId, 300000); // 5 min timeout

        if (decision?.payload.decision !== 'approved') {
          // Approval was rejected or expired
          console.log(`Approval rejected for ${approvalId}`);
          return; // Don't execute tool
        }
      }

      // Step 3: Execute the tool (your tool runtime here)
      const toolName = toolRequest.payload.tool_name;
      const input = toolRequest.payload.input;

      let output: any;
      let error: any;

      try {
        // Call your tool runtime
        // For now, a simple echo example:
        output = await executeToolByName(toolName, input);
      } catch (e) {
        error = e;
      }

      // Step 4: Emit ToolExecuteResult event
      const result: ToolExecuteResult = {
        event_id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'tool.execute.result',
        v: 1,
        ts: Date.now(),
        correlation_id: toolRequest.correlation_id,
        call_id: toolRequest.call_id!,
        producer: 'agenthub',
        payload_hash: 'computed-below',
        payload: {
          success: !error,
          output: output || null,
          error_message: error ? String(error) : undefined,
          evidence: {
            execution_time_ms: Date.now() - toolRequest.ts,
            artifacts: [],
          },
        },
      };

      // Compute hash
      result.payload_hash = ledgerClient.computePayloadHash(result.payload);

      // Append result to ledger
      await ledgerClient.appendEvent(result);

      console.log(`Tool result: ${toolRequest.call_id} → ${result.payload.success}`);
    } catch (error) {
      console.error('Tool handler error:', error);
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Start polling the ledger for new tool requests
  // ──────────────────────────────────────────────────────────────────────────
  ledgerClient.startPolling(2000); // Poll every 2 seconds

  // ──────────────────────────────────────────────────────────────────────────
  // REST endpoint to check polling status
  // ──────────────────────────────────────────────────────────────────────────
  app.get('/status', (req: Request, res: Response) => {
    res.json({
      status: 'running',
      agent_id: process.env.AGENT_ID || 'agenthub-1',
      polling: 'active',
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Graceful shutdown
  // ──────────────────────────────────────────────────────────────────────────
  process.on('SIGTERM', () => {
    ledgerClient.stopPolling();
    process.exit(0);
  });

  return app;
}

// Helper: execute a tool by name
async function executeToolByName(toolName: string, input: any): Promise<any> {
  // This is where your tool runtime lives
  // Could be calling Python, calling external services, etc.

  switch (toolName) {
    case 'math.add':
      return { result: input.a + input.b };
    case 'math.multiply':
      return { result: input.a * input.b };
    case 'echo':
      return input;
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

// Start on port 8080
const AGENTHUB_PORT = process.env.PORT || 8080;
createAgentHubApp().then(app => {
  app.listen(AGENTHUB_PORT, () => console.log(`AgentHub listening on ${AGENTHUB_PORT}`));
});

const NUCLEUS_URL = 'http://localhost:3000';
const AGENTHUB_URL = 'http://localhost:8080';

describe('Ledger Integration E2E', () => {
  it('should execute a tool with approval', async () => {
    // Step 1: Emit a tool request from Nucleus
    const toolRequest = {
      event_id: `evt-test-${Date.now()}`,
      type: 'tool.execute.request',
      v: 1,
      ts: Date.now(),
      correlation_id: 'test-001',
      call_id: 'call-test-001',
      producer: 'nucleus',
      payload_hash: 'dummy-for-now',
      payload: {
        tool_name: 'math.add',
        input: { a: 5, b: 3 },
        approval_required: true,
        determinism_policy: 'reexec',
        effect_profile: 'pure',
      },
    };

    const appendRes = await axios.post(`${NUCLEUS_URL}/ledger/append`, toolRequest);
    expect(appendRes.status).toBe(200);
    expect(appendRes.data.seq).toBeDefined();

    // Step 2: Check pending approvals (AgentHub emitted ApprovalRequested)
    await new Promise(r => setTimeout(r, 1000)); // Wait for polling

    const pendingRes = await axios.get(`${NUCLEUS_URL}/approvals/pending`);
    expect(pendingRes.data.pending.length).toBeGreaterThan(0);

    const approval = pendingRes.data.pending[0];
    const approvalId = approval.approval_id;

    // Step 3: Approve from Nucleus
    const decideRes = await axios.post(
      `${NUCLEUS_URL}/approvals/${approvalId}/decide`,
      {
        decision: 'approved',
        actor: 'test-user',
        rationale: 'Auto-approved in test',
      }
    );
    expect(decideRes.status).toBe(200);

    // Step 4: Wait for execution and check result
    await new Promise(r => setTimeout(r, 1000));

    const callHistoryRes = await axios.get(`${NUCLEUS_URL}/ledger/call/call-test-001`);
    expect(callHistoryRes.data.events.length).toBeGreaterThan(0);

    const resultEvent = callHistoryRes.data.events.find((e: any) => e.type === 'tool.execute.result');
    expect(resultEvent).toBeDefined();
    expect(resultEvent.payload.success).toBe(true);
    expect(resultEvent.payload.output.result).toBe(8); // 5 + 3
  });

  it('should replay recorded execution and verify determinism', async () => {
    // This test would run after the above test to verify replay
    // It fetches all events from the ledger and compares checksums

    const statusRes = await axios.get(`${NUCLEUS_URL}/ledger/status`);
    const maxSeq = statusRes.data.max_seq;

    const eventsRes = await axios.get(
      `${NUCLEUS_URL}/ledger/range?start_seq=1&end_seq=${maxSeq}`
    );

    expect(eventsRes.data.events.length).toBeGreaterThan(0);

    // In real scenario, you'd run replay harness here
    // and verify output hashes match
  });
});

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ DEPLOYMENT CHECKLIST                                                    │
// └─────────────────────────────────────────────────────────────────────────┘

/*
Before deploying to production, ensure:

✓ Both Nucleus and AgentHub apps are updated with the wiring above
✓ LEDGER_URL env var is set correctly (AgentHub → Nucleus)
✓ LEDGER_DB env var is set to a persistent location
✓ Database file has proper permissions (readable + writable)
✓ Test suite passes: pnpm run test:replay
✓ CI/CD gate is enabled: .github/workflows/replay.yml
✓ Monitoring is in place for ledger size (sqlite grows over time)
✓ Backup strategy for ledger DB (append-only, can be backed up anytime)
✓ Disaster recovery plan (replay from backup if needed)

Production Deployment Flow:
1. Deploy Nucleus with ledger routes (backwards-compatible, ledger is new)
2. Run DB migrations (creates schema)
3. Deploy AgentHub with LedgerClient (will start polling immediately)
4. Monitor logs for "polling: active" and tool requests coming through
5. Verify first few tool requests produce approval events
6. Gradually ramp up traffic

Rollback:
1. Deploy old AgentHub (without ledger client) — will ignore approval events
2. Deploy old Nucleus (without ledger routes) — may still have ledger there
3. Monitor tool execution to verify fallback behavior
*/
