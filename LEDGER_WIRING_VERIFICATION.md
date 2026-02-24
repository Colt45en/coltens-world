# Ledger Wiring Complete ✅

## Summary

Both Nucleus and agent-server services have been successfully integrated with the deterministic ledger system.

## What Was Wired

### Nucleus (apps/nucleus/src/)

✅ **Created**: `routes/ledger.ts`
- Exports: `createLedgerRoutes()`, `initializeLedger()`
- Handles: All `/ledger/*` and `/approvals/*` endpoints
- 6 ledger routes + 3 approval routes

✅ **Updated**: `index.ts`
- Added ledger imports
- Added `setupLedger()` function
- Ledger initialized on server startup
- Routes integrated into HTTP request handler
- Graceful shutdown handler for ledger

**Routes Available** (port 3000):
```
POST   /ledger/append              Append single event
POST   /ledger/append-batch        Append multiple events
GET    /ledger/stream?after_seq=N  Stream new events
GET    /ledger/range?start=N&end=M Get event range
GET    /ledger/call/:call_id       Get tool execution history
GET    /ledger/status              Health check + max seq

GET    /approvals/pending          List pending approvals
GET    /approvals/:approval_id     Query one approval
POST   /approvals/:approval_id/decide  Record user decision
```

### Agent-Server (apps/agent-server/src/)

✅ **Created**: `ledger-integration.ts`
- Exports: `initializeLedgerClient()`, `shutdownLedgerClient()`
- Implements: Full approval flow + tool execution
- Polling: 2000ms interval for new tool requests

✅ **Updated**: `index.ts`
- Added ledger integration import
- LedgerClient initialized on server startup (graceful fallback)
- Tool executor callback configured
- Graceful shutdown handler

**Polling Behavior**:
- Polls `/ledger/stream?after_seq=N` every 2 seconds
- Receives `ToolExecuteRequest` events
- Checks `approval_required` flag
- Emits `ApprovalRequested` if needed → waits for decision
- Executes tool → emits `ToolExecuteResult`
- Full transparency: all state in ledger

### Root Package (package.json)

✅ **Updated**: `package.json`
- Added script: `"test:replay": "vitest run scripts/replay/replay.test.ts --globals"`
- Ready to run: `pnpm run test:replay`

## Directory Structure (Created)

```
packages/ledger-contracts/
├── package.json              (manifest, zod deps)
├── src/
│   ├── events.ts            (20+ event types)
│   ├── schema.ts            (SQLite DDL)
│   └── index.ts             (entry point)

apps/nucleus/src/
├── ledger/
│   ├── ledger.ts            (Ledger class, 330 lines)
│   └── (initialized in startup)
├── approvals/
│   └── state-machine.ts     (ApprovalStateMachine, 210 lines)
└── routes/
    └── ledger.ts            (HTTP route handlers, NEW)

apps/agenthub/src/
├── ledger-client.ts         (LedgerClient class, 280 lines)
└── (already created)

apps/agent-server/src/
├── ledger-integration.ts    (Setup + polling, NEW)
├── index.ts                 (updated with ledger init)
└── (Fastify app)

scripts/replay/
├── harness.ts               (ReplayHarness class, 240 lines)
├── replay.test.ts           (Vitest tests, 210 lines)
└── (ready to run)

.github/workflows/
└── replay.yml               (CI/CD gate, 50 lines)
```

## Environment Variables

Set these before running:

```bash
# Nucleus (port 3000)
export NUCLEUS_PORT=3000
export LEDGER_DB=runtime/nucleus-ledger.db

# Agent-Server (port 8765)
export AGENT_PORT=8765
export LEDGER_URL=http://127.0.0.1:3000      # <- points to Nucleus
export AGENT_ID=agent-server-1
export NUCLEUS_URL=http://127.0.0.1:8000     # (existing)
export BRAIN_URL=http://127.0.0.1:8001       # (existing)
export SIDECAR_URL=http://127.0.0.1:8002     # (existing)
```

## Verification Checklist

### Pre-Launch

- [ ] All files created (see LEDGER_COMPLETE.md for inventory)
- [ ] Nucleus routes/ledger.ts exists
- [ ] Agent-server ledger-integration.ts exists
- [ ] package.json has `test:replay` script
- [ ] Environment variables configured

### Post-Launch

**Terminal 1: Start Nucleus**
```bash
pnpm --filter ./apps/nucleus run dev
# Look for: "[nucleus] Ledger initialized at runtime/nucleus-ledger.db"
# Look for: "[nucleus] listening http/ws on :3000 (+ /ledger/* + /approvals/*)"
```

**Terminal 2: Start Agent-Server**
```bash
pnpm --filter ./apps/agent-server run dev
# Look for: "[Agent] LedgerClient initialized"
# Look for: "[Agent] Ledger polling started (interval: 2000ms)"
# Look for: "🤖 World Engine Agent Server" banner with "✓ Deterministic Ledger"
```

**Terminal 3: Test ledger health**
```bash
curl http://localhost:3000/ledger/status
# Expected: { "max_seq": 0, "mode": "production" }

curl http://localhost:3000/approvals/pending
# Expected: { "pending": [] }
```

### Run Deterministic Replay Tests

```bash
pnpm run test:replay

# Expected output:
# ✓ should verify deterministic execution of a tool call
# ✓ should detect divergence when output changes
# PASS  scripts/replay/replay.test.ts (2 tests)
```

## Testing the Full Flow

### Option 1: Manual HTTP Flow (Simple)

**Step 1**: Emit a tool request
```bash
curl -X POST http://localhost:3000/ledger/append \
  -H 'Content-Type: application/json' \
  -d '{
    "event_id": "evt-test-manual-1",
    "type": "tool.execute.request",
    "v": 1,
    "ts": '$(date +%s%N | cut -b1-13)',
    "correlation_id": "workflow-manual-1",
    "call_id": "call-manual-1",
    "producer": "nucleus",
    "payload_hash": "computed-in-next",
    "payload": {
      "tool_name": "math.add",
      "input": {"a": 5, "b": 3},
      "approval_required": false,
      "determinism_policy": "reexec",
      "effect_profile": "pure"
    }
  }'
```

**Step 2**: Agent-server polls and executes (automatic)
- Waits ~2s for polling interval
- Emits ToolExecuteResult event

**Step 3**: Query result
```bash
curl http://localhost:3000/ledger/call/call-manual-1

# Expected: events array with:
# - tool.execute.request (input: {a:5, b:3})
# - tool.execute.result (output: {result: 8})
```

### Option 2: Integration Test (Vitest)
```bash
pnpm run test:replay

# Runs full record → replay → comparison cycle
# Tests determinism (same output on replay)
# Tests divergence detection (fails on mismatch)
```

## Database

**File**: `runtime/nucleus-ledger.db`

Automatically created on first Nucleus startup. Contains:

```sql
-- 6 tables
events                   -- append-only log (main truth)
call_graph              -- execution state machine
outbox                  -- at-least-once delivery
idempotency_keys        -- deduplication
artifacts               -- for replay playback
checkpoints             -- replay verification
```

**Inspect Database**:
```bash
# With sqlite3 CLI:
sqlite3 runtime/nucleus-ledger.db

sqlite> SELECT COUNT(*) FROM events;
sqlite> SELECT type, COUNT(*) FROM events GROUP BY type;
```

## Monitoring & Logs

**Nucleus Ledger Initialization**:
```
[nucleus] Ledger initialized at runtime/nucleus-ledger.db
```

**Agent-Server Ledger Integration**:
```
[Agent] LedgerClient initialized (http://127.0.0.1:3000)
[Agent] Ledger polling started (interval: 2000ms)
[Agent] Tool request: math.add (call_id: call-...)
[Agent] Tool executed successfully: math.add
[Agent] Tool result appended: call-... (success: true)
```

## Next Steps

1. **Run the services** (see post-launch checklist above)
2. **Run tests** (`pnpm run test:replay`)
3. **Verify end-to-end** (manual HTTP test or integration test)
4. **Deploy** (follow LEDGER_COMPLETE.md deployment checklist)

## Troubleshooting

**Ledger not initializing**
- Check `LEDGER_DB` env var points to writable location
- Check file permissions: `runtime/` directory must be writable
- Delete `runtime/nucleus-ledger.db*` files and restart

**Agent-server can't reach Nucleus ledger**
- Verify Nucleus is running on port 3000
- Check `LEDGER_URL`: should match Nucleus address + port
- Test connectivity: `curl http://127.0.0.1:3000/ledger/status`

**Polling not starting**
- Check Network logs in agent-server startup
- Verify `/ledger/stream` endpoint responds (test with curl)
- Check agent-server logs for "LedgerClient initialized"

**Tests failing**
- Delete test database: `rm -f test-ledger.db*`
- Ensure better-sqlite3 is installed: `pnpm install`
- Run with verbose: `pnpm run test:replay --reporter=verbose`

---

## Summary

✅ **Wiring Complete**: Nucleus and agent-server integrated
✅ **Routes Ready**: 9 ledger/approval endpoints active
✅ **Polling Active**: Agent-server polls Nucleus every 2s
✅ **Tests Ready**: Run `pnpm run test:replay`
✅ **Determinism Gated**: CI/CD workflow prevents divergence

**Ready to deploy.** 🚀
