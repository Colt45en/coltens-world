# ✅ Brain Chat System Integration Checklist (Corrected for Real Topology)

> **This checklist is corrected against your actual codebase:**
>
> - Single WS endpoint: `ws://localhost:3000` (not `/ws/chat`)
> - Chat routing: **already implemented** in `ChatHandler.handleChatRequest()`
> - Brain endpoint: `/chat/stream` (NDJSON) verified in `apps/py-sidecar/brain.py`
> - Security model: session + token + nonce + cap gating (inherited from wsHub)
> - Message pattern: uses `createEnvelope()` + `MessageMap`

---

## ⚠️ Reality Check (Critical Fixes to Doc)

| Claim                              | Reality                                                                         | Status              |
| ---------------------------------- | ------------------------------------------------------------------------------- | ------------------- |
| `/ws/chat` endpoint exists         | No. All clients use `ws://localhost:3000`                                       | ❌ REMOVE           |
| Nucleus fetches Brain inside wsHub | No. `ChatHandler` already does this properly                                    | ❌ REMOVE           |
| Need to add chat routing to wsHub  | No. Already wired: `chat.request` → `chatHandler.handleChatRequest()`           | ✅ KEEP             |
| Brain implements `/chat`           | Brain implements **both** `/chat` (full) and `/chat/stream` (NDJSON)            | ✅ VERIFY           |
| `python brain.py` is the entry     | Yes, but also `app/main.py` (modular). Routes must be included in `app/main.py` | ⚠️ NEED ROUTES_CHAT |

---

## Phase 1 — Protocol & Services ✅

### 1) Protocol compiles

```bash
cd packages/protocol
pnpm build
```

✅ Must pass (no TS errors in chat types).

### 2) Verify chat types in MessageMap

Don't use `npm ls | grep chat` (unreliable).

Instead, verify TypeScript can resolve:

```bash
cd packages/protocol
pnpm -s tsx -e "import { EnvelopeSchema } from './src/index'; console.log('✅ EnvelopeSchema ok')"
```

✅ If clean, your protocol types are good.

### 3) Brain service runs

Your codebase has **two entry points**:

**Option A: Standalone brain.py (legacy)**

```bash
cd apps/py-sidecar
python brain.py
```

**Option B: Modular app/main.py (current)**

```bash
cd apps/py-sidecar
python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

✅ Use **Option B** going forward (modular routes).

### 4) Verify `/health` endpoint

```bash
curl http://localhost:8001/health
```

✅ Should return `{"ok": true, "service": "py-sidecar"}` (from app/main.py) or similar.

### 5) **CRITICAL: Verify `/chat/stream` endpoint exists**

This is the real blocker. Your `ChatHandler` calls:

```
POST http://localhost:8001/chat/stream
```

**Test it:**

```bash
curl -N -X POST http://localhost:8001/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "traceId": "test_1",
    "convoId": "c1",
    "userId": "u1",
    "persona": "assistant",
    "text": "Hello",
    "recentHistory": []
  }'
```

### Expected response: NDJSON lines

```json
{"type": "text_chunk", "data": {"text": "He", "traceId": "test_1"}}
{"type": "text_chunk", "data": {"text": "ll", "traceId": "test_1"}}
{"type": "text_chunk", "data": {"text": "o", "traceId": "test_1"}}
{"type": "done", "data": {"traceId": "test_1", "stop_reason": "end_turn"}}
```

✅ **If this works**, skip to Phase 2.

❌ **If this fails**, you need to:

- **Option A**: Mount `/chat/stream` from brain.py into app/main.py
- **Option B**: Create `routes_chat.py` and include it in `app/main.py`

---

## 🔥 Critical Fix (If `/chat/stream` missing from app/main.py)

### Current state

`app/main.py` includes:

- `routes_operator`
- `routes_memory`

But **NOT** `/chat/stream` (which is defined in standalone `brain.py`).

### Solution: Create `routes_chat.py`

Extract chat routes from `brain.py` into a FastAPI router:

**File: `apps/py-sidecar/routes_chat.py`**

```python
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import json
import asyncio

router = APIRouter()

class ChatRequest(BaseModel):
    traceId: str
    convoId: str
    userId: str
    persona: str
    text: str
    recentHistory: list = []

class StreamEvent(BaseModel):
    type: str
    data: dict

async def run_reasoning(req: ChatRequest):
    """Stub: returns reasoning response."""
    return "Hello!", [], [], []

@router.post("/chat/stream", response_class=StreamingResponse)
async def chat_stream(req: ChatRequest):
    """Stream chat response as NDJSON."""
    async def generate():
        try:
            text, tool_calls, citations, memory_writes = await run_reasoning(req)

            # Stream text in chunks
            for i in range(0, len(text), 10):
                chunk = text[i:i+10]
                event = StreamEvent(
                    type="text_chunk",
                    data={"text": chunk, "traceId": req.traceId}
                )
                yield json.dumps(event.model_dump()) + "\n"
                await asyncio.sleep(0.01)

            # Done
            event = StreamEvent(
                type="done",
                data={"traceId": req.traceId, "stop_reason": "end_turn"}
            )
            yield json.dumps(event.model_dump()) + "\n"
        except Exception as e:
            event = StreamEvent(
                type="error",
                data={"error": str(e), "traceId": req.traceId}
            )
            yield json.dumps(event.model_dump()) + "\n"

    return StreamingResponse(generate(), media_type="application/x-ndjson")
```

### Update `app/main.py`

Add to imports:

```python
from routes_chat import router as chat_router
```

Add after the other routers:

```python
app.include_router(chat_router)
```

### Verify

```bash
cd apps/py-sidecar
python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

Then test:

```bash
curl -N -X POST http://localhost:8001/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"traceId":"t1","convoId":"c1","userId":"u1","persona":"assistant","text":"Hello","recentHistory":[]}'
```

✅ Should stream NDJSON.

---

## Phase 2 — Nucleus Routing ✅ (Verify, Don't Add)

Your `ChatHandler` is **already implemented correctly**.

### Verify these are in place (no changes needed)

**In `apps/nucleus/src/wsHub.ts`:**

#### ✅ 1) Capability gating

```typescript
case "chat.request":
  return ["cap:chat:send"];
```

#### ✅ 2) IDE gets capability

```typescript
if (role === "ide") {
  return [
    // ...
    "cap:chat:send",
  ];
}
```

#### ✅ 3) Known types allowlist

```typescript
env.type === "chat.request" ||
```

#### ✅ 4) Routing to ChatHandler

```typescript
if (env.type === "chat.request") {
  await chatHandler.handleChatRequest(env, ws);
  return;
}
```

### Build to verify

```bash
cd apps/nucleus
pnpm build
```

✅ If it compiles, wsHub is correct.

---

## Phase 3 — IDE Client Integration ✅ (Correct WS URL)

### ✅ Correct WS URL

| **❌ Wrong**                  | **✅ Correct**        |
| ----------------------------- | --------------------- |
| `ws://localhost:3000/ws/chat` | `ws://localhost:3000` |

Your IDE already has `WsClient` that connects to **`ws://localhost:3000`** (single hub).

Any chat UI must use `WsClient` to send messages:

```typescript
import { wsClient } from "./bus/wsClient";

// Send chat message
wsClient.send("chat.request", {
  traceId: `chat_${Date.now()}`,
  convoId: "default",
  userId: "demo-user",
  persona: "assistant",
  text: userMessage,
  recentHistory: [],
});
```

### Add handlers to IDE

In `apps/ide-web/src/bus/wsClient.ts`, verify these are wired:

```typescript
handlers.onChatDelta?.(env); // if streaming
handlers.onChatDone?.(env); // final message
handlers.onChatError?.(env); // error
```

(These should mirror your existing `onPtyOpened`, `onPreviewStats`, etc.)

---

## Phase 4 — Start Full Stack ✅

### Terminal 1: Nucleus

```bash
cd apps/nucleus
pnpm dev
```

Wait for: `WebSocket server listening on ws://localhost:3000`

### Terminal 2: Brain (with chat routes)

```bash
cd apps/py-sidecar
python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

Wait for: `Uvicorn running on http://0.0.0.0:8001`

### Terminal 3: IDE

```bash
cd apps/ide-web
pnpm dev
```

Wait for: `Local: http://localhost:5173`

---

## Phase 5 — Deterministic End-to-End Test ✅

### 1) Browser opens IDE

```
http://localhost:5173
```

### 2) DevTools Console Test

Open F12 → Console. Paste:

```javascript
// Send chat via WsClient (assumes it's exported from your IDE)
import { wsClient } from "./bus/wsClient";

wsClient.send("chat.request", {
  traceId: "smoke_test_" + Date.now(),
  convoId: "c1",
  userId: "test_user",
  persona: "assistant",
  text: "Say hello!",
  recentHistory: [],
});

// Watch console for responses...
```

### 3) Expected console output

You should see in sequence:

```
[nucleus] chat.request received
[nucleus] → brain.py /chat/stream
[nucleus] ← first text_chunk: "He"
[nucleus] ← text_chunk: "ll"
[nucleus] ← text_chunk: "o"
[nucleus] ← done: stop_reason=end_turn
```

### 4) Verify headers (F12 Network tab)

**WebSocket frame sent:**

```json
{
  "v": 2,
  "type": "chat.request",
  "sessionId": "sess_...",
  "auth": { "kind": "session", "token": "..." },
  "nonce": "n_...",
  "payload": { "traceId": "smoke_test_...", ... }
}
```

✅ If you see auth + nonce, message gating is working.

### 5) Verify Brain got it

Terminal 2 logs should show:

```
POST /chat/stream - [traceId: smoke_test_...]
Streaming response...
```

---

## 🔥 Common Breakpoints (Real Ones)

| Symptom                  | Root Cause                       | Fix                                                                       |
| ------------------------ | -------------------------------- | ------------------------------------------------------------------------- |
| WS connection fails      | Nucleus not running              | `pnpm dev` in apps/nucleus                                                |
| Message silently dropped | Missing sessionId / nonce        | Use `wsClient.send()`, not raw WS                                         |
| 401 / CAP_DENIED         | IDE doesn't have `cap:chat:send` | Check wsHub `grantCapsForRole("ide")`                                     |
| 404 on `/chat/stream`    | Brain doesn't expose it          | Create `routes_chat.py` + mount in `app/main.py`                          |
| 500 on `/chat/stream`    | `run_reasoning()` stub fails     | Replace stub with real LLM call                                           |
| Hangs for 30+ seconds    | Network timeout                  | Check firewall, Nucleus logs for fetch errors                             |
| Ndjson doesn't parse     | Brain returns JSON not lines     | Verify `StreamingResponse(generate(), media_type="application/x-ndjson")` |

---

## Phase 6 — Security Validation ✅

Your system already enforces:

- ✅ Session token validation (`auth.kind="session"`)
- ✅ Nonce replay prevention (each message unique nonce)
- ✅ Rate limiting (Nucleus enforces quota per session)
- ✅ Capability gating (only IDE can send `chat.request`)

No additional security work needed. (This was already correct.)

---

## Phase 7 — Optional: Real LLM Integration ⏳

Replace stub `run_reasoning()` in **`routes_chat.py`** or **`brain.py`**:

### With Anthropic Claude

```python
from anthropic import Anthropic

client = Anthropic()

async def run_reasoning(req: ChatRequest):
    """Stream from Claude."""
    msg = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=1024,
        messages=[
            {"role": "user", "content": req.text}
        ]
    )
    return msg.content[0].text, [], [], []
```

### Verify

```bash
cd apps/py-sidecar
ANTHROPIC_API_KEY=sk-... python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

---

## Phase 8 — Production Readiness ⏳

- [ ] Set `BRAIN_ENDPOINT` env var (if not localhost)
- [ ] Enable TLS for WS (`wss://`)
- [ ] Add request logging + tracing
- [ ] Profile latency (measure p50, p95 response time)
- [ ] Load test (100+ concurrent messages)
- [ ] Implement message history persistence
- [ ] Add retry logic for Brain failures

---

## 📋 Verification Checklist

- [ ] Protocol compiles ✅
- [ ] `/chat/stream` returns NDJSON ✅
- [ ] Nucleus builds ✅
- [ ] Brain service runs on port 8001 ✅
- [ ] IDE connects to `ws://localhost:3000` ✅
- [ ] Chat message sent → auth + nonce present ✅
- [ ] Brain receives request ✅
- [ ] NDJSON streamed back to Nucleus ✅
- [ ] Nucleus forwards to IDE ✅
- [ ] UI renders response ✅
- [ ] No console errors ✅

---

## 🎯 Summary

**What was wrong with the old checklist:**

1. ❌ Suggested `/ws/chat` endpoint (doesn't exist)
2. ❌ Suggested adding fetch-brain-inside-wsHub (already done in ChatHandler)
3. ❌ Suggested wrong Python entry point (should be modular `app/main.py`)
4. ❌ Chat routes might not be mounted in `app/main.py` yet

**What's correct now:**

1. ✅ Single WS endpoint: `ws://localhost:3000`
2. ✅ ChatHandler already handles streaming → Nucleus
3. ✅ Brain `/chat/stream` exists (verified)
4. ✅ Security gates inherited from wsHub (session + token + nonce + caps)
5. ✅ Use `WsClient.send()` for auth+nonce injection

**Next step:** Verify `routes_chat.py` is mounted in `app/main.py`, then test end-to-end.

---

**Let's verify `/chat/stream` is live, then go. 🚀**
