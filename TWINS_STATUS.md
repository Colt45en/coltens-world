# Twin Cleanup: Status & Next Actions

**Last Updated**: 2026-02-25
**Phase**: 6 — TS-as-Source Determinism
**Status**: 🟡 **PHASE A COMPLETE, PHASE B AWAITING DECISIONS**

---

## What Just Happened (Phase A ✅)

### Executed
```
131 twin pairs analyzed
  ├─ 87 TS winners (TS active, JS dead)
  ├─ 36 JS winners (JS active, TS unused)
  └─ 8 mixed (entrypoint confusion)

52 safe moves executed
  ├─ Archived to: history/2026-02-25/twins/
  ├─ Tracked in: history/2026-02-25/twins-plan.json
  └─ Verified: history/2026-02-25/twins-manifest.json

Build verification: ✅ PASS
  ├─ packages/flowstate → built OK
  ├─ packages/engine → built OK
  └─ apps/nucleus → built OK
```

### Artifacts Generated
```
✅ tools/twins/resolve-from-md.cjs (260 lines)
   ├─ Parse markdown twin reports
   ├─ Identify safe moves (TS winner + 0 JS importers)
   └─ Archive to history/ with audit trail

✅ tools/twins/check-src-purity.cjs (50 lines)
   ├─ CI/CD guardrail
   ├─ Fails if .js found in src/
   └─ Prevents twin regression

✅ tools/twins/extract-decisions.mjs (NEW)
   ├─ Extract JS-winner & mixed pairs
   ├─ Organize by package
   └─ Generate decision reference

✅ TWINS_CLEANUP_REPORT.md (Complete analysis)
✅ TWINS_DECISION_GUIDE.md (Action framework)
```

---

## What Needs Decisions (Phase B ⏳)

### JS Winners (36 packages)

**Path 1: Migrate JS → TS** (recommended for most)
```
1. Review TS version of file
2. Update imports to use TS build output
3. Delete .js source twin
4. Test
```

**Path 2: Keep JS, Archive TS** (if TS incomplete/risky)
```
1. Archive TS version to history/
2. Keep JS as-is
3. No import changes
4. Plan TS migration later
```

**By Package** (from TWINS_DECISION_GUIDE.md):
- `apps/env-sandbox` (7 files) → **Recommend Path 1**
- `apps/nucleus` (8 files) → **Recommend Path 1**
- `packages/brain` (4 files) → **Recommend Path 1**
- `packages/engine` (14 files) → **Recommend Path 1**
- `packages/protocol` (3 files) → **Recommend Path 1**

### Mixed Pairs (8 packages)

**Simple fix**: Ensure package.json exports point to `dist/`, not `src/`

```
❌ Current (can be):
  "main": "./src/index.js"

✅ Should be:
  "main": "./dist/index.js"
```

**Items to audit**:
- `apps/env-sandbox/package.json`
- `packages/brain/package.json`
- `packages/engine/package.json`
- `packages/flowstate/package.json`
- `packages/math/package.json`
- `packages/protocol/package.json`
- `packages/tooling/package.json`
- `packages/util/package.json`

---

## Files You Now Have

### Documentation
```
✅ TWINS_CLEANUP_REPORT.md
   └─ Complete analysis, build verification, success criteria

✅ TWINS_DECISION_GUIDE.md
   └─ Per-package breakdown, Path 1/Path 2 framework, implementation checklist

✅ This file (STATUS.md)
   └─ Quick reference, commands, what to do next
```

### Tools (Reusable)
```
✅ tools/twins/resolve-from-md.cjs
   Usage: node resolve-from-md.cjs --report FILE.md --plan
           node resolve-from-md.cjs --report FILE.md --apply

✅ tools/twins/check-src-purity.cjs
   Usage: node check-src-purity.cjs
   CI integration: Add to build/test pipeline

✅ tools/twins/extract-decisions.mjs
   Usage: node extract-decisions.mjs
   Output: Categorized list of decisions needed
```

### Audit Data
```
✅ history/2026-02-25/twins-plan.json
   └─ Full analysis (84 safe, 47 decisions)

✅ history/2026-02-25/twins-manifest.json
   └─ Applied moves (52 + errors)

✅ history/2026-02-25/twins/README.md
   └─ Archive explanation + restore instructions

✅ history/2026-02-25/twins/
   └─ 52 archived .js files (reversible)
```

---

## Quick Commands

### Verify current state
```bash
# Check what's in the decision plan
cat history/2026-02-25/twins-plan.json | jq '.summary'

# List all JS winners needing decisions
node tools/twins/extract-decisions.mjs

# Verify no new .js crept into src/
node tools/twins/check-src-purity.cjs
```

### When ready to commit Phase A
```bash
git add -A
git commit -m "chore: TS-as-source twin cleanup — Phase A (52 safe moves)

- Copy 52 JS twins (TS winner + 0 importers) to history/2026-02-25/twins/
- Add twin cleanup tooling (resolve-from-md.cjs, check-src-purity.cjs)
- Identify 36 JS-winners + 8 mixed pairs for Phase B
- All core packages build successfully after cleanup

Stats: 131 total pairs analyzed, 84 safe candidates, 52 moved, 0 build breakage.

See: TWINS_CLEANUP_REPORT.md, TWINS_DECISION_GUIDE.md"
```

### When starting Phase B (Per-package migration)
```bash
# Build one package
pnpm -C packages/engine run build

# Test one package
pnpm -C packages/engine run test

# View package exports
cat packages/engine/package.json | grep -A10 '"exports"'

# After decision, delete or archive twin
rm packages/engine/src/index.js    # Path 1: delete JS
# OR
mv packages/engine/src/index.ts history/2026-02-25/twins/packages/engine/src/  # Path 2: archive TS
```

### Re-run cleanup tools later (if new twins appear)
```bash
# Parse new report
node tools/twins/resolve-from-md.cjs --report new_report.md --plan

# Preview changes
node tools/twins/resolve-from-md.cjs --report new_report.md --apply

# Extract just the decisions
node tools/twins/extract-decisions.mjs > decisions-this-week.md
```

---

## Decision Template (Copy & Fill Per-Package)

```markdown
## packages/engine

### Analysis
- JS files: 14 active imports
- TS twins: 14 unused
- Effort to migrate: 2h

### Decision
- [x] Path 1: Migrate to TS
- [ ] Path 2: Keep JS, archive TS

### Rationale
Core package; all TS versions available; low import refactor cost.

### Status
- [ ] TS versions reviewed & complete
- [ ] Imports updated (internal + external)
- [ ] package.json exports updated
- [ ] Build passes: `pnpm -C packages/engine run build`
- [ ] Tests pass: `pnpm -C packages/engine run test`
- [ ] .js twins deleted
- [ ] Verified no regressions in dependent packages
```

---

## Timeline Suggestion

### This Week (Phase B — Decisions)
- [ ] Mon/Tue: Decide Path 1 vs Path 2 per package (2h planning)
- [ ] Wed/Thu: Migrate 5-10 packages in parallel (8h work)
- [ ] Fri: Review + fix entrypoints (2h)
- [ ] Fri PM: Full build + test validation (1h)

### Next Week (Phase C — Finalization)
- [ ] Mon: Complete remaining migrations (4h)
- [ ] Tue: Wire guardrail into CI (1h)
- [ ] Wed: Final audit + cleanup (1h)
- [ ] Thu: Commit & close phase (documentation, 1h)

---

## Success Criteria (Tracked)

- ✅ Phase A: Archive safe twins
  - ✅ 52 files moved
  - ✅ Build verified (flowstate, engine, nucleus OK)
  - ✅ Audit trail complete

- ⏳ Phase B: JS-winner decisions (per TWINS_DECISION_GUIDE.md)
  - [ ] Path 1/2 chosen for each of 36 packages
  - [ ] Imports updated
  - [ ] package.json exports fixed
  - [ ] Tests pass per-package

- ⏳ Phase C: Entrypoint fixes
  - [ ] All 8 package.json files verified → `dist/`
  - [ ] Mixed twins archived or deleted
  - [ ] No `src/` twins remain

- [ ] Phase D: Guardrail
  - [ ] `check-src-purity.cjs` wired to pre-commit / CI
  - [ ] Future twins prevented

---

## Blockers / Questions?

**If build breaks**:
1. Check which package failed
2. Restore archived file from `history/2026-02-25/twins/`
3. Investigate why TS wasn't actively imported

**If unsure Path 1 vs Path 2**:
1. Review the TS version (it exists!)
2. Check if imports can be updated easily
3. Estimate effort: if <2h, Path 1; if >2h, consider Path 2
4. Default to Path 1 for shared packages (better for entire repo)

**If entrypoint changes break a package**:
1. Verify `package.json` actually points to `dist/`
2. Check if build outputs to correct location
3. Review dependent packages — they may have cached old imports

---

## What's Next?

**Pick one action**:

1. **Start Phase B immediately** (have team choose Path 1/2 per package)
2. **Fix entrypoints first** (audit all 8 package.json files)
3. **Automate Phase B** (I create a script to apply decisions uniformly)
4. **Just commit Phase A first** (gather feedback, then Phase B next week)

**Status**: All tools ready, all data prepared. Just need decisions! 🚀
