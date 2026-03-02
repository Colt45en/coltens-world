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
import "./ConfigEditorForm.css";

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
    <div className="config-editor-form">
      <h3 className="config-editor-form__title">Config Editor</h3>

      {error && (
        <div className="config-editor-form__error">
          ⚠️ {error}
        </div>
      )}

      <div className="config-editor-form__grid">
        {/* Seed */}
        <div>
          <label className="config-editor-form__label">
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
              className="config-editor-form__input config-editor-form__input--wide"
            />
          </label>
        </div>

        {/* Timestep */}
        <div>
          <label className="config-editor-form__label">
            <span>Timestep (ms)</span>
            <input
              type="number"
              min="1"
              value={config.dt_ms}
              onChange={(e) =>
                updateConfig({ dt_ms: Math.floor(e.target.valueAsNumber) })
              }
              className="config-editor-form__input config-editor-form__input--medium"
            />
          </label>
        </div>

        {/* Max Time */}
        <div>
          <label className="config-editor-form__label">
            <span>Max Time (ms)</span>
            <input
              type="number"
              min="1"
              value={config.t_max_ms}
              onChange={(e) =>
                updateConfig({ t_max_ms: Math.floor(e.target.valueAsNumber) })
              }
              className="config-editor-form__input config-editor-form__input--medium"
            />
          </label>
        </div>

        <hr className="config-editor-form__divider" />

        {/* Heart params */}
        <div>
          <h4 className="config-editor-form__subtitle">Heart Parameters</h4>

          {/* base_capacity */}
          <div className="config-editor-form__field">
            <label className="config-editor-form__label">
              <span>Base Capacity</span>
              <span className="config-editor-form__value">
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
              className="config-editor-form__range"
            />
          </div>

          {/* capacity_max */}
          <div className="config-editor-form__field">
            <label className="config-editor-form__label">
              <span>Max Capacity</span>
              <span className="config-editor-form__value">
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
              className="config-editor-form__range"
            />
          </div>

          {/* resonance_tau_ms */}
          <div className="config-editor-form__field">
            <label className="config-editor-form__label">
              <span>Resonance Tau (ms)</span>
              <span className="config-editor-form__value">
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
              className="config-editor-form__range"
            />
          </div>

          {/* resonance_gain */}
          <div className="config-editor-form__field">
            <label className="config-editor-form__label">
              <span>Resonance Gain</span>
              <span className="config-editor-form__value">
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
              className="config-editor-form__range"
            />
          </div>

          {/* capacity_gain */}
          <div className="config-editor-form__field">
            <label className="config-editor-form__label">
              <span>Capacity Gain</span>
              <span className="config-editor-form__value">
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
              className="config-editor-form__range"
            />
          </div>

          {/* fill_drain_rate */}
          <div className="config-editor-form__field">
            <label className="config-editor-form__label">
              <span>Fill Drain Rate (0–1)</span>
              <span className="config-editor-form__value">
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
              className="config-editor-form__range"
              title="Fill Drain Rate (0–1)"
              aria-label="Fill Drain Rate"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
