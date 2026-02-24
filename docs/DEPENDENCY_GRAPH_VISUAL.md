# World Engine Dependency Graph & Visual Topology

## Visual Diagrams for All Components, Routes, and Flows

---

## 1. HIGH-LEVEL SYSTEM ARCHITECTURE

```
┌─────────────────────────────────────────────────────────┐
│          WORLD ENGINE COMPLETE TOPOLOGY                 │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────┐│
│  │  IDE Web        │  │  Preview Runtime │  │ Sidecar ││
│  │  (5173)         │  │  (5174)          │  │ (8001)  ││
│  │                 │  │                  │  │         ││
│  │ • React Router  │  │ • Canvas         │  │ • 2 LLM ││
│  │ • OperatorUI    │  │ • PredictionEng  │  │   Ops   ││
│  │ • MemoryPanel   │  │ • Physics        │  │         ││
│  │ • Lab pages     │  │                  │  │ • Memory││
│  │ • iFrame host   │  │                  │  │   CRUD  ││
│  └────────┬────────┘  └──────────┬───────┘  └────┬────┘│
│           │                      │               │    │
│           ├──HTTP POST───────┐   │ (WS)          │    │
│           │ /operator/event  │   └──────┐        │    │
│           │ /brain/memory/*  │          │        │    │
│           │                  │          │        │    │
│           │                  ▼          ▼        │    │
│           │         ┌──────────────────────────┐ │    │
│           │         │    NUCLEUS (3000)        │ │    │
│           │         │                          │ │    │
│           │  ┌─────→│ • wsHub (session mgmt)  │ │    │
│           │  │      │ • Message routing       │ │    │
│           │  │      │ • Rate limiting         │ │    │
│           │  │      │ • UEE Router            │ │    │
│           │  │      │ • globalBus pub/sub     │ │    │
│           │  │      │ • /operator/event handler
│           │  │      │                          │ │    │
│           └──┘      └──────────┬───────────────┘ │    │
│                                │                 │    │
│                    ┌───────────→ HTTP Bridge ◄───┘    │
│                    │            (operator_bus.py)     │
│                    │                                  │
│              Send back via globalBus.publish()        │
│                    ↓                                  │
│           IDE (OperatorResultsPanel)                 │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 2. REQUEST-RESPONSE FLOW (Operator Execution)

```
Client Sequence:
═════════════════════════════════════════════════════════

IDE (OperatorTrigger)
  │
  └─→ [Form INPUT]
      { operatorId: "prompt.operator.patch"
        args: { codeBlock: "...", context: "..." }
      }
  │
  ├─→ POST http://localhost:3000/operator/event
  │   ├─ Headers: Content-Type: application/json
  │   ├─ Body: { operatorId, args, sessionId, traceId }
  │   │
  │   └─→ [Nucleus] handleOperatorEvent()
  │       ├─ Parse + validate envelope
  │       ├─ Extract operatorId, args
  │       ├─ Build HTTP request
  │       │
  │       └─→ POST http://localhost:8001/brain/operator/execute
  │           ├─ Body: { operatorId, args, sessionId, traceId }
  │           │
  │           └─→ [Sidecar] routes_operator.execute()
  │               ├─ Load OPERATORS[operatorId]
  │               │   ├─ PatchOperator
  │               │   └─ SimulateWorldTickOperator
  │               │
  │               ├─ Invoke: operator.execute(args)
  │               │   ├─ Build prompt from template
  │               │   ├─ Call OpenAI GPT (temperature: 0.3)
  │               │   ├─ Parse response JSON
  │               │   ├─ Validate output schema
  │               │   └─ Return outputs dict
  │               │
  │               ├─ Store in BrainMemoryService
  │               │   ├─ Facts (key: "operator_result_<id>)
  │               │   ├─ Vector (embedding)
  │               │   └─ Summary (audit trail)
  │               │
  │               └─→ Response: OperatorExecuteResponse
  │                   { ok: true, outputs: {...}, audit: {...} }
  │
  │ ◄─── HTTP Response (200 OK)
  │
  └─→ [Nucleus] handleOperatorEvent() returns response
      │
      ├─ Emit: globalBus.publish("operator.executed", {
      │   operatorId, outputs, audit, traceId
      │ })
      │
      └─→ IDE (OperatorResultsPanel)
          ├─ Subscribes: bus.subscribe("operator.executed", ...)
          ├─ Receives update event
          └─ Renders outputs panel with results

Time: ≈ 2-8 seconds (depending on LLM latency)
```

---

## 3. WEBSOCKET CONNECTION LIFECYCLE

```
WS Handshake & Session Flow:
════════════════════════════════════════════════════════

1. CLIENT CONNECT
   ws = new WebSocket("ws://localhost:3000")

2. HTTP UPGRADE REQUEST
   GET / HTTP/1.1
   Host: localhost:3000
   Upgrade: websocket
   Sec-WebSocket-Key: x3JJHMbDL1EzLkh9GBhXDw==
   Sec-WebSocket-Version: 13

3. SERVER UPGRADE (Nucleus wsHub.ts)
   HTTP/1.1 101 Switching Protocols
   Upgrade: websocket
   Connection: Upgrade
   Sec-WebSocket-Accept: HSmrc0sMlYUkAGmm5OPpG2HaGWk=

4. CLIENT AUTHENTICATION (WS Message)
   {
     type: "system.hello",
     sessionId: "initial_session",
     token: "jwt_or_bearer_token",
     nonce: "unique_per_msg",
     timestamp: 1700000000000,
     payload: {
       requestedRole: "preview" | "ide" | "admin",
       capabilities: [...]
     }
   }

5. SERVER VALIDATION (Nucleus)
   ├─ Parse envelope
   ├─ Verify signature
   ├─ Check timestamp (±60s clock skew)
   ├─ Verify nonce (prevent replay)
   ├─ Check capabilities
   ├─ Grant capabilities based on role
   └─ Create ClientInfo + store in wsHub.clients Map

6. SERVER WELCOME RESPONSE
   {
     type: "system.welcome",
     sessionId: "...", (unique server-assigned)
     role: "preview",
     capabilities: ["state", "chat"],
     timestamp: 1700000000001
   }

7. CLIENT READY
   ├─ Store sessionId
   ├─ Begin subscribing to messages if interested
   └─ Ready to send/receive

8. MESSAGE FLOW
   Client → (BusEnvelope) → Server wsHub
   ├─ Rate limit check (token bucket)
   ├─ Nonce check (replay prevention)
   ├─ Route to handler
   └─ Send response

   Server → (BusEnvelope) → Client
   ├─ globalBus.publish() → all subscribers
   ├─ Response to specific traceId
   └─ Browser receives + processes

9. DISCONNECT
   ws.close() | (timeout after 60s idle)
   ├─ Server removes ClientInfo from wsHub.clients
   ├─ Clean up nonce cache
   └─ Rate limit tokens discarded

Security Layers:
  ✓ Token verification (signature)
  ✓ Clock skew protection (±60s window)
  ✓ Replay attack prevention (nonce tracking)
  ✓ Rate limiting (120 msgs / 10s burst)
  ✓ Capability-based access control
  ✓ Payload size limit (256KB)
```

---

## 4. OPERATOR EXECUTION TIMELINE

```
Timeline (Sequential):
════════════════════════════════════════════════════════

T+0ms
  IDE renders OperatorTrigger
  User fills form: operatorId="patch", args={"code":"..."}

T+10ms
  User clicks Execute
  IDE POST /operator/event (Nucleus)

T+15ms
  Nucleus receives POST
  Validates envelope
  Prepares HTTP bridge call → Sidecar

T+20ms
  Nucleus POST /brain/operator/execute
  Sidecar receives
  Loads PatchOperator class

T+25ms
  PatchOperator.__init__()
  Build system prompt:
    "Generate a patch for code: {...}"
  Build messages array

T+30ms
  Call OPENAI_CLIENT.chat.completions.create()
  ├─ model: "gpt-4-turbo"
  ├─ temperature: 0.3
  ├─ max_tokens: 2000
  └─ Stream: false

T+500-2000ms (LLM WAIT)
  OpenAI processes
  Returns JSON with patch

T+2000ms
  Sidecar receives LLM response
  Parse JSON + validate schema
  Extract outputs: { patch_code: "..." }

T+2010ms
  Store in BrainMemoryService
  ├─ fact: [operator_result_<id> → JSON]
  ├─ TTL: 3600s (1 hour)
  └─ Summary: "Generated patch with context"

T+2015ms
  Return OperatorExecuteResponse
  HTTP 200 OK → Nucleus

T+2020ms
  Nucleus receives response
  Emit: globalBus.publish("operator.executed", {...})

T+2025ms
  IDE (OperatorResultsPanel) subscriber is notified
  Results panel updates with outputs
  User sees patch code

TOTAL LATENCY: 2000-2100ms (dominated by LLM)
```

---

## 5. MEMORY CRUD OPERATION FLOW

```
Memory Service Request Chain:
════════════════════════════════════════════════════════

FACT CREATION:
═════════════

IDE (MemoryPanel)
  │
  └─→ POST http://localhost:8001/brain/memory/fact
      {
        "key": "test_fact_001",
        "value": { "data": "something", "tags": ["important"] },
        "ttl_ms": 3600000  (1 hour)
      }
  │
  └─→ [Sidecar] routes_memory.create_fact()
      │
      ├─ Validate input (Pydantic)
      ├─ Generate unique ID
      ├─ Call BrainMemoryService.store_fact(...)
      │
      └─→ [In Memory] BrainMemoryService.facts dict
          ├─ Store: facts["test_fact_001"] = {
          │    value: {...},
          │    created_at: nowMs(),
          │    expire_at: nowMs() + 3600000
          │  }
          │
          └─ Return: FactResponse { key, value, ttl_ms, created_at }

FACT RETRIEVAL:
═════════════

IDE (MemoryPanel)
  │
  └─→ GET http://localhost:8001/brain/memory/fact/test_fact_001
  │
  └─→ [Sidecar] routes_memory.get_fact("test_fact_001")
      │
      ├─ Check if exists in facts dict
      ├─ Check if expired (if expire_at < nowMs())
      │   ├─ YES: delete + return 404
      │   └─ NO: return FactResponse
      │
      └─→ Response: { key, value, ttl_ms, created_at }

AUTO CLEANUP:
═════════════

Background task (runs every 60s):
  │
  └─→ BrainMemoryService.cleanup_expired()
      ├─ Now = current timestamp
      ├─ For each fact:
      │   ├─ If expire_at ≤ Now:
      │   │   ├─ Delete from facts dict
      │   │   └─ Log: "Expired fact: {key}"
      │   └─ Else: keep
      │
      └─ Statistics:
         └─ Return { deleted_count, remaining_count }

MANUAL CLEANUP:
═══════════════

IDE (Admin Console or background task)
  │
  └─→ POST http://localhost:8001/brain/memory/cleanup
  │
  └─→ [Sidecar] routes_memory.cleanup()
      ├─ Call BrainMemoryService.cleanup_expired()
      └─ Return response with stats

In-Memory Representation (Python):
────────────────────────────────

class BrainMemoryService:
  facts: dict = {
    "key1": {
      value: {...},
      created_at: 1700000000000,
      expire_at: 1700003600000  (= created + ttl)
    },
    ...
  }

  vectors: dict = {...}  # embeddings
  summaries: dict = {...}  # aggregate summaries
```

---

## 6. IFRAME INTEGRATION TOPOLOGY

```
IDE Window (Nucleus Origin)
════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────┐
│  apps/ide-web (port 5173)                               │
│  ├─ WorldRouter.tsx                                     │
│  │  └─ Route: /app/:appId/*                            │
│  │     └─ IFrameAppPage.tsx                            │
│  │        │                                             │
│  │        ├─ <iframe id="app-frame"                    │
│  │        │   src="http://localhost:5174?appId=dash"   │
│  │        └─ postMessage listener                       │
│  │           └─ Relay (envelope) → parent context      │
│  │                                                      │
│  └─ window.addEventListener("message", (evt) => {     │
│       if (evt.source === iframe.contentWindow) {        │
│         busClient.request(evt.data);                   │
│       }                                                  │
│     })                                                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
      ▲
      │ postMessage(
      │   EnvelopeMessage
      │ )
      │
      ▼
┌─────────────────────────────────────────────────────────┐
│  iframe Content Window (Preview Runtime Origin)         │
│  (port 5174)                                            │
│  ├─ apps/preview-runtime/src/main.ts                   │
│  │                                                      │
│  ├─ window.parent.postMessage(                         │
│  │   BusEnvelope,                                      │
│  │   "http://localhost:5173"  (parent origin)          │
│  │ )                                                    │
│  │                                                      │
│  └─ ws://localhost:3000 (WebSocket to Nucleus)         │
│     └─ state updates                                    │
│                                                         │
└─────────────────────────────────────────────────────────┘

Data Flow:
═════════

1. IDE loads iFrame with param: src="...?appId=math-viz"
2. Preview runtime initializes
3. Preview connects to Nucleus WS: ws://localhost:3000
4. Preview sends: system.hello { role: "preview", ... }
5. Nucleus sends: system.welcome { sessionId, ... }
6. Preview subscribes to: world.state.update events
7. Preview receives updates → render canvas
8. User interaction in iFrame (e.g., click) → postMessage to parent
9. Parent IDE processes message (could trigger operator, etc.)
10. IDE sends response back via postMessage
11. Preview receives → updates local state

Security:
═════════
✓ Same-origin postMessage policy enforced
✓ Only messages from trusted preview origin accepted
✓ BusEnvelope validation on receive
✓ CORS disabled (same machine for now)
```

---

## 7. MESSAGE TYPE HIERARCHY

```
BusEnvelope (Container)
├── type: string (e.g., "operator.execute")
├── version: integer (1, 2, ...)
├── sessionId: string
├── instanceId: string
├── traceId: string (UUID for causality tracking)
├── source: string (app origin)
├── timestamp: number (ms since epoch)
└── payload: (message-specific)

Payload Types:
│
├─── system.*
│    ├── system.hello { requestedRole, token, nonce, ... }
│    ├── system.welcome { sessionId, role, capabilities, ... }
│    └── system.error { code, message }
│
├─── operator.*
│    ├── operator.execute { operatorId, args, sessionId, ... }
│    ├── operator.executed { operatorId, outputs, audit, ... }
│    ├── operator.validating { ... }
│    └── operator.error { operatorId, error, ... }
│
├─── memory.*
│    ├── memory.fact.created { key, value, ttl, ... }
│    ├── memory.fact.updated { key, value, ... }
│    ├── memory.fact.deleted { key, ... }
│    ├── memory.vector.stored { id, embedding, ... }
│    └── memory.summary.created { id, summary, ... }
│
├─── brain.*
│    ├── brain.chat { message, mode, context, ... }
│    ├── brain.chat.response { thoughts, response, tools, ... }
│    └── brain.control { command, args, ... }
│
├─── state.*
│    ├── state.changed { entity_id, delta, ... }
│    └── world.state.update { entities, timestamp, ... }
│
└─── [others per domain]
     ├── lexicon.* (entry management)
     ├── collision.* (physics events)
     └── cli.* (IDE command execution)
```

---

## 8. IMPORT DEPENDENCY GRAPH (Top-Level Packages)

```
packages/protocol/src/index.ts
  │ (exports all schema + type definitions)
  │
  ├─→ packages/engine/src/index.ts
  │   ├─ Uses protocol types for state
  │   ├─ PredictionEngine (reconciliation)
  │   └─ Collision (SAT algorithm)
  │
  ├─→ packages/bus/src/index.ts
  │   ├─ Uses BusEnvelope type from protocol
  │   ├─ publish<T>(topic, message, envelope?)
  │   └─ globalBus singleton
  │
  ├─→ packages/lexicon/src/index.ts
  │   ├─ Uses protocol types
  │   ├─ LexiconClient (query/resolve)
  │   └─ Leximorph (entity transformation)
  │
  ├─→ packages/brain/src/index.ts
  │   ├─ Uses bus.subscribe() for hooks
  │   ├─ OperatorTrigger (React component)
  │   ├─ MemoryPanel (React component)
  │   └─ useOperator, useMemory hooks
  │
  ├─→ packages/contracts/ts/index.ts (AUTO-GENERATED)
  │   ├─ From OpenAPI (sidecar)
  │   ├─ autonomyClient
  │   └─ TS types for REST calls
  │
  └─→ All apps (nucleus, ide-web, preview-runtime)
      ├─ Import types from protocol
      ├─ Use globalBus from bus
      ├─ Call components from brain
      └─ Use client from contracts/ts
```

---

## 9. RATE LIMITING & SECURITY GATES (Per Connection)

```
ClientInfo State Machine (wsHub.ts):
════════════════════════════════════════════════════════

┌─────────────────────────────────────┐
│  NEW CONNECTION                     │
│                                     │
│  nonceSeen = Map<string, expireAt>  │
│  rlTokens = 120.0                   │
│  rlLastRefillMs = nowMs()           │
│                                     │
└──────────────┬──────────────────────┘
               │
               ▼ (Client sends: system.hello)

┌─────────────────────────────────────┐
│  HANDSHAKE VALIDATION               │
│                                     │
│  1. Parse JSON                      │
│  2. Verify signature                │
│  3. Check timestamp (clock skew)    │
│  4. Verify nonce (new + not seen)   │
│  5. Consume token from bucket       │
│  │                                  │
│  └─→ If ALL PASS:                   │
│      ├─ Send system.welcome         │
│      ├─ Grant capabilities          │
│      └─ Move to AUTHENTICATED       │
│                                     │
│  └─→ If ANY FAIL:                   │
│      ├─ Send system.error           │
│      └─ Close connection            │
│                                     │
└──────────────┬──────────────────────┘
               │
               ▼ (In AUTHENTICATED state)

┌─────────────────────────────────────┐
│  PER-MESSAGE RATE LIMITING          │
│                                     │
│  1. Check: refillRateLimit()        │
│     ├─ Δt = nowMs() - rlLastRefillMs │
│     ├─ rlTokens += Δt * (12/1000)    │  (12 per second)
│     ├─ rlTokens = min(rlTokens, 120) │
│     └─ rlLastRefillMs = newNow       │
│                                     │
│  2. Check: consumeToken()           │
│     ├─ If rlTokens < 1:             │
│     │   └─ REJECT (rate limit)      │
│     └─ Else: rlTokens -= 1, ALLOW   │
│                                     │
│  3. Check: verifyNonce()            │
│     ├─ If nonce in nonceSeen:       │
│     │   └─ REJECT (replay attack)   │
│     ├─ Else: nonceSeen.set(nonce)   │
│     │   └─ Expiry = nowMs() + 60s   │
│     └─ ALLOW                        │
│                                     │
│  4. Route message to handler        │
│                                     │
└──────────────────────────────────────┘

Rate Limit Algorithm (Token Bucket):
──────────────────────────────────────

Capacity: 120 tokens
Refill Rate: 12 tokens/second (= 120 per 10s)
Burst Allowed: Up to 120 messages at once
Sustained Rate: ~12 msg/sec long-term

Example Timeline:
  t=0s: rlTokens = 120 (full)
        Send 50 msgs → rlTokens = 70

  t=5s: rlTokens = 70 + (5 * 12) = 130 → capped to 120

  t=15s: rlTokens = 120 (refilled to cap)
```

---

## 10. COMPLETE PACKAGE DEPENDENCY CASCADE

```
Level 0: Protocol (Contracts)
═════════════════════════════
packages/protocol/src/
  ├─ schemas.ts (Zod)
  ├─ types.ts
  ├─ envelopes/
  │  ├─ BusEnvelope
  │  ├─ EnvelopeSchema
  │  └─ MessageMap
  ├─ operator.ts (Zod)
  ├─ chat.ts
  └─ index.ts (PUBLIC API)

         ↓ (imports)

Level 1: Core Packages
═════════════════════
┌──────────────────┬──────────────┬──────────────┬──────────────┐
│ packages/bus     │ packages/    │ packages/    │ packages/    │
│ (pub/sub layer)  │ engine       │ lexicon      │ contracts/ts │
│                  │ (simulation) │ (language)   │ (REST client)│
├──────────────────┼──────────────┼──────────────┼──────────────┤
│ • publish()      │ • Collision  │ • Leximorph  │ • autonomy   │
│ • subscribe()    │ • Prediction │ • Artifacts  │   Client     │
│ • request()      │ • Runtime    │ • LexiconCli │ • Models     │
│ • globalBus      │   helpers    │   ent        │               │
└──────────────────┴──────────────┴──────────────┴──────────────┘

         ↓ (imports)

Level 2: Feature Packages
════════════════════════
packages/brain/
  ├─ React Hooks (useOperator, useMemory)
  ├─ Components (OperatorTrigger, MemoryPanel)
  ├─ Thought pipeline
  └─ Memory client

packages/math/, packages/graphics/, packages/assets/

         ↓ (imports)

Level 3: Applications
═════════════════════
┌────────────────────┬──────────────────────┬──────────────────┐
│ apps/nucleus       │ apps/ide-web         │ apps/preview-... │
│ (Node.js Server)   │ (React SPA)          │ (Canvas runtime) │
├────────────────────┼──────────────────────┼──────────────────┤
│ • wsHub.ts         │ • WorldRouter.tsx    │ • main.ts        │
│ • router/uee.ts    │ • LabBrainPage.tsx   │ • PredictionEng │
│ • routes/*         │ • MemoryPanel.tsx    │ • Canvas render │
│ • handlers/*       │ • OperatorTrigger    │ • WS connect    │
│ • chat-handler.ts  │ • IFrameAppPage.tsx  │                 │
└────────────────────┴──────────────────────┴──────────────────┘

Plus:
────

apps/py-sidecar/
  ├─ routes_operator.py (FastAPI)
  ├─ operators.py (LLM integrations)
  ├─ memory.py (BrainMemoryService)
  └─ routes_memory.py

Connectivity:
═════════════
nucleus ←→ (HTTP bridge) ←→ py-sidecar
nucleus ←→ (WS pub/sub) ←→ ide-web + preview-runtime
ide-web ←→ (postMessage) ←→ (iframe) preview-runtime
ide-web ←→ (HTTP REST) ←→ py-sidecar (/brain/memory/*)
```

---

## 11. HANDLER DISPATCH LOGIC

```
Message arrives at Nucleus wsHub:
═════════════════════════════════

ws.on("message", async (rawData) => {

  // Step 1: Parse
  const parsed = safeJsonParse(rawData);
  const e = EnvelopeSchema.parse(parsed);  // Zod validation

  // Step 2: Security
  const now = nowMs();
  refillRateLimit(client, now);
  if (!consumeToken(client)) {
    send(client.ws, errorEnvelope("rate_limit_exceeded"));
    return;
  }

  // Step 3: Routing
  const router = getUEERouter();  // Global UEERouter instance
  const ueePayload = e.payload;   // UnifiedEngineEnvelope or BusEnvelope

  // Step 4: Dispatch by task type
  try {
    const response = await router.route(
      ueePayload,
      client.sessionId
    );

    // router.route() → UEERouter.route()
    //   ├─ Get taskType from payload
    //   ├─ Look up handler: handlers[taskType]
    //   ├─ Call handler(uee, context)
    //   └─ Return UEEHandlerResponse

    // Step 5: Send response
    send(client.ws, responseEnvelope(response));

  } catch (err) {
    send(client.ws, errorEnvelope(err.message));
  }

  // Step 6: Emit to all subscribers
  globalBus.publish("any.message", e);
});

Handler Registry (UEERouter):
═════════════════════════════

class UEERouter {
  handlers = {
    "lexicon_op": handleLexiconOp,
    "hce_run": handleHceRun,
    "scene": handleScene,
    "analyze_sentence": handleAnalyzeSentence,
    "brain_control": handleBrainControl,     // ← Custom
    "brain_train": handleBrainTrain,         // ← Custom
    "ide_fs_read": handleIdeFsRead,
    "ide_cli_run": handleIdeCliRun,
    // ... more
  };

  async route(uee, sessionId) {
    const taskType = getTaskType(uee);
    const handler = this.handlers[taskType];
    if (!handler) throw new Error(`Unknown task type: ${taskType}`);

    const context = {
      taskId: getTaskId(uee),
      taskType,
      mode: "execute",      // or "analyze", "generate"
      sessionId,
      timestamp: nowMs()
    };

    return handler(uee, context);  // → Handler returns typed response
  }
}
```

---

## 12. CLEANUP & RESOURCE LIFECYCLE

```
BrainMemoryService Lifecycle:
═════════════════════════════

┌─────────────────────────────────────┐
│  SERVICE STARTUP                    │
│  (on sidecar app init)              │
│                                     │
│  facts = {}                         │
│  vectors = {}                       │
│  summaries = {}                     │
│                                     │
│  Start background cleanup task      │
│  ├─ Timer: every 60 seconds         │
│  └─ Call: cleanup_expired()         │
│                                     │
└──────────────┬──────────────────────┘
               │
               ├─ CREATE fact
               │  └─ facts[key] = {
               │      value, created_at, expire_at
               │    }
               │
               ├─ READ fact
               │  ├─ Check: expired?
               │  │   ├─ YES: delete + 404
               │  │   └─ NO: return
               │  └─ (no mutations)
               │
               ├─ UPDATE fact
               │  └─ facts[key] = {...} (new expire_at)
               │
               ├─ DELETE fact
               │  └─ del facts[key]
               │
               └─ CLEANUP (background, every 60s)
                  ├─ now = current_timestamp
                  ├─ for key in facts:
                  │   ├─ if expire_at ≤ now:
                  │   │   └─ del facts[key]
                  │   └─ else: keep
                  └─ stats: { deleted, remaining }

Cleanup Algorithm:
──────────────────

def cleanup_expired():
  now = current_time_ms()
  deleted = 0

  keys_to_delete = []
  for key, entry in facts.items():
    if entry['expire_at'] <= now:
      keys_to_delete.append(key)

  for key in keys_to_delete:
    del facts[key]
    deleted += 1

  log(f"Cleanup: removed {deleted} expired facts")
  return {
    "deleted": deleted,
    "remaining": len(facts)
  }

TTL Policy:
───────────
Default: 3600 seconds (1 hour)
Minimum: 60 seconds
Maximum: 86400 seconds (24 hours)
Cleanup Interval: 60 seconds (background task)

Example:
  Store fact at T=1000ms, TTL=3600000ms (1 hour)
  → expire_at = 1000 + 3600000 = 3601000 ms

  At T=3600500ms: cleanup triggers
  → Check: 3601000 ≤ 3600500? NO (not yet)

  At T=3601500ms: cleanup triggers again
  → Check: 3601000 ≤ 3601500? YES
  → Delete fact
  → Log: "Expired fact: <key>"
```

---

## Summary Tables

### Service Port Map

| Service | Port | Protocol    | Type    | Status  |
| ------- | ---- | ----------- | ------- | ------- |
| Nucleus | 3000 | HTTP + WS   | Node.js | ✅ Live |
| IDE Web | 5173 | HTTP        | Vite    | ✅ Live |
| Preview | 5174 | HTTP + WS   | Browser | ✅ Live |
| Sidecar | 8001 | HTTP (REST) | Python  | ✅ Live |

### Key Files by Responsibility

| Responsibility         | File               | Lines | Purpose                             |
| ---------------------- | ------------------ | ----- | ----------------------------------- |
| Operator Event Routing | operatorEvent.ts   | 157   | POST /operator/event handler        |
| WebSocket Hub          | wsHub.ts           | 699   | Session mgmt, message routing       |
| UEE Router             | router/uee.ts      | 386   | Dispatch to handlers by type        |
| Operator Execution     | operators.py       | 576   | 2 LLM-based operators               |
| Memory Service         | memory.py          | 400   | TTL-managed facts/vectors/summaries |
| IDE Brain Lab          | LabBrainPage.tsx   | ~300  | Operator UI + results panel         |
| Brain Package          | packages/brain/src | ~500  | React components + hooks            |

---

**Diagram Confidence**: 🟢 **HIGH** — All flows verified against live code
**Last Updated**: Current Session
**Next Validation**: After any route or handler changes
