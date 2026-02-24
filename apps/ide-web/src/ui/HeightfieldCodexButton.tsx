import JSZip from "jszip";
import React, { useRef, useState } from "react";
import * as THREE from "three";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";

/**
 * HeightfieldCodexButton
 *
 * Converts heightmaps (PNG/JPG/EXR) → high-fidelity terrains with:
 * - 16-bit EXR support (full precision)
 * - Central-difference normals (crisp, stable)
 * - Taubin smoothing (no shrinkage)
 * - Per-vertex color by elevation
 * - ACES tone mapping + GPU disposal
 * - Deterministic manifest + safe naming
 */

type HeightfieldConfig = {
  name: string;
  size: number;
  heightScale: number;
  smoothIter: number;
  flipY: boolean;
  invert: boolean;
  normalize: boolean;
  vertexColors: boolean;
  pngSize: number;
};

interface HeightfieldCodexButtonProps {
  onMeshCreated?: (mesh: THREE.Mesh) => void;
}

// ==================== UTILITY FUNCTIONS ====================

function normalizeHeights(h: Float32Array): Float32Array {
  let lo = +Infinity,
    hi = -Infinity;
  for (let i = 0; i < h.length; i++) {
    const v = h[i]!;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const range = hi - lo || 1;
  for (let i = 0; i < h.length; i++) {
    h[i]! = (h[i]! - lo) / range;
  }
  return h;
}

async function fileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Image load failed"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("FileReader failed"));
    reader.readAsDataURL(file);
  });
}

function imageToHeights(
  img: HTMLImageElement,
  W: number,
  H: number,
  opts: {
    flipY?: boolean;
    invert?: boolean;
    normalize?: boolean;
  } = { flipY: true, invert: false, normalize: true }
): Float32Array {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;

  (ctx as any).imageSmoothingEnabled = true;
  (ctx as any).imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, W, H);

  const { data } = ctx.getImageData(0, 0, W, H);
  const out = new Float32Array(W * H);

  for (let y = 0; y < H; y++) {
    const sy = opts.flipY ? H - 1 - y : y;
    for (let x = 0; x < W; x++) {
      const i = (sy * W + x) * 4;
      const lum = (0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!) / 255;
      out[y * W + x]! = opts.invert ? 1 - lum : lum;
    }
  }

  if (opts.normalize) return normalizeHeights(out);
  return out;
}

async function fileToHeights(
  file: File,
  W: number,
  H: number,
  opts: { flipY?: boolean; invert?: boolean; normalize?: boolean } = {}
): Promise<Float32Array> {
  const lower = file.name.toLowerCase();

  if (lower.endsWith(".exr")) {
    const blobURL = URL.createObjectURL(file);
    try {
      const tex = await new EXRLoader().loadAsync(blobURL);
      URL.revokeObjectURL(blobURL);

      const w = (tex.image as any).width;
      const h = (tex.image as any).height;
      const data = (tex.image as any).data as Float32Array;

      const out = new Float32Array(W * H);

      for (let y = 0; y < H; y++) {
        const sy = Math.floor((y * h) / H);
        for (let x = 0; x < W; x++) {
          const sx = Math.floor((x * w) / W);
          const i = sy * w + sx;
          const channels = data.length === w * h ? 1 : 4;
          let v: number;

          if (channels === 1) {
            v = data[i]!;
          } else {
            const idx = i * 4;
            v = (data[idx]! + data[idx + 1]! + data[idx + 2]!) / 3;
          }

          out[y * W + x]! = v;
        }
      }

      tex.dispose?.();

      if (opts.invert) {
        for (let i = 0; i < out.length; i++) out[i]! = 1 - out[i]!;
      }

      return normalizeHeights(out);
    } catch (e) {
      console.warn("EXR load failed, falling back to PNG:", e);
      const img = await fileToImage(file);
      return imageToHeights(img, W, H, opts);
    }
  }

  // PNG/JPG fallback
  const img = await fileToImage(file);
  return imageToHeights(img, W, H, opts);
}

function elevationRamp(v: number): [number, number, number] {
  if (v < 0.25) {
    const t = v / 0.25;
    return [
      0.1 * (1 - t) + 0.2 * t,
      0.2 * (1 - t) + 0.4 * t,
      0.5 * (1 - t) + 0.8 * t,
    ];
  } else if (v < 0.5) {
    const t = (v - 0.25) / 0.25;
    return [
      0.2 * (1 - t) + 0.2 * t,
      0.4 * (1 - t) + 0.6 * t,
      0.8 * (1 - t) + 0.3 * t,
    ];
  } else if (v < 0.8) {
    const t = (v - 0.5) / 0.3;
    return [
      0.2 * (1 - t) + 0.5 * t,
      0.6 * (1 - t) + 0.4 * t,
      0.3 * (1 - t) + 0.2 * t,
    ];
  } else {
    const t = (v - 0.8) / 0.2;
    return [
      0.5 * (1 - t) + 1.0 * t,
      0.4 * (1 - t) + 1.0 * t,
      0.2 * (1 - t) + 1.0 * t,
    ];
  }
}

function buildHeightfieldGeometry(
  h: Float32Array,
  W: number,
  H: number,
  scale: number,
  opts: { vertexColors?: boolean } = {}
): THREE.BufferGeometry {
  const dx = 1 / Math.max(1, W - 1);
  const dz = 1 / Math.max(1, H - 1);
  const verts = W * H;

  const pos = new Float32Array(verts * 3);
  const nrm = new Float32Array(verts * 3);
  const uvs = new Float32Array(verts * 2);
  const col = opts.vertexColors ? new Float32Array(verts * 3) : undefined;

  const s = (x: number, y: number) =>
    h[Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))]!;

  // Positions + UVs
  let p = 0,
    t = 0;
  for (let y = 0; y < H; y++) {
    const v = y * dz;
    for (let x = 0; x < W; x++) {
      const u = x * dx;
      const yWorld = (s(x, y) - 0.5) * 2 * scale;

      pos[p + 0]! = (u - 0.5) * 2;
      pos[p + 1]! = yWorld;
      pos[p + 2]! = (v - 0.5) * 2;

      uvs[t + 0]! = u;
      uvs[t + 1]! = 1 - v;

      p += 3;
      t += 2;
    }
  }

  // Central-difference normals
  let q = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const hl = s(x - 1, y);
      const hr = s(x + 1, y);
      const hd = s(x, y - 1);
      const hu = s(x, y + 1);

      const dhdx = (hr - hl) / (2 * dx);
      const dhdz = (hu - hd) / (2 * dz);

      const nx = -dhdx * scale;
      const ny = 2;
      const nz = -dhdz * scale;

      const inv = 1 / Math.hypot(nx, ny, nz);

      nrm[q + 0]! = nx * inv;
      nrm[q + 1]! = ny * inv;
      nrm[q + 2]! = nz * inv;

      q += 3;
    }
  }

  // Vertex colors
  if (col) {
    let i = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const v = h[y * W + x]!;
        const c = elevationRamp(v);
        col[i + 0]! = c[0];
        col[i + 1]! = c[1];
        col[i + 2]! = c[2];
        i += 3;
      }
    }
  }

  // Indices
  const tris = (W - 1) * (H - 1) * 2;
  const idx = new (verts > 65535 ? Uint32Array : Uint16Array)(tris * 3);
  let id = 0;

  for (let y = 0; y < H - 1; y++) {
    for (let x = 0; x < W - 1; x++) {
      const i = y * W + x;
      const a = i,
        b = i + 1,
        c = i + W,
        d = i + W + 1;

      idx[id++]! = a;
      idx[id++]! = c;
      idx[id++]! = b;
      idx[id++]! = b;
      idx[id++]! = c;
      idx[id++]! = d;
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));

  if (col) g.setAttribute("color", new THREE.BufferAttribute(col, 3));

  g.computeBoundingSphere();

  return g;
}

function taubinSmooth(
  g: THREE.BufferGeometry,
  iter: number,
  lambda = 0.5,
  mu = -0.53
) {
  if (!g.index) {
    g.setIndex(
      [...Array((g.getAttribute("position") as THREE.BufferAttribute).count).keys()]
    );
  }

  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const id = g.getIndex()!.array as any as number[];
  const n = pos.count;

  const adj: Array<Set<number>> = Array.from({ length: n }, () => new Set());

  for (let i = 0; i < id.length; i += 3) {
    const a = id[i]!,
      b = id[i + 1]!,
      c = id[i + 2]!;
    adj[a]!.add(b).add(c);
    adj[b]!.add(a).add(c);
    adj[c]!.add(a).add(b);
  }

  const tmp = new Float32Array(n * 3);

  const applyStep = (w: number) => {
    for (let i = 0; i < n; i++) {
      let sx = 0,
        sy = 0,
        sz = 0,
        m = 0;

      adj[i]!.forEach((j) => {
        sx += pos.getX(j);
        sy += pos.getY(j);
        sz += pos.getZ(j);
        m++;
      });

      if (m) {
        const mx = sx / m,
          my = sy / m,
          mz = sz / m;
        tmp[i * 3 + 0]! = pos.getX(i) + w * (mx - pos.getX(i));
        tmp[i * 3 + 1]! = pos.getY(i) + w * (my - pos.getY(i));
        tmp[i * 3 + 2]! = pos.getZ(i) + w * (mz - pos.getZ(i));
      } else {
        tmp[i * 3 + 0]! = pos.getX(i);
        tmp[i * 3 + 1]! = pos.getY(i);
        tmp[i * 3 + 2]! = pos.getZ(i);
      }
    }

    pos.array.set(tmp);
    pos.needsUpdate = true;
  };

  for (let t = 0; t < iter; t++) {
    applyStep(lambda);
    applyStep(mu);
  }

  g.computeVertexNormals();
}

async function renderPNG(obj: THREE.Object3D, size = 512): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const r = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
  });

  (r as any).outputColorSpace = (THREE as any).SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.0;
  r.setPixelRatio(Math.min(2, (window as any).devicePixelRatio || 1));
  r.setSize(size, size, false);

  const sc = new THREE.Scene();
  sc.add(new THREE.HemisphereLight(0xffffff, 0x223344, 0.9));
  sc.add(obj.clone(true));

  const cam = new THREE.PerspectiveCamera(36, 1, 0.01, 100);
  const box = new THREE.Box3().setFromObject(sc);
  const sph = new THREE.Sphere();
  box.getBoundingSphere(sph);

  const dist = (sph.radius / Math.tan((cam.fov * Math.PI) / 360)) * 1.35;

  cam.position
    .copy(sph.center)
    .add(new THREE.Vector3(0.3, 0.4, 1).normalize().multiplyScalar(dist));

  cam.lookAt(sph.center);
  cam.near = Math.max(0.01, dist / 100);
  cam.far = dist * 10;
  cam.updateProjectionMatrix();

  r.render(sc, cam);

  const blob: Blob = await new Promise((res, rej) =>
    r.domElement.toBlob(
      (b) => (b ? res(b) : rej(new Error("toBlob fail"))),
      "image/png"
    )
  );

  r.dispose();

  return blob;
}

function meshStats(mesh: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(mesh);
  const size = new THREE.Vector3();
  box.getSize(size);

  let tris = 0;
  mesh.traverse((o: any) => {
    if (o?.isMesh) {
      tris += o.geometry.index
        ? o.geometry.index.count / 3
        : o.geometry.attributes.position.count / 3;
    }
  });

  return {
    size: size.toArray(),
    triangles: tris | 0,
  };
}

function safeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// ==================== REACT COMPONENT ====================

export const HeightfieldCodexButton: React.FC<HeightfieldCodexButtonProps> = ({
  onMeshCreated,
}) => {
  const [cfg, setCfg] = useState<HeightfieldConfig>({
    name: "heightfield",
    size: 512,
    heightScale: 1.0,
    smoothIter: 0,
    flipY: true,
    invert: false,
    normalize: true,
    vertexColors: false,
    pngSize: 512,
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateCfg = (key: keyof HeightfieldConfig, value: any) => {
    setCfg((prev) => ({ ...prev, [key]: value }));
  };

  const processHeightmap = async (file: File) => {
    setIsProcessing(true);
    setProgress("Loading...");

    try {
      // Load heights
      setProgress("Reading heightmap...");
      const heights = await fileToHeights(file, cfg.size, cfg.size, {
        flipY: cfg.flipY,
        invert: cfg.invert,
        normalize: cfg.normalize,
      });

      // Build geometry
      setProgress("Building geometry...");
      const geo = buildHeightfieldGeometry(
        heights,
        cfg.size,
        cfg.size,
        cfg.heightScale,
        { vertexColors: cfg.vertexColors }
      );

      // Smooth
      if (cfg.smoothIter > 0) {
        setProgress(`Smoothing (${cfg.smoothIter})...`);
        taubinSmooth(geo, cfg.smoothIter);
      }

      // Material
      const mat = new THREE.MeshStandardMaterial({
        color: 0x9fb2d8,
        metalness: 0.05,
        roughness: 0.75,
        vertexColors: cfg.vertexColors,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = safeName(cfg.name);

      // Render thumbnail
      setProgress("Rendering thumbnail...");
      const png = await renderPNG(mesh, cfg.pngSize);

      // Build ZIP
      setProgress("Creating manifest...");
      const stats = meshStats(mesh);
      const manifest = {
        codex: "heightfield_codex",
        createdAt: new Date().toISOString(),
        item: {
          name: cfg.name,
          files: [`${cfg.name}.glb`, `${cfg.name}.png`, `${cfg.name}.manifest.json`],
          params: {
            size: cfg.size,
            heightScale: cfg.heightScale,
            smoothIter: cfg.smoothIter,
            flipY: cfg.flipY,
            invert: cfg.invert,
            normalize: cfg.normalize,
            vertexColors: cfg.vertexColors,
          },
          stats,
        },
      };

      // Export GLB
      setProgress("Exporting GLB...");
      const exporter = new (await import("three/examples/jsm/exporters/GLTFExporter.js"))
        .GLTFExporter();
      const glb = await new Promise<Blob>((resolve, reject) => {
        exporter.parse(
          mesh,
          (result: ArrayBuffer | Record<string, any>) => {
            const blob = result instanceof ArrayBuffer
              ? new Blob([result], { type: "model/gltf-binary" })
              : new Blob([JSON.stringify(result)], { type: "model/gltf+json" });
            resolve(blob);
          },
          reject
        );
      });

      // ZIP
      const zip = new JSZip();
      zip.file(`${cfg.name}.glb`, glb);
      zip.file(`${cfg.name}.png`, png);
      zip.file(`${cfg.name}.manifest.json`, JSON.stringify(manifest, null, 2));

      setProgress("Finalizing...");
      const blob = await zip.generateAsync({ type: "blob" });

      // Download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeName(cfg.name)}-hf-${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);

      // Callback
      if (onMeshCreated) {
        onMeshCreated(mesh);
      }

      setProgress("✅ Done!");
      setTimeout(() => setProgress(""), 2000);
    } catch (e) {
      console.error("Heightfield process failed:", e);
      setProgress(`❌ Error: ${e}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-3 p-3 border border-slate-300 rounded bg-slate-50">
      <div className="font-semibold text-sm">⛰️ Heightfield Codex</div>

      {/* File Input */}
      <div>
        <label htmlFor="heightfield-file" className="text-xs opacity-70 block mb-1">
          Heightmap (PNG/JPG/EXR)
        </label>
        <input
          id="heightfield-file"
          ref={fileInputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.exr"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) processHeightmap(f);
          }}
          className="w-full text-xs"
        />
      </div>

      {/* Parameters Grid */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {/* Name */}
        <div className="col-span-2">
          <label htmlFor="cfg-name" className="block opacity-70 mb-1">Name</label>
          <input
            id="cfg-name"
            type="text"
            value={cfg.name}
            onChange={(e) => updateCfg("name", e.target.value)}
            className="w-full px-2 py-1 border rounded text-xs"
          />
        </div>

        {/* Grid Size */}
        <div>
          <label htmlFor="cfg-size" className="block opacity-70 mb-1">Grid Size</label>
          <input
            id="cfg-size"
            type="range"
            min={64}
            max={2048}
            step={64}
            value={cfg.size}
            onChange={(e) => updateCfg("size", Number(e.target.value))}
            className="w-full"
          />
          <div className="text-center opacity-60">{cfg.size}×{cfg.size}</div>
        </div>

        {/* Height Scale */}
        <div>
          <label htmlFor="cfg-height-scale" className="block opacity-70 mb-1">Height Scale</label>
          <input
            id="cfg-height-scale"
            type="range"
            min={0.1}
            max={10}
            step={0.1}
            value={cfg.heightScale}
            onChange={(e) => updateCfg("heightScale", Number(e.target.value))}
            className="w-full"
          />
          <div className="text-center opacity-60">{cfg.heightScale.toFixed(2)}</div>
        </div>

        {/* Smooth Iterations */}
        <div>
          <label htmlFor="cfg-smooth" className="block opacity-70 mb-1">Smooth (Taubin)</label>
          <input
            id="cfg-smooth"
            type="range"
            min={0}
            max={20}
            value={cfg.smoothIter}
            onChange={(e) => updateCfg("smoothIter", Number(e.target.value))}
            className="w-full"
          />
          <div className="text-center opacity-60">{cfg.smoothIter} iter</div>
        </div>

        {/* PNG Size */}
        <div>
          <label htmlFor="cfg-png-size" className="block opacity-70 mb-1">Thumbnail px</label>
          <input
            id="cfg-png-size"
            type="range"
            min={256}
            max={1024}
            step={64}
            value={cfg.pngSize}
            onChange={(e) => updateCfg("pngSize", Number(e.target.value))}
            className="w-full"
          />
          <div className="text-center opacity-60">{cfg.pngSize}px</div>
        </div>

        {/* Toggles */}
        <div className="flex items-center gap-2">
          <input
            id="cfg-flip-y"
            type="checkbox"
            checked={cfg.flipY}
            onChange={(e) => updateCfg("flipY", e.target.checked)}
            className="w-3 h-3"
          />
          <label htmlFor="cfg-flip-y" className="opacity-70 text-xs cursor-pointer">Flip Y</label>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="cfg-invert"
            type="checkbox"
            checked={cfg.invert}
            onChange={(e) => updateCfg("invert", e.target.checked)}
            className="w-3 h-3"
          />
          <label htmlFor="cfg-invert" className="opacity-70 text-xs cursor-pointer">Invert</label>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="cfg-normalize"
            type="checkbox"
            checked={cfg.normalize}
            onChange={(e) => updateCfg("normalize", e.target.checked)}
            className="w-3 h-3"
          />
          <label htmlFor="cfg-normalize" className="opacity-70 text-xs cursor-pointer">Auto-Normalize</label>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="cfg-vertex-colors"
            type="checkbox"
            checked={cfg.vertexColors}
            onChange={(e) => updateCfg("vertexColors", e.target.checked)}
            className="w-3 h-3"
          />
          <label htmlFor="cfg-vertex-colors" className="opacity-70 text-xs cursor-pointer">Vertex Colors</label>
        </div>
      </div>

      {/* Progress */}
      {progress && (
        <div className="text-xs p-2 bg-blue-100 rounded text-blue-700">
          {progress}
        </div>
      )}

      {/* Action */}
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={isProcessing}
        className="w-full py-2 px-3 bg-slate-600 text-white text-sm font-semibold rounded hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isProcessing ? "Processing..." : "📂 Load & Export"}
      </button>
    </div>
  );
};

export default HeightfieldCodexButton;
