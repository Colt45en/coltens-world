# Ledger Hardening Roadmap: Priorities 1-3

## Quick Navigation

| Priority | Focus | Timeline | Status |
|----------|-------|----------|--------|
| **1** | Checkpoint + Polling | ✅ Complete | DONE |
| **2** | Safety + Auth | 1-2 weeks | READY TO START |
| **3** | Observability | 3-4 weeks | PLANNED |

---

## Priority 1: ✅ COMPLETE

**What**: Implement LedgerClient with checkpoint persistence and polling loop

**Status**:
- ✅ 453-line implementation in `ledger-integration.ts`
- ✅ TypeScript compilation passes
- ✅ Ready for integration testing

**Files Changed**:
- `apps/agent-server/src/ledger-integration.ts` (30 → 483 lines)

**Key Features**:
- Checkpoint persistence (`runtime/ledger-checkpoints/{agent_id}.checkpoint.json`)
- Polling every 2 seconds (`/ledger/stream?after_seq=N`)
- Tool execution with idempotency guards
- Approval flow (request → wait → decide → execute)
- Graceful restart recovery

**Documentation**:
- [LEDGER_CHECKPOINT_IMPLEMENTATION.md](LEDGER_CHECKPOINT_IMPLEMENTATION.md)
- [CHECKPOINT_VERIFICATION.md](CHECKPOINT_VERIFICATION.md)

**Next**: Verify with live ledger, then move to Priority 2

---

## Priority 2: HARDENING (Ready to Start)

**What**: Add approval expiry, concurrency safety, and auth validation

**Timeline**: 1-2 weeks (1-2 person, 8-12 engineering hours)

**Why**:
- Approval TTL prevents hanging requests
- 409 Conflict allows intelligent retries
- X-Ledger-Token prevents unauthorized access

### Change 2A: Approval Expiry

**Files to Modify**:
- `apps/nucleus/src/ledger/ledger.ts`
- `apps/nucleus/src/routes/ledger.ts`
- `apps/nucleus/src/approvals/state-machine.ts`

**Key Changes**:
```typescript
// Schema: add created_at, ttl_ms, status columns
const approval = {
  created_at: number;      // When requested
  ttl_ms: number;          // Expires in 10 min (600000ms)
  status: 'pending' | 'decided';  // Track expiry
  decision?: 'approved' | 'rejected' | 'expired';
};

// Methods: add isApprovalExpired(), getApprovalWithExpiry()
ledger.cleanupExpiredApprovals();  // Run periodically

// Routes: return 410 Gone on expiry check
GET /approvals/:id → 410 if expired
```

**Expected Behavior**:
```
Request approval at T=0
User doesn't decide
At T=10m: Auto-expire
GET /approvals/appr-1 at T=10m+30s → 410 Gone
```

### Change 2B: Concurrency Safety (409 vs 400)

**Files to Modify**:
- `apps/nucleus/src/routes/ledger.ts` (POST `/approvals/:id/decide`)
- `apps/agent-server/src/ledger-integration.ts` (waitForApproval error handling)

**Key Changes**:
```typescript
// Before (broken):
if (!approval) return 400;        // Not found
if (approved.decision) return 400; // Already decided
                                  // Client can't distinguish!

// After (fixed):
if (!approval) return 404;             // Not found
if (approval.decision) return 409;    // Conflict (already decided)
if (approval.expired) return 410;     // Gone (expired)
```

**Testing**:
```bash
# First decide: 200 OK
POST /approvals/appr-1/decide { "decision": "approved" } → 200

# Second decide: 409 Conflict (not 400!)
POST /approvals/appr-1/decide { "decision": "rejected" } → 409

# Client can now retry intelligently
if (status === 409) console.log('Already decided, no retry');
if (status === 400) console.log('Invalid request, fix and retry');
```

### Change 2C: Auth Token Validation

**Files to Create**:
- `apps/nucleus/src/routes/middleware.ts` (X-Ledger-Token validation)

**Files to Modify**:
- `apps/nucleus/src/routes/ledger.ts` (apply middleware)
- `apps/agent-server/src/ledger-integration.ts` (add token header)

**Key Changes**:
```typescript
// Middleware: require X-Ledger-Token header
const VALID_TOKENS = new Set([
  process.env.LEDGER_TOKEN || 'dev-token-12345',
]);

function authLedgerToken(req, res, next) {
  const token = req.headers['x-ledger-token'];
  if (!token || !VALID_TOKENS.has(token)) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
  next();
}

// Apply to protected routes
app.post('/ledger/append', authLedgerToken, ...);
app.post('/approvals/:id/decide', authLedgerToken, ...);

// Agent-server: add token to requests
const token = process.env.LEDGER_TOKEN || 'dev-token-12345';
fetch(url, {
  headers: { 'X-Ledger-Token': token }
});
```

**Environment Config**:
```bash
export LEDGER_TOKEN="dev-token-12345"  # Development
export LEDGER_TOKEN="sk-prod-xxxxxxxxxxxx"  # Production
```

### Priority 2 Checklist

- [ ] **Phase 1: Expiry**
  - [ ] Add TTL columns to DB schema
  - [ ] Implement `isApprovalExpired()`, `cleanupExpiredApprovals()`
  - [ ] Update routes to return 410 Gone on expiry
  - [ ] Test expiry flow (manual)

- [ ] **Phase 2: Concurrency**
  - [ ] Change 400 → 409 on double-decide
  - [ ] Update agent error handling
  - [ ] Write unit test for 409 response
  - [ ] Test race condition (manual: two requests simultaneously)

- [ ] **Phase 3: Auth**
  - [ ] Create middleware with token validation
  - [ ] Apply to protected routes (/ledger/append, /approvals/:id/decide)
  - [ ] Add token to agent-server requests
  - [ ] Configure env variables

- [ ] **Testing**
  - [ ] Unit tests: expiry, 409, auth
  - [ ] Integration test: expiry cleanup
  - [ ] Integration test: concurrent decides
  - [ ] Manual smoke test: auth failures

- [ ] **Documentation**
  - [ ] Update API docs (410, 409 status codes)
  - [ ] Add deployment guide (LEDGER_TOKEN env config)
  - [ ] Add troubleshooting guide

### Detailed Guide
See: [PRIORITY_2_HARDENING_GUIDE.md](PRIORITY_2_HARDENING_GUIDE.md)

---

## Priority 3: OBSERVABILITY (Planned)

**What**: Tool metadata, comprehensive tests, metrics + logging

**Timeline**: 3-4 weeks (staggered)

**Why**:
- Detect code divergence on replay
- Automated safety validation
- Real-time debugging + alerting

### Feature 3A: Tool Version Metadata

**Files to Create**:
- `apps/agent-server/src/tool-registry.ts`

**Files to Modify**:
- `apps/agent-server/src/ledger-integration.ts` (capture version in results)
- `apps/nucleus/src/ledger/validator.ts` (new: divergence detection)

**What Gets Captured**:
```typescript
{
  tool_name: "math.add",
  executor_version: "1.0.0",        // App version
  runtime: "Node.js v24.13.1",      // JS runtime
  codehash: "abc123...",             // SHA256 of function source
  checksum_inputs: "def456...",      // SHA256 of input schema
  checksum_output: "ghi789...",      // SHA256 of output schema
}
```

**Use Case**:
```
Day 1: Ledger records tool.execute.result with codehash=abc123
Day 2: Code deploys (new hash=xyz789)
Day 3: Replay check detected mismatch → ALERT "Code divergence detected"
```

### Feature 3B: Integration Test Suite

**Files to Create**:
- `apps/nucleus/test/ledger-restart-safety.test.ts`
- `apps/nucleus/test/ledger-batch-atomicity.test.ts`
- `apps/nucleus/test/ledger-approval-race.test.ts`
- `apps/nucleus/test/ledger-tool-divergence.test.ts`

**4 Critical Tests**:
1. **Restart Safety** — Agent crash doesn't double-execute tools
2. **Batch Atomicity** — Multi-event batch appends all-or-nothing
3. **Approval Race** — Concurrent decisions return 200/409 correctly
4. **Tool Divergence** — Code change detected via hash mismatch

### Feature 3C: Observability Stack

**Prometheus Metrics**:
```
ledger_polling_cycles_total{agent_id="...", status="..."}
ledger_tool_executions_total{tool_name="...", status="..."}
ledger_tool_execution_seconds{tool_name="..."}
ledger_approvals_requested_total
ledger_approvals_decided_total{decision="..."}
ledger_checkpoint_saves_total{agent_id="...", status="..."}
ledger_divergence_detected_total{tool_name="...", reason="..."}
```

**Structured Logging**:
```json
{
  "msg": "Tool executed",
  "tool_name": "math.add",
  "call_id": "call-1",
  "status": "success",
  "duration_ms": 120
}
```

**Grafana Dashboards**:
- Tool execution rate & latency
- Approval decision time
- Checkpoint lag by agent
- Divergence detection alerts

### Priority 3 Checklist

- [ ] **Phase 1: Tool Metadata**
  - [ ] Create ToolRegistry with hash computation
  - [ ] Capture codehash in tool results
  - [ ] Implement DivergenceValidator
  - [ ] Test divergence detection

- [ ] **Phase 2: Test Suite**
  - [ ] Set up Jest + test infrastructure
  - [ ] Write 4 integration tests
  - [ ] Integrate into CI/CD
  - [ ] Achieve 80%+ coverage

- [ ] **Phase 3: Observability**
  - [ ] Add Prometheus metrics
  - [ ] Integrate pino structured logging
  - [ ] Create Grafana dashboard
  - [ ] Deploy health check endpoints

### Detailed Guide
See: [PRIORITY_3_FEATURES_GUIDE.md](PRIORITY_3_FEATURES_GUIDE.md)

---

## Development Workflow

### Set Up Branch
```bash
git checkout -b feat/ledger-priority-2-hardening

# Create tracking files
touch PRIORITY_2_WORK_LOG.md
```

### Daily Checklist
```bash
# Build
pnpm --filter './apps/nucleus' run build
pnpm --filter './apps/agent-server' run build

# Test (if applicable)
pnpm run test:ledger

# Type check
pnpm run typecheck

# Linting
pnpm run lint
```

### Commit Strategy
- Small, focused commits (one feature per commit)
- Example: `feat(ledger): add approval expiry enforcement`
- Include test changes in same commit as code changes

### Code Review Checklist
- [ ] TypeScript compilation passes
- [ ] No new warnings/errors
- [ ] Tests written and passing
- [ ] Backward compatible (or breaking change documented)
- [ ] API docs updated

---

## File Structure Reference

### Nucleus Ledger (HTTP API)
```
apps/nucleus/src/
  ledger/
    ledger.ts          ← Core ledger implementation
    validator.ts       ← [P3] Divergence detection
  approvals/
    state-machine.ts   ← Approval state tracking
  routes/
    ledger.ts          ← HTTP endpoints (append, stream, decide)
    middleware.ts      ← [P2] Auth token validation
    health.ts          ← [P3] Health checks
  metrics.ts           ← [P3] Prometheus metrics
  logger.ts            ← [P3] Structured logging
  test/
    ledger-*.test.ts   ← [P3] Integration tests
```

### Agent Server (Consumer)
```
apps/agent-server/src/
  ledger-integration.ts  ← LedgerClient (polling, execution)
  tool-registry.ts       ← [P3] Tool versions + hashing
  index.ts               ← Server entry point
```

---

## Key Metrics

### Current Status (Post-Priority-1)
- **Functionality**: ✅ Full (polling, execution, approval flow)
- **Safety**: ⚠️ Partial (no TTL, no concurrency guards, no auth)
- **Observability**: ❌ None (no metrics, no structured logs)
- **Test Coverage**: ⚠️ Partial (manual smoke tests only)

### After Priority 2
- **Functionality**: ✅ Full + hardened
- **Safety**: ✅ Complete (TTL, concurrency, auth)
- **Observability**: ⚠️ Basic
- **Test Coverage**: ⚠️ Partial (unit + integration)

### After Priority 3
- **Functionality**: ✅ Full + hardened + validated
- **Safety**: ✅ Complete + validated
- **Observability**: ✅ Complete (metrics + logs)
- **Test Coverage**: ✅ Comprehensive (80%+ coverage)

---

## Timeline Estimate

```
Week 1: Priority 2A (Expiry)              — 3-4 hours
Week 1: Priority 2B (Concurrency)         — 2-3 hours
Week 2: Priority 2C (Auth)                — 2-3 hours
Week 2: Priority 2 Testing + Docs         — 3-4 hours
        ↓
        Merge Priority 2 PR ✅
        ↓
Week 3: Priority 3A (Tool Metadata)       — 3-4 hours
Week 3-4: Priority 3B (Test Suite)        — 6-8 hours
Week 4: Priority 3C (Observability)       — 4-6 hours
        ↓
        Merge Priority 3 PR ✅
        ↓
        Production-Ready Ledger System 🚀
```

**Total**: ~4-6 weeks (staggered, allow parallel work)

---

## Success Criteria

### Priority 2 Done When
- ✅ All 3 changes implemented
- ✅ TypeScript compilation passes
- ✅ Unit tests written for new behavior
- ✅ Manual smoke test successful
- ✅ API documentation updated
- ✅ Code review approved

### Priority 3 Done When
- ✅ All 3 features implemented
- ✅ 4 integration tests passing
- ✅ Prometheus endpoint exposes metrics
- ✅ Grafana dashboard created
- ✅ Structured logs in ELK/Datadog
- ✅ Health checks passing

---

## Resources

### Documentation
- [Priority 1: Checkpoint Implementation](LEDGER_CHECKPOINT_IMPLEMENTATION.md)
- [Priority 2: Hardening Guide](PRIORITY_2_HARDENING_GUIDE.md)
- [Priority 3: Features Guide](PRIORITY_3_FEATURES_GUIDE.md)
- [Checkpoint Verification](CHECKPOINT_VERIFICATION.md)

### Related Docs
- [LEDGER_README.md](LEDGER_README.md) — Ledger system overview
- [LEDGER_WIRING_VERIFICATION.md](LEDGER_WIRING_VERIFICATION.md) — Integration points

### Tools & Libraries
- **Build**: TypeScript, Vite, pnpm
- **Testing**: Jest, ts-jest
- **Metrics**: prom-client
- **Logging**: pino, pino-pretty
- **Dashboards**: Grafana

---

## Questions?

### Where do I start?
→ Priority 2, Phase 1 (Approval Expiry)

### How long will each phase take?
→ See timeline estimate above (3-4 hours per phase)

### Do I need to wait for Priority 1 to be tested?
→ No, Priority 2 can start immediately (doesn't block each other)

### Can I do Priority 3 before Priority 2?
→ Not recommended. Priority 2 adds safety that Priority 3 validates.

### Who should review the code?
→ Codebase owner + one other engineer (for code review)

**Happy coding!** 🚀
