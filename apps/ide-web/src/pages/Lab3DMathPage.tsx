import { useState, useEffect, useRef } from "react";
import { Vector3 } from "../math/Vector3";
import { Limb3D } from "../math/Limb3D";
import { Noise3D } from "../math/Noise3D";
import { GraphAlgorithms } from "../math/GraphAlgorithms";
import styles from "./Lab3DMathPage.module.css";

type Mode =
  | "vectors"
  | "tentacle"
  | "organism"
  | "noise"
  | "graph"
  | "pathfinding";

export default function Lab3DMathPage() {
  const [mode, setMode] = useState<Mode>("tentacle");
  const [time, setTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  // Tentacle controls
  const [segmentCount, setSegmentCount] = useState(12);
  const [segmentLength, setSegmentLength] = useState(15);
  const [oscillationSpeed, setOscillationSpeed] = useState(1.0);

  // Organism controls
  const [tentacleCount, setTentacleCount] = useState(6);
  const [volatility, setVolatility] = useState(0.5);
  const [morphFactor, setMorphFactor] = useState(0.5);

  // Noise controls
  const [noiseScale, setNoiseScale] = useState(0.05);
  const [noiseOctaves, setNoiseOctaves] = useState(4);

  // Graph controls
  const [nodeCount, setNodeCount] = useState(30);
  const [graphScale, setGraphScale] = useState(150);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  // Animation loop
  useEffect(() => {
    if (isPlaying) {
      const animate = () => {
        setTime((prev) => prev + 0.016);
        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
    } else {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    }

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying]);

  // 3D to 2D projection (simple orthographic)
  const project = (v: Vector3, centerX: number, centerY: number, scale = 1): [number, number] => {
    return [centerX + v.x * scale, centerY - v.z * scale];
  };

  // Rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear
    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, 800, 600);

    const centerX = 400;
    const centerY = 300;

    if (mode === "vectors") {
      renderVectors(ctx, centerX, centerY);
    } else if (mode === "tentacle") {
      renderTentacle(ctx, centerX, centerY);
    } else if (mode === "organism") {
      renderOrganism(ctx, centerX, centerY);
    } else if (mode === "noise") {
      renderNoise(ctx);
    } else if (mode === "graph") {
      renderGraph(ctx, centerX, centerY);
    } else if (mode === "pathfinding") {
      renderPathfinding(ctx, centerX, centerY);
    }
  }, [
    mode,
    time,
    segmentCount,
    segmentLength,
    oscillationSpeed,
    tentacleCount,
    volatility,
    morphFactor,
    noiseScale,
    noiseOctaves,
    nodeCount,
    graphScale,
  ]);

  const renderVectors = (ctx: CanvasRenderingContext2D, cx: number, cy: number) => {
    const scale = 50;

    // Origin
    ctx.fillStyle = "#ffaa00";
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();

    // Basis vectors
    const vectors = [
      { v: Vector3.right, color: "#ff6b6b", label: "right (+X)" },
      { v: Vector3.up, color: "#00ff66", label: "up (+Y)" },
      { v: Vector3.forward, color: "#00f3ff", label: "forward (+Z)" },
    ];

    vectors.forEach(({ v, color, label }) => {
      const [x, y] = project(v.multiply(scale), cx, cy);

      // Arrow
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(x, y);
      ctx.stroke();

      // Endpoint
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();

      // Label
      ctx.font = "14px monospace";
      ctx.fillText(label, x + 10, y);
    });

    // Animated vector
    const angle = time * oscillationSpeed;
    const animVec = Vector3.fromSpherical(2, angle, Math.sin(angle * 0.5) * 0.5);
    const [ax, ay] = project(animVec.multiply(scale), cx, cy);

    ctx.strokeStyle = "#ff00ff";
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(ax, ay);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#ff00ff";
    ctx.beginPath();
    ctx.arc(ax, ay, 5, 0, Math.PI * 2);
    ctx.fill();

    // Info
    ctx.fillStyle = "#888";
    ctx.font = "14px monospace";
    ctx.fillText(`Magnitude: ${animVec.magnitude().toFixed(2)}`, 20, 30);
    ctx.fillText(`Yaw: ${animVec.toSpherical().yaw.toFixed(2)}`, 20, 50);
    ctx.fillText(`Pitch: ${animVec.toSpherical().pitch.toFixed(2)}`, 20, 70);
  };

  const renderTentacle = (ctx: CanvasRenderingContext2D, cx: number, cy: number) => {
    const anchor = new Vector3(0, 0, 0);
    const chain = Limb3D.createChain(segmentCount, segmentLength, anchor);

    // Apply oscillation
    chain.forEach((limb, i) => {
      limb.oscillate(time * oscillationSpeed, i * 0.5);
    });

    // Update chain
    Limb3D.updateChain(chain);

    // Draw limbs
    chain.forEach((limb, i) => {
      const hue = (i / segmentCount) * 280;
      const color = `hsl(${hue}, 80%, 60%)`;

      const [sx, sy] = project(limb.start, cx, cy, 2);
      const [ex, ey] = project(limb.end, cx, cy, 2);

      // Limb line
      ctx.strokeStyle = color;
      ctx.lineWidth = 3 - (i / segmentCount) * 2;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      // Joint
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(ex, ey, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw anchor
    ctx.fillStyle = "#ffaa00";
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fill();
  };

  const renderOrganism = (ctx: CanvasRenderingContext2D, cx: number, cy: number) => {
    const center = new Vector3(0, 0, 0);
    const noise = new Noise3D(42);

    // Create tentacles radiating from center
    const tentacles: Limb3D[][] = [];
    const angleStep = (Math.PI * 2) / tentacleCount;

    for (let i = 0; i < tentacleCount; i++) {
      const angle = i * angleStep;
      const offset = new Vector3(Math.cos(angle) * 20, 0, Math.sin(angle) * 20);
      const chain = Limb3D.createChain(8, segmentLength * 0.8, center.add(offset));

      chain.forEach((limb, j) => {
        const phaseOffset = i * 0.5 + j * 0.3;
        limb.oscillate(time * oscillationSpeed, phaseOffset);
      });

      Limb3D.updateChain(chain);
      tentacles.push(chain);
    }

    // Draw core (pulsing with noise)
    const pulse = 1 + noise.simplex3(time * 0.5, 0, 0) * volatility * 0.3;
    const coreRadius = 20 * pulse;

    ctx.fillStyle = "rgba(255, 170, 0, 0.3)";
    ctx.beginPath();
    ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#ffaa00";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw tentacles
    tentacles.forEach((chain, i) => {
      const hue = (i / tentacleCount) * 360;

      chain.forEach((limb, j) => {
        const color = `hsl(${hue}, 80%, ${60 - j * 3}%)`;
        const [sx, sy] = project(limb.start, cx, cy, 2);
        const [ex, ey] = project(limb.end, cx, cy, 2);

        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5 - (j / chain.length) * 1.5;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      });
    });
  };

  const renderNoise = (ctx: CanvasRenderingContext2D) => {
    const noise = new Noise3D(42);
    const imageData = ctx.createImageData(800, 600);
    const data = imageData.data;

    for (let y = 0; y < 600; y++) {
      for (let x = 0; x < 800; x++) {
        const index = (y * 800 + x) * 4;

        // Sample noise
        const nx = x * noiseScale;
        const ny = y * noiseScale;
        const nz = time * 0.1;

        const value = noise.fbm(nx, ny, nz, noiseOctaves);
        const color = Math.floor((value * 0.5 + 0.5) * 255);

        data[index] = color; // R
        data[index + 1] = color * 0.8; // G
        data[index + 2] = color * 1.2; // B
        data[index + 3] = 255; // A
      }
    }

    ctx.putImageData(imageData, 0, 0);

    // Info overlay
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(10, 10, 200, 80);
    ctx.fillStyle = "#00ff66";
    ctx.font = "14px monospace";
    ctx.fillText(`Scale: ${noiseScale.toFixed(3)}`, 20, 30);
    ctx.fillText(`Octaves: ${noiseOctaves}`, 20, 50);
    ctx.fillText(`Time: ${time.toFixed(2)}s`, 20, 70);
  };

  const renderGraph = (ctx: CanvasRenderingContext2D, cx: number, cy: number) => {
    const graph = new GraphAlgorithms();
    graph.generateFibonacciSpiral(nodeCount, graphScale, "XZ");

    // Draw edges
    ctx.strokeStyle = "rgba(0, 243, 255, 0.2)";
    ctx.lineWidth = 1;

    for (const node of graph.nodes) {
      const [x1, y1] = project(node.position, cx, cy, 1);

      for (const conn of node.connections) {
        const [x2, y2] = project(conn.position, cx, cy, 1);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }

    // Draw nodes
    for (const node of graph.nodes) {
      const [x, y] = project(node.position, cx, cy, 1);

      ctx.fillStyle = "#00f3ff";
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Stats
    const stats = graph.getStats();
    ctx.fillStyle = "#888";
    ctx.font = "14px monospace";
    ctx.fillText(`Nodes: ${stats.nodeCount}`, 20, 30);
    ctx.fillText(`Edges: ${stats.edgeCount}`, 20, 50);
    ctx.fillText(`Avg connections: ${stats.avgConnections.toFixed(1)}`, 20, 70);
  };

  const renderPathfinding = (ctx: CanvasRenderingContext2D, cx: number, cy: number) => {
    const graph = new GraphAlgorithms();
    graph.generateFibonacciSpiral(nodeCount, graphScale, "XZ");

    // Pick start and end nodes
    const startId = 0;
    const endId = Math.floor(nodeCount * 0.8);

    // Find path
    const path = graph.findShortestPath(startId, endId);

    // Draw all edges (faded)
    ctx.strokeStyle = "rgba(100, 100, 100, 0.1)";
    ctx.lineWidth = 1;

    for (const node of graph.nodes) {
      const [x1, y1] = project(node.position, cx, cy, 1);

      for (const conn of node.connections) {
        const [x2, y2] = project(conn.position, cx, cy, 1);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }

    // Draw all nodes
    for (const node of graph.nodes) {
      const [x, y] = project(node.position, cx, cy, 1);

      ctx.fillStyle = "#444";
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw path
    if (path.length > 1) {
      ctx.strokeStyle = "#00ff66";
      ctx.lineWidth = 3;
      ctx.beginPath();

      const firstPos = path[0];
      if (firstPos) {
        const [startX, startY] = project(firstPos, cx, cy, 1);
        ctx.moveTo(startX, startY);

        for (let i = 1; i < path.length; i++) {
          const pos = path[i];
          if (pos) {
            const [x, y] = project(pos, cx, cy, 1);
            ctx.lineTo(x, y);
          }
        }

        ctx.stroke();
      }

      // Highlight path nodes
      for (const pos of path) {
        const [x, y] = project(pos, cx, cy, 1);

        ctx.fillStyle = "#00ff66";
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Highlight start/end
    const startNode = graph.nodes[startId];
    const endNode = graph.nodes[endId];

    if (startNode && endNode) {
      const [sx, sy] = project(startNode.position, cx, cy, 1);
      const [ex, ey] = project(endNode.position, cx, cy, 1);

      ctx.fillStyle = "#ffaa00";
      ctx.beginPath();
      ctx.arc(sx, sy, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ff6b6b";
      ctx.beginPath();
      ctx.arc(ex, ey, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Info
    ctx.fillStyle = "#888";
    ctx.font = "14px monospace";
    ctx.fillText(`Path length: ${path.length} nodes`, 20, 30);
    if (path.length > 1) {
      let totalDist = 0;
      for (let i = 0; i < path.length - 1; i++) {
        const curr = path[i];
        const next = path[i + 1];
        if (curr && next) {
          totalDist += curr.distanceTo(next);
        }
      }
      ctx.fillText(`Total distance: ${totalDist.toFixed(1)}`, 20, 50);
    }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>
          🌌 3D Mathematics Engine
        </h1>
        <p className={styles.subtitle}>
          Vector3, articulated limbs, procedural noise & graph algorithms
        </p>
      </div>

      {/* Mode Tabs */}
      <div className={styles.tabs}>
        {[
          { id: "vectors" as Mode, label: "Vector3" },
          { id: "tentacle" as Mode, label: "Tentacle" },
          { id: "organism" as Mode, label: "Organism" },
          { id: "noise" as Mode, label: "Noise Field" },
          { id: "graph" as Mode, label: "Fibonacci Graph" },
          { id: "pathfinding" as Mode, label: "Pathfinding" },
        ].map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`${styles.tabButton} ${
              mode === m.id ? styles.tabButtonActive : styles.tabButtonInactive
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className={styles.mainContent}>
        {/* Canvas */}
        <div className={styles.canvasContainer}>
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            className={styles.canvas}
          />
        </div>

        {/* Controls */}
        <div className={styles.controls}>
          <h3 className={styles.controlsTitle}>Animation Controls</h3>

          <div className={styles.controlGroup}>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`${styles.playButton} ${
                isPlaying
                  ? styles.playButtonActive
                  : styles.playButtonInactive
              }`}
            >
              {isPlaying ? "⏸ Pause" : "▶ Play"}
            </button>

            <button
              onClick={() => setTime(0)}
              className={styles.resetButton}
            >
              ⏮ Reset
            </button>
          </div>

          {(mode === "tentacle" || mode === "organism") && (
            <>
              <div className={styles.controlItem}>
                <label
                  className={styles.label}
                >
                  Oscillation Speed: {oscillationSpeed.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="3"
                  step="0.1"
                  value={oscillationSpeed}
                  onChange={(e) => setOscillationSpeed(Number(e.target.value))}
                  className={styles.input}
                  aria-label="Oscillation Speed"
                />
              </div>

              {mode === "tentacle" && (
                <>
                  <div className={styles.controlItem}>
                    <label
                      className={styles.label}
                    >
                      Segment Count: {segmentCount}
                    </label>
                    <input
                      type="range"
                      min="3"
                      max="20"
                      value={segmentCount}
                      onChange={(e) => setSegmentCount(Number(e.target.value))}
                      className={styles.input}
                      aria-label="Segment Count"
                    />
                  </div>

                  <div className={styles.controlItem}>
                    <label
                      className={styles.label}
                    >
                      Segment Length: {segmentLength}
                    </label>
                    <input
                      type="range"
                      min="5"
                      max="30"
                      value={segmentLength}
                      onChange={(e) => setSegmentLength(Number(e.target.value))}
                      className={styles.input}
                      aria-label="Segment Length"
                    />
                  </div>
                </>
              )}

              {mode === "organism" && (
                <>
                  <div className={styles.controlItem}>
                    <label
                      className={styles.label}
                    >
                      Tentacle Count: {tentacleCount}
                    </label>
                    <input
                      type="range"
                      min="3"
                      max="12"
                      value={tentacleCount}
                      onChange={(e) => setTentacleCount(Number(e.target.value))}
                      className={styles.input}
                      aria-label="Tentacle Count"
                    />
                  </div>

                  <div className={styles.controlItem}>
                    <label
                      className={styles.label}
                    >
                      Volatility: {volatility.toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={volatility}
                      onChange={(e) => setVolatility(Number(e.target.value))}
                      className={styles.input}
                      aria-label="Volatility"
                    />
                  </div>
                </>
              )}
            </>
          )}

          {mode === "noise" && (
            <>
              <div className={styles.controlItem}>
                <label
                  className={styles.label}
                >
                  Scale: {noiseScale.toFixed(3)}
                </label>
                <input
                  type="range"
                  min="0.005"
                  max="0.1"
                  step="0.005"
                  value={noiseScale}
                  onChange={(e) => setNoiseScale(Number(e.target.value))}
                  className={styles.input}
                  aria-label="Noise Scale"
                />
              </div>

              <div className={styles.controlItem}>
                <label
                  className={styles.label}
                >
                  Octaves: {noiseOctaves}
                </label>
                <input
                  type="range"
                  min="1"
                  max="8"
                  value={noiseOctaves}
                  onChange={(e) => setNoiseOctaves(Number(e.target.value))}
                  className={styles.input}
                  aria-label="Noise Octaves"
                />
              </div>
            </>
          )}

          {(mode === "graph" || mode === "pathfinding") && (
            <>
              <div className={styles.controlItem}>
                <label
                  className={styles.label}
                >
                  Node Count: {nodeCount}
                </label>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={nodeCount}
                  onChange={(e) => setNodeCount(Number(e.target.value))}
                  className={styles.input}
                  aria-label="Node Count"
                />
              </div>

              <div className={styles.controlItem}>
                <label
                  className={styles.label}
                >
                  Graph Scale: {graphScale}
                </label>
                <input
                  type="range"
                  min="50"
                  max="250"
                  value={graphScale}
                  onChange={(e) => setGraphScale(Number(e.target.value))}
                  className={styles.input}
                  aria-label="Graph Scale"
                />
              </div>
            </>
          )}

          <div className={styles.mathBox}>
            <h4 className={styles.mathBoxTitle}>
              Mathematics
            </h4>

            {mode === "vectors" && (
              <div>
                <p>Spherical coordinates:</p>
                <code>
                  x = r·cos(θ)·cos(φ)
                  <br />
                  y = r·sin(φ)
                  <br />z = r·cos(θ)·sin(φ)
                </code>
              </div>
            )}

            {mode === "tentacle" && (
              <div>
                <p>Oscillating angles:</p>
                <code>
                  θ_yaw = sin(t + offset)·0.5
                  <br />
                  θ_pitch = cos(1.3t + offset)·0.5
                </code>
                <p className={styles.mathBoxParagraph}>Forward kinematics chain</p>
              </div>
            )}

            {mode === "organism" && (
              <div>
                <p>Multi-tentacle radial distribution</p>
                <p className={styles.mathBoxParagraph}>Noise-based core pulsing</p>
                <p className={styles.mathBoxParagraph}>Phase-staggered oscillation</p>
              </div>
            )}

            {mode === "noise" && (
              <div>
                <p>3D Simplex noise (Perlin)</p>
                <p className={styles.mathBoxParagraph}>Fractal Brownian Motion:</p>
                <code>fbm = Σ(noise(f·p)·a)</code>
                <p className={styles.mathBoxParagraph}>Layered octaves for detail</p>
              </div>
            )}

            {mode === "graph" && (
              <div>
                <p>Fibonacci spiral:</p>
                <code>
                  r = scale·√i
                  <br />θ = i·137.5°
                </code>
                <p className={styles.mathBoxParagraph}>Golden angle distribution</p>
              </div>
            )}

            {mode === "pathfinding" && (
              <div>
                <p>Dijkstra's algorithm</p>
                <p className={styles.mathBoxParagraph}>
                  Finds shortest path through graph
                </p>
                <p className={styles.mathBoxParagraph}>O((V+E) log V) complexity</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        Vector3 class | Limb3D kinematics | Simplex noise | Graph algorithms
      </div>
    </div>
  );
}
