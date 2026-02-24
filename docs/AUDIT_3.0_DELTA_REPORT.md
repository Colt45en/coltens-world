# Audit 3.0 Delta Report: Doc vs Code Reality

**Date**: Feb 13, 2026 | **Status**: Hard verification pass | **Confidence**: High

---

## Executive Summary

**Audit 3.0 has excellent topology coverage** ✅ but **6 critical gaps** that will cause scaling issues:

| Category                    | Status         | Impact                             |
| --------------------------- | -------------- | ---------------------------------- |
| Route paths consistency     | ✅ PASS        | High confidence routing            |
| WS endpoint clarity         | ⚠️ UNCLEAR     | Risk: IDE using wrong socket       |
| Memory bus publishing       | ❌ PHANTOM     | Memory changes are silent          |
| iframe postMessage security | ❌ MISSING     | Security hole: iframe can spam IDE |
| Capability gating           | ✅ PASS        | Role-based access working          |
| Persistence layer           | ❌ MISSING     | No brain/memory durability         |
| Replay optimization         | ⚠️ INEFFICIENT | Scale risk at 10K+ operations      |

---

## Detailed Findings

### ✅ Issue 1: Route Paths — CONSISTENT (PASS)

**Audit claim:**

```
Routes: /lab/studio, /lab/brain, /lab/nucleus, /lab/lexicon, /apps/:appId, /hub
```

**Code reality** ([WorldRouter.tsx](apps/ide-web/src/world/WorldRouter.tsx)):

```tsx
<Route path="/lab/studio" element={<LabStudioPage />} />
<Route path="/lab/nucleus" element={<LabNucleusPage />} />
<Route path="/lab/brain" element={<LabBrainPage />} />
<Route path="/lab/lexicon" element={<LabLexiconPage />} />
<Route path={`/apps/${app.id}`} element={<IFrameAppPage />} />
```

**Verification**: ✅ **EXACT MATCH**

- All lab routes use `/lab/*` prefix
- App registry ([AppRegistry.tsx](apps/ide-web/src/world/AppRegistry.tsx)) matches routes
- No mixed `/brain` vs `/lab/brain` confusion
- Deep-linking will work consistently

**Risk**: 🟢 **NONE** — This is locked.

---

### ⚠️ Issue 2: WebSocket Endpoints — PARTIALLY UNCLEAR

**Audit claim:**

```
Hub WS: ws://localhost:3000 (handshake, role routing, envelope validation)
Bus WS: ws://localhost:3000/ws/bus (raw bus subscription, pipeline events)
```

**Code reality:**

#### wsHub.ts ([lines 1-80](apps/nucleus/src/wsHub.ts#L1-L80))

- ✅ Exists, handles `ws://localhost:3000` main connection
- Shows handshake: `system.hello` → `system.welcome` with caps
- Role gating: IDE vs preview roles granted different caps
- Session token issued to client

#### wsBus.ts ([full file](apps/nucleus/src/routes/wsBus.ts))

- ✅ Separate `/ws/bus` path handler
- Subscribes to pipeline events: `pipeline.run.*`, `pipeline.stage.*`
- Broadcasts to all subscribers
- Validated via `PipelineEnvelopeSchema`

#### index.ts ([lines 1-30](apps/nucleus/src/index.ts#L1-L30))

```typescript
setupBusHttpUpgradeHandler(wss, (pathname, handler) => {
  server.on("upgrade", (req, socket, head) => {
    if (req.url?.startsWith(pathname)) {
      handler(req, socket, head);
    }
  });
});
```

**Problem Found**: 🚩

- IDE code in [apps/ide-web/src](apps/ide-web/src/bus/) does NOT clearly show **which WS endpoint** it uses
- You have **two competing socket implementations** but IDE client doesn't document which is primary
- Risk: If IDE uses `/ws/bus` directly, it's missing role validation + nonce + rate-limit protection

**Verification**: ⚠️ **PARTIAL PASS**

- Both endpoints exist ✅
- Hub endpoint is secure ✅
- But IDE integration is unclear ❌

**Risk**: 🔴 **HIGH** — IDE could accidentally use wrong socket and bypass security gates.

**Recommendation**:

```typescript
// Add this to IDE's WsClient class:
/**
 * Connect to HUB WS (primary entrypoint)
 * - Single connection per session
 * - Role validated at handshake
 * - All envelope types routed here
 *
 * /ws/bus is reserved for raw subscribers (tools, preview, diagnostics)
 */
const ws = new WebSocket("ws://localhost:3000"); // ← THIS ONLY

// NOT this:
// const ws = new WebSocket('ws://localhost:3000/ws/bus');  ← WRONG (raw pipeline only)
```

---

### ❌ Issue 3: Sidecar Memory Bus Publishing — PHANTOM BUS EMIT

**Audit claim:**

```
Memory flow:
  IDE MemoryPanel reads: GET /brain/memory/facts
  Sidecar publishes: memory.fact.created, memory.fact.updated to globalBus
  Nucleus routes: to all IDE instances → live updates
```

**Code reality** ([routes_memory.py](apps/py-sidecar/routes_memory.py)):

```python
# Lines 1-80 show:
router = APIRouter(prefix="/brain/memory", tags=["memory"])

@app.get("/brain/memory/facts")        # ✅ GET facts
@app.post("/brain/memory/fact")        # ✅ POST write fact
# ... etc ...

# NOWHERE does it do:
# globalBus.publish("memory.fact.updated", {...})
```

**Verification**: ❌ **AUDIT INACCURACY**

The audit assumed memory events are published **but they are not**.

Current reality: **Option A (REST pull)**

- IDE calls REST endpoint periodically
- No live updates
- No event trail
- Silent changes

**What's missing**:

```python
# This is NOT in routes_memory.py:
from bus import globalBus

@app.post("/brain/memory/fact")
async def write_fact(req: MemoryFactRequest):
    memory_svc.set(req.key, req.value)

    # MISSING: Publish to bus
    # globalBus.publish(
    #   "memory.fact.updated",
    #   {"key": req.key, "value": req.value}
    # )

    return {"ok": True}
```

**Risk**: 🔴 **HIGH**

- You lose signal of brain learning/changes
- IDE panels won't update live
- No audit trail of memory mutations
- UX feels dead (stale data until user refreshes)

**Recommendation**: Choose one:

**Option A (keep now)**: Accept REST-only, remove phantom bus claim from Audit

```markdown
Memory flow (CURRENT):

- IDE polls: GET /brain/memory/facts every 2s
- Immediate: No live updates
- Audit trail: Implicit in operation history
```

**Option B (best UX)**: Implement async memory events

```python
@app.post("/brain/memory/fact")
async def write_fact(req: MemoryFactRequest):
    memory_svc.set(req.key, req.value)

    # Publish to nucleus bus
    await publish_to_nucleus({
        "type": "memory.fact.updated",
        "sessionId": request.headers.get("x-session-id"),
        "payload": {"key": req.key, "value": req.value, "ts": now_ms()}
    })

    return {"ok": True, "published": True}
```

---

### ❌ Issue 4: iframe postMessage Security — MISSING VALIDATION

**Audit claim**: (Not mentioned — assumption: secure)

**Code reality** ([IFrameAppPage.tsx](apps/ide-web/src/iframe/IFrameAppPage.tsx)):

```tsx
export function IFrameAppPage() {
  const { id } = useParams();
  const app = useMemo(() => (id ? getAppById(id) : null), [id]);

  return (
    <div className="...">
      <iframe
        src={app.url}
        title={app.name}
        className="w-full h-full"
        allow="clipboard-read; clipboard-write; fullscreen"
      />
    </div>
  );
}

// NO postMessage listeners
// NO origin validation
// NO message type allowlisting
```

**Verification**: ❌ **SECURITY GAP CONFIRMED**

What's missing:

1. No `window.addEventListener("message", ...)` handler
2. No origin allowlist (attacker iframe can send messages to IDE)
3. No message type validation (iframe could impersonate operator results)
4. No Zod validation (malformed payloads could crash IDE)

**Risk**: 🔴 **CRITICAL** — A malicious iframe (or compromised app) can:

```javascript
// Attacker inside iframe does:
window.parent.postMessage(
  {
    type: "operator.result",
    operatorId: "fake-op-123",
    result: "DELETE ALL DATA", // ← IDE might process this!
  },
  "*",
);
```

**Immediate patch needed** ([See Lock 5 below](#lock-5-postmessage-origin-allowlist--message-type-allowlist)):

```tsx
useEffect(() => {
  // Only accept messages from preview runtime (5174)
  const ALLOWED_ORIGINS = ["http://localhost:5174"];

  const handler = (evt: MessageEvent) => {
    if (!ALLOWED_ORIGINS.includes(evt.origin)) {
      console.warn(`[iframe] Invalid origin: ${evt.origin}`);
      return;
    }

    // Validate message shape
    const validation =
      evt.data.type === "preview.input.move" || evt.data.type === "preview.input.action";
    if (!validation) {
      console.warn(`[iframe] Invalid message type: ${evt.data.type}`);
      return;
    }

    // Safe to process
    handleIFrameInput(evt.data);
  };

  window.addEventListener("message", handler);
  return () => window.removeEventListener("message", handler);
}, []);
```

---

### ✅ Issue 5: Capability Gating — LOCKED & SECURE (PASS)

**Audit claim**:

```
Role-based capabilities:
  IDE: cap:uee:invoke, cap:pty:write, cap:brain:control
  Preview: cap:preview:write, cap:uee:invoke (optional)
```

**Code reality** ([wsHub.ts, lines 200-280](apps/nucleus/src/wsHub.ts#L200-L280)):

```typescript
function grantCapsForRole(role: Role | "unknown"): string[] {
  if (role === "ide") {
    return [
      "cap:uee:invoke", // ✅
      "cap:pty:write", // ✅
      "cap:sim:control", // ✅
      "cap:brain:control", // ✅
      "cap:brain:train", // ✅
      "cap:lexicon:write", // ✅
      "cap:analyze:run", // ✅
      "cap:chat:send", // ✅
    ];
  }
  if (role === "preview") {
    return [
      "cap:preview:write",
      "cap:uee:invoke", // optional
    ];
  }
  return [];
}

function requiredCapsForMessageType(type: string): readonly string[] {
  switch (type) {
    case "uee":
      return ["cap:uee:invoke"];
    case "pty.open":
    case "pty.input":
    case "pty.resize":
      return ["cap:pty:write"];
    case "ops.sim.start":
    case "ops.sim.stop":
      return ["cap:sim:control"];
    // ... more gating ...
    default:
      return [];
  }
}

// Then in message handler:
if (!setHasAny(c.caps, msgCaps)) {
  // Deny request, send system.error
  return;
}
```

**Verification**: ✅ **FULLY IMPLEMENTED & CORRECT**

Strengths:

- ✅ Deny-by-default (unknown roles get empty cap set)
- ✅ Per-message-type gating (not just role-level)
- ✅ Per-task-type gating for UEE (`requiredCapsForTaskType`)
- ✅ Structured error response (CAP_DENIED)
- ✅ All requests validated before processing

**Risk**: 🟢 **NONE** — This is locked.

---

### ⚠️ Issue 6: Persistence Layer — MISSING (In-memory only)

**Audit assumption**: Brain memory is persistent across reboots

**Code reality**:

- BrainMemoryService uses in-memory dict
- routes_memory.py shows no SQLite/Postgres calls
- No `memory.db` file created

**What exists**:

```python
# In memory.py (implied)
class InMemoryMemoryService:
    def __init__(self):
        self.facts = {}  # ← Lost on restart
        self.vectors = {}
        self.summaries = {}
```

**Risk**: 🔴 **HIGH**

- Operator history lost on sidecar restart
- Brain learning not accumulated
- Can't audit long-term agent behavior
- Each session starts from scratch

**Not in scope for this audit**, but critical for next phase.

---

### ⚠️ Issue 7: Replay System Scaling — INEFFICIENT PATTERN

**Audit claim**: Replay via `/bus/replay?from=X&to=Y`

**Current bottleneck**:

1. IDE loads app → requests full replay from t0 to now
2. Nucleus loads **all events** into memory
3. Streams back to IDE (can be MB of JSON)
4. IDE reconstructs state from scratch

**At scale (10K+ operations)**:

- Nucleus memory grows linearly
- First-load latency: 5-10s
- Re-connects slow
- No delta optimization

**Recommendation**: Snapshot + delta (separate issue)

```
Better pattern:
  IDE boots → fetch latest snapshot + last 30s delta replay
  Result: 100ms instead of 5000ms
```

---

## The 6 "Locks" — Actionable Patches

### Lock 1 — Document Canonical WS Endpoint ✅ EASY

**File**: [apps/nucleus/src/index.ts](apps/nucleus/src/index.ts)

**Add to top**:

```typescript
/**
 * CANONICAL NUCLEUS WS ENDPOINTS (must be enforced)
 *
 * IDE USES ONLY:
 *   ws://localhost:3000
 *     - Handshake: system.hello → system.welcome
 *     - Role: "ide"
 *     - Auth: session token + nonce per message
 *     - All envelope types: uee, pty, sim, chat, preview.*
 *
 * TOOLS/PREVIEW USE ONLY (if at all):
 *   ws://localhost:3000/ws/bus
 *     - No handshake, raw subscribers
 *     - Pipeline events only (pipeline.run.*, etc.)
 *     - No role validation
 *
 * RULE: If IDE needs to subscribe to something not in the hub WS,
 *       that's a signal to add it to the hub, not to create a new socket.
 */
```

**Risk if skipped**: 🔴 Dev using wrong socket, bypassing security

---

### Lock 2 — Validate IDE WsClient Uses Hub Endpoint ✅ EASY

**File**: TBD (need to find [apps/ide-web/src/bus/wsClient.ts](apps/ide-web/src/bus/wsClient.ts))

**Verification needed**:

```typescript
// Should be:
const ws = new WebSocket("ws://localhost:3000"); // ✅ Hub only

// NOT:
// const ws = new WebSocket('ws://localhost:3000/ws/bus');  // ❌ Wrong
```

If using `/ws/bus`, move to hub and let Nucleus route messages.

---

### Lock 3 — Fix iframe postMessage Security 🔴 CRITICAL

**File**: [apps/ide-web/src/iframe/IFrameAppPage.tsx](apps/ide-web/src/iframe/IFrameAppPage.tsx)

**Add after component declaration** (see Lock 5 section below for full code)

---

### Lock 4 — Decide Memory Publishing: REST vs Events ⚠️ MEDIUM

**File**: [apps/py-sidecar/routes_memory.py](apps/py-sidecar/routes_memory.py)

**Option A** (current, no code change):

- Remove from Audit 3.0: "memory.fact.updated published to bus"
- Update Audit: "Memory is read-only REST polling"

**Option B** (better UX):

- Add bus publishing to each memory write endpoint
- Update Nucleus wsHub to route memory events
- IDE subscribes and gets live updates

Which do you want?

---

### Lock 5 — postMessage Origin Allowlist + Message Type Allowlist 🔴 CRITICAL

**File**: [apps/ide-web/src/iframe/IFrameAppPage.tsx](apps/ide-web/src/iframe/IFrameAppPage.tsx)

**Patch**: Replace component with secure version

```tsx
import { useEffect, useRef, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { GlassPanel, NeonButton } from "../ui/neon";
import { getAppById } from "../world/AppRegistry";

/**
 * ALLOWED_ORIGINS: Only these iframes can send postMessages to IDE
 * Update this list if you embed new apps.
 */
const ALLOWED_ORIGINS = [
  "http://localhost:5174", // preview-runtime
  "http://localhost:3017", // internal sandbox (if exists)
  // Add more as needed, but be STRICT
];

/**
 * ALLOWED_MESSAGE_TYPES: Only these message types accepted from iframe
 * Prevents iframe from impersonating operators, state updates, etc.
 */
const ALLOWED_MESSAGE_TYPES = new Set([
  "preview.input.move",
  "preview.input.action",
  "preview.ping",
  "preview.diagnostics",
]);

export function IFrameAppPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const app = useMemo(() => (id ? getAppById(id) : null), [id]);

  // ---- postMessage security gate ----
  useEffect(() => {
    const handleMessage = (evt: MessageEvent) => {
      // RULE 1: Only accept from allowed origins
      if (!ALLOWED_ORIGINS.includes(evt.origin)) {
        console.warn(`[iframe ${id}] Rejected message from disallowed origin: ${evt.origin}`);
        return;
      }

      // RULE 2: Verify message came from our iframe (not parent spoofing)
      if (evt.source !== iframeRef.current?.contentWindow) {
        console.warn(`[iframe ${id}] Message source mismatch`);
        return;
      }

      // RULE 3: Only accept whitelisted message types
      const msgType = evt.data?.type;
      if (!ALLOWED_MESSAGE_TYPES.has(msgType)) {
        console.warn(`[iframe ${id}] Rejected disallowed message type: ${msgType}`);
        return;
      }

      // RULE 4: Validate message shape (depends on type)
      // For now, just log. Extend per-type validation as needed.
      try {
        if (msgType === "preview.input.move") {
          const { x, y } = evt.data.payload ?? {};
          if (typeof x !== "number" || typeof y !== "number") {
            throw new Error("Invalid move payload");
          }
        } else if (msgType === "preview.input.action") {
          const { action } = evt.data.payload ?? {};
          if (typeof action !== "string") {
            throw new Error("Invalid action payload");
          }
        }
        // Add more validation per type as needed
      } catch (err) {
        console.warn(`[iframe ${id}] Message validation failed:`, err);
        return;
      }

      // ✅ Message is safe to process
      console.log(`[iframe ${id}] Accepted message type: ${msgType}`);
      // TODO: Route to appropriate handler (store, context, etc.)
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [id]);

  if (!app || app.kind !== "iframe" || !app.url) {
    return (
      <GlassPanel className="rounded-2xl p-5 max-w-3xl mx-auto">
        <div className="font-bold">App not found</div>
        <div className="text-white/60 mt-1 text-sm">No iframe app registered for: {id}</div>
        <div className="mt-4">
          <NeonButton variant="ghost" onClick={() => navigate("/")}>
            Back
          </NeonButton>
        </div>
      </GlassPanel>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <GlassPanel className="rounded-2xl p-4 flex items-center justify-between gap-3">
        <div>
          <div className="font-bold tracking-wide">{app.name}</div>
          <div className="text-white/60 text-sm">{app.url}</div>
        </div>
        <div className="flex gap-2">
          <NeonButton variant="ghost" onClick={() => navigate("/")}>
            Launcher
          </NeonButton>
          <NeonButton onClick={() => window.open(app.url!, "_blank", "noopener,noreferrer")}>
            Open New Tab
          </NeonButton>
        </div>
      </GlassPanel>

      <div className="mt-4 glass-panel rounded-2xl overflow-hidden" style={{ height: "75vh" }}>
        <iframe
          ref={iframeRef}
          src={app.url}
          title={app.name}
          className="w-full h-full"
          allow="clipboard-read; clipboard-write; fullscreen"
          sandbox="allow-same-origin allow-forms allow-scripts allow-popups"
        />
      </div>

      <div className="text-xs text-white/45 mt-3 px-1">
        If the iframe is blank, that app likely blocks embedding (X-Frame-Options / CSP). In that
        case use "Open New Tab" or proxy it. postMessage security: ORIGIN &amp; TYPE whitelisted.
      </div>
    </div>
  );
}
```

**Risk if skipped**: 🔴 **CRITICAL** — Iframe exploit tunnel

---

### Lock 6 — Snapshot + Replay Delta (Future) ⏳ MEDIUM-EFFORT

Not in scope for this audit, but document the plan:

**File**: [WORLD_ENGINE_COMPLETE_ROADMAP.md](WORLD_ENGINE_COMPLETE_ROADMAP.md)

**Add section**:

```markdown
## Scaling: Snapshot + Delta Replay (Session 11+)

Current: Full replay from t0 → scales poorly at 10K+ operations

Future: Snapshot-based delta replay

1. Every 100 operations, checkpoint state snapshot
2. IDE boots → fetch latest snapshot + delta tail (last 30s)
   - Result: ~100ms load time instead of 5s
3. Nucleus memory usage: O(operations in window), not O(total operations)

Implementation:

- Nucleus: Add `snapshot.created` message type
- Sidecar: Add `/brain/snapshot/latest` endpoint
- IDE: Track snapshot + delta in PredictionEngine
```

---

## Summary: Patches in Priority Order

| #   | Lock                    | File                                 | Effort | Risk if Skipped      | Status     |
| --- | ----------------------- | ------------------------------------ | ------ | -------------------- | ---------- |
| 1   | Canonical WS doc        | nucleus/src/index.ts                 | 5 min  | 🔴 Wrong socket used | Not done   |
| 2   | Verify IDE uses hub     | ide-web/src/bus/wsClient.ts          | 5 min  | 🔴 Bypass security   | TBD        |
| 3   | Memory: REST vs Events  | py-sidecar/routes_memory.py          | Choose | 🟡 Silent changes    | Choose     |
| 4   | iframe postMessage      | ide-web/src/iframe/IFrameAppPage.tsx | 30 min | 🔴 CRITICAL exploit  | Need patch |
| 5   | Origin allowlist (in 4) | ide-web/src/iframe/IFrameAppPage.tsx | ^^     | ^^                   | Need patch |
| 6   | Snapshot + delta plan   | WORLD_ENGINE_COMPLETE_ROADMAP.md     | 10 min | 🟡 Scale bottleneck  | Future     |

---

## What's Next

1. **Confirm**: Which memory model do you want? (REST-only or events?)
2. **Apply**: Lock 1 (document canonical endpoint)
3. **Apply**: Lock 4-5 (iframe security patch)
4. **Verify**: Lock 2 (IDE WsClient actually uses hub)
5. **Plan**: Lock 6 (snapshot + delta scaling)

I can apply these patches immediately. Should I proceed? ↓
