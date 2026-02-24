import { Cpu, Home, Network } from "lucide-react";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import OntologyIDE from "./OntologyIDE";
import WorldEngineStudio from "./WorldEngineStudio";

type StudioMode = "ontology" | "engine";

export default function StudioHub() {
  const [mode, setMode] = useState<StudioMode>("ontology");
  const navigate = useNavigate();

  return (
    <div className="w-full h-screen bg-slate-950">
      {/* Mode Switcher Header */}
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur">
        <div className="flex items-center gap-2 p-3 max-w-full overflow-x-auto">
          <button
            onClick={() => setMode("ontology")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm transition-all whitespace-nowrap ${
              mode === "ontology"
                ? "bg-cyan-950/50 border border-cyan-500/50 text-cyan-300"
                : "bg-slate-800 border border-slate-700 text-slate-400 hover:border-slate-600"
            }`}
          >
            <Network size={16} />
            Ontology IDE
          </button>
          <button
            onClick={() => setMode("engine")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm transition-all whitespace-nowrap ${
              mode === "engine"
                ? "bg-indigo-950/50 border border-indigo-500/50 text-indigo-300"
                : "bg-slate-800 border border-slate-700 text-slate-400 hover:border-slate-600"
            }`}
          >
            <Cpu size={16} />
            World Engine Studio
          </button>

          <div className="flex-1" />

          <button
            onClick={() => navigate("/?home=1")}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-xs transition-all whitespace-nowrap bg-slate-800 border border-slate-700 text-slate-300 hover:border-cyan-500/50 hover:text-cyan-300"
            title="Return to Dashboard"
            aria-label="Return to Dashboard"
          >
            <Home size={14} />
            DASHBOARD
          </button>

          <div className="text-xs text-slate-500 font-mono px-3 py-1 bg-slate-800 rounded border border-slate-700">
            {mode === "ontology" ? "CONCEPT EDITOR" : "STATE EVOLUTION"}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="w-full h-[calc(100vh-53px)] overflow-hidden">
        {mode === "ontology" && <OntologyIDE />}
        {mode === "engine" && <WorldEngineStudio />}
      </div>
    </div>
  );
}
