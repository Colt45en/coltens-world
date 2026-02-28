/**
 * NDJSON Consumer Hook with P0 Upstream Guard
 *
 * This hook fetches from a URL, reads NDJSON with the 5-line guard,
 * and exposes stream status + metrics.
 *
 * Usage:
 * ```tsx
 * const { status, events, lastSeq, ordering, error, reset } = useNdjsonConsumer({
 *   url: "/ledger/stream",
 * });
 * ```
 */

import React from "react";
import type { P0StreamEvent } from "./useP0StreamReducer";
import { parseP0StreamEventLine } from "./useP0StreamReducer";

export interface NdjsonConsumerOptions {
  url: string;
  onError?: (err: Error) => void;
}

export interface P0OrderingMetrics {
  ok: boolean; // all events monotonic within each turn
  dupes: number; // seq == lastSeq
  gaps: number; // seq > lastSeq + 1
  rewinds: number; // seq < lastSeq (backward)
}

export interface NdjsonConsumerState {
  status: "connecting" | "open" | "closed" | "error";
  events: P0StreamEvent[];
  lastSeq: number | null; // highest accepted seq across all turns
  ordering: P0OrderingMetrics;
  error: Error | null;
  reset: () => void;
}

/**
 * Async NDJSON line iterator (browser-safe)
 */
async function* ndjsonLines(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<string, void, unknown> {
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: false });

  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();

      if (done) {
        const tail = buffer.trim();
        if (tail.length > 0) {
          yield tail;
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      while (true) {
        const nlIdx = buffer.indexOf("\n");
        if (nlIdx === -1) break;

        const line = buffer.slice(0, nlIdx).trim();
        buffer = buffer.slice(nlIdx + 1);

        if (line.length > 0) {
          yield line;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Hook: consume NDJSON stream with P0 guard + status
 *
 * Returns full state for UI: status, events, metrics, error, reset.
 */
export function useNdjsonConsumer(options: NdjsonConsumerOptions): NdjsonConsumerState {
  const [state, setState] = React.useState<NdjsonConsumerState>({
    status: "connecting",
    events: [],
    lastSeq: null,
    ordering: { ok: true, dupes: 0, gaps: 0, rewinds: 0 },
    error: null,
    reset: () => {}, // will be set in effect
  });

  const abortControllerRef = React.useRef<AbortController | null>(null);

  const reset = React.useCallback(() => {
    setState((prev) => ({
      ...prev,
      events: [],
      lastSeq: null,
      ordering: { ok: true, dupes: 0, gaps: 0, rewinds: 0 },
      error: null,
      status: "connecting",
    }));
  }, []);

  React.useEffect(() => {
    const consume = async () => {
      abortControllerRef.current = new AbortController();
      const abortSignal = abortControllerRef.current.signal;

      try {
        setState((prev) => ({ ...prev, status: "connecting" }));

        const resp = await fetch(options.url, { signal: abortSignal });
        if (!resp.body) {
          throw new Error("No response body");
        }

        setState((prev) => ({ ...prev, status: "open" }));

        // ✅ 5-LINE GUARD: Track last seq per turn
        const lastSeqByTurn = new Map<string, number>();
        let highestSeqSeen = -1;

        const metrics = { ok: true, dupes: 0, gaps: 0, rewinds: 0 };

        for await (const line of ndjsonLines(resp.body)) {
          if (abortSignal.aborted) break;

          const event = parseP0StreamEventLine(line);
          if (!event) continue;

          const last = lastSeqByTurn.get(event.turnId) ?? -1;

          // ✅ Guard: check monotonicity per turn
          if (event.seq <= last) {
            if (event.seq === last) {
              metrics.dupes++;
            } else {
              metrics.rewinds++;
            }
            metrics.ok = false;
            console.warn(`[p0-guard] Violation: ${event.turnId} seq=${event.seq} (last=${last})`);
            continue; // Skip this event
          }

          if (event.seq > last + 1) {
            metrics.gaps++;
            metrics.ok = false;
          }

          lastSeqByTurn.set(event.turnId, event.seq);
          highestSeqSeen = Math.max(highestSeqSeen, event.seq);

          setState((prev) => ({
            ...prev,
            events: [...prev.events, event],
            lastSeq: highestSeqSeen,
            ordering: metrics,
          }));
        }

        setState((prev) => ({ ...prev, status: "closed" }));
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return; // User aborted, don't set error
        }
        const error = err instanceof Error ? err : new Error(String(err));
        setState((prev) => ({ ...prev, status: "error", error }));
        options.onError?.(error);
      }
    };

    consume();

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [options]);

  return {
    ...state,
    reset,
  };
}
