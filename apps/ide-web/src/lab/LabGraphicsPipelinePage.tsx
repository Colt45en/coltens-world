import { Check, Palette, Wind, Zap } from "lucide-react";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  WINDOWS_DEV_PIPELINE_STEPS,
  WINDOWS_DEV_VERIFY_BLOCKS,
  WINDOWS_DEV_VERIFY_COMMANDS,
} from "./devEnvironmentPipeline";
import { GlassPanel, NeonButton, NeonTitle } from "../ui/neon";

export function LabGraphicsPipelinePage() {
  const navigate = useNavigate();
  const [compileStatus, setCompileStatus] = useState<"idle" | "compiling" | "success" | "error">(
    "idle",
  );
  const [shaderStats, setShaderStats] = useState({
    totalShaders: 42,
    compiledShaders: 42,
    failedShaders: 0,
    avgCompileTime: 1.2,
  });
  const [copiedBlock, setCopiedBlock] = useState<string | null>(null);

  const handleRecompileShaders = () => {
    setCompileStatus("compiling");
    setTimeout(() => {
      setCompileStatus("success");
      setShaderStats((s) => ({
        ...s,
        compiledShaders: s.totalShaders,
        failedShaders: 0,
      }));
    }, 1500);
  };

  const copyBlockCommands = async (id: string, commands: string[]) => {
    const payload = commands.join("\n");
    try {
      await navigator.clipboard.writeText(payload);
      setCopiedBlock(id);
      globalThis.setTimeout(() => setCopiedBlock((current) => (current === id ? null : current)), 1200);
    } catch {
      // no-op: clipboard can fail in restricted contexts
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <GlassPanel className="rounded-2xl p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <NeonTitle as="h2" className="text-2xl flex items-center gap-2">
              <Palette className="text-pink-400" />
              Graphics Pipeline
            </NeonTitle>
            <p className="text-white/60 mt-2">
              Real-time rendering engine with shader compilation, material management, and
              post-processing effects. Optimized for responsive 60+ FPS performance.
            </p>
          </div>
          <NeonButton variant="ghost" onClick={() => navigate("/")} className="ml-4">
            Back
          </NeonButton>
        </div>

        {/* Control Bar */}
        <div className="mt-4 flex items-center gap-4">
          <button
            onClick={handleRecompileShaders}
            disabled={compileStatus === "compiling"}
            className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all ${
              compileStatus === "compiling"
                ? "bg-slate-500/20 border border-slate-500 text-slate-300 cursor-not-allowed"
                : compileStatus === "success"
                  ? "bg-green-500/20 border border-green-500 text-green-300 hover:bg-green-500/30"
                  : "bg-blue-500/20 border border-blue-500 text-blue-300 hover:bg-blue-500/30"
            }`}
          >
            <Zap size={18} />
            {compileStatus === "compiling"
              ? "Compiling..."
              : compileStatus === "success"
                ? "Recompile"
                : "Compile Shaders"}
          </button>

          <div className="flex-1 flex items-center gap-4 ml-4">
            <div
              className={`w-3 h-3 rounded-full ${
                compileStatus === "success"
                  ? "bg-green-400"
                  : compileStatus === "compiling"
                    ? "bg-yellow-400 animate-pulse"
                    : compileStatus === "error"
                      ? "bg-red-400"
                      : "bg-slate-500"
              }`}
            />
            <span className="text-sm text-white/70">
              {compileStatus === "idle" && "Shaders ready"}
              {compileStatus === "compiling" && "Compiling WebGL shaders..."}
              {compileStatus === "success" && "All shaders compiled successfully"}
              {compileStatus === "error" && "Compilation error"}
            </span>
          </div>
        </div>
      </GlassPanel>

      {/* Viewport */}
      <GlassPanel className="rounded-2xl p-4">
        <div className="bg-gradient-to-br from-slate-950 to-slate-900 rounded-lg p-4 min-h-[350px] flex items-center justify-center border border-slate-800">
          <div className="text-center">
            <Palette className="w-16 h-16 text-pink-400/30 mx-auto mb-4" />
            <p className="text-white/40 text-sm">WebGL rendering viewport</p>
            <p className="text-white/30 text-xs mt-2">
              Real-time shader output and post-processing
            </p>
          </div>
        </div>
      </GlassPanel>

      {/* Shader Statistics */}
      <GlassPanel className="rounded-2xl p-4">
        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
          <Check size={16} className="text-cyan-400" />
          Shader Compilation Status
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-950/30 rounded p-3">
            <div className="text-xs text-white/50 mb-1">Total</div>
            <div className="text-2xl font-bold text-cyan-400">{shaderStats.totalShaders}</div>
            <div className="text-xs text-white/40 mt-1">shaders</div>
          </div>

          <div className="bg-slate-950/30 rounded p-3">
            <div className="text-xs text-white/50 mb-1">Compiled</div>
            <div className="text-2xl font-bold text-green-400">{shaderStats.compiledShaders}</div>
            <div className="text-xs text-white/40 mt-1">success</div>
          </div>

          <div className="bg-slate-950/30 rounded p-3">
            <div className="text-xs text-white/50 mb-1">Failed</div>
            <div className="text-2xl font-bold text-red-400">{shaderStats.failedShaders}</div>
            <div className="text-xs text-white/40 mt-1">errors</div>
          </div>

          <div className="bg-slate-950/30 rounded p-3">
            <div className="text-xs text-white/50 mb-1">Avg Time</div>
            <div className="text-2xl font-bold text-amber-400">{shaderStats.avgCompileTime}ms</div>
            <div className="text-xs text-white/40 mt-1">per shader</div>
          </div>
        </div>
      </GlassPanel>

      {/* Pipeline Stages */}
      <GlassPanel className="rounded-2xl p-4">
        <h3 className="font-bold text-white mb-4">Rendering Pipeline</h3>

        <div className="space-y-2">
          {[
            { name: "Vertex Shader", status: "compiled", color: "text-blue-400" },
            { name: "Fragment Shader", status: "compiled", color: "text-purple-400" },
            { name: "Post-Processing", status: "compiled", color: "text-pink-400" },
            { name: "Bloom Filter", status: "compiled", color: "text-amber-400" },
            { name: "Shadow Mapping", status: "compiled", color: "text-cyan-400" },
          ].map((stage) => (
            <div
              key={stage.name}
              className="flex items-center justify-between p-2 bg-slate-950/30 rounded"
            >
              <span className={`text-sm font-mono ${stage.color}`}>{stage.name}</span>
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    stage.status === "compiled" ? "bg-green-400" : "bg-yellow-400"
                  }`}
                />
                <span className="text-xs text-white/60 capitalize">{stage.status}</span>
              </div>
            </div>
          ))}
        </div>
      </GlassPanel>

      {/* Post-Processing Effects */}
      <GlassPanel className="rounded-2xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-bold text-white/90 mb-2 flex items-center gap-2">
              <Wind size={14} className="text-cyan-400" />
              Post-Processing Effects
            </h4>
            <ul className="text-xs text-white/60 space-y-1">
              <li>✓ Bloom & Glow</li>
              <li>✓ Depth of Field</li>
              <li>✓ Motion Blur</li>
              <li>✓ Color Grading</li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white/90 mb-2 flex items-center gap-2">
              <Palette size={14} className="text-pink-400" />
              Material System
            </h4>
            <ul className="text-xs text-white/60 space-y-1">
              <li>✓ PBR Materials</li>
              <li>✓ Normal Mapping</li>
              <li>✓ Parallax Mapping</li>
              <li>✓ Metal/Roughness</li>
            </ul>
          </div>
        </div>
      </GlassPanel>

      {/* System Info */}
      <GlassPanel className="rounded-2xl p-4">
        <details className="text-xs">
          <summary className="cursor-pointer text-white/50 hover:text-white/70 font-bold">
            System Info
          </summary>
          <div className="mt-3 space-y-1 font-mono text-white/40 text-[11px]">
            <div>• Graphics API: WebGL 2.0</div>
            <div>• Shader Language: GLSL ES 3.0</div>
            <div>• Renderer: Three.js/Babylon.js integration</div>
            <div>• Features: real-time compilation, hot reload, error reporting</div>
            <div>• Performance: optimized for 60+ FPS on mid-range hardware</div>
          </div>
        </details>
      </GlassPanel>

      {/* Windows 10 Pro Development Pipeline */}
      <GlassPanel className="rounded-2xl p-4">
        <h3 className="font-bold text-white mb-4">Graphics Pipeline · Windows Dev Process</h3>

        <div className="space-y-2">
          {WINDOWS_DEV_PIPELINE_STEPS.map((step) => (
            <div
              key={step.id}
              className="flex items-start gap-3 p-2 bg-slate-950/30 rounded border border-slate-800"
            >
              <span className="font-mono text-[11px] text-cyan-400 mt-0.5">{step.id}</span>
              <div>
                <div className="text-sm text-white/90 font-semibold">{step.name}</div>
                <div className="text-xs text-white/60">{step.purpose}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 bg-slate-950/30 rounded border border-slate-800">
          <div className="text-xs font-bold text-white/80 mb-2">Verification Commands</div>
          <div className="mb-3 space-y-2">
            {WINDOWS_DEV_VERIFY_BLOCKS.map((block) => (
              <div
                key={block.id}
                className="flex items-center justify-between gap-3 p-2 rounded border border-slate-700"
              >
                <div className="text-xs text-white/75">{block.label}</div>
                <button
                  type="button"
                  onClick={() => void copyBlockCommands(block.id, block.commands)}
                  className="px-2 py-1 text-[11px] rounded border border-cyan-500/60 text-cyan-300 hover:bg-cyan-500/10"
                >
                  {copiedBlock === block.id ? "Copied" : "Copy"}
                </button>
              </div>
            ))}
          </div>
          <div className="font-mono text-[11px] text-white/60 space-y-1">
            {WINDOWS_DEV_VERIFY_COMMANDS.map((command) => (
              <div key={command}>• {command}</div>
            ))}
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}
