import React, { useRef, useState } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import JSZip from "jszip";

/**
 * SpinCaptureCodexButton
 *
 * Produces high-quality 360° spin captures with:
 * - Occlusion-aware outline extraction (SVG)
 * - PNG thumbnail with proper color pipeline
 * - JSON manifest with camera/controls snapshot
 * - Deterministic frame ordering for ffmpeg
 * - Transparent background support
 * - Pause-free capture cadence
 */

type CaptureUI = {
  edgeAngle: number;
  svgSize: number;
  pngSize: number;
  spinSpeed: number;
  stepDeg: number;
  transparency: boolean;
  preserveRig: boolean;
};

interface SpinCaptureCodexButtonProps {
  modelGroupRef: React.MutableRefObject<THREE.Group | null>;
  cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>;
  controlsRef: React.MutableRefObject<OrbitControls | null>;
  rendererRef: React.MutableRefObject<THREE.WebGLRenderer | null>;
  composerRef: React.MutableRefObject<EffectComposer | null>;
  modelName?: string;
}

// ==================== UTILITY FUNCTIONS ====================

function frameCameraTo(
  group: THREE.Object3D,
  camera: THREE.PerspectiveCamera,
  controls?: OrbitControls
) {
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  const sph = new THREE.Sphere();
  box.getBoundingSphere(sph);

  const dist =
    (sph.radius / Math.tan((camera.fov * Math.PI) / 360)) * 1.35;

  camera.position
    .copy(sph.center)
    .add(new THREE.Vector3(0.3, 0.4, 1).normalize().multiplyScalar(dist));

  camera.near = Math.max(0.01, dist / 100);
  camera.far = dist * 20;
  camera.lookAt(sph.center);
  camera.updateProjectionMatrix();

  if (controls) {
    controls.target.copy(sph.center);
    controls.update();
  }
}

function snapshotCamera(
  camera: THREE.PerspectiveCamera,
  controls?: OrbitControls
) {
  return {
    fov: camera.fov,
    aspect: camera.aspect,
    near: camera.near,
    far: camera.far,
    position: camera.position.toArray(),
    target: (controls?.target ?? new THREE.Vector3()).toArray(),
  };
}

function projectToNDC(v: THREE.Vector3, mvp: THREE.Matrix4) {
  const p = new THREE.Vector4(v.x, v.y, v.z, 1).applyMatrix4(mvp);
  const invW = 1.0 / Math.max(1e-8, p.w);
  return { x: p.x * invW, y: p.y * invW, zNDC: p.z * invW };
}

type Outline = {
  segments: Array<{ x1: number; y1: number; x2: number; y2: number }>;
};

function mergeCollinear(
  segments: Outline["segments"],
  angleThreshDeg = 1,
  joinEps = 0.001
): Outline["segments"] {
  const angleThresh = Math.cos(THREE.MathUtils.degToRad(angleThreshDeg));

  const used = new Array(segments.length).fill(false);
  const out: Outline["segments"] = [];

  function dir(s: any) {
    const dx = s.x2 - s.x1;
    const dy = s.y2 - s.y1;
    const len = Math.hypot(dx, dy) || 1e-6;
    return { x: dx / len, y: dy / len };
  }

  for (let i = 0; i < segments.length; i++) {
    if (used[i]) continue;

    let a = segments[i];
    used[i] = true;
    let changed = true;

    while (changed) {
      changed = false;

      for (let j = 0; j < segments.length; j++) {
        if (used[j]) continue;

        const b = segments[j];
        const d1 = dir(a);
        const d2 = dir(b);
        const aligned = Math.abs(d1.x * d2.x + d1.y * d2.y) > angleThresh;

        const near = (
          p1x: number,
          p1y: number,
          p2x: number,
          p2y: number
        ) => Math.hypot(p1x - p2x, p1y - p2y) < joinEps;

        // Try join a.tail → b.head
        if (aligned && near(a.x2, a.y2, b.x1, b.y1)) {
          a = { x1: a.x1, y1: a.y1, x2: b.x2, y2: b.y2 };
          used[j] = true;
          changed = true;
          continue;
        }

        // Try reversed join
        if (aligned && near(a.x2, a.y2, b.x2, b.y2)) {
          a = { x1: a.x1, y1: a.y1, x2: b.x1, y2: b.y1 };
          used[j] = true;
          changed = true;
          continue;
        }
      }
    }

    out.push(a);
  }

  return out;
}

async function computeFrontOutlineOccluded(
  mesh: THREE.Mesh,
  thresholdAngleRad: number,
  rasterSize = 1024
): Promise<Outline> {
  // Front ortho camera
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 10);
  cam.position.set(0, 0, 2);
  cam.lookAt(0, 0, 0);
  cam.updateProjectionMatrix();

  // Depth prepass
  const rt = new THREE.WebGLRenderTarget(rasterSize, rasterSize, {
    depthBuffer: true,
  });
  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    preserveDrawingBuffer: false,
  });
  renderer.setSize(rasterSize, rasterSize, false);

  const depthMat = new THREE.ShaderMaterial({
    vertexShader: `
      varying float vDepth;
      void main(){
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        vDepth = gl_Position.z / gl_Position.w;
      }`,
    fragmentShader: `
      varying float vDepth;
      void main(){
        float d = 0.5 * vDepth + 0.5;
        gl_FragColor = vec4(d, d, d, 1.0);
      }`,
    depthTest: true,
    depthWrite: true,
  });

  const sceneDepth = new THREE.Scene();
  const solid = new THREE.Mesh(mesh.geometry, depthMat);
  solid.matrixWorld.copy(mesh.matrixWorld);
  solid.matrixAutoUpdate = false;
  sceneDepth.add(solid);

  renderer.setRenderTarget(rt);
  renderer.render(sceneDepth, cam);

  // Read depth
  const pixels = new Uint8Array(rasterSize * rasterSize * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, rasterSize, rasterSize, pixels);

  function getDepth01(x: number, y: number) {
    const ix = Math.min(
      rasterSize - 1,
      Math.max(0, Math.floor(x))
    );
    const iy = Math.min(
      rasterSize - 1,
      Math.max(0, Math.floor(y))
    );
    const i = (iy * rasterSize + ix) * 4;
    return pixels[i] / 255;
  }

  // Build candidate segments
  const edges = new THREE.EdgesGeometry(
    mesh.geometry,
    THREE.MathUtils.radToDeg(thresholdAngleRad)
  );
  const pos = edges.getAttribute("position") as THREE.BufferAttribute;
  const mvp = new THREE.Matrix4()
    .multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)
    .multiply(mesh.matrixWorld);

  const kept: Outline["segments"] = [];
  const eps = 1e-3;

  for (let i = 0; i < pos.count; i += 2) {
    const A = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
    const B = new THREE.Vector3(
      pos.getX(i + 1),
      pos.getY(i + 1),
      pos.getZ(i + 1)
    );

    const a = projectToNDC(A, mvp);
    const b = projectToNDC(B, mvp);
    const mid = {
      x: 0.5 * (a.x + b.x),
      y: 0.5 * (a.y + b.y),
      zNDC: 0.5 * (a.zNDC + b.zNDC),
    };

    const px = (mid.x * 0.5 + 0.5) * rasterSize;
    const py = (1 - (mid.y * 0.5 + 0.5)) * rasterSize;
    const depth01 = 0.5 * mid.zNDC + 0.5;

    if (depth01 <= getDepth01(px, py) + eps) {
      kept.push({
        x1: a.x * 0.5 + 0.5,
        y1: 1 - (a.y * 0.5 + 0.5),
        x2: b.x * 0.5 + 0.5,
        y2: 1 - (b.y * 0.5 + 0.5),
      });
    }
  }

  edges.dispose();
  rt.dispose();
  renderer.dispose();

  return { segments: mergeCollinear(kept, 0.5, 1e-3) };
}

function outlineToSVG(
  out: Outline,
  W: number,
  H: number,
  stroke = "black",
  strokeWidth = 1
): string {
  const lines = out.segments
    .map(
      (s) =>
        `<line x1="${(s.x1 * W).toFixed(2)}" y1="${(s.y1 * H).toFixed(
          2
        )}" x2="${(s.x2 * W).toFixed(2)}" y2="${(s.y2 * H).toFixed(2)}"/>`
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <g stroke="${stroke}" stroke-width="${strokeWidth}" fill="none" vector-effect="non-scaling-stroke">${lines}</g>
</svg>`;
}

function collectMergedGeometry(root: THREE.Object3D): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = [];
  root.updateMatrixWorld(true);

  root.traverse((o: any) => {
    if (o?.isMesh && o.geometry) {
      const g = o.geometry.clone();
      g.applyMatrix4(o.matrixWorld); // Keep transforms
      geos.push(g);
    }
  });

  const positions: number[] = [];
  const indices: number[] = [];
  let offset = 0;

  for (const gg of geos) {
    const p = gg.getAttribute("position") as THREE.BufferAttribute;
    const idxArray =
      ((gg.index?.array as any) as number[]) ??
      Array.from({ length: p.count }, (_, k) => k);

    for (let k = 0; k < p.count; k++) {
      positions.push(p.getX(k), p.getY(k), p.getZ(k));
    }

    for (let k = 0; k < idxArray.length; k++) {
      indices.push(offset + idxArray[k]);
    }

    offset += p.count;
    gg.dispose();
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(new Float32Array(positions), 3)
  );
  g.setIndex(indices);
  g.computeVertexNormals();

  return g;
}

function wrapAndNormalize(
  root: THREE.Object3D,
  targetSize = 2
): THREE.Group {
  const container = new THREE.Group();
  container.name = "ModelContainer";
  container.add(root);

  const box = new THREE.Box3().setFromObject(root);
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();

  box.getCenter(center);
  box.getSize(size);

  const scale = targetSize / Math.max(size.x, size.y, size.z, 1e-6);
  root.position.sub(center);
  container.scale.setScalar(scale);

  return container;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        blob ? resolve(blob) : reject(new Error("toBlob failed"));
      },
      "image/png"
    );
  });
}

async function nextFrame(): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => r()));
}

// ==================== REACT COMPONENT ====================

export const SpinCaptureCodexButton: React.FC<SpinCaptureCodexButtonProps> =
  ({
    modelGroupRef,
    cameraRef,
    controlsRef,
    rendererRef,
    composerRef,
    modelName = "model",
  }) => {
    const [ui, setUi] = useState<CaptureUI>({
      edgeAngle: 35,
      svgSize: 512,
      pngSize: 768,
      spinSpeed: 60, // deg/sec
      stepDeg: 2,
      transparency: false,
      preserveRig: false,
    });

    const [isCapturing, setIsCapturing] = useState(false);
    const [progress, setProgress] = useState(0);
    const capturingRef = useRef(false);

    const updateUi = (key: keyof CaptureUI, value: any) => {
      setUi((prev) => ({ ...prev, [key]: value }));
    };

    const captureSpinSequence = async () => {
      if (
        !modelGroupRef.current ||
        !cameraRef.current ||
        !rendererRef.current ||
        !composerRef.current
      ) {
        console.error("Missing refs");
        return;
      }

      setIsCapturing(true);
      capturingRef.current = true;

      try {
        const renderer = rendererRef.current;
        const composer = composerRef.current;
        const zip = new JSZip();

        // Save current state
        const prevSize = new THREE.Vector2();
        renderer.getSize(prevSize);
        const prevPR = renderer.getPixelRatio();
        const prevAlpha = renderer.getClearAlpha();

        const total = Math.max(1, Math.round(360 / Math.max(1, ui.stepDeg)));
        const pad = Math.max(3, String(total - 1).length);

        const startY = modelGroupRef.current.rotation.y;
        const stepRad = THREE.MathUtils.degToRad(ui.stepDeg);

        // Configure for capture
        renderer.setPixelRatio(1);
        renderer.setSize(ui.pngSize, ui.pngSize, false);
        composer.setSize(ui.pngSize, ui.pngSize);
        composer.setPixelRatio(1);

        if (ui.transparency) {
          renderer.setClearAlpha(0);
        }

        const logInterval = Math.ceil(total / 20);

        for (let i = 0; i < total; i++) {
          modelGroupRef.current.rotation.y = startY + stepRad * i;

          // Double render to settle post-fx
          composer.render();
          await nextFrame();
          composer.render();

          const blob = await canvasToBlob(renderer.domElement);
          zip.file(
            `frames/${modelName}_frame_${String(i).padStart(pad, "0")}.png`,
            blob
          );

          if (i % logInterval === 0 || i === total - 1) {
            setProgress(Math.round((i / total) * 100));
            console.log(
              `🎬 Captured frame ${i + 1}/${total} (${Math.round(
                ((i + 1) / total) * 100
              )}%)`
            );
          }
        }

        // Save single thumbnail at frame 0
        modelGroupRef.current.rotation.y = startY;
        composer.render();
        await nextFrame();
        composer.render();

        const thumbBlob = await canvasToBlob(renderer.domElement);
        zip.file(`${modelName}.png`, thumbBlob);

        // Capture outline
        console.log("📐 Computing occlusion-aware outline...");
        const mesh = new THREE.Mesh(
          new THREE.BufferGeometry(),
          new THREE.MeshBasicMaterial()
        );
        mesh.geometry = collectMergedGeometry(modelGroupRef.current);

        const outline = await computeFrontOutlineOccluded(
          mesh,
          THREE.MathUtils.degToRad(ui.edgeAngle),
          ui.svgSize
        );
        mesh.geometry.dispose();

        // SVG
        const svg = outlineToSVG(outline, ui.svgSize, ui.svgSize);
        zip.file(`${modelName}_outline.svg`, svg);

        // Manifest
        const manifest = {
          codex: "artifact_bundle_codex",
          createdAt: new Date().toISOString(),
          item: {
            name: modelName,
            files: [
              `${modelName}.png`,
              `${modelName}_outline.svg`,
              `frames/${modelName}_frame_*.png`,
            ],
            params: {
              edgeAngle: ui.edgeAngle,
              svgSize: ui.svgSize,
              pngSize: ui.pngSize,
              spinSpeed: ui.spinSpeed,
              stepDeg: ui.stepDeg,
              transparency: ui.transparency,
              preserveRig: ui.preserveRig,
            },
            stats: {
              totalFrames: total,
              segments: outline.segments.length,
              camera: snapshotCamera(
                cameraRef.current,
                controlsRef.current || undefined
              ),
            },
          },
        };

        zip.file(`${modelName}.manifest.json`, JSON.stringify(manifest, null, 2));

        // Restore state
        renderer.setPixelRatio(prevPR);
        renderer.setSize(prevSize.x, prevSize.y, false);
        composer.setSize(prevSize.x, prevSize.y);
        composer.setPixelRatio(
          Math.min(2, (window as any).devicePixelRatio || 1)
        );
        renderer.setClearAlpha(prevAlpha);

        // Optional: reset composer to release render targets
        composerRef.current?.reset?.();

        // Export
        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${modelName}-spin-${Date.now()}.zip`;
        a.click();
        URL.revokeObjectURL(url);

        console.log("✅ Capture complete");
        setProgress(100);
      } catch (e) {
        console.error("Capture failed:", e);
        alert(`Capture failed: ${e}`);
      } finally {
        capturingRef.current = false;
        setIsCapturing(false);
        setProgress(0);
      }
    };

    return (
      <div className="space-y-3 p-3 border border-slate-300 rounded bg-slate-50">
        <div className="font-semibold text-sm">🎬 Spin Capture (Codex)</div>

        {/* Parameters */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          {/* Edge Angle */}
          <div>
            <label className="block opacity-70 mb-1">Edge Angle (°)</label>
            <input
              type="range"
              min={5}
              max={60}
              value={ui.edgeAngle}
              onChange={(e) => updateUi("edgeAngle", Number(e.target.value))}
              className="w-full"
            />
            <div className="text-center opacity-60">{ui.edgeAngle}°</div>
          </div>

          {/* SVG Size */}
          <div>
            <label className="block opacity-70 mb-1">SVG px</label>
            <input
              type="range"
              min={256}
              max={1024}
              step={64}
              value={ui.svgSize}
              onChange={(e) => updateUi("svgSize", Number(e.target.value))}
              className="w-full"
            />
            <div className="text-center opacity-60">{ui.svgSize}px</div>
          </div>

          {/* PNG Size */}
          <div>
            <label className="block opacity-70 mb-1">PNG px</label>
            <input
              type="range"
              min={256}
              max={2048}
              step={64}
              value={ui.pngSize}
              onChange={(e) => updateUi("pngSize", Number(e.target.value))}
              className="w-full"
            />
            <div className="text-center opacity-60">{ui.pngSize}px</div>
          </div>

          {/* Spin Speed */}
          <div>
            <label className="block opacity-70 mb-1">Speed (°/sec)</label>
            <input
              type="range"
              min={10}
              max={180}
              step={10}
              value={ui.spinSpeed}
              onChange={(e) => updateUi("spinSpeed", Number(e.target.value))}
              className="w-full"
            />
            <div className="text-center opacity-60">{ui.spinSpeed}°/s</div>
          </div>

          {/* Step */}
          <div>
            <label className="block opacity-70 mb-1">Step (°)</label>
            <input
              type="range"
              min={1}
              max={10}
              value={ui.stepDeg}
              onChange={(e) => updateUi("stepDeg", Number(e.target.value))}
              className="w-full"
            />
            <div className="text-center opacity-60">{ui.stepDeg}° → {Math.round(360 / ui.stepDeg)} frames</div>
          </div>

          {/* Transparency */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={ui.transparency}
              onChange={(e) => updateUi("transparency", e.target.checked)}
              className="w-4 h-4"
            />
            <label className="opacity-70">Transparent BG</label>
          </div>

          {/* Preserve Rig */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={ui.preserveRig}
              onChange={(e) => updateUi("preserveRig", e.target.checked)}
              className="w-4 h-4"
            />
            <label className="opacity-70">Preserve Rig/Materials</label>
          </div>
        </div>

        {/* Progress */}
        {isCapturing && (
          <div>
            <div className="text-xs mb-1">{progress}%</div>
            <div className="w-full bg-slate-200 rounded h-2 overflow-hidden">
              <div
                className="bg-blue-500 h-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Button */}
        <button
          onClick={captureSpinSequence}
          disabled={isCapturing}
          className="w-full py-2 px-3 bg-blue-600 text-white text-sm font-semibold rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isCapturing ? `Capturing... ${progress}%` : "📹 Capture & Export"}
        </button>
      </div>
    );
  };

export default SpinCaptureCodexButton;
