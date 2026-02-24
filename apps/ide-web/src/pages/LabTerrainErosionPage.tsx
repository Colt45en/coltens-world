import React, { useEffect, useRef, useState } from "react";
import { GlassPanel, NeonButton, NeonTitle } from "../ui/neon";
import {
  DEFAULT_EROSION_PARAMS,
  erode,
  generateHeightmap,
  renderHeightmap,
  type ErosionParams,
} from "../utils/terrainErosion";
import "./LabTerrainErosionPage.css";

export function LabTerrainErosionPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState(256);
  const [params, setParams] = useState<ErosionParams>(DEFAULT_EROSION_PARAMS);
  const [isProcessing, setIsProcessing] = useState(false);
  const [heightmap, setHeightmap] = useState<Float32Array | null>(null);
  const [renderMode, setRenderMode] = useState<"before" | "after">("after");
  const [stats, setStats] = useState({ duration: 0, iterations: 0 });

  const generateTerrain = () => {
    const height = generateHeightmap(size);
    setHeightmap(height);
    setRenderMode("before");
    renderToCanvas(height);
  };

  const applyErosion = async () => {
    if (!heightmap) return;

    setIsProcessing(true);
    const heightCopy = new Float32Array(heightmap);

    // Run erosion in a timeout to allow UI to update
    setTimeout(() => {
      const start = performance.now();
      erode(heightCopy, size, params);
      const duration = performance.now() - start;

      setHeightmap(heightCopy);
      setRenderMode("after");
      setStats({ duration, iterations: params.iterations });
      renderToCanvas(heightCopy);
      setIsProcessing(false);
    }, 50);
  };

  const renderToCanvas = (height: Float32Array) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = size;
    canvas.height = size;

    const imageData = ctx.createImageData(size, size);
    renderHeightmap(height, size, imageData);
    ctx.putImageData(imageData, 0, 0);
  };

  useEffect(() => {
    generateTerrain();
  }, []);

  const updateParam = <K extends keyof ErosionParams>(key: K, value: ErosionParams[K]) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <NeonTitle as="h1" className="text-3xl">
          Terrain Erosion Lab
        </NeonTitle>
        <p className="text-white/60 mt-2">
          Particle-based hydraulic erosion simulation. Simulates water droplets eroding terrain with
          sediment transport.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
        {/* Canvas Viewer */}
        <GlassPanel className="rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-scifi text-sm tracking-widest text-white/85">HEIGHTMAP VIEWER</h2>
            <div className="flex gap-2">
              <button
                onClick={() => renderMode === "before" && heightmap && renderToCanvas(heightmap)}
                className={`px-3 py-1 rounded-lg text-xs font-mono transition-all ${
                  renderMode === "before"
                    ? "bg-cyan-500/30 text-cyan-300 border border-cyan-500/50"
                    : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10"
                }`}
              >
                BEFORE
              </button>
              <button
                onClick={() => renderMode === "after" && heightmap && renderToCanvas(heightmap)}
                className={`px-3 py-1 rounded-lg text-xs font-mono transition-all ${
                  renderMode === "after"
                    ? "bg-cyan-500/30 text-cyan-300 border border-cyan-500/50"
                    : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10"
                }`}
              >
                AFTER
              </button>
            </div>
          </div>

          <div className="flex items-center justify-center bg-black/30 rounded-xl p-4">
            <canvas
              ref={canvasRef}
              className="border border-white/10 rounded-lg heightmap-canvas"
            />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
              <div className="text-[10px] text-white/50 font-mono">SIZE</div>
              <div className="text-xl font-bold text-cyan-400 mt-1">{size}×{size}</div>
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
              <div className="text-[10px] text-white/50 font-mono">DURATION</div>
              <div className="text-xl font-bold text-green-400 mt-1">
                {stats.duration.toFixed(0)}ms
              </div>
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
              <div className="text-[10px] text-white/50 font-mono">ITERATIONS</div>
              <div className="text-xl font-bold text-purple-400 mt-1">
                {stats.iterations.toLocaleString()}
              </div>
            </div>
          </div>
        </GlassPanel>

        {/* Controls */}
        <div className="space-y-4">
          <GlassPanel className="rounded-2xl p-5">
            <h3 className="font-scifi text-sm tracking-widest text-white/85 mb-4">
              TERRAIN CONTROLS
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-white/60 mb-2 font-mono">
                  Heightmap Size: {size}
                </label>
                <input
                  type="range"
                  min="64"
                  max="512"
                  step="64"
                  value={size}
                  onChange={(e) => setSize(Number(e.target.value))}
                  className="w-full accent-cyan-500"
                  aria-label="Heightmap Size"
                />
              </div>

              <div className="flex gap-2">
                <NeonButton onClick={generateTerrain} className="flex-1">
                  GENERATE NEW
                </NeonButton>
                <NeonButton
                  onClick={applyErosion}
                  variant="ghost"
                  className="flex-1"
                  disabled={!heightmap || isProcessing}
                >
                  {isProcessing ? "PROCESSING..." : "APPLY EROSION"}
                </NeonButton>
              </div>
            </div>
          </GlassPanel>

          <GlassPanel className="rounded-2xl p-5">
            <h3 className="font-scifi text-sm tracking-widest text-white/85 mb-4">
              EROSION PARAMETERS
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-white/60 mb-2 font-mono">
                  Iterations: {params.iterations.toLocaleString()}
                </label>
                <input
                  type="range"
                  min="1000"
                  max="100000"
                  step="1000"
                  value={params.iterations}
                  onChange={(e) => updateParam("iterations", Number(e.target.value))}
                  className="w-full accent-cyan-500"
                  aria-label="Iterations"
                />
                <p className="text-[10px] text-white/40 mt-1">
                  Number of water droplets to simulate
                </p>
              </div>

              <div>
                <label className="block text-xs text-white/60 mb-2 font-mono">
                  Inertia: {params.inertia.toFixed(3)}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={params.inertia}
                  onChange={(e) => updateParam("inertia", Number(e.target.value))}
                  className="w-full accent-cyan-500"
                  aria-label="Inertia"
                />
                <p className="text-[10px] text-white/40 mt-1">
                  Higher = smoother, straighter paths
                </p>
              </div>

              <div>
                <label className="block text-xs text-white/60 mb-2 font-mono">
                  Capacity: {params.capacity.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="10"
                  step="0.1"
                  value={params.capacity}
                  onChange={(e) => updateParam("capacity", Number(e.target.value))}
                  className="w-full accent-cyan-500"
                  aria-label="Capacity"
                />
                <p className="text-[10px] text-white/40 mt-1">
                  How much sediment water can carry
                </p>
              </div>

              <div>
                <label className="block text-xs text-white/60 mb-2 font-mono">
                  Evaporation: {params.evaporation.toFixed(3)}
                </label>
                <input
                  type="range"
                  min="0"
                  max="0.1"
                  step="0.001"
                  value={params.evaporation}
                  onChange={(e) => updateParam("evaporation", Number(e.target.value))}
                  className="w-full accent-cyan-500"
                  aria-label="Evaporation"
                />
                <p className="text-[10px] text-white/40 mt-1">
                  Water loss per step
                </p>
              </div>

              <div>
                <label className="block text-xs text-white/60 mb-2 font-mono">
                  Min Slope: {params.minSlope.toFixed(3)}
                </label>
                <input
                  type="range"
                  min="0.001"
                  max="0.1"
                  step="0.001"
                  value={params.minSlope}
                  onChange={(e) => updateParam("minSlope", Number(e.target.value))}
                  className="w-full accent-cyan-500"
                  aria-label="Min Slope"
                />
                <p className="text-[10px] text-white/40 mt-1">
                  Minimum slope for erosion
                </p>
              </div>

              <div>
                <label className="block text-xs text-white/60 mb-2 font-mono">
                  Gravity: {params.gravity.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.1"
                  value={params.gravity}
                  onChange={(e) => updateParam("gravity", Number(e.target.value))}
                  className="w-full accent-cyan-500"
                  aria-label="Gravity"
                />
                <p className="text-[10px] text-white/40 mt-1">
                  Acceleration from height difference
                </p>
              </div>

              <div className="pt-2">
                <NeonButton
                  variant="ghost"
                  onClick={() => setParams(DEFAULT_EROSION_PARAMS)}
                  className="w-full text-xs"
                >
                  RESET TO DEFAULTS
                </NeonButton>
              </div>
            </div>
          </GlassPanel>

          <GlassPanel className="rounded-2xl p-5">
            <h3 className="font-scifi text-sm tracking-widest text-white/85 mb-3">
              ALGORITHM INFO
            </h3>
            <div className="text-xs text-white/60 space-y-2">
              <p>
                <strong className="text-white/80">Particle Hydraulic Erosion:</strong> Simulates individual
                water droplets flowing downhill, picking up and depositing sediment based on flow
                velocity and terrain slope.
              </p>
              <p>
                Each droplet follows the gradient, erodes material from steep areas, and deposits it
                in flat regions, creating realistic river valleys and terrain features.
              </p>
            </div>
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}
