/**
 * AxisCodexSimCanvas - Canvas Renderer for Simulation Visualization
 *
 * Renders:
 * - Coherence graph (across all frames)
 * - Heart meter (fill/capacity)
 * - Stimulus waveform
 * - Current time indicator
 *
 * Usage:
 * ```tsx
 * const sim = useAxisCodexSim(config);
 * <AxisCodexSimCanvas sim={sim} width={800} height={400} />
 * ```
 */

import React from "react";
import type { Frame } from "../lib/axis-codex-sim-v1/types";

export interface AxisCodexSimCanvasProps {
  frame: Frame | null;
  frames: Frame[];
  currentIndex: number;
  width?: number;
  height?: number;
}

export const AxisCodexSimCanvas = React.forwardRef<
  HTMLCanvasElement,
  AxisCodexSimCanvasProps
>(
  (
    {
      frame,
      frames,
      currentIndex,
      width = 800,
      height = 300,
    },
    ref
  ) => {
    React.useEffect(() => {
      const canvas = ref && "current" in ref ? ref.current : null;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Background
      ctx.fillStyle = "#fafafa";
      ctx.fillRect(0, 0, width, height);

      if (frames.length === 0) {
        ctx.fillStyle = "#999";
        ctx.font = "14px monospace";
        ctx.fillText("No frames", 20, height / 2);
        return;
      }

      const padding = 40;
      const graphWidth = width - 2 * padding;
      const graphHeight = height - 2 * padding;

      // Find min/max for scaling
      const cohs = frames.map((f) => f.heart!.coherence);
      const maxCoh = Math.max(...cohs);
      const stimuli = frames.map((f) => f.stimulus!.total);
      const maxStim = Math.max(...stimuli, 1);

      // Draw grid
      ctx.strokeStyle = "#eee";
      ctx.lineWidth = 1;
      for (let i = 0; i <= 5; i++) {
        const y = padding + (graphHeight * i) / 5;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
      }

      // Draw stimulus bars (background)
      ctx.fillStyle = "rgba(100, 150, 255, 0.1)";
      for (let i = 0; i < frames.length; i++) {
        const x = padding + (graphWidth / frames.length) * i;
        const w = graphWidth / frames.length;
        const barH = (frames[i]!.stimulus!.total / maxStim) * graphHeight;
        ctx.fillRect(x, padding + graphHeight - barH, w, barH);
      }

      // Draw coherence line
      ctx.strokeStyle = "#0066cc";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < frames.length; i++) {
        const x = padding + (graphWidth / frames.length) * i;
        const y = padding + graphHeight - (frames[i]!.heart!.coherence / maxCoh) * graphHeight;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Draw current position indicator
      if (currentIndex >= 0 && currentIndex < frames.length) {
        const x = padding + (graphWidth / frames.length) * currentIndex;
        ctx.strokeStyle = "#dc3545";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, padding);
        ctx.lineTo(x, padding + graphHeight);
        ctx.stroke();

        // Dot on coherence line
        const y =
          padding + graphHeight - (frames[currentIndex]!.heart!.coherence / maxCoh) * graphHeight;
        ctx.fillStyle = "#dc3545";
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI);
        ctx.fill();
      }

      // Axes
      ctx.strokeStyle = "#333";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padding, padding);
      ctx.lineTo(padding, padding + graphHeight);
      ctx.lineTo(width - padding, padding + graphHeight);
      ctx.stroke();

      // Labels
      ctx.fillStyle = "#666";
      ctx.font = "11px monospace";
      ctx.textAlign = "right";
      ctx.fillText("coherence", padding - 10, padding - 5);
      ctx.textAlign = "center";
      ctx.fillText("time →", width / 2, height - 5);
    }, [frame, frames, currentIndex, width, height, ref]);

    return (
      <canvas
        ref={ref}
        width={width}
        height={height}
        style={{
          border: "1px solid #ddd",
          borderRadius: "4px",
          backgroundColor: "#fafafa",
        }}
      />
    );
  }
);

AxisCodexSimCanvas.displayName = "AxisCodexSimCanvas";

/**
 * AxisCodexSimMeters - Mini gauges for heart state
 *
 * Shows:
 * - Fill (vs capacity)
 * - Resonance
 * - Coherence (numeric)
 */
export interface AxisCodexSimMetersProps {
  frame?: Frame | null;
}

export function AxisCodexSimMeters({ frame }: AxisCodexSimMetersProps) {
  if (!frame) {
    return <div style={{ color: "#999" }}>No frame</div>;
  }

  const { fill, capacity, resonance, coherence } = frame.heart;
  const fillPct = capacity > 0 ? (fill / capacity) * 100 : 0;

  return (
    <div
      style={{
        display: "flex",
        gap: "16px",
        padding: "12px",
        backgroundColor: "#f9f9f9",
        borderRadius: "4px",
        fontSize: "12px",
        fontFamily: "monospace",
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ marginBottom: "4px", fontWeight: "bold" }}>Fill</div>
        <div
          style={{
            width: "100%",
            height: "20px",
            backgroundColor: "#e0e0e0",
            borderRadius: "3px",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              width: `${fillPct}%`,
              height: "100%",
              backgroundColor: "#4CAF50",
              transition: "width 100ms ease-out",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "2px",
              left: "4px",
              fontSize: "10px",
              color: "#333",
            }}
          >
            {fillPct.toFixed(0)}%
          </div>
        </div>
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ marginBottom: "4px", fontWeight: "bold" }}>Resonance</div>
        <div
          style={{
            width: "100%",
            height: "20px",
            backgroundColor: "#e0e0e0",
            borderRadius: "3px",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              width: `${Math.min(resonance / 10, 1) * 100}%`,
              height: "100%",
              backgroundColor: "#FF9800",
              transition: "width 100ms ease-out",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "2px",
              left: "4px",
              fontSize: "10px",
              color: "#333",
            }}
          >
            {resonance.toFixed(2)}
          </div>
        </div>
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ marginBottom: "4px", fontWeight: "bold" }}>Coherence</div>
        <div
          style={{
            width: "100%",
            height: "20px",
            backgroundColor: "#e0e0e0",
            borderRadius: "3px",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              width: `${coherence * 100}%`,
              height: "100%",
              backgroundColor: coherence > 0.7 ? "#4CAF50" : coherence > 0.4 ? "#FF9800" : "#f44336",
              transition: "width 100ms ease-out",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "2px",
              left: "4px",
              fontSize: "10px",
              color: "#fff",
            }}
          >
            {(coherence * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
        <div>t = {frame.t_ms}ms</div>
        <div style={{ color: "#666" }}>
          cap = {capacity.toFixed(2)} / {fill.toFixed(2)}
        </div>
      </div>
    </div>
  );
}
