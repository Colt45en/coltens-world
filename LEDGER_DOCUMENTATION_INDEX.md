# Ledger System Documentation Index

> **Quick Start**: Start with [LEDGER_PRIORITIES_ROADMAP.md](LEDGER_PRIORITIES_ROADMAP.md)

---

## 📋 Document Overview

### Core Implementation Docs

| Document | Purpose | Read Time | Status |
|----------|---------|-----------|--------|
| [LEDGER_PRIORITIES_ROADMAP.md](LEDGER_PRIORITIES_ROADMAP.md) | Master roadmap for all 3 priorities | 10 min | ✅ NEW |
| [LEDGER_CHECKPOINT_IMPLEMENTATION.md](LEDGER_CHECKPOINT_IMPLEMENTATION.md) | Priority 1 technical spec | 15 min | ✅ COMPLETE |
| [CHECKPOINT_VERIFICATION.md](CHECKPOINT_VERIFICATION.md) | Priority 1 verification checklist | 10 min | ✅ COMPLETE |
| [PRIORITY_2_HARDENING_GUIDE.md](PRIORITY_2_HARDENING_GUIDE.md) | Priority 2 detailed implementation | 20 min | ✅ NEW |
| [PRIORITY_3_FEATURES_GUIDE.md](PRIORITY_3_FEATURES_GUIDE.md) | Priority 3 observability & testing | 20 min | ✅ NEW |

---

## 🎯 Quick Navigation

### "I just want to know what's next"
→ [LEDGER_PRIORITIES_ROADMAP.md](LEDGER_PRIORITIES_ROADMAP.md) **Section: Priority 2**

### "I need to implement Priority 2"
1. Read: [PRIORITY_2_HARDENING_GUIDE.md](PRIORITY_2_HARDENING_GUIDE.md)
2. Files to modify:
   - `apps/nucleus/src/ledger/ledger.ts` (add TTL fields)
   - `apps/nucleus/src/routes/ledger.ts` (return 410/409, add auth)
   - `apps/nucleus/src/approvals/state-machine.ts` (track creation time)
   - `apps/agent-server/src/ledger-integration.ts` (handle new status codes)

### "I need to implement Priority 3"
1. Read: [PRIORITY_3_FEATURES_GUIDE.md](PRIORITY_3_FEATURES_GUIDE.md)
2. Create new files:
   - `apps/agent-server/src/tool-registry.ts` (new)
   - `apps/nucleus/src/metrics.ts` (new)
   - `apps/nucleus/src/logger.ts` (new)
   - `apps/nucleus/test/*.test.ts` (4 new tests)

### "I want to verify Priority 1 is correct"
→ [CHECKPOINT_VERIFICATION.md](CHECKPOINT_VERIFICATION.md)

### "I need the full technical picture"
→ [LEDGER_CHECKPOINT_IMPLEMENTATION.md](LEDGER_CHECKPOINT_IMPLEMENTATION.md) + [PRIORITY_2_HARDENING_GUIDE.md](PRIORITY_2_HARDENING_GUIDE.md)

---

## 📚 Reading Order

### For New Developers
1. [LEDGER_PRIORITIES_ROADMAP.md](LEDGER_PRIORITIES_ROADMAP.md) (overview)
2. [LEDGER_CHECKPOINT_IMPLEMENTATION.md](LEDGER_CHECKPOINT_IMPLEMENTATION.md) (understand what exists)
3. [PRIORITY_2_HARDENING_GUIDE.md](PRIORITY_2_HARDENING_GUIDE.md) (what comes next)

### For Code Reviewers
1. [CHECKPOINT_VERIFICATION.md](CHECKPOINT_VERIFICATION.md) (checklist)
2. [PRIORITY_2_HARDENING_GUIDE.md](PRIORITY_2_HARDENING_GUIDE.md) sections 1-3 (understand changes)
3. Actual code diffs (in PR)

### For Test Writers
1. [PRIORITY_3_FEATURES_GUIDE.md](PRIORITY_3_FEATURES_GUIDE.md) **Section: Feature 2**
2. Copy test templates
3. Implement in Jest

### For DevOps/SRE
1. [LEDGER_PRIORITIES_ROADMAP.md](LEDGER_PRIORITIES_ROADMAP.md) (overall impact)
2. [PRIORITY_2_HARDENING_GUIDE.md](PRIORITY_2_HARDENING_GUIDE.md) **Section: Deployment Considerations**
3. [PRIORITY_3_FEATURES_GUIDE.md](PRIORITY_3_FEATURES_GUIDE.md) **Section: Feature 3 (Observability)**

---

## 🗂 File Structure

```
coltens world/
├── LEDGER_PRIORITIES_ROADMAP.md              ← START HERE
├── CHECKPOINT_VERIFICATION.md                ← P1 checklist
├── LEDGER_CHECKPOINT_IMPLEMENTATION.md       ← P1 technical
├── PRIORITY_2_HARDENING_GUIDE.md             ← P2 detailed
├── PRIORITY_3_FEATURES_GUIDE.md              ← P3 detailed
│
├── apps/
│   ├── nucleus/
│   │   └── src/
│   │       ├── ledger/
│   │       │   ├── ledger.ts                 ← [P2] Add TTL fields
│   │       │   └── validator.ts              ← [P3] NEW divergence
│   │       ├── routes/
│   │       │   ├── ledger.ts                 ← [P2] Add 410/409
│   │       │   ├── health.ts                 ← [P3] NEW
│   │       │   └── middleware.ts             ← [P2] NEW auth
│   │       ├── approvals/
│   │       │   └── state-machine.ts          ← [P2] Track created_at
│   │       ├── metrics.ts                    ← [P3] NEW
│   │       ├── logger.ts                     ← [P3] NEW
│   │       └── test/
│   │           ├── ledger-restart-safety.test.ts      ← [P3] NEW
│   │           ├── ledger-batch-atomicity.test.ts     ← [P3] NEW
│   │           ├── ledger-approval-race.test.ts       ← [P3] NEW
│   │           └── ledger-tool-divergence.test.ts     ← [P3] NEW
│   │
│   └── agent-server/
│       └── src/
│           ├── ledger-integration.ts         ← [P1] ✅ DONE
│           ├── tool-registry.ts              ← [P3] NEW
│           └── index.ts                      ← Uses LedgerClient
```

---

## 📊 Status Summary

### Priority 1: ✅ COMPLETE
- Implementation: [ledger-integration.ts](apps/agent-server/src/ledger-integration.ts) (483 lines)
- Features: Polling, checkpoint persistence, tool execution, idempotency
- Testing: Manual smoke test (not written yet)
- Docs: 2 docs + inline comments
- **Next Step**: Verify with live ledger, then start Priority 2

### Priority 2: 📋 PLANNED (Ready to Start)
- **Phase 1** (Expiry): 3-4h
  - Add `created_at`, `ttl_ms`, `status` fields to approval schema
  - Implement `isApprovalExpired()`, `cleanupExpiredApprovals()`
  - Return 410 Gone on expired approvals

- **Phase 2** (Concurrency): 2-3h
  - Change 400 → 409 on double-decide
  - Update agent error handling (tolerate 410/409)

- **Phase 3** (Auth): 2-3h
  - Add middleware: `authLedgerToken()`
  - Apply to protected routes
  - Add token to agent-server requests

- **Testing & Docs**: 3-4h
- **Total**: ~1-2 weeks

### Priority 3: 📅 PLANNED (After P2)
- **Feature 1** (Tool Metadata): 3-4h
  - Create `ToolRegistry` with hash computation
  - Capture `codehash`, `checksum_inputs`, `checksum_output` in results
  - Implement divergence validator

- **Feature 2** (Test Suite): 6-8h
  - Write 4 integration tests (restart, batch, race, divergence)
  - Set up Jest infrastructure

- **Feature 3** (Observability): 4-6h
  - Add Prometheus metrics
  - Integrate pino structured logging
  - Create Grafana dashboard

- **Total**: ~3-4 weeks (staggered)

---

## 🚀 Getting Started

### To Start Priority 2: Approval Expiry
```bash
git checkout -b feat/ledger-priority-2-hardening

# Read guide
code PRIORITY_2_HARDENING_GUIDE.md  # Read "Change 1: Approval Expiry"

# Start implementing
code apps/nucleus/src/ledger/ledger.ts       # Add TTL fields
code apps/nucleus/src/routes/ledger.ts       # Add 410 Gone response
code apps/nucleus/src/approvals/state-machine.ts  # Track created_at

# Build
pnpm --filter './apps/nucleus' run build
pnpm --filter './apps/agent-server' run build

# Test
pnpm run typecheck
pnpm run lint

# Commit
git add .
git commit -m "feat(ledger): add approval TTL enforcement"
```

### To Start Priority 3: Tool Metadata
```bash
git checkout -b feat/ledger-priority-3-observability

# Read guide
code PRIORITY_3_FEATURES_GUIDE.md  # Read "Feature 1: Tool Version Metadata"

# Create tool registry
code apps/agent-server/src/tool-registry.ts      # NEW file

# Update ledger integration
code apps/agent-server/src/ledger-integration.ts  # Capture versions

# Create validator
code apps/nucleus/src/ledger/validator.ts  # NEW file for divergence detection

# Build & test
pnpm --filter './apps/nucleus' run build
pnpm --filter './apps/agent-server' run build
```

---

## 📞 FAQ

### Q: Can I work on Priority 2 and 3 in parallel?
**A**: Not recommended. Priority 2 adds safety that Priority 3 tests. Better to complete P2 first (1-2 weeks), then start P3.

### Q: Do I need to finish Priority 1 before starting Priority 2?
**A**: No. Priority 1 is already done. Start Priority 2 anytime.

### Q: How much time should I budget?
**A**: ~4-6 weeks total (P2: 1-2w, P3: 3-4w). Can be compressed with parallel work.

### Q: What if I only have time for Priority 2?
**A**: That's fine. Priority 2 makes the system production-ready. Priority 3 adds observability but isn't required for core functionality.

### Q: Do I need all 4 Priority 3 tests?
**A**: Yes. They validate:
1. Restart safety (no double execution)
2. Batch atomicity (no partial updates)
3. Approval race safety (409 vs 200)
4. Divergence detection (code version tracking)

All are critical for production.

### Q: Where's the Priority 1 implementation?
**A**: [apps/agent-server/src/ledger-integration.ts](apps/agent-server/src/ledger-integration.ts) (483 lines, complete)

### Q: Can I copy-paste test templates from Priority 3 guide?
**A**: Yes, absolutely. All test examples are production-ready templates.

---

## 📝 How to Use These Documents

### As Implementation Checklist
√ Open Priority 2 guide
√ Go through each change section
√ Mark items as complete
√ Run tests after each phase

### As Code Review Guide
√ Share PR with reviewers
√ Point to relevant section in guide
√ Use "Testing" subsection to verify completeness

### As Onboarding Material
√ New developer reads ROADMAP first
√ Then reads relevant priority guide
√ Reference implementation docs while coding

---

## 🔗 External References

### Nucleus Ledger System
- Main: [apps/nucleus/src/ledger/](apps/nucleus/src/ledger/)
- Routes: [apps/nucleus/src/routes/ledger.ts](apps/nucleus/src/routes/ledger.ts)
- Approvals: [apps/nucleus/src/approvals/state-machine.ts](apps/nucleus/src/approvals/state-machine.ts)

### Agent Server Integration
- Ledger Client: [apps/agent-server/src/ledger-integration.ts](apps/agent-server/src/ledger-integration.ts)
- Server: [apps/agent-server/src/index.ts](apps/agent-server/src/index.ts)

### Related Ledger Docs
- [LEDGER_README.md](LEDGER_README.md) — System overview
- [LEDGER_WIRING_VERIFICATION.md](LEDGER_WIRING_VERIFICATION.md) — Integration points
- [LEDGER_ARCHITECTURE.md](LEDGER_ARCHITECTURE.md) — Design decisions (if exists)

---

## ✅ Verification Checklist

Before declaring a priority complete:

### Priority 1 ✅
- [x] TypeScript compilation passes
- [x] Checkpoint persistence implemented
- [x] Polling loop functional
- [x] Tool execution working
- [x] Idempotency guards in place
- [x] Documentation written
- [ ] Integration test with live ledger
- [ ] Manual smoke test successful

### Priority 2 (When Done)
- [ ] All 3 changes implemented (expiry, concurrency, auth)
- [ ] TypeScript compilation passes
- [ ] Unit tests written
- [ ] Integration tests passing
- [ ] API docs updated (410, 409, 401 status codes)
- [ ] Code review approved
- [ ] Deployment guide written

### Priority 3 (When Done)
- [ ] Tool metadata captured
- [ ] 4 integration tests passing
- [ ] Prometheus metrics exposed
- [ ] Grafana dashboard created
- [ ] Structured logging working
- [ ] Health checks passing
- [ ] Documentation complete
- [ ] Code coverage 80%+

---

## 🎓 Learning Path

1. **Understand Current System** (30 min)
   - Read: ROADMAP (Priority 1 section)
   - Skim: CHECKPOINT_IMPLEMENTATION.md

2. **Plan Priority 2** (30 min)
   - Read: ROADMAP (Priority 2 section)
   - Read: PRIORITY_2_HARDENING_GUIDE.md (full)

3. **Implement Priority 2** (hours 4-12)
   - Implement each phase
   - Write tests
   - Get code review

4. **Plan Priority 3** (30 min)
   - Read: ROADMAP (Priority 3 section)
   - Read: PRIORITY_3_FEATURES_GUIDE.md (full)

5. **Implement Priority 3** (hours 13-24)
   - Implement features
   - Write integration tests
   - Set up observability

6. **Deploy & Monitor** (ongoing)
   - Monitor metrics
   - Track performance
   - Fix issues

---

**Total Reading Time**: ~2 hours
**Total Implementation Time**: ~24 hours (distributed over 4-6 weeks)
**Total Project Duration**: 4-6 weeks (with proper planning)

**Ready to start?** → Go to [LEDGER_PRIORITIES_ROADMAP.md](LEDGER_PRIORITIES_ROADMAP.md) **Priority 2 section** 🚀
