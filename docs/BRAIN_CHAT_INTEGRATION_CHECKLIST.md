# Brain Chat System - Integration Checklist

Use this checklist to complete the integration and bring the Brain Chat System live.

---

## Phase 1: Verify Protocol & Services ✅

- [ ] **Protocol compiles**

  ```bash
  cd packages/protocol
  pnpm build
  ```

  Look for "build successful" (no TS errors)

- [ ] **Chat types export correctly**

  ```bash
  cd packages/protocol
  npm ls | grep chat  # Should see chat types exported
  ```

- [ ] **Brain service runs**

  ```bash
  cd apps/py-sidecar
  pip install fastapi pydantic uvicorn
  python brain.py
  ```

  Should print: `Uvicorn running on http://0.0.0.0:8001`

- [ ] **Brain /chat endpoint responds**

  ```bash
  curl -X POST http://localhost:8001/chat \
    -H "Content-Type: application/json" \
    -d '{"convoId":"c1","userId":"u1","text":"Test","persona":"assistant","recentHistory":[]}'
  ```

  Should return ChatResponse with text + memory writes

- [ ] **Brain /health checks out**

  ```bash
  curl http://localhost:8001/health
  ```

  Should return: `{"status":"ok","timestamp":"..."}`

---

## Phase 2: Integrate with Nucleus ⏳

### Step 1: Edit `apps/nucleus/src/wsHub.ts`

**Find line ~155** (in `requiredCapsForMessageType` function):

```typescript
case "preview.ping":
  return ["cap:preview:write"];
// ADD AFTER:
case "chat.request":
  return ["cap:chat:send"];
```

**Find line ~180** (in `grantCapsForRole` function, IDE role):

```typescript
if (role === "ide") {
  return [
    // ... existing entries ...
    "cap:preview:read",
    // ADD:
    "cap:chat:send",
  ];
}
```

**Find line ~410** (in `const known = ...` check):

```typescript
const known =
  env.type === "uee" ||
  env.type === "pty.open" ||
  env.type === "pty.resize" ||
  env.type === "pty.input" ||
  env.type === "preview.ping" ||
  // ... other types ...
  // ADD:
  env.type === "chat.request" ||
  false;
```

**Find line ~540** (after all other handlers, before `ws.on("close")`):

```typescript
// ---- chat request ----
if (env.type === "chat.request") {
  const ChatRequest = env.payload as any;
  try {
    const brainResp = await fetch("http://localhost:8001/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(env.payload),
      signal: AbortSignal.timeout(30_000),
    });

    if (!brainResp.ok) {
      throw new Error(`Brain ${brainResp.status}`);
    }

    const responseData = await brainResp.json();

    send(ws, {
      v: 2,
      id: randomId("srv"),
      type: "chat.response" as keyof MessageMap,
      ts: nowMs(),
      from: { role: "nucleus", instanceId: HUB_INSTANCE_ID },
      sessionId,
      auth: { kind: "session", token: client.token },
      nonce: randomId("n"),
      payload: responseData,
    } as AnyEnv);
  } catch (err) {
    send(ws, {
      v: 2,
      id: randomId("srv"),
      type: "chat.error" as keyof MessageMap,
      ts: nowMs(),
      from: { role: "nucleus", instanceId: HUB_INSTANCE_ID },
      sessionId,
      auth: { kind: "session", token: client.token },
      nonce: randomId("n"),
      payload: { error: String(err) },
    } as AnyEnv);
  }
  return;
}
```

### Step 2: Verify wsHub edits

```bash
cd apps/nucleus
pnpm build
```

Should compile without errors. If you see TS errors about types, check that:

- `ChatRequest` and `ChatResponse` are imported from `@world-engine/protocol`
- `MessageMap` includes `"chat.request"` and `"chat.response"` types

---

## Phase 3: Integrate Chat UI ⏳

### Option A: Add to existing World Engine Studio

Edit `apps/ide-web/src/WorldEngineStudio.tsx`:

```typescript
// Near top, add imports:
import { ChatUI } from "./ui/ChatUI";

// Find where layout components are defined, add:
<div style={{ flex: 1, overflow: "auto" }}>
  <ChatUI
    userId={currentUser?.id || "anonymous"}
    convoId={currentConvId || "default"}
    wsUrl="ws://localhost:3000/ws/chat"  // or window.location
    onError={(err) => console.error("Chat error:", err)}
  />
</div>
```

### Option B: Create a demo page

Create `apps/ide-web/src/ChatPage.tsx`:

```typescript
import React from "react";
import { ChatUI } from "./ui/ChatUI";

export function ChatPage() {
  return (
    <div style={{ height: "100vh", display: "flex" }}>
      <ChatUI
        userId="demo-user"
        convoId="demo-conv"
        wsUrl="ws://localhost:3000/ws/chat"
      />
    </div>
  );
}
```

Then add route in main app router.

---

## Phase 4: Start Full Stack ✅

### Terminal 1: Nucleus

```bash
cd apps/nucleus
pnpm dev
# Wait for: "WebSocket server listening on ws://localhost:3000"
```

### Terminal 2: Brain

```bash
cd apps/py-sidecar
python brain.py
# Wait for: "Uvicorn running on http://0.0.0.0:8001"
```

### Terminal 3: IDE

```bash
cd apps/ide-web
pnpm dev
# Wait for: "Local: http://localhost:5173"
```

---

## Phase 5: End-to-End Testing ✅

- [ ] **Browser opens IDE** at `http://localhost:5173`
- [ ] **Chat component visible** (input field + message area)
- [ ] **Type test message** "Hello"
- [ ] **Message appears in UI** in user style
- [ ] **Watch network** (F12 → Network tab)
- Should see WebSocket connection to `/ws/chat`
- Should see HTTP request to `localhost:8001` from Nucleus
- [ ] **Wait for response** (should be < 1 second)
- [ ] **Assistant message appears** in UI with styling
- [ ] **Memory section** shows stored facts (if any)
- [ ] **No console errors** (F12 → Console tab should be clean)

### Success Indicators

✅ **If you see:**

- Message sent to Nucleus
- Nucleus routes to Brain (HTTP)
- Brain responds (< 1s)
- Response streams back as assistant message
- UI renders cleanly

**Then the system is working end-to-end!**

### Common Issues

| Issue                      | Solution                                                                  |
| -------------------------- | ------------------------------------------------------------------------- |
| WebSocket connection fails | Brain service not running? Check `http://localhost:8001/health`           |
| Chat message hangs         | Check Nucleus logs for routing error. Brain might be unreachable.         |
| Response takes > 5s        | Brain reasoning slow. Check `python brain.py` logs for queries/LLM calls. |
| UI doesn't render          | Check ChatUI mounted. Check browser console (F12).                        |
| ts errors on build         | Missing `cap:chat:send`? Check wsHub.ts edits above.                      |

---

## Phase 6: Optional - Connect Real Services ⏳

### Connect Lexicon Service

Edit `apps/py-sidecar/brain.py`:

Replace stub `query_lexicon()`:

```python
async def query_lexicon(q: str, limit: int = 5) -> List[dict]:
    """Query real lexicon service"""
    resp = await asyncio.create_task(
        aiohttp.ClientSession().get(
            f"http://localhost:8002/lexicon/search?q={q}&limit={limit}"
        )
    )
    return await resp.json() if resp.ok else []
```

### Connect LLM

Replace stub `run_reasoning()`:

```python
from anthropic import Anthropic

async def run_reasoning(req: ChatRequest) -> tuple[str, ...]:
    """Use Claude for reasoning"""
    client = Anthropic()
    msg = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=1024,
        messages=[{"role": "user", "content": req.text}]
    )
    text = msg.content[0].text
    return text, [], [], []  # TODO: extract tool calls from response
```

### Connect Memory Service

Replace in-memory `memory{}`:

```python
async def store_memory(key: str, value: str):
    """Persist to backend"""
    resp = await fetch(
        "http://localhost:8003/memory/write",
        method="POST",
        json={"key": key, "value": value}
    )
    return resp.ok
```

---

## Phase 7: Verify Security ✅

- [ ] **Session tokens work**
- Connect to IDE, check Network tab
- Should see `auth: { kind: "session", token: "..." }` on each message

- [ ] **Nonce prevents replay**
- Copy a previous message + nonce from Network tab
- Try sending it again
- Should be rejected (no response)

- [ ] **Rate limiting enforces quota**
- Send 150 messages rapidly from IDE
- After 120, should see rate limit error

- [ ] **Only IDE can send chat**
- Try to send `chat.request` from preview (different role)
- Should get `CAP_DENIED` error

---

## Phase 8: Production Readiness ⏳

### Before shipping to production

- [ ] Set `BRAIN_ENDPOINT` environment variable
- [ ] Enable TLS for WebSocket (`wss://`)
- [ ] Enable CORS headers on Brain service
- [ ] Add authentication (JWT tokens instead of session)
- [ ] Add logging/tracing infrastructure
- [ ] Profile latency (chat latency, token throughput)
- [ ] Load test (can handle N concurrent users?)
- [ ] Cache lexicon queries (avoid duplicate API calls)
- [ ] Implement conversation persistence (save history to DB)
- [ ] Add retry logic for Brain service failures

---

## Quick Reference

| Component | Port | Health                       | Notes              |
| --------- | ---- | ---------------------------- | ------------------ |
| Nucleus   | 3000 | ws://localhost:3000/ws/chat  | WebSocket endpoint |
| Brain     | 8001 | <http://localhost:8001/health> | FastAPI service    |
| IDE       | 5173 | <http://localhost:5173>        | Vite dev server    |

---

## Support & Debugging

### Check service status

```bash
# Nucleus running?
curl http://localhost:3000/health

# Brain running?
curl http://localhost:8001/health

# IDE running?
curl http://localhost:5173
```

### Tail logs

```bash
# Terminal 1: Nucleus
cd apps/nucleus && pnpm dev 2>&1 | grep -i chat

# Terminal 2: Brain
cd apps/py-sidecar && python brain.py 2>&1 | grep -i error

# Terminal 3: IDE (F12 console)
```

### Test each tier independently

**Brain alone:**

```bash
python apps/py-sidecar/brain.py
curl -X POST http://localhost:8001/chat -d '...'
```

**Nucleus + Brain (no UI):**

```bash
# Nucleus + Brain running
# Then test with ws client library or websocat:
echo '{"v":2,"id":"test","type":"chat.request",...}' | \
  websocat ws://localhost:3000/ws/chat
```

**Full stack (all three):**

```bash
# Open IDE in browser, interact via UI
```

---

## Done Checklist

- [ ] Protocol builds ✅
- [ ] Brain service runs ✅
- [ ] Brain endpoint responds ✅
- [ ] wsHub.ts patched (4 locations) ✅
- [ ] Nucleus builds ✅
- [ ] ChatUI imports into IDE ✅
- [ ] All three services running ✅
- [ ] Test message → response ✅
- [ ] No console errors ✅
- [ ] Citations rendering (if any) ✅
- [ ] Memory persisting ✅
- [ ] Docs reviewed ✅

---

## What's Next?

Once the integration checklist is complete:

1. **Connect Lexicon** — Replace stub queries with real semantic search
2. **Add LLM** — Replace `run_reasoning()` with Claude API call
3. **Implement Tool Executor** — Map server tools to actual functions
4. **Enable Streaming** — Token-by-token rendering (not chunked)
5. **Scale Testing** — Load test with concurrent users
6. **Production Deploy** — TLS, auth, monitoring, logs

---

**Questions? See:**

- `docs/BRAIN_CHAT_INTEGRATION.md` — Full integration guide
- `docs/BRAIN_CHAT_ARCHITECTURE.md` — System design + code paths
- `BRAIN_CHAT_DELIVERY.md` — Executive summary + status

---

**Let's go build. 🚀**
