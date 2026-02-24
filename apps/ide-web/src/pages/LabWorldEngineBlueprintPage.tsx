import { useState, useEffect, useRef } from "react";
import { GlassPanel, NeonButton, NeonTitle } from "../ui/neon";
import { TabPanel, type Tab } from "../ui/TabPanel";

// Import all blueprint systems
import { World } from "../utils/blueprint/ecs/archetype";
import { RenderGraph } from "../utils/blueprint/render/graph";
import { qFromAxisAngle, qMul, qSlerp, qToEuler, type Quat } from "../utils/blueprint/math/quat";
import {
  shouldRebase,
  applyRebase,
  distanceFromOrigin,
  type RebaseState,
} from "../utils/blueprint/world/originRebasing";
import { CommandStack, MoveObject } from "../utils/blueprint/editor/command";
import { erode, type ErosionParams } from "../utils/blueprint/terrain/erosion";

export function LabWorldEngineBlueprintPage() {
  const tabs: Tab[] = [
    {
      id: "overview",
      label: "Architecture Overview",
      content: <OverviewTab />,
    },
    {
      id: "ecs",
      label: "Archetype ECS",
      content: <ECSTab />,
    },
    {
      id: "render",
      label: "Render Graph",
      content: <RenderGraphTab />,
    },
    {
      id: "quat",
      label: "Quaternions",
      content: <QuaternionTab />,
    },
    {
      id: "rebase",
      label: "Origin Rebasing",
      content: <OriginRebaseTab />,
    },
    {
      id: "commands",
      label: "Command Pattern",
      content: <CommandPatternTab />,
    },
    {
      id: "erosion",
      label: "Terrain Erosion",
      content: <ErosionTab />,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <NeonTitle>World Engine Complete Blueprint</NeonTitle>
        <div className="text-sm text-cyan-300/70">
          Integrated Architecture Reference Implementation
        </div>
      </div>

      <GlassPanel className="p-6">
        <p className="text-gray-300 mb-4">
          A complete reference implementation of World Engine core systems: Data-Oriented ECS,
          Render Dependency Graph, mathematical foundations (quaternions, origin rebasing),
          procedural terrain generation, and editor tooling patterns.
        </p>
        <div className="text-sm text-cyan-400/80">
          Each tab demonstrates a production-ready system optimized for massive scale, real-time
          collaboration, and AI-ready pipelines.
        </div>
      </GlassPanel>

      <GlassPanel className="rounded-2xl">
        <TabPanel tabs={tabs} defaultTab="overview" />
      </GlassPanel>
    </div>
  );
}

function OverviewTab() {
  return (
    <div className="space-y-6">
      <GlassPanel className="p-6">
        <h3 className="text-xl font-bold text-cyan-400 mb-4">
          World Engine vs Traditional Engine
        </h3>
        <div className="space-y-3 text-gray-300">
          <p>
            A <strong className="text-cyan-300">World Engine</strong> is fundamentally different
            from a "level-based" game engine because it must be built for:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>
              <strong className="text-purple-400">Massive scale + streaming</strong> — data is
              always loading/unloading
            </li>
            <li>
              <strong className="text-purple-400">Procedural generation at runtime</strong> — not
              just offline tools
            </li>
            <li>
              <strong className="text-purple-400">Real-time collaboration</strong> — multi-user
              editing
            </li>
            <li>
              <strong className="text-purple-400">AI-ready pipelines</strong> — asset + metadata
              flows
            </li>
            <li>
              <strong className="text-purple-400">Hard performance constraints</strong> — constant
              churn
            </li>
          </ul>
          <p className="pt-2">
            That combination strongly favors <strong>Data-Oriented Design (DoD)</strong> and an{" "}
            <strong>ECS-first runtime</strong>, plus a <strong>graph-compiled renderer</strong>{" "}
            (Render/Frame Graph) for modern explicit GPU APIs (DX12/Vulkan).
          </p>
        </div>
      </GlassPanel>

      <GlassPanel className="p-6">
        <h3 className="text-xl font-bold text-cyan-400 mb-4">Architecture Blueprint Table</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cyan-500/30">
                <th className="text-left py-2 px-3 text-cyan-300">System</th>
                <th className="text-left py-2 px-3 text-cyan-300">Recommended Pattern</th>
                <th className="text-left py-2 px-3 text-cyan-300">Key Benefit</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              <tr className="border-b border-gray-700/30">
                <td className="py-2 px-3 font-semibold text-purple-400">Runtime Data</td>
                <td className="py-2 px-3">ECS (Archetype)</td>
                <td className="py-2 px-3">Cache coherency, SIMD optimization</td>
              </tr>
              <tr className="border-b border-gray-700/30">
                <td className="py-2 px-3 font-semibold text-purple-400">Rendering</td>
                <td className="py-2 px-3">Render Dependency Graph</td>
                <td className="py-2 px-3">Automated sync, memory aliasing</td>
              </tr>
              <tr className="border-b border-gray-700/30">
                <td className="py-2 px-3 font-semibold text-purple-400">Rotation</td>
                <td className="py-2 px-3">Unit Quaternions</td>
                <td className="py-2 px-3">Smooth interpolation, 50% memory saving</td>
              </tr>
              <tr className="border-b border-gray-700/30">
                <td className="py-2 px-3 font-semibold text-purple-400">World Space</td>
                <td className="py-2 px-3">Origin Rebasing</td>
                <td className="py-2 px-3">Eliminates floating point jitter</td>
              </tr>
              <tr className="border-b border-gray-700/30">
                <td className="py-2 px-3 font-semibold text-purple-400">Terrain</td>
                <td className="py-2 px-3">Particle Hydraulic Erosion</td>
                <td className="py-2 px-3">High-fidelity natural features</td>
              </tr>
              <tr className="border-b border-gray-700/30">
                <td className="py-2 px-3 font-semibold text-purple-400">Editor Tools</td>
                <td className="py-2 px-3">Command Pattern</td>
                <td className="py-2 px-3">Robust Undo/Redo & Debugging</td>
              </tr>
            </tbody>
          </table>
        </div>
      </GlassPanel>

      <GlassPanel className="p-6">
        <h3 className="text-xl font-bold text-cyan-400 mb-4">Key Architectural Decisions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-purple-500/10 rounded border border-purple-500/30">
            <h4 className="font-bold text-purple-400 mb-2">Archetype vs Sparse Set ECS</h4>
            <p className="text-sm text-gray-300">
              Archetype ECS stores entities with identical component sets in contiguous chunks →
              extremely fast iteration and SIMD-friendly. Structural changes require moving entities
              between archetypes.
            </p>
          </div>
          <div className="p-4 bg-cyan-500/10 rounded border border-cyan-500/30">
            <h4 className="font-bold text-cyan-400 mb-2">Render Graph Benefits</h4>
            <p className="text-sm text-gray-300">
              Modern explicit APIs require explicit synchronization. An RDG represents passes as a
              DAG, executes in dependency order, and inserts resource transitions/barriers
              automatically.
            </p>
          </div>
          <div className="p-4 bg-green-500/10 rounded border border-green-500/30">
            <h4 className="font-bold text-green-400 mb-2">Quaternion Advantages</h4>
            <p className="text-sm text-gray-300">
              4 scalars vs 9 for a 3×3 rotation matrix → lower memory bandwidth. Stable composition
              via quaternion multiplication. Smooth interpolation (SLERP) is standard in practice.
            </p>
          </div>
          <div className="p-4 bg-orange-500/10 rounded border border-orange-500/30">
            <h4 className="font-bold text-orange-400 mb-2">Large-Scale Coordinates</h4>
            <p className="text-sm text-gray-300">
              For planet-scale simulations: maintain high-order global coordinates (double/i64) and
              local float coordinates near camera. Periodically rebase when crossing thresholds.
            </p>
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}

function ECSTab() {
  const [world] = useState(() => {
    const w = new World();
    w.defineComponent("Transform");
    w.defineComponent("Renderable");
    w.defineComponent("Physics");
    return w;
  });

  const [entities, setEntities] = useState<Array<{ id: number; comps: string[] }>>([]);
  const [archetypes, setArchetypes] = useState<
    Array<{ mask: number; count: number; components: string[] }>
  >([]);

  const createEntity = (comps: string[]) => {
    const components: Record<string, any> = {};
    if (comps.includes("Transform")) components.Transform = { position: [0, 0, 0], rotation: [0, 0, 0, 1] };
    if (comps.includes("Renderable")) components.Renderable = { model: "cube", color: [1, 1, 1] };
    if (comps.includes("Physics")) components.Physics = { velocity: [0, 0, 0], mass: 1 };

    const e = world.createEntity(components);
    updateEntityList();
  };

  const updateEntityList = () => {
    const arches = world.getArchetypes();
    const ents: Array<{ id: number; comps: string[] }> = [];
    const archeList: Array<{ mask: number; count: number; components: string[] }> = [];

    for (const arch of arches) {
      archeList.push({
        mask: arch.mask,
        count: arch.entities.length,
        components: arch.getComponentNames(),
      });
      for (const e of arch.entities) {
        ents.push({ id: e, comps: arch.getComponentNames() });
      }
    }

    setEntities(ents);
    setArchetypes(archeList);
  };

  useEffect(() => {
    // Create some initial entities
    createEntity(["Transform", "Renderable"]);
    createEntity(["Transform", "Renderable"]);
    createEntity(["Transform", "Physics"]);
    createEntity(["Transform", "Renderable", "Physics"]);
  }, []);

  return (
    <div className="space-y-6">
      <GlassPanel className="p-6">
        <h3 className="text-xl font-bold text-cyan-400 mb-4">Archetype ECS System</h3>
        <p className="text-gray-300 mb-4">
          Entities with the same component set share an archetype, stored in contiguous chunk
          memory → extremely fast iteration and SIMD-friendly patterns.
        </p>
        <div className="flex gap-2 flex-wrap">
          <NeonButton onClick={() => createEntity(["Transform", "Renderable"])}>
            + Transform + Renderable
          </NeonButton>
          <NeonButton onClick={() => createEntity(["Transform", "Physics"])}>
            + Transform + Physics
          </NeonButton>
          <NeonButton onClick={() => createEntity(["Transform", "Renderable", "Physics"])}>
            + All Components
          </NeonButton>
        </div>
      </GlassPanel>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <GlassPanel className="p-6">
          <h4 className="text-lg font-bold text-purple-400 mb-3">
            Archetypes ({archetypes.length})
          </h4>
          <div className="space-y-2">
            {archetypes.map((arch, i) => (
              <div
                key={i}
                className="p-3 bg-purple-500/10 rounded border border-purple-500/30"
              >
                <div className="text-sm text-gray-300">
                  <strong className="text-purple-300">Mask:</strong> {arch.mask} |{" "}
                  <strong className="text-purple-300">Entities:</strong> {arch.count}
                </div>
                <div className="text-xs text-cyan-400 mt-1">
                  Components: {arch.components.join(", ")}
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel className="p-6">
          <h4 className="text-lg font-bold text-cyan-400 mb-3">Entities ({entities.length})</h4>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {entities.map((e) => (
              <div
                key={e.id}
                className="p-2 bg-cyan-500/10 rounded border border-cyan-500/20 text-sm"
              >
                <span className="text-cyan-300 font-mono">Entity #{e.id}</span>
                <span className="text-gray-400 text-xs ml-2">[{e.comps.join(", ")}]</span>
              </div>
            ))}
          </div>
        </GlassPanel>
      </div>

      <GlassPanel className="p-6 bg-blue-500/5 border-blue-500/30">
        <h4 className="text-lg font-bold text-blue-400 mb-2">Performance Characteristics</h4>
        <ul className="text-sm text-gray-300 space-y-1 list-disc list-inside">
          <li>
            <strong>Iteration:</strong> O(n) with excellent cache coherency (sequential memory
            access)
          </li>
          <li>
            <strong>Add/Remove Component:</strong> O(1) for swap-remove from archetype, but
            requires moving entity to new archetype
          </li>
          <li>
            <strong>Query:</strong> O(archetypes) to find matching archetypes, then O(n) iteration
            over entities
          </li>
          <li>
            <strong>Memory:</strong> Minimal overhead, components packed in contiguous arrays
          </li>
        </ul>
      </GlassPanel>
    </div>
  );
}

function RenderGraphTab() {
  const [graph] = useState(() => {
    const rg = new RenderGraph();
    rg.addPass("shadowMap", ({ write }) => {
      write("shadowDepth");
    });
    rg.addPass("gbuffer", ({ write }) => {
      write("gbufferAlbedo");
      write("gbufferNormal");
      write("gbufferDepth");
    });
    rg.addPass("ssao", ({ read, write }) => {
      read("gbufferDepth");
      read("gbufferNormal");
      write("aoBuffer");
    });
    rg.addPass("lighting", ({ read, write }) => {
      read("gbufferAlbedo");
      read("gbufferNormal");
      read("gbufferDepth");
      read("shadowDepth");
      read("aoBuffer");
      write("hdrBuffer");
    });
    rg.addPass("postProcess", ({ read, write }) => {
      read("hdrBuffer");
      write("ldrBuffer");
    });
    return rg;
  });

  const [compiledOrder, setCompiledOrder] = useState<string[]>([]);
  const [edges, setEdges] = useState<Array<{ from: string; to: string; reason: string }>>([]);

  const compileGraph = () => {
    const order = graph.compile();
    const graphEdges = graph.getEdges();
    setCompiledOrder(order);
    setEdges(graphEdges);
  };

  useEffect(() => {
    compileGraph();
  }, []);

  return (
    <div className="space-y-6">
      <GlassPanel className="p-6">
        <h3 className="text-xl font-bold text-cyan-400 mb-4">Render Dependency Graph</h3>
        <p className="text-gray-300 mb-4">
          Modern explicit APIs (DX12/Vulkan) require explicit synchronization and resource state
          management. An RDG represents passes as a DAG, executes in dependency order, and inserts
          resource transitions/barriers automatically.
        </p>
        <NeonButton onClick={compileGraph}>🔄 Recompile Graph</NeonButton>
      </GlassPanel>

      <GlassPanel className="p-6">
        <h4 className="text-lg font-bold text-purple-400 mb-3">Execution Order</h4>
        <div className="flex items-center gap-3 flex-wrap">
          {compiledOrder.map((pass, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="px-4 py-2 bg-purple-500/20 rounded border border-purple-500/50 font-mono text-sm text-purple-300">
                {pass}
              </div>
              {i < compiledOrder.length - 1 && (
                <div className="text-gray-500 text-xl">→</div>
              )}
            </div>
          ))}
        </div>
      </GlassPanel>

      <GlassPanel className="p-6">
        <h4 className="text-lg font-bold text-cyan-400 mb-3">
          Resource Dependencies ({edges.length})
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
          {edges.map((edge, i) => (
            <div
              key={i}
              className="p-3 bg-cyan-500/10 rounded border border-cyan-500/30 text-sm"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-cyan-300">{edge.from}</span>
                <span className="text-gray-500">→</span>
                <span className="font-mono text-purple-300">{edge.to}</span>
              </div>
              <div className="text-xs text-gray-400 mt-1">{edge.reason}</div>
            </div>
          ))}
        </div>
      </GlassPanel>

      <GlassPanel className="p-6 bg-green-500/5 border-green-500/30">
        <h4 className="text-lg font-bold text-green-400 mb-2">Key Benefits</h4>
        <ul className="text-sm text-gray-300 space-y-1 list-disc list-inside">
          <li>
            <strong>Automatic Synchronization:</strong> Inserts barriers and resource transitions
            based on dependencies
          </li>
          <li>
            <strong>Transient Resource Aliasing:</strong> Reuse memory for non-overlapping resource
            lifetimes
          </li>
          <li>
            <strong>Parallel Compilation:</strong> Identify independent passes for multi-threaded
            command buffer recording
          </li>
          <li>
            <strong>Debugging:</strong> Visualize resource flow and identify redundant transitions
          </li>
        </ul>
      </GlassPanel>
    </div>
  );
}

function QuaternionTab() {
  const [angle, setAngle] = useState(0);
  const [lerpT, setLerpT] = useState(0.5);

  const qA = qFromAxisAngle([0, 1, 0], 0);
  const qB = qFromAxisAngle([0, 1, 0], Math.PI);
  const qCurrent = qFromAxisAngle([0, 1, 0], angle);
  const qInterpolated = qSlerp(qA, qB, lerpT);
  const qMul = qFromAxisAngle([0, 1, 0], angle * 2);

  const formatQuat = (q: Quat) =>
    `[${q[0].toFixed(3)}, ${q[1].toFixed(3)}, ${q[2].toFixed(3)}, ${q[3].toFixed(3)}]`;

  const euler = qToEuler(qCurrent);

  return (
    <div className="space-y-6">
      <GlassPanel className="p-6">
        <h3 className="text-xl font-bold text-cyan-400 mb-4">Unit Quaternions for Rotation</h3>
        <p className="text-gray-300 mb-4">
          Quaternions use 4 scalars vs 9 for a 3×3 rotation matrix → 50% memory saving. They
          provide stable composition via quaternion multiplication and smooth interpolation via
          SLERP.
        </p>
      </GlassPanel>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <GlassPanel className="p-6">
          <h4 className="text-lg font-bold text-purple-400 mb-3">Rotation Control</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Angle (radians): {angle.toFixed(2)} ({((angle * 180) / Math.PI).toFixed(0)}°)
              </label>
              <input
                type="range"
                min="0"
                max={Math.PI * 2}
                step="0.01"
                value={angle}
                onChange={(e) => setAngle(parseFloat(e.target.value))}
                className="w-full"
                title="Rotation angle in radians"
              />
            </div>
            <div className="p-3 bg-purple-500/10 rounded border border-purple-500/30">
              <div className="text-sm text-gray-300">
                <strong className="text-purple-300">Quaternion:</strong>{" "}
                <span className="font-mono text-xs">{formatQuat(qCurrent)}</span>
              </div>
              <div className="text-sm text-gray-300 mt-1">
                <strong className="text-purple-300">Euler (rad):</strong>{" "}
                <span className="font-mono text-xs">
                  [{euler[0].toFixed(3)}, {euler[1].toFixed(3)}, {euler[2].toFixed(3)}]
                </span>
              </div>
            </div>
          </div>
        </GlassPanel>

        <GlassPanel className="p-6">
          <h4 className="text-lg font-bold text-cyan-400 mb-3">SLERP Interpolation</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Interpolation t: {lerpT.toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={lerpT}
                onChange={(e) => setLerpT(parseFloat(e.target.value))}
                className="w-full"
                title="SLERP interpolation parameter"
              />
            </div>
            <div className="p-3 bg-cyan-500/10 rounded border border-cyan-500/30 text-sm">
              <div className="text-gray-300">
                <strong className="text-cyan-300">qA (0°):</strong>{" "}
                <span className="font-mono text-xs">{formatQuat(qA)}</span>
              </div>
              <div className="text-gray-300 mt-1">
                <strong className="text-cyan-300">qB (180°):</strong>{" "}
                <span className="font-mono text-xs">{formatQuat(qB)}</span>
              </div>
              <div className="text-purple-300 mt-2 font-semibold">
                SLERP Result:{" "}
                <span className="font-mono text-xs">{formatQuat(qInterpolated)}</span>
              </div>
            </div>
          </div>
        </GlassPanel>
      </div>

      <GlassPanel className="p-6 bg-green-500/5 border-green-500/30">
        <h4 className="text-lg font-bold text-green-400 mb-2">Why Quaternions?</h4>
        <ul className="text-sm text-gray-300 space-y-1 list-disc list-inside">
          <li>
            <strong>Memory Efficiency:</strong> 4 floats (16 bytes) vs 9 floats (36 bytes) for 3×3
            matrix
          </li>
          <li>
            <strong>Composition:</strong> Multiply quaternions to combine rotations (fewer ops than
            matrix multiplication)
          </li>
          <li>
            <strong>Interpolation:</strong> SLERP provides smooth, constant-velocity rotation
            between orientations
          </li>
          <li>
            <strong>Numerical Stability:</strong> No gimbal lock, better floating-point behavior
          </li>
        </ul>
      </GlassPanel>
    </div>
  );
}

function OriginRebaseTab() {
  const [cameraPos, setCameraPos] = useState<[number, number, number]>([0, 0, 0]);
  const [threshold, setThreshold] = useState(5000);
  const [objects, setObjects] = useState<Array<{ position: [number, number, number]; id: number }>>(
    [
      { position: [1000, 0, 1000], id: 1 },
      { position: [2000, 500, 1500], id: 2 },
      { position: [3000, 1000, 2000], id: 3 },
    ]
  );
  const [rebaseState, setRebaseState] = useState<RebaseState>({
    origin: [0, 0, 0],
    threshold,
  });
  const [rebaseCount, setRebaseCount] = useState(0);

  const moveCamera = (dx: number, dz: number) => {
    const newPos: [number, number, number] = [
      cameraPos[0] + dx,
      cameraPos[1],
      cameraPos[2] + dz,
    ];
    setCameraPos(newPos);

    if (shouldRebase(newPos, rebaseState)) {
      const newOrigin: [number, number, number] = [newPos[0], newPos[1], newPos[2]];
      const newRebaseState: RebaseState = { ...rebaseState, origin: newOrigin };
      applyRebase([...objects, { position: newPos, id: -1 }], newRebaseState);
      setObjects([...objects]);
      setCameraPos([0, 0, 0]);
      setRebaseState({ origin: [0, 0, 0], threshold });
      setRebaseCount((c) => c + 1);
    }
  };

  const distance = distanceFromOrigin(cameraPos, rebaseState);
  const needsRebase = distance > threshold;

  return (
    <div className="space-y-6">
      <GlassPanel className="p-6">
        <h3 className="text-xl font-bold text-cyan-400 mb-4">Origin Rebasing (Floating Origin)</h3>
        <p className="text-gray-300 mb-4">
          For planet-scale or high-distance simulations: maintain high-order global coordinates
          (double or 64-bit integer) and local float coordinates near the camera. Periodically
          rebase the local origin when the camera crosses a threshold.
        </p>
      </GlassPanel>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <GlassPanel className="p-6">
          <h4 className="text-lg font-bold text-purple-400 mb-3">Camera Control</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Rebase Threshold: {threshold.toLocaleString()}
              </label>
              <input
                type="range"
                min="1000"
                max="10000"
                step="500"
                value={threshold}
                onChange={(e) => setThreshold(parseInt(e.target.value))}
                className="w-full"
                title="Rebase threshold distance"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <NeonButton onClick={() => moveCamera(0, -1000)}>↑ North</NeonButton>
              <NeonButton onClick={() => moveCamera(-1000, 0)}>← West</NeonButton>
              <NeonButton onClick={() => moveCamera(1000, 0)}>→ East</NeonButton>
              <div></div>
              <NeonButton onClick={() => moveCamera(0, 1000)}>↓ South</NeonButton>
            </div>
            <div className="p-3 bg-purple-500/10 rounded border border-purple-500/30 text-sm">
              <div className="text-gray-300">
                <strong className="text-purple-300">Camera Position:</strong>{" "}
                <span className="font-mono">
                  [{cameraPos[0].toFixed(0)}, {cameraPos[1].toFixed(0)}, {cameraPos[2].toFixed(0)}
                  ]
                </span>
              </div>
              <div className="text-gray-300 mt-1">
                <strong className="text-purple-300">Distance from Origin:</strong>{" "}
                <span
                  className={`font-mono ${needsRebase ? "text-orange-400 font-bold" : "text-cyan-400"}`}
                >
                  {distance.toFixed(0)}
                </span>
              </div>
              <div className="text-gray-300 mt-1">
                <strong className="text-purple-300">Rebase Count:</strong> {rebaseCount}
              </div>
            </div>
            {needsRebase && (
              <div className="p-3 bg-orange-500/20 rounded border border-orange-500/50 text-sm text-orange-300">
                ⚠️ Rebase will occur on next move!
              </div>
            )}
          </div>
        </GlassPanel>

        <GlassPanel className="p-6">
          <h4 className="text-lg font-bold text-cyan-400 mb-3">World Objects</h4>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {objects.map((obj) => (
              <div
                key={obj.id}
                className="p-3 bg-cyan-500/10 rounded border border-cyan-500/30 text-sm"
              >
                <div className="text-cyan-300 font-semibold">Object #{obj.id}</div>
                <div className="text-gray-300 font-mono text-xs mt-1">
                  Position: [{obj.position[0].toFixed(0)}, {obj.position[1].toFixed(0)},{" "}
                  {obj.position[2].toFixed(0)}]
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>
      </div>

      <GlassPanel className="p-6 bg-orange-500/5 border-orange-500/30">
        <h4 className="text-lg font-bold text-orange-400 mb-2">Why Origin Rebasing?</h4>
        <ul className="text-sm text-gray-300 space-y-1 list-disc list-inside">
          <li>
            <strong>Floating-Point Precision:</strong> Float32 loses precision beyond ~10,000 units
            from origin
          </li>
          <li>
            <strong>Jitter Elimination:</strong> Transform operations accumulate error at large
            distances → visible jitter
          </li>
          <li>
            <strong>Seamless Worlds:</strong> Allows effectively infinite world space without
            precision loss
          </li>
          <li>
            <strong>GPU Compatibility:</strong> Keeps vertex positions in high-precision range for
            shader calculations
          </li>
        </ul>
      </GlassPanel>
    </div>
  );
}

function CommandPatternTab() {
  const [stack] = useState(() => new CommandStack());
  const [obj, setObj] = useState({ position: [0, 0, 0] as [number, number, number] });
  const [history, setHistory] = useState<{ done: string[]; undone: string[] }>({
    done: [],
    undone: [],
  });

  const updateHistory = () => {
    setHistory(stack.debug());
  };

  const executeMove = (name: string, to: [number, number, number]) => {
    stack.exec(new MoveObject(name, obj, to));
    setObj({ ...obj });
    updateHistory();
  };

  const handleUndo = () => {
    stack.undo();
    setObj({ ...obj });
    updateHistory();
  };

  const handleRedo = () => {
    stack.redo();
    setObj({ ...obj });
    updateHistory();
  };

  return (
    <div className="space-y-6">
      <GlassPanel className="p-6">
        <h3 className="text-xl font-bold text-cyan-400 mb-4">Command Pattern (Undo/Redo)</h3>
        <p className="text-gray-300 mb-4">
          Wrap every editor action in commands with <code>do()</code> and <code>undo()</code>{" "}
          methods. Push/pop stacks for undo/redo. This is the standard approach for robust editor
          state changes and replayable debugging streams.
        </p>
      </GlassPanel>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <GlassPanel className="p-6">
          <h4 className="text-lg font-bold text-purple-400 mb-3">Object Control</h4>
          <div className="space-y-4">
            <div className="p-4 bg-purple-500/10 rounded border border-purple-500/30">
              <div className="text-lg font-semibold text-purple-300">Current Position</div>
              <div className="font-mono text-2xl text-cyan-400 mt-2">
                [{obj.position[0]}, {obj.position[1]}, {obj.position[2]}]
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <NeonButton onClick={() => executeMove("Move to [5,0,0]", [5, 0, 0])}>
                Move to [5,0,0]
              </NeonButton>
              <NeonButton onClick={() => executeMove("Move to [10,5,0]", [10, 5, 0])}>
                Move to [10,5,0]
              </NeonButton>
              <NeonButton onClick={() => executeMove("Move to [15,10,5]", [15, 10, 5])}>
                Move to [15,10,5]
              </NeonButton>
              <NeonButton onClick={() => executeMove("Move to [0,0,0]", [0, 0, 0])}>
                Reset to Origin
              </NeonButton>
            </div>
            <div className="flex gap-2">
              <NeonButton onClick={handleUndo} disabled={!stack.canUndo()}>
                ↶ Undo
              </NeonButton>
              <NeonButton onClick={handleRedo} disabled={!stack.canRedo()}>
                ↷ Redo
              </NeonButton>
              <NeonButton onClick={() => { stack.clear(); updateHistory(); }}>
                🗑️ Clear History
              </NeonButton>
            </div>
          </div>
        </GlassPanel>

        <GlassPanel className="p-6">
          <h4 className="text-lg font-bold text-cyan-400 mb-3">Command History</h4>
          <div className="space-y-4">
            <div>
              <div className="text-sm font-semibold text-green-400 mb-2">
                Done Stack ({history.done.length})
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {history.done.map((cmd, i) => (
                  <div
                    key={i}
                    className="p-2 bg-green-500/10 rounded border border-green-500/30 text-sm text-gray-300 font-mono"
                  >
                    {i + 1}. {cmd}
                  </div>
                ))}
                {history.done.length === 0 && (
                  <div className="text-sm text-gray-500 italic">No commands executed</div>
                )}
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold text-orange-400 mb-2">
                Undone Stack ({history.undone.length})
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {history.undone.map((cmd, i) => (
                  <div
                    key={i}
                    className="p-2 bg-orange-500/10 rounded border border-orange-500/30 text-sm text-gray-300 font-mono"
                  >
                    {i + 1}. {cmd}
                  </div>
                ))}
                {history.undone.length === 0 && (
                  <div className="text-sm text-gray-500 italic">No undone commands</div>
                )}
              </div>
            </div>
          </div>
        </GlassPanel>
      </div>

      <GlassPanel className="p-6 bg-blue-500/5 border-blue-500/30">
        <h4 className="text-lg font-bold text-blue-400 mb-2">Command Pattern Benefits</h4>
        <ul className="text-sm text-gray-300 space-y-1 list-disc list-inside">
          <li>
            <strong>Robust Undo/Redo:</strong> Every action is reversible with explicit state
            capture
          </li>
          <li>
            <strong>Debugging:</strong> Replay command sequences to reproduce bugs
          </li>
          <li>
            <strong>Macro Recording:</strong> Save command sequences as scripts or macros
          </li>
          <li>
            <strong>Collaboration:</strong> Send commands over network for real-time multi-user
            editing
          </li>
        </ul>
      </GlassPanel>
    </div>
  );
}

function ErosionTab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size] = useState(128);
  const [isEroding, setIsEroding] = useState(false);
  const [heightmap, setHeightmap] = useState<Float32Array>(() => {
    const h = new Float32Array(size * size);
    for (let i = 0; i < h.length; i++) {
      h[i] = Math.random() * 0.3;
    }
    return h;
  });
  const [params, setParams] = useState<ErosionParams>({
    iterations: 1000,
    inertia: 0.3,
    capacity: 2.0,
    evaporation: 0.05,
    minSlope: 0.01,
    gravity: 4.0,
  });

  const renderHeightmap = (h: Float32Array) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imageData = ctx.createImageData(size, size);
    const data = imageData.data;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        const height = Math.max(0, Math.min(1, (h[i] ?? 0) * 2));
        const value = Math.floor(height * 255);
        const pixelIndex = i * 4;
        // Terrain coloring
        if (height < 0.2) {
          // Water
          data[pixelIndex] = 30;
          data[pixelIndex + 1] = 80;
          data[pixelIndex + 2] = 160;
        } else if (height < 0.4) {
          // Sand
          data[pixelIndex] = 194 + value / 4;
          data[pixelIndex + 1] = 178 + value / 4;
          data[pixelIndex + 2] = 128 + value / 8;
        } else if (height < 0.7) {
          // Grass
          data[pixelIndex] = value / 3;
          data[pixelIndex + 1] = value;
          data[pixelIndex + 2] = value / 4;
        } else {
          // Rock/Snow
          data[pixelIndex] = value;
          data[pixelIndex + 1] = value;
          data[pixelIndex + 2] = value;
        }
        data[pixelIndex + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);
  };

  useEffect(() => {
    renderHeightmap(heightmap);
  }, [heightmap]);

  const runErosion = async () => {
    setIsEroding(true);
    const h = new Float32Array(heightmap);
    await new Promise((resolve) => setTimeout(resolve, 10));
    erode(h, size, params);
    setHeightmap(h);
    setIsEroding(false);
  };

  const resetTerrain = () => {
    const h = new Float32Array(size * size);
    for (let i = 0; i < h.length; i++) {
      h[i] = Math.random() * 0.3;
    }
    setHeightmap(h);
  };

  return (
    <div className="space-y-6">
      <GlassPanel className="p-6">
        <h3 className="text-xl font-bold text-cyan-400 mb-4">Particle Hydraulic Erosion</h3>
        <p className="text-gray-300 mb-4">
          Spawn droplet → follow gradient downhill → erode/deposit based on capacity/velocity →
          evaporate. This creates realistic gullies and riverbeds through iterative sediment
          transport simulation.
        </p>
      </GlassPanel>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <GlassPanel className="p-6">
          <h4 className="text-lg font-bold text-purple-400 mb-3">Heightmap Visualization</h4>
          <canvas
            ref={canvasRef}
            width={size}
            height={size}
            className="w-full border border-purple-500/30 rounded pixel-art"
          />
          <div className="flex gap-2 mt-4">
            <NeonButton onClick={runErosion} disabled={isEroding}>
              {isEroding ? "⏳ Eroding..." : "🌊 Apply Erosion"}
            </NeonButton>
            <NeonButton onClick={resetTerrain}>Generate New</NeonButton>
          </div>
        </GlassPanel>

        <GlassPanel className="p-6">
          <h4 className="text-lg font-bold text-cyan-400 mb-3">Erosion Parameters</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Iterations: {params.iterations}
              </label>
              <input
                type="range"
                min="100"
                max="5000"
                step="100"
                value={params.iterations}
                onChange={(e) =>
                  setParams({ ...params, iterations: parseInt(e.target.value) })
                }
                className="w-full"
                title="Number of erosion iterations"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Inertia: {params.inertia.toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={params.inertia}
                onChange={(e) =>
                  setParams({ ...params, inertia: parseFloat(e.target.value) })
                }
                className="w-full"
                title="Droplet inertia (momentum)"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Capacity: {params.capacity.toFixed(2)}
              </label>
              <input
                type="range"
                min="0.5"
                max="10"
                step="0.5"
                value={params.capacity}
                onChange={(e) =>
                  setParams({ ...params, capacity: parseFloat(e.target.value) })
                }
                className="w-full"
                title="Sediment transport capacity"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Evaporation: {params.evaporation.toFixed(3)}
              </label>
              <input
                type="range"
                min="0.001"
                max="0.2"
                step="0.005"
                value={params.evaporation}
                onChange={(e) =>
                  setParams({ ...params, evaporation: parseFloat(e.target.value) })
                }
                className="w-full"
                title="Water evaporation rate per iteration"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Min Slope: {params.minSlope.toFixed(3)}
              </label>
              <input
                type="range"
                min="0.001"
                max="0.1"
                step="0.005"
                value={params.minSlope}
                onChange={(e) =>
                  setParams({ ...params, minSlope: parseFloat(e.target.value) })
                }
                className="w-full"
                title="Minimum slope threshold for erosion"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Gravity: {params.gravity.toFixed(1)}
              </label>
              <input
                type="range"
                min="1"
                max="10"
                step="0.5"
                value={params.gravity}
                onChange={(e) =>
                  setParams({ ...params, gravity: parseFloat(e.target.value) })
                }
                className="w-full"
                title="Gravitational acceleration"
              />
            </div>
          </div>
        </GlassPanel>
      </div>

      <GlassPanel className="p-6 bg-green-500/5 border-green-500/30">
        <h4 className="text-lg font-bold text-green-400 mb-2">Algorithm Details</h4>
        <ul className="text-sm text-gray-300 space-y-1 list-disc list-inside">
          <li>
            <strong>Droplet Spawn:</strong> Random position on heightmap, initial velocity/water
          </li>
          <li>
            <strong>Gradient Following:</strong> Central difference for height gradient, move
            downhill with inertia
          </li>
          <li>
            <strong>Transport Capacity:</strong> Based on velocity, water volume, and slope
          </li>
          <li>
            <strong>Erosion/Deposition:</strong> Erode if under capacity, deposit if over capacity
          </li>
          <li>
            <strong>Evaporation:</strong> Reduce water volume each step until droplet dies
          </li>
        </ul>
      </GlassPanel>
    </div>
  );
}
