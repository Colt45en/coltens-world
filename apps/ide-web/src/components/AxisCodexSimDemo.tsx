/**
 * AxisCodexSimDemo - Full Demo Component (Control Plane + Canvas)
 *
 * Shows:
 * - Play/pause/step/reset controls
 * - Seek slider
 * - Canvas graph (coherence + stimulus)
 * - Live meters (fill, resonance, coherence)
 * - Frame info
 *
 * Usage:
 * ```tsx
 * import { validateAxisCodexSimV1Config } from "@/lib/axis-codex-sim-v1";
 * const config = validateAxisCodexSimV1Config(userJson);
 * <AxisCodexSimDemo config={config} />
 * ```
 */

import React from "react";
import { useAxisCodexSim } from "../hooks/useAxisCodexSim";
import type { AxisCodexSimV1Config } from "../lib/axis-codex-sim-v1/types";
import { AxisCodexSimCanvas, AxisCodexSimMeters } from "./AxisCodexSimCanvas";

export interface AxisCodexSimDemoProps {
  config: AxisCodexSimV1Config;
  title?: string;
}

export function AxisCodexSimDemo({
  config,
  title = "Axis-Codex Sim V1",
}: AxisCodexSimDemoProps) {
  const sim = useAxisCodexSim(config);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  if (sim.error) {
    return (
      <div
        style={{
          padding: "16px",
          backgroundColor: "#ffe0e0",
          color: "#c00",
          borderRadius: "4px",
          fontFamily: "monospace",
          fontSize: "12px",
        }}
      >
        <strong>Error:</strong> {sim.error.message}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        padding: "16px",
        border: "1px solid #333",
        borderRadius: "8px",
        backgroundColor: "#fafafa",
      }}
    >
      <h3 style={{ margin: "0 0 8px 0" }}>{title}</h3>

      {/* Controls */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "8px",
          backgroundColor: "#f0f0f0",
          borderRadius: "4px",
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={sim.play}
          disabled={sim.isRunning}
          title="Play simulation"
          style={{
            padding: "6px 12px",
            cursor: sim.isRunning ? "not-allowed" : "pointer",
            backgroundColor: sim.isRunning ? "#ddd" : "#fff",
          }}
        >
          ▶ Play
        </button>

        <button
          onClick={sim.pause}
          disabled={!sim.isRunning}
          title="Pause simulation"
          style={{
            padding: "6px 12px",
            cursor: !sim.isRunning ? "not-allowed" : "pointer",
            backgroundColor: !sim.isRunning ? "#ddd" : "#fff",
          }}
        >
          ⏸ Pause
        </button>

        <button
          onClick={sim.step}
          disabled={sim.isRunning}
          title="Step one frame"
          style={{
            padding: "6px 12px",
            cursor: sim.isRunning ? "not-allowed" : "pointer",
            backgroundColor: sim.isRunning ? "#ddd" : "#fff",
          }}
        >
          → Step
        </button>

        <button
          onClick={sim.reset}
          title="Reset to start"
          style={{
            padding: "6px 12px",
            cursor: "pointer",
            backgroundColor: "#fff",
          }}
        >
          ⏮ Reset
        </button>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "12px", color: "#666" }}>
            Frame {sim.currentIndex} / {sim.totalFrames}
          </span>
          {sim.frame && (
            <span style={{ fontSize: "12px", color: "#666" }}>
              t={sim.frame.t_ms}ms
            </span>
          )}
        </div>
      </div>

      {/* Seek slider */}
      {sim.totalFrames > 0 && (
        <div>
          <input
            type="range"
            min="0"
            max={sim.totalFrames - 1}
            value={sim.currentIndex}
            onChange={(e) => sim.seek(parseInt(e.target.value))}
            style={{
              width: "100%",
              cursor: "pointer",
            }}
          />
        </div>
      )}

      {/* Canvas graph */}
      <AxisCodexSimCanvas
        ref={canvasRef}
        frame={sim.frame}
        frames={sim.frames}
        currentIndex={sim.currentIndex}
        width={800}
        height={300}
      />

      {/* Meters */}
      <AxisCodexSimMeters frame={sim.frame} />

      {/* Frame details */}
      {sim.frame && (
        <div
          style={{
            padding: "8px",
            backgroundColor: "#f5f5f5",
            borderRadius: "4px",
            fontSize: "11px",
            fontFamily: "monospace",
            color: "#555",
          }}
        >
          <div>
            <strong>Stimulus:</strong> total={sim.frame.stimulus.total.toFixed(2)} by_channel=
            {JSON.stringify(sim.frame.stimulus.by_channel)}
          </div>
          <div style={{ marginTop: "4px" }}>
            <strong>Heart:</strong> resonance={sim.frame.heart.resonance.toFixed(2)}{" "}
            capacity={sim.frame.heart.capacity.toFixed(2)} fill={sim.frame.heart.fill.toFixed(2)}{" "}
            coherence={sim.frame.heart.coherence.toFixed(2)}
          </div>
        </div>
      )}
    </div>
  );
}
