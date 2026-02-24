# Phase 5: Nucleus WS Bus Bridge — Integration Guide

**Status:** Files created ✅ | Integration pending ⏳

---

## 📦 Created Files

### 1. **`apps/nucleus/src/bus/busHub.ts`** (156 lines)

Local in-memory envelope bus with pub/sub.

**Key exports:**

- `LocalEnvelopeBus` class — event emitter + envelope caching + subscriber management
- `globalBus` singleton — shared instance

**Used by:**

- `wsBus.ts` — subscribes to envelopes and broadcasts to WS clients
- `busReplay.ts` — stores for later retrieval

### 2. **`apps/nucleus/src/routes/wsBus.ts`** (78 lines)

WS handler for `/ws/bus` endpoint.

**Key exports:**

- `setupBusHttpUpgradeHandler(wss, onUpgrade)` — register upgrade handler
- `getBusStats()` — connection + bus statistics

**To integrate:**

```typescript
import { setupBusHttpUpgradeHandler } from "./routes/wsBus";

// In index.ts, after creating wss:
const server = http.createServer((req, res) => {
  // ... register upgrade handlers
});

const wss = new WebSocketServer({ server });

// Register /ws/bus handler
setupBusHttpUpgradeHandler(wss, (pathname, handler) => {
  // Simple upgrade handler registration
  if (pathname === "/ws/bus") {
    server.on("upgrade", (req, socket, head) => {
      if (req.url === "/ws/bus") {
        handler(req, socket, head);
      }
    });
  }
});
```

### 3. **`apps/nucleus/src/routes/busReplay.ts`** (89 lines)

HTTP handlers for replay endpoints.

**Key exports:**

- `handleBusReplayRequest(req, res)` — route handler, returns boolean (handled or not)

**Endpoints:**

- `GET /bus/trace/:traceId` — all envelopes for trace
- `GET /bus/trace/:traceId/tail?limit=50` — last N envelopes
- `GET /bus/traces` — list all traceIds
- `GET /bus/stats` — bus statistics
- `DELETE /bus/trace/:traceId` — clear cache

**To integrate:**

```typescript
import { handleBusReplayRequest } from "./routes/busReplay";

// In index.ts, in the HTTP request handler:
const server = http.createServer((req, res) => {
  // Try bus replay routes first
  if (handleBusReplayRequest(req, res)) return;

  // Fall through to other routes
  res.writeHead(200, { "content-type": "text/plain" });
  res.end("world-engine nucleus ok\n");
});
```

### 4. **`apps/ide-web/src/bus/wsBusClient.ts`** (214 lines)

IDE-side WS client for subscribing to pipeline events.

**Key class:**

- `WsBusClient` — auto-reconnect, local caching, type-safe handlers

**Usage:**

```typescript
import { WsBusClient } from "../bus/wsBusClient";

const busClient = new WsBusClient(
  { url: "ws://localhost:3000/ws/bus" },
  {
    onConnect: () => console.log("Connected to bus"),
    onPipelineStageCompleted: (env) => {
      console.log(`Stage ${env.data.stage} took ${env.data.ms}ms`);
    },
    onError: (err) => console.error("Bus error:", err),
  },
);

await busClient.connect();
```

---

## 🔌 Integration Steps

### Step 1: Wire WS Bus into Nucleus

**File:** `apps/nucleus/src/index.ts`

**Current:**

```typescript
import http from "node:http";
import { WebSocketServer } from "ws";
import { createHub } from "./wsHub";

const server = http.createServer(/* ... */);
const wss = new WebSocketServer({ server });
createHub(wss);
```

**New:**

```typescript
import http from "node:http";
import { WebSocketServer } from "ws";
import { createHub } from "./wsHub";
import { handleBusReplayRequest } from "./routes/busReplay";
import { setupBusHttpUpgradeHandler } from "./routes/wsBus";

const server = http.createServer((req, res) => {
  // Try bus replay routes
  if (handleBusReplayRequest(req, res)) return;

  // Default response
  res.writeHead(200, { "content-type": "text/plain" });
  res.end("world-engine nucleus ok\n");
});

const wss = new WebSocketServer({ server });
createHub(wss);

// Register bus WS handler for /ws/bus
setupBusHttpUpgradeHandler(wss, (pathname, handler) => {
  server.on("upgrade", (req, socket, head) => {
    if (new URL(req.url, "http://localhost").pathname === pathname) {
      handler(req, socket, head);
    }
  });
});

server.listen(3000, () => {
  console.log("[nucleus] listening http/ws on :3000 (+ /ws/bus + /bus/*)");
});
```

### Step 2: Publish Envelopes from Pipeline Runner

**When pipeline runner emits envelopes**, they need to reach `globalBus`.

**File:** `tooling/unified-pipeline-runner.bus.mjs`

**Current:** Emits to local `EnvelopeBus`

**New:** Route to globalBus

```javascript
import { globalBus } from "path/to/apps/nucleus/src/bus/busHub.js";

// When route to Nucleus is available:
const pipelineEnv = env(...);
globalBus.publish(pipelineEnv);
```

Or (better): Have IDE send pipeline input via WS to Nucleus → route to runner → emit to globalBus.

### Step 3: Subscribe in IDE

**File:** `apps/ide-web/src/WorldEngineStudio.tsx`

**Example:**

```typescript
import React, { useEffect, useState } from "react";
import { WsBusClient } from "./bus/wsBusClient";

export function PipelineTimeline() {
  const [events, setEvents] = useState([]);
  const [busClient] = useState(
    () =>
      new WsBusClient(
        { url: `ws://${window.location.host}/ws/bus` },
        {
          onPipelineStageCompleted: (env) => {
            setEvents((prev) => [...prev, env]);
          },
          onError: (err) => console.error("Bus:", err),
        }
      )
  );

  useEffect(() => {
    busClient.connect();
    return () => busClient.disconnect();
  }, [busClient]);

  return (
    <div className="timeline">
      <h2>Pipeline Events</h2>
      {events.map((ev) => (
        <div key={ev.id} className="event">
          {ev.data.stage}: {ev.data.ms}ms
        </div>
      ))}
    </div>
  );
}
```

---

## 🧪 Testing

### 1. Start Nucleus

```bash
cd apps/nucleus
pnpm dev
# Should see: "[nucleus] listening http/ws on :3000 (+ /ws/bus + /bus/*)"
```

### 2. Test Bus Stats

```bash
curl http://localhost:3000/bus/stats
# Output: { "ok": true, "activeTraces": 0, "totalEnvelopes": 0, ... }
```

### 3. Connect WS Client

```bash
# In browser console:
ws = new WebSocket("ws://localhost:3000/ws/bus");
ws.onmessage = (ev) => console.log("Envelope:", JSON.parse(ev.data));
# Should see pipeline envelopes as they're published
```

### 4. Publish a Test Envelope

```bash
# In Node/Deno REPL:
const { globalBus } = require("./apps/nucleus/src/bus/busHub");
const env = {
  v: 1,
  id: "test_123",
  ts: new Date().toISOString(),
  type: "pipeline.stage.completed",
  source: "test",
  traceId: "trace_test",
  spanId: "span_test",
  severity: "info",
  data: { runId: "run_test", stage: "prose.decompose", ok: true, ms: 5 }
};
globalBus.publish(env);
# Browser console should print it
```

---

## 📊 Bus Architecture

```
┌────────────────────┐
│ Unified Pipeline   │
│     Runner         │
└──────────┬─────────┘
           │
           │ publishes envelope
           ▼
┌────────────────────────┐
│   globalBus            │──────► cached by traceId
│ (EventEmitter)         │
└──────────┬─────────────┘
           │
    ┌──────┴──────┐
    │             │
    ▼             ▼
  ┌─────┐      ┌──────────┐
  │ IDE │      │ Debugger │
  │ WS  │      │ HTTP GET │
  └─────┘      └──────────┘
   ws://          /bus/trace/:traceId
   /ws/bus
```

---

## 🎯 Next Steps

1. **Integrate into index.ts** ← do this first
2. **Wire unified runner to globalBus** ← send envelopes through
3. **Build UI timeline component** ← visualize events in real-time
4. **Add persistence** ← save envelopes to DB after session
5. **Production hardening** — rate limiting, auth, tls

---

## 📝 Files Changed

- ✅ `apps/nucleus/src/bus/busHub.ts` — new
- ✅ `apps/nucleus/src/routes/wsBus.ts` — new
- ✅ `apps/nucleus/src/routes/busReplay.ts` — new (refactored from Fastify)
- ✅ `apps/ide-web/src/bus/wsBusClient.ts` — new
- ✅ `apps/nucleus/src/routes/routes.ts` — updated (removed Fastify references)

---

## 🚀 Ready to Integrate?

Run this to verify all files compile:

```bash
pnpm run type-check
```

Then update `index.ts` as shown above ↑

Let me know when you're ready for Step 2!
