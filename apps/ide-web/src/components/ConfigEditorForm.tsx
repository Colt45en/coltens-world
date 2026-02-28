/**
 * ConfigEditorForm — Interactive sliders for AxisCodexSimV1Config
 *
 * Allows users to tweak Heart params, seed, and timing without hand-editing JSON.
 * Validates on every change and reports errors inline.
 *
 * Usage:
 * ```tsx
 * const [config, setConfig] = useState(defaultConfig);
 * <ConfigEditorForm initial={config} onConfigChange={setConfig} />
 * ```
 */

import React from "react";
import { validateAxisCodexSimV1Config } from "../lib/axis-codex-sim-v1/schema";
import {
    asUInt32,
    type AxisCodexSimV1Config,
    type HeartParams,
} from "../lib/axis-codex-sim-v1/types";

export interface ConfigEditorFormProps {
  initial: AxisCodexSimV1Config;
  onConfigChange: (config: AxisCodexSimV1Config) => void;
}

export function ConfigEditorForm({
  initial,
  onConfigChange,
}: ConfigEditorFormProps) {
  const [config, setConfig] = React.useState(initial);
  const [error, setError] = React.useState<string | null>(null);

  const updateConfig = (updates: Partial<AxisCodexSimV1Config>) => {
    const newConfig = { ...config, ...updates };
    try {
      validateAxisCodexSimV1Config(newConfig);
      setConfig(newConfig);
      setError(null);
      onConfigChange(newConfig);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid config";
      setError(msg);
    }
  };

  const updateHeart = (updates: Partial<HeartParams>) => {
    updateConfig({
      heart: { ...config.heart, ...updates },
    });
  };

  return (
    <div
      style={{
        padding: "1.5rem",
        border: "1px solid #ddd",
        borderRadius: "6px",
        background: "#fafafa",
        fontFamily: "monospace",
        fontSize: "0.875rem",
      }}
    >
      <h3 style={{ marginTop: 0 }}>Config Editor</h3>

      {error && (
        <div
          style={{
            color: "#dc3545",
            background: "#fff5f5",
            padding: "0.75rem",
            borderRadius: "4px",
            marginBottom: "1rem",
            fontSize: "0.8rem",
          }}
        >
          ⚠️ {error}
        </div>
      )}

      <div style={{ display: "grid", gap: "1.2rem" }}>
        {/* Seed */}
        <div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>Seed (UInt32)</span>
            <input
              type="number"
              min="0"
              max={Math.pow(2, 32) - 1}
              value={config.seed}
              onChange={(e) =>
                updateConfig({
                  seed: asUInt32(Math.floor(e.target.valueAsNumber)),
                })
              }
              style={{
                padding: "0.5rem",
                border: "1px solid #ccc",
                borderRadius: "4px",
                width: "160px",
              }}
            />
          </label>
        </div>

        {/* Timestep */}
        <div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>Timestep (ms)</span>
            <input
              type="number"
              min="1"
              value={config.dt_ms}
              onChange={(e) =>
                updateConfig({ dt_ms: Math.floor(e.target.valueAsNumber) })
              }
              style={{
                padding: "0.5rem",
                border: "1px solid #ccc",
                borderRadius: "4px",
                width: "100px",
              }}
            />
          </label>
        </div>

        {/* Max Time */}
        <div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>Max Time (ms)</span>
            <input
              type="number"
              min="1"
              value={config.t_max_ms}
              onChange={(e) =>
                updateConfig({ t_max_ms: Math.floor(e.target.valueAsNumber) })
              }
              style={{
                padding: "0.5rem",
                border: "1px solid #ccc",
                borderRadius: "4px",
                width: "120px",
              }}
            />
          </label>
        </div>

        <hr style={{ margin: "1rem 0", border: "none", borderTop: "1px solid #ddd" }} />

        {/* Heart params */}
        <div>
          <h4 style={{ margin: "0.5rem 0 1rem 0" }}>Heart Parameters</h4>

          {/* base_capacity */}
          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>Base Capacity</span>
              <span style={{ color: "#666" }}>
                {config.heart.base_capacity.toFixed(2)}
              </span>
            </label>
            <input
              type="range"
              min="0.1"
              max="10"
              step="0.1"
              value={config.heart.base_capacity}
              onChange={(e) =>
                updateHeart({
                  base_capacity: parseFloat(e.target.value),
                })
              }
              style={{ width: "100%", marginTop: "0.5rem" }}
            />
          </div>

          {/* capacity_max */}
          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>Max Capacity</span>
              <span style={{ color: "#666" }}>
                {config.heart.capacity_max.toFixed(2)}
              </span>
            </label>
            <input
              type="range"
              min={Math.max(0.1, config.heart.base_capacity)}
              max="20"
              step="0.1"
              value={config.heart.capacity_max}
              onChange={(e) =>
                updateHeart({
                  capacity_max: parseFloat(e.target.value),
                })
              }
              style={{ width: "100%", marginTop: "0.5rem" }}
            />
          </div>

          {/* resonance_tau_ms */}
          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>Resonance Tau (ms)</span>
              <span style={{ color: "#666" }}>
                {config.heart.resonance_tau_ms.toFixed(0)}
              </span>
            </label>
            <input
              type="range"
              min="10"
              max="10000"
              step="10"
              value={config.heart.resonance_tau_ms}
              onChange={(e) =>
                updateHeart({
                  resonance_tau_ms: parseFloat(e.target.value),
                })
              }
              style={{ width: "100%", marginTop: "0.5rem" }}
            />
          </div>

          {/* resonance_gain */}
          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>Resonance Gain</span>
              <span style={{ color: "#666" }}>
                {config.heart.resonance_gain.toFixed(2)}
              </span>
            </label>
            <input
              type="range"
              min="0"
              max="5"
              step="0.1"
              value={config.heart.resonance_gain}
              onChange={(e) =>
                updateHeart({
                  resonance_gain: parseFloat(e.target.value),
                })
              }
              style={{ width: "100%", marginTop: "0.5rem" }}
            />
          </div>

          {/* capacity_gain */}
          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>Capacity Gain</span>
              <span style={{ color: "#666" }}>
                {config.heart.capacity_gain.toFixed(2)}
              </span>
            </label>
            <input
              type="range"
              min="0"
              max="3"
              step="0.1"
              value={config.heart.capacity_gain}
              onChange={(e) =>
                updateHeart({
                  capacity_gain: parseFloat(e.target.value),
                })
              }
              style={{ width: "100%", marginTop: "0.5rem" }}
            />
          </div>

          {/* fill_drain_rate */}
          <div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>Fill Drain Rate (0–1)</span>
              <span style={{ color: "#666" }}>
                {config.heart.fill_drain_rate.toFixed(3)}
              </span>
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={config.heart.fill_drain_rate}
              onChange={(e) =>
                updateHeart({
                  fill_drain_rate: parseFloat(e.target.value),
                })
              }
              style={{ width: "100%", marginTop: "0.5rem" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
