import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { generatePrefab, meshToOBJ, type PrefabKind } from "@world-engine/lego-prefab";
import { GlassPanel, NeonButton, NeonTitle } from "../ui/neon";
import { ROUTES } from "../world/routes";

type PrefabRecord = {
  kind: PrefabKind;
  obj: string;
  triCount: number;
  createdAt: string;
  metrics: PrefabMetrics;
};

type PrefabMetrics = {
  scale: number;
  positionX: number;
  positionY: number;
  positionZ: number;
  rotationYDeg: number;
  countX: number;
  countZ: number;
  spacing: number;
};

const PREFAB_STORAGE_KEY = "world-engine.prefab.latest";
const PREFAB_READY_EVENT = "world-engine:prefab-ready";

const PREFAB_OPTIONS: Array<{ kind: PrefabKind; label: string }> = [
  { kind: "brick_2x4", label: "Brick 2x4" },
  { kind: "slope_2x2", label: "Slope 2x2" },
  { kind: "arc_tile_90", label: "Arc Tile 90°" },
  { kind: "technic_beam_7", label: "Technic Beam 7" },
  { kind: "round_2x2", label: "Round Brick 2x2" },
  { kind: "arch_4x2", label: "Arch 4x2" },
  { kind: "hinge_2x4", label: "Hinge Plate 2x4" },
  { kind: "axle_8L", label: "Technic Axle 8L" },
];

const DEFAULT_METRICS: PrefabMetrics = {
  scale: 1,
  positionX: 0,
  positionY: 0,
  positionZ: 0,
  rotationYDeg: 0,
  countX: 1,
  countZ: 1,
  spacing: 40,
};

function makePrefabRecord(kind: PrefabKind, metrics: PrefabMetrics): PrefabRecord {
  const mesh = generatePrefab(kind);
  const obj = meshToOBJ(mesh, {
    name: `${kind}_${new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-")}`,
    scaleMm: true,
  });
  return {
    kind,
    obj,
    triCount: mesh.tris.length,
    createdAt: new Date().toISOString(),
    metrics,
  };
}

function downloadTextFile(fileName: string, content: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function LabPrefabEnginePage() {
  const navigate = useNavigate();
  const [selectedKind, setSelectedKind] = useState<PrefabKind>("brick_2x4");
  const [metrics, setMetrics] = useState<PrefabMetrics>(DEFAULT_METRICS);
  const [record, setRecord] = useState<PrefabRecord>(() => makePrefabRecord("brick_2x4", DEFAULT_METRICS));

  const selectedLabel = useMemo(
    () => PREFAB_OPTIONS.find((option) => option.kind === record.kind)?.label ?? record.kind,
    [record.kind],
  );

  const regenerate = () => {
    setRecord(makePrefabRecord(selectedKind, metrics));
  };

  const exportObj = () => {
    downloadTextFile(`${record.kind}.obj`, record.obj);
  };

  const launchToGameEnvironment = () => {
    localStorage.setItem(PREFAB_STORAGE_KEY, JSON.stringify(record));
    globalThis.dispatchEvent(
      new CustomEvent(PREFAB_READY_EVENT, {
        detail: {
          kind: record.kind,
          triCount: record.triCount,
          createdAt: record.createdAt,
          metrics: record.metrics,
        },
      }),
    );
    navigate(ROUTES.lab.gameEngine);
  };

  const setMetric = (key: keyof PrefabMetrics, raw: string) => {
    const numeric = Number(raw);
    if (!Number.isFinite(numeric)) return;
    setMetrics((current) => ({
      ...current,
      [key]: key === "countX" || key === "countZ" ? Math.max(1, Math.floor(numeric)) : numeric,
    }));
  };

  return (
    <div className="space-y-4">
      <GlassPanel className="rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <NeonTitle as="h2" className="text-2xl">
              Prefab Engine
            </NeonTitle>
            <p className="text-white/60 mt-2">
              Generate LEGO-style prefabs, export OBJ, and pipeline straight into the Game Engine
              environment.
            </p>
          </div>
          <NeonButton variant="ghost" onClick={() => navigate(ROUTES.root)}>
            Back
          </NeonButton>
        </div>
      </GlassPanel>

      <GlassPanel className="rounded-2xl p-4 space-y-3">
        <div className="text-sm text-white/70">Prefab Template</div>
        <select
          title="Prefab template"
          value={selectedKind}
          onChange={(event) => setSelectedKind(event.target.value as PrefabKind)}
          className="w-full bg-slate-900/70 border border-white/15 rounded-lg px-3 py-2 text-white"
        >
          {PREFAB_OPTIONS.map((option) => (
            <option key={option.kind} value={option.kind}>
              {option.label}
            </option>
          ))}
        </select>

        <div className="text-sm text-white/70 mt-2">Spawn Metrics</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <label className="space-y-1">
            <span className="text-white/60">Scale</span>
            <input type="number" step="0.1" value={metrics.scale} onChange={(event) => setMetric("scale", event.target.value)} className="w-full bg-slate-900/70 border border-white/15 rounded px-2 py-1 text-white" />
          </label>
          <label className="space-y-1">
            <span className="text-white/60">Pos X</span>
            <input type="number" step="1" value={metrics.positionX} onChange={(event) => setMetric("positionX", event.target.value)} className="w-full bg-slate-900/70 border border-white/15 rounded px-2 py-1 text-white" />
          </label>
          <label className="space-y-1">
            <span className="text-white/60">Pos Y</span>
            <input type="number" step="1" value={metrics.positionY} onChange={(event) => setMetric("positionY", event.target.value)} className="w-full bg-slate-900/70 border border-white/15 rounded px-2 py-1 text-white" />
          </label>
          <label className="space-y-1">
            <span className="text-white/60">Pos Z</span>
            <input type="number" step="1" value={metrics.positionZ} onChange={(event) => setMetric("positionZ", event.target.value)} className="w-full bg-slate-900/70 border border-white/15 rounded px-2 py-1 text-white" />
          </label>
          <label className="space-y-1">
            <span className="text-white/60">Rotate Y°</span>
            <input type="number" step="1" value={metrics.rotationYDeg} onChange={(event) => setMetric("rotationYDeg", event.target.value)} className="w-full bg-slate-900/70 border border-white/15 rounded px-2 py-1 text-white" />
          </label>
          <label className="space-y-1">
            <span className="text-white/60">Count X</span>
            <input type="number" step="1" min={1} value={metrics.countX} onChange={(event) => setMetric("countX", event.target.value)} className="w-full bg-slate-900/70 border border-white/15 rounded px-2 py-1 text-white" />
          </label>
          <label className="space-y-1">
            <span className="text-white/60">Count Z</span>
            <input type="number" step="1" min={1} value={metrics.countZ} onChange={(event) => setMetric("countZ", event.target.value)} className="w-full bg-slate-900/70 border border-white/15 rounded px-2 py-1 text-white" />
          </label>
          <label className="space-y-1">
            <span className="text-white/60">Spacing</span>
            <input type="number" step="1" min={1} value={metrics.spacing} onChange={(event) => setMetric("spacing", event.target.value)} className="w-full bg-slate-900/70 border border-white/15 rounded px-2 py-1 text-white" />
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <NeonButton onClick={regenerate}>Generate Prefab</NeonButton>
          <NeonButton variant="ghost" onClick={exportObj}>
            Export OBJ
          </NeonButton>
          <NeonButton variant="ghost" onClick={launchToGameEnvironment}>
            Launch to Game Environment
          </NeonButton>
        </div>
      </GlassPanel>

      <GlassPanel className="rounded-2xl p-4">
        <div className="text-sm text-white/70 mb-3">Current Prefab</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-white/70">
          <div className="bg-slate-950/40 rounded-lg p-3">
            <div className="text-white/50">Name</div>
            <div className="mt-1 font-semibold text-white/90">{selectedLabel}</div>
          </div>
          <div className="bg-slate-950/40 rounded-lg p-3">
            <div className="text-white/50">Triangles</div>
            <div className="mt-1 font-semibold text-cyan-300">{record.triCount}</div>
          </div>
          <div className="bg-slate-950/40 rounded-lg p-3">
            <div className="text-white/50">Generated</div>
            <div className="mt-1 font-semibold text-white/90">{new Date(record.createdAt).toLocaleTimeString()}</div>
          </div>
        </div>
        <div className="mt-3 text-xs text-white/55">
          Spawn: {record.metrics.countX}x{record.metrics.countZ} @ spacing {record.metrics.spacing},
          pos ({record.metrics.positionX}, {record.metrics.positionY}, {record.metrics.positionZ}),
          rotY {record.metrics.rotationYDeg}°, scale {record.metrics.scale}
        </div>
      </GlassPanel>
    </div>
  );
}
