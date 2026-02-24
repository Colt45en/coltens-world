import React, { useEffect, useRef, useState } from "react";
import { Complex, ComplexUtils } from "../math/Complex";

type VisualizationMode = "argand" | "mandelbrot" | "julia" | "domain";

interface Point {
  real: number;
  imag: number;
  label?: string;
  color?: string;
}

export const LabComplexPlaygroundPage: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<VisualizationMode>("mandelbrot");
  const [points, setPoints] = useState<Point[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationFrameRef = useRef<number>();

  // Argand diagram controls
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);

  // Mandelbrot/Julia controls
  const [maxIterations, setMaxIterations] = useState(100);
  const [juliaC, setJuliaC] = useState({ real: -0.7, imag: 0.27015 });
  const [colorScheme, setColorScheme] = useState<"rainbow" | "grayscale" | "fire">("rainbow");

  // Calculator state
  const [calcZ1, setCalcZ1] = useState({ real: 2, imag: 3 });
  const [calcZ2, setCalcZ2] = useState({ real: 1, imag: -1 });
  const [calcOperation, setCalcOperation] = useState<"add" | "multiply" | "power" | "log">("add");
  const [calcResult, setCalcResult] = useState<Complex | null>(null);

  // Domain coloring function
  const [domainFunction, setDomainFunction] = useState<"z^2" | "z^3" | "exp" | "sin" | "1/z">(
    "z^2"
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (mode === "argand") {
      renderArgandDiagram(ctx);
    } else if (mode === "mandelbrot") {
      renderMandelbrot(ctx);
    } else if (mode === "julia") {
      renderJulia(ctx);
    } else if (mode === "domain") {
      renderDomainColoring(ctx);
    }
  }, [mode, points, zoom, panX, panY, maxIterations, juliaC, colorScheme, domainFunction]);

  const renderArgandDiagram = (ctx: CanvasRenderingContext2D) => {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;

    // Clear
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, width, height);

    const centerX = width / 2 + panX;
    const centerY = height / 2 + panY;
    const scale = 50 * zoom;

    // Draw grid
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;

    // Vertical lines (imaginary axis)
    for (let x = centerX % scale; x < width; x += scale) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Horizontal lines (real axis)
    for (let y = centerY % scale; y < height; y += scale) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw axes
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 2;

    // Real axis
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    // Imaginary axis
    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, height);
    ctx.stroke();

    // Draw axis labels
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "12px 'Orbitron', monospace";
    ctx.fillText("Re", width - 25, centerY - 10);
    ctx.fillText("Im", centerX + 10, 20);

    // Draw unit circle
    ctx.strokeStyle = "rgba(139,92,246,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(centerX, centerY, scale, 0, Math.PI * 2);
    ctx.stroke();

    // Draw points
    points.forEach((point) => {
      const x = centerX + point.real * scale;
      const y = centerY - point.imag * scale;

      // Point glow
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, 15);
      gradient.addColorStop(0, point.color || "#22d3ee");
      gradient.addColorStop(1, "rgba(34,211,238,0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, 15, 0, Math.PI * 2);
      ctx.fill();

      // Point
      ctx.fillStyle = point.color || "#22d3ee";
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();

      // Label
      if (point.label) {
        ctx.fillStyle = "#ffffff";
        ctx.font = "12px 'Orbitron', monospace";
        ctx.fillText(point.label, x + 10, y - 10);
      }

      // Vector from origin
      ctx.strokeStyle = point.color || "rgba(34,211,238,0.5)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x, y);
      ctx.stroke();

      // Magnitude/argument annotation
      const z = new Complex(point.real, point.imag);
      const mag = z.magnitude().toFixed(2);
      const arg = ((z.argument() * 180) / Math.PI).toFixed(1);
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "10px 'Orbitron', monospace";
      ctx.fillText(`|z|=${mag}, θ=${arg}°`, x + 10, y + 5);
    });

    // Draw scale markers
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "10px monospace";
    for (let i = -5; i <= 5; i++) {
      if (i === 0) continue;
      const x = centerX + i * scale;
      if (x > 0 && x < width) {
        ctx.fillText(i.toString(), x - 5, centerY + 15);
      }
      const y = centerY - i * scale;
      if (y > 0 && y < height) {
        ctx.fillText(`${i}i`, centerX + 10, y + 5);
      }
    }
  };

  const renderMandelbrot = (ctx: CanvasRenderingContext2D) => {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;

    const xMin = -2.5 / zoom + panX / 100;
    const xMax = 1.0 / zoom + panX / 100;
    const yMin = -1.25 / zoom + panY / 100;
    const yMax = 1.25 / zoom + panY / 100;

    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        const x = xMin + (px / width) * (xMax - xMin);
        const y = yMin + ((height - py) / height) * (yMax - yMin);

        const c = new Complex(x, y);
        const iter = ComplexUtils.mandelbrotIteration(c, maxIterations);

        const idx = (py * width + px) * 4;
        const color = iterationToColor(iter, maxIterations);
        data[idx] = color[0];
        data[idx + 1] = color[1];
        data[idx + 2] = color[2];
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);
  };

  const renderJulia = (ctx: CanvasRenderingContext2D) => {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;

    const xMin = -2.0 / zoom + panX / 100;
    const xMax = 2.0 / zoom + panX / 100;
    const yMin = -1.5 / zoom + panY / 100;
    const yMax = 1.5 / zoom + panY / 100;

    const c = new Complex(juliaC.real, juliaC.imag);
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        const x = xMin + (px / width) * (xMax - xMin);
        const y = yMin + ((height - py) / height) * (yMax - yMin);

        const z = new Complex(x, y);
        const iter = ComplexUtils.juliaIteration(z, c, maxIterations);

        const idx = (py * width + px) * 4;
        const color = iterationToColor(iter, maxIterations);
        data[idx] = color[0];
        data[idx + 1] = color[1];
        data[idx + 2] = color[2];
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);
  };

  const renderDomainColoring = (ctx: CanvasRenderingContext2D) => {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;

    const xMin = -2.0 / zoom;
    const xMax = 2.0 / zoom;
    const yMin = -2.0 / zoom;
    const yMax = 2.0 / zoom;

    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        const x = xMin + (px / width) * (xMax - xMin);
        const y = yMin + ((height - py) / height) * (yMax - yMin);

        const z = new Complex(x, y);
        const fz = applyDomainFunction(z);
        const color = ComplexUtils.domainColor(fz);

        const idx = (py * width + px) * 4;
        data[idx] = color[0];
        data[idx + 1] = color[1];
        data[idx + 2] = color[2];
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);
  };

  const applyDomainFunction = (z: Complex): Complex => {
    switch (domainFunction) {
      case "z^2":
        return z.purePower(2);
      case "z^3":
        return z.purePower(3);
      case "exp":
        return z.pureExp();
      case "sin":
        return z.pureSin();
      case "1/z":
        return z.pureInvert();
      default:
        return z;
    }
  };

  const iterationToColor = (iter: number, maxIter: number): [number, number, number] => {
    if (iter === maxIter) return [0, 0, 0];

    const t = iter / maxIter;

    if (colorScheme === "rainbow") {
      const hue = t * 360;
      return hslToRgb(hue, 80, 50);
    } else if (colorScheme === "grayscale") {
      const v = Math.floor(t * 255);
      return [v, v, v];
    } else {
      // Fire
      const r = Math.floor(t * 255);
      const g = Math.floor(t * t * 255);
      const b = 0;
      return [r, g, b];
    }
  };

  const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
    h = h / 360;
    s = s / 100;
    l = l / 100;

    let r, g, b;

    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode !== "argand") return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = canvas.width / 2 + panX;
    const centerY = canvas.height / 2 + panY;
    const scale = 50 * zoom;

    const real = (x - centerX) / scale;
    const imag = -(y - centerY) / scale;

    const newPoint: Point = {
      real,
      imag,
      label: `z${points.length + 1}`,
      color: `hsl(${(points.length * 137.5) % 360}, 70%, 60%)`,
    };

    setPoints([...points, newPoint]);
  };

  const performCalculation = () => {
    const z1 = new Complex(calcZ1.real, calcZ1.imag);
    const z2 = new Complex(calcZ2.real, calcZ2.imag);

    let result: Complex;

    switch (calcOperation) {
      case "add":
        result = z1.pureAdd(z2);
        break;
      case "multiply":
        result = z1.pureMultiply(z2);
        break;
      case "power":
        result = z1.purePower(z2);
        break;
      case "log":
        result = z1.pureLog();
        break;
      default:
        result = z1;
    }

    setCalcResult(result);
  };

  const addInterestingPoints = () => {
    const interesting: Point[] = [
      { real: 1, imag: 0, label: "1", color: "#22d3ee" },
      { real: 0, imag: 1, label: "i", color: "#a855f7" },
      { real: -1, imag: 0, label: "-1", color: "#ef4444" },
      { real: 0, imag: -1, label: "-i", color: "#f97316" },
      { real: Math.SQRT1_2, imag: Math.SQRT1_2, label: "e^(iπ/4)", color: "#10b981" },
    ];
    setPoints(interesting);
  };

  return (
    <div className="h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 text-white overflow-hidden">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/30 backdrop-blur-xl">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-scifi text-2xl bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                Complex Number Playground
              </h1>
              <p className="text-sm text-white/60 mt-1">
                Explore complex arithmetic, fractals, and domain coloring
              </p>
            </div>

            {/* Mode Tabs */}
            <div className="flex gap-2">
              {[
                { id: "argand", label: "Argand", icon: "📐" },
                { id: "mandelbrot", label: "Mandelbrot", icon: "🌀" },
                { id: "julia", label: "Julia", icon: "🎭" },
                { id: "domain", label: "Domain", icon: "🎨" },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id as VisualizationMode)}
                  className={`px-4 py-2 rounded-lg font-scifi text-sm transition-all ${
                    mode === m.id
                      ? "bg-purple-500/30 border-2 border-purple-400"
                      : "bg-white/5 border border-white/10 hover:bg-white/10"
                  }`}
                >
                  <span className="mr-2">{m.icon}</span>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-120px)]">
        {/* Canvas */}
        <div className="flex-1 relative flex items-center justify-center p-6">
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            className="border border-white/10 rounded-xl shadow-2xl cursor-crosshair"
            onClick={handleCanvasClick}
          />
        </div>

        {/* Controls Sidebar */}
        <div className="w-80 border-l border-white/10 bg-black/30 backdrop-blur-xl overflow-y-auto p-6">
          <div className="space-y-6">
            {/* View Controls */}
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <h3 className="font-scifi text-sm text-purple-400 mb-3">View Controls</h3>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-white/60">Zoom: {zoom.toFixed(1)}x</label>
                  <input
                    type="range"
                    min="0.1"
                    max="10"
                    step="0.1"
                    value={zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="w-full"
                    aria-label="Zoom level"
                  />
                </div>

                {mode !== "argand" && (
                  <>
                    <div>
                      <label className="text-xs text-white/60">Pan X: {panX}</label>
                      <input
                        type="range"
                        min="-200"
                        max="200"
                        value={panX}
                        onChange={(e) => setPanX(parseInt(e.target.value))}
                        className="w-full"
                        aria-label="Pan X axis"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-white/60">Pan Y: {panY}</label>
                      <input
                        type="range"
                        min="-200"
                        max="200"
                        value={panY}
                        onChange={(e) => setPanY(parseInt(e.target.value))}
                        className="w-full"
                        aria-label="Pan Y axis"
                      />
                    </div>
                  </>
                )}

                <button
                  onClick={() => {
                    setZoom(1);
                    setPanX(0);
                    setPanY(0);
                  }}
                  className="w-full px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/50 rounded-lg text-sm font-scifi transition-all"
                >
                  Reset View
                </button>
              </div>
            </div>

            {/* Mode-Specific Controls */}
            {mode === "argand" && (
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <h3 className="font-scifi text-sm text-cyan-400 mb-3">Argand Diagram</h3>
                <p className="text-xs text-white/60 mb-3">
                  Click on canvas to plot complex numbers
                </p>

                <div className="space-y-2">
                  <button
                    onClick={addInterestingPoints}
                    className="w-full px-3 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 rounded-lg text-sm transition-all"
                  >
                    Show Key Points
                  </button>

                  <button
                    onClick={() => setPoints([])}
                    className="w-full px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-400/50 rounded-lg text-sm transition-all"
                  >
                    Clear All
                  </button>
                </div>

                {points.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <div className="text-xs text-white/60">Plotted Points:</div>
                    {points.map((p, i) => (
                      <div key={i} className="text-xs bg-black/30 rounded px-2 py-1">
                        <span className="point-label" style={{ "--point-color": p.color } as React.CSSProperties}>{p.label}: </span>
                        <span className="text-white/80">
                          {p.real.toFixed(2)} {p.imag >= 0 ? "+" : "-"}{" "}
                          {Math.abs(p.imag).toFixed(2)}i
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {(mode === "mandelbrot" || mode === "julia") && (
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <h3 className="font-scifi text-sm text-purple-400 mb-3">Fractal Controls</h3>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-white/60">
                      Max Iterations: {maxIterations}
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="500"
                      step="10"
                      value={maxIterations}
                      onChange={(e) => setMaxIterations(parseInt(e.target.value))}
                      className="w-full"
                      aria-label="Maximum iterations"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-white/60">Color Scheme</label>
                    <div className="flex gap-2 mt-2">
                      {["rainbow", "grayscale", "fire"].map((scheme) => (
                        <button
                          key={scheme}
                          onClick={() => setColorScheme(scheme as typeof colorScheme)}
                          className={`flex-1 px-2 py-1 rounded text-xs capitalize ${
                            colorScheme === scheme
                              ? "bg-purple-500/30 border border-purple-400"
                              : "bg-white/5 border border-white/10"
                          }`}
                        >
                          {scheme}
                        </button>
                      ))}
                    </div>
                  </div>

                  {mode === "julia" && (
                    <>
                      <div>
                        <label className="text-xs text-white/60">Julia Constant (c)</label>
                        <div className="flex gap-2 mt-2">
                          <input
                            type="number"
                            step="0.01"
                            value={juliaC.real}
                            onChange={(e) =>
                              setJuliaC({ ...juliaC, real: parseFloat(e.target.value) })
                            }
                            className="flex-1 px-2 py-1 bg-black/30 border border-white/10 rounded text-sm"
                            placeholder="Real"
                          />
                          <input
                            type="number"
                            step="0.01"
                            value={juliaC.imag}
                            onChange={(e) =>
                              setJuliaC({ ...juliaC, imag: parseFloat(e.target.value) })
                            }
                            className="flex-1 px-2 py-1 bg-black/30 border border-white/10 rounded text-sm"
                            placeholder="Imag"
                          />
                        </div>
                      </div>

                      <div className="text-xs text-white/40">
                        Try: (-0.7, 0.27), (-0.4, 0.6), (0.285, 0.01)
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {mode === "domain" && (
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <h3 className="font-scifi text-sm text-cyan-400 mb-3">Domain Coloring</h3>
                <p className="text-xs text-white/60 mb-3">
                  Hue = phase, Lightness = magnitude
                </p>

                <div>
                  <label className="text-xs text-white/60">Function f(z)</label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {["z^2", "z^3", "exp", "sin", "1/z"].map((fn) => (
                      <button
                        key={fn}
                        onClick={() => setDomainFunction(fn as typeof domainFunction)}
                        className={`px-3 py-2 rounded font-mono text-sm ${
                          domainFunction === fn
                            ? "bg-cyan-500/30 border-2 border-cyan-400"
                            : "bg-white/5 border border-white/10 hover:bg-white/10"
                        }`}
                      >
                        {fn}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Calculator */}
            <div className="bg-gradient-to-br from-purple-500/10 to-cyan-500/10 border border-purple-400/30 rounded-lg p-4">
              <h3 className="font-scifi text-sm text-purple-400 mb-3">Complex Calculator</h3>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-white/60">z₁</label>
                  <div className="flex gap-2 mt-1">
                    <input
                      type="number"
                      step="0.1"
                      value={calcZ1.real}
                      onChange={(e) => setCalcZ1({ ...calcZ1, real: parseFloat(e.target.value) })}
                      className="flex-1 px-2 py-1 bg-black/30 border border-white/10 rounded text-sm"
                      placeholder="Real"
                    />
                    <input
                      type="number"
                      step="0.1"
                      value={calcZ1.imag}
                      onChange={(e) => setCalcZ1({ ...calcZ1, imag: parseFloat(e.target.value) })}
                      className="flex-1 px-2 py-1 bg-black/30 border border-white/10 rounded text-sm"
                      placeholder="Imag"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-white/60">Operation</label>
                  <select
                    value={calcOperation}
                    onChange={(e) => setCalcOperation(e.target.value as typeof calcOperation)}
                    className="w-full px-2 py-1 bg-black/30 border border-white/10 rounded text-sm mt-1"
                    aria-label="Mathematical operation"
                  >
                    <option value="add">z₁ + z₂</option>
                    <option value="multiply">z₁ × z₂</option>
                    <option value="power">z₁^z₂</option>
                    <option value="log">ln(z₁)</option>
                  </select>
                </div>

                {calcOperation !== "log" && (
                  <div>
                    <label className="text-xs text-white/60">z₂</label>
                    <div className="flex gap-2 mt-1">
                      <input
                        type="number"
                        step="0.1"
                        value={calcZ2.real}
                        onChange={(e) =>
                          setCalcZ2({ ...calcZ2, real: parseFloat(e.target.value) })
                        }
                        className="flex-1 px-2 py-1 bg-black/30 border border-white/10 rounded text-sm"
                        placeholder="Real"
                      />
                      <input
                        type="number"
                        step="0.1"
                        value={calcZ2.imag}
                        onChange={(e) =>
                          setCalcZ2({ ...calcZ2, imag: parseFloat(e.target.value) })
                        }
                        className="flex-1 px-2 py-1 bg-black/30 border border-white/10 rounded text-sm"
                        placeholder="Imag"
                      />
                    </div>
                  </div>
                )}

                <button
                  onClick={performCalculation}
                  className="w-full px-3 py-2 bg-purple-500/30 hover:bg-purple-500/40 border border-purple-400 rounded-lg font-scifi text-sm transition-all"
                >
                  Calculate
                </button>

                {calcResult && (
                  <div className="bg-black/30 rounded p-3">
                    <div className="text-xs text-white/60 mb-1">Result:</div>
                    <div className="font-mono text-cyan-400">{calcResult.toString()}</div>
                    <div className="text-xs text-white/40 mt-2">
                      |z| = {calcResult.magnitude().toFixed(4)}
                      <br />θ = {((calcResult.argument() * 180) / Math.PI).toFixed(2)}°
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-black/30 backdrop-blur-xl px-6 py-3">
        <div className="flex items-center justify-between text-xs text-white/50">
          <div>
            Complex arithmetic · Fractals · Domain coloring
          </div>
          <div className="text-cyan-400">
            {mode === "argand" && `${points.length} points plotted`}
            {(mode === "mandelbrot" || mode === "julia") && `${maxIterations} max iterations`}
            {mode === "domain" && `f(z) = ${domainFunction}`}
          </div>
        </div>
      </footer>
    </div>
  );
};
