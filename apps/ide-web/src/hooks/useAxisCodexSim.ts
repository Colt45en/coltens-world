/**
 * useAxisCodexSim Hook - Control Plane for Deterministic Simulation
 *
 * Manages simulation state, playback, and provides granular controls:
 * - Play/pause/step/reset/seek
 * - Frame-by-frame inspection
 * - Streaming-compatible state updates
 *
 * Usage:
 * ```tsx
 * const { frame, frames, isRunning, play, pause, step, reset, seek } = useAxisCodexSim(config);
 *
 * // Live controls
 * <button onClick={play}>▶ Play</button>
 * <button onClick={pause}>⏸ Pause</button>
 * <button onClick={step}>→ Step</button>
 *
 * // Render current frame
 * {frame && <FrameRenderer frame={frame} />}
 * ```
 */

import React from "react";
import { AxisCodexSimEngineV1 } from "../lib/axis-codex-sim-v1/engine";
import type { AxisCodexSimV1Config, Frame } from "../lib/axis-codex-sim-v1/types";

export interface AxisCodexSimState {
  // Current playback frame
  frame: Frame | null;
  // All frames (once simulation completes)
  frames: Frame[];
  // Playback state
  isRunning: boolean;
  currentIndex: number;
  totalFrames: number;
  // Playback controls
  play: () => void;
  pause: () => void;
  step: () => void;
  reset: () => void;
  seek: (index: number) => void;
  // Engine state
  engine: AxisCodexSimEngineV1 | null;
  error: Error | null;
}

/**
 * Hook: Manage axis-codex-sim playback
 *
 * Runs simulation deterministically, provides frame-by-frame controls,
 * and updates state for canvas/graph rendering.
 */
export function useAxisCodexSim(config: AxisCodexSimV1Config): AxisCodexSimState {
  const [state, setState] = React.useState<{
    engine: AxisCodexSimEngineV1 | null;
    frames: Frame[];
    currentIndex: number;
    isRunning: boolean;
    error: Error | null;
  }>({
    engine: null,
    frames: [],
    currentIndex: 0,
    isRunning: false,
    error: null,
  });

  // Initialize engine and run to completion
  React.useEffect(() => {
    try {
      const engine = new AxisCodexSimEngineV1(config);
      const frames = engine.runToEnd();

      setState({
        engine,
        frames,
        currentIndex: 0,
        isRunning: false,
        error: null,
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setState((prev) => ({
        ...prev,
        error,
      }));
    }
  }, [config]);

  const play = React.useCallback(() => {
    setState((prev) => {
      if (prev.currentIndex >= prev.frames.length - 1) {
        return prev; // Already at end
      }
      return { ...prev, isRunning: true };
    });
  }, []);

  const pause = React.useCallback(() => {
    setState((prev) => ({ ...prev, isRunning: false }));
  }, []);

  const step = React.useCallback(() => {
    setState((prev) => {
      const next = Math.min(prev.currentIndex + 1, prev.frames.length - 1);
      return { ...prev, currentIndex: next, isRunning: false };
    });
  }, []);

  const reset = React.useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentIndex: 0,
      isRunning: false,
    }));
  }, []);

  const seek = React.useCallback((index: number) => {
    setState((prev) => ({
      ...prev,
      currentIndex: Math.max(0, Math.min(index, prev.frames.length - 1)),
      isRunning: false,
    }));
  }, []);

  // Auto-play loop
  React.useEffect(() => {
    if (!state.isRunning || state.frames.length === 0) return;

    const interval = setInterval(() => {
      setState((prev) => {
        if (prev.currentIndex >= prev.frames.length - 1) {
          return { ...prev, isRunning: false };
        }
        return { ...prev, currentIndex: prev.currentIndex + 1 };
      });
    }, 100); // ~10 fps playback

    return () => clearInterval(interval);
  }, [state.isRunning, state.frames.length]);

  const frame = state.frames[state.currentIndex] ?? null;

  return {
    frame,
    frames: state.frames,
    isRunning: state.isRunning,
    currentIndex: state.currentIndex,
    totalFrames: state.frames.length,
    play,
    pause,
    step,
    reset,
    seek,
    engine: state.engine,
    error: state.error,
  };
}
