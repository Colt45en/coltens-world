import React, { useState } from "react";
import StudioHub from "../StudioHub";
import { GlassPanel } from "../ui/neon";
import { Maximize2, Minimize2, Code2, Layout } from "lucide-react";

export function LabStudioPage() {
  const [fullscreen, setFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState<"split" | "code" | "preview">("split");

  return (
    <div className="max-w-full mx-auto" style={{ height: fullscreen ? "100vh" : "auto" }}>
      <GlassPanel className="rounded-2xl p-3 mb-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-bold tracking-wide flex items-center gap-2">
              <Layout size={18} className="text-cyan-400" />
              Studio Lab
            </div>
            <div className="text-white/60 text-sm mt-1">
              Ontology IDE + World Engine Studio with real-time preview
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex gap-1 p-1 rounded-lg bg-black/30 border border-white/10">
              {[
                { mode: "split" as const, icon: Layout, label: "Split" },
                { mode: "code" as const, icon: Code2, label: "Code" },
                { mode: "preview" as const, icon: Maximize2, label: "Preview" },
              ].map(({ mode, icon: Icon, label }) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  title={label}
                  className={`px-3 py-1.5 rounded text-xs font-mono transition-all ${
                    viewMode === mode
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                      : "text-white/50 hover:text-white/70 border border-transparent"
                  }`}
                >
                  <Icon size={14} />
                </button>
              ))}
            </div>

            {/* Fullscreen Toggle */}
            <button
              onClick={() => setFullscreen(!fullscreen)}
              className="px-3 py-1.5 rounded-lg bg-black/30 border border-white/10 text-white/70 hover:text-white hover:border-cyan-500/40 transition-all"
              title={fullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
              {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          </div>
        </div>
      </GlassPanel>

      <div
        className="relative z-10"
        style={{
          height: fullscreen ? "calc(100vh - 80px)" : "calc(100vh - 120px)",
        }}
      >
        <StudioHub />
      </div>

      {!fullscreen && (
        <div className="mt-3 text-xs text-white/40 font-mono text-center">
          Press F11 for browser fullscreen • View Mode: {viewMode.toUpperCase()}
        </div>
      )}
    </div>
  );
}
