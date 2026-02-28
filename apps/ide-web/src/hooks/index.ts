/**
 * IDE Hooks Export Barrel
 *
 * Provides:
 * - P0 Stream Consumer: deterministic NDJSON ordering
 * - Axis-Codex Sim: deterministic simulation playback
 */

export { parseP0StreamEventLine, selectCompleteTurns, selectEventsForTurn, useP0StreamReducer } from "./useP0StreamReducer";
export type { P0StreamAction, P0StreamEvent, P0StreamReducerState } from "./useP0StreamReducer";

export { useNdjsonConsumer } from "./useNdjsonConsumer";
export type { NdjsonConsumerOptions, NdjsonConsumerState, P0OrderingMetrics } from "./useNdjsonConsumer";

export { useAxisCodexSim } from "./useAxisCodexSim";
export type { AxisCodexSimState } from "./useAxisCodexSim";
