/**
 * useFlowstateBusEmit — Hook for emitting flowstate metrics to bus
 *
 * Emits telemetry when code is analyzed, with evidence packet integration.
 */

import { useCallback } from "react";
import type { FlowMetricsOutput } from "@world-engine/flowstate";

export interface FlowstateTelemetryEvent {
  type: "flowstate.metrics";
  timestamp: string;
  metrics: FlowMetricsOutput;
  sessionId: string;
}

/**
 * Hook to emit flowstate metrics to telemetry/logging system
 *
 * Usage:
 *   const emitFlowstateTelemetry = useFlowstateBusEmit();
 *   emitFlowstateTelemetry(metrics, sessionId);
 */
export function useFlowstateBusEmit() {
  return useCallback((metrics: FlowMetricsOutput, sessionId: string) => {
    const event: FlowstateTelemetryEvent = {
      type: "flowstate.metrics",
      timestamp: new Date().toISOString(),
      metrics,
      sessionId,
    };

    // Log to console (development)
    if (typeof window !== "undefined" && (window as any).__DEV__) {
      console.log("[flowstate:telemetry]", event);
    }

    // Emit to bus (if available)
    try {
      if (typeof window !== "undefined") {
        const busEvent = new CustomEvent("flowstate:metrics", {
          detail: event,
          bubbles: true,
          cancelable: false,
        });
        window.dispatchEvent(busEvent);
      }
    } catch (e) {
      console.warn("[flowstate:telemetry] failed to emit bus event", e);
    }
  }, []);
}
