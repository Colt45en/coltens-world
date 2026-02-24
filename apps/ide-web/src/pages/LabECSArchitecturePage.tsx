import React, { useState } from "react";
import { GlassPanel, NeonButton, NeonTitle } from "../ui/neon";

interface BenchmarkResult {
  archetype: { iteration: number; structural: number };
  sparseSet: { iteration: number; structural: number };
}

export function LabECSArchitecturePage() {
  const [entityCount, setEntityCount] = useState(10000);
  const [results, setResults] = useState<BenchmarkResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const runBenchmark = () => {
    setIsRunning(true);

    setTimeout(() => {
      // Simulate Archetype ECS
      const archetypeIterStart = performance.now();
      for (let i = 0; i < entityCount; i++) {
        // Simulate contiguous array access
        const dummyData = i * 1.5 + Math.sqrt(i);
      }
      const archetypeIterTime = performance.now() - archetypeIterStart;

      const archetypeStructStart = performance.now();
      for (let i = 0; i < Math.floor(entityCount / 10); i++) {
        // Simulate archetype migration (expensive)
        const temp = new Array(10).fill(0).map((_, idx) => idx * 2);
      }
      const archetypeStructTime = performance.now() - archetypeStructStart;

      // Simulate Sparse Set ECS
      const sparseIterStart = performance.now();
      const sparseArray = new Array(entityCount).fill(0).map((_, i) => i);
      for (let i = 0; i < entityCount; i++) {
        // Simulate sparse lookup + computation
        const lookup = sparseArray[i] ?? 0;
        const dummyData = lookup * 1.5 + Math.sqrt(lookup);
      }
      const sparseIterTime = performance.now() - sparseIterStart;

      const sparseStructStart = performance.now();
      for (let i = 0; i < Math.floor(entityCount / 10); i++) {
        // Simulate swap-and-pop (cheap)
        const idx = Math.floor(Math.random() * sparseArray.length);
        const lastItem = sparseArray[sparseArray.length - 1] ?? 0;
        sparseArray[idx] = lastItem;
      }
      const sparseStructTime = performance.now() - sparseStructStart;

      setResults({
        archetype: { iteration: archetypeIterTime, structural: archetypeStructTime },
        sparseSet: { iteration: sparseIterTime, structural: sparseStructTime },
      });

      setIsRunning(false);
    }, 100);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <NeonTitle as="h1" className="text-3xl">
          ECS Architecture Comparison
        </NeonTitle>
        <p className="text-white/60 mt-2">
          Compare Archetype-based vs Sparse Set Entity Component System implementations.
          Architectural tradeoffs between iteration speed and structural flexibility.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Archetype ECS */}
        <GlassPanel className="rounded-2xl p-6">
          <h2 className="font-scifi text-sm tracking-widest text-cyan-400 mb-4">
            ARCHETYPE-BASED (Unity DOTS, Flecs)
          </h2>

          <div className="space-y-4">
            <div className="bg-black/30 rounded-lg p-4 border border-cyan-500/20">
              <div className="font-mono text-xs text-white/70 mb-2">Memory Layout:</div>
              <div className="space-y-1">
                <div className="flex gap-1">
                  {Array.from({ length: 12 }, (_, i) => (
                    <div
                      key={i}
                      className="h-6 flex-1 bg-cyan-500/30 border border-cyan-500/50 flex items-center justify-center text-[8px] font-mono"
                    >
                      P{i}
                    </div>
                  ))}
                </div>
                <div className="text-[10px] text-cyan-400 font-mono">
                  Archetype A: [Position, Velocity] - Contiguous
                </div>
              </div>

              <div className="space-y-1 mt-3">
                <div className="flex gap-1">
                  {Array.from({ length: 8 }, (_, i) => (
                    <div
                      key={i}
                      className="h-6 flex-1 bg-purple-500/30 border border-purple-500/50 flex items-center justify-center text-[8px] font-mono"
                    >
                      P{i}
                    </div>
                  ))}
                </div>
                <div className="text-[10px] text-purple-400 font-mono">
                  Archetype B: [Position, Velocity, Mesh] - Separate Chunk
                </div>
              </div>
            </div>

            {results && (
              <div className="space-y-2">
                <div className="bg-green-500/10 rounded-lg p-3 border border-green-500/30">
                  <div className="text-[10px] text-white/50 font-mono">ITERATION TIME</div>
                  <div className="text-2xl font-bold text-green-400 mt-1">
                    {results.archetype.iteration.toFixed(2)}ms
                  </div>
                  <div className="text-[10px] text-green-400 mt-1">
                    ⚡ Linear cache-friendly access
                  </div>
                </div>

                <div className="bg-red-500/10 rounded-lg p-3 border border-red-500/30">
                  <div className="text-[10px] text-white/50 font-mono">STRUCTURAL CHANGE</div>
                  <div className="text-2xl font-bold text-red-400 mt-1">
                    {results.archetype.structural.toFixed(2)}ms
                  </div>
                  <div className="text-[10px] text-red-400 mt-1">
                    🐌 Requires archetype migration
                  </div>
                </div>
              </div>
            )}

            <div className="text-xs text-white/60 space-y-2 pt-2">
              <div>
                <strong className="text-white/80">✓ Advantages:</strong>
              </div>
              <ul className="list-disc pl-5 space-y-1">
                <li>Maximum iteration performance</li>
                <li>CPU cache prefetcher optimized</li>
                <li>Auto-vectorization (SIMD) friendly</li>
                <li>Chunk-level optimizations</li>
              </ul>
              <div className="pt-2">
                <strong className="text-white/80">✗ Disadvantages:</strong>
              </div>
              <ul className="list-disc pl-5 space-y-1">
                <li>Expensive component add/remove</li>
                <li>Requires data copying on change</li>
                <li>Command buffers needed for safety</li>
              </ul>
            </div>
          </div>
        </GlassPanel>

        {/* Sparse Set ECS */}
        <GlassPanel className="rounded-2xl p-6">
          <h2 className="font-scifi text-sm tracking-widest text-orange-400 mb-4">
            SPARSE SET (EnTT, Bevy)
          </h2>

          <div className="space-y-4">
            <div className="bg-black/30 rounded-lg p-4 border border-orange-500/20">
              <div className="font-mono text-xs text-white/70 mb-2">Memory Layout:</div>
              <div className="space-y-2">
                <div>
                  <div className="text-[10px] text-orange-400 font-mono mb-1">
                    Position Component Array:
                  </div>
                  <div className="flex gap-1">
                    {Array.from({ length: 10 }, (_, i) => (
                      <div
                        key={i}
                        className="h-6 flex-1 bg-orange-500/30 border border-orange-500/50 flex items-center justify-center text-[8px] font-mono"
                      >
                        P{i}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-orange-400 font-mono mb-1">
                    Velocity Component Array:
                  </div>
                  <div className="flex gap-1">
                    {Array.from({ length: 10 }, (_, i) => (
                      <div
                        key={i}
                        className="h-6 flex-1 bg-orange-500/30 border border-orange-500/50 flex items-center justify-center text-[8px] font-mono"
                      >
                        V{i}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-[10px] text-white/50 font-mono mt-2">
                  + Sparse array maps Entity ID → Dense Index
                </div>
              </div>
            </div>

            {results && (
              <div className="space-y-2">
                <div className="bg-yellow-500/10 rounded-lg p-3 border border-yellow-500/30">
                  <div className="text-[10px] text-white/50 font-mono">ITERATION TIME</div>
                  <div className="text-2xl font-bold text-yellow-400 mt-1">
                    {results.sparseSet.iteration.toFixed(2)}ms
                  </div>
                  <div className="text-[10px] text-yellow-400 mt-1">
                    ⚠️ Sparse lookup overhead
                  </div>
                </div>

                <div className="bg-green-500/10 rounded-lg p-3 border border-green-500/30">
                  <div className="text-[10px] text-white/50 font-mono">STRUCTURAL CHANGE</div>
                  <div className="text-2xl font-bold text-green-400 mt-1">
                    {results.sparseSet.structural.toFixed(2)}ms
                  </div>
                  <div className="text-[10px] text-green-400 mt-1">⚡ O(1) swap-and-pop</div>
                </div>
              </div>
            )}

            <div className="text-xs text-white/60 space-y-2 pt-2">
              <div>
                <strong className="text-white/80">✓ Advantages:</strong>
              </div>
              <ul className="list-disc pl-5 space-y-1">
                <li>O(1) component add/remove</li>
                <li>No data copying on structural change</li>
                <li>Flexible entity composition</li>
                <li>Simple implementation</li>
              </ul>
              <div className="pt-2">
                <strong className="text-white/80">✗ Disadvantages:</strong>
              </div>
              <ul className="list-disc pl-5 space-y-1">
                <li>Slower iteration than contiguous</li>
                <li>Branch misprediction possible</li>
                <li>Less SIMD-friendly</li>
              </ul>
            </div>
          </div>
        </GlassPanel>
      </div>

      <GlassPanel className="rounded-2xl p-6 mb-6">
        <h3 className="font-scifi text-sm tracking-widest text-white/85 mb-4">
          RUN BENCHMARK
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-white/60 mb-2 font-mono">
              Entity Count: {entityCount.toLocaleString()}
            </label>
            <input
              type="range"
              min="1000"
              max="100000"
              step="1000"
              value={entityCount}
              onChange={(e) => setEntityCount(Number(e.target.value))}
              disabled={isRunning}
              className="w-full accent-cyan-500"
            />
          </div>

          <NeonButton onClick={runBenchmark} disabled={isRunning} className="w-full">
            {isRunning ? "RUNNING BENCHMARK..." : "RUN BENCHMARK"}
          </NeonButton>
        </div>
      </GlassPanel>

      <GlassPanel className="rounded-2xl p-6">
        <h3 className="font-scifi text-sm tracking-widest text-white/85 mb-4">
          ARCHITECTURAL DECISION GUIDE
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-cyan-500/30 rounded-lg p-4">
            <div className="text-sm font-bold text-cyan-400 mb-2">Choose Archetype When:</div>
            <ul className="text-xs text-white/60 space-y-1 list-disc pl-4">
              <li>Read-heavy workloads (simulation, rendering)</li>
              <li>Static entity composition (units, NPCs)</li>
              <li>Need maximum iteration speed</li>
              <li>Targeting high entity counts (100K+)</li>
            </ul>
          </div>

          <div className="border border-orange-500/30 rounded-lg p-4">
            <div className="text-sm font-bold text-orange-400 mb-2">Choose Sparse Set When:</div>
            <ul className="text-xs text-white/60 space-y-1 list-disc pl-4">
              <li>Dynamic entity composition (UI, particles)</li>
              <li>Frequent component add/remove operations</li>
              <li>Prototyping with changing requirements</li>
              <li>Simpler codebase preferred</li>
            </ul>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="text-xs text-white/60">
            <strong className="text-white/80">Hybrid Approach:</strong> Many modern engines (e.g.,
            Unity DOTS) use both: Archetype for game simulation, Sparse Set for editor tools. Command
            Buffers defer structural changes to end-of-frame, amortizing archetype migration costs.
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}
