import { useState, useEffect, useRef } from "react";
import { Matrix3, Matrix4 } from "../math/Matrix";
import styles from "./LabMatrixPlaygroundPage.module.css";

type Mode2D = "transforms" | "composition" | "calculator";
type Mode3D = "rotation" | "projection" | "camera";

export default function LabMatrixPlaygroundPage() {
  const [dimension, setDimension] = useState<"2D" | "3D">("2D");
  const [mode2D, setMode2D] = useState<Mode2D>("transforms");
  const [mode3D, setMode3D] = useState<Mode3D>("rotation");

  // 2D Transform controls
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [scaleX, setScaleX] = useState(1);
  const [scaleY, setScaleY] = useState(1);

  // 3D Rotation controls
  const [rotationX, setRotationX] = useState(0);
  const [rotationY, setRotationY] = useState(0);
  const [rotationZ, setRotationZ] = useState(0);

  // 3D Projection controls
  const [fov, setFov] = useState(60);
  const [near, setNear] = useState(0.1);
  const [far, setFar] = useState(100);

  // Calculator state
  const [calcMatrix1, setCalcMatrix1] = useState<number[]>(Array.from(new Matrix3().elements));
  const [calcMatrix2, setCalcMatrix2] = useState<number[]>(Array.from(new Matrix3().elements));
  const [calcResult, setCalcResult] = useState<number[]>(Array.from(new Matrix3().elements));
  const [calcOperation, setCalcOperation] = useState<"multiply" | "add" | "invert">("multiply");

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Render 2D transforms
  useEffect(() => {
    if (dimension !== "2D" || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (mode2D === "transforms") {
      renderTransforms2D(ctx);
    } else if (mode2D === "composition") {
      renderComposition2D(ctx);
    }
  }, [dimension, mode2D, translateX, translateY, rotation, scaleX, scaleY]);

  // Render 3D scenes
  useEffect(() => {
    if (dimension !== "3D" || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (mode3D === "rotation") {
      renderRotation3D(ctx);
    } else if (mode3D === "projection") {
      renderProjection3D(ctx);
    } else if (mode3D === "camera") {
      renderCamera3D(ctx);
    }
  }, [dimension, mode3D, rotationX, rotationY, rotationZ, fov, near, far]);

  const renderTransforms2D = (ctx: CanvasRenderingContext2D) => {
    const canvas = ctx.canvas;
    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= canvas.width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw axes
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    ctx.strokeStyle = "rgba(0, 243, 255, 0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, canvas.height);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255, 170, 0, 0.4)";
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(canvas.width, centerY);
    ctx.stroke();

    // Original shape (unit square)
    const originalPoints: [number, number][] = [
      [-50, -50],
      [50, -50],
      [50, 50],
      [-50, 50],
    ];

    drawShape(ctx, originalPoints, centerX, centerY, "rgba(128, 128, 128, 0.5)");

    // Create transformation matrix
    const matrix = new Matrix3();
    matrix.makeTranslation(translateX, translateY);
    const rotationMatrix = new Matrix3().makeRotation((rotation * Math.PI) / 180);
    const scaleMatrix = new Matrix3().makeScale(scaleX, scaleY);

    // Apply: Scale → Rotate → Translate
    matrix.multiply(rotationMatrix).multiply(scaleMatrix);

    // Transform points
    const transformedPoints = originalPoints.map((p) => matrix.transformPoint(p));

    drawShape(ctx, transformedPoints, centerX, centerY, "#00f3ff");

    // Draw transformation axes
    const xAxis = matrix.transformPoint([60, 0]);
    const yAxis = matrix.transformPoint([0, 60]);

    ctx.strokeStyle = "#00f3ff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(centerX + translateX, centerY - translateY);
    ctx.lineTo(centerX + xAxis[0], centerY - xAxis[1]);
    ctx.stroke();

    ctx.strokeStyle = "#ffaa00";
    ctx.beginPath();
    ctx.moveTo(centerX + translateX, centerY - translateY);
    ctx.lineTo(centerX + yAxis[0], centerY - yAxis[1]);
    ctx.stroke();
  };

  const renderComposition2D = (ctx: CanvasRenderingContext2D) => {
    const canvas = ctx.canvas;
    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Original shape
    const shape: [number, number][] = [
      [-40, -40],
      [40, -40],
      [40, 40],
      [-40, 40],
    ];

    // Step 1: Scale
    const m1 = new Matrix3().makeScale(scaleX, scaleY);
    const step1 = shape.map((p) => m1.transformPoint(p));
    drawShape(ctx, step1, centerX - 200, centerY, "rgba(255, 170, 0, 0.6)");
    ctx.fillStyle = "#ffaa00";
    ctx.font = "14px monospace";
    ctx.fillText("1. Scale", centerX - 220, centerY - 80);

    // Step 2: Rotate
    const m2 = new Matrix3().makeRotation((rotation * Math.PI) / 180).multiply(m1);
    const step2 = shape.map((p) => m2.transformPoint(p));
    drawShape(ctx, step2, centerX, centerY, "rgba(0, 243, 255, 0.6)");
    ctx.fillStyle = "#00f3ff";
    ctx.fillText("2. Rotate", centerX - 20, centerY - 80);

    // Step 3: Translate
    const m3 = new Matrix3().makeTranslation(translateX, translateY).multiply(m2);
    const step3 = shape.map((p) => m3.transformPoint(p));
    drawShape(ctx, step3, centerX + 200, centerY, "rgba(0, 255, 102, 0.8)");
    ctx.fillStyle = "#00ff66";
    ctx.fillText("3. Translate", centerX + 180, centerY - 80);
  };

  const renderRotation3D = (ctx: CanvasRenderingContext2D) => {
    const canvas = ctx.canvas;
    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Define cube vertices
    const cubeVertices: [number, number, number][] = [
      [-50, -50, -50],
      [50, -50, -50],
      [50, 50, -50],
      [-50, 50, -50],
      [-50, -50, 50],
      [50, -50, 50],
      [50, 50, 50],
      [-50, 50, 50],
    ];

    // Create rotation matrices
    const mx = new Matrix4().makeRotationX((rotationX * Math.PI) / 180);
    const my = new Matrix4().makeRotationY((rotationY * Math.PI) / 180);
    const mz = new Matrix4().makeRotationZ((rotationZ * Math.PI) / 180);

    // Combined rotation
    const rotation = new Matrix4().copy(mx).multiply(my).multiply(mz);

    // Transform vertices
    const transformed = cubeVertices.map((v) => rotation.transformPoint(v));

    // Simple perspective projection
    const project = (p: [number, number, number]): [number, number] => {
      const distance = 400;
      const scale = distance / (distance + p[2]);
      return [p[0] * scale + centerX, p[1] * scale + centerY];
    };

    const projected = transformed.map(project);

    // Draw cube edges
    const edges: [number, number][] = [
      [0, 1], [1, 2], [2, 3], [3, 0], // Back face
      [4, 5], [5, 6], [6, 7], [7, 4], // Front face
      [0, 4], [1, 5], [2, 6], [3, 7], // Connecting edges
    ];

    ctx.strokeStyle = "#00f3ff";
    ctx.lineWidth = 2;
    edges.forEach(([i, j]) => {
      const p1 = projected[i];
      const p2 = projected[j];
      if (p1 && p2) {
        ctx.beginPath();
        ctx.moveTo(p1[0], p1[1]);
        ctx.lineTo(p2[0], p2[1]);
        ctx.stroke();
      }
    });

    // Draw vertices
    ctx.fillStyle = "#ffaa00";
    projected.forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
  };

  const renderProjection3D = (ctx: CanvasRenderingContext2D) => {
    const canvas = ctx.canvas;
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Create perspective matrix
    const aspect = canvas.width / canvas.height;
    const perspectiveMatrix = new Matrix4().makePerspectiveFOV(fov, aspect, near, far);

    // Create view frustum lines
    const frustumPoints: [number, number, number][] = [
      [-1, -1, near],
      [1, -1, near],
      [1, 1, near],
      [-1, 1, near],
      [-2, -2, far * 0.1],
      [2, -2, far * 0.1],
      [2, 2, far * 0.1],
      [-2, 2, far * 0.1],
    ];

    // Simple orthographic projection for visualization
    const project = (p: [number, number, number]): [number, number] => {
      return [p[0] * 80 + centerX, -p[2] * 20 + centerY];
    };

    const projected = frustumPoints.map(project);

    // Draw frustum
    ctx.strokeStyle = "rgba(0, 243, 255, 0.5)";
    ctx.lineWidth = 2;

    // Near plane
    for (let i = 0; i < 4; i++) {
      const p1 = projected[i];
      const p2 = projected[(i + 1) % 4];
      if (p1 && p2) {
        ctx.beginPath();
        ctx.moveTo(p1[0], p1[1]);
        ctx.lineTo(p2[0], p2[1]);
        ctx.stroke();
      }
    }

    // Far plane
    for (let i = 4; i < 8; i++) {
      const p1 = projected[i];
      const p2 = projected[((i + 1) % 4) + 4];
      if (p1 && p2) {
        ctx.beginPath();
        ctx.moveTo(p1[0], p1[1]);
        ctx.lineTo(p2[0], p2[1]);
        ctx.stroke();
      }
    }

    // Connecting lines
    for (let i = 0; i < 4; i++) {
      const p1 = projected[i];
      const p2 = projected[i + 4];
      if (p1 && p2) {
        ctx.beginPath();
        ctx.moveTo(p1[0], p1[1]);
        ctx.lineTo(p2[0], p2[1]);
        ctx.stroke();
      }
    }

    // Labels
    ctx.fillStyle = "#00f3ff";
    ctx.font = "14px monospace";
    ctx.fillText(`FOV: ${fov}°`, 20, 30);
    ctx.fillText(`Near: ${near}`, 20, 50);
    ctx.fillText(`Far: ${far}`, 20, 70);
  };

  const renderCamera3D = (ctx: CanvasRenderingContext2D) => {
    const canvas = ctx.canvas;
    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1;

    // Draw camera frame
    ctx.beginPath();
    ctx.arc(centerX, centerY, 150, 0, Math.PI * 2);
    ctx.stroke();

    // Camera vectors
    const forward: [number, number, number] = [0, 0, -1];
    const up: [number, number, number] = [0, 1, 0];
    const right: [number, number, number] = [1, 0, 0];

    const rx = new Matrix4().makeRotationX((rotationX * Math.PI) / 180);
    const ry = new Matrix4().makeRotationY((rotationY * Math.PI) / 180);
    const rz = new Matrix4().makeRotationZ((rotationZ * Math.PI) / 180);

    const rotation = new Matrix4().copy(rx).multiply(ry).multiply(rz);

    const forwardTransformed = rotation.transformPoint(forward);
    const upTransformed = rotation.transformPoint(up);
    const rightTransformed = rotation.transformPoint(right);

    // Project to 2D
    const scale = 100;
    const project = (v: [number, number, number]): [number, number] => {
      return [v[0] * scale + centerX, -v[1] * scale + centerY];
    };

    const fProj = project(forwardTransformed);
    const uProj = project(upTransformed);
    const rProj = project(rightTransformed);

    // Draw vectors
    ctx.lineWidth = 3;

    // Forward (blue)
    ctx.strokeStyle = "#00f3ff";
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(fProj[0], fProj[1]);
    ctx.stroke();

    // Up (orange)
    ctx.strokeStyle = "#ffaa00";
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(uProj[0], uProj[1]);
    ctx.stroke();

    // Right (green)
    ctx.strokeStyle = "#00ff66";
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(rProj[0], rProj[1]);
    ctx.stroke();

    // Labels
    ctx.font = "14px monospace";
    ctx.fillStyle = "#00f3ff";
    ctx.fillText("Forward", fProj[0] + 10, fProj[1]);
    ctx.fillStyle = "#ffaa00";
    ctx.fillText("Up", uProj[0] + 10, uProj[1]);
    ctx.fillStyle = "#00ff66";
    ctx.fillText("Right", rProj[0] + 10, rProj[1]);
  };

  const drawShape = (
    ctx: CanvasRenderingContext2D,
    points: [number, number][],
    offsetX: number,
    offsetY: number,
    color: string
  ) => {
    if (points.length === 0) return;

    const firstPoint = points[0];
    if (!firstPoint) return;

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(offsetX + firstPoint[0], offsetY - firstPoint[1]);

    for (let i = 1; i < points.length; i++) {
      const point = points[i];
      if (point) {
        ctx.lineTo(offsetX + point[0], offsetY - point[1]);
      }
    }

    ctx.closePath();
    ctx.stroke();

    // Fill with transparency
    ctx.fillStyle = color.replace(")", ", 0.2)").replace("rgb", "rgba");
    ctx.fill();
  };

  const performMatrixCalculation = () => {
    const m1 = new Matrix3().fromArray(calcMatrix1);
    const m2 = new Matrix3().fromArray(calcMatrix2);
    let result: Matrix3;

    if (calcOperation === "multiply") {
      result = m1.clone().multiply(m2);
    } else if (calcOperation === "add") {
      result = m1.clone();
      for (let i = 0; i < 9; i++) {
        const elem1 = result.elements[i];
        const elem2 = m2.elements[i];
        if (elem1 !== undefined && elem2 !== undefined) {
          result.elements[i] = elem1 + elem2;
        }
      }
    } else {
      result = m1.clone().invert();
    }

    setCalcResult(Array.from(result.elements));
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>🔢 Matrix Playground</h1>
        <p className={styles.subtitle}>
          Linear algebra visualization - transforms, compositions, projections
        </p>
      </div>

      {/* Mode Tabs */}
      <div className={styles.modeTabs}>
        <button
          type="button"
          onClick={() => setDimension("2D")}
          className={`${styles.modeButton} ${dimension === "2D" ? styles.modeButtonActive : ""}`}
        >
          2D Transforms
        </button>
        <button
          type="button"
          onClick={() => setDimension("3D")}
          className={`${styles.modeButton} ${dimension === "3D" ? styles.modeButtonActive : ""}`}
        >
          3D Transforms
        </button>
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

        {/* Controls Sidebar */}
        <div className={styles.sidebar}>
          {dimension === "2D" ? (
            <>
              <h3 className={styles.modeHeading}>2D Mode</h3>
              <div className={styles.modeButtonGroup}>
                <button
                  type="button"
                  onClick={() => setMode2D("transforms")}
                  className={`${styles.subModeButton} ${mode2D === "transforms" ? styles.subModeButtonActive : ""}`}
                >
                  Interactive Transform
                </button>
                <button
                  type="button"
                  onClick={() => setMode2D("composition")}
                  className={`${styles.subModeButton} ${mode2D === "composition" ? styles.subModeButtonActive : ""}`}
                >
                  Matrix Composition
                </button>
                <button
                  type="button"
                  onClick={() => setMode2D("calculator")}
                  className={`${styles.subModeButton} ${mode2D === "calculator" ? styles.subModeButtonActive : ""}`}
                >
                  Matrix Calculator
                </button>
              </div>

              {mode2D !== "calculator" && (
                <>
                  <div className={styles.controlGroup}>
                    <label className={styles.label}>
                      Translate X: {translateX.toFixed(0)}
                    </label>
                    <input
                      type="range"
                      min="-200"
                      max="200"
                      value={translateX}
                      onChange={(e) => setTranslateX(Number(e.target.value))}
                      title="Translate X"
                      className={styles.slider}
                    />
                  </div>

                  <div className={styles.controlGroup}>
                    <label className={styles.label}>
                      Translate Y: {translateY.toFixed(0)}
                    </label>
                    <input
                      type="range"
                      min="-200"
                      max="200"
                      value={translateY}
                      onChange={(e) => setTranslateY(Number(e.target.value))}
                      title="Translate Y"
                      className={styles.slider}
                    />
                  </div>

                  <div className={styles.controlGroup}>
                    <label className={styles.label}>
                      Rotation: {rotation.toFixed(0)}°
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      value={rotation}
                      onChange={(e) => setRotation(Number(e.target.value))}
                      title="Rotation"
                      className={styles.slider}
                    />
                  </div>

                  <div className={styles.controlGroup}>
                    <label className={styles.label}>
                      Scale X: {scaleX.toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min="0.1"
                      max="3"
                      step="0.1"
                      value={scaleX}
                      onChange={(e) => setScaleX(Number(e.target.value))}
                      title="Scale X"
                      className={styles.slider}
                    />
                  </div>

                  <div className={styles.controlGroup}>
                    <label className={styles.label}>
                      Scale Y: {scaleY.toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min="0.1"
                      max="3"
                      step="0.1"
                      value={scaleY}
                      onChange={(e) => setScaleY(Number(e.target.value))}
                      title="Scale Y"
                      className={styles.slider}
                    />
                  </div>
                </>
              )}

              {mode2D === "calculator" && (
                <div>
                  <h4 className={styles.calculatorTitle}>Matrix Calculator</h4>
                  <p className={styles.calculatorSubtitle}>Enter 3×3 matrices (column-major)</p>

                  <div className={styles.controlGroup}>
                    <label className={styles.label}>Matrix 1</label>
                    <div className={styles.matrixGrid}>
                      {calcMatrix1.map((val, i) => (
                        <input
                          key={i}
                          type="number"
                          value={val.toFixed(2)}
                          onChange={(e) => {
                            const newMatrix = [...calcMatrix1];
                            newMatrix[i] = Number(e.target.value);
                            setCalcMatrix1(newMatrix);
                          }}
                          title={`Matrix 1 element ${i}`}
                          className={styles.matrixInput}
                        />
                      ))}
                    </div>
                  </div>

                  <div className={styles.controlGroup}>
                    <label className={styles.label}>Operation</label>
                    <select
                      value={calcOperation}
                      onChange={(e) => setCalcOperation(e.target.value as any)}
                      title="Matrix operation"
                      className={styles.select}
                    >
                      <option value="multiply">Multiply (M1 · M2)</option>
                      <option value="add">Add (M1 + M2)</option>
                      <option value="invert">Invert (M1⁻¹)</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={performMatrixCalculation}
                    className={styles.calculateButton}
                  >
                    Calculate
                  </button>

                  <div>
                    <label className={styles.label}>Result</label>
                    <div className={styles.matrixGrid}>
                      {calcResult.map((val, i) => (
                        <div
                          key={i}
                          className={styles.resultCell}
                        >
                          {val.toFixed(3)}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <h3 className={styles.modeHeading}>3D Mode</h3>
              <div className={styles.modeButtonGroup}>
                <button
                  type="button"
                  onClick={() => setMode3D("rotation")}
                  className={`${styles.subModeButton} ${mode3D === "rotation" ? styles.subModeButtonActive : ""}`}
                >
                  3D Rotation
                </button>
                <button
                  type="button"
                  onClick={() => setMode3D("projection")}
                  className={`${styles.subModeButton} ${mode3D === "projection" ? styles.subModeButtonActive : ""}`}
                >
                  Perspective Projection
                </button>
                <button
                  type="button"
                  onClick={() => setMode3D("camera")}
                  className={`${styles.subModeButton} ${mode3D === "camera" ? styles.subModeButtonActive : ""}`}
                >
                  Camera Orientation
                </button>
              </div>

              {mode3D === "rotation" && (
                <>
                  <div className={styles.controlGroup}>
                    <label className={styles.label}>
                      Rotation X: {rotationX.toFixed(0)}°
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      value={rotationX}
                      onChange={(e) => setRotationX(Number(e.target.value))}
                      title="Rotation X"
                      className={styles.slider}
                    />
                  </div>

                  <div className={styles.controlGroup}>
                    <label className={styles.label}>
                      Rotation Y: {rotationY.toFixed(0)}°
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      value={rotationY}
                      onChange={(e) => setRotationY(Number(e.target.value))}
                      title="Rotation Y"
                      className={styles.slider}
                    />
                  </div>

                  <div className={styles.controlGroup}>
                    <label className={styles.label}>
                      Rotation Z: {rotationZ.toFixed(0)}°
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      value={rotationZ}
                      onChange={(e) => setRotationZ(Number(e.target.value))}
                      title="Rotation Z"
                      className={styles.slider}
                    />
                  </div>
                </>
              )}

              {mode3D === "projection" && (
                <>
                  <div className={styles.controlGroup}>
                    <label className={styles.label}>
                      Field of View: {fov.toFixed(0)}°
                    </label>
                    <input
                      type="range"
                      min="30"
                      max="120"
                      value={fov}
                      onChange={(e) => setFov(Number(e.target.value))}
                      title="Field of View"
                      className={styles.slider}
                    />
                  </div>

                  <div className={styles.controlGroup}>
                    <label className={styles.label}>
                      Near Plane: {near.toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min="0.01"
                      max="5"
                      step="0.01"
                      value={near}
                      onChange={(e) => setNear(Number(e.target.value))}
                      title="Near Plane"
                      className={styles.slider}
                    />
                  </div>

                  <div className={styles.controlGroup}>
                    <label className={styles.label}>
                      Far Plane: {far.toFixed(0)}
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="500"
                      value={far}
                      onChange={(e) => setFar(Number(e.target.value))}
                      title="Far Plane"
                      className={styles.slider}
                    />
                  </div>
                </>
              )}

              {mode3D === "camera" && (
                <>
                  <div className={styles.controlGroup}>
                    <label className={styles.label}>
                      Pitch (X): {rotationX.toFixed(0)}°
                    </label>
                    <input
                      type="range"
                      min="-90"
                      max="90"
                      value={rotationX}
                      onChange={(e) => setRotationX(Number(e.target.value))}
                      title="Pitch (X)"
                      className={styles.slider}
                    />
                  </div>

                  <div className={styles.controlGroup}>
                    <label className={styles.label}>
                      Yaw (Y): {rotationY.toFixed(0)}°
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      value={rotationY}
                      onChange={(e) => setRotationY(Number(e.target.value))}
                      title="Yaw (Y)"
                      className={styles.slider}
                    />
                  </div>

                  <div className={styles.controlGroup}>
                    <label className={styles.label}>
                      Roll (Z): {rotationZ.toFixed(0)}°
                    </label>
                    <input
                      type="range"
                      min="-180"
                      max="180"
                      value={rotationZ}
                      onChange={(e) => setRotationZ(Number(e.target.value))}
                      title="Roll (Z)"
                      className={styles.slider}
                    />
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        Column-major storage | Column-vector multiplication | Right-to-left composition
      </div>
    </div>
  );
}
