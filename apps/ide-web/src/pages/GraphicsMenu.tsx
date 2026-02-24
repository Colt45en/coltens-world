import React from "react";
import { Link } from "react-router-dom";

/**
 * GraphicsMenu
 *
 * Central navigation hub for all Graphics Lab tools and utilities.
 * Provides quick access to:
 * - Heightfield processor (terrain/DEM)
 * - Spin capture (360° avatar/product)
 * - Geometry engine (raycast/collision/metrics)
 * - Graphics generator (lattice animation)
 * - Mesh viewer (3D inspection)
 */

interface MenuCategory {
  title: string;
  icon: string;
  description: string;
  items: MenuLink[];
}

interface MenuLink {
  label: string;
  path: string;
  icon: string;
  description: string;
  tag?: "new" | "beta" | "core";
}

export function GraphicsMenu() {
  const categories: MenuCategory[] = [
    {
      title: "🎨 Asset Pipeline",
      icon: "🏭",
      description: "Create and optimize 3D assets",
      items: [
        {
          label: "Heightfield Processor",
          path: "/lab/graphics-lab?tab=heightfield",
          icon: "⛰️",
          description: "Convert DEM/terrain → GLB with normals & colors",
          tag: "core",
        },
        {
          label: "Spin Capture",
          path: "/lab/graphics-lab?tab=spin-capture",
          icon: "🔄",
          description: "360° spin frames + SVG outline from models",
          tag: "core",
        },
      ],
    },
    {
      title: "📊 Geometry Tools",
      icon: "🧮",
      description: "Math & physics queries on meshes",
      items: [
        {
          label: "Mesh Viewer",
          path: "/lab/graphics-lab?tab=geometry-viewer",
          icon: "📦",
          description: "Inspect meshes in real-time",
          tag: "core",
        },
        {
          label: "Raycast Tool",
          path: "/lab/graphics-lab?tab=raycast-tool",
          icon: "🎯",
          description: "Ray-triangle intersection & collision detection",
          tag: "new",
        },
        {
          label: "Metrics Dashboard",
          path: "/lab/graphics-lab?tab=metrics",
          icon: "📈",
          description: "Performance & geometry statistics",
          tag: "beta",
        },
      ],
    },
    {
      title: "🎬 Animation & Rendering",
      icon: "🎞️",
      description: "Real-time visualization & procedural generation",
      items: [
        {
          label: "Graphics Generator",
          path: "/lab/graphics-generator",
          icon: "🌀",
          description: "Quaternion lattice animation + camera controls",
          tag: "core",
        },
      ],
    },
    {
      title: "🧰 Utilities",
      icon: "🛠️",
      description: "Developer tools & diagnostics",
      items: [
        {
          label: "Geometry Engine API",
          path: "/docs/geometry-engine",
          icon: "📚",
          description: "API reference & code examples",
        },
      ],
    },
  ];

  const tagColors = {
    new: "bg-green-600 text-white",
    beta: "bg-amber-600 text-white",
    core: "bg-blue-600 text-white",
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-5xl font-bold text-cyan-400 mb-2">🎨 Graphics Platform</h1>
        <p className="text-lg text-slate-400">
          Unified workbench for 3D asset creation, geometry processing, and real-time visualization
        </p>
      </div>

      {/* Quick Access Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
        <Link
          to="/lab/graphics-lab?tab=heightfield"
          className="bg-gradient-to-br from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 p-6 rounded-lg transition transform hover:scale-105 border border-green-400"
        >
          <div className="text-4xl mb-2">⛰️</div>
          <div className="font-semibold mb-1">Quick Start: Heightfield</div>
          <div className="text-sm text-green-100">Convert terrain images to GLB meshes</div>
        </Link>

        <Link
          to="/lab/graphics-lab?tab=spin-capture"
          className="bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 p-6 rounded-lg transition transform hover:scale-105 border border-blue-400"
        >
          <div className="text-4xl mb-2">🔄</div>
          <div className="font-semibold mb-1">Quick Start: Spin Capture</div>
          <div className="text-sm text-blue-100">Generate 360° spin frames from models</div>
        </Link>

        <Link
          to="/lab/graphics-lab"
          className="bg-gradient-to-br from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 p-6 rounded-lg transition transform hover:scale-105 border border-purple-400"
        >
          <div className="text-4xl mb-2">🎨</div>
          <div className="font-semibold mb-1">Graphics Lab</div>
          <div className="text-sm text-purple-100">Full workbench with all tools</div>
        </Link>
      </div>

      {/* Menu Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {categories.map((category) => (
          <div key={category.title} className="space-y-4">
            {/* Category Header */}
            <div className="border-l-4 border-cyan-400 pl-4 mb-4">
              <h2 className="text-2xl font-bold text-cyan-400 mb-1">{category.title}</h2>
              <p className="text-sm text-slate-400">{category.description}</p>
            </div>

            {/* Category Items */}
            <div className="space-y-3">
              {category.items.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className="block bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-600 hover:border-slate-500 p-4 transition group"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{item.icon}</span>
                      <div>
                        <div className="font-semibold text-white group-hover:text-cyan-400 transition">
                          {item.label}
                        </div>
                        <div className="text-xs text-slate-500">{item.description}</div>
                      </div>
                    </div>
                    {item.tag && (
                      <span
                        className={`text-xs font-semibold px-2 py-1 rounded whitespace-nowrap ${
                          tagColors[item.tag]
                        }`}
                      >
                        {item.tag.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 group-hover:text-slate-300 transition">
                    → Click to open
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Feature Highlights */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-600">
          <div className="text-2xl mb-2">🎯</div>
          <div className="font-semibold text-cyan-300 mb-1">Accuracy</div>
          <div className="text-xs text-slate-400">
            Möller–Trumbore ray-triangle. Central-diff normals. Taubin smoothing.
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-4 border border-slate-600">
          <div className="text-2xl mb-2">⚡</div>
          <div className="font-semibold text-cyan-300 mb-1">Performance</div>
          <div className="text-xs text-slate-400">
            Deterministic queries. Frame vs total metrics. GPU disposal.
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-4 border border-slate-600">
          <div className="text-2xl mb-2">🔧</div>
          <div className="font-semibold text-cyan-300 mb-1">Ergonomic</div>
          <div className="text-xs text-slate-400">
            Sliders, toggles, presets. Non-square images. Auto-normalize.
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-4 border border-slate-600">
          <div className="text-2xl mb-2">📦</div>
          <div className="font-semibold text-cyan-300 mb-1">Export</div>
          <div className="text-xs text-slate-400">
            ZIP archives. GLB/PNG/JSON manifests. OPFS persistence.
          </div>
        </div>
      </div>

      {/* Architecture Overview */}
      <div className="mt-12 bg-slate-800 rounded-lg border border-slate-600 p-6">
        <h3 className="text-xl font-bold text-cyan-400 mb-4">🏗️ Architecture</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
          <div>
            <div className="font-semibold text-cyan-300 mb-2">Frontend (React + THREE.js)</div>
            <ul className="text-slate-400 space-y-1 list-disc ml-4">
              <li>HeightfieldCodexButton.tsx</li>
              <li>SpinCaptureCodexButton.tsx</li>
              <li>LabGraphicsLabPage.tsx</li>
              <li>Real-time canvas rendering</li>
            </ul>
          </div>
          <div>
            <div className="font-semibold text-cyan-300 mb-2">Backend (Python)</div>
            <ul className="text-slate-400 space-y-1 list-disc ml-4">
              <li>geometry_engine.py</li>
              <li>graphics_generator.py</li>
              <li>WebSocket streaming</li>
              <li>Deterministic metrics</li>
            </ul>
          </div>
          <div>
            <div className="font-semibold text-cyan-300 mb-2">Data (GLB/JSON)</div>
            <ul className="text-slate-400 space-y-1 list-disc ml-4">
              <li>GLB meshes (GLTF binary)</li>
              <li>Manifests (metadata)</li>
              <li>ZIP archives</li>
              <li>Metrics snapshots</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-12 text-center text-xs text-slate-500 border-t border-slate-700 pt-6">
        <p>Graphics Platform v1.0</p>
        <p className="mt-1">
          Built with React • THREE.js • Python geometry_engine • Dual Codex (Heightfield + Spin)
        </p>
      </div>
    </div>
  );
}

export default GraphicsMenu;
