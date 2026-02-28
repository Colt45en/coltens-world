/**
 * P0 Stream Consumer Export Barrel
 *
 * Provides hooks + components for deterministic NDJSON streaming.
 */

export { parseP0StreamEventLine, selectCompleteTurns, selectEventsForTurn, useP0StreamReducer } from "./useP0StreamReducer";
export type { P0StreamAction, P0StreamEvent, P0StreamReducerState } from "./useP0StreamReducer";

export { useNdjsonConsumer } from "./useNdjsonConsumer";
export type { NdjsonConsumerOptions, NdjsonConsumerState, P0OrderingMetrics } from "./useNdjsonConsumer";
