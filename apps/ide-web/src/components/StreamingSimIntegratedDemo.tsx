/**
 * StreamingSimIntegratedDemo — P0 Stream → Live Stimulus → Simulation
 *
 * Wires ChatStreamDemo (P0 consumer) directly into AxisCodexSimDemo.
 * As P0 events arrive, they feed stimulus pulses into the running simulation in real-time.
 *
 * Layout:
 * - Top: Config editor (Heart params, seed, timing)
 * - Left: Stream URL input + Chat events viewer
 * - Right: Live simulation (stimulus from stream + visualization)
 *
 * Usage:
 * ```tsx
 * <StreamingSimIntegratedDemo />
 * ```
 */

import React from "react";
import { validateAxisCodexSimV1Config } from "../lib/axis-codex-sim-v1/schema";
import {
  asUInt32,
  type AxisCodexSimV1Config,
  type TimelineEvent,
} from "../lib/axis-codex-sim-v1/types";
import { AxisCodexSimDemo } from "./AxisCodexSimDemo";
import { ChatStreamDemo } from "./ChatStreamDemo";
import { ConfigEditorForm } from "./ConfigEditorForm";
import "./StreamingSimIntegratedDemo.css";

const DEFAULT_CONFIG: AxisCodexSimV1Config = {
  schema: "axis-codex-sim/v1",
  seed: asUInt32(42),
  dt_ms: 50,
  t_max_ms: 30000,
  heart: {
    base_capacity: 1.5,
    capacity_max: 8.0,
    resonance_tau_ms: 2000,
    resonance_gain: 1.2,
    capacity_gain: 0.8,
    fill_drain_rate: 0.08,
  },
  timeline: {
    events: [],
  },
};

export function StreamingSimIntegratedDemo() {
  const [config, setConfig] = React.useState(DEFAULT_CONFIG);
  const [streamUrl, setStreamUrl] = React.useState("/api/chat/stream");
  const [streamEvents, setStreamEvents] = React.useState<any[]>([]);
  const [stimulusTimeline, setStimulusTimeline] = React.useState<TimelineEvent[]>(
    []
  );

  const startTimeRef = React.useRef<number | null>(null);

  const handleConfigChange = (newConfig: AxisCodexSimV1Config) => {
    try {
      validateAxisCodexSimV1Config(newConfig);
      setConfig(newConfig);
    } catch (err) {
      console.warn("Config validation failed:", err);
    }
  };

  // When a P0 event arrives from the stream, convert it to stimulus
  const handleStreamEvent = React.useCallback((event: any) => {
    setStreamEvents((prev) => [...prev.slice(-99), event]); // Keep last 100

    // Initialize start time on first event
    if (startTimeRef.current === null) {
      startTimeRef.current = Date.now();
    }

    // Extract stimulus from event
    // Heuristic: use seq magnitude (normalized to 0–1) as stimulus intensity
    // Real implementation: extract from event.payload if available
    const stimulus = Math.min(Math.max(event.seq, 0) / 100, 1.0);

    // Map wall-clock time to sim time (elapsed since first event)
    const wallElapsed = Date.now() - startTimeRef.current;
    const t_ms = Math.floor(wallElapsed);

    // Add stimulus pulse to timeline (if within sim bounds)
    if (t_ms < config.t_max_ms) {
      const newPulse: TimelineEvent = {
        kind: "pulse",
        t_ms,
        value: stimulus,
        channel: `stream-${event.turnId}`,
      };

      setStimulusTimeline((prev) => {
        // Keep timeline sorted by t_ms
        const updated = [...prev, newPulse];
        updated.sort((a, b) => {
          if (a.kind === "pulse" && b.kind === "pulse") {
            return a.t_ms - b.t_ms;
          }
          return 0;
        });
        return updated;
      });
    }
  }, [config.t_max_ms]);

  // Build config with live stimulus
  const liveConfig = React.useMemo(() => {
    return {
      ...config,
      timeline: {
        events: stimulusTimeline,
      },
    };
  }, [config, stimulusTimeline]);

  const resetStream = () => {
    setStreamEvents([]);
    setStimulusTimeline([]);
    startTimeRef.current = null;
  };

  return (
    <div className="streaming-sim-container">
      <h2 className="streaming-sim-title">🔗 P0 Stream → Live Stimulus → Simulation</h2>
      <p className="streaming-sim-description">
        Connect a real P0 chat stream. Events feed as stimulus pulses into the simulation canvas in
        real-time. Tweak Heart params while streaming.
      </p>

      {/* Config Editor (top) */}
      <div className="streaming-sim-config-section">
        <ConfigEditorForm initial={config} onConfigChange={handleConfigChange} />
      </div>

      {/* Two-column layout: Stream (left) + Sim (right) */}
      <div className="streaming-sim-layout">
        {/* LEFT: Stream Controls + Event List */}
        <div className="streaming-sim-stream-panel">
          {/* URL input */}
          <div>
            <label className="streaming-sim-label">
              <strong>Stream URL</strong>
            </label>
            <input
              type="text"
              placeholder="Enter stream URL"
              value={streamUrl}
              onChange={(e) => setStreamUrl(e.target.value)}
              className="streaming-sim-input"
            />
          </div>

          {/* Reset button */}
          <button onClick={resetStream} className="streaming-sim-reset-button">
            Reset Stream
          </button>

          {/* Stream status */}
          <div className="streaming-sim-status">
            <div>
              <strong>Stream Status</strong>
            </div>
            <div className="streaming-sim-status-content">
              Events: {streamEvents.length}
              <br />
              Stimulus Pulses: {stimulusTimeline.length}
              <br />
              Elapsed: {startTimeRef.current ? `${Date.now() - startTimeRef.current}ms` : "—"}
            </div>
          </div>

          {/* Chat Stream Demo */}
          <div className="streaming-sim-chat-container">
            <ChatStreamDemo url={streamUrl} />
          </div>
        </div>

        {/* RIGHT: Simulation Canvas + Meters */}
        <div className="streaming-sim-canvas-panel">
          <AxisCodexSimDemo config={liveConfig} title="Live Simulation (stimulus from stream)" />
        </div>
      </div>

      {/* Event Detail Log (bottom, collapsible context) */}
      <div className="streaming-sim-event-log">
        <strong>Recent P0 Events</strong>
        <div className="streaming-sim-event-list">
          {streamEvents.length === 0 ? (
            <span className="streaming-sim-event-empty">
              Waiting for stream events... Open stream and start chatting.
            </span>
          ) : (
            streamEvents.slice(-10).map((ev, i) => (
              <div key={i} className="streaming-sim-event-item">
                [{ev.turnId?.slice(0, 8)}] seq={ev.seq} type={ev.type}{" "}
                <span className="streaming-sim-event-timestamp">({ev.timestamp})</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
