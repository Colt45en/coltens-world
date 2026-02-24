# Brain Chat Integration Guide

**Status**: ✅ Complete
**Implemented**: Session 10 (2026-02-13)
**Components**: Protocol + Nucleus wsHub + chatHandler + IDE WsClient

---

## What Was Integrated

A **streamed, agentic chat system** that:

- ✅ Sends `brain.chat` requests from IDE → Nucleus
- ✅ Nucleus routes through existing security gates (auth, nonce, rate limit, caps)
- ✅ chatHandler processes request and streams deltas back via `brain.chat.delta`
- ✅ Operator dispatch: "patch:" prefix routes to PatchOperator
- ✅ IDE binds stream chunks by `traceId` for UI updates
- ✅ Audit trail: latency, operator result, tool usage

---

## Architecture

```
IDE Chat Panel
    ↓ (brain.chat request + traceId)
WsHub (session gate + cap gate)
    ↓
chatHandler.handleBrainChat()
    ├─ Emit brain.chat.delta (🧠 startup)
    ├─ Detect intent ("patch:" prefix)
    ├─ Route to /operator/event if needed
    ├─ Emit brain.chat.delta (intermediate)
    └─ Emit brain.chat.done (final + audit)
    ↑
IDE Chat Panel (bind by traceId, accumulate deltas)
```

---

## 1. Using brain.chat from IDE (Chat Panel)

### Basic Usage

```typescript
// In any lab page that has access to wsClient:

import { v4 as uuidv4 } from "uuid";

const traceId = "trace_" + uuidv4().slice(0, 8);

// Send brain.chat request
wsClient.send("brain.chat", {
  traceId,
  message: "patch: add a banner to the IDE layout",
  mode: "assistant",
  context: {
    currentRoute: window.location.pathname,
    selectedFiles: ["src/layout/NeonNexusLayout.tsx"],
    openPanels: ["brain", "studio"],
  },
});
```

### Receiving Streamed Response

Set up handlers when creating the WsClient:

```typescript
const wsClient = new WsClient("ws://localhost:3000", {
  onWelcome: (env) => {
    /* ... */
  },
  onBrainChatDelta: (env) => {
    const { traceId, seq, deltaText } = env.payload;
    // Accumulate deltaText to build response
    console.log(`[${traceId}:${seq}] ${deltaText}`);
    // Update UI in real-time
  },
  onBrainChatDone: (env) => {
    const { traceId, finalText, toolsUsed, audit } = env.payload;
    console.log(`Completed in ${audit.latency_ms}ms`);
    console.log(`Tools: ${toolsUsed.join(", ")}`);
    console.log(`Final:\n${finalText}`);
    // Show final result in panel
  },
  onBrainChatError: (env) => {
    const { traceId, code, message } = env.payload;
    console.error(`[${traceId}] ${code}: ${message}`);
    // Show error UI
  },
});
```

---

## 2. Chat UI Component Pattern

```typescript
// e.g., apps/ide-web/src/panels/BrainChatPanel.tsx

import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { useBusClient } from "../bus/BusClientContext";

export function BrainChatPanel() {
  const wsClient = useBusClient();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Array<{
    traceId: string;
    role: "user" | "assistant";
    text: string;
    latency_ms?: number;
  }>>([]);

  const handleSend = (message: string, mode: "assistant" | "operator" = "assistant") => {
    if (!message.trim()) return;

    const traceId = "trace_" + uuidv4().slice(0, 8);

    // Add user message immediately
    setMessages(prev => [...prev, {
      traceId,
      role: "user" as const,
      text: message,
    }]);

    // Send to nucleus
    wsClient.send("brain.chat", {
      traceId,
      message,
      mode,
      context: {
        currentRoute: window.location.pathname,
      },
    });

    setInput("");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.traceId}
            className={`rounded-lg p-3 ${
              msg.role === "user"
                ? "bg-blue-600/20 text-white ml-8"
                : "bg-green-600/20 text-green-100 mr-8"
            }`}
          >
            <div className="text-sm whitespace-pre-wrap">{msg.text}</div>
            {msg.latency_ms && (
              <div className="text-xs text-white/50 mt-1">
                ({msg.latency_ms}ms)
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-white/20">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend(input);
            }
          }}
          placeholder="Type a message... (try: patch: add a timer)"
          className="w-full px-3 py-2 bg-white/10 border border-white/30 rounded text-white placeholder-white/50"
        />
        <div className="text-xs text-white/50 mt-2">
          Prefix with "patch:" to invoke code operators
        </div>
      </div>
    </div>
  );
}
```

Register handlers in BusClientContext:

```typescript
// apps/ide-web/src/bus/BusClientContext.tsx

const wsClient = new WsClient("ws://localhost:3000", {
  // ... other handlers ...
  onBrainChatDelta: (env) => {
    setBrainChatMessage((prev) => ({
      ...prev,
      [env.payload.traceId]: (prev[env.payload.traceId] ?? "") + env.payload.deltaText,
    }));
  },
  onBrainChatDone: (env) => {
    setCompletedChats((prev) => ({
      ...prev,
      [env.payload.traceId]: env.payload,
    }));
  },
  onBrainChatError: (env) => {
    console.error(`Chat error [${env.payload.traceId}]:`, env.payload.message);
  },
});
```

---

## 3. Message Types & Payloads

### brain.chat (request, IDE → Nucleus)

```typescript
type BrainChatRequest = {
  traceId: string; // Required: correlation ID for binding stream
  message: string; // Required: user input
  mode?: "assistant" | "operator" | "ide-help"; // Optional
  context?: {
    currentRoute?: string; // Current IDE route
    selectedFiles?: string[];
    selectionText?: string;
    openPanels?: string[];
  };
};
```

Usage:

```typescript
wsClient.send("brain.chat", {
  traceId: "trace_abc123",
  message: "patch: make the sidebar collapsible",
  mode: "assistant",
  context: { currentRoute: "/lab/studio" },
});
```

### brain.chat.delta (stream chunk, Nucleus → IDE)

```typescript
type BrainChatDelta = {
  traceId: string; // Links back to request
  seq: number; // Chunk sequence (0, 1, 2, ...)
  deltaText: string; // Streaming text chunk
};
```

Handler:

```typescript
onBrainChatDelta: (env) => {
  const { traceId, seq, deltaText } = env.payload;
  // Accumulate: response[traceId] += deltaText
};
```

### brain.chat.done (completion, Nucleus → IDE)

```typescript
type BrainChatDone = {
  traceId: string;
  finalText: string; // Complete response
  toolsUsed?: string[]; // ["prompt.operator.patch"]
  audit?: {
    latency_ms: number;
    operatorExecuted?: {
      operatorId: string;
      ok: boolean;
    };
  };
};
```

Handler:

```typescript
onBrainChatDone: (env) => {
  const { traceId, finalText, audit } = env.payload;
  console.log(`Done in ${audit.latency_ms}ms: ${finalText}`);
};
```

### brain.chat.error (error, Nucleus → IDE)

```typescript
type BrainChatError = {
  traceId: string;
  code: string; // "CHAT_FAIL", "OPERATOR_TIMEOUT", etc.
  message: string;
};
```

Handler:

```typescript
onBrainChatError: (env) => {
  const { traceId, code, message } = env.payload;
  console.error(`[${code}] ${message}`);
};
```

---

## 4. Operator Dispatch (Auto-wired)

When user message starts with "patch:", Nucleus automatically routes to `prompt.operator.patch`:

```typescript
message: "patch: add a logout button to the navbar"
  ↓
chatHandler detects prefix
  ↓
POST http://localhost:3000/operator/event
  {
    operatorId: "prompt.operator.patch",
    sessionId: ...,
    traceId: ...,
    payload: {
      user_request: "add a logout button to the navbar",
      context: { ... }
    }
  }
  ↓
Sidecar executes operator (via LLM + tools)
  ↓
Nucleus receives result
  ↓
Nucleus emits brain.chat.done with result text
```

**Note**: Currently hardcoded to `prompt.operator.patch`. Future: make configurable by mode or prefix.

---

## 5. Security & Gating

All brain.chat messages pass through:

1. **Session validation** ✅ (must match handshake sessionId)
2. **Auth token** ✅ (must include session token from welcome)
3. **Nonce replay protection** ✅ (each message has unique nonce)
4. **Rate limiting** ✅ (bucket: 120 msgs/10s)
5. **Capability gating** ✅ (requires `cap:chat:send`)

IDE role grants all chat caps by default:

```typescript
if (role === "ide") {
  return [
    "cap:chat:send", // ✅ Covers brain.chat
    "cap:uee:invoke",
    // ... other caps ...
  ];
}
```

---

## 6. Testing

### Minimal Test (Copy-Paste in Browser Console)

```javascript
// Assuming you've set up WsClient and wsClient is global

wsClient.send("brain.chat", {
  traceId: "test_" + Date.now(),
  message: "patch: add a timer widget",
  mode: "assistant",
  context: { currentRoute: "/lab/studio" },
});

// Watch browser console for delta/done/error messages
```

### Integration Test Checklist

```
☐ IDE can send brain.chat request (no type errors)
☐ Nucleus receives and routes (wsHub logs)
☐ chatHandler processes without crashing
☐ First delta arrives with 🧠 emoji
☐ Sequential deltas accumulate (seq: 0, 1, 2...)
☐ Final done arrives with completetext + latency
☐ Operator dispatch: "patch:" prefix routes to /operator/event
☐ Operator result included in finalText
☐ Error handler works (send invalid traceId type)
☐ traceId binding works (multiple concurrent messages)
```

---

## 7. Future Enhancements

### Mode-based Routing (not yet wired)

```typescript
if (mode === "operator") {
  // Route directly to operator queue
} else if (mode === "ide-help") {
  // Call helpOperator instead of patchOperator
} else {
  // Default: "assistant" → patchOperator
}
```

### Brain Memory Integration (not yet wired)

```typescript
// In handleBrainChat, after operator result:
await fetch("http://localhost:8001/brain/memory/fact", {
  method: "POST",
  body: JSON.stringify({
    key: `user_interaction.${traceId}`,
    value: { message, result: finalText, timestamp },
  }),
});
```

### Streaming from LLM (not yet wired)

```typescript
// Instead of simple delta, stream directly from Brain endpoint:
const res = await fetch(`${BRAIN_HTTP_ENDPOINT}/chat/stream`, {
  method: "POST",
  body: JSON.stringify({ traceId, message, mode, context }),
});

// Read chunks from res.body, emit brain.chat.delta per chunk
```

---

## 8. Troubleshooting

| Issue                         | Check                                                                         |
| ----------------------------- | ----------------------------------------------------------------------------- |
| "brain.chat not recognized"   | Is protocol re-exported? Check `packages/protocol/src/index.ts`               |
| Session mismatch error        | Is IDE sending after welcome? Don't send before sessionId is set.             |
| Rate limit: too many messages | Bucket limit is 120 msgs/10s. Slow down or increase `RL_BUCKET_MAX` in wsHub. |
| Operator timeout              | Default: 60s. If operator slow, increase fetch timeout in handleBrainChat.    |
| No brain.chat.delta arriving  | Check Nucleus logs for errors. Verify WsClient sent with correct format.      |
| Operator returns error        | Message is in `brain.chat.error` or `operatorExecuted.ok === false` in audit. |

---

## 9. Code Checklist (What Was Added)

### Protocol (`packages/protocol/src/`)

- ✅ `chat.ts`: BrainChatRequest, BrainChatDelta, BrainChatDone, BrainChatError types + Zod schemas
- ✅ `types.ts`: Added 4 entries to MessageMap

### Nucleus (`apps/nucleus/src/`)

- ✅ `wsHub.ts`: Added "brain.chat" to requiredCapsForMessageType + known types list
- ✅ `wsHub.ts`: Added routing handler for "brain.chat" → chatHandler.handleBrainChat
- ✅ `chat-handler.ts`: Added handleBrainChat method with operator dispatch + streaming

### IDE (`apps/ide-web/src/bus/`)

- ✅ `wsClient.ts`: Added onBrainChatDelta, onBrainChatDone, onBrainChatError handlers
- ✅ `wsClient.ts`: Added message dispatch for brain.chat.\* types

---

## 10. Next Session (Session 11+)

- [ ] Wire real LLM streaming (call Brain /chat/stream endpoint)
- [ ] Implement mode-based routing (operator vs assistant vs ide-help)
- [ ] Add memory integration (persist interactions)
- [ ] Add UI for chat panel (BrainChatPanel component)
- [ ] Add operator result rendering (JSON, code, etc.)
- [ ] Add retry logic + exponential backoff
- [ ] Add streaming timeout + cancel support

---

**Status**: 🟢 Ready for use. Send your first `brain.chat` message!
