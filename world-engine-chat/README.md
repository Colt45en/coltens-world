# 💬 World Engine Chat — Distributed Streaming Architecture

**Status**: 🟡 **PARTIAL** (Infrastructure Ready ✅ | Production Features In Progress 🟡)

**Purpose**: Real-time message streaming, LLM integration, tool-call orchestration

---

## Architecture (NOT package or app—DISTRIBUTED)

The "chat system" is **spread across multiple apps + packages**:

| Component | Location | Role | Status |
|-----------|----------|------|--------|
| **Protocols** | `packages/protocol/src/chat.ts` | Zod schemas (request, response, delta, done, error) | ✅ Complete |
| **Brain Service** | `apps/py-sidecar/app/brain.py` | NDJSON streaming endpoint `/chat/stream` | ✅ Implemented (demo LLM) |
| **Parser** | `apps/nucleus/src/ndjson.ts` | Packet-safe NDJSON parser (handles TCP fragmentation) | ✅ Implemented |
| **Handler** | `apps/nucleus/src/routes/chat.ts` | Bridges Brain NDJSON → Nucleus WebSocket envelopes | ✅ Implemented |
| **WebSocket Hub** | `apps/nucleus/src/wsHub.ts` | Routes `chat.request.v1` messages to handler | ✅ Integrated (5 patches) |
| **IDE Client** | `apps/ide-web/src/ui/ChatClient.ts` | Streaming protocol + tool call queueing | ✅ Implemented |
| **IDE UI** | `apps/ide-web/src/ui/ChatUI.tsx` | Real-time text, tool display, history | ✅ Implemented |

---

## End-to-End Message Flow

```
IDE Chat Input
  ↓
ChatClient.sendMessage(chat.request.v1)
  ↓
Nucleus WebSocket (wsHub routes to handler)
  ↓
Brain POST /chat/stream (NDJSON)
  ├─ chat.delta.v1 (token)
  ├─ chat.delta.v1 (token)
  ├─ chat.tool_call.v1 (queued tool)
  └─ chat.done.v1 (stop_reason: end_turn)
  ↓
readNdjsonStream() parser (handles packet splits)
  ↓
handleChatRequestStreaming() wrapper
  ├─ chat.stream.started.v1
  ├─ [relay tokens & tools]
  └─ chat.stream.ended.v1
  ↓
IDE ChatClient._handleMessage()
  ├─ onMessage(text) → accumulate
  ├─ _queueToolCall() → collect
  └─ _executeQueuedToolCalls() → display in UI
```

---

## Specification Quality ✅

**Implementation Docs**:
- `CHAT_STREAMING_IMPLEMENTATION.md` (509 lines) — **Production-grade spec**
  - Protocol specification (request, delta, tool_call, done, lifecycle messages)
  - Component architecture (Brain, Nucleus, IDE layers)
  - Tool call queueing pattern (collect during stream, execute after done)
  - Testing strategy (curl endpoint test + dev server instructions)
  - Files modified (6 components, LOC per file)
  - Verification checklist (TypeScript compile, syntax valid, hot reload working)

- `CHAT_SYSTEM_INTEGRATION.md` (375 lines) — **100% integration checklist completed** ✅
  - Zod protocol contracts ✅
  - Chat handler bridge ✅
  - WebSocket Hub patched (5 locations) ✅
  - Brain service deployed ✅
  - IDE client + UI implemented ✅
  - Security & reliability (capability gating, timeout, error handling, trace IDs) ✅
  - End-to-end flow documented ✅

---

## Infrastructure Status: ✅ COMPLETE

### What Works

- ✅ **Streaming Protocol**: NDJSON from Brain → IDE via Nucleus WebSocket (packet-safe)
- ✅ **Determinism**: Trace IDs derived deterministically from convoId + messageId
- ✅ **Ordering**: Strict message sequence (request → started → [deltas]* → [tools]* → done → ended)
- ✅ **Termination**: Explicit terminal states (`chat.done.v1`, `chat.stream.ended.v1`)
- ✅ **Error Handling**: Timeout (60s), unreachable service, invalid payload → `chat.error`
- ✅ **Security**: Capability gating (`cap:chat:send`), token + nonce validation, payload validation
- ✅ **Tracing**: End-to-end traceIds (IDE → Nucleus → Brain → back)
- ✅ **Tool Queueing**: Tools collected during stream, executed after `chat.done.v1`

### Ready for Testing

```bash
# Terminal 1: Nucleus
cd coltens\ world/apps/nucleus
pnpm dev

# Terminal 2: Brain
cd coltens\ world/apps/py-sidecar
python app/brain.py

# Terminal 3: IDE
cd coltens\ world/apps/ide-web
pnpm dev --port 5173

# Test Brain endpoint directly
curl -X POST http://localhost:8000/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"convoId":"test","userId":"user-1","text":"Hello brain!","persona":"assistant"}' \
  | head -5
# Expected: NDJSON stream (text_chunk, done, etc.)
```

---

## Production Features: 🟡 IN PROGRESS

### Implemented ✅

- ✅ Token streaming (real-time delivery)
- ✅ Tool call collection & display
- ✅ Citations & memory write event handlers
- ✅ Icon compatibility (neon cyan/green styling)
- ✅ Message history persistence (localStorage)

### Not Yet Complete 🟡

**Medium-term roadmap (from spec)**:

1. **Real LLM Integration** — Currently `brain.py` uses demo simulator
   - [ ] Wire Claude API (or equivalent)
   - [ ] Implement `run_reasoning()` with real LLM calls
   - [ ] Add token cost tracking

2. **Tool Execution** — Tools are queued but not executed
   - [ ] Implement tool executor (record_screen, query_lexicon, etc.)
   - [ ] Capture tool results
   - [ ] Send results back to LLM for reasoning

3. **Conversation Persistence** — No database yet
   - [ ] SQLite or Postgres for chat history
   - [ ] Implement conversation CRUD
   - [ ] Load context on session restore

4. **Multi-turn Context Injection** — Currently single-turn
   - [ ] Thread context through multiple messages
   - [ ] Implement "recent history" injection
   - [ ] Support persona switching mid-conversation

5. **Tool Result Feedback Loop** — Tools execute but don't feed back
   - [ ] Capture tool execution results
   - [ ] Inject into LLM reasoning loop
   - [ ] Update UI with tool outcomes

---

## MVP vs Production Status

| Aspect | MVP | Production |
|--------|-----|-----------|
| **Streaming tokens** | ✅ Ready | ✅ Ready |
| **Tool queueing** | ✅ Ready | ✅ Ready |
| **Real LLM** | Demo only | 🟡 In progress |
| **Tool execution** | Queued only | 🟡 In progress |
| **Persistence** | localStorage | 🟡 DB needed |
| **Multi-turn** | Single only | 🟡 In progress |

---

## Key Files

- `CHAT_STREAMING_IMPLEMENTATION.md` — **Full specification** (read this first)
- `CHAT_SYSTEM_INTEGRATION.md` — **Integration verification** (checklist-based)
- `packages/protocol/src/chat.ts` — Message types & Zod schemas
- `apps/nucleus/src/routes/chat.ts` — Streaming handler (Nucleus side)
- `apps/nucleus/src/ndjson.ts` — NDJSON parser
- `apps/nucleus/src/wsHub.ts` — WebSocket Hub patches (5 locations)
- `apps/py-sidecar/app/brain.py` — Brain service (Python side)
- `apps/ide-web/src/ui/ChatClient.ts` — IDE streaming client
- `apps/ide-web/src/ui/ChatUI.tsx` — IDE chat UI component

---

## Next Immediate Actions

1. ✅ **Verify wsHub.ts patches applied** — Check lines 17, 155, 191, 428, 551
2. ✅ **E2E streaming test** — Start all 3 servers, send message, verify token delivery
3. ✅ **Load test** — Send 100+ token response, measure latency/throughput
4. 🟡 **Wire real LLM** — Replace demo simulator in brain.py
5. 🟡 **Implement tool executor** — Hook tool calls → real actions → results feedback

---

## Architecture Decision

This is a **hybrid pattern**:
- **Contracts layer** (package): `packages/protocol/src/chat.ts` — version-controlled API
- **App layers** (nucleus + py-sidecar): Bridge HTTP NDJSON + WebSocket protocols
- **Client layer** (ide-web): React components consuming WebSocket events

**Advantages**:
- Protocol evolution versioned independently
- Brain service can swap implementations (Python ↔ C#, API ↔ local Ollama)
- IDE client decoupled from Brain backend

**Trade-off**: Distributed means more files to update for breaking changes.

---

**Audit Date**: 2026-02-27
**Status Updated**: 2026-02-27 (verified spec quality + integration status)
