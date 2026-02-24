import { useCallback, useEffect, useRef, useState } from "react";

/**
 * LabGraphicsGeneratorPage
 *
 * Real-time Canvas renderer for graphics_generator.py mathematical animations.
 *
 * Features:
 * - Radial lattice graph with animated limbs
 * - Quaternion-based 3D rotation
 * - Camera controls (zoom, pan, rotation)
 * - Audio-reactive modulation support
 * - Performance monitoring
 */

interface GraphicsSnapshot {
  time_tick: number;
  elapsed_seconds: number;
  nodes: Array<{
    id: number;
    world: [number, number, number];
    screen: [number, number];
  }>;
  edges: Array<{
    a: number;
    b: number;
    a_screen: [number, number];
    b_screen: [number, number];
    stroke: string;
    stroke_width: number;
    opacity: number;
  }>;
  limbs: Array<{
    limb_index: number;
    start_screen: [number, number];
    end_screen: [number, number];
    stroke: string;
    stroke_width: number;
    opacity: number;
  }>;
  viewport: {
    width: number;
    height: number;
  };
  mind_eye: [number, number, number];
  camera: {
    zoom: number;
    pan: [number, number];
    rotation: number;
    quaternion_position: [number, number, number];
    quaternion_rotation: [number, number, number, number];
    lattice_rotation: [number, number, number, number];
    lattice_euler_degrees: {
      yaw: number;
      pitch: number;
      roll: number;
    };
  };
  audio_modulation?: {
    limb_speed_scale: number;
    limb_color_rgb: [number, number, number];
    brightness_scale: number;
    pulse_intensity: number;
  };
}

export function LabGraphicsGeneratorPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [fps, setFps] = useState(0);
  const [snapshot, setSnapshot] = useState<GraphicsSnapshot | null>(null);

  // Camera controls
  const [zoom, setZoom] = useState(1.0);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [rotation, setRotation] = useState(0);

  // Audio modulation controls
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [brightness, setBrightness] = useState(1.0);
  const [pulse, setPulse] = useState(0.0);

  // Render snapshot to canvas
  const renderSnapshot = useCallback((snap: GraphicsSnapshot) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size to match viewport
    canvas.width = snap.viewport.width;
    canvas.height = snap.viewport.height;

    // Clear canvas
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Enable anti-aliasing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Render edges first (back layer)
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const edge of snap.edges) {
      const [ax, ay] = edge.a_screen;
      const [bx, by] = edge.b_screen;

      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.strokeStyle = edge.stroke;
      ctx.lineWidth = edge.stroke_width;
      ctx.globalAlpha = edge.opacity;
      ctx.stroke();
    }

    // Render limbs (animated arms)
    for (const limb of snap.limbs) {
      const [sx, sy] = limb.start_screen;
      const [ex, ey] = limb.end_screen;

      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.strokeStyle = limb.stroke;
      ctx.lineWidth = limb.stroke_width;
      ctx.globalAlpha = limb.opacity;
      ctx.stroke();

      // Draw endpoint glow
      ctx.globalAlpha = limb.opacity * 0.5;
      ctx.fillStyle = limb.stroke;
      ctx.beginPath();
      ctx.arc(ex, ey, limb.stroke_width * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Render nodes (on top)
    ctx.globalAlpha = 1.0;
    for (const node of snap.nodes) {
      const [x, y] = node.screen;

      // Glow effect
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, 6);
      gradient.addColorStop(0, "rgba(255, 255, 255, 0.9)");
      gradient.addColorStop(0.5, "rgba(100, 200, 255, 0.6)");
      gradient.addColorStop(1, "rgba(0, 150, 255, 0)");

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();

      // Solid center
      ctx.fillStyle = node.id === 0 ? "#ff00ff" : "#ffffff";
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw mind's eye indicator
    const [mx, my] = [snap.mind_eye[0], snap.mind_eye[1]];
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = "#ff00ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mx, my, 20, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 1.0;
  }, []);

  // Mock snapshot generator (in production, fetch from Python backend)
  const generateMockSnapshot = useCallback((tick: number): GraphicsSnapshot => {
    const w = 1024;
    const h = 768;
    const cx = w / 2;
    const cy = h / 2;

    // Generate simple radial nodes
    const nodes = [];
    nodes.push({ id: 0, world: [cx, cy, 0], screen: [cx, cy] });

    const rings = 3;
    const baseNodes = 4;
    let nodeId = 1;

    for (let r = 1; r < rings; r++) {
      const count = baseNodes * (r + 1);
      const radius = 80 * Math.sqrt(r + 1) * zoom;

      for (let i = 0; i < count; i++) {
        const angle = (2 * Math.PI / count) * i + rotation;
        const wx = cx + radius * Math.cos(angle) + panX;
        const wy = cy + radius * Math.sin(angle) + panY;
        nodes.push({ id: nodeId++, world: [wx, wy, 0], screen: [wx, wy] });
      }
    }

    // Generate edges (spokes to hub + ring connections)
    const edges = [];
    for (let i = 1; i < nodes.length; i++) {
      const a = nodes[0]!;
      const b = nodes[i]!;
      edges.push({
        a: 0,
        b: i,
        a_screen: a.screen,
        b_screen: b.screen,
        stroke: "cyan",
        stroke_width: 1.5,
        opacity: 0.6
      });
    }

    // Generate animated limbs
    const numLimbs = 6;
    const limbs = [];
    const t = tick * 0.03;

    for (let i = 0; i < numLimbs; i++) {
      const phase = (2 * Math.PI / numLimbs) * i;
      const angle = Math.sin(0.05 * t + phase) * (Math.PI / 6);
      const length = 60 + 4 * i;

      const ex = cx + length * Math.cos(angle);
      const ey = cy + length * Math.sin(angle);

      let color = "rgb(255, 0, 255)";
      if (audioEnabled) {
        const r = Math.floor(255 * (0.5 + 0.5 * Math.sin(t * 0.1 + i)));
        const b = Math.floor(255 * (0.5 + 0.5 * Math.cos(t * 0.1 + i)));
        color = `rgb(${r}, 100, ${b})`;
      }

      limbs.push({
        limb_index: i,
        start_screen: [cx, cy],
        end_screen: [ex, ey],
        stroke: color,
        stroke_width: 2.5 * brightness,
        opacity: 0.8 * brightness + 0.2 * pulse
      });
    }

    return {
      time_tick: tick,
      elapsed_seconds: tick * 0.03,
      nodes: nodes as any,
      edges: edges as any,
      limbs: limbs as any,
      viewport: { width: w, height: h },
      mind_eye: [cx, cy, 0],
      camera: {
        zoom,
        pan: [panX, panY],
        rotation,
        quaternion_position: [cx, cy, 600],
        quaternion_rotation: [0, 0, 0, 1],
        lattice_rotation: [0, 0, Math.sin(t * 0.001), Math.cos(t * 0.001)],
        lattice_euler_degrees: { yaw: 0, pitch: 0, roll: t * 0.057 }
      }
    };
  }, [zoom, panX, panY, rotation, audioEnabled, brightness, pulse]);

  // Animation loop
  useEffect(() => {
    if (!isPlaying) return;

    let lastTime = performance.now();
    let frameCount = 0;
    let tick = 0;

    const animate = (currentTime: number) => {
      // Generate new snapshot
      const snap = generateMockSnapshot(tick++);
      setSnapshot(snap);
      renderSnapshot(snap);

      // Calculate FPS
      frameCount++;
      const elapsed = currentTime - lastTime;
      if (elapsed >= 1000) {
        setFps(Math.round((frameCount * 1000) / elapsed));
        frameCount = 0;
        lastTime = currentTime;
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, renderSnapshot, generateMockSnapshot]);

  return (
    <div className="h-full bg-gradient-to-br from-gray-900 via-purple-900 to-black text-white p-4 overflow-auto">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="glass-panel rounded-2xl p-4">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            📐 Graphics Generator
          </h1>
          <p className="text-gray-400 mt-2">
            Mathematical scene synthesis with quaternion rotations and harmonic animations
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Canvas Viewport */}
          <div className="lg:col-span-2 glass-panel rounded-2xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-purple-300">Viewport</h2>
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-400">
                  FPS: <span className="text-green-400 font-mono">{fps}</span>
                </div>
                <div className="text-sm text-gray-400">
                  Tick: <span className="text-cyan-400 font-mono">{snapshot?.time_tick || 0}</span>
                </div>
              </div>
            </div>

            <div className="bg-black rounded-xl overflow-hidden border border-purple-500/30">
              <canvas
                ref={canvasRef}
                className="w-full h-auto"
                style={{ imageRendering: "auto" }}
              />
            </div>

            {/* Playback Controls */}
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 font-semibold transition-all"
              >
                {isPlaying ? "⏸️ Pause" : "▶️ Play"}
              </button>
              <button
                onClick={() => {
                  setZoom(1.0);
                  setPanX(0);
                  setPanY(0);
                  setRotation(0);
                }}
                className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-all"
              >
                🔄 Reset Camera
              </button>
            </div>
          </div>

          {/* Controls Panel */}
          <div className="space-y-4">
            {/* Camera Controls */}
            <div className="glass-panel rounded-2xl p-4">
              <h3 className="text-lg font-bold text-purple-300 mb-3">📷 Camera</h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Zoom: {zoom.toFixed(2)}x
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="w-full accent-purple-500"
                    aria-label="Zoom level"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Pan X: {panX.toFixed(0)}px
                  </label>
                  <input
                    type="range"
                    min="-200"
                    max="200"
                    step="10"
                    value={panX}
                    onChange={(e) => setPanX(parseFloat(e.target.value))}
                    className="w-full accent-purple-500"
                    aria-label="Pan X"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Pan Y: {panY.toFixed(0)}px
                  </label>
                  <input
                    type="range"
                    min="-200"
                    max="200"
                    step="10"
                    value={panY}
                    onChange={(e) => setPanY(parseFloat(e.target.value))}
                    className="w-full accent-purple-500"
                    aria-label="Pan Y"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Rotation: {(rotation * 57.3).toFixed(1)}°
                  </label>
                  <input
                    type="range"
                    min="0"
                    max={Math.PI * 2}
                    step="0.1"
                    value={rotation}
                    onChange={(e) => setRotation(parseFloat(e.target.value))}
                    className="w-full accent-purple-500"
                    aria-label="Rotation"
                  />
                </div>
              </div>
            </div>

            {/* Audio Modulation */}
            <div className="glass-panel rounded-2xl p-4">
              <h3 className="text-lg font-bold text-pink-300 mb-3">🎵 Audio Reactive</h3>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={audioEnabled}
                    onChange={(e) => setAudioEnabled(e.target.checked)}
                    className="accent-pink-500"
                    aria-label="Enable Audio Modulation"
                  />
                  <label className="text-sm text-gray-300">Enable Audio Modulation</label>
                </div>

                {audioEnabled && (
                  <>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">
                        Brightness: {brightness.toFixed(2)}
                      </label>
                      <input
                        type="range"
                        min="0.2"
                        max="1.0"
                        step="0.05"
                        value={brightness}
                        onChange={(e) => setBrightness(parseFloat(e.target.value))}
                        className="w-full accent-pink-500"
                        aria-label="Brightness"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-gray-400 mb-1">
                        Pulse: {pulse.toFixed(2)}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={pulse}
                        onChange={(e) => setPulse(parseFloat(e.target.value))}
                        className="w-full accent-pink-500"
                        aria-label="Pulse"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Scene Info */}
            {snapshot && (
              <div className="glass-panel rounded-2xl p-4">
                <h3 className="text-lg font-bold text-cyan-300 mb-3">📊 Scene Stats</h3>

                <div className="space-y-2 text-sm font-mono">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Nodes:</span>
                    <span className="text-white">{snapshot.nodes.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Edges:</span>
                    <span className="text-white">{snapshot.edges.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Limbs:</span>
                    <span className="text-white">{snapshot.limbs.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Elapsed:</span>
                    <span className="text-white">{snapshot.elapsed_seconds.toFixed(2)}s</span>
                  </div>

                  {snapshot.camera.lattice_euler_degrees && (
                    <div className="mt-3 pt-3 border-t border-gray-700">
                      <div className="text-gray-400 mb-2">Lattice Orientation:</div>
                      <div className="pl-2 space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Yaw:</span>
                          <span className="text-cyan-400">
                            {snapshot.camera.lattice_euler_degrees.yaw.toFixed(1)}°
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Pitch:</span>
                          <span className="text-cyan-400">
                            {snapshot.camera.lattice_euler_degrees.pitch.toFixed(1)}°
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Roll:</span>
                          <span className="text-cyan-400">
                            {snapshot.camera.lattice_euler_degrees.roll.toFixed(1)}°
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Documentation */}
        <div className="glass-panel rounded-2xl p-4">
          <h3 className="text-lg font-bold text-purple-300 mb-3">📖 About Graphics Generator</h3>
          <div className="text-gray-300 space-y-2 text-sm">
            <p>
              <strong className="text-purple-400">Mathematical Scene Synthesis:</strong> Pure math engine
              for generating animated 3D graphics. No DOM, no Canvas API in the core - just mathematical
              state that can be rendered anywhere.
            </p>
            <p>
              <strong className="text-cyan-400">Key Features:</strong>
            </p>
            <ul className="list-disc list-inside pl-4 space-y-1 text-gray-400">
              <li>Radial lattice graph generation (polar coordinates)</li>
              <li>Quaternion-based 3D rotations (gimbal-lock free)</li>
              <li>Harmonic limb animation (sine wave oscillation)</li>
              <li>Dual camera systems (legacy 2D + quaternion 3D)</li>
              <li>Audio-reactive modulation support</li>
              <li>Render-agnostic snapshot output (JSON)</li>
            </ul>
            <p className="text-gray-500 text-xs mt-3">
              Backend: graphics_generator.py | Renderer: Canvas2D | Pipeline: Python Sidecar
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
