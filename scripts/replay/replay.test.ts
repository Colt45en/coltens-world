/**
 * CI GATE: Deterministic Replay Verification
 *
 * This test runs in CI to catch divergence early.
 * If deterministic replay breaks, the build fails.
 *
 * Run: pnpm run test:replay
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Ledger } from '../../apps/nucleus/src/ledger/ledger';
import { LedgerClient } from '../../apps/agenthub/src/ledger-client';
import { ReplayHarness } from './harness';
import {
  ToolExecuteRequest,
  ToolExecuteResult,
  RunStarted,
  RunComplete,
} from '@world-engine/ledger-contracts';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB = 'test-ledger.db';
const ARTIFACT_ROOT = './test-artifacts';

describe('Deterministic Replay Gate', () => {
  let ledger: Ledger;

  beforeAll(async () => {
    // Clean up from previous runs
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    if (fs.existsSync(ARTIFACT_ROOT)) {
      fs.rmSync(ARTIFACT_ROOT, { recursive: true });
    }
    fs.mkdirSync(ARTIFACT_ROOT, { recursive: true });

    // Initialize ledger
    ledger = new Ledger({ db_path: TEST_DB });
    await ledger.init();
  });

  afterAll(() => {
    ledger.close();
    // Clean up
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    if (fs.existsSync(ARTIFACT_ROOT)) {
      fs.rmSync(ARTIFACT_ROOT, { recursive: true });
    }
  });

  it('should verify deterministic execution of a tool call', async () => {
    // Record run 1: execute tool
    const harness1 = new ReplayHarness({
      ledger_db: TEST_DB,
      artifact_root: ARTIFACT_ROOT,
      mode: 'record',
    });

    // Simulate a workflow
    const runId = 'run-test-001';
    const callId = 'call-001';

    // Event 1: workflow started
    const runStarted: RunStarted = {
      event_id: 'evt-001',
      type: 'run.started',
      v: 1,
      ts: Date.now(),
      correlation_id: runId,
      call_id: null,
      producer: 'nucleus',
      payload_hash: 'hash-001',
      payload: {
        run_id: runId,
        user_id: 'test-user',
        goal: 'Test deterministic execution',
      },
    };

    await ledger.append(runStarted);

    // Event 2: tool request
    const toolRequest: ToolExecuteRequest = {
      event_id: 'evt-002',
      type: 'tool.execute.request',
      v: 1,
      ts: Date.now(),
      correlation_id: runId,
      call_id: callId,
      producer: 'nucleus',
      payload_hash: 'hash-002',
      payload: {
        tool_name: 'math.add',
        input: { a: 5, b: 3 },
        determinism_policy: 'reexec',
        effect_profile: 'pure',
        approval_required: false,
      },
    };

    await ledger.append(toolRequest);

    // Event 3: tool result (deterministic output)
    const toolResult: ToolExecuteResult = {
      event_id: 'evt-003',
      type: 'tool.execute.result',
      v: 1,
      ts: Date.now(),
      correlation_id: runId,
      call_id: callId,
      producer: 'agenthub',
      payload_hash: 'hash-003',
      payload: {
        success: true,
        output: { result: 8 }, // 5 + 3
        evidence: {
          execution_time_ms: 1,
          artifacts: [],
        },
      },
    };

    await ledger.append(toolResult);

    // Event 4: workflow completed
    const runComplete: RunComplete = {
      event_id: 'evt-004',
      type: 'run.completed',
      v: 1,
      ts: Date.now(),
      correlation_id: runId,
      call_id: null,
      producer: 'nucleus',
      payload_hash: 'hash-004',
      payload: {
        run_id: runId,
        status: 'success',
        final_output: { result: 8 },
      },
    };

    await ledger.append(runComplete);

    // Get all events
    const allEvents = await ledger.range(1, 10);
    const hash1 = harness1.recordRun(allEvents);
    harness1.saveCheckpoints(path.join(ARTIFACT_ROOT, 'baseline.json'));
    harness1.close();

    // Verify: replay should produce identical checksums
    const harness2 = new ReplayHarness({
      ledger_db: TEST_DB,
      artifact_root: ARTIFACT_ROOT,
      mode: 'replay',
    });

    harness2.loadCheckpoints(path.join(ARTIFACT_ROOT, 'baseline.json'));
    const result = await harness2.replayRun(allEvents);
    harness2.close();

    // All checks should pass
    expect(result.success).toBe(true);
    expect(result.checks.every(c => c.status === 'match' || c.status === 'missing_baseline')).toBe(
      true
    );
    expect(result.final_hash).toBe(hash1);
  });

  it('should detect divergence when output changes', async () => {
    const harness1 = new ReplayHarness({
      ledger_db: TEST_DB,
      artifact_root: ARTIFACT_ROOT,
      mode: 'record',
    });

    const runId = 'run-test-002';
    const callId = 'call-002';

    // First run: normal execution
    const events1: any[] = [
      {
        event_id: 'evt-010',
        type: 'run.started',
        v: 1,
        ts: Date.now(),
        correlation_id: runId,
        call_id: null,
        producer: 'nucleus',
        payload_hash: 'hash-010',
        payload: { run_id: runId, goal: 'Test divergence' },
      },
      {
        event_id: 'evt-011',
        type: 'tool.execute.request',
        v: 1,
        ts: Date.now(),
        correlation_id: runId,
        call_id: callId,
        producer: 'nucleus',
        payload_hash: 'hash-011',
        payload: {
          tool_name: 'random.value',
          input: {},
          determinism_policy: 'reexec',
          effect_profile: 'external',
        },
      },
      {
        event_id: 'evt-012',
        type: 'tool.execute.result',
        v: 1,
        ts: Date.now(),
        correlation_id: runId,
        call_id: callId,
        producer: 'agenthub',
        payload_hash: 'hash-012',
        payload: {
          success: true,
          output: { value: 42 }, // First run
          evidence: { artifacts: [] },
        },
      },
    ];

    const hash1 = harness1.recordRun(events1);
    harness1.saveCheckpoints(path.join(ARTIFACT_ROOT, 'divergence-baseline.json'));
    harness1.close();

    // Second run: output changed
    const harness2 = new ReplayHarness({
      ledger_db: TEST_DB,
      artifact_root: ARTIFACT_ROOT,
      mode: 'replay',
    });

    harness2.loadCheckpoints(path.join(ARTIFACT_ROOT, 'divergence-baseline.json'));

    const events2 = [...events1];
    // Modify the tool result output
    events2[2] = {
      ...events2[2],
      payload: {
        success: true,
        output: { value: 99 }, // Diverged!
        evidence: { artifacts: [] },
      },
    };

    const result = await harness2.replayRun(events2);
    harness2.close();

    // Divergence should be detected
    expect(result.success).toBe(false);
    expect(result.checks.some(c => c.status === 'diverged')).toBe(true);
  });
});
