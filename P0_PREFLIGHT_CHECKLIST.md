# ✅ P0 Pre-Flight Checklist

Use this **before** you start implementing. It takes 5 min and catches 90% of integration issues.

---

## Code Structure Check (5 min)

### ✅ Do you have these files?

- [ ] `apps/nucleus/src/chat-handler.ts` (exists)
- [ ] `apps/nucleus/src/wsHub.ts` (exists)
- [ ] `apps/py-sidecar/brain.py` (exists)
- [ ] `packages/protocol/src/chat.ts` (schema already exists)

**Command to verify**:
```bash
cd 'c:\Users\colte\colten projects\coltens world'
ls apps/nucleus/src/chat-handler.ts && echo '✅ chat-handler exists'
ls apps/py-sidecar/brain.py && echo '✅ brain.py exists'
```

---

## Current Implementation Check (10 min)

### ✅ Does `chat-handler.ts` have `streamChatFromBrain` method?

**Run this**:
```bash
grep -n "streamChatFromBrain" apps/nucleus/src/chat-handler.ts
```

**Expected**: Should find the method definition (e.g., line 58)

### ✅ Does `brain.py` have `@app.post("/chat/stream")`?

**Run this**:
```bash
grep -n "chat/stream" apps/py-sidecar/brain.py
```

**Expected**: Should find the endpoint (e.g., line 160)

### ✅ Does `brain.py` have a `StreamEvent` class?

**Run this**:
```bash
grep -n "class StreamEvent" apps/py-sidecar/brain.py
```

**Expected**: Should find the class (e.g., line 70)

---

## Build Baseline (5 min)

### ✅ Does everything build NOW (before changes)?

```bash
cd 'c:\Users\colte\colten projects\coltens world'

# Type check
pnpm run typecheck
# Expected: ✅ No errors (or existing errors only)

# Build nucleus
pnpm --filter './apps/nucleus' run build
# Expected: ✅ Success (or existing errors only)

# Build protocol
pnpm --filter '@world-engine/protocol' run build
# Expected: ✅ Success
```

**If any build fails**:
- [ ] Run `pnpm install` to refresh node_modules
- [ ] Run `pnpm run typecheck` to see exact errors
- [ ] Fix existing issues *before* implementing P0 patches

---

## File Inspection (10 min)

### ✅ Inspect `chat-handler.ts` structure

```bash
grep -n "async\|private\|class" apps/nucleus/src/chat-handler.ts | head -20
```

**Expected output** (something like):
```
1: /**
7: import {
...
24: export class ChatHandler {
28:   private pendingToolResults = new Map<...>
32:   async handleChatRequest(
58:   private async streamChatFromBrain(
```

**What we look for**:
- [ ] Has `export class ChatHandler`
- [ ] Has `async handleChatRequest` method
- [ ] Has `private async streamChatFromBrain` method

### ✅ Inspect `brain.py` structure

```bash
grep -n "^class\|^async def\|^@app" apps/py-sidecar/brain.py | head -30
```

**Expected output** (something like):
```
70: class StreamEvent(BaseModel):
...
160: @app.post("/chat/stream", response_class=StreamingResponse)
161: async def chat_stream(req: ChatRequest):
```

**What we look for**:
- [ ] Has `class StreamEvent`
- [ ] Has `@app.post("/chat/stream")`
- [ ] Has `async def chat_stream`

---

## Import Check (5 min)

### ✅ Can we import the existing chat protocol?

```bash
cd 'c:\Users\colte\colten projects\coltens world'

node -e "const p = require('./packages/protocol/dist/chat.js'); console.log('✅ Protocol exports:', Object.keys(p).slice(0, 5))"
```

**Expected**: Should list some exports like `ChatRequest`, `ChatResponse`, etc.

**If not**:
```bash
# Rebuild protocol first
pnpm --filter '@world-engine/protocol' run build
```

---

## Network Check (5 min)

### ✅ Can you curl from Nucleus to Brain?

First, **start Brain**:
```bash
cd 'c:\Users\colte\colten projects\coltens world\apps\py-sidecar'
python -m uvicorn brain:app --reload --port 8011 &
sleep 2
```

Then **test connection**:
```bash
curl -X GET http://localhost:8011/ 2>&1 | head -5
# Expected: Some HTML or JSON response (Brain is up)
```

### ✅ Can Nucleus be started?

**Start Nucleus**:
```bash
cd 'c:\Users\colte\colten projects\coltens world\apps\nucleus'
timeout 5 pnpm dev
# Expected: Should start (may timeout after 5s, that's OK)
```

---

## Summary: Are You Ready?

| Check | Status | Required? |
|-------|--------|-----------|
| Files exist | ✅ | YES |
| Build baseline clean | ✅ | YES |
| Can import protocol | ✅ | YES |
| Brain can start | ✅ | Nice to have |
| Nucleus can start | ✅ | Nice to have |

---

## If Any Check Fails

**Stop here.** Fix the issue:

1. **Build fails** → `pnpm install && pnpm run typecheck`
2. **Files missing** → Check paths (case-sensitive on Linux)
3. **Brain won't start** → Check Python version: `python --version` (need 3.9+)
4. **Nucleus won't start** → Check Node version: `node --version` (need 18+)

**Once all checks pass**, you're ready to → **[P0_EXECUTION_QUICK_START.md](P0_EXECUTION_QUICK_START.md)**

---

## Command Reference (Copy-Paste Ready)

```bash
# All checks in one command
set WORKDIR=c:\Users\colte\colten projects\coltens world
cd %WORKDIR%

echo "=== File Check ==="
if exist "apps\nucleus\src\chat-handler.ts" echo ✅ chat-handler.ts exists
if exist "apps\py-sidecar\brain.py" echo ✅ brain.py exists

echo "=== Build Check ==="
call pnpm run typecheck
call pnpm --filter @world-engine/protocol run build
call pnpm --filter ./apps/nucleus run build

echo "=== Summary ==="
echo If all above passed, you are ready for P0_EXECUTION_QUICK_START.md
```

---

**Once this checklist passes** → Open **[P0_EXECUTION_QUICK_START.md](P0_EXECUTION_QUICK_START.md)** and run Step 1.

✅ You're 5 min away from knowing if you're ready!
