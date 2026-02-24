# Nucleus Ledger: Deterministic Event Sourcing for AgentHub ↔ Nucleus Integration

## Overview

The **Nucleus Ledger** is an append-only, deterministic event store that serves as the single source of truth for all interactions between Nucleus (LLM planner) and AgentHub (multi-language tool executor).

**Core Principle**: "If it isn't in the ledger, it didn't happen."

This system enables:
- ✅ **Deterministic replay** of entire workflows
- ✅ **Audit trails** for compliance and debugging
- ✅ **First-class approvals** as ledger events (not hidden state)
- ✅ **Stateless execution** (AgentHub has zero internal state for correctness)
- ✅ **Idempotent** tool calls (safe retries)
- ✅ **Evidence-based** execution (output hashing + artifacts)

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      NUCLEUS (Planning)                      │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  LLM-generated steps → emit ToolExecuteRequest events  │ │
│  │  Track approvals: ApprovalRequested/Decision events    │ │
│  │  Query state: /ledger/*, /approvals/*                  │ │
│  └────────────────────────────────────────────────────────┘ │
│                           ↕ (HTTP)                            │
│  ┌────────────────────────────────────────────────────────┐ │
│  │          NUCLEUS LEDGER (append-only event store)      │ │
│  │                  SQLite + WAL mode                      │ │
│  │  Tables: events | call_graph | approvals | artifacts  │ │
│  │  Invariant: Monotonic seq, immutable payloads          │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
                             ↕ (HTTP polling)
┌──────────────────────────────────────────────────────────────┐
│                   AGENTHUB (Execution)                       │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Stateless tool executor (all state in ledger)         │ │
│  │  Poll: GET /ledger/stream?after_seq=N                 │ │
│  │  Execute: ToolExecuteRequest → tool → ToolResult      │ │
│  │  Wait for approvals: blocking wait on event type      │ │
│  │  Emit results: POST /ledger/append                    │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

## Event Model

All events conform to this envelope:

```typescript
interface EventEnvelope {
  event_id: string;           // UUID: unique event identifier
  type: string;               // 'tool.execute.request', 'approval.requested', etc.
  v: number;                  // Schema version (1)
  ts: number;                 // Timestamp (ISO epoch ms)
  correlation_id: string;     // Links related events (one workflow)
  call_id?: string;           // Tool execution ID (null for sys events)
  producer: string;           // 'nucleus', 'agenthub', 'user:actor'
  payload_hash: string;       // SHA-256(canonical_json(payload))
  seq?: number;               // Assigned by ledger on append
  payload: any;               // Event data
}
```

### Core Event Types

| Event Type | Producer | Payload | Semantics |
|-----------|----------|---------|-----------|
| `run.started` | nucleus | run_id, user_id, goal | Workflow begins |
| `tool.execute.request` | nucleus | tool_name, input, approval_required, determinism_policy | Plan → execute tool |
| `approval.requested` | agenthub | approval_id, tool_name, input | Approval gate triggered |
| `approval.decision` | nucleus:user | decision ('approved'\|'rejected'\|'expired'), actor, rationale | User approves/rejects |
| `tool.execute.result` | agenthub | success, output, error_message, evidence | Execution completed |
| `run.completed` | nucleus | status, final_output | Workflow ends |
| `checkpoint` | nucleus | seq, hash, mode | Replay verification point |

## Data Model (SQLite)

### `events` (append-only log)
```sql
CREATE TABLE events (
  seq INTEGER PRIMARY KEY,           -- Monotonic counter
  event_id TEXT UNIQUE NOT NULL,     -- UUID
  type TEXT NOT NULL,                -- Event type
  correlation_id TEXT NOT NULL,      -- Workflow linkage
  call_id TEXT,                      -- Tool call ID
  producer TEXT NOT NULL,            -- Agent/user identifier
  ts INTEGER NOT NULL,               -- Timestamp
  v INTEGER NOT NULL,                -- Schema version
  payload_hash TEXT NOT NULL,        -- SHA-256 fingerprint
  payload_json TEXT NOT NULL,        -- Canonical JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(event_id),
  INDEX idx_type(type),
  INDEX idx_call_id(call_id),
  INDEX idx_producer(producer),
  INDEX idx_ts(ts)
);
```

### `call_graph` (execution state machine)
```sql
CREATE TABLE call_graph (
  call_id TEXT PRIMARY KEY,
  tool_name TEXT NOT NULL,
  input_hash TEXT,
  state TEXT,                        -- 'pending'|'approved'|'executing'|'completed'
  approval_required BOOLEAN,
  approval_id TEXT,
  last_event_seq INTEGER,
  created_at DATETIME,
  updated_at DATETIME,

  INDEX idx_state(state),
  INDEX idx_approval(approval_id)
);
```

### `approvals` (derived from events, cached)
```sql
CREATE TABLE approvals (
  approval_id TEXT PRIMARY KEY,
  call_id TEXT,
  tool_name TEXT,
  requested_at INTEGER,
  decision TEXT,                     -- null|'approved'|'rejected'|'expired'
  decided_at INTEGER,
  actor TEXT,
  rationale TEXT,

  INDEX idx_call_id(call_id),
  INDEX idx_decision(decision)
);
```

### `artifacts` (for replay playback)
```sql
CREATE TABLE artifacts (
  artifact_ref TEXT PRIMARY KEY,    -- Content hash
  call_id TEXT,
  content_hash TEXT,                -- SHA-256
  created_at DATETIME,

  INDEX idx_call_id(call_id)
);
```

### `checkpoints` (replay verification)
```sql
CREATE TABLE checkpoints (
  seq INTEGER PRIMARY KEY,
  hash TEXT,                         -- Rolling hash up to this seq
  artifact_root TEXT,
  mode TEXT,                         -- 'record'|'replay'
  verified BOOLEAN,
  created_at DATETIME
);
```

## Core Services

### Ledger Service (`apps/nucleus/src/ledger/ledger.ts`)

The Ledger class is the database interface for the append-only event store.

**Key Methods:**

```typescript
// Initialization
await ledger.init()                 // Create schema

// Append (atomic)
seq = await ledger.append(event)    // Single event, returns seq number
seqs = await ledger.appendBatch(events) // Transactional batch

// Query
events = await ledger.stream(after_seq, limit)      // Stream new events
events = await ledger.range(start_seq, end_seq)     // Get range
events = await ledger.callHistory(call_id)          // Events for a tool call
seq = await ledger.maxSeq()         // Current sequence counter

// Verification
hash = await ledger.rangeHash(start, end)           // Rolling checksum
hash = ledger.computePayloadHash(payload)           // Event hash

// State updates
await ledger.updateCallState(call_id, state)        // Update call_graph
await ledger.recordCheckpoint(seq, hash)            // Record verification point

// Shutdown
ledger.close()
```

**REST Endpoints:**

```
POST   /ledger/append                    Append single event
POST   /ledger/append-batch              Append multiple (transactional)
GET    /ledger/stream?after_seq=N        Stream events after N
GET    /ledger/range?start=N&end=M       Get event range
GET    /ledger/call/:call_id             Get all events for a tool call
GET    /ledger/status                    Health check + max seq
```

### Approval State Machine (`apps/nucleus/src/approvals/state-machine.ts`)

Cached state machine for fast approval queries. Truth is in ledger; cache is rebuilt on startup.

```typescript
class ApprovalStateMachine {
  onApprovalRequested(event)         // Mark as pending
  onApprovalDecision(event)          // Update state
  getApproval(approval_id)           // Query one
  listPending()                      // List all pending
  rebuildFromEvents(ledger)          // Sync from ledger on startup
}
```

**REST Endpoints:**

```
GET    /approvals/pending                  List pending approvals
GET    /approvals/:approval_id             Query one approval
POST   /approvals/:approval_id/decide      Record user decision
```

### Ledger Client (`apps/agenthub/src/ledger-client.ts`)

AgentHub's interface to the ledger. EventEmitter-based polling.

```typescript
class LedgerClient extends EventEmitter {
  startPolling(interval)             // Begin polling for new events
  stopPolling()                      // Stop polling
  onToolRequest(handler)             // Register handler + approval flow
  waitForApproval(approval_id, timeout) // Blocking wait
  appendEvent(event)                 // POST event to ledger
  getCallHistory(call_id)            // Retrieve tool execution history
}
```

**Usage:**

```typescript
const client = new LedgerClient({
  ledger_url: 'http://localhost:3000',
  agent_id: 'agenthub-1',
});

client.onToolRequest(async (req) => {
  // Handler demonstrates full approval + execution flow
  1. Check approval_required
  2. If yes → emit ApprovalRequested, wait for decision
  3. Execute tool
  4. Emit ToolResult
});

client.startPolling(2000); // Poll every 2 seconds
```

## Approval Flow

```
1. Nucleus LLM decides tool is dangerous
   → emit ToolExecuteRequest with approval_required=true

2. AgentHub polls, receives ToolExecuteRequest
   → check approval_required
   → emit ApprovalRequested event
   → enter blocking wait: `await waitForApproval(id, timeout)`

3. Nucleus queries pending approvals
   → GET /approvals/pending
   → presents to user

4. User clicks "Approve"
   → POST /approvals/:id/decide with decision='approved' + actor+rationale
   → Nucleus records ApprovalDecision event in ledger

5. AgentHub's blocker unblocks
   → executes tool
   → emits ToolResult

6. Nucleus queries result
   → GET /ledger/call/:call_id
   → retrieves ToolResult event
```

## Deterministic Replay

The **ReplayHarness** (`scripts/replay/harness.ts`) verifies that tool execution is deterministic.

**Modes:**

1. **Record**: Capture all events + output hashes
2. **Replay**: Run again, verify output hashes match

```typescript
const harness = new ReplayHarness({
  ledger_db: 'ledger.db',
  artifact_root: './artifacts',
  mode: 'record',  // or 'replay'
});

// Record run 1
const events1 = await workflow();
const hash1 = harness.recordRun(events1);
harness.saveCheckpoints('baseline.json');

// Replay run 2
harness.loadCheckpoints('baseline.json');
const events2 = await workflow();
const { success, divergences } = await harness.replayRun(events2);
```

**CI Gate:**

The GitHub Actions workflow (`.github/workflows/replay.yml`) automatically:
1. Runs the workflow twice
2. Compares output checksums
3. **Fails the build if divergence occurs**

This catches non-deterministic functions early.

## Effect Profiling (Determinism Policies)

Each tool request specifies:

```typescript
effect_profile: 'pure' | 'read' | 'write' | 'external';
determinism_policy: 'reexec' | 'playback' | 'external_call';
```

| Profile | Policy | Meaning |
|---------|--------|---------|
| `pure` | `reexec` | Deterministic function. Safe to replay. Always re-execute (~checksums will match). |
| `read` | `playback` | Reads external state (DB). Record first read; playback same result on replay. |
| `write` | `external_call` | Mutates state. Do NOT replay; call again (idempotent by tool logic). |
| `external` | `external_call` | Non-deterministic (API calls, random). Record output; call again with tracking. |

**Implementation**: At execution time, check `determinism_policy` before running:
```typescript
if (policy === 'playback') {
  // Check if artifact exists from last run
  const cached = ledger.artifacts.get(call_id);
  if (cached) return cached.output;  // Use recorded output
}
execute_tool();  // Otherwise, execute fresh
```

## Integration Steps

See **LEDGER_INTEGRATION_GUIDE.ts** for complete copy-paste code.

**TL;DR:**

1. **Nucleus**: Initialize Ledger, mount routes, wire approvals
2. **AgentHub**: Initialize LedgerClient, register tool handler, start polling
3. **Test**: Run `pnpm run test:replay` (passes if deterministic)

## Deployment Checklist

- [ ] Both services updated with ledger wiring
- [ ] Env vars set: `LEDGER_URL`, `LEDGER_DB`, `AGENT_ID`
- [ ] Database file location is persistent
- [ ] CI gate enabled: `.github/workflows/replay.yml`
- [ ] Integration tests passing
- [ ] Monitoring in place (ledger size, polling latency)
- [ ] Backup strategy for ledger DB
- [ ] Disaster recovery plan (replay from backup)

## Invariants

**Ledger Invariants:**

1. **Monotonic seq**: Each event gets a higher seq than the last
2. **Immutable payloads**: Once appended, events never change
3. **Content-addressed**: Artifacts referenced by hash (reproducible)
4. **Idempotent append**: Appending same event_id twice is a no-op
5. **Call isolation**: Each call_id has its own execution trace

**Execution Invariants:**

1. **Approval before execution**: If approval_required=true, wait for decision
2. **Result follows request**: Every ToolExecuteRequest must have a result (or error)
3. **No hidden state**: All state lives in ledger
4. **Determinism by policy**: Pure functions must produce identical outputs on replay

## Timeline: Event Timestamps

All events have exact `ts` (milliseconds since epoch). This enables:

- **Temporal queries**: GET /ledger/stream?after_ts=X
- **SLA tracking**: (event.ts - request.ts) ≤ 300s
- **Ordering verification**: Assert seq increases with ts
- **Audit trails**: "What happened at time T?"

## Scaling Considerations

**Ledger Growth:**

- Typical tool call: ~2KB payload
- Volume: 1000 calls/hour → ~2GB/month
- Retention: Keep full history (append-only, can be archived)

**Optimization:**

- **WAL mode**: Concurrent reads during writes
- **Indices**: Fast queries by call_id, event_id, type, producer
- **Pagination**: Stream in chunks (limit=100)
- **Checkpoints**: Archive old events after verification

**Extraction:**

- v1: Ledger inside Nucleus (simplest, single-node)
- v2: Dedicated Ledger service (HA, multi-tenant)
- v3: Distributed event bus (Kafka, NATS)

## Monitoring & Observability

**Key Metrics:**

- Ledger seq counter (steadily increasing)
- Approval latency (time from requested to decided)
- Execution latency (tool execution wall time)
- Divergence count (replay failures; should be 0)
- Storage size (monitor for runaway growth)

**Example Queries:**

```sql
-- Approvals waiting >5s
SELECT approval_id, tool_name, (requested_at - now()) as wait_time
FROM approvals WHERE decision IS NULL AND requested_at < (now() - 5000);

-- Slow tool executions (>1s)
SELECT call_id, tool_name,
  (SELECT payload_json FROM events
   WHERE type='tool.execute.result' AND call_id=c.call_id LIMIT 1) as result
FROM call_graph c
WHERE (SELECT (payload_json->>'evidence'->>'execution_time_ms')::int
       FROM events WHERE call_id=c.call_id AND type='tool.execute.result') > 1000;

-- Event volume by producer
SELECT producer, type, COUNT(*) as count
FROM events
WHERE ts > (now() - '1 day'::interval)
GROUP BY producer, type
ORDER BY count DESC;
```

## Troubleshooting

### AgentHub not polling
- Check `LEDGER_URL` env var
- Verify Nucleus is running on that URL
- Check logs for connection errors
- Verify `/ledger/status` endpoint returns success

### Approval never appears
- Poll /approvals/pending manually
- Check that ToolExecuteRequest has approval_required=true
- Verify ApprovalRequested event made it to ledger (GET /ledger/stream)

### Replay test failing
- Run `pnpm run test:replay` to see divergence details
- Check tool is marked with determinism_policy='reexec'
- Verify tool uses only deterministic inputs (no Date.now(), Math.random(), etc.)
- Check for side effects (writing files, mutating passed objects)

### Ledger DB corruption
- Stop services
- Backup `ledger.db` and `ledger.db-wal`
- Run: `sqlite3 ledger.db "PRAGMA integrity_check;"`
- If failed: restore from backup

## License & Attribution

Part of the World Engine project. Uses:
- TypeScript + Zod (validation)
- SQLite (persistence)
- better-sqlite3 (driver)
- Vitest (testing)
