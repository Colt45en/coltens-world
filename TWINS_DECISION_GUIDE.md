# Twin Cleanup: Decision Guide for Phase B & C

**Status**: 52 files archived ✅ | 44 files need decisions ⏳

---

## Quick Summary

| Decision Type | Count | Action |
|---------------|-------|--------|
| **JS Winners** | 36 | Choose: Migrate JS→TS, or keep JS+archive TS |
| **Mixed (entrypoints)** | 8 | Fix `package.json` exports → verify they point to `dist/` |
| **Total pending** | **44** | Parallelizable|

---

## Part A: JS-Winner Decisions (36 files)

**These have ACTIVE JavaScript imports** but TS twins exist.
**Decision**: Per-package choice — **Path 1 (migrate to TS)** or **Path 2 (keep JS, archive TS)**.

### apps/env-sandbox (7 files)

**Strategy recommendation**: **Path 1 (Migrate to TypeScript)**
*Reason*: Entrypoints are JS now, but TS versions available. Full migration would align with TS-as-source goal.

| File | JS Importers | TS Status | Effort |
|------|--------------|-----------|--------|
| `types.js` | 7 | unused | 1h |
| `contracts.js` | 6 | unused | 1h |
| `storage.js` | 6 | unused | 1h |
| `audit.js` | 4 | unused | 1h |
| `policy.js` | 2 | unused | 1h |
| `sandbox.js` | 2 | unused | 1h |
| `sandbox-tools.js` | 2 | unused | 1h |

**Action if Path 1**: Update entrypoint to use TS versions, delete JS twins
**Action if Path 2**: Archive all TS versions, keep JS as is

---

### apps/nucleus (8 files)

**Strategy recommendation**: **Path 1 (Migrate to TypeScript)**
*Reason*: Critical runtime app. TS would improve type safety; all TS versions available.

| File | JS Importers | TS Status | Effort |
|------|--------------|-----------|--------|
| `uee.js` | 7 | unused | 2h |
| `poller.js` | 3 | unused | 1h |
| `chat-handler.js` | 2 | unused | 1h |
| `adapter.js` | 2 | unused | 1h |
| `idle.js` | 2 | unused | 1h |
| `brainControl.js` | 2 | unused | 1h |
| `brainTrain.js` | 2 | unused | 1h |
| `chat.js` | 2 | unused | 1h |

**Action if Path 1**: Update imports in nucleus runtime, point exports to TS build output
**Action if Path 2**: Archive TS, continue with JS runtime

---

### packages/brain (4 files)

**Strategy recommendation**: **Path 1 (Migrate to TypeScript)**
*Reason*: Shared package; TS improves safety & reusability across dependent packages.

| File | JS Importers | TS Status | Effort |
|------|--------------|-----------|--------|
| `network.js` | 5 | unused | 1.5h |
| `controller.js` | 2 | unused | 1h |
| `population.js` | 2 | unused | 1h |
| `reviewStore.js` | 2 | unused | 1h |

**Action if Path 1**: Use TS versions as truth source
**Action if Path 2**: Archive TS, keep JS

---

### packages/engine (14 files)

**Strategy recommendation**: **Path 1 (Migrate to TypeScript)**
*Reason*: Core package; most JS imports are internal (low refactor cost). TS is cleaner.

| File | JS Importers | Note |
|------|--------------|------|
| `LexiconEntry.schema.js` | 3 | Schema file |
| `envelopeFactory.js` | 2 | Factory helper |
| `exhaustive.js` | 2 | Utility |
| `require-schema.js` | 2 | Utility |
| `prediction.js` | 2 | Utility |
| `json.js` | 2 | Utility |
| `busEnvelope.js` | 2 | Utility |
| `promptOperatorRegistry.js` | 2 | Registry |
| 6× `index.js` | 2 each | Entrypoints |

**Action if Path 1**: Migrate index files to TS, delete JS versions
**Action if Path 2**: Archive TS, keep JS

---

### packages/protocol (3 files)

**Strategy recommendation**: **Path 1 (Migrate to TypeScript)**
*Reason*: Protocol is foundational; TS enforces contract stability.

| File | JS Importers | TS Status |
|------|--------------|-----------|
| `schema.js` | 4 | unused |
| `buildEvidenceBus.js` | 2 | unused |
| `guards.js` | 2 | unused |

**Action if Path 1**: Use TS versions as schema source of truth
**Action if Path 2**: Archive TS, keep JS

---

## Part B: Mixed Pairs (8 files) — Entrypoint Issues

**These are edge cases**: `package.json` points to `index.js`, but both `.ts` and `.js` twins exist in `src/`.

**Fix**: Ensure all `package.json` exports point to `dist/` build output, not `src/` twins.

### **ROOT CAUSE**: When the package.json says:

❌ **Bad**:
```json
{
  "main": "./src/index.js",
  "exports": "./src/index.js"
}
```

✅ **Good**:
```json
{
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  }
}
```

### Packages to audit:

1. **apps/env-sandbox/src/index.js|.ts**
   - Fix: Point package.json to `dist/index.js`
   - Then: Archive whichever `src/index.*` is unused

2. **packages/brain/src/index.js|.ts**
   - Fix: Verify points to `dist/`
   - Then: Likely safe to archive one twin

3. **packages/engine/src/index.js|.ts**
   - Fix: Verify points to `dist/`
   - Multiple index files — validate each one

4. **packages/flowstate/src/index.js|.ts**
   - Fix: Verify points to `dist/`

5. **packages/math/src/index.js|.ts**
   - Fix: Verify points to `dist/`

6. **packages/protocol/src/envelopes/uee/index.js|.ts**
   - Fix: Ensure parent points to `dist/envelopes/uee/`

7. **packages/tooling/src/index.js|.ts**
   - Fix: Verify points to `dist/`

8. **packages/util/src/index.js|.ts**
   - Fix: Verify points to `dist/`

---

## Decision Framework

### Choose Path 1 (Migrate to TS) If:
- ✅ TS version is already complete (you reviewed it)
- ✅ Imports can be updated easily in one package
- ✅ Aligns with "TS-as-source" goal
- ✅ Shared package used by many other packages
- ✅ Effort < 2 hours

### Choose Path 2 (Keep JS, Archive TS) If:
- ⚠️ TS version is incomplete / untested
- ⚠️ JS is thoroughly tested in production
- ⚠️ Large refactor needed (>2 hours)
- ⚠️ No time for migration now
- ⚠️ Plan TS migration as separate effort

---

## Implementation Checklist

### Per-Package (Parallelizable)

For each of 36 JS-winner packages:

- [ ] Review TS version (if Path 1 chosen)
- [ ] Update imports from `*.js` → use TS build output
- [ ] Update `package.json` exports to point to `dist/`
- [ ] Run `pnpm -C <pkg> run build`
- [ ] Run `pnpm -C <pkg> run test`
- [ ] Delete `.js` twin or delete `.ts` twin
- [ ] Verify dependent packages still import correctly

### For All Mixed Pairs

- [ ] Audit each package.json (8 total)
- [ ] Verify exports point to `dist/`, not `src/`
- [ ] Run build on each to confirm
- [ ] Archive whichever twin `src/` export doesn't use

### Final

- [ ] Run full build: `pnpm run build`
- [ ] Run full test: `pnpm run test`
- [ ] Add guardrail script to CI: `node tools/twins/check-src-purity.cjs`
- [ ] Commit all changes

---

## Estimated Effort

| Phase | Task | Effort | Parallelizable |
|-------|------|--------|---|
| A (DONE) | Archive 52 safe twins | 0.5h | ✅ |
| B | JS-winner decisions (36 packages) | ~12-15h | ✅ Yes (parallel) |
| C | Fix entrypoints (8 packages) | ~2h | ✅ Yes (parallel) |
| D | Guardrail integration | ~1h | ❌ No |
| **TOTAL** | **All phases** | **~15-18h** | Mostly ✅ |

---

## Quick Start (Next 30 min)

1. **Pick one easy JS-winner package** (e.g., `packages/math`, `packages/util`)
2. **Decide Path 1 or Path 2** for it
3. **If Path 1**: Copy logic to .ts file, delete .js, test
4. **If Path 2**: Archive .ts file, keep .js
5. **Verify build + test pass**
6. **Repeat for remaining 35 packages** (can batch by team)

---

## Commands You'll Need

### Build one package
```bash
pnpm -C packages/engine run build
```

### Test one package
```bash
pnpm -C packages/engine run test
```

### View current package.json exports
```bash
cat packages/engine/package.json | grep -A10 '"exports"'
```

### Archive a TS twin (if Path 2)
```bash
mv packages/engine/src/index.ts history/2026-02-25/twins/packages/engine/src/
```

### Check for remaining .js in src
```bash
node tools/twins/check-src-purity.cjs
```

---

## Next Steps

**Choose one**:

1. **I'll handle JS-winner migration**: Pick 5-10 packages, provide strategy docs
2. **I'll handle entrypoint audits**: Scan all 8 package.json files, generate fixes
3. **I'll automate with a script**: Create script to apply Path 1 or Path 2 uniformly
4. **Mixed effort**: Choose combination above

**Just let me know which path works best for your team!**

---

**Status**: 🟡 **AWAITING DECISION — All data ready, decisions needed**

Track progress in this file as you work through each package.
