import React, { useEffect, useRef, useState } from "react";
import { GlassPanel, NeonButton, NeonTitle } from "../ui/neon";
import {
  createSimpleTileset,
  WaveFunctionCollapse,
  type Tile,
} from "../utils/waveFunctionCollapse";

export function LabWaveFunctionCollapsePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [wfc, setWfc] = useState<WaveFunctionCollapse | null>(null);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [gridSize, setGridSize] = useState(20);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [stepMode, setStepMode] = useState(false);
  const [stats, setStats] = useState({ iterations: 0, duration: 0 });
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const tileset = createSimpleTileset();
    setTiles(tileset);
    const instance = new WaveFunctionCollapse(gridSize, gridSize, tileset);
    setWfc(instance);
    renderGrid(instance);
  }, [gridSize]);

  const cellSize = 400 / gridSize;

  const renderGrid = (instance: WaveFunctionCollapse) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 400;
    canvas.height = 400;

    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const grid = instance.getGrid();

    for (let y = 0; y < grid.length; y++) {
      const row = grid[y];
      if (!row) continue;
      for (let x = 0; x < row.length; x++) {
        const cell = row[x];
        if (!cell) continue;

        if (cell.collapsed) {
          const tileId = instance.getTileAt(x, y);
          if (tileId !== null) {
            const tile = tiles.find((t) => t.id === tileId);
            if (tile) {
              ctx.fillStyle = tile.color;
            }
          }
        } else {
          // Show entropy as grayscale
          const brightness = cell.options.size > 0 ? 40 + (cell.entropy / 2) * 30 : 20;
          ctx.fillStyle = `rgb(${brightness}, ${brightness}, ${brightness})`;
        }

        ctx.fillRect(x * cellSize, y * cellSize, cellSize - 1, cellSize - 1);
      }
    }
  };

  const runStep = () => {
    if (!wfc || isComplete) return;

    const success = wfc.step();
    renderGrid(wfc);

    if (!success || wfc.isComplete()) {
      setIsComplete(true);
      setIsGenerating(false);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    } else {
      setStats((prev) => ({ ...prev, iterations: prev.iterations + 1 }));
    }
  };

  const runAnimated = () => {
    if (!wfc || isComplete) return;

    setIsGenerating(true);
    const startTime = performance.now();

    const animate = () => {
      if (!wfc) return;

      for (let i = 0; i < 1; i++) {
        const success = wfc.step();
        if (!success || wfc.isComplete()) {
          const duration = performance.now() - startTime;
          setStats({ iterations: wfc.getHistory().length, duration });
          setIsComplete(true);
          setIsGenerating(false);
          renderGrid(wfc);
          return;
        }
      }

      renderGrid(wfc);
      setStats((prev) => ({ ...prev, iterations: prev.iterations + 1 }));
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();
  };

  const runInstant = () => {
    if (!wfc) return;

    setIsGenerating(true);
    const startTime = performance.now();

    setTimeout(() => {
      const success = wfc.generate();
      const duration = performance.now() - startTime;

      renderGrid(wfc);
      setStats({ iterations: wfc.getHistory().length, duration });
      setIsComplete(success);
      setIsGenerating(false);
    }, 50);
  };

  const reset = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    const tileset = createSimpleTileset();
    const instance = new WaveFunctionCollapse(gridSize, gridSize, tileset);
    setWfc(instance);
    renderGrid(instance);
    setIsComplete(false);
    setIsGenerating(false);
    setStats({ iterations: 0, duration: 0 });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <NeonTitle as="h1" className="text-3xl">
          Wave Function Collapse
        </NeonTitle>
        <p className="text-white/60 mt-2">
          Constraint satisfaction solver for procedural generation. Generates output locally similar
          to patterns using quantum superposition principles.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[500px_1fr] gap-6">
        {/* Canvas Viewer */}
        <GlassPanel className="rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-scifi text-sm tracking-widest text-white/85">GENERATION GRID</h2>
            <div className="text-xs text-white/50 font-mono">
              {gridSize}×{gridSize}
            </div>
          </div>

          <div className="flex items-center justify-center bg-black/30 rounded-xl p-4">
            <canvas
              ref={canvasRef}
              className="border border-white/10 rounded-lg"
              style={{ imageRendering: "pixelated", width: "400px", height: "400px" }}
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
              <div className="text-[10px] text-white/50 font-mono">ITERATIONS</div>
              <div className="text-xl font-bold text-cyan-400 mt-1">{stats.iterations}</div>
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
              <div className="text-[10px] text-white/50 font-mono">DURATION</div>
              <div className="text-xl font-bold text-green-400 mt-1">
                {stats.duration.toFixed(0)}ms
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="text-xs text-white/60 mb-2 font-mono">TILESET LEGEND</div>
            <div className="grid grid-cols-2 gap-2">
              {tiles.map((tile) => (
                <div key={tile.id} className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded border border-white/20"
                    style={{ backgroundColor: tile.color }}
                  />
                  <span className="text-xs text-white/70">{tile.name}</span>
                </div>
              ))}
            </div>
          </div>
        </GlassPanel>

        {/* Controls */}
        <div className="space-y-4">
          <GlassPanel className="rounded-2xl p-5">
            <h3 className="font-scifi text-sm tracking-widest text-white/85 mb-4">
              GENERATION CONTROLS
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-white/60 mb-2 font-mono">
                  Grid Size: {gridSize}×{gridSize}
                </label>
                <input
                  type="range"
                  min="5"
                  max="40"
                  step="5"
                  value={gridSize}
                  onChange={(e) => setGridSize(Number(e.target.value))}
                  disabled={isGenerating}
                  className="w-full accent-cyan-500"
                />
              </div>

              <div className="flex gap-2">
                <NeonButton onClick={reset} className="flex-1" disabled={isGenerating}>
                  RESET
                </NeonButton>
                <NeonButton
                  onClick={runInstant}
                  variant="ghost"
                  className="flex-1"
                  disabled={isGenerating || isComplete}
                >
                  {isGenerating ? "GENERATING..." : "INSTANT"}
                </NeonButton>
              </div>

              <div className="flex gap-2">
                <NeonButton
                  onClick={runAnimated}
                  className="flex-1"
                  disabled={isGenerating || isComplete}
                >
                  ANIMATE
                </NeonButton>
                <NeonButton
                  onClick={runStep}
                  variant="ghost"
                  className="flex-1"
                  disabled={isGenerating || isComplete}
                >
                  STEP
                </NeonButton>
              </div>

              {isComplete && (
                <div className="text-center text-xs text-green-400 font-mono mt-2">
                  ✓ GENERATION COMPLETE
                </div>
              )}
            </div>
          </GlassPanel>

          <GlassPanel className="rounded-2xl p-5">
            <h3 className="font-scifi text-sm tracking-widest text-white/85 mb-3">
              ALGORITHM OVERVIEW
            </h3>
            <div className="text-xs text-white/60 space-y-2">
              <div>
                <strong className="text-white/80">1. Superposition:</strong> All cells start in a
                superposition of all possible tiles.
              </div>
              <div>
                <strong className="text-white/80">2. Entropy Calculation:</strong> Shannon entropy
                measures uncertainty: H = log(Σw) - (Σw·log(w))/Σw
              </div>
              <div>
                <strong className="text-white/80">3. Collapse:</strong> Cell with lowest entropy is
                observed (collapsed) to a single tile.
              </div>
              <div>
                <strong className="text-white/80">4. Propagation:</strong> Adjacency constraints
                ripple through grid, reducing neighbor possibilities.
              </div>
            </div>
          </GlassPanel>

          <GlassPanel className="rounded-2xl p-5">
            <h3 className="font-scifi text-sm tracking-widest text-white/85 mb-3">
              ADJACENCY RULES
            </h3>
            <div className="text-xs text-white/60 space-y-2">
              <div>
                <strong className="text-cyan-400">Grass:</strong> Can border grass, sand, or rock
              </div>
              <div>
                <strong className="text-blue-400">Water:</strong> Only borders water or sand
                (shoreline)
              </div>
              <div>
                <strong className="text-yellow-400">Sand:</strong> Universal transition tile
              </div>
              <div>
                <strong className="text-slate-400">Rock:</strong> Avoids water, like grass
              </div>
            </div>
          </GlassPanel>

          <GlassPanel className="rounded-2xl p-5">
            <h3 className="font-scifi text-sm tracking-widest text-white/85 mb-3">
              PERFORMANCE NOTES
            </h3>
            <div className="text-xs text-white/60 space-y-2">
              <p>
                <strong className="text-white/80">Bitmask Optimization:</strong> High-performance
                implementations use bitwise operations for constraint propagation, checking dozens of
                rules per cycle.
              </p>
              <p>
                <strong className="text-white/80">Backtracking:</strong> Contradictions (zero valid
                options) trigger backtracking to previous states.
              </p>
            </div>
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}
