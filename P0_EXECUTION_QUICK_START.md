# 🚀 P0 Patches: Quick Execution Guide (2-3 Hours)

**Status**: Ready to implement
**Build baseline**: ✅ Clean
**Estimated time**: 2–3 hours
**Commit message**: `feat: add P0 production hardening (turnId+seq, backpressure, schema unity, tool allowlist)`

---

## Step 1: Create New Files (15 min)

### 1a. `packages/protocol/src/chatStream.ts` (NEW)

Copy entire content from [`PRODUCTION_HARDENING_P0_PATCHES.md`](#file-1-packagesprotocolsrcchatstreamts-new) **File 1** section.

```bash
# Create file
touch apps/nucleus/src/ndjson.ts packages/protocol/src/chatStream.ts
```

### 1b. `apps/nucleus/src/ndjson.ts` (NEW)

Copy entire content from **File 3** section.

### 1c. Test File

Create `apps/nucleus/test/chat-stream-p0.test.ts` from **File 7** section.

---

## Step 2: Update Existing Files (90 min)

### 2a. `packages/protocol/src/index.ts` (ADD EXPORT)

**Find**: Wherever existing chat exports are (near top)

**Add** (one line):
```typescript
export {
  StreamEvent,
  StreamEventType,
  StreamEventBase,
  TextChunkEvent,
  ToolCallEvent,
  ToolResultEvent,
  CitationEvent,
  MemoryWriteEvent,
  DoneEvent,
  ErrorEvent,
  validateStreamEvent,
  serializeStreamEvent,
} from "./chatStream.js";
```

### 2b. `apps/nucleus/src/chat-handler.ts` (REPLACE METHOD)

**Find**: `private async streamChatFromBrain(` method

**Delete**: Entire method body (keep the signature)

**Paste**: Full replacement from **File 4** section

**Verify**: No TS errors with `pnpm run typecheck`

### 2c. `apps/py-sidecar/brain.py` (EDIT 2 PLACES)

**Edit 1 — Replace class**:
- **Find**: `class StreamEvent(BaseModel):`
- **Replace with**: Code from **File 5**, class definition section

**Edit 2 — Replace function**:
- **Find**: `async def chat_stream(req: ChatRequest):`
- **Replace async generator with**: Full code from **File 5**, function section

**Edit 3 — Add imports**:
- **Find**: Top imports section (`from pydantic import ...`)
- **Add**:
  ```python
  import time
  from uuid import uuid4
  ```

### 2d. `apps/nucleus/src/tool/executor.ts` (ADD METHOD)

**Find**: Start of ToolExecutor class

**Add** (before existing methods):
```typescript
  private readonly TOOL_ALLOWLIST = new Set([
    "record_screen",
    "query_lexicon",
    "update_memory",
    "query_memory",
    "fetch_url",
    "analyze_code",
    // Add real tools as they're implemented
  ]);

  private readonly MAX_TOOL_ARG_SIZE = 256 * 1024; // 256KB

  private validateToolCall(name: string, args: Record<string, any>): { ok: boolean; error?: string } {
    // P0.5.1: Allowlist check
    if (!this.TOOL_ALLOWLIST.has(name)) {
      return { ok: false, error: `Tool not in allowlist: ${name}` };
    }

    // P0.5.2: Argument size clamp
    const argSize = JSON.stringify(args).length;
    if (argSize > this.MAX_TOOL_ARG_SIZE) {
      return { ok: false, error: `Tool args exceed ${this.MAX_TOOL_ARG_SIZE} bytes` };
    }

    // P0.5.3: Timeout clamp
    const timeout = (args.timeoutMs ?? 15_000) as number;
    if (timeout > 60_000) {
      return { ok: false, error: `Timeout must be ≤ 60s` };
    }

    return { ok: true };
  }
```

**Then find**: `executeToolCall` method

**Replace start**:
```typescript
async executeToolCall(call: { name: string; args: Record<string, any> }): Promise<{ ok: boolean; result?: any; error?: string }> {
  // Add validation before execution
  const validation = this.validateToolCall(call.name, call.args);
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }

  // ... rest of existing logic
}
```

---

## Step 3: Verify Compilation (15 min)

```bash
cd 'c:\Users\colte\colten projects\coltens world'

# Type check all packages
pnpm run typecheck

# Build protocol (exports new types)
pnpm --filter '@world-engine/protocol' run build

# Build nucleus (uses new types)
pnpm --filter './apps/nucleus' run build

# Expected output: ✅ No errors
```

**If errors**:
- "Cannot find module" → Check imports match file paths
- "Type mismatch" → Verify copied code indentation
- "Unexpected token" → Check JSON/string escaping

---

## Step 4: Run Unit Tests (15 min)

```bash
# Test NDJSON + schema validation
pnpm --filter './apps/nucleus' run test -- chat-stream-p0

# Expected:
# ✅ PASS: Ordering + NDJSON (2 tests)
# ✅ PASS: Tool allowlist (2 tests)
# ✅ PASS: Abort on disconnect (1 test)
```

**If test fails**:
- "validateStreamEvent is not exported" → Check `packages/protocol/src/index.ts` export
- "ndjsonLines not found" → Check file is in `apps/nucleus/src/ndjson.ts`

---

## Step 5: Manual E2E Test (30 min)

### 5a. Start all services

**Terminal 1** — Brain:
```bash
cd 'c:\Users\colte\colten projects\coltens world\apps\py-sidecar'
python -m uvicorn brain:app --reload --port 8011
```

**Terminal 2** — Nucleus:
```bash
cd 'c:\Users\colte\colten projects\coltens world\apps\nucleus'
pnpm dev
```

**Terminal 3** — IDE-Web:
```bash
cd 'c:\Users\colte\colten projects\coltens world\apps\ide-web'
pnpm dev -- --port 5173
```

### 5b. Run test cases (from `PRODUCTION_HARDENING_P0_PATCHES.md` → File 8)

**T1: Normal chat (turnId + seq)**
1. Open http://localhost:5173
2. Send any chat message
3. Open browser DevTools → Network
4. Filter for `chat.stream_event`
5. Inspect first event payload
6. **Verify**: Has `turnId`, `seq=0`

**T2: Disconnect handling**
1. Send chat message (should stream)
2. Close browser tab immediately
3. Check Nucleus logs
4. **Verify**: Logs show "ws_closed" or "client closed"

**T3: Schema validation**
(Manual test — requires modifying Brain to emit bad JSON)

**T4: Tool callId matching**
1. Ask Brain to use a tool
2. Inspect `tool_call` event
3. Verify `callId` field exists
4. **Verify**: Is a stable string

### 5c. Checklist

- [ ] T1: turnId + seq visible in network inspector
- [ ] T2: Nucleus logs show proper disconnect handling
- [ ] T3: (Skip for now, requires manual injection)
- [ ] T4: tool_call has callId
- [ ] No ERROR logs in any terminal
- [ ] No memory growth over 3 min test

---

## Step 6: Commit & Done (15 min)

```bash
cd 'c:\Users\colte\colten projects\coltens world'

# Add all changed files
git add \
  packages/protocol/src/chatStream.ts \
  packages/protocol/src/index.ts \
  apps/nucleus/src/chat-handler.ts \
  apps/nucleus/src/ndjson.ts \
  apps/nucleus/src/tool/executor.ts \
  apps/nucleus/test/chat-stream-p0.test.ts \
  apps/py-sidecar/brain.py

# Commit
git commit -m "feat: add P0 production hardening

- Add turnId + seq to every stream event (ordering)
- Implement AbortController + backpressure (disconnect + memory)
- Define unified StreamEvent schema (Brain ↔ Nucleus)
- Add tool allowlist + arg validation (security)
- Add robust NDJSON line decoder (chunk handling)

Closes production gaps P0.1-P0.5.
See PRODUCTION_HARDENING_P0_PATCHES.md for full spec."

# Verify
git log --oneline -1
git diff --stat HEAD~1
```

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `Cannot find name 'ndjsonLines'` | Check `apps/nucleus/src/ndjson.ts` exists + is exported |
| `validateStreamEvent not exported` | Add to `packages/protocol/src/index.ts` |
| `brain.py: invalid syntax` | Check indentation (Python is whitespace-sensitive) |
| `TS2345: Type 'X' is missing properties` | Copy-paste entire method (don't truncate) |
| Manual test hangs on stream | Check Brain is running: `curl http://localhost:8011/health` |
| WS connect fails in IDE | Check Nucleus is running: `curl http://localhost:3000/health` |

---

## Time Breakdown

| Step | Time | Status |
|------|------|--------|
| Create new files | 15 min | ✅ Copy-paste from doc |
| Update existing files | 90 min | ✅ 5 edits, mostly replacements |
| Type check + build | 15 min | ✅ Should be GREEN |
| Unit tests | 15 min | ✅ Should PASS |
| Manual E2E | 30 min | ✅ Live verification |
| Commit | 15 min | ✅ Done |
| **TOTAL** | **180 min** | **2–3 hours** |

---

## What You've Built

✅ **Deterministic ordering** — Every event has monotonic `seq + turnId`
✅ **Graceful disconnection** — Client close aborts Brain immediately
✅ **Backpressure** — Prevents WebSocket buffer overflow
✅ **Schema enforcement** — Brain + Nucleus always agree on event shape
✅ **Tool safety** — Allowlist + arg size limits + timeout clamping

**Result**: Production-grade streaming that handles:
- Network delays + chunk misalignment
- Client disconnects mid-stream
- High-volume concurrent users
- Malicious/accidental tool invocation
- Schema evolution (backward compatible)

---

## Next (After P0 ✅)

Once P0 is merged, you're ready for **P1 features**:

1. **Tool result feedback loop** — IDE executes tool, sends result back
2. **History trimming** — Context budget manager
3. **Observability** — Prometheus + structured logs

See `PRODUCTION_HARDENING_P0_PATCHES.md` → FAQ section for more.

---

**You've got this!** 🚀

Questions? Re-read **File 1–7** in the main patch doc.
All code is copy-paste ready.
