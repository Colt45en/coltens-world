/**
 * IDE Stream Event Reducer
 *
 * Validates and deinterleaves NDJSON stream events by turnId + seq
 *
 * Enforces P0.1 (ordering): every event must have:
 * - turnId: stable per user message
 * - seq: monotonic counter (0, 1, 2, ...)
 * - ts_utc: ISO8601 UTC timestamp
 *
 * Handles concurrent turns gracefully:
 * - Groups events by turnId (isolated per-turn state)
 * - Validates seq monotonic per turn
 * - Drops out-of-order and duplicate events (logs warning)
 * - IMMUTABLE: all state transitions create new references
 * - React-safe: no mutation, guaranteed re-renders
 */

import React from "react";

export interface P0StreamEvent {
  type: string;
  turnId: string;
  seq: number;
  ts_utc: string; // UTC ISO8601, ends with Z
  // ... type-specific fields
}

export interface P0StreamReducerState {
  // Maps turnId → { lastSeq, events[] }
  turns: Map<
    string,
    {
      lastSeq: number;
      events: P0StreamEvent[];
      firstSeenAt: string;
    }
  >;
  // Queue of complete turns ready for rendering
  completeTurns: string[];
  // Current stream status
  isStreaming: boolean;
  errors: Array<{ turnId: string; seq: number; reason: string }>;
}

export type P0StreamAction =
  | {
      type: "EVENT";
      event: P0StreamEvent;
    }
  | {
      type: "TURN_COMPLETE";
      turnId: string;
    }
  | {
      type: "ABORT";
      turnId: string;
    }
  | {
      type: "RESET";
    };

export const initialP0StreamState: P0StreamReducerState = {
  turns: new Map(),
  completeTurns: [],
  isStreaming: false,
  errors: [],
};

function pushUnique(arr: string[], v: string): string[] {
  return arr.includes(v) ? arr : [...arr, v];
}

/**
 * Reducer for P0 stream events (IMMUTABLE VERSION)
 *
 * Core logic:
 * 1. Validate event shape (turnId, seq, ts_utc required + valid)
 * 2. Track last seq per turnId
 * 3. Accept only monotonic seq (must be > lastSeq)
 * 4. Collect events in order
 * 5. Mark turn complete when "done" type received
 *
 * ALL STATE TRANSITIONS ARE IMMUTABLE:
 * - Creates new Map, new arrays, never mutates input
 * - React-safe: guaranteed re-renders on state change
 */
export function p0StreamReducer(
  state: P0StreamReducerState,
  action: P0StreamAction
): P0StreamReducerState {
  switch (action.type) {
    case "EVENT": {
      const event = action.event;

      // Validate required fields (strict)
      if (
        !event.turnId ||
        typeof event.seq !== "number" ||
        !Number.isInteger(event.seq) ||
        event.seq < 0 ||
        !event.ts_utc ||
        typeof event.ts_utc !== "string" ||
        !event.ts_utc.endsWith("Z")
      ) {
        console.warn("[p0] Invalid event shape:", event);
        return {
          ...state,
          errors: [
            ...state.errors,
            {
              turnId: event.turnId || "unknown",
              seq:
                typeof (event as any).seq === "number" ? (event as any).seq : -1,
              reason: "Missing/invalid turnId/seq/ts_utc",
            },
          ],
        };
      }

      // Create new Map to hold updated turns
      const turns = new Map(state.turns);
      const prevTurn = turns.get(event.turnId) ?? {
        lastSeq: -1,
        events: [],
        firstSeenAt: event.ts_utc,
      };

      // Validate seq is monotonic (must be > lastSeq)
      if (event.seq <= prevTurn.lastSeq) {
        console.warn(
          `[p0] Out-of-order event: turnId=${event.turnId} seq=${event.seq} (last=${prevTurn.lastSeq})`
        );
        return {
          ...state,
          errors: [
            ...state.errors,
            {
              turnId: event.turnId,
              seq: event.seq,
              reason: `Out-of-order (lastSeq=${prevTurn.lastSeq})`,
            },
          ],
        };
      }

      // Create new turn state (immutable)
      const nextTurn = {
        lastSeq: event.seq,
        events: [...prevTurn.events, event],
        firstSeenAt: prevTurn.firstSeenAt,
      };

      turns.set(event.turnId, nextTurn);

      const completeTurns =
        event.type === "done"
          ? pushUnique(state.completeTurns, event.turnId)
          : state.completeTurns;

      return {
        ...state,
        turns,
        completeTurns,
        isStreaming: event.type !== "done" && event.type !== "error",
      };
    }

    case "TURN_COMPLETE": {
      return {
        ...state,
        completeTurns: pushUnique(state.completeTurns, action.turnId),
      };
    }

    case "ABORT": {
      const turns = new Map(state.turns);
      turns.delete(action.turnId);
      return {
        ...state,
        turns,
        completeTurns: state.completeTurns.filter((id) => id !== action.turnId),
      };
    }

    case "RESET": {
      // Fresh Map instance ensures React sees the change
      return {
        turns: new Map(),
        completeTurns: [],
        isStreaming: false,
        errors: [],
      };
    }

    default:
      return state;
  }
}

/**
 * Hook-friendly selector: get events for a turn in order
 */
export function selectEventsForTurn(
  state: P0StreamReducerState,
  turnId: string
): P0StreamEvent[] {
  const turn = state.turns.get(turnId);
  return turn?.events ?? [];
}

/**
 * Get all complete turns in order
 */
export function selectCompleteTurns(
  state: P0StreamReducerState
): Array<{ turnId: string; eventCount: number; firstSeenAt: string }> {
  return state.completeTurns.map((turnId) => {
    const turn = state.turns.get(turnId);
    return {
      turnId,
      eventCount: turn?.events.length ?? 0,
      firstSeenAt: turn?.firstSeenAt ?? "",
    };
  });
}

/**
 * Validation helper: parse a line of NDJSON into a validated P0StreamEvent
 *
 * Usage in ChatClient (with upstream guard):
 * ```ts
 * const ev = parseP0StreamEventLine(line);
 * if (!ev) return;
 * if (!accept(ev)) return;  // ✅ upstream guard
 * dispatch({ type: "EVENT", event: ev });
 * ```
 */
export function parseP0StreamEventLine(line: string): P0StreamEvent | null {
  try {
    const raw = JSON.parse(line);

    // Strict validation
    if (
      !raw ||
      typeof raw !== "object" ||
      typeof raw.type !== "string" ||
      typeof raw.turnId !== "string" ||
      typeof raw.seq !== "number" ||
      !Number.isInteger(raw.seq) ||
      typeof raw.ts_utc !== "string" ||
      !raw.ts_utc.endsWith("Z")
    ) {
      console.warn("[p0] Event fails schema validation:", raw);
      return null;
    }

    return raw as P0StreamEvent;
  } catch (err) {
    console.warn("[p0] Failed to parse NDJSON line:", line, err);
    return null;
  }
}

/**
 * React Hook: useP0StreamReducer
 *
 * IMMUTABLE reducer (safe for React re-renders).
 *
 * Usage in a chat component:
 * ```tsx
 * const [state, dispatch] = useP0StreamReducer();
 * const lastSeqByTurn = React.useRef(new Map<string, number>());
 *
 * const accept = (ev: { turnId: string; seq: number }) => {
 *   const last = lastSeqByTurn.current.get(ev.turnId) ?? -1;
 *   if (ev.seq <= last) return false;
 *   lastSeqByTurn.current.set(ev.turnId, ev.seq);
 *   return true;
 * };
 *
 * // When receiving a line from NDJSON stream:
 * const ev = parseP0StreamEventLine(line);
 * if (!ev) return;
 * if (!accept(ev)) return; // ✅ upstream guard
 * dispatch({ type: "EVENT", event: ev });
 *
 * // Render events for current turn:
 * const events = selectEventsForTurn(state, currentTurnId);
 * ```
 */
export function useP0StreamReducer(): [
  P0StreamReducerState,
  React.Dispatch<P0StreamAction>
] {
  const [state, dispatch] = React.useReducer(
    p0StreamReducer,
    initialP0StreamState
  );
  return [state, dispatch];
}
