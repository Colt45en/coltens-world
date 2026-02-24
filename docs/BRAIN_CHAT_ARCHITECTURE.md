# Brain Chat System - Architecture Reference

## System Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         WORLD ENGINE STACK                              │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────┐         ┌──────────────────────┐            │
│  │   IDE Web (React)      │         │   Preview Runtime    │            │
│  │                        │         │                      │            │
│  │  ┌──────────────────┐  │         │  Render + Physics    │            │
│  │  │  ChatUI          │  │         │  Animation Engine    │            │
│  │  │  + ChatClient    │  │         │                      │            │
│  │  │                  │  │         │                      │            │
│  │  │  WebSocket       │  │         │  WebSocket           │            │
│  │  │  Client          │  │         │  Client              │            │
│  │  └────────┬─────────┘  │         └─────────┬────────────┘            │
│  └───────────┼────────────┘                    │                        │
│              │                                 │                        │
│              │ ws://                           │ ws://                  │
│              │ localhost:3000/ws/chat          │ localhost:3000/ws/...  │
│              │ (streaming events)              │                        │
│              │                                 │                        │
└──────────────┼─────────────────────────────────┼──────────────────────┘
               │                                 │
               │         ┌─────────────────────────┐
               │         │    NUCLEUS (Node.js)    │
               │         │                         │
               │         │  ┌───────────────────┐  │
               │         │  │ wsHub.ts          │  │
               │         │  │ - Handshake       │  │
               │         │  │ - Auth + Rate lim │  │
               │         │  │ - Message routing │  │
               │         │  │                   │  │
               │         │  │ ┌───────────────┐ │  │
               │         │  │ │ routes/       │ │  │
               │         │  │ │ - uee.ts      │ │  │
               │         │  │ │ - pty.ts      │ │  │
               │         │  │ │ - chat.ts ✅  │ │  │
               │         │  │ └───────────────┘ │  │
               │         │  │                   │  │
               │         │  │ chat.ts handler   │  │
               │         │  │ ┌───────────────┐ │  │
               │         │  │ │ receive       │ │  │
               │         │  │ │ chat.request  │ │  │
               │         │  │ └───────────────┘ │  │
               │         │  └────────┬──────────┘  │
               │         │           │             │
               │         │           │ HTTP POST   │
               │         │           │ ChatRequest │
               │         └───────────┼─────────────┘
               │                     │
               │     ┌───────────────▼──────────────┐
               │     │ BRAIN (FastAPI/Python)      │
               │     │                              │
               │     │ ┌──────────────────────────┐ │
               │     │ │ /chat endpoint           │ │
               │     │ │ 1. Parse ChatRequest     │ │
               │     │ │ 2. Query lexicon         │ │
               │     │ │ 3. Assemble context      │ │
               │     │ │ 4. Run reasoning         │ │
               │     │ │ 5. Generate tool calls   │ │
               │     │ │ 6. Return ChatResponse   │ │
               │     │ └──────────────────────────┘ │
               │     │                              │
               │     │ ┌──────────────────────────┐ │
               │     │ │ Dependencies:            │ │
               │     │ │ - Lexicon service (stub) │ │
               │     │ │ - LLM client (stub)      │ │
               │     │ │ - Memory backend (stub)  │ │
               │     │ └──────────────────────────┘ │
               │     └───────────────┬──────────────┘
               │                     │
               │                HTTP │ response
               │            ChatResponse
               │                     │
               └─────────────────────┘
                       (wired)


┌──────────────────────────────────────────────────────────────────────────┐
│                      PROTOCOL LAYER (@world-engine/protocol)            │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Envelope<T> wrapper (v, id, ts, traceId, source, kind, payload)        │
│  ↓                                                                       │
│  ├─ ChatRequest (convoId, userId, text, persona, history, context)      │
│  ├─ ChatResponse (text, toolCalls[], citations[], memoryWrites[])       │
│  ├─ ToolCall (name, args, timeout, critical)                           │
│  ├─ ToolResult (name, ok, data, error, durationMs)                      │
│  ├─ Citation (url, title, snippet)                                      │
│  ├─ MemoryWrite (key, value, ttl)                                       │
│  └─ ChatStreamEvent (discriminated union of all above)                  │
│                                                                          │
│  All defined in: packages/protocol/src/chat.ts                          │
│  Zod schema: ✅ Runtime validation                                       │
│  TypeScript: ✅ Compile-time checking                                    │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## Message Flow

### 1. User Sends Message

┌──────────────┐
│  User types  │
│  "Hello"     │
└──────┬───────┘
       │
       ▼
┌──────────────────────────┐
│ ChatUI.onSendMessage()   │
│ - Create ChatRequest     │
│ - Wrap in Envelope       │
│ - Add trace ID           │
│ - Serialize to JSON      │
└──────┬───────────────────┘
       │
       ▼ WebSocket.send()
┌──────────────────────────┐
│ Network Layer            │
│ ws://localhost:3000/... │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│ Nucleus ws.onmessage()   │
│ - Validate Envelope      │
│ - Check auth + nonce     │
│ - Check rate limit       │
│ - Dispatch to handler    │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│ routes/chat.ts           │
│ handleChatRequest()      │
│ - Extract ChatRequest    │
│ - Call Brain service     │
│ - Await response         │
└──────┬───────────────────┘
       │
       ▼ HTTP POST
┌──────────────────────────┐
│ Network Layer            │
│ <http://localhost:8001/>.. │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│ Brain FastAPI            │
│ /chat endpoint           │
│ - Parse ChatRequest      │
│ - Lexicon query          │
│ - Reasoning logic        │
│ - Generate response      │
│ - Serialize ChatResponse │
└──────┬───────────────────┘
       │
       ▼ HTTP response
┌──────────────────────────┐
│ Network Layer            │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│ Nucleus route handler    │
│ - Receive ChatResponse   │
│ - Wrap in Envelope       │
│ - Send via WebSocket     │
└──────┬───────────────────┘
       │
       ▼ WebSocket.send()
┌──────────────────────────┐
│ Network Layer            │
│ ws://localhost:3000/... │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│ ChatClient onmessage()   │
│ - Parse Envelope         │
│ - Validate ChatResponse  │
│ - Stream events          │
│ - Call callbacks         │
└──────┬───────────────────┘
       │
       ├─▶ onMessage()      → update response text
       │
       ├─▶ onCitation()     → display chip
       │
       ├─▶ onMemoryWrite()  → persist
       │
       └─▶ onStreamEnd()    → mark complete
            │
            ▼
       ┌──────────────────────────┐
       │ ChatUI.state.messages    │
       │ [user, assistant, ...]   │
       │ + citations              │
       │ + memory                 │
       └──────────────────────────┘

## Tool Execution Flow

### For UI-Local Tools (record_screen, chart_render)

``` Brain generates:
  ToolCall { name: "record_screen", args: { duration: 10 } }
       │
       ▼ ChatClient._executeToolCall()
       │
       ├─▶ switch(tool.name)
       │   │
       │   └─▶ case "record_screen":
       │       _recordScreen(args)
       │       │
       │       ├─ Start MediaRecorder
       │       ├─ Wait 10 seconds
       │       ├─ Stop & get blob
       │       │
       │       ▼
       │       ToolResult {
       │         name: "record_screen",
       │         ok: true,
       │         data: { url: "blob:..." }
       │       }
       │
       └─▶ invoke config.onToolCall(tool)
           (can send ToolResult back if critical)
```

### For Server-Routed Tools (query_lexicon, spawn_world_event)

``` Brain generates:
  ToolCall { name: "query_lexicon", args: { q: "..." } }
       │
       ▼ ChatClient → Nucleus (in ToolResult envelope)
       │
       ▼ Nucleus routes to service
       │
       └─▶ Result bubbles back to Brain
           (in next reasoning step)
```

## State Management

### Client-Side (ChatUI)

```typescript
messages[]
  ├─ { id, role: "user", text, timestamp }
  ├─ { id, role: "assistant", text, citations, toolCalls, timestamp }
  └─ ...

currentResponse
  └─ string (concatenates streaming chunks)

isStreaming
  └─ boolean

citations[]
  ├─ { url, title, snippet }
  └─ ...

memory{}
  ├─ "user_preference" → "enabled"
  ├─ "last_query" → "..."
  └─ ...
```

### Server-Side (Brain)

```python
ConversationContext
  ├─ convoId
  ├─ userId
  ├─ persona
  ├─ systemPrompt (if using LLM)
  ├─ recentHistory[] (limited window)
  └─ worldContext (player pos, visible entities)

PreparedContext
  ├─ lexiconHits[] (from semantic search)
  ├─ memory[] (from persistent store)
  ├─ relevantFiles[] (if code context)
  └─ tokenCount (for budget)
```

## Tracing

Every message carries a **traceId** for debugging:

``` IDE sends:
  Envelope<ChatRequest> { traceId: "trace-abc123" }

Nucleus logs:
  [chat] trace-abc123 received chat.request from user1

Brain logs:
  [reasoning] trace-abc123 starting
  [lexicon] trace-abc123 queried (found 5 hits)
  [generation] trace-abc123 created 2 tool calls

Nucleus logs:
  [chat] trace-abc123 response ready, returning

IDE logs:
  [chat] trace-abc123 streaming started
  [chat] trace-abc123 text chunks: 50
  [chat] trace-abc123 citations: 3
  [chat] trace-abc123 done

→ Full end-to-end debugging with single trace ID
```

## Performance Targets

- **Message latency:** < 500ms (UI → Nucleus → Brain → UI)
- **Brain reasoning:** < 200ms (for rule-based; ~5s for LLM)
- **Streaming chunks:** < 20ms each (token-by-token)
- **WebSocket buffer:** < 10MB (per connection)
- **Rate limit:** 120 msgs / 10s (per session)
- **Max payload:** 256KB per message
- **Nonce replay window:** 60s
- **Clock skew tolerance:** ±60s

## Security Checklist

- ✅ **Session handshake** — Token issued + validated on every message
- ✅ **Nonce replay protection** — Same message cannot be sent twice
- ✅ **Clock skew validation** — Message timestamp must be within ±60s
- ✅ **Rate limiting** — Token bucket (120 msgs / 10s)
- ✅ **Capability gating** — chat.send only granted to IDE role
- ✅ **Payload size limits** — 256KB max per message
- ✅ **Authentication** — Required on all messages after handshake
- ✅ **Type validation** — All payloads validated with Zod

## Deployment Notes

### Development

```bash
Nucleus:   ws://localhost:3000/ws/chat
Brain:     http://localhost:8001
IDE:       http://localhost:5173
```

### Production

```bash
Nucleus:   wss://api.example.com/ws/chat   (TLS)
Brain:     https://brain.internal:8001/    (private network)
IDE:       https://app.example.com         (TLS)

Environment:
- BRAIN_ENDPOINT="https://brain.internal:8001"
- NUCLEUS_WS_URL="wss://api.example.com/ws/chat"
- SESSION_TOKEN_TTL=3600
- ...
```

## Files at a Glance

``` packages/protocol/src/
  ├─ chat.ts ..................... Chat message schemas (Zod)
  └─ index.ts .................... Re-exports

apps/nucleus/src/
  ├─ wsHub.ts .................... WebSocket hub + dispatcher
  └─ routes/chat.ts .............. Chat handler template

apps/py-sidecar/
  └─ brain.py .................... FastAPI Brain service

apps/ide-web/src/ui/
  ├─ ChatClient.ts ............... WebSocket client
  ├─ ChatUI.tsx .................. React component
  └─ ChatUI.css .................. Styling

docs/
  ├─ BRAIN_CHAT_INTEGRATION.md ... Step-by-step guide
  └─ BRAIN_CHAT_DELIVERY.md ...... This summary
```

---

**Ready to go. Ship it. 🚀**
