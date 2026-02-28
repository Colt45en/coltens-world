# IDE P0 Stream Integration

This guide shows how to integrate the P0 stream reducer into the IDE for deterministic event ordering **with upstream guard**.

---

## 🔐 The P0 Guard (Upstream Defense)

The reducer is **pure + immutable** (React-safe), but we add a **5-line guard upstream** to drop duplicates/out-of-order *before* dispatch:

```typescript
const lastSeqByTurn = new Map<string, number>();
const accept = (ev: P0StreamEvent): boolean => {
  const last = lastSeqByTurn.get(ev.turnId) ?? -1;
  if (ev.seq <= last) return false;
  lastSeqByTurn.current.set(ev.turnId, ev.seq);
  return true;
};
```

**Usage:**
```typescript
const event = parseP0StreamEventLine(line);
if (!event) return;
if (!accept(event)) return; // ✅ Guard drops out-of-order
dispatch({ type: "EVENT", event });
```

---

## Quick Start

### 1. Import reducer + consumer hook
```tsx
import { useP0StreamReducer, selectEventsForTurn } from "@/hooks/useP0StreamReducer";
import { useNdjsonConsumer } from "@/hooks/useNdjsonConsumer";
```

### 2. Use both in chat component
```tsx
export function ChatPanel() {
  const [streamState, dispatch] = useP0StreamReducer();
  const [currentTurnId, setCurrentTurnId] = useState<string>("");
  const [ndjsonStream, setNdjsonStream] = useState<ReadableStream<Uint8Array> | null>(null);

  // When sending a chat message
  const sendMessage = async (text: string) => {
    const turnId = crypto.randomUUID();
    setCurrentTurnId(turnId);

    // Fetch from nucleus with streaming
    const resp = await fetch("/api/chat", { method: "POST", body: JSON.stringify({ text }) });
    setNdjsonStream(resp.body);
  };

  // ✅ Hook automatically handles NDJSON + guard
  useNdjsonConsumer(ndjsonStream, {
    dispatch,
    onError: (err) => console.error("[p0] Stream error:", err),
  });

  // Render events in order for current turn
  const events = selectEventsForTurn(streamState, currentTurnId);

  return (
    <div>
      {streamState.errors.length > 0 && (
        <div className="text-yellow-500">
          {streamState.errors.map((err, i) => (
            <div key={i}>{err.reason}</div>
          ))}
        </div>
      )}
      {events.map((ev, i) => (
        <EventRenderer key={`${ev.turnId}-${ev.seq}`} event={ev} />
      ))}
    </div>
  );
}
```

### 3. Alternative: Manual hook + guard
If you prefer explicit control (e.g., existing fetch loop):

```typescript
const [streamState, dispatch] = useP0StreamReducer();

// 5-line guard inside your NDJSON loop:
const lastSeqByTurn = React.useRef(new Map<string, number>());
const accept = (ev: P0StreamEvent): boolean => {
  const last = lastSeqByTurn.current.get(ev.turnId) ?? -1;
  if (ev.seq <= last) return false;
  lastSeqByTurn.current.set(ev.turnId, ev.seq);
  return true;
};

// In your loop:
for await (const line of ndjsonLines(stream)) {
  const ev = parseP0StreamEventLine(line);
  if (!ev) continue;
  if (!accept(ev)) continue;  // ✅ Guard in action
  dispatch({ type: "EVENT", event: ev });

---

## Event Types Validated

Every event must have:
```json
{
  "type": "text_chunk|tool_call|tool_result|done|error",
  "turnId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "seq": 0,
  "ts_utc": "2026-02-27T14:30:45.123Z"
  // ... type-specific fields
}
```

## Safety Guarantees

✅ **Upstream Guard**: Drops seq ≤ lastSeq *before* dispatch (prevents reducer churn)
✅ **Immutable Reducer**: All state transitions create new references (React-safe, no missed renders)
✅ **Monotonic Seq**: Each turn's seq is validated & strictly increasing
✅ **UTC Timestamps**: All ts_utc must end with `Z` (normalized)
✅ **Concurrent Turns**: Multiple turns (turnId) stream simultaneously safely (Map per turnId)
✅ **Deterministic**: Same events → same state (testable, replayable)

## Error Handling

Rejected events are collected in `streamState.errors`:
```tsx
// Show warnings in UI
{streamState.errors.length > 0 && (
  <div className="text-yellow-500">
    {streamState.errors.map((err, i) => (
      <div key={i}>
        Turn {err.turnId} seq {err.seq}: {err.reason}
      </div>
    ))}
  </div>
)}
```

## Hook Files

- **[useP0StreamReducer.ts](useP0StreamReducer.ts)**: Pure immutable reducer + selectors + parser
- **[useNdjsonConsumer.ts](useNdjsonConsumer.ts)**: NDJSON consumer hook with 5-line guard built-in
- **[P0_STREAM_INTEGRATION.md](P0_STREAM_INTEGRATION.md)**: This guide

## Testing

```typescript
import { describe, it, expect } from "vitest";
import { p0StreamReducer, initialP0StreamState } from "@/hooks/useP0StreamReducer";

describe("useP0StreamReducer + guard", () => {
  it("upstream guard drops out-of-order", () => {
    const lastSeqByTurn = new Map<string, number>();
    const accept = (ev: any) => {
      const last = lastSeqByTurn.get(ev.turnId) ?? -1;
      if (ev.seq <= last) return false;
      lastSeqByTurn.set(ev.turnId, ev.seq);
      return true;
    };

    const ev0 = { turnId: "turn-1", seq: 0, type: "text", ts_utc: "2026Z" };
    const ev0_dup = { turnId: "turn-1", seq: 0, type: "text", ts_utc: "2026Z" };

    expect(accept(ev0)).toBe(true);  // First seq=0 OK
    expect(accept(ev0_dup)).toBe(false); // seq=0 again: dropped

    // Reducer only sees valid events
    let state = initialP0StreamState;
    state = p0StreamReducer(state, { type: "EVENT", event: ev0 });
    // ev0_dup never reaches reducer
    expect(state.turns.get("turn-1")?.events).toHaveLength(1);
  });

  it("reducer returns immutable new state", () => {
    const state1 = initialP0StreamState;
    const state2 = p0StreamReducer(state1, { type: "RESET" });
    expect(state1).not.toBe(state2); // Different references
    expect(state2.turns).not.toBe(state1.turns); // New Map instance
  });

  it("handles concurrent turns safely", () => {
    let state = initialP0StreamState;

    state = p0StreamReducer(state, {
      type: "EVENT",
      event: {
        type: "text",
        turnId: "turn-a",
        seq: 0,
        ts_utc: "2026Z",
      },
    });

    state = p0StreamReducer(state, {
      type: "EVENT",
      event: {
        type: "text",
        turnId: "turn-b",
        seq: 0,
        ts_utc: "2026Z",
      },
    });

    expect(state.turns.size).toBe(2);
    expect(state.turns.get("turn-a")?.events).toHaveLength(1);
    expect(state.turns.get("turn-b")?.events).toHaveLength(1);
  });
});
```

---

## Why This locks P0 determinism 🔐

1. **Upstream guard** (5 lines, 0 cost) stops bad events before they reach the reducer
2. **Immutable reducer** guarantees React re-renders exactly when state changes
3. **Per-turn monotonic validation** prevents interleaving artifacts
4. **UTC normalization** ensures cross-machine reproducibility
5. **Deterministic replay**: Save frames → load → same output forever

If you encounter mutations or missed renders, the fix is *guaranteed* in these 3 files.
