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
import styles from "./AxisCodexSimDemo.module.css";

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
      <div className={styles.errorBox}>
        <strong>Error:</strong> {sim.error.message}
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>{title}</h3>

      {/* Controls */}
      <div className={styles.controlsBar}>
        <button
          onClick={sim.play}
          disabled={sim.isRunning}
          title="Play simulation"
          className={`${styles.button} ${sim.isRunning ? styles.buttonDisabled : ""}`}
        >
          ▶ Play
        </button>

        <button
          onClick={sim.pause}
          disabled={!sim.isRunning}
          title="Pause simulation"
          className={`${styles.button} ${!sim.isRunning ? styles.buttonDisabled : ""}`}
        >
          ⏸ Pause
        </button>

        <button
          onClick={sim.step}
          disabled={sim.isRunning}
          title="Step one frame"
          className={`${styles.button} ${sim.isRunning ? styles.buttonDisabled : ""}`}
        >
          → Step
        </button>

        <button onClick={sim.reset} title="Reset to start" className={styles.button}>
          ⏮ Reset
        </button>

        <div className={styles.frameInfo}>
          <span className={styles.frameText}>
            Frame {sim.currentIndex} / {sim.totalFrames}
          </span>
          {sim.frame && <span className={styles.frameText}>t={sim.frame.t_ms}ms</span>}
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
            className={styles.slider}
            title="Seek to frame"
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
        <div className={styles.frameDetails}>
          <div>
            <strong>Stimulus:</strong> total={sim.frame.stimulus.total.toFixed(2)} by_channel=
            {JSON.stringify(sim.frame.stimulus.by_channel)}
          </div>
          <div className={styles.frameDetailsRow}>
            <strong>Heart:</strong> resonance={sim.frame.heart.resonance.toFixed(2)} capacity=
            {sim.frame.heart.capacity.toFixed(2)} fill={sim.frame.heart.fill.toFixed(2)} coherence=
            {sim.frame.heart.coherence.toFixed(2)}
          </div>
        </div>
      )}
    </div>
  );
}
