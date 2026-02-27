# Priority 3: Production Features Guide

## Overview

Transition from **safe operations** (Priority 2) to **observable, debuggable systems** (Priority 3).

**Three Major Additions**:
1. **Tool Version Metadata** — Detect code divergence on replay
2. **Integration Test Suite** — Automated safety validation
3. **Observability** — Prometheus metrics + structured logging

---

## Feature 1: Tool Version Metadata

### Problem
When agent code changes, replayed tools may produce different results. No way to detect divergence.

**Scenario**:
```
Day 1: math.add(2, 3) = 5 (v1.0.0)
Day 2: Code deploys with bug: math.add(2, 3) = 6 (v1.0.1)
Day 3: Ledger replays from checkpoint
  → Executes v1.0.1 code with old events
  → Results differ from original
  → Undetected divergence ✗
```

### Solution: Capture Tool Identity

#### Metadata to Track
```typescript
interface ToolVersion {
  tool_name: string;
  executor_version: string;      // v1.0.0
  runtime: string;                // Node.js v24.13.1
  codehash: string;               // SHA256 of tool implementation
  checksum_inputs: string;        // SHA256 of input schema
  checksum_output: string;        // SHA256 of output schema
}
```

#### Recording (During Execution)

**File**: `apps/agent-server/src/tool-registry.ts` (new file)

```typescript
import crypto from 'node:crypto';

export interface ToolDefinition {
  name: string;
  version: string;
  execute: (input: any) => Promise<any>;
  schema?: {
    input: any;
    output: any;
  };
}

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  getToolVersion(toolName: string): ToolVersion {
    const tool = this.tools.get(toolName);
    if (!tool) throw new Error(`Tool not found: ${toolName}`);

    return {
      tool_name: toolName,
      executor_version: tool.version,
      runtime: `Node.js ${process.version}`,
      codehash: this.getToolCodeHash(toolName),
      checksum_inputs: tool.schema ? this.hashSchema(tool.schema.input) : 'unknown',
      checksum_output: tool.schema ? this.hashSchema(tool.schema.output) : 'unknown',
    };
  }

  private getToolCodeHash(toolName: string): string {
    // Simple: hash tool function source code
    // Production: Use code hash from build system (deterministic)
    const tool = this.tools.get(toolName)!;
    const source = tool.execute.toString();
    return crypto.createHash('sha256').update(source).digest('hex');
  }

  private hashSchema(schema: any): string {
    const canonical = JSON.stringify(schema, Object.keys(schema).sort());
    return crypto.createHash('sha256').update(canonical).digest('hex');
  }
}

export const toolRegistry = new ToolRegistry();
```

#### Using Tool Registry

**File**: `apps/agent-server/src/ledger-integration.ts`

```typescript
// In onToolExecuteRequest():
private async onToolExecuteRequest(event: ToolExecuteRequest): Promise<void> {
  const { call_id, payload } = event;
  const { tool_name } = payload;

  try {
    // Execute tool
    const output = await this.config.tool_executor(tool_name, payload.input);

    // RECORD: Get current tool version metadata
    const toolVersion = toolRegistry.getToolVersion(tool_name);

    // Record result WITH version info
    await this.recordToolResult(event, true, output, undefined, toolVersion);
  } catch (error) {
    // ...
  }
}

// Update signature:
private async recordToolResult(
  toolRequest: ToolExecuteRequest,
  success: boolean,
  output?: any,
  error?: string,
  toolVersion?: ToolVersion  // ADD
): Promise<void> {
  const resultPayload: ToolExecuteResult['payload'] = {
    tool_name: toolRequest.payload.tool_name,
    success,
    ...(output !== undefined && { output }),
    ...(error && { error }),
    executor_version: toolVersion?.executor_version || process.env.EXECUTOR_VERSION || '1.0.0',
    runtime: toolVersion?.runtime || `Node.js ${process.version}`,
    codehash: toolVersion?.codehash,           // ADD
    checksum_inputs: toolVersion?.checksum_inputs,   // ADD
    checksum_output: toolVersion?.checksum_output,   // ADD
    determinism_policy: toolRequest.payload.determinism_policy || 'reexec',
    effect_profile: toolRequest.payload.effect_profile || 'unknown',
  };

  const resultEvent: ToolExecuteResult = {
    event_id: `evt-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
    type: 'tool.execute.result',
    v: 1,
    ts: new Date().toISOString(),
    correlation_id: toolRequest.call_id,
    call_id: toolRequest.call_id,
    producer: `agent:${this.config.agent_id}`,
    payload_hash: this.hashPayload(resultPayload),
    payload: resultPayload,
  };

  await this.appendEventToLedger(resultEvent);
}
```

#### Validation on Replay

**File**: `apps/nucleus/src/ledger/validator.ts` (new file)

```typescript
export class DivergenceValidator {
  validateToolResult(
    originalResult: ToolExecuteResult,
    replayedResult: ToolExecuteResult
  ): {
    diverged: boolean;
    reason?: string;
  } {
    // Check 1: Output schema changed
    if (originalResult.payload.checksum_output !== replayedResult.payload.checksum_output) {
      return {
        diverged: true,
        reason: 'Output schema changed',
      };
    }

    // Check 2: Input schema changed
    if (originalResult.payload.checksum_inputs !== replayedResult.payload.checksum_inputs) {
      return {
        diverged: true,
        reason: 'Input schema changed',
      };
    }

    // Check 3: Code hash changed (different implementation)
    if (originalResult.payload.codehash !== replayedResult.payload.codehash) {
      return {
        diverged: true,
        reason: `Code changed (${originalResult.payload.codehash} → ${replayedResult.payload.codehash})`,
      };
    }

    // Check 4: Actual output differs
    if (JSON.stringify(originalResult.payload.output) !== JSON.stringify(replayedResult.payload.output)) {
      return {
        diverged: true,
        reason: 'Output mismatch during replay',
      };
    }

    return { diverged: false };
  }
}
```

### Storage
Add to ledger schema:
```sql
ALTER TABLE tool_execute_results ADD COLUMN codehash TEXT;
ALTER TABLE tool_execute_results ADD COLUMN checksum_inputs TEXT;
ALTER TABLE tool_execute_results ADD COLUMN checksum_output TEXT;
```

---

## Feature 2: Integration Test Suite

### Test 1: Restart Safety (Prevent Double Execution)

**File**: `apps/nucleus/test/ledger-restart-safety.test.ts`

```typescript
describe('Ledger: Restart Safety', () => {
  it('should not re-execute tool after restart', async () => {
    // Step 1: Submit tool request
    const toolRequest = {
      event_id: 'evt-1',
      type: 'tool.execute.request',
      call_id: 'call-1',
      payload: { tool_name: 'math.add', input: { a: 2, b: 3 } },
    };

    await ledger.append(toolRequest);

    // Step 2: Agent processes and records result
    const toolResult = {
      event_id: 'evt-2',
      type: 'tool.execute.result',
      call_id: 'call-1',
      payload: { success: true, output: 5 },
    };

    await ledger.append(toolResult);

    // Step 3: Simulate crash (agent restarts from checkpoint)
    agent.restart();  // Loads checkpoint at seq=2

    // Step 4: Verify tool NOT executed twice
    const events = ledger.getCallHistory('call-1');
    const results = events.filter(e => e.type === 'tool.execute.result');

    expect(results).toHaveLength(1);  // Only one result, not two
  });
});
```

### Test 2: Batch Atomicity (All or Nothing)

**File**: `apps/nucleus/test/ledger-batch-atomicity.test.ts`

```typescript
describe('Ledger: Batch Atomicity', () => {
  it('should process all events in batch or none', async () => {
    // Step 1: Prepare batch
    const batch = [
      { type: 'tool.execute.request', call_id: 'c1', payload: { tool_name: 'math.add', input: { a: 1, b: 1 } } },
      { type: 'tool.execute.request', call_id: 'c2', payload: { tool_name: 'math.add', input: { a: 2, b: 2 } } },
      { type: 'tool.execute.request', call_id: 'c3', payload: { tool_name: 'math.add', input: { a: 3, b: 3 } } },
    ];

    // Step 2: Append atomically
    const { seqs } = await ledger.appendBatch(batch);

    // Step 3: Verify all in order
    expect(seqs).toHaveLength(3);
    expect(seqs).toEqual([1, 2, 3]);  // Sequential, no gaps

    // Step 4: Verify order preserved on replay
    const events = ledger.stream(0);
    const requests = events.filter(e => e.type === 'tool.execute.request');

    expect(requests[0].call_id).toBe('c1');
    expect(requests[1].call_id).toBe('c2');
    expect(requests[2].call_id).toBe('c3');
  });
});
```

### Test 3: Approval Race Condition

**File**: `apps/nucleus/test/ledger-approval-race.test.ts`

```typescript
describe('Ledger: Approval Race Condition', () => {
  it('should handle concurrent decisions safely', async () => {
    // Step 1: Create approval
    const approvalId = 'appr-1';
    await ledger.append({
      type: 'approval.requested',
      payload: { approval_id: approvalId, tool_name: 'sensitive_tool' },
    });

    // Step 2: Two concurrent decision attempts
    const [r1, r2] = await Promise.all([
      ledger.decideApproval(approvalId, 'approved'),
      ledger.decideApproval(approvalId, 'rejected'),
    ]);

    // Step 3: Verify one succeeds, one fails with 409
    const statuses = [r1.status, r2.status];
    expect(statuses).toContain(200);   // One accepted
    expect(statuses).toContain(409);   // One rejected (409 Conflict)

    // Step 4: Verify only one decision recorded
    const decision = ledger.getApproval(approvalId);
    expect(decision.decision).toBeDefined();

    const history = ledger.getCallHistory(approvalId);
    const decisions = history.filter(e => e.type === 'approval.decided');
    expect(decisions).toHaveLength(1);
  });
});
```

### Test 4: Tool Version Divergence Detection

**File**: `apps/nucleus/test/ledger-tool-divergence.test.ts`

```typescript
describe('Ledger: Tool Version Divergence', () => {
  it('should detect code hash mismatch on replay', async () => {
    // Step 1: Record original execution (v1.0.0)
    const originalResult = {
      type: 'tool.execute.result',
      call_id: 'call-1',
      v: 1,
      payload: {
        tool_name: 'math.add',
        success: true,
        output: 5,
        codehash: 'abc123',  // v1.0.0 hash
        checksum_inputs: 'def456',
        checksum_output: 'ghi789',
      },
    };

    await ledger.append(originalResult);

    // Step 2: Simulate new code deployment (v1.0.1)
    const replayedResult = {
      ...originalResult,
      payload: {
        ...originalResult.payload,
        codehash: 'xyz999',  // v1.0.1 hash (different!)
      },
    };

    // Step 3: Validate divergence
    const validator = new DivergenceValidator();
    const check = validator.validateToolResult(originalResult.payload, replayedResult.payload);

    expect(check.diverged).toBe(true);
    expect(check.reason).toContain('Code changed');
  });
});
```

### Running Tests
```bash
# Install test framework
pnpm add -D jest @types/jest ts-jest

# Run all tests
pnpm run test:ledger

# Run specific test
pnpm run test:ledger -- --testNamePattern="Restart Safety"

# Watch mode
pnpm run test:ledger -- --watch
```

---

## Feature 3: Observability

### Prometheus Metrics

**File**: `apps/nucleus/src/metrics.ts` (new file)

```typescript
import { Counter, Gauge, Histogram } from 'prom-client';

// Polling metrics
export const pollingCycles = new Counter({
  name: 'ledger_polling_cycles_total',
  help: 'Total polling cycles',
  labelNames: ['agent_id', 'status'],  // status: success, error, timeout
});

export const eventsProcessed = new Counter({
  name: 'ledger_events_processed_total',
  help: 'Total events processed',
  labelNames: ['agent_id', 'event_type'],
});

export const toolExecutions = new Counter({
  name: 'ledger_tool_executions_total',
  help: 'Total tool executions',
  labelNames: ['tool_name', 'status'],  // status: success, error, timeout
});

export const toolExecutionDuration = new Histogram({
  name: 'ledger_tool_execution_seconds',
  help: 'Tool execution duration',
  labelNames: ['tool_name'],
  buckets: [0.1, 0.5, 1, 5, 10],
});

// Approval metrics
export const approvalsRequested = new Counter({
  name: 'ledger_approvals_requested_total',
  help: 'Total approvals requested',
});

export const approvalsDecided = new Counter({
  name: 'ledger_approvals_decided_total',
  help: 'Total approvals decided',
  labelNames: ['decision'],  // approved, rejected, expired
});

export const approvalWaitTime = new Histogram({
  name: 'ledger_approval_wait_seconds',
  help: 'Time waiting for approval decision',
  buckets: [1, 5, 30, 60, 300],
});

// Checkpoint metrics
export const checkpointSaves = new Counter({
  name: 'ledger_checkpoint_saves_total',
  help: 'Total checkpoint saves',
  labelNames: ['agent_id', 'status'],  // status: success, error
});

export const currentCheckpointSeq = new Gauge({
  name: 'ledger_checkpoint_seq',
  help: 'Current checkpoint sequence number',
  labelNames: ['agent_id'],
});

// Divergence metrics
export const divergenceDetected = new Counter({
  name: 'ledger_divergence_detected_total',
  help: 'Tool execution divergence detected',
  labelNames: ['tool_name', 'divergence_reason'],
});
```

**Usage in ledger-integration.ts**:
```typescript
const startTime = Date.now();

try {
  const output = await this.config.tool_executor(tool_name, payload.input);
  toolExecutions.inc({ tool_name, status: 'success' });
} catch (error) {
  toolExecutions.inc({ tool_name, status: 'error' });
} finally {
  const duration = (Date.now() - startTime) / 1000;
  toolExecutionDuration.observe({ tool_name }, duration);
}
```

### Structured Logging

**File**: `apps/nucleus/src/logger.ts` (new file)

```typescript
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
});

// Structured log examples
logger.info({
  msg: 'Tool executed',
  agent_id: 'agent-1',
  tool_name: 'math.add',
  call_id: 'call-1',
  duration_ms: 120,
  status: 'success',
},
  'Tool execution complete'
);

logger.warn({
  msg: 'Approval expired',
  approval_id: 'appr-1',
  ttl_ms: 600000,
  waited_ms: 605000,  // Exceeded TTL by 5s
});

logger.error({
  msg: 'Tool execution failed',
  agent_id: 'agent-1',
  tool_name: 'math.add',
  error: error.message,
  stack: error.stack,
});
```

### Dashboards (Grafana)

**Example Dashboard Panels**:

1. **Tool Execution Rate**
   ```
   rate(ledger_tool_executions_total[5m])
   ```

2. **Tool Execution 95th Percentile**
   ```
   histogram_quantile(0.95, ledger_tool_execution_seconds_bucket)
   ```

3. **Approval Decision Time**
   ```
   histogram_quantile(0.95, ledger_approval_wait_seconds_bucket)
   ```

4. **Divergence Detection Rate**
   ```
   rate(ledger_divergence_detected_total[5m])
   ```

5. **Checkpoint Lag by Agent**
   ```
   ledger_checkpoint_seq
   ```

### Health Check Endpoint

**File**: `apps/nucleus/src/routes/health.ts`

```typescript
app.get('/health/ledger', (req, res) => {
  const status = {
    timestamp: new Date().toISOString(),
    ledger_ready: ledger.isReady(),
    checkpoint_age_seconds: Math.floor((Date.now() - ledger.lastCheckpointTime()) / 1000),
    pending_approvals: ledger.listPendingApprovals().length,
    agent_connections: agentPool.activeCount(),
    recent_errors: errorBuffer.last(10),
  };

  const healthy = status.checkpoint_age_seconds < 120
    && status.agent_connections > 0
    && status.recent_errors.length === 0;

  return res
    .status(healthy ? 200 : 503)
    .json(status);
});
```

---

## Implementation Timeline

### Phase 3A (Weeks 1-2): Tool Metadata
- [ ] Add ToolRegistry with hash computation
- [ ] Capture version info in tool results
- [ ] Add divergence validator
- [ ] Write 1 integration test

### Phase 3B (Weeks 2-3): Test Suite
- [ ] Write 4 integration tests
- [ ] Set up Jest + test infrastructure
- [ ] Automate test runs in CI/CD

### Phase 3C (Week 3-4): Observability
- [ ] Add Prometheus metrics
- [ ] Integrate pino structured logging
- [ ] Create Grafana dashboard
- [ ] Deploy health check endpoint

---

## Files to Create

```
apps/nucleus/
  src/
    metrics.ts (new)
    logger.ts (new)
    ledger/
      validator.ts (new)
    routes/
      health.ts (new)
  test/
    ledger-restart-safety.test.ts (new)
    ledger-batch-atomicity.test.ts (new)
    ledger-approval-race.test.ts (new)
    ledger-tool-divergence.test.ts (new)

apps/agent-server/
  src/
    tool-registry.ts (new)
```

---

## Dependencies to Add

```json
{
  "dependencies": {
    "prom-client": "^14.2.0",
    "pino": "^8.16.0",
    "pino-pretty": "^10.2.0"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "ts-jest": "^29.1.0",
    "@types/jest": "^29.5.0"
  }
}
```

---

## Success Criteria

- ✅ All 4 integration tests pass
- ✅ Prometheus metrics exposed on `/metrics`
- ✅ Grafana dashboard displays key metrics
- ✅ Structured logs aggregate in log system (ELK/Datadog)
- ✅ Production deployment can detect divergence in real-time
- ✅ Health check returns 200 when healthy

---

## Summary

| Feature | Benefit | Effort |
|---------|---------|--------|
| Tool Metadata | Divergence detection | 3-4h |
| Test Suite | Automated safety | 6-8h |
| Observability | Real-time debugging | 4-6h |

**Total**: ~3 weeks (staggered implementation)

**Recommendation**: Complete Priorities 1 & 2 before starting Priority 3. Priority 3 enables production observability but not core functionality.
