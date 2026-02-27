# 🚀 Ledger System: Quick Reference Card

> **Print this or bookmark it!**

---

## 📍 Where Am I?

- **✅ Priority 1**: DONE (Checkpoint + Polling)
- **📋 Priority 2**: READY (Expiry + Safety + Auth)
- **📅 Priority 3**: PLANNED (Observability + Tests)

---

## 🎯 Priority 2: What to Do (1-2 weeks)

### Change 2A: Approval Expiry (3-4 hours)
```typescript
// ledger.ts: Add fields
created_at: number;
ttl_ms: number;  // Default: 600000 (10 min)
status: 'pending' | 'decided';

// ledger.ts: Add methods
isApprovalExpired(approval, now) → boolean
getApprovalWithExpiry(id) → Approval
cleanupExpiredApprovals() → Promise<number>

// routes: Update endpoints
GET /approvals/:id       → 410 Gone if expired
POST /approvals/:id/decide → 410 Gone if expired
```

**Files**: `ledger.ts`, `routes.ts`, `state-machine.ts`

### Change 2B: Concurrency (2-3 hours)
```typescript
// routes.ts: Change error responses
NOT found?  → 404
ALREADY decided? → 409 (not 400!)
EXPIRED? → 410

// ledger-integration.ts: Handle them
if (status === 409) console.log('Already decided');
if (status === 410) return false;  // Expired
if (status === 404) return false;  // Not found
```

**Files**: `routes.ts`, `ledger-integration.ts`

### Change 2C: Auth (2-3 hours)
```typescript
// middleware.ts (NEW)
authLedgerToken(req, res, next) {
  const token = req.headers['x-ledger-token'];
  if (!VALID_TOKENS.has(token)) return 401;
  next();
}

// routes.ts: Apply to protected routes
app.post('/ledger/append', authLedgerToken, ...);
app.post('/approvals/:id/decide', authLedgerToken, ...);

// ledger-integration.ts: Add token
headers: { 'X-Ledger-Token': process.env.LEDGER_TOKEN }
```

**Files**: `middleware.ts` (NEW), `routes.ts`, `ledger-integration.ts`

---

## 📊 Priority 2 Status Tracker

```
Approval Expiry
├─ Schema: Add created_at, ttl_ms, status    ☐
├─ Ledger: Implement isApprovalExpired()     ☐
├─ Ledger: Implement cleanupExpiredApprovals() ☐
├─ Routes: Return 410 Gone                   ☐
├─ Tests: Write unit test for expiry         ☐
└─ Tests: Manual smoke test                  ☐

Concurrency Safety
├─ Routes: Change 400 → 409 on double-decide ☐
├─ Agent: Handle 409 response                ☐
├─ Tests: Unit test 409 behavior             ☐
└─ Tests: Integration test concurrent decisions ☐

Auth Token Validation
├─ Middleware: Create authLedgerToken()      ☐
├─ Routes: Apply to /ledger/append           ☐
├─ Routes: Apply to /approvals/:id/decide    ☐
├─ Agent: Add X-Ledger-Token header          ☐
├─ Config: Set LEDGER_TOKEN env var          ☐
├─ Tests: Unit test auth failure (401)       ☐
└─ Tests: Unit test auth success (200)       ☐
```

---

## 🎯 Priority 3: What to Do (3-4 weeks)

### Feature 3A: Tool Version Metadata (3-4 hours)
```typescript
// tool-registry.ts (NEW)
class ToolRegistry {
  getToolVersion(toolName) → {
    codehash,
    checksum_inputs,
    checksum_output
  }
}

// ledger-integration.ts: Capture in results
recordToolResult(..., toolVersion)
// Stores: codehash, checksums in result event
```

**Files**: `tool-registry.ts` (NEW), `ledger-integration.ts`, `validator.ts` (NEW)

### Feature 3B: Integration Tests (6-8 hours)
```typescript
// 4 Test Files (NEW)
1. ledger-restart-safety.test.ts
   → Agent crash doesn't double-execute

2. ledger-batch-atomicity.test.ts
   → Multi-event batch appends atomically

3. ledger-approval-race.test.ts
   → Concurrent decisions: 200 + 409

4. ledger-tool-divergence.test.ts
   → Code hash change detected
```

**Files**: 4 `.test.ts` files in `apps/nucleus/test/`

### Feature 3C: Observability (4-6 hours)
```typescript
// metrics.ts (NEW)
pollingCycles, toolExecutions, approvalWaitTime
toolExecutionDuration, divergenceDetected, ...

// logger.ts (NEW)
Structured JSON logging with pino

// health.ts (NEW)
GET /health/ledger → status + metrics

// Grafana Dashboard (NEW)
Tool execution rate, latency, divergence alerts
```

**Files**: `metrics.ts` (NEW), `logger.ts` (NEW), `health.ts` (NEW)

---

## 📋 Preqrequisites for Priority 2

✅ Priority 1 complete (you already have this)
✅ Understanding of checkpoint persistence
✅ Familiarity with ledger schema + routes
✅ Node.js + TypeScript basics

**Time to read before starting**: 30-45 min
→ Read: [PRIORITY_2_HARDENING_GUIDE.md](PRIORITY_2_HARDENING_GUIDE.md)

---

## 🛠 Build & Test Commands

```bash
# Build
pnpm --filter './apps/nucleus' run build
pnpm --filter './apps/agent-server' run build

# Type check
pnpm run typecheck

# Lint
pnpm run lint

# Tests (when you write them)
pnpm run test:ledger
pnpm run test:ledger -- --watch

# Full check before PR
pnpm run typecheck && pnpm run lint && pnpm run test:ledger
```

---

## 📂 Files You'll Modify

### Priority 2
```
✏️ Modify:  apps/nucleus/src/ledger/ledger.ts
✏️ Modify:  apps/nucleus/src/routes/ledger.ts
✏️ Modify:  apps/nucleus/src/approvals/state-machine.ts
✏️ Modify:  apps/agent-server/src/ledger-integration.ts
✨ Create:  apps/nucleus/src/routes/middleware.ts (P2C only)
```

### Priority 3
```
✨ Create:  apps/agent-server/src/tool-registry.ts
✨ Create:  apps/nucleus/src/ledger/validator.ts
✨ Create:  apps/nucleus/src/metrics.ts
✨ Create:  apps/nucleus/src/logger.ts
✨ Create:  apps/nucleus/src/routes/health.ts
✨ Create:  apps/nucleus/test/ledger-*.test.ts (4 files)
```

---

## 🚨 Common Mistakes

### ❌ Don't:
- Change 400 to 409 without updating agent error handling
- Add TTL without implementing cleanup
- Apply auth middleware to GET /ledger/stream (use optional auth)
- Forget to export middleware functions
- Skip writing tests for new behavior

### ✅ Do:
- Test with both mocked time and real time
- Document env variables (.env example)
- Write integration tests alongside unit tests
- Handle 410 Gone responses in polling loop
- Verify backward compatibility (no breaking changes if possible)

---

## 📞 Quick Decision Matrix

| Question | Answer | Next Action |
|----------|--------|------------|
| **When do I start?** | After Priority 1 is merged | Begin with Phase 1 |
| **Can I do all 3 phases in parallel?** | No | Sequential (Phase 1 → P2 → P3) |
| **How long total?** | 4-6 weeks | Plan accordingly |
| **Can I skip Priority 3?** | Not recommended | But P3 is lower priority |
| **What if I find a bug in P1?** | Fix it first | Then continue P2 |
| **Do I need someone else's approval?** | Yes | Get code review before merge |

---

## 🔗 Documentation Links

| Doc | Purpose | Length |
|-----|---------|--------|
| [LEDGER_DOCUMENTATION_INDEX.md](LEDGER_DOCUMENTATION_INDEX.md) | Navigator + FAQ | 5 min |
| [LEDGER_PRIORITIES_ROADMAP.md](LEDGER_PRIORITIES_ROADMAP.md) | Master roadmap | 10 min |
| [PRIORITY_2_HARDENING_GUIDE.md](PRIORITY_2_HARDENING_GUIDE.md) | Detailed P2 spec | 20 min |
| [PRIORITY_3_FEATURES_GUIDE.md](PRIORITY_3_FEATURES_GUIDE.md) | Detailed P3 spec | 20 min |
| [CHECKPOINT_VERIFICATION.md](CHECKPOINT_VERIFICATION.md) | P1 verification | 10 min |

**→ Start with**: [PRIORITY_2_HARDENING_GUIDE.md](PRIORITY_2_HARDENING_GUIDE.md)

---

## ✅ Pre-Implementation Checklist

- [ ] Read PRIORITY_2_HARDENING_GUIDE.md (20 min)
- [ ] Understand what each change does
- [ ] Identify which files need modification
- [ ] Create git branch: `feat/ledger-priority-2-hardening`
- [ ] Clear schedule: ~12-16 hours over 1-2 weeks
- [ ] Have code review partner identified
- [ ] Set up test files (Jest config if needed)

---

## 🎓 Learning Resources

**If you need to understand**:
- **Approvals**: Read "Change 1" in Priority 2 guide, then check `state-machine.ts`
- **HTTP status codes**: Search "409 Conflict" or "410 Gone" in guide
- **Auth patterns**: Read "Change 3" + look at middleware examples
- **Testing patterns**: Check Priority 3 test templates
- **Metrics**: Read "Feature 3C: Observability" in Priority 3 guide

---

## 📈 Success Criteria (Priority 2)

✅ All 3 changes implemented
✅ TypeScript compilation passes
✅ Unit tests written + passing
✅ Manual smoke test successful
✅ API docs updated (new status codes)
✅ Code review approved
✅ Zero breaking changes

---

## 🚀 Ready to Start?

1. **Read**: [PRIORITY_2_HARDENING_GUIDE.md](PRIORITY_2_HARDENING_GUIDE.md) (20 min)
2. **Setup**: `git checkout -b feat/ledger-priority-2-hardening`
3. **Code**: Start with "Change 1: Approval Expiry"
4. **Test**: Write tests as you go
5. **Submit**: Open PR with this guide referenced
6. **Review**: Address feedback
7. **Merge**: 🎉

**Time estimate**: 12-16 hours (spread over 1-2 weeks)

**Questions?** → Check [LEDGER_DOCUMENTATION_INDEX.md](LEDGER_DOCUMENTATION_INDEX.md) FAQ

---

**Last Updated**: 2026-02-25
**Status**: Priority 1 ✅ | Priority 2 📋 | Priority 3 📅
