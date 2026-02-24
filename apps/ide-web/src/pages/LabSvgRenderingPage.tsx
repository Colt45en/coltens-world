import { useState, useEffect, useRef } from "react";
import {
  SvgViewport,
  LineSegment,
  LineAttributes,
  LimbVector,
  LimbProfile,
  SvgLineRenderingEngine,
  FrameTimingConfig,
  SegmentKind,
} from "../math/SvgRenderingMath";
import styles from "./LabSvgRenderingPage.module.css";

type Mode = "static" | "limbs" | "synchronized" | "staggered" | "focal";

export default function LabSvgRenderingPage() {
  const [mode, setMode] = useState<Mode>("static");
  const [frameIndex, setFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Limb controls
  const [limbSpeed, setLimbSpeed] = useState(0.05);
  const [limbLength, setLimbLength] = useState(80);
  const [maxSwing, setMaxSwing] = useState(30); // degrees
  const [numLimbs, setNumLimbs] = useState(8);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  // Animation loop
  useEffect(() => {
    if (isPlaying) {
      const animate = () => {
        setFrameIndex((prev) => prev + 1);
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

  // Rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const viewport = new SvgViewport(800, 600);
    const engine = new SvgLineRenderingEngine(viewport);
    const frameConfig = new FrameTimingConfig(1 / 30, frameIndex, 0);

    if (mode === "static") {
      renderStatic(ctx, engine, viewport);
    } else if (mode === "limbs") {
      renderLimbs(ctx, engine, viewport, frameConfig);
    } else if (mode === "synchronized") {
      renderSynchronized(ctx, engine, viewport, frameConfig);
    } else if (mode === "staggered") {
      renderStaggered(ctx, engine, viewport, frameConfig);
    } else if (mode === "focal") {
      renderFocal(ctx, engine, viewport, frameConfig);
    }
  }, [mode, frameIndex, limbSpeed, limbLength, maxSwing, numLimbs]);

  const renderStatic = (
    ctx: CanvasRenderingContext2D,
    engine: SvgLineRenderingEngine,
    viewport: SvgViewport
  ) => {
    // Clear
    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, 800, 600);

    // Draw grid
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= 800; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 600);
      ctx.stroke();
    }
    for (let y = 0; y <= 600; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(800, y);
      ctx.stroke();
    }

    // Add example static lines (from spec)
    const lines = [
      { start: [0, 0], end: [150, 150], color: "#00f3ff" },
      { start: [100, 0], end: [700, 200], color: "#ffaa00" },
      { start: [700, 450], end: [200, 100], color: "#00ff66" },
      { start: [500, 0], end: [100, 400], color: "#ff6b6b" },
    ] as const;

    lines.forEach(({ start, end, color }) => {
      const segment = new LineSegment(
        start as [number, number],
        end as [number, number],
        new LineAttributes(color, 2)
      );

      // Draw line
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(start[0], 600 - start[1]);
      ctx.lineTo(end[0], 600 - end[1]);
      ctx.stroke();

      // Draw endpoints
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(start[0], 600 - start[1], 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(end[0], 600 - end[1], 4, 0, Math.PI * 2);
      ctx.fill();

      // Draw direction vector
      const [dx, dy] = segment.directionVector;
      const angle = segment.angle;
      const midX = (start[0] + end[0]) / 2;
      const midY = (start[1] + end[1]) / 2;

      ctx.font = "12px monospace";
      ctx.fillStyle = color;
      ctx.fillText(
        `L=${segment.length.toFixed(1)} θ=${((angle * 180) / Math.PI).toFixed(1)}°`,
        midX + 10,
        600 - midY
      );
    });
  };

  const renderLimbs = (
    ctx: CanvasRenderingContext2D,
    engine: SvgLineRenderingEngine,
    viewport: SvgViewport,
    frameConfig: FrameTimingConfig
  ) => {
    // Clear
    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, 800, 600);

    // Center anchor
    const anchorX = 400;
    const anchorY = 300;

    // Add single limb
    engine.addLimbVector(anchorX, anchorY, limbLength, limbSpeed);

    // Get snapshot
    const snapshot = engine.snapshotAtFrame(frameConfig);

    // Draw limb
    const limbLines = snapshot.lines.filter((l) => l.type === SegmentKind.LIMB);
    limbLines.forEach((line) => {
      ctx.strokeStyle = "#00f3ff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(line.x1, 600 - line.y1);
      ctx.lineTo(line.x2, 600 - line.y2);
      ctx.stroke();

      // Draw glow
      ctx.strokeStyle = "rgba(0, 243, 255, 0.3)";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(line.x1, 600 - line.y1);
      ctx.lineTo(line.x2, 600 - line.y2);
      ctx.stroke();

      // Draw anchor
      ctx.fillStyle = "#ffaa00";
      ctx.beginPath();
      ctx.arc(line.x1, 600 - line.y1, 6, 0, Math.PI * 2);
      ctx.fill();

      // Draw endpoint
      ctx.fillStyle = "#00f3ff";
      ctx.beginPath();
      ctx.arc(line.x2, 600 - line.y2, 5, 0, Math.PI * 2);
      ctx.fill();

      // Draw trajectory arc
      ctx.strokeStyle = "rgba(0, 243, 255, 0.2)";
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      const maxSwingRad = (maxSwing * Math.PI) / 180;
      ctx.arc(
        line.x1,
        600 - line.y1,
        limbLength,
        (-Math.PI / 2 - maxSwingRad),
        (-Math.PI / 2 + maxSwingRad)
      );
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // Info text
    ctx.fillStyle = "#888";
    ctx.font = "14px monospace";
    ctx.fillText(`Frame: ${frameIndex}`, 20, 30);
    ctx.fillText(`Time: ${snapshot.time.toFixed(3)}s`, 20, 50);
    ctx.fillText(`Length: ${limbLength}`, 20, 70);
    ctx.fillText(`Swing: ±${maxSwing}°`, 20, 90);
  };

  const renderSynchronized = (
    ctx: CanvasRenderingContext2D,
    engine: SvgLineRenderingEngine,
    viewport: SvgViewport,
    frameConfig: FrameTimingConfig
  ) => {
    // Clear
    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, 800, 600);

    // Center anchor
    const anchorX = 400;
    const anchorY = 300;

    // Add synchronized limbs (increasing length, same phase)
    const profile = new LimbProfile(
      (i) => 40 + i * 10, // Increasing length
      () => 0, // All synchronized
      numLimbs,
      anchorX,
      anchorY,
      limbSpeed,
      (maxSwing * Math.PI) / 180
    );

    engine.addLimbProfile(profile);

    // Get snapshot
    const snapshot = engine.snapshotAtFrame(frameConfig);

    // Draw limbs
    const limbLines = snapshot.lines.filter((l) => l.type === SegmentKind.LIMB);
    limbLines.forEach((line, i) => {
      const hue = (i / limbLines.length) * 360;
      const color = `hsl(${hue}, 80%, 60%)`;

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(line.x1, 600 - line.y1);
      ctx.lineTo(line.x2, 600 - line.y2);
      ctx.stroke();

      // Draw endpoint
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(line.x2, 600 - line.y2, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw anchor
    ctx.fillStyle = "#ffaa00";
    ctx.beginPath();
    ctx.arc(anchorX, 600 - anchorY, 8, 0, Math.PI * 2);
    ctx.fill();

    // Info
    ctx.fillStyle = "#888";
    ctx.font = "14px monospace";
    ctx.fillText(`Synchronized: ${numLimbs} limbs`, 20, 30);
    ctx.fillText(`All same phase, increasing length`, 20, 50);
  };

  const renderStaggered = (
    ctx: CanvasRenderingContext2D,
    engine: SvgLineRenderingEngine,
    viewport: SvgViewport,
    frameConfig: FrameTimingConfig
  ) => {
    // Clear
    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, 800, 600);

    // Center anchor
    const anchorX = 400;
    const anchorY = 300;

    // Add staggered limbs (same length, phase offset)
    const profile = new LimbProfile(
      () => limbLength, // All same length
      (i) => i * 0.5, // Staggered phase (0.5 frames per limb)
      numLimbs,
      anchorX,
      anchorY,
      limbSpeed,
      (maxSwing * Math.PI) / 180
    );

    engine.addLimbProfile(profile);

    // Get snapshot
    const snapshot = engine.snapshotAtFrame(frameConfig);

    // Draw limbs
    const limbLines = snapshot.lines.filter((l) => l.type === SegmentKind.LIMB);
    limbLines.forEach((line, i) => {
      const hue = (i / limbLines.length) * 360;
      const color = `hsl(${hue}, 80%, 60%)`;

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(line.x1, 600 - line.y1);
      ctx.lineTo(line.x2, 600 - line.y2);
      ctx.stroke();

      // Draw endpoint
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(line.x2, 600 - line.y2, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw anchor
    ctx.fillStyle = "#ffaa00";
    ctx.beginPath();
    ctx.arc(anchorX, 600 - anchorY, 8, 0, Math.PI * 2);
    ctx.fill();

    // Info
    ctx.fillStyle = "#888";
    ctx.font = "14px monospace";
    ctx.fillText(`Phase-staggered: ${numLimbs} limbs`, 20, 30);
    ctx.fillText(`Same length, cascading phase`, 20, 50);
  };

  const renderFocal = (
    ctx: CanvasRenderingContext2D,
    engine: SvgLineRenderingEngine,
    viewport: SvgViewport,
    frameConfig: FrameTimingConfig
  ) => {
    // Clear
    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, 800, 600);

    // Define nodes
    const nodes: [number, number][] = [
      [200, 200],
      [600, 200],
      [400, 450],
      [200, 450],
      [600, 450],
    ];

    engine.setReferenceNodes(nodes);

    // Center anchor
    const anchorX = 400;
    const anchorY = 300;

    // Add limbs
    const profile = new LimbProfile(
      (i) => 60 + i * 8,
      (i) => i * 0.3,
      numLimbs,
      anchorX,
      anchorY,
      limbSpeed,
      (maxSwing * Math.PI) / 180
    );

    engine.addLimbProfile(profile);

    // Get snapshot
    const snapshot = engine.snapshotAtFrame(frameConfig);

    // Draw nodes
    nodes.forEach((node, i) => {
      const attention = snapshot.focus.byNode[i];
      const isFocal = snapshot.focus.focalNode === i;

      // Node circle
      ctx.fillStyle = isFocal ? "#00ff66" : "#666";
      ctx.beginPath();
      ctx.arc(node[0], 600 - node[1], isFocal ? 12 : 8, 0, Math.PI * 2);
      ctx.fill();

      // Node label
      ctx.fillStyle = isFocal ? "#00ff66" : "#888";
      ctx.font = "12px monospace";
      ctx.fillText(`N${i}`, node[0] + 15, 600 - node[1] + 5);

      // Distance label
      if (attention) {
        ctx.fillText(
          `d=${attention.distance.toFixed(1)}`,
          node[0] + 15,
          600 - node[1] + 20
        );
      }
    });

    // Draw limbs
    const limbLines = snapshot.lines.filter((l) => l.type === SegmentKind.LIMB);
    limbLines.forEach((line) => {
      ctx.strokeStyle = "#00f3ff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(line.x1, 600 - line.y1);
      ctx.lineTo(line.x2, 600 - line.y2);
      ctx.stroke();
    });

    // Draw anchor
    ctx.fillStyle = "#ffaa00";
    ctx.beginPath();
    ctx.arc(anchorX, 600 - anchorY, 8, 0, Math.PI * 2);
    ctx.fill();

    // Info
    ctx.fillStyle = "#888";
    ctx.font = "14px monospace";
    ctx.fillText(`Focal attention system`, 20, 30);
    if (snapshot.focus.focalNode !== null) {
      ctx.fillStyle = "#00ff66";
      ctx.fillText(
        `Focus: Node ${snapshot.focus.focalNode} (${snapshot.focus.focalDistance.toFixed(1)})`,
        20,
        50
      );
    }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>
          📐 SVG Rendering Mathematics
        </h1>
        <p className={styles.subtitle}>
          Parametric lines, oscillating limbs & synchronized animations
        </p>
      </div>

      {/* Mode Tabs */}
      <div className={styles.modeTabs}>
        {[
          { id: "static" as Mode, label: "Static Lines" },
          { id: "limbs" as Mode, label: "Limb Oscillation" },
          { id: "synchronized" as Mode, label: "Synchronized" },
          { id: "staggered" as Mode, label: "Phase-Staggered" },
          { id: "focal" as Mode, label: "Focal Attention" },
        ].map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            className={`${styles.modeButton} ${mode === m.id ? styles.modeButtonActive : ""}`}
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
        <div className={styles.controlsPanel}>
          <h3 className={styles.controlsTitle}>Animation Controls</h3>

          <div className={styles.buttonGroup}>
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className={`${styles.playButton} ${isPlaying ? styles.playButtonPaused : ""}`}
            >
              {isPlaying ? "⏸ Pause" : "▶ Play"}
            </button>

            <button
              type="button"
              onClick={() => setFrameIndex(0)}
              className={styles.resetButton}
            >
              ⏮ Reset
            </button>
          </div>

          {mode !== "static" && (
            <>
              <div className={styles.controlGroup}>
                <label className={styles.label}>
                  Speed: {limbSpeed.toFixed(3)}
                </label>
                <input
                  type="range"
                  aria-label="Limb speed"
                  min="0.01"
                  max="0.2"
                  step="0.01"
                  value={limbSpeed}
                  onChange={(e) => setLimbSpeed(Number(e.target.value))}
                  className={styles.rangeInput}
                />
              </div>

              <div className={styles.controlGroup}>
                <label className={styles.label}>
                  Length: {limbLength}
                </label>
                <input
                  type="range"
                  aria-label="Limb length"
                  min="30"
                  max="150"
                  value={limbLength}
                  onChange={(e) => setLimbLength(Number(e.target.value))}
                  className={styles.rangeInput}
                />
              </div>

              <div className={styles.controlGroup}>
                <label className={styles.label}>
                  Max Swing: {maxSwing}°
                </label>
                <input
                  type="range"
                  aria-label="Maximum swing angle"
                  min="10"
                  max="90"
                  value={maxSwing}
                  onChange={(e) => setMaxSwing(Number(e.target.value))}
                  className={styles.rangeInput}
                />
              </div>

              {(mode === "synchronized" ||
                mode === "staggered" ||
                mode === "focal") && (
                <div className={styles.controlGroup}>
                  <label className={styles.label}>
                    Number of Limbs: {numLimbs}
                  </label>
                  <input
                    type="range"
                    aria-label="Number of limbs"
                    min="2"
                    max="16"
                    value={numLimbs}
                    onChange={(e) => setNumLimbs(Number(e.target.value))}
                    className={styles.rangeInput}
                  />
                </div>
              )}
            </>
          )}

          <div className={styles.principlesBox}>
            <h4 className={styles.principlesTitle}>
              Mathematical Principles
            </h4>
            {mode === "static" && (
              <div>
                <p>Parametric line segments:</p>
                <code>L(t) = (1-t)A + tB, t ∈ [0,1]</code>
                <p className={styles.principlesGap}>Direction vector:</p>
                <code>d = ⟨x₂-x₁, y₂-y₁⟩</code>
                <p className={styles.principlesGap}>Angle:</p>
                <code>θ = atan2(dy, dx)</code>
              </div>
            )}
            {mode === "limbs" && (
              <div>
                <p>Oscillating angle:</p>
                <code>θ(t) = sin(v·t)·Aₘₐₓ</code>
                <p className={styles.principlesGap}>Endpoint:</p>
                <code>E(t) = S + L·(cos θ(t), sin θ(t))</code>
                <p className={styles.principlesGap}>Angular velocity:</p>
                <code>dθ/dt = cos(v·t)·v·Aₘₐₓ</code>
              </div>
            )}
            {mode === "synchronized" && (
              <div>
                <p>Multi-limb synchronized:</p>
                <code>Lᵢ = 40 + i·10 (increasing)</code>
                <p className={styles.principlesGap}>Phase:</p>
                <code>φᵢ = 0 (all synchronized)</code>
              </div>
            )}
            {mode === "staggered" && (
              <div>
                <p>Phase-staggered cascade:</p>
                <code>φᵢ = 0.5·i frames</code>
                <p className={styles.principlesGap}>Creates wave effect</p>
              </div>
            )}
            {mode === "focal" && (
              <div>
                <p>Focal attention metric:</p>
                <code>dⱼ = minᵢ ||Eᵢ - Pⱼ||</code>
                <p className={styles.principlesGap}>Node with smallest dⱼ is focal</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        Mathematical coordinates (y-up) | Parametric equations | Harmonic
        oscillation
      </div>
    </div>
  );
}
