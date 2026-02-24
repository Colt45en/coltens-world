# WebSocket Diagnostics & Engine-Grade Connection Guide

## Problem Solved

Before this change, connection failures showed "**Connection failed: undefined**" with no useful debugging info.

Now: **"Connection failed: [close] url=ws://localhost:3000 code=1006 reason="connection reset by peer" clean=false"**

---

## Why This Matters

### The Root Issue

1. **Browser `onerror` has no message** — `new WebSocket().onerror()` passes an Event with no details
2. **Real diagnostics are in `onclose`** — close code + reason come from server
3. **Error stringification was broken** — `"${err}"` on an Error object doesn't guarantee message

### The Fix (3 parts)

#### Part A: Separate `onerror` from `onclose`

- `onerror` now logs `readyState` only (diagnostic event)
- `onclose` provides the **real close code and reason** from server

#### Part B: Format WS diagnostics consistently

```typescript
[CLOSE] url=ws://localhost:3000 code=1006 reason="connection reset by peer" clean=false
```

#### Part C: Safe error serialization in ChatUI

```typescript
const errorMsg = err instanceof Error ? err.message : String(err);
onError?.(`Connection failed: ${errorMsg}`);
```

---

## How to Verify (3 Quick Tests)

### Test 1: Stop Nucleus (simulate server down)

```bash
# In terminal, stop nucleus
Get-Process -Name "node" | Stop-Process -Force

# In browser DevTools console:
const ws = new WebSocket("ws://localhost:3000");
ws.onclose = (e) => console.log(`CLOSE: code=${e.code} reason="${e.reason}"`);
```

**Expected output:**

```
CLOSE: code=1006 reason="connection reset by peer"
```

**NOT:**

```
Connection failed: undefined
```

---

### Test 2: Connect to wrong endpoint (won't fail immediately)

```javascript
const ws = new WebSocket("ws://localhost:3000/wrong/path");
ws.onopen = () => console.log("OPEN (unexpected)");
ws.onclose = (e) => console.log(`CLOSE: code=${e.code} reason="${e.reason || '(none)'}"`);
```

**Expected output after timeout:**

```
CLOSE: code=1006 reason="connection reset by peer"
```

---

### Test 3: Correct root hub connection (should succeed)

```javascript
const ws = new WebSocket("ws://localhost:3000");
ws.onopen = () => console.log("✅ OPEN - Connected to root hub");
ws.onmessage = (e) => console.log("Message:", JSON.parse(e.data).type);
ws.onclose = (e) => console.log(`CLOSE: code=${e.code} reason="${e.reason || '(none)'}"`);
```

**Expected output:**

```
✅ OPEN - Connected to root hub
Message: system.welcome
```

---

## Architecture: WebSocket Connection Flow

```
IDE Browser (chat UI)
    |
    v
new WebSocket("ws://localhost:3000")
    |
    +---> ws.onopen()         -> send system.hello
    |
    +---> ws.onmessage()      -> parse system.welcome
    |                           -> handshakeDone = true
    |
    +---> ws.onerror()        -> log diagnostic (no details yet)
    |
    +---> ws.onclose()        -> **real reason here**
                                -> reject/onError callback
```

---

## Nucleus Side (Optional Server-Side Hardening)

If you want to reject IDE connections to `/ws/bus` with a message:

```typescript
// In apps/nucleus/src/wsHub.ts
if (req.url?.startsWith("/ws/bus") && role === "ide") {
  ws.close(1008, "IDE must connect to ws://localhost:3000 (root), not /ws/bus");
  return;
}
```

Then the IDE will see:

```
CLOSE: code=1008 reason="IDE must connect to ws://localhost:3000 (root), not /ws/bus"
```

---

## Checklist: Hardened WebSocket Client

✅ **Correct URL:** `ws://localhost:3000` (root, no path)
✅ **Separate handlers:** `onerror` logs diagnostic, `onclose` reports real reason
✅ **Safe serialization:** `err instanceof Error ? err.message : String(err)`
✅ **Timeout on handshake:** 5s wait for `system.welcome`
✅ **Diagnostics format:** `[event] url code reason wasClean`

---

## Quick Reference: Copy-Paste Bulletproof Client

```typescript
function connectHubWs() {
  const url = "ws://localhost:3000"; // IMPORTANT: root hub
  const ws = new WebSocket(url);

  ws.onopen = () => {
    console.log(`✅ Connected: ${url}`);
  };

  ws.onerror = () => {
    // Browser provides no details here
    console.log(`⚠️ WS error event (details follow in onclose). readyState=${ws.readyState}`);
  };

  ws.onclose = (ev) => {
    console.log(
      `❌ Closed: code=${ev.code} reason="${ev.reason || "(none)"}" clean=${ev.wasClean}`
    );
  };

  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(String(ev.data));
      console.log("[ws msg]", msg);
    } catch {
      console.log("[ws msg raw]", ev.data);
    }
  };

  return ws;
}
```

---

## Common Error Codes (WebSocket Close)

| Code | Meaning | Fix |
|------|---------|-----|
| 1000 | Normal close | Expected on disconnect |
| 1006 | Abnormal closure | Server crashed or network issue, check Nucleus logs |
| 1008 | Policy violation | Server rejected the request (check reason string) |
| 1011 | Server error | Internal server error, check Nucleus logs |

---

## Files Modified

1. **`apps/ide-web/src/ui/ChatClient.ts`**
   - Added `WsDiagnostic` interface
   - Added `_formatDiagnostic()` method
   - Separated `onerror` from `onclose`
   - Real close diagnostic in `onclose`
   - Timeout on handshake with clear error message

2. **`apps/ide-web/src/ui/ChatUI.tsx`**
   - Safe error serialization in `.catch()` handlers
   - Extract `.message` from Error objects
   - Consistent error message formatting

---

## Next: Optional Nucleus Hardening

Want the server to send close reasons? Add this to `apps/nucleus/src/wsHub.ts`:

```typescript
// Reject IDE clients trying to use /ws/bus path
if (req.url?.startsWith("/ws/bus") && clientRole === "ide") {
  ws.close(1008, "IDE must connect to ws://localhost:3000 root hub, not /ws/bus");
  return;
}
```

This way, any IDE trying the wrong path gets a **1008 Policy Violation** with a clear reason string.

---

## Testing Checklist Before Merge

- [ ] Stop Nucleus and verify IDE shows close code in error
- [ ] Verify IDE connects to root hub (`ws://localhost:3000`)
- [ ] Verify system.hello handshake completes
- [ ] Verify chat sends/receives messages
- [ ] Check browser console for diagnostic logs
- [ ] Verify no "undefined" errors in UI

---

## Verification Command

```bash
# Build and test
pnpm run build
pnpm --filter ./apps/ide-web run dev -- --port 5173

# In VS Code terminal, test:
# 1. Start Nucleus
pnpm --filter ./apps/nucleus run dev

# 2. Open browser DevTools
# 3. Paste diagnostic test from "Test 3" above
# 4. Verify connection succeeds
```

---

## Summary

**Before:** "Connection failed: undefined" ❌
**After:** "Connection failed: [close] code=1006 reason=..." ✅

Engine-grade diagnostics now standard in all WebSocket operations.
