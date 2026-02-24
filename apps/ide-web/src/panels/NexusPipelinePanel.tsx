import type { Objective } from "@world-engine/nexus-pipeline";
import { DEFAULT_TEMPLATES, runPipeline } from "@world-engine/nexus-pipeline";
import React, { useMemo, useState } from "react";

const objectives: { key: Objective; label: string }[] = [
  { key: "readability", label: "Readability" },
  { key: "modularity", label: "Modularity" },
  { key: "minimal_diff", label: "Minimal Diff" },
];

export function NexusPipelinePanel() {
  const [input, setInput] = useState("users.map(u => u.name).filter(isActive)");
  const [density, setDensity] = useState(55);
  const [objective, setObjective] = useState<Objective>("readability");

  const result = useMemo(() => {
    return runPipeline({
      input,
      domain: "auto",
      density,
      objective,
      templates: DEFAULT_TEMPLATES,
      maxCandidates: 10,
    });
  }, [input, density, objective]);

  return (
    <div className="h-full w-full flex flex-col bg-slate-950 text-slate-200">
      <div className="p-3 border-b border-slate-800 flex items-center gap-3">
        <div className="text-xs font-black tracking-widest uppercase text-cyan-400">
          Nexus Pipeline
        </div>
        <div className="ml-auto flex items-center gap-2">
          <select
            aria-label="Select optimization objective"
            value={objective}
            onChange={(e) => setObjective(e.target.value as Objective)}
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs"
          >
            {objectives.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2 text-[10px] uppercase text-slate-500">
            <label htmlFor="density-slider" className="whitespace-nowrap">Density</label>
            <input
              id="density-slider"
              aria-label="Density slider"
              type="range"
              min={0}
              max={100}
              value={density}
              onChange={(e) => setDensity(Number.parseInt(e.target.value, 10))}
              className="w-24"
            />
            <span className="text-slate-300 font-mono">{density}%</span>
          </div>

          <div className="text-[10px] text-slate-600 font-mono">
            {result.seedHex} / {result.domain.toUpperCase()}
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-3 p-3 overflow-hidden">
        <div className="flex flex-col gap-2 overflow-hidden">
          <div className="text-[10px] uppercase tracking-widest text-slate-500">Input</div>
          <textarea
            aria-label="Pipeline input code"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter code to optimize..."
            className="flex-1 bg-slate-900 border border-slate-800 rounded p-2 text-xs font-mono resize-none outline-none"
          />
        </div>

        <div className="flex flex-col gap-2 overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-widest text-slate-500">Candidates</div>
            <div className="text-[10px] text-emerald-300 font-mono">
              BEST: {result.bestId ?? "none"}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2">
            {result.candidates.map((c) => {
              const best = c.id === result.bestId;
              return (
                <div
                  key={c.id}
                  className={`border rounded p-2 ${best ? "border-emerald-500/70 bg-emerald-500/5" : "border-slate-800 bg-slate-900"}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] text-cyan-300 font-mono">{c.templateId}</div>
                    <div className="text-[10px] text-green-400 font-mono">
                      {(c.score * 100).toFixed(0)}%{best ? " ★" : ""}
                    </div>
                  </div>
                  <div className="mt-2 text-[10px] text-slate-500 font-mono">
                    r:{(c.features.readability * 100).toFixed(0)} m:
                    {(c.features.modularity * 100).toFixed(0)} d:
                    {(c.features.minimal_diff * 100).toFixed(0)}
                  </div>
                  <pre className="mt-2 text-xs font-mono whitespace-pre-wrap bg-black/40 border border-slate-800 rounded p-2 overflow-auto max-h-48">
                    {c.value}
                  </pre>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[10px] text-slate-400">
                      Provenance
                    </summary>
                    <pre className="mt-2 text-[10px] text-slate-500 bg-black/40 border border-slate-800 rounded p-2 overflow-auto max-h-48">
                      {JSON.stringify(c.provenance, null, 2)}
                    </pre>
                  </details>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
