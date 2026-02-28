/**
 * NDJSON Consumer Hook with P0 Upstream Guard
 *
 * This hook reads NDJSON from a fetch stream and dispatches to useP0StreamReducer.
 * The 5-line guard drops out-of-order events BEFORE dispatch, preventing reducer churn.
 *
 * Usage:
 * ```tsx
 * const [state, dispatch] = useP0StreamReducer();
 * useNdjsonConsumer(fetchResponse.body, { dispatch });
 * ```
 */

import React from "react";
import type { P0StreamAction, P0StreamEvent } from "./useP0StreamReducer";
import { parseP0StreamEventLine } from "./useP0StreamReducer";

export interface NdjsonConsumerOptions {
  dispatch: React.Dispatch<P0StreamAction>;
  onError?: (err: Error) => void;
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
 * Hook: consume NDJSON stream with P0 guard
 *
 * The upstream guard (5 lines) prevents reducer from seeing duplicates/out-of-order.
 */
export function useNdjsonConsumer(
  stream: ReadableStream<Uint8Array> | null,
  options: NdjsonConsumerOptions
): void {
  const dispatched = React.useRef(new Set<string>());

  React.useEffect(() => {
    if (!stream) return;

    const consume = async () => {
      // ✅ 5-LINE GUARD: Track last seq per turn
      const lastSeqByTurn = new Map<string, number>();

      const accept = (ev: P0StreamEvent): boolean => {
        const last = lastSeqByTurn.get(ev.turnId) ?? -1;
        // Reject if seq <= last (duplicate or out-of-order)
        if (ev.seq <= last) {
          console.warn(
            `[p0-guard] Dropping out-of-order for ${ev.turnId}: seq=${ev.seq} (last=${last})`
          );
          return false;
        }
        lastSeqByTurn.set(ev.turnId, ev.seq);
        return true;
      };

      try {
        for await (const line of ndjsonLines(stream)) {
          const event = parseP0StreamEventLine(line);
          if (!event) continue;

          // ✅ Guard in action: skip if out-of-order
          if (!accept(event)) continue;

          // Dispatch to reducer (which also validates but receiver is safe now)
          options.dispatch({ type: "EVENT", event });
        }
      } catch (err) {
        options.onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    };

    consume();
  }, [stream, options]);
}
