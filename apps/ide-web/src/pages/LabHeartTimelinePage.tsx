import React, { useMemo, useState } from "react";
import { AXIS_CODEX_V1, AXIS_LABELS_UI } from "../sim/heartTimeline/axisCodex";
import { runTimelineSimulation } from "../sim/heartTimeline/engine";
import { loadSimulationExportV1, serializeSimulationExportV1, serializeTimelineConfig } from "../sim/heartTimeline/io";
import { validateTimelineConfig } from "../sim/heartTimeline/schema";
import type { SimulationExportV1, TimelineConfig, TimelineSnapshot, VectorObject } from "../sim/heartTimeline/types";

type ProjectionMode = "xy" | "xz" | "yz";

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function fmt(n: number, digits = 4) {
  return Number.isFinite(n) ? n.toFixed(digits) : "--";
}

function makeDefaultConfig(): TimelineConfig {
  return {
    tick_count: 240,
    dt_seconds: 0.05,
    snapshot_every_ticks: 10,
    base_capacity: 4,
    seed: 42,
    axis_codex: AXIS_CODEX_V1,
    heart: {
      base_resonance: 0.2,
      pulse_amplitude: 0.75,
      pulse_frequency_hz: 0.33,
      damping: 0.45,
      min_capacity_scale: 0.25,
      max_capacity_scale: 2.0,
      resonance_to_capacity_gain: 0.8,
    },
    initial_objects: Array.from({ length: 18 }, (_, i) => ({
      id: `node_${String(i + 1).padStart(2, "0")}`,
      position: [((i % 6) - 2.5) * 0.5, (Math.floor(i / 6) - 1) * 0.4, (i % 3) * 0.35 - 0.35],
      velocity: [0.04 + (i % 3) * 0.01, 0.02 + (i % 4) * 0.005, -0.015 + (i % 5) * 0.004],
      axis_bias: [(i % 2 === 0 ? 1 : -1) * 0.8, ((i + 1) % 3) - 1, ((i + 2) % 4) * 0.25 - 0.25],
      energy: 1 - i * 0.02,
      active: true,
      tags: i % 2 === 0 ? ["seed", "cluster:a"] : ["seed", "cluster:b"],
    })),
  };
}

function project(obj: VectorObject, mode: ProjectionMode): { x: number; y: number } {
  if (mode === "xy") return { x: obj.position[0], y: obj.position[1] };
  if (mode === "xz") return { x: obj.position[0], y: obj.position[2] };
  return { x: obj.position[1], y: obj.position[2] };
}

function getSnapshotBounds(snapshot: TimelineSnapshot, mode: ProjectionMode) {
  if (snapshot.objects.length === 0) return { minX: -1, maxX: 1, minY: -1, maxY: 1 };
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const obj of snapshot.objects) {
    const p = project(obj, mode);
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const padX = Math.max(0.25, (maxX - minX) * 0.15);
  const padY = Math.max(0.25, (maxY - minY) * 0.15);
  return { minX: minX - padX, maxX: maxX + padX, minY: minY - padY, maxY: maxY + padY };
}

export default function LabHeartTimelinePage() {
  const [configText, setConfigText] = useState(() => serializeTimelineConfig(makeDefaultConfig()));
  const [replayImportText, setReplayImportText] = useState("");
  const [simulation, setSimulation] = useState<SimulationExportV1 | null>(null);
  const [tickIndex, setTickIndex] = useState(0);
  const [projection, setProjection] = useState<ProjectionMode>("xy");
  const [errorText, setErrorText] = useState("");

  const configValidation = useMemo(() => {
    try {
      return validateTimelineConfig(JSON.parse(configText) as unknown);
    } catch (error) {
      return { ok: false, errors: [{ path: "$", message: error instanceof Error ? error.message : "Invalid JSON" }] };
    }
  }, [configText]);

  const currentTick = simulation?.tick_log[tickIndex] ?? null;
  const currentSnapshot = useMemo(() => {
    if (!simulation) return null;
    let found: TimelineSnapshot | null = simulation.snapshots[0] ?? null;
    for (const snap of simulation.snapshots) {
      if (snap.tick <= tickIndex) found = snap;
      else break;
    }
    return found;
  }, [simulation, tickIndex]);

  const plotData = useMemo(() => {
    if (!currentSnapshot) return null;
    const bounds = getSnapshotBounds(currentSnapshot, projection);
    const width = 560;
    const height = 340;
    const sx = width / Math.max(1e-9, bounds.maxX - bounds.minX);
    const sy = height / Math.max(1e-9, bounds.maxY - bounds.minY);
    return {
      width,
      height,
      bounds,
      points: currentSnapshot.objects.map((obj) => {
        const p = project(obj, projection);
        return {
          id: obj.id,
          x: (p.x - bounds.minX) * sx,
          y: height - (p.y - bounds.minY) * sy,
          active: obj.active,
          energy: obj.energy,
        };
      }),
    };
  }, [currentSnapshot, projection]);

  const handleRun = () => {
    setErrorText("");
    try {
      const parsed = JSON.parse(configText) as unknown;
      const validation = validateTimelineConfig(parsed);
      if (!validation.ok) {
        setErrorText(validation.errors.map((e) => `${e.path}: ${e.message}`).join("\n"));
        return;
      }
      const cfg = parsed as TimelineConfig;
      const bounded: TimelineConfig = {
        ...cfg,
        axis_codex: AXIS_CODEX_V1,
        tick_count: Math.min(cfg.tick_count, 5000),
        initial_objects: cfg.initial_objects.slice(0, 1000),
      };
      const out = runTimelineSimulation(bounded, "ts");
      setSimulation(out);
      setTickIndex(0);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : String(error));
    }
  };

  const handleImportReplay = () => {
    setErrorText("");
    try {
      const loaded = loadSimulationExportV1(replayImportText);
      setSimulation(loaded);
      setTickIndex(0);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : String(error));
    }
  };

  const handleExportReplay = () => {
    if (!simulation) return;
    const blob = new Blob([serializeSimulationExportV1(simulation)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "axis-codex-sim-v1.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 text-white">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Heart Timeline Lab</h1>
        <p className="text-sm text-white/60">
          Deterministic `axis-codex-sim/v1` simulator + replay (Heart resonance drives capacity scaling).
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[430px_1fr] gap-4">
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">Timeline Config</div>
              <div className={`text-xs ${configValidation.ok ? "text-emerald-300" : "text-amber-300"}`}>
                {configValidation.ok ? "valid" : `${configValidation.errors.length} issue(s)`}
              </div>
            </div>
            <textarea
              className="w-full h-80 rounded-md border border-white/10 bg-black/30 p-2 font-mono text-xs"
              spellCheck={false}
              value={configText}
              onChange={(e) => setConfigText(e.target.value)}
            />
            <div className="mt-2 flex gap-2">
              <button type="button" className="px-3 py-2 rounded-md border border-cyan-300/30 bg-cyan-500/20 hover:bg-cyan-500/30" onClick={handleRun}>
                Run Simulation
              </button>
              <button type="button" className="px-3 py-2 rounded-md border border-white/10 bg-white/10 hover:bg-white/20" onClick={() => setConfigText(serializeTimelineConfig(makeDefaultConfig()))}>
                Reset
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="font-semibold mb-2">Import / Export Replay</div>
            <textarea
              className="w-full h-40 rounded-md border border-white/10 bg-black/30 p-2 font-mono text-xs"
              spellCheck={false}
              placeholder="Paste axis-codex-sim/v1 JSON replay here..."
              value={replayImportText}
              onChange={(e) => setReplayImportText(e.target.value)}
            />
            <div className="mt-2 flex gap-2">
              <button type="button" className="px-3 py-2 rounded-md border border-purple-300/30 bg-purple-500/20 hover:bg-purple-500/30" onClick={handleImportReplay}>
                Import Replay
              </button>
              <button type="button" disabled={!simulation} className="px-3 py-2 rounded-md border border-emerald-300/30 bg-emerald-500/20 hover:bg-emerald-500/30 disabled:opacity-50" onClick={handleExportReplay}>
                Export JSON
              </button>
            </div>
          </div>

          {errorText && (
            <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-3">
              <div className="font-semibold text-rose-200 mb-1">Error</div>
              <pre className="whitespace-pre-wrap text-xs font-mono text-rose-100/90">{errorText}</pre>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="font-semibold">Replay Inspector</div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-white/60">Projection</label>
                <select
                  className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-sm"
                  value={projection}
                  onChange={(e) => setProjection(e.target.value as ProjectionMode)}
                >
                  <option value="xy">XY ({AXIS_LABELS_UI.x} / {AXIS_LABELS_UI.y})</option>
                  <option value="xz">XZ ({AXIS_LABELS_UI.x} / {AXIS_LABELS_UI.z})</option>
                  <option value="yz">YZ ({AXIS_LABELS_UI.y} / {AXIS_LABELS_UI.z})</option>
                </select>
              </div>
            </div>

            {!simulation && <div className="text-sm text-white/60">Run a simulation or import a replay to inspect state over time.</div>}

            {simulation && (
              <>
                <div className="mb-3">
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0, simulation.tick_log.length - 1)}
                    value={tickIndex}
                    onChange={(e) => setTickIndex(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="mt-1 text-xs text-white/60">
                    Tick {tickIndex} / {Math.max(0, simulation.tick_log.length - 1)}
                  </div>
                </div>

                {currentTick && (
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 mb-3">
                    <MetricCard label="Resonance" value={fmt(currentTick.heart.resonance, 6)} />
                    <MetricCard label="Capacity Scale" value={fmt(currentTick.heart.capacity_scale, 6)} />
                    <MetricCard label="Momentum" value={fmt(currentTick.heart.momentum, 6)} />
                    <MetricCard label="Capacity Budget" value={String(currentTick.capacity_budget)} />
                    <MetricCard label="Processed" value={String(currentTick.processed_objects)} />
                    <MetricCard label="Deferred" value={String(currentTick.deferred_objects)} />
                  </div>
                )}

                {plotData && (
                  <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                    <svg viewBox={`0 0 ${plotData.width} ${plotData.height}`} className="w-full h-auto rounded bg-[#0b1220]">
                      <rect x={0} y={0} width={plotData.width} height={plotData.height} fill="#0b1220" />
                      <g opacity={0.18}>
                        {Array.from({ length: 11 }).map((_, i) => (
                          <line key={`v-${i}`} x1={(plotData.width / 10) * i} y1={0} x2={(plotData.width / 10) * i} y2={plotData.height} stroke="#8ab4f8" strokeWidth={1} />
                        ))}
                        {Array.from({ length: 7 }).map((_, i) => (
                          <line key={`h-${i}`} x1={0} y1={(plotData.height / 6) * i} x2={plotData.width} y2={(plotData.height / 6) * i} stroke="#8ab4f8" strokeWidth={1} />
                        ))}
                      </g>
                      {plotData.points.map((p) => (
                        <circle
                          key={p.id}
                          cx={p.x}
                          cy={p.y}
                          r={clamp(2 + p.energy * 3, 2, 6)}
                          fill={p.active ? "#22d3ee" : "#64748b"}
                          opacity={p.active ? 0.95 : 0.55}
                        />
                      ))}
                    </svg>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-white/60 font-mono">
                      <div>X [{fmt(plotData.bounds.minX, 3)}, {fmt(plotData.bounds.maxX, 3)}]</div>
                      <div>Y [{fmt(plotData.bounds.minY, 3)}, {fmt(plotData.bounds.maxY, 3)}]</div>
                    </div>
                  </div>
                )}

                {currentSnapshot && (
                  <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                    <div className="text-xs text-white/60 mb-2">
                      Snapshot @ tick {currentSnapshot.tick} • {currentSnapshot.objects.length} object(s)
                    </div>
                    <div className="max-h-56 overflow-auto font-mono text-xs">
                      <table className="w-full">
                        <thead className="text-white/50">
                          <tr>
                            <th className="text-left">id</th>
                            <th className="text-left">position</th>
                            <th className="text-left">energy</th>
                            <th className="text-left">active</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentSnapshot.objects.slice(0, 24).map((o) => (
                            <tr key={o.id} className="border-t border-white/5">
                              <td className="py-1">{o.id}</td>
                              <td className="py-1">[{fmt(o.position[0], 2)}, {fmt(o.position[1], 2)}, {fmt(o.position[2], 2)}]</td>
                              <td className="py-1">{fmt(o.energy, 3)}</td>
                              <td className="py-1">{o.active ? "yes" : "no"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/20 p-2">
      <div className="text-xs text-white/60">{label}</div>
      <div className="font-mono">{value}</div>
    </div>
  );
}
