# Quick Reference: File-by-File Integration

## Curriculum Integration Checklist (15 minutes)

### Step 1: Create Python Tools (5 min)
```
File: unified_nexus/curriculum/tools_curriculum.py
Status: ✅ CREATED
Lines: 180
Copy: Full file from [ADAPTATION_COMPLETE.md]
Action: Place in your repo as-is
```

### Step 2: Create TypeScript Handler (5 min)
```
File: unified_nexus/curriculum/wheel_handler.ts
Status: ✅ CREATED
Lines: 120
Copy: Full file from [ADAPTATION_COMPLETE.md]
Action: Place in your repo as-is
Compile: typescript should pass
```

### Step 3: Create Initial State (1 min)
```
File: runtime/curriculum/wheel.state.v1.json
Status: ✅ CREATED
Lines: 20
Copy: Full file from [ADAPTATION_COMPLETE.md]
Action: Place in your repo, checked into git
```

### Step 4: Wire in Brain (3 min)
```
File: apps/py-sidecar/nucleus.py (or similar)
Status: ✅ TEMPLATE PROVIDED
Lines to add: ~20
Template: In [DETERMINISM_BULLETPROOF.md] "File 1"
Action:
  1. Import: from unified_nexus.curriculum.wheel_runtime import WheelRuntime
  2. Add: async def init_curriculum_wheel()
  3. Add: asyncio.create_task(curriculum_wheel_tick_loop())
```

### Step 5: Wire in Nucleus (1 min)
```
File: apps/nucleus/src/index.ts (or entry point)
Status: ✅ TEMPLATE PROVIDED
Lines to add: ~5
Template: In [ADAPTATION_COMPLETE.md] "Quick Start"
Action:
  1. Import: import { setupWheelHandler } from './curriculum/wheel_handler'
  2. Call: setupWheelHandler({ eventBus, toolExecutor })
```

### Done!
```
✅ Curriculum running
✅ Events flowing Brain → Nucleus → Brain
✅ State persisting after each call
```

---

## P0 Hardening Checklist (4 hours)

### Files to Create (All from PRODUCTION_HARDENING_P0_PATCHES.md)

**File 1:**
```
Path: coltens world/packages/protocol/src/chatStream.ts
Lines: ~150
Content: Zod schema for StreamEvent (turnId, seq, timestamp)
Action: Copy from guide, paste as-is
```

**File 2:**
```
Path: coltens world/apps/nucleus/src/ndjson.ts
Lines: ~100
Content: NDJSON line decoder + chunk boundary handling
Action: Copy from guide, paste as-is
```

**File 3:**
```
Path: coltens world/apps/nucleus/test/chat-stream-p0.test.ts
Lines: ~200
Content: Full pytest suite for P0 guarantees
Action: Copy from guide, paste as-is
Build: pnpm run test
```

### Files to Edit (Partial edits provided in guide)

**Edit 1:**
```
Path: coltens world/apps/nucleus/src/chat-handler.ts
Change: Replace streamChatFromBrain() function (80 lines)
Source: Full replacement in [PRODUCTION_HARDENING_P0_PATCHES.md] File 3
Details: Adds turnId + seq + backpressure + abort handling
```

**Edit 2:**
```
Path: coltens world/apps/nucleus/src/tool/executor.ts
Change: Add executeWithAllowlist() wrapper method
Source: Template in [PRODUCTION_HARDENING_P0_PATCHES.md] File 5
Details: Validates tool_name against allowlist before execution
```

**Edit 3:**
```
Path: coltens world/apps/py-sidecar/brain.py
Change: Add turnId + seq + timestamp injection in stream loop
Source: Template in [PRODUCTION_HARDENING_P0_PATCHES.md] File 6
Details: Ensures deterministic ordering at source
```

**Edit 4:**
```
Path: coltens world/packages/protocol/src/index.ts
Change: Export StreamEvent + stream helper types
Source: 1-liner: export * from './chatStream'
Details: Make types available to apps
```

### Build & Test
```
Build: pnpm run build
Test: pnpm run test chat-stream-p0.test
Expected: All 5 tests pass (ordering, backpressure, abort, schema, allowlist)
```

---

## What to Read Before Starting

### If doing **Curriculum**:
1. ✅ [ADAPTATION_COMPLETE.md](Deliverables)
2. ✅ [DETERMINISM_BULLETPROOF.md](Hardening Guide)
3. ✅ [This file](#Quick Reference)

### If doing **P0**:
1. ✅ [P0_EXECUTION_QUICK_START.md](Implementation Guide)
2. ✅ [PRODUCTION_HARDENING_P0_PATCHES.md](Full Spec)
3. ✅ [This file](#Quick Reference)

### If doing **Both**:
1. ✅ [PRODUCTION_ROADMAP.md](Decision Tool)
2. ✅ Choose path (P0 first or curriculum first)
3. ✅ Follow that path's documents

---

## Copy-Paste Command Sequences

### Curriculum (Python + TypeScript)

**Step 1: Place Python file**
```bash
# Copy tools_curriculum.py to repo
cp tools_curriculum.py unified_nexus/curriculum/

# Verify imports
python -c "from unified_nexus.curriculum.tools_curriculum import curriculum_stop_execute; print('OK')"
```

**Step 2: Place TypeScript file**
```bash
# Copy wheel_handler.ts to repo
cp wheel_handler.ts unified_nexus/curriculum/

# Verify TypeScript
npx tsc unified_nexus/curriculum/wheel_handler.ts --noEmit
```

**Step 3: Create state file**
```bash
mkdir -p runtime/curriculum
cp wheel.state.v1.json runtime/curriculum/
```

**Step 4: Test determinism**
```bash
pytest unified_nexus/curriculum/test_wheel_determinism.py -v
# Expected: 3 passed
```

---

### P0 (TypeScript + Python updates)

**Step 1: Create new files**
```bash
# chatStream.ts
cp chatStream.ts packages/protocol/src/

# ndjson.ts
cp ndjson.ts apps/nucleus/src/

# Tests
cp chat-stream-p0.test.ts apps/nucleus/test/
```

**Step 2: Edit existing files** (use provided diffs)
```bash
# chat-handler.ts - replace streamChatFromBrain() function
# executor.ts - add executeWithAllowlist() wrapper
# brain.py - inject turnId + seq in stream loop
# protocol/index.ts - export StreamEvent type
```

**Step 3: Build & test**
```bash
pnpm run build
pnpm run test chat-stream-p0
# Expected: 5/5 tests pass
```

---

## Size Reference (What to expect)

### Curriculum Files
```
tools_curriculum.py ........... 180 lines
wheel_handler.ts ............ 120 lines
wheel.state.v1.json ......... 20 lines
                          ─────────────
Total new code ............... 320 lines
Integration time ............ 15 minutes
```

### P0 Hardening Files
```
chatStream.ts ............... 150 lines (new)
ndjson.ts ................... 100 lines (new)
chat-handler.ts ............. 80 lines (edit)
executor.ts ................. 50 lines (edit)
brain.py .................... 30 lines (edit)
test file ................... 200 lines (new)
                          ─────────────
Total affected .............. 610 lines
Implementation time ......... 4 hours
Test time ................... 1 hour
```

---

## Error Recovery

### If curriculum tools don't import:
```bash
# Check path
ls -la unified_nexus/curriculum/tools_curriculum.py

# Check Python path
python -c "import sys; print('\n'.join(sys.path))"

# Test import
python -c "from unified_nexus.curriculum.tools_curriculum import curriculum_stop_execute"
```

### If wheel_handler.ts doesn't compile:
```bash
# Check for syntax
npx tsc unified_nexus/curriculum/wheel_handler.ts --noEmit

# Check imports
grep "import.*V1EventEnvelope" unified_nexus/curriculum/wheel_handler.ts
# Should find import line
```

### If state file missing:
```bash
# Create directory
mkdir -p runtime/curriculum

# Copy from template
cp wheel.state.v1.json runtime/curriculum/

# Verify
cat runtime/curriculum/wheel.state.v1.json | python -m json.tool
# Should output valid JSON
```

### If P0 tests fail:
```bash
# Check build first
pnpm run build

# Run single test
pnpm run test chat-stream-p0.test.ts -- --testNamePattern="ordering"

# Check that all new files exist
ls apps/nucleus/src/ndjson.ts
ls packages/protocol/src/chatStream.ts
```

---

## Verification Commands

### Curriculum Ready?
```bash
✅ python -c "from unified_nexus.curriculum.tools_curriculum import curriculum_stop_execute; print('tools OK')"
✅ npx tsc unified_nexus/curriculum/wheel_handler.ts --noEmit && echo "handler OK"
✅ cat runtime/curriculum/wheel.state.v1.json | python -m json.tool > /dev/null && echo "state OK"
✅ grep -q "load_plan" unified_nexus/curriculum/wheel_runtime.py && echo "runtime OK"
```

All should print OK if ready.

### P0 Ready?
```bash
✅ ls packages/protocol/src/chatStream.ts && echo "chatStream OK"
✅ ls apps/nucleus/src/ndjson.ts && echo "ndjson OK"
✅ ls apps/nucleus/test/chat-stream-p0.test.ts && echo "tests OK"
✅ grep -q "turnId" apps/nucleus/src/chat-handler.ts && echo "turnId injected"
✅ grep -q "executeWithAllowlist" apps/nucleus/src/tool/executor.ts && echo "allowlist OK"
```

All should print OK if ready.

---

## Success Indicators

### Curriculum (you should see)
```
✅ First nucleus.tool_call event emitted
✅ Agent receives tool call via EventBus
✅ curriculum_stop_execute returns deterministic output
✅ nucleus.tool_result command processed
✅ wheel state advances (stop_index incremented)
✅ seq value monotonically increases
✅ Second call has same call_id if same seed
```

### P0 (you should see)
```
✅ Chat messages have turnId field
✅ turnId increments monotonically
✅ seq field present + increments
✅ ws.bufferedAmount < 1MB under load
✅ Client disconnect closes Brain connection within 5s
✅ Schema validates: Zod passes on Nucleus, Pydantic on Brain
✅ Tool allowlist enforced (tool_name in ALLOWED_TOOLS)
```

---

## Estimated Timelines

### Curriculum Only Path
```
5 min:  Place 3 files (tools_curriculum.py, wheel_handler.ts, wheel.state.v1.json)
5 min:  Wire Brain init + tick loop
5 min:  Wire Nucleus handler
5 min:  Register tools with agent
20 min: Run test + verify determinism
5 min:  Observe first 10 rotations running
─────────────────────────
45 min: Total (including all testing)

With contingency: 2 hours
```

### P0 Only Path
```
30 min: Read P0_EXECUTION_QUICK_START.md
180 min: Implement 8 files + edits (4 hours)
60 min: Test + troubleshoot
60 min: Deploy + monitor
─────────────────────────
330 min: Total (5.5 hours)

With contingency: 6-7 hours
```

### Both Paths (Parallel)
```
Day 1: Implement curriculum (1h) + P0 (4h) = 5h net
Day 2: Test both + verify integration (2h)
─────────────────────────
Total: 7 hours real time (1-2 days wall clock)
```

---

## Final Checklist Before Going Live

Curriculum:
- [ ] Three Python/TypeScript files placed
- [ ] Initial state JSON created
- [ ] Brain init + tick loop wired
- [ ] Nucleus handler registered
- [ ] Tools registered with agent
- [ ] Determinism test passes
- [ ] First 10 rotations complete successfully

P0:
- [ ] All 8 files created/edited
- [ ] Build passes (pnpm run build)
- [ ] Tests all pass (5/5)
- [ ] Manual E2E: chat → Nucleus → Brain → back successfully
- [ ] Backpressure verified (ws.bufferedAmount < 1MB)
- [ ] Disconnect propagates within 5 seconds

Both together:
- [ ] Run chat while curriculum ticking (separate event channels)
- [ ] Verify no message interference
- [ ] Seq counters independent + monotonic
- [ ] No shared resource contention

✅ **All green?** You're ready to merge + deploy.

---

## Document Index

| What You Need | Document | Read Time |
|---------------|----------|-----------|
| Just implement curriculum NOW | [ADAPTATION_COMPLETE.md](Quick Start section) | 5 min |
| Understand all hardening | [DETERMINISM_BULLETPROOF.md](Guarantees section) | 10 min |
| Implement P0 gaps | [P0_EXECUTION_QUICK_START.md](Steps 1-6) | 30 min |
| Strategic decision | [PRODUCTION_ROADMAP.md](Implementation Paths) | 5 min |
| Full reference | [INTEGRATION_GUIDE.md](all sections) | 30 min |
| This checklist | [This file](#Quick%20Reference) | 5 min |

---

**Status**: 🟢 **Ready for immediate implementation**

Choose your path above, follow the checklist, launch. All code + tests provided.
