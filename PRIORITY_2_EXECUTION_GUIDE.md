# 🚀 Priority 2 Execution Guide

**Start Date**: 2026-02-25
**Duration**: 1-2 weeks
**Build Status**: ✅ Clean (nucleus builds successfully)

---

## 📚 Document Reading Path

### Day 1: Planning & Preparation (30 min)
1. **Read**: [LEDGER_QUICK_REFERENCE.md](LEDGER_QUICK_REFERENCE.md) (5 min)
   → Quick overview of all priorities, status tracker

2. **Read**: [PRIORITY_2_HARDENING_GUIDE.md](PRIORITY_2_HARDENING_GUIDE.md) **→ Overview section** (5 min)
   → Understand why Priorities 2 exists

3. **Read**: [PRIORITY_2_PHASE_1_KICKOFF.md](PRIORITY_2_PHASE_1_KICKOFF.md) (10 min)
   → Understand Phase 1 goals + timeline

4. **Plan**: Block 3-4 hours this week for Phase 1
   → Find uninterrupted time for coding

### Days 2-3: Phase 1 Implementation (3-4 hours)
1. **Read**: [PRIORITY_2_PHASE_1_IMPLEMENTATION.md](PRIORITY_2_PHASE_1_IMPLEMENTATION.md) (10 min)
   → Exact file paths, line numbers, code to copy-paste

2. **Code**: Follow 6-step checklist
   - File 1: ledger.ts (add fields + 3 methods)
   - File 2: routes/ledger.ts (update 2 endpoints)
   - File 3: state-machine.ts (track TTL)
   - File 4: test file (create new)
   - Build & verify
   - Manual smoke test

3. **Verify**: All checklist items ✅

### Days 4-5: Phase 2 Implementation (2-3 hours)
1. **Read**: [PRIORITY_2_HARDENING_GUIDE.md](PRIORITY_2_HARDENING_GUIDE.md) **→ Change 2B** (5 min)
   → Understand 409 Conflict handling

2. **Code**:
   - Update routes/ledger.ts (return 409 on double-decide)
   - Update ledger-integration.ts (handle 409 response)
   - Write unit test

3. **Verify**: Build passes + tests passing

### Days 6-7: Phase 3 Implementation (2-3 hours)
1. **Read**: [PRIORITY_2_HARDENING_GUIDE.md](PRIORITY_2_HARDENING_GUIDE.md) **→ Change 3** (5 min)
   → Understand X-Ledger-Token auth

2. **Code**:
   - Create middleware.ts (new file)
   - Apply to protected routes
   - Add token to agent-server requests
   - Write unit tests

3. **Verify**: Build passes + auth working

### Day 8: Testing + Documentation (3-4 hours)
1. **Write**: Integration test for approval expiry + cleanup
2. **Write**: Integration test for 409 race condition
3. **Update**: API documentation (new status codes)
4. **Prepare**: PR with reference to this guide

### Day 9: Code Review & Merge
1. **Submit**: PR with guide reference
2. **Address**: Feedback from reviewers
3. **Merge**: Priority 2 ✅

---

## 🎯 Phase-by-Phase Detail

### Phase 1: Approval Expiry ✅ TODO

**What**: Add TTL so approvals auto-expire after 10 minutes

**Files**:
- `apps/nucleus/src/ledger/ledger.ts` — Add fields + methods
- `apps/nucleus/src/routes/ledger.ts` — Return 410 Gone
- `apps/nucleus/src/approvals/state-machine.ts` — Track created_at
- `apps/nucleus/test/ledger-expiry.test.ts` — New test file

**Duration**: 3-4 hours (split across 2 days if needed)

**Verification**:
```bash
pnpm --filter './apps/nucleus' run build  # Must pass
curl http://localhost:3000/approvals/appr-1  # 410 after TTL
```

**Next**: Move to Phase 2 when all checklist items ✅

**Guide**: [PRIORITY_2_PHASE_1_IMPLEMENTATION.md](PRIORITY_2_PHASE_1_IMPLEMENTATION.md)

---

### Phase 2: Concurrency Safety 📋 TODO

**What**: Return 409 Conflict (not 400) when approval already decided

**Why**: Client can distinguish "already decided" from "invalid request"

**Files**:
- `apps/nucleus/src/routes/ledger.ts` — Change 400 → 409
- `apps/agent-server/src/ledger-integration.ts` — Handle 409

**Duration**: 2-3 hours

**Verification**:
```bash
# First decide
curl -X POST http://localhost:3000/approvals/appr-1/decide \
  -d '{"decision":"approved"}'  # 200 OK

# Second decide (same approval)
curl -X POST http://localhost:3000/approvals/appr-1/decide \
  -d '{"decision":"rejected"}'  # 409 Conflict ✅ (not 400!)
```

**Next**: Move to Phase 3 when Phase 2 checklist ✅

**Guide**: [PRIORITY_2_HARDENING_GUIDE.md](PRIORITY_2_HARDENING_GUIDE.md) → Change 2B

---

### Phase 3: Auth Token Validation 📋 TODO

**What**: Add X-Ledger-Token header validation to all writes

**Why**: Prevent unauthorized users from appending events

**Files**:
- `apps/nucleus/src/routes/middleware.ts` — New file
- `apps/nucleus/src/routes/ledger.ts` — Apply middleware
- `apps/agent-server/src/ledger-integration.ts` — Add token header

**Duration**: 2-3 hours

**Verification**:
```bash
# Without token: 401
curl -X POST http://localhost:3000/ledger/append -d '...'
# Expected: 401 UNAUTHORIZED ✅

# With token: 200
curl -X POST http://localhost:3000/ledger/append \
  -H "X-Ledger-Token: dev-token-12345" -d '...'
# Expected: 200 OK ✅
```

**Next**: All 3 phases done → PR ready for review

**Guide**: [PRIORITY_2_HARDENING_GUIDE.md](PRIORITY_2_HARDENING_GUIDE.md) → Change 3

---

## 🛠 Development Tools

### Build Commands
```bash
# Build nucleus (after each change)
pnpm --filter './apps/nucleus' run build

# Type check all packages
pnpm run typecheck

# Lint
pnpm run lint

# Combined check
pnpm run typecheck && pnpm run lint && pnpm --filter './apps/nucleus' run build
```

### Testing Commands
```bash
# Run all tests
pnpm run test:ledger

# Run specific test file
pnpm run test:ledger -- --testNamePattern="Expiry"

# Watch mode
pnpm run test:ledger -- --watch

# Coverage
pnpm run test:ledger -- --coverage
```

### Manual Testing (Use curl)
```bash
# Create approval
curl -X POST http://localhost:3000/ledger/append \
  -H "Content-Type: application/json" \
  -d '{...approval.requested event...}'

# Check approval status
curl http://localhost:3000/approvals/appr-1

# Decide on approval
curl -X POST http://localhost:3000/approvals/appr-1/decide \
  -H "Content-Type: application/json" \
  -d '{"decision":"approved"}'
```

---

## 📋 Daily Standup Notes

### Day 1: Planning
- [ ] Understand TTL concept
- [ ] Identify 3 files to modify
- [ ] Plan 3-4 hour coding session
- [ ] Clear calendar for uninterrupted time

### Day 2-3: Phase 1 Coding
- [ ] File 1: ledger.ts (30 min)
- [ ] Build 1st time (5 min)
- [ ] File 2: routes/ledger.ts (20 min)
- [ ] Build 2nd time (5 min)
- [ ] File 3: state-machine.ts (20 min)
- [ ] Build 3rd time (5 min)
- [ ] Write test (30 min)
- [ ] Manual smoke test (15 min)
- [ ] All tests passing ✅

### Day 4: Phase 2 Coding
- [ ] Update routes/ledger.ts (15 min)
- [ ] Update ledger-integration.ts (15 min)
- [ ] Write unit test (20 min)
- [ ] Build + test (10 min)

### Day 5: Phase 3 Coding
- [ ] Create middleware.ts (20 min)
- [ ] Apply middleware (15 min)
- [ ] Update agent-server (10 min)
- [ ] Write unit tests (20 min)
- [ ] Build + test (10 min)

### Day 6: Final Testing
- [ ] Write integration tests (1 hour)
- [ ] Manual end-to-end test (30 min)
- [ ] Update API docs (30 min)
- [ ] Review all changes (30 min)

### Day 7: Code Review Prep
- [ ] Create git branch
- [ ] Commit all changes (with meaningful messages)
- [ ] Prepare PR description (reference this guide)
- [ ] Self-review: no obvious issues

### Day 8: Submit & Review
- [ ] Submit PR
- [ ] Address feedback
- [ ] Iterate until approved
- [ ] Merge ✅

---

## ✅ Pre-Implementation Checklist

Before coding:

- [ ] Read [LEDGER_QUICK_REFERENCE.md](LEDGER_QUICK_REFERENCE.md) (bookmark this!)
- [ ] Read [PRIORITY_2_HARDENING_GUIDE.md](PRIORITY_2_HARDENING_GUIDE.md) section intro
- [ ] Understand 3 changes: Expiry, Concurrency, Auth
- [ ] Set up git branch: `feat/ledger-priority-2-hardening`
- [ ] Clear 1-2 weeks for implementation
- [ ] Have code review partner identified
- [ ] Know where to find your 3 target files
- [ ] Nucleus builds cleanly: `pnpm --filter './apps/nucleus' run build` ✅

---

## 🚨 Common Mistakes to Avoid

❌ **Don't**:
- Skip Phase 1 before Phase 2 (they build on each other)
- Change 400 to 409 without updating agent error handling
- Add TTL without implementing cleanup
- Apply auth middleware to GET endpoints (only writes)
- Forget to commit test files
- Submit PR without self-review

✅ **Do**:
- Build after each file change (catch errors early)
- Write tests as you code
- Test manually with curl (verify behavior)
- Document env variables (.env example)
- Keep commits small & focused
- Reference this guide in PR description

---

## 📞 If You Get Stuck

### Build Errors
1. Look for "Cannot find name X" → Missing import or typo
2. Look for "Type 'X' is missing properties" → Schema mismatch
3. Copy-paste error checks → Verify indentation + syntax

### Build succeeds but tests fail
1. Check test timeout (approvals tests sometimes timeout)
2. Verify test uses mocked time correctly
3. Check approval object structure matches test

### Manual test doesn't work
1. Verify nucleus is running: `pnpm --filter './apps/nucleus' run dev`
2. Verify endpoint exists: check routes/ledger.ts
3. Check JSON format in curl command (valid JSON?)
4. Look at nucleus logs for error messages

### Still stuck?
1. Reread the guide section for that phase
2. Check linked files in [PRIORITY_2_HARDENING_GUIDE.md](PRIORITY_2_HARDENING_GUIDE.md)
3. Review code comments (added for readability)

---

## 🎯 Success Criteria Checklist

### Phase 1 Done When:
- ✅ TTL fields added to schema
- ✅ 3 methods implemented (isApprovalExpired, getApprovalWithExpiry, cleanupExpiredApprovals)
- ✅ Routes updated (410 Gone responses)
- ✅ State machine tracks created_at + TTL
- ✅ Build passes with no errors
- ✅ Unit tests written + passing
- ✅ Manual smoke test successful

### Phase 2 Done When:
- ✅ 409 Conflict returned on double-decide
- ✅ Agent handles 409 correctly
- ✅ Build passes
- ✅ Unit tests written + passing

### Phase 3 Done When:
- ✅ Middleware created + validates tokens
- ✅ Protected routes require X-Ledger-Token
- ✅ Agent sends token in requests
- ✅ Build passes
- ✅ Unit tests written + passing

### PR Ready When:
- ✅ All 3 phases done
- ✅ Integration tests written (2-3 tests)
- ✅ API docs updated
- ✅ Self-review completed (no obvious issues)
- ✅ Git commits clean + well-messaged
- ✅ Reference [PRIORITY_2_HARDENING_GUIDE.md](PRIORITY_2_HARDENING_GUIDE.md) in PR description

---

## 📈 Timeline Summary

```
Day 1:     Planning (0.5h)
Days 2-3:  Phase 1 (3-4h)  → Expiry TTL
Days 4:    Phase 2 (2-3h)  → 409 Conflict
Days 5:    Phase 3 (2-3h)  → Auth Tokens
Days 6:    Testing (3-4h)  → Integration tests + docs
Days 7-8:  Code Review (2-3h) → Feedback + merge
───────────────────────────
Total:     14-18 hours over 8 days ≈ 2 weeks ✅
```

---

## 🚀 After Priority 2

Once this is merged:

**Priority 3** starts (3-4 weeks):
- Tool version metadata (detect code divergence)
- 4 integration tests (safety validation)
- Observability stack (Prometheus + logging)

See: [PRIORITY_3_FEATURES_GUIDE.md](PRIORITY_3_FEATURES_GUIDE.md)

---

## 📞 Support Resources

| Need | Document |
|------|----------|
| Quick lookup | [LEDGER_QUICK_REFERENCE.md](LEDGER_QUICK_REFERENCE.md) |
| Phase 1 code | [PRIORITY_2_PHASE_1_IMPLEMENTATION.md](PRIORITY_2_PHASE_1_IMPLEMENTATION.md) |
| Design rationale | [PRIORITY_2_HARDENING_GUIDE.md](PRIORITY_2_HARDENING_GUIDE.md) |
| Master roadmap | [LEDGER_PRIORITIES_ROADMAP.md](LEDGER_PRIORITIES_ROADMAP.md) |
| All docs index | [LEDGER_DOCUMENTATION_INDEX.md](LEDGER_DOCUMENTATION_INDEX.md) |

---

**Status**: 🟢 **READY TO START**

**Next Action**: Open [PRIORITY_2_PHASE_1_IMPLEMENTATION.md](PRIORITY_2_PHASE_1_IMPLEMENTATION.md) and start with **File 1: ledger.ts**

**Good luck!** 🚀
