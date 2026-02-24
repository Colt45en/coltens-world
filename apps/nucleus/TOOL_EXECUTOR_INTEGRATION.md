# Nucleus Tool Executor Integration Guide

This document shows how to integrate the `ToolExecutor` into your Nucleus WS server to handle tool execution when chat streams complete.

## Overview

When a chat stream from Brain contains `chat.tool_call.v1` chunks, Nucleus should:

1. **Collect** tool calls during streaming into a `toolCallsByMessageId` map
2. **On `chat.done.v1`**: Execute all collected tools via `ToolExecutor`
3. **Accept `tool.effect.v1`** responses from IDE (for client-side tools like record_screen)

## Integration Points

### 1. Import the ToolExecutor

In your WS server file (e.g., `apps/nucleus/src/wsHub.ts` or similar):

```typescript
import { ToolExecutor } from "./tool/executor";
import type { ToolCall, AnyEnv } from "./tool/types";
```

### 2. Global State

Add to your WS server initialization:

```typescript
// Track tool calls per message ID
const toolCallsByMessageId = new Map<string, ToolCall[]>();

function ensureList<K, V>(m: Map<K, V[]>, k: K): V[] {
  const cur = m.get(k);
  if (cur) return cur;
  const next: any[] = [];
  m.set(k, next);
  return next;
}

// Reference to IDE WS (you may need to track this per session)
let ideWs: WebSocket | null = null;

function broadcastToIde(env: AnyEnv) {
  if (ideWs && ideWs.readyState === ideWs.OPEN) {
    ideWs.send(JSON.stringify(env));
  }
}

// Instantiate tool executor
const tools = new ToolExecutor(broadcastToIde, broadcastToIde, HUB_INSTANCE_ID);
```

### 3. WS Connection Handler

When you receive a WS connection:

```typescript
wss.on("connection", (ws) => {
  let isIde = false;  // detect via role or other means

  ws.on("message", async (raw) => {
    let env: AnyEnv;
    try {
      env = JSON.parse(String(raw));
    } catch {
      return;
    }

    // Detect IDE connection (you likely already know how to do this)
    if (env.from?.role === "ide" || /* your detection */) {
      isIde = true;
      ideWs = ws;
    }

    // IDE returning tool effects
    if (env.type === "tool.effect.v1") {
      tools.handleToolEffectFromIde(env as any);
      return;
    }

    // ... rest of your message handling
  });
});
```

### 4. Brain Stream Chunk Handler

Wherever you forward chunks from Brain to IDE, add this logic:

```typescript
/**
 * Called for each NDJSON chunk from Brain stream.
 * Collects tool calls and executes on chat.done.v1
 */
async function onBrainChunkToIde(chunk: AnyEnv, wsToIde: WebSocket, sessionId: string) {
  // Forward the chunk to IDE
  wsToIde.send(JSON.stringify(chunk));

  const messageId = chunk.messageId ?? chunk.payload?.messageId ?? "unknown";
  const traceId = chunk.traceId ?? "tr-unknown";

  // Collect tool calls during streaming
  if (chunk.type === "chat.tool_call.v1") {
    const list = ensureList(toolCallsByMessageId, messageId);
    const toolCallId = chunk.payload?.toolCallId ?? `tc-${messageId}-${list.length}`;
    list.push({
      toolCallId,
      name: chunk.payload?.name as any,
      args: chunk.payload?.arguments ?? chunk.payload?.args ?? {},
    });
    console.log(`[nucleus] Collected tool call: ${chunk.payload?.name} (id=${toolCallId})`);
    return;
  }

  // When stream ends, execute all tools
  if (chunk.type === "chat.done.v1") {
    const calls = toolCallsByMessageId.get(messageId) ?? [];
    toolCallsByMessageId.delete(messageId);

    if (calls.length > 0) {
      console.log(`[nucleus] Executing ${calls.length} tools for message ${messageId}`);

      // Execute sequentially so output is deterministic
      for (const call of calls) {
        await tools.execute(traceId, sessionId, call);
      }

      // Optional: signal to IDE that tool phase is complete
      wsToIde.send(
        JSON.stringify({
          v: 2,
          type: "tool.batch.done.v1",
          traceId,
          sessionId,
          messageId,
          payload: { count: calls.length },
        }),
      );
    }
  }
}
```

### 5. In Your Streaming Handler

In `apps/nucleus/src/routes/chat.ts`, inside the `while (reader.read())` loop:

```typescript
// Existing code:
// const brainRes = await fetch(...);
// for await (const chunk of readNdjsonStream(brainRes.body)) {

// ADD THIS:
await onBrainChunkToIde(chunk, ws, sessionId);

// Then your existing: send(ws, { v: 2, type: chunk.type, ... });
```

Or if you prefer a single place to wire:

```typescript
for await (const chunk of readNdjsonStream(brainRes.body)) {
  if (!chunk || typeof chunk !== "object") continue;

  // Handle chat streaming + tool execution
  await onBrainChunkToIde(chunk, ws, sessionId);

  // Forward to IDE
  send(ws, {
    v: 2,
    type: chunk.type ?? "chat.delta.v1",
    id: randomId("srv"),
    ts: nowMs(),
    from: { role: "nucleus", instanceId: HUB_INSTANCE_ID },
    sessionId,
    traceId: chunk.traceId ?? traceId,
    messageId: chunk.messageId ?? messageId,
    payload: chunk.payload ?? {},
  });
}
```

## Environment Variables

The ToolExecutor uses these env vars (with defaults):

```bash
# Sidecar/Brain endpoint for query_lexicon
LEXICON_ENDPOINT=http://127.0.0.1:8001

# BRAIN_ENDPOINT (if you moved it)
BRAIN_ENDPOINT=http://localhost:8001
```

Set in your `.env` or shell:

```bash
export LEXICON_ENDPOINT=http://127.0.0.1:8001
```

## Testing

Once integrated:

1. **Start Brain + Lexicon service:**

   ```bash
   cd apps/py-sidecar
   python app/brain.py
   ```

2. **Start Nucleus + IDE dev servers** (already running)

3. **Send a chat prompt that triggers tools:**

   ```
   "Look up entropy in the lexicon and then record my screen for 5 seconds."
   ```

4. **Observe:**
   - Streamed chat text (chat.delta.v1)
   - Tool calls queued (chat.tool_call.v1 → internal tool.command.v1)
   - `query_lexicon` executes server-side → lexicon results returned via tool.effect.v1
   - `record_screen` command sent to IDE → IDE starts recording → result returned via tool.effect.v1

## What Happens Next

Once tools are executing, the flow is:

1. Brain emits `chat.tool_call.v1` for `query_lexicon` and `record_screen`
2. Nucleus collects them into a list
3. On `chat.done.v1`:
   - `query_lexicon` → ToolExecutor calls Python API → emits tool.effect.v1 to IDE
   - `record_screen` → ToolExecutor sends tool.command.v1 to IDE → waits for tool.effect.v1 response with recording metadata
4. IDE receives tool.effect.v1 results and displays them

---

## Advanced: Add More Tools

To add a new server-side tool (e.g., `memory.query`):

1. Add Python endpoint in Brain/sidecar
2. Add case in `ToolExecutor.execute()`:
   ```typescript
   if (call.name === "memory.query") {
     return await this.execMemoryQuery(traceId, sessionId, call);
   }
   ```
3. Implement `execMemoryQuery()` method (similar to `execQueryLexicon`)

To add a client-side tool (e.g., `chart.render`):

1. Implement in IDE (`apps/ide-web/src/tools/`)
2. Add case in `toolHandler.handleToolCommand()`
3. Same execution pattern

---

Done! The ToolExecutor is now integrated into your streaming chat pipeline.
