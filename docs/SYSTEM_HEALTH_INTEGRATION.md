# System Health Monitoring — Integration Complete ✅

## What Was Just Deployed

A **contract-first system health architecture** with real-time monitoring across all four services:

- **Nucleus** WS hub: Polls sidecar + tracks IDE/Preview presence
- **Python Sidecar**: `/health` endpoint returns service status
- **IDE Web**: React hook consumes health stream and renders status
- **Preview Runtime**: Presence tracked via WS hub connection state

---

## Files Created

### 1. Protocol Contract (`packages/protocol/src/system/health.ts`)

**Purpose**: Single source of truth for health schema.

**Key Types**:
- `ServiceHealth` - individual service status (up/degraded/down/unknown)
- `SystemHealthSnapshot` - deterministic system-wide snapshot with monotonic `seq`
- `SYSTEM_HEALTH_EVENT_TYPE = "system.health"` - bus routing constant

**Validation**: Full Zod schema with strict parsing.

---

### 2. Nucleus Health Poller (`apps/nucleus/src/health/poller.ts`)

**Purpose**: Engine-grade polling that checks real service health, not fake states.

**What it does**:
- **Nucleus itself**: Always `up` (if process running)
- **IDE presence**: Checks `clients` set for "ide" role connections
- **Preview presence**: Checks `clients` set for "preview" role connections
- **Sidecar**: HTTP GET `/health` with timeout + latency tracking

**Frequency**: 1s interval (configurable).

**Output**: Broadcasts `SystemHealthSnapshot` to IDE clients via WS hub.

---

### 3. Sidecar Health Endpoint (`apps/py-sidecar/app/routes/health.py`)

**Purpose**: Lightweight, dependency-free health check.

**Response**:
```json
{
  "ok": true,
  "status": "ok",
  "state": "up",
  "service": "sidecar",
  "version": "dev"  // or $WORLD_ENGINE_SIDECAR_VERSION env var
}
```

**Routing**: Integrated into `apps/py-sidecar/app/main.py` via `include_router(health_router)`.

---

### 4. IDE Health Hook (`apps/ide-web/src/system/useSystemHealth.ts`)

**Purpose**: React hook for consuming health stream.

**Usage**:
```ts
const { last } = useSystemHealth();

// Extract per-service status
const byName = new Map(last?.services.map(s => [s.service, s]) ?? []);
const nucleusState = byName.get("nucleus")?.state;
const sidecarState = byName.get("sidecar")?.state;
```

**Features**:
- Auto-unsubscribe on unmount
- Ignores non-health messages (safe with bus envelope wrapper)
- Returns `lastReceivedAtMs` for staleness detection
- Full TypeScript support for `SystemHealthSnapshot`

---

### 5. Nucleus Hub Adapter (`apps/nucleus/src/health/adapter.ts`)

**Purpose**: Bridge wsHub internals to poller interfaces.

**Adapters**:
- `createHubPresenceAdapter(clientsSet)` → `HubPresence` interface
- `createBusLikeAdapter(broadcastToFn)` → `BusLike` interface

Both adapt existing wsHub structures (no new infrastructure needed).

---

## Integration Points (Already Wired)

### Protocol Export

**File**: `packages/protocol/src/index.ts`

```ts
export * from "./system/health";
```

All health types now available as:
```ts
import { SystemHealthSnapshot, SYSTEM_HEALTH_EVENT_TYPE } from "@world-engine/protocol";
```

---

### Nucleus Init

**File**: `apps/nucleus/src/wsHub.ts`

At the end of `createHub()`:
```ts
const hubPresence = createHubPresenceAdapter(clients);
const busLike = createBusLikeAdapter(broadcastTo);

startHealthPoller({
  bus: busLike,
  hubPresence,
  sessionId: `nucleus.${HUB_INSTANCE_ID}`,
  sidecarBaseUrl: process.env.SIDECAR_URL ?? "http://127.0.0.1:8001",
  intervalMs: 1000,
  nucleusVersion: process.env.npm_package_version
});
```

Poller starts immediately and runs every 1s.

---

### Sidecar Health Route

**File**: `apps/py-sidecar/app/main.py`

```py
from routes.health import router as health_router
app.include_router(health_router)
```

Health endpoint now available at: `http://127.0.0.1:8001/health`

---

## Testing the System

### 1. Verify Sidecar Health Endpoint

```bash
curl http://127.0.0.1:8001/health
```

**Expected Response** (200 OK):
```json
{
  "ok": true,
  "status": "ok",
  "state": "up",
  "service": "sidecar",
  "version": "dev"
}
```

### 2. Launch All Services

```bash
pnpm launch
```

Expect all 4 services to start (Nucleus, IDE Web, Preview, Python Sidecar).

### 3. Connect IDE Web

Open http://localhost:5173 in browser.

The IDE connects to Nucleus WS hub automatically.

### 4. Verify Health Stream (Browser Console)

In IDE browser console:
```js
// Monitor what WS messages arrive
const ws = (window).__NUCLEUS_WS__;
ws.addEventListener("message", (ev) => {
  const data = JSON.parse(ev.data);
  if (data?.type === "system.health") {
    console.log("Health snapshot:", data.payload);
  }
});
```

Should see health updates every ~1 second.

---

## Using Health in Your Status Banner

### Example: Render Service Dots

```tsx
import { useSystemHealth } from "../system/useSystemHealth";

export function StatusBanner() {
  const { last } = useSystemHealth();

  if (!last) return <div>No health data</div>;

  const byName = new Map(last.services.map(s => [s.service, s]) ?? []);

  return (
    <div style={{ display: "flex", gap: "8px" }}>
      <ServiceDot
        service="nucleus"
        state={byName.get("nucleus")?.state ?? "unknown"}
      />
      <ServiceDot
        service="sidecar"
        state={byName.get("sidecar")?.state ?? "unknown"}
      />
      <ServiceDot
        service="preview"
        state={byName.get("preview")?.state ?? "unknown"}
      />
      <ServiceDot
        service="ide"
        state={byName.get("ide")?.state ?? "unknown"}
      />
    </div>
  );
}

function ServiceDot({ service, state }: { service: string; state: string }) {
  const colors = {
    up: "#22c55e",      // green
    degraded: "#eab308", // yellow
    down: "#ef4444",     // red
    unknown: "#737373"   // gray
  };

  return (
    <div title={`${service}: ${state}`}
      style={{
        width: "12px",
        height: "12px",
        borderRadius: "50%",
        backgroundColor: colors[state as keyof typeof colors] || colors.unknown
      }}
    />
  );
}
```

---

## Architecture Notes

### Why These Choices?

1. **Poller in Nucleus, not decentralized**
   - Single source of truth for health
   - No clock skew issues
   - Deterministic sequencing (`seq` counter)

2. **Express sidecar latency**
   - `latencyMs` in each snapshot
   - Helps detect slow services vs unreachable

3. **Hub presence via connection tracking**
   - No extra "ping" messages (saves bandwidth)
   - Instant detection of disconnects
   - Uses existing WS infrastructure

4. **Broadcast to IDE only**
   - Health is UI concern; preview doesn't need it
   - Reduces noise on the bus

5. **Fast (`1000ms` default)**
   - Shows real-time issues
   - Safe to poll sidecar at 1 req/sec
   - Configurable via `intervalMs`

---

## Next Steps (Optional)

### 1. Add Version from Launcher

In `scripts/launch-all.mjs`, set env var when spawning Nucleus:
```js
{
  name: "NUCLEUS",
  env: {
    ...process.env,
    npm_package_version: packageJson.version
  }
  // ...
}
```

This makes `nucleusVersion` appear in health snapshots.

### 2. Add Sidecar Version Tracking

In launcher or CI:
```bash
export WORLD_ENGINE_SIDECAR_VERSION="$(git describe --tags --always)"
pnpm launch
```

Health endpoint will then return the version.

### 3. Custom Health Checks

Extend `checkSidecarHealth()` in `poller.ts` to call additional endpoints:
```ts
async function checkSidecarHealth(target: string): Promise<ServiceHealth> {
  // existing HTTP check...

  // OPTIONAL: also check /api/ready, /liveness, etc.
  const readyRes = await fetch(`${target}/ready`);
  if (!readyRes.ok) return { service: "sidecar", state: "degraded", ... };
}
```

### 4. Store Health History

Extend the poller to cache snapshots in Nucleus:
```ts
const healthHistory: SystemHealthSnapshot[] = [];

const tick = async () => {
  const snapshot = /* ... */;
  healthHistory.push(snapshot);
  if (healthHistory.length > 60) healthHistory.shift(); // keep 60
  // ...
};
```

Then expose `GET /api/health/history` for IDE diagnostics.

---

## Troubleshooting

### Health messages not arriving in IDE?

1. Check browser console for `Error: No WebSocket instance available`
   - Means `window.__NUCLEUS_WS__` is not set
   - Update `getWs()` in `useSystemHealth.ts` to match your actual WS instance

2. Check Nucleus logs for health poller startup
   - Should see `[health]` log lines emitted every 1s

3. Verify Sidecar `/health` responds:
   ```bash
   curl -v http://127.0.0.1:8001/health
   ```

### Sidecar showing "down" even though it's running?

1. Check sidecar HTTP port:
   - Default: `http://127.0.0.1:8001`
   - Might be different in your env; set `SIDECAR_URL` env var

2. Check `/health` route is imported in `main.py` ✅

3. Check sidecar is actually listening:
   ```bash
   netstat -ant | grep 8001
   ```

### IDE/Preview showing "down" but should be connected?

1. Verify role assignment in `grantCapsForRole()` (wsHub.ts)
   - Must include current role to be counted

2. Check client connects with correct role:
   - IDE sends `requestedRole: "ide"`
   - Preview sends `requestedRole: "preview"`

---

## Summary

✅ **What You Have Now**:

- **Contract**: Type-safe health schema in protocol package
- **Producer**: Nucleus poller checks all services every 1s
- **Transport**: Broadcasts via WS hub to IDE clients
- **Consumer**: React hook for easy subscription + rendering
- **Sidecar**: Lightweight health endpoint (Python)
- **Zero Config**: Works with default ports + existing architecture

**Time to First Health Bar**: ~5 seconds after services start.
