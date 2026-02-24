# Brain-Driven Chat System Implementation Guide

## Overview

The **Brain Chat System** is a contract-first, bus-driven agentic chat runtime integrated into the World Engine. It consists of three tiers:

1. **Nucleus** (Node.js/TypeScript) — WebSocket router that validates & routes messages
2. **Brain** (FastAPI/Python) — Orchestrator that runs reasoning, generates tool calls
3. **IDE** (React/TypeScript) — Chat UI that sends/receives messages, executes local tools

All communication uses **typed `Envelope<T>` messages** with **strict schema validation** (Zod).

## Architecture

```
┌─────────────────┐
│   IDE (React)   │
│  ChatUI.tsx     │
│  ChatClient.ts  │
└────────┬────────┘
         │ ws://localhost:3000/ws/chat
         │ Envelope<ChatRequest>
         │
┌────────▼────────────────────┐
│   Nucleus (Node.js)         │
│  wsHub.ts + routes/chat.ts  │
│  Chat route handler         │
└────────┬────────────────────┘
         │ HTTP POST
         │ ChatRequest → ChatResponse
         │
┌────────▼────────────────────┐
│   Brain (FastAPI)           │
│  /chat endpoint             │
│  Reasoning + planning       │
│  Tool generation            │
└─────────────────────────────┘
```

## Protocol Contracts

All messages are wrapped in `Envelope<T>`:

```typescript
// From @world-engine/protocol/src/chat.ts
interface Envelope<T> {
  v: 1.0; // protocol version
  id: string; // unique message ID
  ts: number; // timestamp (ms)
  traceId: string; // for correlation + debugging
  source: string; // "ide-web", "nucleus", "brain", etc.
  kind: string; // "chat.request", "chat.response", etc.
  payload: T; // typed payload
}

interface ChatRequest {
  convoId: string;
  userId: string;
  text: string;
  persona: string; // "assistant"
  recentHistory: Array<{ role: string; text: string }>;
  context?: {
    // world state
    mapId: string;
    playerPos: [number, number, number];
    visibleEntities: string[];
  };
}

interface ChatResponse {
  convoId: string;
  text: string;
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
  citations: Citation[];
  memoryWrites: MemoryWrite[];
  stop_reason: "end_turn" | "tool_use";
}

interface ToolCall {
  name: string; // "record_screen", "query_lexicon", etc.
  args: Record<string, any>;
  timeout: number; // milliseconds
  critical: boolean; // if true, wait for result before continuing
}

interface Citation {
  url: string; // "lexicon://lex_123", "file://path/to/file", etc.
  title: string;
  snippet?: string; // excerpt from source
}

interface MemoryWrite {
  key: string; // "user_preference_foo", "fact_xyz", etc.
  value: string;
  ttl?: number; // seconds; null = permanent
}
```

## Integration Checklist

### Step 1: Add Chat Protocol to @world-engine/protocol

✅ **Already done:**

- `packages/protocol/src/chat.ts` — Zod schemas for all message types
- `packages/protocol/src/index.ts` — Exports chat types

**Verify:**

```bash
cd packages/protocol
pnpm build
# Should see chat.ts compiled without errors
```

### Step 2: Integrate Chat Handler into Nucleus

**Files to modify:** `apps/nucleus/src/wsHub.ts`

**Changes needed:**

1. **Add chat capability to message type validation** (line ~155):

   ```typescript
   case "chat.request":
     return ["cap:chat:send"];
   ```

2. **Grant chat capability to IDE role** (line ~180, in `grantCapsForRole`):

   ```typescript
   if (role === "ide") {
     return [
       // ... existing caps ...
       "cap:chat:send", // ← ADD THIS
     ];
   }
   ```

3. **Add chat.request to known message types** (line ~410):

   ```typescript
   const known =
     env.type === "uee" ||
     env.type === "pty.open" ||
     // ... other types ...
     env.type === "chat.request" || // ← ADD THIS
     false;
   ```

4. **Add chat request handler** (line ~540, after PTY handlers):

   ```typescript
   // ---- chat request ----
   if (env.type === "chat.request") {
     const brainResponse = await fetch("http://localhost:8001/chat", {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify(env.payload),
       signal: AbortSignal.timeout(30_000),
     });

     if (!brainResponse.ok) {
       send(ws, {
         v: 2,
         id: randomId("srv"),
         type: "chat.error" as keyof MessageMap,
         ts: nowMs(),
         from: { role: "nucleus", instanceId: HUB_INSTANCE_ID },
         sessionId,
         auth: { kind: "session", token: client.token },
         nonce: randomId("n"),
         payload: { error: `Brain error: ${brainResponse.status}` },
       } as AnyEnv);
       return;
     }

     const responseData = await brainResponse.json();
     send(ws, {
       v: 2,
       id: randomId("srv"),
       type: "chat.response",
       ts: nowMs(),
       from: { role: "nucleus", instanceId: HUB_INSTANCE_ID },
       sessionId,
       auth: { kind: "session", token: client.token },
       nonce: randomId("n"),
       payload: responseData,
     } as AnyEnv);
     return;
   }
   ```

### Step 3: Create FastAPI Brain Service

**File:** `apps/py-sidecar/brain.py`

✅ **Already done — see file for:**

- `POST /chat` endpoint (accepts ChatRequest, returns ChatResponse)
- `POST /chat/stream` endpoint (streams events as NDJSON)
- Stub `run_reasoning()` pipeline (replace with real LLM or rule engine)
- Tool call generation (currently just example rules)

**To test:**

```bash
cd apps/py-sidecar
python -m pip install fastapi pydantic uvicorn
python brain.py
# Server runs on http://localhost:8001
```

**Test with curl:**

```bash
curl -X POST http://localhost:8001/chat \
  -H "Content-Type: application/json" \
  -d '{
    "convoId": "c1",
    "userId": "user1",
    "text": "Hello",
    "persona": "assistant",
    "recentHistory": []
  }'
```

### Step 4: Integrate Chat UI into IDE

**Files to create (already done):**

- `apps/ide-web/src/ui/ChatClient.ts` — WebSocket client for brain chat
- `apps/ide-web/src/ui/ChatUI.tsx` — React component for chat interface
- `apps/ide-web/src/ui/ChatUI.css` — Styling

**To use in an app:**

```typescript
import { ChatUI } from "./ui/ChatUI";

export function MyApp() {
  return (
    <ChatUI
      userId="user-123"
      convoId="conv-456"
      wsUrl="ws://localhost:3000/ws/chat"
      onError={(err) => console.error("Chat error:", err)}
    />
  );
}
```

## Running the Full Stack

### Terminal 1: Nucleus (Node.js)

```bash
cd apps/nucleus
pnpm dev
# Listens on ws://localhost:3000/ws/chat
```

### Terminal 2: Brain (FastAPI)

```bash
cd apps/py-sidecar
python brain.py
# Listens on http://localhost:8001
```

### Terminal 3: IDE (Vite dev server)

```bash
cd apps/ide-web
pnpm dev
# Opens http://localhost:5173
```

## Testing Chat Flow

1. **Open IDE in browser** → http://localhost:5173
2. **Insert Chat component** into your layout
3. **Type a message** in the chat input
4. **Observe:**
   - Message sent to Nucleus via WebSocket
   - Nucleus routes to Brain (HTTP)
   - Brain returns response (with citations, tool calls, memory writes)
   - UI streams back and renders response
   - Citations appear as interactive chips
   - Memory persists to localStorage

## Tool Categories

### UI-Local Tools (Execute in Browser)

- `record_screen` — Screen recording (MediaRecorder)
- `record_audio` — Audio capture (AudioContext)
- `chart_render` — Chart rendering (D3, chart.js)

### Server-Routed Tools (Execute in Brain)

- `query_lexicon` — Semantic search
- `read_file` — File content lookup
- `spawn_world_event` — Trigger engine action

## Memory Persistence

Memory writes from Brain are stored server-side and can be:

- Retrieved on reconnect
- Used to personalize future responses
- Expire after TTL (or persist permanently)

Frontend can also store to localStorage:

```typescript
memoryWrites.forEach(({ key, value }) => {
  localStorage.setItem(`brain:${key}`, value);
});
```

## Extending the System

### Add a New Tool to Brain

In `brain.py`:

```python
async def run_reasoning(req: ChatRequest) -> tuple[str, List[ToolCall], ...]:
    # ...
    if "your_keyword" in user_text.lower():
        tool_calls.append(
            ToolCall(name="your_tool", args={"foo": "bar"})
        )
```

### Connect to Real Lexicon

Replace stub `query_lexicon()` in `brain.py`:

```python
async def query_lexicon(q: str, limit: int = 5):
    resp = await fetch("http://localhost:8002/lexicon/search?q=" + q)
    return await resp.json()
```

### Use LLM for Reasoning

Replace stub `run_reasoning()` with Claude API call:

```python
from anthropic import Anthropic

async def run_reasoning(req: ChatRequest):
    client = Anthropic()
    response = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=1024,
        messages=[{
            "role": "user",
            "content": req.text
        }]
    )
    return response.content[0].text, [], [], []
```

## Tracing & Debugging

Every message includes a **traceId** for end-to-end correlation:

```
IDE: Envelope<ChatRequest> traceId=trace-123
  ↓
Nucleus: Route message, log "trace-123: chat.request received"
  ↓
Brain: Log "trace-123: reasoning started"
  ↓
Brain: Log "trace-123: 3 toolcalls generated"
  ↓
Nucleus: Log "trace-123: sending response"
  ↓
IDE: Complete, log "trace-123: done"
```

To debug, search logs for the traceId across all services.

## Security Model

- **Session token** required on all messages (issued at handshake)
- **Nonce** + replay protection (prevent same message twice)
- **Clock skew** validation (±60s window)
- **Rate limiting** (120 msgs / 10s burst per session)
- **Capability gating** (chat.send only granted to IDE role)

## Next Steps

1. ✅ Implement protocol contracts (DONE)
2. ✅ Create Brain service stub (DONE)
3. ✅ Create ChatClient + ChatUI (DONE)
4. 🔲 **Integrate chat handler into wsHub.ts** (see Step 2 above)
5. 🔲 Test full stack (Nucleus + Brain + IDE)
6. 🔲 Connect real Lexicon service
7. 🔲 Replace Brain stub with LLM call (Claude)
8. 🔲 Add tool executor (map server tools to actual functions)
9. 🔲 Streaming support (token-by-token rendering)

## References

- Protocol schemas: `packages/protocol/src/chat.ts`
- Nucleus integration: `apps/nucleus/src/routes/chat.ts` (patch template)
- Brain service: `apps/py-sidecar/brain.py`
- Chat UI: `apps/ide-web/src/ui/ChatUI.tsx`
- ChatClient: `apps/ide-web/src/ui/ChatClient.ts`
