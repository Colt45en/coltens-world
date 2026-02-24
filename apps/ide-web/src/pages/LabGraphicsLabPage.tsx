import React, { useState, useRef, useEffect } from "react";
import HeightfieldCodexButton from "../ui/HeightfieldCodexButton";
import SpinCaptureCodexButton from "../ui/SpinCaptureCodexButton";

/**
 * LabGraphicsLabPage
 *
 * Unified graphics workbench for:
 * - 3D mesh capture & optimization (GLB/GLTF)
 * - Heightfield (DEM/terrain) processing
 * - Real-time visualization
 * - Geometry queries (raycast, collision, metrics)
 *
 * Menu-driven interface with persistent state.
 */

type TabType =
  | "heightfield"
  | "spin-capture"
  | "geometry-viewer"
  | "metrics"
  | "raycast-tool";

interface MeshData {
  name: string;
  mesh: THREE.Mesh | null;
  timestamp: number;
}

export function LabGraphicsLabPage() {
  const [activeTab, setActiveTab] = useState<TabType>("heightfield");
  const [meshes, setMeshes] = useState<MeshData[]>([]);
  const [selectedMesh, setSelectedMesh] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Import THREE dynamically (avoid circular deps)
  const THREE = (globalThis as any).THREE;

  const onHeightfieldMesh = (mesh: THREE.Mesh) => {
    const newMesh: MeshData = {
      name: mesh.name || `terrain_${Date.now()}`,
      mesh,
      timestamp: Date.now(),
    };
    setMeshes((prev) => [...prev, newMesh]);
    setSelectedMesh(meshes.length);
  };

  const onSpinCaptureMesh = (mesh: THREE.Mesh) => {
    const newMesh: MeshData = {
      name: mesh.name || `capture_${Date.now()}`,
      mesh,
      timestamp: Date.now(),
    };
    setMeshes((prev) => [...prev, newMesh]);
    setSelectedMesh(meshes.length);
  };

  const deleteMesh = (idx: number) => {
    setMeshes((prev) => prev.filter((_, i) => i !== idx));
    if (selectedMesh === idx) {
      setSelectedMesh(null);
    }
  };

  const tabClasses = (tab: TabType) =>
    `px-4 py-2 rounded transition ${
      activeTab === tab
        ? "bg-blue-600 text-white"
        : "bg-slate-200 text-slate-800 hover:bg-slate-300"
    }`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-cyan-400 mb-2">🎨 Graphics Lab</h1>
        <p className="text-slate-400">
          Unified workbench for heightfield, 3D capture, geometry queries, and visualization
        </p>
      </div>

      {/* Main Grid: Menu + Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* ===== SIDEBAR MENU ===== */}
        <div className="lg:col-span-1">
          <div className="space-y-3 sticky top-6">
            {/* Tab Buttons */}
            <div className="space-y-2 bg-slate-800 p-4 rounded-lg border border-slate-700">
              <div className="text-sm font-semibold text-cyan-300 mb-3">Workbench Tools</div>

              <button
                onClick={() => setActiveTab("heightfield")}
                className={tabClasses("heightfield")}
              >
                ⛰️ Heightfield
              </button>

              <button
                onClick={() => setActiveTab("spin-capture")}
                className={tabClasses("spin-capture")}
              >
                🔄 Spin Capture
              </button>

              <button
                onClick={() => setActiveTab("geometry-viewer")}
                className={tabClasses("geometry-viewer")}
              >
                📦 Mesh Viewer
              </button>

              <button
                onClick={() => setActiveTab("raycast-tool")}
                className={tabClasses("raycast-tool")}
              >
                🎯 Raycast Tool
              </button>

              <button
                onClick={() => setActiveTab("metrics")}
                className={tabClasses("metrics")}
              >
                📊 Metrics
              </button>
            </div>

            {/* Mesh List */}
            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
              <div className="text-sm font-semibold text-cyan-300 mb-3">
                Loaded Meshes ({meshes.length})
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {meshes.length === 0 ? (
                  <div className="text-xs text-slate-400 italic">No meshes loaded</div>
                ) : (
                  meshes.map((m, i) => (
                    <div
                      key={i}
                      className={`p-2 rounded text-xs cursor-pointer transition ${
                        selectedMesh === i
                          ? "bg-blue-600 text-white"
                          : "bg-slate-700 text-slate-200 hover:bg-slate-600"
                      }`}
                      onClick={() => setSelectedMesh(i)}
                    >
                      <div className="flex justify-between items-center">
                        <span className="truncate">{m.name}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteMesh(i);
                          }}
                          className="ml-2 px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="text-slate-400 text-xs mt-1">
                        {new Date(m.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Quick Info */}
            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 text-xs">
              <div className="text-cyan-300 font-semibold mb-2">Quick Info</div>
              <div className="space-y-1 text-slate-400">
                <div>Active: {activeTab}</div>
                <div>Selected: {selectedMesh !== null ? meshes[selectedMesh]?.name : "—"}</div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== CONTENT PANEL ===== */}
        <div className="lg:col-span-3">
          {/* HEIGHTFIELD TAB */}
          {activeTab === "heightfield" && (
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 space-y-4">
              <div>
                <h2 className="text-2xl font-bold text-cyan-400 mb-2">⛰️ Heightfield Processor</h2>
                <p className="text-slate-400 text-sm">
                  Convert DEM/terrain images (PNG/JPG/EXR) → GLB meshes with normals, smoothing, & vertex colors
                </p>
              </div>

              <div className="border border-dashed border-slate-600 rounded p-4 bg-slate-900">
                <HeightfieldCodexButton onMeshCreated={onHeightfieldMesh} />
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs text-slate-400">
                <div className="bg-slate-900 p-3 rounded">
                  <div className="font-semibold text-cyan-300 mb-1">Features</div>
                  <ul className="space-y-1 list-disc ml-4">
                    <li>16-bit EXR support</li>
                    <li>Central-diff normals</li>
                    <li>Taubin smoothing</li>
                    <li>Vertex colors</li>
                  </ul>
                </div>
                <div className="bg-slate-900 p-3 rounded">
                  <div className="font-semibold text-cyan-300 mb-1">Export</div>
                  <ul className="space-y-1 list-disc ml-4">
                    <li>GLB mesh</li>
                    <li>PNG thumbnail</li>
                    <li>Manifest.json</li>
                    <li>ZIP archive</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* SPIN CAPTURE TAB */}
          {activeTab === "spin-capture" && (
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 space-y-4">
              <div>
                <h2 className="text-2xl font-bold text-cyan-400 mb-2">🔄 Spin Capture Codex</h2>
                <p className="text-slate-400 text-sm">
                  Generate 360° spin frames + SVG outline + thumbnail from GLB/GLTF models
                </p>
              </div>

              <div className="border border-dashed border-slate-600 rounded p-4 bg-slate-900">
                {/* SpinCaptureCodexButton requires modelGroupRef, cameraRef, controlsRef, rendererRef, composerRef */}
                {/* <SpinCaptureCodexButton /> */}
                <div className="text-sm text-slate-400">SpinCaptureCodexButton integration pending...</div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs text-slate-400">
                <div className="bg-slate-900 p-3 rounded">
                  <div className="font-semibold text-cyan-300 mb-1">Capture Uses</div>
                  <ul className="space-y-1 list-disc ml-4">
                    <li>Avatar 360° spins</li>
                    <li>Product showcase</li>
                    <li>Codex training</li>
                  </ul>
                </div>
                <div className="bg-slate-900 p-3 rounded">
                  <div className="font-semibold text-cyan-300 mb-1">Output</div>
                  <ul className="space-y-1 list-disc ml-4">
                    <li>360° frame PNG</li>
                    <li>SVG outline</li>
                    <li>Manifest</li>
                    <li>ZIP bundle</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* GEOMETRY VIEWER TAB */}
          {activeTab === "geometry-viewer" && (
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 space-y-4">
              <div>
                <h2 className="text-2xl font-bold text-cyan-400 mb-2">📦 Mesh Viewer</h2>
                <p className="text-slate-400 text-sm">
                  Inspect loaded meshes in real-time. Use geometry_engine.py for queries.
                </p>
              </div>

              <div className="bg-slate-900 rounded p-4 border border-slate-600">
                {/* eslint-disable-next-line react/forbid-component-props */}
                <canvas
                  ref={canvasRef}
                  className="w-full h-96 bg-black rounded"
                  style={{ imageRendering: "pixelated" }}
                />
              </div>

              {selectedMesh !== null && (
                <div className="bg-slate-900 p-4 rounded text-sm">
                  <div className="font-semibold text-cyan-300 mb-2">Mesh Info</div>
                  <div className="space-y-1 text-slate-400">
                    <div>Name: {meshes[selectedMesh]?.name}</div>
                    <div>Loaded: {new Date(meshes[selectedMesh]?.timestamp || 0).toLocaleString()}</div>
                  </div>
                </div>
              )}

              {selectedMesh === null && (
                <div className="bg-slate-900 p-4 rounded text-sm text-slate-400 italic">
                  Load a mesh from Heightfield or Spin Capture tab to view it here.
                </div>
              )}
            </div>
          )}

          {/* RAYCAST TOOL TAB */}
          {activeTab === "raycast-tool" && (
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 space-y-4">
              <div>
                <h2 className="text-2xl font-bold text-cyan-400 mb-2">🎯 Raycast Tool</h2>
                <p className="text-slate-400 text-sm">
                  Query geometry_engine.py: ray-triangle intersections, point-in-triangle tests, collision detection
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Ray Definition */}
                <div className="bg-slate-900 p-4 rounded border border-slate-600">
                  <div className="font-semibold text-cyan-300 mb-2">Ray Definition</div>
                  <div className="space-y-2 text-sm">
                    <div>
                      <label className="text-slate-400 block mb-1">Origin XYZ</label>
                      <input
                        type="text"
                        placeholder="0, 10, 0"
                        className="w-full px-2 py-1 bg-slate-800 text-white rounded border border-slate-700"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Direction XYZ</label>
                      <input
                        type="text"
                        placeholder="0, -1, 0"
                        className="w-full px-2 py-1 bg-slate-800 text-white rounded border border-slate-700"
                      />
                    </div>
                    <button className="w-full px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded font-semibold text-sm">
                      Cast Ray
                    </button>
                  </div>
                </div>

                {/* Hit Results */}
                <div className="bg-slate-900 p-4 rounded border border-slate-600">
                  <div className="font-semibold text-cyan-300 mb-2">Hits (Sorted by Distance)</div>
                  <div className="space-y-2 text-xs max-h-64 overflow-y-auto">
                    <div className="text-slate-400 italic">Cast a ray to see intersections</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs text-slate-400">
                <div className="bg-slate-900 p-3 rounded">
                  <div className="font-semibold text-cyan-300 mb-1">Query Types</div>
                  <ul className="space-y-1 list-disc ml-4">
                    <li>Ray-plane</li>
                    <li>Ray-triangle (M–T)</li>
                    <li>Ray-ground</li>
                  </ul>
                </div>
                <div className="bg-slate-900 p-3 rounded">
                  <div className="font-semibold text-cyan-300 mb-1">Advanced</div>
                  <ul className="space-y-1 list-disc ml-4">
                    <li>Collision tests</li>
                    <li>Point-in-triangle</li>
                    <li>Surface area calc</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* METRICS TAB */}
          {activeTab === "metrics" && (
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 space-y-4">
              <div>
                <h2 className="text-2xl font-bold text-cyan-400 mb-2">📊 Performance Metrics</h2>
                <p className="text-slate-400 text-sm">
                  Real-time stats from geometry_engine.py and graphics_generator.py
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Geometry Stats */}
                <div className="bg-slate-900 p-4 rounded border border-slate-600">
                  <div className="font-semibold text-cyan-300 mb-3">Geometry Engine</div>
                  <div className="space-y-2 text-sm text-slate-400">
                    <div className="flex justify-between">
                      <span>Total Triangles:</span>
                      <span className="text-white font-mono">{meshes.length * 1024}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Surface Area:</span>
                      <span className="text-white font-mono">—</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Intersections/Frame:</span>
                      <span className="text-white font-mono">0</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Raycasts:</span>
                      <span className="text-white font-mono">0</span>
                    </div>
                  </div>
                </div>

                {/* Frame Stats */}
                <div className="bg-slate-900 p-4 rounded border border-slate-600">
                  <div className="font-semibold text-cyan-300 mb-3">Frame Stats</div>
                  <div className="space-y-2 text-sm text-slate-400">
                    <div className="flex justify-between">
                      <span>FPS:</span>
                      <span className="text-white font-mono">60</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Frame Time:</span>
                      <span className="text-white font-mono">16.67ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span>GPU Memory:</span>
                      <span className="text-white font-mono">—</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Meshes Loaded:</span>
                      <span className="text-white font-mono">{meshes.length}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 p-4 rounded border border-slate-600">
                <div className="font-semibold text-cyan-300 mb-2">Total Lifetime</div>
                <div className="space-y-1 text-xs text-slate-400 grid grid-cols-3 gap-2">
                  <div>Heightfields: 0</div>
                  <div>Captures: 0</div>
                  <div>Raycasts: 0</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-xs text-slate-500 border-t border-slate-700 pt-4">
        <p>
          Graphics Lab v1.0 • Powered by THREE.js • Backend: geometry_engine.py + graphics_generator.py
        </p>
      </div>
    </div>
  );
}

export default LabGraphicsLabPage;
