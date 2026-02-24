import React, { useState } from "react";
import { GlassPanel, NeonButton, NeonTitle } from "../ui/neon";

type AllocatorType = "linear" | "stack" | "pool";

interface Allocation {
  id: number;
  size: number;
  offset: number;
  color: string;
  name: string;
}

interface AllocatorState {
  allocations: Allocation[];
  totalSize: number;
  usedSize: number;
  fragmentation: number;
}

export function LabMemoryAllocatorsPage() {
  const [selectedAllocator, setSelectedAllocator] = useState<AllocatorType>("linear");
  const [linearState, setLinearState] = useState<AllocatorState>({
    allocations: [],
    totalSize: 1000,
    usedSize: 0,
    fragmentation: 0,
  });
  const [stackState, setStackState] = useState<AllocatorState>({
    allocations: [],
    totalSize: 1000,
    usedSize: 0,
    fragmentation: 0,
  });
  const [poolState, setPoolState] = useState<AllocatorState>({
    allocations: Array.from({ length: 20 }, (_, i) => ({
      id: -1,
      size: 50,
      offset: i * 50,
      color: "#1e293b",
      name: "Free",
    })),
    totalSize: 1000,
    usedSize: 0,
    fragmentation: 0,
  });

  const colors = [
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
    "#06b6d4",
  ];
  let allocIdCounter = 0;

  const linearAllocate = (size: number) => {
    const state = linearState;
    if (state.usedSize + size > state.totalSize) return;

    const colorIdx = allocIdCounter % colors.length;
    const allocation: Allocation = {
      id: allocIdCounter++,
      size,
      offset: state.usedSize,
      color: colors[colorIdx] || "#3b82f6",
      name: `Alloc ${allocIdCounter}`,
    };

    setLinearState({
      ...state,
      allocations: [...state.allocations, allocation],
      usedSize: state.usedSize + size,
    });
  };

  const linearReset = () => {
    setLinearState({
      allocations: [],
      totalSize: 1000,
      usedSize: 0,
      fragmentation: 0,
    });
  };

  const stackAllocate = (size: number) => {
    const state = stackState;
    if (state.usedSize + size > state.totalSize) return;

    const colorIdx = allocIdCounter % colors.length;
    const allocation: Allocation = {
      id: allocIdCounter++,
      size,
      offset: state.usedSize,
      color: colors[colorIdx] || "#3b82f6",
      name: `Alloc ${allocIdCounter}`,
    };

    setStackState({
      ...state,
      allocations: [...state.allocations, allocation],
      usedSize: state.usedSize + size,
    });
  };

  const stackPop = () => {
    const state = stackState;
    if (state.allocations.length === 0) return;

    const allocs = [...state.allocations];
    const popped = allocs.pop()!;

    setStackState({
      ...state,
      allocations: allocs,
      usedSize: state.usedSize - popped.size,
    });
  };

  const poolAllocate = () => {
    const state = poolState;
    const freeIdx = state.allocations.findIndex((a) => a.id === -1);
    if (freeIdx === -1) return;

    const allocs = [...state.allocations];
    const freeBlock = allocs[freeIdx];
    if (!freeBlock) return;

    const colorIdx = allocIdCounter % colors.length;
    allocs[freeIdx] = {
      id: allocIdCounter++,
      size: 50,
      offset: freeBlock.offset,
      color: colors[colorIdx] || "#3b82f6",
      name: `Block ${allocIdCounter}`,
    };

    setPoolState({
      ...state,
      allocations: allocs,
      usedSize: state.usedSize + 50,
    });
  };

  const poolFree = () => {
    const state = poolState;
    const usedIdx = state.allocations.findIndex((a) => a.id !== -1);
    if (usedIdx === -1) return;

    const allocs = [...state.allocations];
    const usedBlock = allocs[usedIdx];
    if (!usedBlock) return;

    allocs[usedIdx] = {
      id: -1,
      size: 50,
      offset: usedBlock.offset,
      color: "#1e293b",
      name: "Free",
    };

    setPoolState({
      ...state,
      allocations: allocs,
      usedSize: state.usedSize - 50,
    });
  };

  const renderMemoryBar = (state: AllocatorState) => {
    return (
      <div className="relative h-12 bg-slate-900/50 rounded-lg border border-white/10 overflow-hidden">
        {state.allocations.map((alloc, idx) => (
          <div
            key={idx}
            className="absolute h-full border-r border-white/20 flex items-center justify-center"
            style={{
              left: `${(alloc.offset / state.totalSize) * 100}%`,
              width: `${(alloc.size / state.totalSize) * 100}%`,
              backgroundColor: alloc.color,
            }}
          >
            <span className="text-[8px] font-mono text-white/80 truncate px-1">
              {alloc.name}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const currentState =
    selectedAllocator === "linear"
      ? linearState
      : selectedAllocator === "stack"
        ? stackState
        : poolState;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <NeonTitle as="h1" className="text-3xl">
          Memory Allocators
        </NeonTitle>
        <p className="text-white/60 mt-2">
          Visualize custom memory allocation strategies for high-performance engines. Compare Linear,
          Stack, and Pool allocators with different use cases.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
        {/* Main Visualizer */}
        <div className="space-y-6">
          <GlassPanel className="rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={() => setSelectedAllocator("linear")}
                className={`px-4 py-2 rounded-lg font-mono text-xs transition-all ${
                  selectedAllocator === "linear"
                    ? "bg-cyan-500/30 text-cyan-300 border border-cyan-500/50"
                    : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10"
                }`}
              >
                LINEAR
              </button>
              <button
                onClick={() => setSelectedAllocator("stack")}
                className={`px-4 py-2 rounded-lg font-mono text-xs transition-all ${
                  selectedAllocator === "stack"
                    ? "bg-cyan-500/30 text-cyan-300 border border-cyan-500/50"
                    : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10"
                }`}
              >
                STACK
              </button>
              <button
                onClick={() => setSelectedAllocator("pool")}
                className={`px-4 py-2 rounded-lg font-mono text-xs transition-all ${
                  selectedAllocator === "pool"
                    ? "bg-cyan-500/30 text-cyan-300 border border-cyan-500/50"
                    : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10"
                }`}
              >
                POOL
              </button>
            </div>

            <div className="mb-4">{renderMemoryBar(currentState)}</div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                <div className="text-[10px] text-white/50 font-mono">USED</div>
                <div className="text-lg font-bold text-cyan-400 mt-1">
                  {currentState.usedSize} / {currentState.totalSize}
                </div>
              </div>
              <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                <div className="text-[10px] text-white/50 font-mono">UTILIZATION</div>
                <div className="text-lg font-bold text-green-400 mt-1">
                  {((currentState.usedSize / currentState.totalSize) * 100).toFixed(0)}%
                </div>
              </div>
              <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                <div className="text-[10px] text-white/50 font-mono">FRAGMENTATION</div>
                <div className="text-lg font-bold text-orange-400 mt-1">
                  {currentState.fragmentation}%
                </div>
              </div>
            </div>

            {selectedAllocator === "linear" && (
              <div className="flex gap-2">
                <NeonButton onClick={() => linearAllocate(50)} className="flex-1">
                  ALLOCATE 50
                </NeonButton>
                <NeonButton onClick={() => linearAllocate(100)} className="flex-1">
                  ALLOCATE 100
                </NeonButton>
                <NeonButton onClick={linearReset} variant="ghost" className="flex-1">
                  RESET
                </NeonButton>
              </div>
            )}

            {selectedAllocator === "stack" && (
              <div className="flex gap-2">
                <NeonButton onClick={() => stackAllocate(50)} className="flex-1">
                  PUSH 50
                </NeonButton>
                <NeonButton onClick={() => stackAllocate(100)} className="flex-1">
                  PUSH 100
                </NeonButton>
                <NeonButton onClick={stackPop} variant="ghost" className="flex-1">
                  POP
                </NeonButton>
              </div>
            )}

            {selectedAllocator === "pool" && (
              <div className="flex gap-2">
                <NeonButton onClick={poolAllocate} className="flex-1">
                  ALLOCATE BLOCK
                </NeonButton>
                <NeonButton onClick={poolFree} variant="ghost" className="flex-1">
                  FREE BLOCK
                </NeonButton>
              </div>
            )}
          </GlassPanel>

          {/* Allocator Details */}
          {selectedAllocator === "linear" && (
            <GlassPanel className="rounded-2xl p-5">
              <h3 className="font-scifi text-sm tracking-widest text-cyan-400 mb-3">
                LINEAR (FRAME) ALLOCATOR
              </h3>
              <div className="text-xs text-white/60 space-y-2">
                <div>
                  <strong className="text-white/80">Mechanism:</strong> Pointer bumping. Maintains a
                  pointer to pre-allocated block, advances on allocation.
                </div>
                <div>
                  <strong className="text-white/80">Performance:</strong> O(1) allocation. No search,
                  no metadata overhead. Fastest possible allocator.
                </div>
                <div>
                  <strong className="text-white/80">Lifecycle:</strong> Entire buffer cleared at
                  frame end. Individual deallocation impossible.
                </div>
                <div>
                  <strong className="text-white/80">Use Cases:</strong> UI command lists, debug
                  rendering, raycast results, per-frame transient data.
                </div>
                <div className="pt-2 text-green-400">
                  ✓ Zero fragmentation | ✓ Cache-friendly sequential access
                </div>
                <div className="text-red-400">
                  ✗ No individual free | ✗ Must not persist pointers across frames
                </div>
              </div>
            </GlassPanel>
          )}

          {selectedAllocator === "stack" && (
            <GlassPanel className="rounded-2xl p-5">
              <h3 className="font-scifi text-sm tracking-widest text-cyan-400 mb-3">
                STACK ALLOCATOR
              </h3>
              <div className="text-xs text-white/60 space-y-2">
                <div>
                  <strong className="text-white/80">Mechanism:</strong> Like Linear but supports
                  Pop(). Memory freed in reverse allocation order (LIFO).
                </div>
                <div>
                  <strong className="text-white/80">Performance:</strong> O(1) allocation and
                  deallocation. Minimal bookkeeping.
                </div>
                <div>
                  <strong className="text-white/80">Markers:</strong> Push marker on scope entry, pop
                  on exit. Entire scope freed instantly.
                </div>
                <div>
                  <strong className="text-white/80">Use Cases:</strong> Level loading, hierarchical
                  asset scopes, subsystem initialization.
                </div>
                <div className="pt-2 text-green-400">
                  ✓ Instant bulk deallocation | ✓ Perfect for hierarchical data
                </div>
                <div className="text-red-400">
                  ✗ Must free in reverse order | ✗ Not suitable for random access patterns
                </div>
              </div>
            </GlassPanel>
          )}

          {selectedAllocator === "pool" && (
            <GlassPanel className="rounded-2xl p-5">
              <h3 className="font-scifi text-sm tracking-widest text-cyan-400 mb-3">
                POOL ALLOCATOR
              </h3>
              <div className="text-xs text-white/60 space-y-2">
                <div>
                  <strong className="text-white/80">Mechanism:</strong> Fixed-size blocks.
                  Free-list (intrusive linked list) tracks available slots.
                </div>
                <div>
                  <strong className="text-white/80">Performance:</strong> O(1) allocation and free.
                  No fragmentation since all blocks identical.
                </div>
                <div>
                  <strong className="text-white/80">Memory Layout:</strong> Blocks can be contiguous
                  for cache locality. Free-list stored in blocks themselves.
                </div>
                <div>
                  <strong className="text-white/80">Use Cases:</strong> Particles, bullets,
                  projectiles, rigid body constraints, ECS components.
                </div>
                <div className="pt-2 text-green-400">
                  ✓ Zero external fragmentation | ✓ Predictable performance
                </div>
                <div className="text-red-400">
                  ✗ Wasted space if objects vary in size | ✗ Fixed block size constraint
                </div>
              </div>
            </GlassPanel>
          )}
        </div>

        {/* Comparison Table */}
        <div className="space-y-4">
          <GlassPanel className="rounded-2xl p-5">
            <h3 className="font-scifi text-sm tracking-widest text-white/85 mb-4">
              PERFORMANCE COMPARISON
            </h3>

            <div className="space-y-3 text-xs">
              <div className="border-b border-white/10 pb-2">
                <div className="text-white/80 font-mono mb-1">Allocation Speed:</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-cyan-500/30 h-2 rounded" />
                  <span className="text-cyan-400">Linear</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 bg-cyan-500/30 h-2 rounded" style={{ width: "95%" }} />
                  <span className="text-cyan-400">Stack</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 bg-cyan-500/30 h-2 rounded" style={{ width: "90%" }} />
                  <span className="text-cyan-400">Pool</span>
                </div>
              </div>

              <div className="border-b border-white/10 pb-2">
                <div className="text-white/80 font-mono mb-1">Free Flexibility:</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-orange-500/30 h-2 rounded" style={{ width: "0%" }} />
                  <span className="text-orange-400">Linear</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 bg-orange-500/30 h-2 rounded" style={{ width: "40%" }} />
                  <span className="text-orange-400">Stack</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 bg-orange-500/30 h-2 rounded" />
                  <span className="text-orange-400">Pool</span>
                </div>
              </div>

              <div className="border-b border-white/10 pb-2">
                <div className="text-white/80 font-mono mb-1">Cache Locality:</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-green-500/30 h-2 rounded" />
                  <span className="text-green-400">Linear</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 bg-green-500/30 h-2 rounded" />
                  <span className="text-green-400">Stack</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 bg-green-500/30 h-2 rounded" style={{ width: "75%" }} />
                  <span className="text-green-400">Pool</span>
                </div>
              </div>
            </div>
          </GlassPanel>

          <GlassPanel className="rounded-2xl p-5">
            <h3 className="font-scifi text-sm tracking-widest text-white/85 mb-3">
              WHEN TO USE
            </h3>
            <div className="text-xs text-white/60 space-y-3">
              <div>
                <strong className="text-cyan-400">Linear:</strong> Per-frame temporary data, debug
                rendering, UI commands
              </div>
              <div>
                <strong className="text-cyan-400">Stack:</strong> Level loading, asset bundles,
                hierarchical scopes
              </div>
              <div>
                <strong className="text-cyan-400">Pool:</strong> Particles, projectiles, ECS
                components, constraints
              </div>
            </div>
          </GlassPanel>

          <GlassPanel className="rounded-2xl p-5">
            <h3 className="font-scifi text-sm tracking-widest text-white/85 mb-3">KEY INSIGHT</h3>
            <div className="text-xs text-white/60">
              Modern engines <strong className="text-white/80">never use malloc/new</strong> for
              hot-path allocations. General-purpose allocators incur 100-1000x overhead due to
              thread synchronization, free-list searching, and fragmentation management. Custom
              allocators matched to data lifetimes are mandatory for real-time performance.
            </div>
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}
