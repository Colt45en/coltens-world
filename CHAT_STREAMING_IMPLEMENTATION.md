# Chat Streaming Implementation (NDJSON Protocol)

## Overview

Implemented engine-grade **NDJSON streaming chat** system with deterministic trace IDs, cursor-safe parsing, and streaming support for:

- **Token delivery** via `chat.delta.v1` messages
- **Tool invocation** via `chat.tool_call.v1` messages
- **Completion signaling** via `chat.done.v1` messages

---

## Components Implemented

### 1. FastAPI Brain Service

**File**: `apps/py-sidecar/app/brain.py`

- **FastAPI streaming endpoint** at `POST /chat/stream`
- **NDJSON protocol** with `application/x-ndjson` media type
- **Demo LLM simulation** (replace with real LLM calls)
- **Deterministic trace IDs** derived from conversation + message IDs
- **Streaming response** pattern: delta tokens → tool calls → done signal

**Key Exports**:

- `ChatRequest` model (convoId, messageId, prompt, stream, tools)
- `simulate_llm_stream()` async generator (demo)
- `ndjson()` serialization helper

**Usage**:

```bash
python apps/py-sidecar/app/brain.py
# Or via uvicorn: uvicorn app.brain:app --port 8000
```

---

### 2. NDJSON Parser (Nucleus)

**File**: `apps/nucleus/src/ndjson.ts`

- **`readNdjsonStream<T>(body: ReadableStream<Uint8Array>): AsyncGenerator<T>`**
- **Handles packet fragmentation** via streaming TextDecoder
- **Line-by-line JSON parsing** with graceful error skipping
- **Preserves partial final line** if incomplete at EOF

**Key Features**:

- Resilient to TCP packet boundaries
- Skips invalid JSON lines without breaking stream
- Explicit `releaseLock()` in finally block for cleanup

**Usage**:

```typescript
import { readNdjsonStream } from "../ndjson";

for await (const chunk of readNdjsonStream(response.body)) {
  console.log(chunk); // { type, traceId, payload, ... }
}
```

---

### 3. Nucleus Streaming Handler (Chat Bridge)

**File**: `apps/nucleus/src/routes/chat.ts`

- **`handleChatRequestStreaming()` handler**
- **Bridges Brain NDJSON → IDE WebSocket envelopes**
- **Preserves message types** (chat.delta.v1, chat.tool_call.v1, chat.done.v1)
- **Emits lifecycle events**:
  - `chat.stream.started.v1` (before stream begins)
  - `chat.stream.error.v1` (on error)
  - `chat.stream.ended.v1` (after stream ends)
- **AbortController integration** for early termination

**Envelope Format**:

```typescript
{
  v: 2,
  type: "chat.delta.v1" | "chat.tool_call.v1" | "chat.done.v1",
  traceId: "tr-<convoId>-<messageId>",
  messageId: "msg-<uuid>",
  payload: { ... }
}
```

---

### 4. IDE Chat Client (React)

**File**: `apps/ide-web/src/ui/ChatClient.ts`

#### New Features

- **Supports new streaming protocol**:
  - `chat.stream.started.v1` → calls `onStreamStart()`
  - `chat.delta.v1` → calls `onMessage(text_delta)`
  - `chat.tool_call.v1` → queues tool (not executed until stream ends)
  - `chat.done.v1` → executes queued tools, calls `onStreamEnd()`
  - `chat.stream.error.v1` → error handling
  - `chat.stream.ended.v1` → cleanup

#### Tool Call Queueing

- Tools are **collected during streaming**
- Tools are **executed after stream completes** (after `chat.done.v1`)
- New callback: `onToolsQueued?: (tools: ToolCall[]) => void`
- Allows UI to display tool invocations before execution

#### Backward Compatibility

- Still supports legacy `chat.stream_event` messages
- Legacy `chat.response` and `chat.error` messages

---

### 5. IDE Chat UI (React Component)

**File**: `apps/ide-web/src/ui/ChatUI.tsx`

#### New Features

- **Tool call display** in both streaming and finalized messages
- **Tool queueing feedback** ("Tools queued:" indicator)
- **Tool call details** (name + arguments) in collapsed section
- **Integrated with ChatClient** via `onToolsQueued` callback

#### State Management

- `currentToolCalls: ToolCall[]` — tools queued during stream
- Messages now include `toolCalls?: ToolCall[]` in history
- Tool calls persisted in message history for audit/replay

#### CSS Styling

- Tool call section styled with neon cyan borders
- Tool name highlighted in neon green
- Tool arguments rendered as JSON with word-break handling
- Responsive design for mobile

---

### 6. Chat UI CSS Updates

**File**: `apps/ide-web/src/ui/ChatUI.css`

**New Classes**:

- `.tool-calls` — container (cyan border, neon background)
- `.tool-calls-header` — "Tools:" label
- `.tool-call` — individual tool entry
- `.tool-name` — tool name (green, monospace)
- `.tool-args` — arguments (gray, monospace, ellipsis)

---

## Protocol Specification

### Message Types

#### `chat.request.v1` (IDE → Nucleus)

```json
{
  "v": 2,
  "type": "chat.request.v1",
  "id": "msg_<uuid>",
  "traceId": "tr_<uuid>",
  "sessionId": "...",
  "payload": {
    "convoId": "conversation-123",
    "userId": "user-456",
    "text": "Hello, brain!",
    "persona": "general",
    "recentHistory": [],
    "context": { "mapId": "default", ... }
  }
}
```

#### `chat.delta.v1` (Brain → Nucleus → IDE)

```json
{
  "type": "chat.delta.v1",
  "traceId": "tr-convo-msg",
  "messageId": "msg-xyz",
  "payload": {
    "text_delta": "token or phrase"
  }
}
```

#### `chat.tool_call.v1` (Brain → Nucleus → IDE)

```json
{
  "type": "chat.tool_call.v1",
  "traceId": "tr-convo-msg",
  "messageId": "msg-xyz",
  "payload": {
    "name": "query_lexicon",
    "arguments": { "query": "...", "limit": 10 },
    "timeout": 30000,
    "critical": false
  }
}
```

#### `chat.done.v1` (Brain → Nucleus → IDE)

```json
{
  "type": "chat.done.v1",
  "traceId": "tr-convo-msg",
  "messageId": "msg-xyz",
  "payload": {
    "stop_reason": "end_turn" | "max_tokens" | "tool_use"
  }
}
```

#### `chat.stream.started.v1` (Nucleus → IDE)

```json
{
  "type": "chat.stream.started.v1",
  "traceId": "tr-...",
  "messageId": "msg-xyz",
  "payload": {}
}
```

#### `chat.stream.error.v1` (Nucleus → IDE)

```json
{
  "type": "chat.stream.error.v1",
  "traceId": "tr-...",
  "messageId": "msg-xyz",
  "payload": {
    "error": "Stream error message"
  }
}
```

#### `chat.stream.ended.v1` (Nucleus → IDE)

```json
{
  "type": "chat.stream.ended.v1",
  "traceId": "tr-...",
  "messageId": "msg-xyz",
  "payload": {}
}
```

---

## Integration Checklist

### ✅ COMPLETED: wsHub.ts Patching

All 5 patches have been applied to `apps/nucleus/src/wsHub.ts`:

✅ **1. Imports** (line 17-18):

```typescript
import { handleChatRequestStreaming } from "./routes/chat.js";
import { readNdjsonStream } from "./ndjson.js";
```

✅ **2. Message type validation** (line 155):

```typescript
case "chat.request.v1":
  return ["cap:chat:send"];
```

✅ **3. Grant capabilities** (line 191, IDE section):

- Already present: `"cap:chat:send",`

✅ **4. Known message types** (line 428):

```typescript
env.type === "chat.request.v1" ||
```

✅ **5. Message dispatch** (line 551):

```typescript
if (env.type === "chat.request.v1") {
  await handleChatRequestStreaming(ws, env, sessionId, client.token, HUB_INSTANCE_ID);
  return;
}
```

### ✅ COMPLETED Core Implementation

- ✅ Python Brain NDJSON streaming endpoint (brain.py)
- ✅ NDJSON packet-split-safe parser (ndjson.ts)
- ✅ Nucleus streaming bridge handler (chat.ts)
- ✅ Nucleus wsHub.ts integration (5 patches applied)
- ✅ IDE ChatClient streaming protocol support
- ✅ IDE ChatUI tool call display + queueing
- ✅ TypeScript verification ready for testing

---

## Ready for Testing

**End-to-end architecture is fully connected:**

**1. Import** (~line 1):

```typescript
import { handleChatRequestStreaming } from "./routes/chat";
import { readNdjsonStream } from "../ndjson";
```

**2. Message type validation** (~line 155):

```typescript
case "chat.request.v1":
  return ["cap:chat:send"];
```

**3. Grant capabilities** (~line 180, IDE section):

```typescript
"cap:chat:send",
```

**4. Known message types** (~line 410):

```typescript
env.type === "chat.request.v1" ||
```

**5. Message dispatch** (~line 540):

```typescript
if (env.type === "chat.request.v1") {
  await handleChatRequestStreaming(ws, env, sessionId, token, HUB_INSTANCE_ID);
  return;
}
```

---

## Testing Strategy

### 1. Brain Service (Python)

```bash
# Start Brain
python apps/py-sidecar/app/brain.py

# Test streaming endpoint
curl -X POST http://localhost:8000/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "convoId": "test-convo",
    "messageId": "test-msg",
    "prompt": "What is 2+2?",
    "stream": true,
    "tools": []
  }' \
  | jq -R 'fromjson'
```

### 2. Nucleus + IDE (end-to-end) — ✅ READY

All patches applied. System ready for full end-to-end testing:

1. Start dev servers: `pnpm run dev`
2. Open IDE: http://localhost:5173
3. Navigate to Chat UI
4. Send message → observe:
   - ✅ Stream starts (onStreamStart callback)
   - ✅ Tokens arrive in real-time (chat.delta.v1)
   - ✅ Tool calls queue visibly (chat.tool_call.v1)
   - ✅ Stream completes with stop_reason (chat.done.v1)
   - ✅ Tool calls displayed in message history

The full flow:

```
IDE Chat Input
  → ChatClient.sendMessage()
    → Nucleus WS (chat.request.v1)
      → Brain /chat/stream (FastAPI)
        → NDJSON streaming response
          → readNdjsonStream() (packet-safe parsing)
            → handleChatRequestStreaming() (envelope wrapping)
              → IDE ChatClient._handleMessage()
                → ChatUI real-time updates
```

### 3. Tool Execution Verification

- Check browser console for "Tool call:" logs
- Verify tool calls appear in message UI
- Verify tool execution completes (placeholder implementations ready)

---

## Architecture Highlights

| Layer              | Responsibility                     | Protocol        |
| ------------------ | ---------------------------------- | --------------- |
| **Brain**          | LLM request → token stream         | NDJSON          |
| **Nucleus**        | NDJSON → WS envelope bridge        | WebSocket       |
| **IDE ChatClient** | WS → state updates + tool queueing | Event callbacks |
| **IDE ChatUI**     | Display stream + tools + history   | React state     |

### Message Flow

```
User Input
  ↓
ChatUI.handleSendMessage()
  ↓
ChatClient.sendMessage() [chat.request.v1]
  ↓
Nucleus WS -> Brain /chat/stream
  ↓
Brain.simulate_llm_stream() [NDJSON]
  ├─ chat.delta.v1 (token)
  ├─ chat.delta.v1 (token)
  ├─ chat.tool_call.v1 (tool info)
  └─ chat.done.v1 (stop_reason)
  ↓
Nucleus readNdjsonStream() [packet-safe parsing]
  ↓
handleChatRequestStreaming() [envelope wrapping]
  ├─ chat.stream.started.v1
  ├─ [forward tokens/tools]
  ├─ chat.stream.error.v1 (if needed)
  └─ chat.stream.ended.v1
  ↓
IDE ChatClient._handleMessage()
  ├─ chat.delta.v1 → onMessage(text)
  ├─ chat.tool_call.v1 → _queueToolCall()
  └─ chat.done.v1 → _executeQueuedToolCalls() → onStreamEnd()
  ↓
IDE ChatUI captures tools + adds to message history
```

---

## Next Steps

### Immediate

1. **Patch wsHub.ts** (5 straightforward insertions) → enables end-to-end testing
2. **Test streaming** with Brain simulator → verify token delivery
3. **Verify tool queueing** → confirm UI displays tools correctly

### Short-term

1. **Replace demo LLM** in brain.py with real LLM (Claude API, etc.)
2. **Implement tool executor** orchestration (record_screen, query_lexicon)
3. **Add error recovery** (reconnect on WS close, resume from cursor)

### Medium-term

1. **Conversation history** persistence (SQLite or similar)
2. **Tool result handling** (send results back to LLM)
3. **Multi-turn streaming** with context injection

---

## Files Modified

| File                                | Lines | Change                                       |
| ----------------------------------- | ----- | -------------------------------------------- |
| `apps/py-sidecar/app/brain.py`      | 120   | Created (new streaming endpoint)             |
| `apps/nucleus/src/ndjson.ts`        | 40    | Created (packet-safe parser)                 |
| `apps/nucleus/src/routes/chat.ts`   | 130   | Updated (streaming handler + patch guide)    |
| `apps/ide-web/src/ui/ChatClient.ts` | 100   | Updated (streaming protocol + tool queueing) |
| `apps/ide-web/src/ui/ChatUI.tsx`    | 50    | Updated (tool call display + integration)    |
| `apps/ide-web/src/ui/ChatUI.css`    | 40    | Added (tool call styling)                    |

---

## Verification

✅ **Type Checking**: `apps/nucleus` and `apps/ide-web` compile without errors
✅ **Syntax**: All Python and TypeScript syntax validated
✅ **Hot Reload**: IDE dev server (port 5173) reloading correctly
✅ **Integration Ready**: Brain, Nucleus, IDE components wired (awaiting wsHub patches)

---

## References

- [NDJSON Spec](http://ndjson.org/)
- [World Engine Protocol](../packages/protocol/src/)
- [Bus Architecture](../packages/bus/)
- [Nucleus WS Hub](apps/nucleus/src/wsHub.ts)
- [Engine Streaming](packages/engine/src/runtime/)
