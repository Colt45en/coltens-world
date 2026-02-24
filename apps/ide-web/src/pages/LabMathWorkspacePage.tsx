import { OrbitControls, TransformControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

// =============================================================
// Character Presets System
// =============================================================
interface CharacterMorphs {
  [key: string]: number;
}

interface CharacterPreset {
  id: string;
  name: string;
  morphs: CharacterMorphs;
  materials: {
    skinColor: string;
    hairColor: string;
    roughness: number;
    metalness: number;
  };
  textures: {
    skinMap: string;
    clothingMap: string;
    maskMap?: string;
  };
  postfx: {
    bloom: number;
    ao: number;
    smaa: boolean;
  };
  quality: {
    shadows: boolean;
    shadowMapSize: number;
  };
}

const CHARACTER_PRESETS: CharacterPreset[] = [
  {
    id: "char_01",
    name: "Tall Athletic",
    morphs: {
      height: 0.08,
      shoulderWidth: 0.14,
      bodyFat: -0.18,
      muscle: 0.22,
      headSize: 0.02,
      jawWidth: 0.18,
      jawForward: 0.06,
      cheekboneHeight: 0.16,
      cheekboneWidth: 0.06,
      chinLength: 0.04,
      noseWidth: -0.06,
      noseBridgeHeight: 0.12,
      noseTipUp: 0.02,
      eyeSize: 0.1,
      eyeSpacing: 0.04,
      browHeight: 0.06,
      browThickness: 0.1,
      lipFullness: 0.02,
      earSize: -0.02,
      neckThickness: 0.06,
    },
    materials: { skinColor: "#d6b08f", hairColor: "#1d1712", roughness: 0.82, metalness: 0.0 },
    textures: { skinMap: "/textures/skin/skin_01.jpg", clothingMap: "/textures/clothes/outfit_01.jpg" },
    postfx: { bloom: 0.22, ao: 0.42, smaa: true },
    quality: { shadows: true, shadowMapSize: 2048 },
  },
  {
    id: "char_02",
    name: "Petite Expressive",
    morphs: {
      height: -0.04,
      shoulderWidth: -0.06,
      bodyFat: 0.1,
      muscle: -0.06,
      headSize: 0.04,
      jawWidth: -0.1,
      jawForward: -0.02,
      cheekboneHeight: 0.06,
      cheekboneWidth: -0.02,
      chinLength: -0.04,
      noseWidth: -0.12,
      noseBridgeHeight: 0.18,
      noseTipUp: 0.1,
      eyeSize: 0.18,
      eyeSpacing: -0.02,
      browHeight: 0.12,
      browThickness: -0.08,
      lipFullness: 0.14,
      earSize: 0.06,
      neckThickness: -0.04,
    },
    materials: { skinColor: "#f2d6c6", hairColor: "#c7a06a", roughness: 0.75, metalness: 0.0 },
    textures: { skinMap: "/textures/skin/skin_02.jpg", clothingMap: "/textures/clothes/outfit_02.jpg", maskMap: "/textures/masks/makeup_01.png" },
    postfx: { bloom: 0.28, ao: 0.48, smaa: true },
    quality: { shadows: true, shadowMapSize: 2048 },
  },
  {
    id: "char_03",
    name: "Square Jaw",
    morphs: {
      height: 0.02,
      shoulderWidth: 0.06,
      bodyFat: -0.1,
      muscle: 0.1,
      headSize: -0.02,
      jawWidth: 0.06,
      jawForward: 0.14,
      cheekboneHeight: 0.02,
      cheekboneWidth: 0.1,
      chinLength: 0.1,
      noseWidth: 0.08,
      noseBridgeHeight: -0.04,
      noseTipUp: -0.06,
      eyeSize: -0.04,
      eyeSpacing: 0.06,
      browHeight: -0.08,
      browThickness: 0.18,
      lipFullness: -0.06,
      earSize: -0.04,
      neckThickness: 0.1,
    },
    materials: { skinColor: "#7d5a44", hairColor: "#0e0d0f", roughness: 0.86, metalness: 0.02 },
    textures: { skinMap: "/textures/skin/skin_03.jpg", clothingMap: "/textures/clothes/outfit_03.jpg" },
    postfx: { bloom: 0.14, ao: 0.55, smaa: false },
    quality: { shadows: true, shadowMapSize: 1024 },
  },
  {
    id: "char_04",
    name: "Muscular Build",
    morphs: {
      height: 0.14,
      shoulderWidth: 0.2,
      bodyFat: -0.24,
      muscle: 0.34,
      headSize: -0.04,
      jawWidth: 0.24,
      jawForward: 0.1,
      cheekboneHeight: 0.1,
      cheekboneWidth: 0.12,
      chinLength: 0.06,
      noseWidth: 0.0,
      noseBridgeHeight: 0.06,
      noseTipUp: -0.02,
      eyeSize: 0.02,
      eyeSpacing: 0.02,
      browHeight: 0.02,
      browThickness: 0.08,
      lipFullness: -0.02,
      earSize: 0.02,
      neckThickness: 0.16,
    },
    materials: { skinColor: "#c28d63", hairColor: "#2a2e3a", roughness: 0.78, metalness: 0.0 },
    textures: { skinMap: "/textures/skin/skin_04.jpg", clothingMap: "/textures/clothes/outfit_04.jpg", maskMap: "/textures/masks/scar_01.png" },
    postfx: { bloom: 0.18, ao: 0.46, smaa: true },
    quality: { shadows: true, shadowMapSize: 2048 },
  },
  {
    id: "char_05",
    name: "Anime Eye",
    morphs: {
      height: -0.1,
      shoulderWidth: 0.02,
      bodyFat: 0.06,
      muscle: -0.02,
      headSize: 0.1,
      jawWidth: -0.16,
      jawForward: -0.1,
      cheekboneHeight: 0.2,
      cheekboneWidth: -0.06,
      chinLength: -0.1,
      noseWidth: -0.1,
      noseBridgeHeight: 0.1,
      noseTipUp: 0.08,
      eyeSize: 0.26,
      eyeSpacing: -0.06,
      browHeight: 0.18,
      browThickness: -0.14,
      lipFullness: 0.22,
      earSize: 0.1,
      neckThickness: -0.08,
    },
    materials: { skinColor: "#ffe0d3", hairColor: "#ff4ea3", roughness: 0.72, metalness: 0.0 },
    textures: { skinMap: "/textures/skin/skin_05.jpg", clothingMap: "/textures/clothes/outfit_05.jpg", maskMap: "/textures/masks/tattoo_01.png" },
    postfx: { bloom: 0.36, ao: 0.4, smaa: true },
    quality: { shadows: false, shadowMapSize: 1024 },
  },
  {
    id: "char_06",
    name: "Neutral Base",
    morphs: { height: 0.0, shoulderWidth: -0.02, bodyFat: -0.04, muscle: 0.02, headSize: 0.0, jawWidth: -0.02, jawForward: 0.0, cheekboneHeight: 0.0, cheekboneWidth: 0.0, chinLength: 0.0, noseWidth: 0.0, noseBridgeHeight: 0.0, noseTipUp: 0.0, eyeSize: 0.0, eyeSpacing: 0.0, browHeight: 0.0, browThickness: 0.0, lipFullness: 0.0, earSize: 0.0, neckThickness: 0.0 },
    materials: { skinColor: "#d8b59a", hairColor: "#2b1d14", roughness: 0.85, metalness: 0.0 },
    textures: { skinMap: "/textures/skin/skin_neutral.jpg", clothingMap: "/textures/clothes/outfit_neutral.jpg", maskMap: "/textures/masks/mask_none.png" },
    postfx: { bloom: 0.2, ao: 0.45, smaa: true },
    quality: { shadows: true, shadowMapSize: 1024 },
  },
  {
    id: "char_07",
    name: "Silver Sage",
    morphs: {
      height: 0.06,
      shoulderWidth: 0.1,
      bodyFat: -0.08,
      muscle: 0.06,
      headSize: -0.06,
      jawWidth: -0.04,
      jawForward: 0.02,
      cheekboneHeight: -0.06,
      cheekboneWidth: 0.02,
      chinLength: 0.02,
      noseWidth: 0.14,
      noseBridgeHeight: -0.1,
      noseTipUp: -0.12,
      eyeSize: -0.1,
      eyeSpacing: 0.1,
      browHeight: -0.14,
      browThickness: 0.06,
      lipFullness: -0.1,
      earSize: -0.06,
      neckThickness: 0.04,
    },
    materials: { skinColor: "#9b7a5b", hairColor: "#ffffff", roughness: 0.6, metalness: 0.08 },
    textures: { skinMap: "/textures/skin/skin_06.jpg", clothingMap: "/textures/clothes/outfit_06.jpg" },
    postfx: { bloom: 0.12, ao: 0.62, smaa: false },
    quality: { shadows: true, shadowMapSize: 2048 },
  },
  {
    id: "char_08",
    name: "Blue Warrior",
    morphs: {
      height: 0.04,
      shoulderWidth: 0.04,
      bodyFat: -0.14,
      muscle: 0.14,
      headSize: 0.02,
      jawWidth: 0.04,
      jawForward: -0.02,
      cheekboneHeight: 0.08,
      cheekboneWidth: 0.1,
      chinLength: -0.02,
      noseWidth: -0.02,
      noseBridgeHeight: 0.04,
      noseTipUp: 0.0,
      eyeSize: 0.06,
      eyeSpacing: 0.0,
      browHeight: 0.04,
      browThickness: 0.04,
      lipFullness: 0.06,
      earSize: -0.02,
      neckThickness: 0.08,
    },
    materials: { skinColor: "#b08a74", hairColor: "#3a6ff2", roughness: 0.7, metalness: 0.0 },
    textures: { skinMap: "/textures/skin/skin_07.jpg", clothingMap: "/textures/clothes/outfit_07.jpg", maskMap: "/textures/masks/warpaint_01.png" },
    postfx: { bloom: 0.3, ao: 0.44, smaa: true },
    quality: { shadows: true, shadowMapSize: 1024 },
  },
];

// =============================================================
// Units + Dimensional Analysis
// =============================================================
const UNIT_TO_METERS: Record<string, number> = {
  m: 1.0,
  cm: 0.01,
  mm: 0.001,
  in: 0.0254,
  ft: 0.3048,
};

const PI = Math.PI;
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const safeAbs = (x: number) => Math.abs(x || 0);
const almostEqual = (a: number, b: number, eps = 1e-4) => Math.abs(a - b) <= eps;

function fmt(n: number, digits = 6): string {
  if (!isFinite(n)) return "--";
  const abs = Math.abs(n);
  if (abs > 1e7) return n.toExponential(3);
  if (abs !== 0 && abs < 1e-6) return n.toExponential(3);
  return n.toFixed(digits);
}

function niceStepMeters(xMeters: number): number {
  if (!isFinite(xMeters) || xMeters <= 0) return 0.1;
  const k = Math.floor(Math.log10(xMeters));
  const base = xMeters / Math.pow(10, k);
  const snap = base < 1.5 ? 1 : base < 3.5 ? 2 : base < 7.5 ? 5 : 10;
  return snap * Math.pow(10, k);
}

function UnitPow({ unit, pow }: { unit: string; pow: number }) {
  if (pow === 1) return <span>{unit}</span>;
  return (
    <span>
      {unit}
      <sup>{pow}</sup>
    </span>
  );
}

function toDisplayLength(worldLen: number, displayUnit: string, metersPerUU: number): number {
  if (!isFinite(worldLen)) return NaN;
  if (displayUnit === "uu") return worldLen;
  const meters = worldLen * metersPerUU;
  return meters / (UNIT_TO_METERS[displayUnit] ?? 1);
}

function toDisplayArea(worldArea: number, displayUnit: string, metersPerUU: number): number {
  if (!isFinite(worldArea)) return NaN;
  if (displayUnit === "uu") return worldArea;
  const m2 = worldArea * metersPerUU * metersPerUU;
  const u = UNIT_TO_METERS[displayUnit] ?? 1;
  return m2 / (u * u);
}

function toDisplayVolume(worldVol: number, displayUnit: string, metersPerUU: number): number {
  if (!isFinite(worldVol)) return NaN;
  if (displayUnit === "uu") return worldVol;
  const m3 = worldVol * metersPerUU * metersPerUU * metersPerUU;
  const u = UNIT_TO_METERS[displayUnit] ?? 1;
  return m3 / (u * u * u);
}

function unitPowForDisplay(displayUnit: string, pow: number): string {
  return displayUnit === "uu" ? "uu" : displayUnit;
}

// =============================================================
// Analytic formulas (computed in WORLD UNITS)
// =============================================================
function ellipsoidAreaApprox(a: number, b: number, c: number): number {
  const p = 1.6075;
  const ap = Math.pow(a, p);
  const bp = Math.pow(b, p);
  const cp = Math.pow(c, p);
  return 4 * PI * Math.pow((ap * bp + ap * cp + bp * cp) / 3, 1 / p);
}

interface AnalyticMetrics {
  kind: string;
  approx: boolean;
  notes: string[];
  dimsWorld: Record<string, number>;
  volumeWorld: number;
  lsaWorld: number;
  tsaWorld: number;
}

function computeAnalyticMetricsWorld(obj: THREE.Object3D | null): AnalyticMetrics | null {
  if (!obj) return null;

  const scale = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const pos = new THREE.Vector3();

  if (obj.matrixAutoUpdate) {
    scale.copy(obj.scale);
  } else {
    obj.matrix.decompose(pos, quat, scale);
  }

  const sx = safeAbs(scale.x);
  const sy = safeAbs(scale.y);
  const sz = safeAbs(scale.z);

  const kind = (obj.userData?.kind as string) || "unknown";
  const base = obj.userData?.base || {};

  const result: AnalyticMetrics = {
    kind,
    approx: false,
    notes: [],
    dimsWorld: {},
    volumeWorld: NaN,
    lsaWorld: NaN,
    tsaWorld: NaN,
  };

  if (kind === "box" || kind === "center_cube") {
    const w0 = base.w ?? 1;
    const h0 = base.h ?? 1;
    const d0 = base.d ?? 1;

    const l = w0 * sx;
    const h = h0 * sy;
    const b = d0 * sz;

    result.dimsWorld = { l, b, h };
    result.volumeWorld = l * b * h;
    result.tsaWorld = 2 * (l * b + b * h + h * l);
    result.lsaWorld = 2 * h * (l + b);

    if (almostEqual(l, b) && almostEqual(b, h)) {
      const s = (l + b + h) / 3;
      result.kind = "cube";
      result.dimsWorld = { s };
      result.volumeWorld = s * s * s;
      result.lsaWorld = 4 * s * s;
      result.tsaWorld = 6 * s * s;
    }
    return result;
  }

  if (kind === "sphere") {
    const r0 = base.r ?? 0.6;
    const a = r0 * sx;
    const b = r0 * sy;
    const c = r0 * sz;

    result.dimsWorld = { rX: a, rY: b, rZ: c };
    result.volumeWorld = (4 / 3) * PI * a * b * c;

    if (almostEqual(a, b) && almostEqual(b, c)) {
      const r = (a + b + c) / 3;
      result.dimsWorld = { r };
      result.tsaWorld = 4 * PI * r * r;
      result.lsaWorld = result.tsaWorld;
    } else {
      result.approx = true;
      result.notes.push("Non-uniform scale → ellipsoid: exact volume, approx surface area.");
      result.tsaWorld = ellipsoidAreaApprox(a, b, c);
      result.lsaWorld = result.tsaWorld;
    }
    return result;
  }

  if (kind === "cylinder") {
    const r0 = base.r ?? 0.6;
    const h0 = base.h ?? 1.4;
    const r = r0 * 0.5 * (sx + sz);
    const h = h0 * sy;

    result.dimsWorld = { r, h };
    result.volumeWorld = PI * r * r * h;
    result.lsaWorld = 2 * PI * r * h;
    result.tsaWorld = 2 * PI * r * (r + h);

    if (!almostEqual(sx, sz)) {
      result.approx = true;
      result.notes.push("Radius uses avg(scaleX, scaleZ). If X/Z differ, metrics are approximate.");
    }
    return result;
  }

  if (kind === "cone") {
    const r0 = base.r ?? 0.7;
    const h0 = base.h ?? 1.6;
    const r = r0 * 0.5 * (sx + sz);
    const h = h0 * sy;
    const ell = Math.sqrt(r * r + h * h);

    result.dimsWorld = { r, h, ell };
    result.volumeWorld = (1 / 3) * PI * r * r * h;
    result.lsaWorld = PI * r * ell;
    result.tsaWorld = PI * r * (r + ell);

    if (!almostEqual(sx, sz)) {
      result.approx = true;
      result.notes.push("Radius uses avg(scaleX, scaleZ). If X/Z differ, metrics are approximate.");
    }
    return result;
  }

  if (kind === "hemisphere") {
    const r0 = base.r ?? 0.7;
    const r = r0 * 0.5 * (sx + sz);

    result.dimsWorld = { r };
    result.volumeWorld = (2 / 3) * PI * r * r * r;
    result.lsaWorld = 2 * PI * r * r;
    result.tsaWorld = 3 * PI * r * r;

    if (!almostEqual(sx, sz)) {
      result.approx = true;
      result.notes.push("Hemisphere assumes uniform radial scale in X/Z; otherwise approximate.");
    }
    return result;
  }

  if (kind === "plane") {
    const w0 = base.w ?? 1.5;
    const h0 = base.h ?? 1.5;
    const area = w0 * sx * (h0 * sy);

    result.dimsWorld = { w: w0 * sx, h: h0 * sy };
    result.volumeWorld = 0;
    result.lsaWorld = area;
    result.tsaWorld = area;
    result.notes.push("Plane is 2D → volume = 0. LSA/TSA shown as area.");
    return result;
  }

  if (kind === "torus") {
    const R0 = base.R ?? 0.8;
    const r0 = base.r ?? 0.2;
    const det = sx * sy * sz;
    const s = Math.cbrt(det || 1);

    const R = R0 * s;
    const r = r0 * s;

    result.dimsWorld = { R, r };
    result.volumeWorld = 2 * PI * PI * R * r * r;
    result.tsaWorld = 4 * PI * PI * R * r;
    result.lsaWorld = result.tsaWorld;

    if (!almostEqual(sx, sy) || !almostEqual(sy, sz)) {
      result.approx = true;
      result.notes.push("Torus uses uniformized scale (geometric mean) → non-uniform scale becomes approximate.");
    }
    return result;
  }

  result.notes.push("No analytic metrics for this shape.");
  return result;
}

// =============================================================
// Advanced Math Analysis (Integrated Custom Libraries)
// =============================================================

interface RegularMathAnalysis {
  boundingBox: { min: [number, number, number]; max: [number, number, number]; size: [number, number, number]; center: [number, number, number] };
  transform: { position: [number, number, number]; scale: [number, number, number]; rotation: [number, number, number] };
  warnings: string[];
}

function performRegularMathAnalysis(obj: THREE.Object3D | null): RegularMathAnalysis | null {
  if (!obj) return null;

  const result: RegularMathAnalysis = {
    boundingBox: { min: [0, 0, 0], max: [0, 0, 0], size: [0, 0, 0], center: [0, 0, 0] },
    transform: { position: [0, 0, 0], scale: [0, 0, 0], rotation: [0, 0, 0] },
    warnings: [],
  };

  try {
    // Compute bounding box
    const bbox = new THREE.Box3().setFromObject(obj);
    const center = bbox.getCenter(new THREE.Vector3());
    const size = bbox.getSize(new THREE.Vector3());
    result.boundingBox.min = [bbox.min.x, bbox.min.y, bbox.min.z];
    result.boundingBox.max = [bbox.max.x, bbox.max.y, bbox.max.z];
    result.boundingBox.size = [size.x, size.y, size.z];
    result.boundingBox.center = [center.x, center.y, center.z];

    // Transform info
    result.transform.position = [obj.position.x, obj.position.y, obj.position.z];
    result.transform.scale = [obj.scale.x, obj.scale.y, obj.scale.z];
    const euler = new THREE.Euler().setFromQuaternion(obj.quaternion);
    result.transform.rotation = [euler.x, euler.y, euler.z];
  } catch (e) {
    // Gracefully handle if geometry is unavailable
    result.warnings.push("Advanced math analysis error: geometry unavailable");
    console.debug("Advanced math analysis error:", e);
  }

  return result;
}

// =============================================================
// Mesh validation
// =============================================================
interface MeshValidation {
  triCount: number;
  meshCount: number;
  areaWorld: number;
  signedVolumeWorld: number;
  volumeWorld: number;
  cancellationRatio: number;
  likelyClosed: boolean;
  warnings: string[];
}

const _vA = new THREE.Vector3();
const _vB = new THREE.Vector3();
const _vC = new THREE.Vector3();
const _ab = new THREE.Vector3();
const _ac = new THREE.Vector3();
const _cross = new THREE.Vector3();

function computeMeshAreaVolumeWorld(obj: THREE.Object3D | null): MeshValidation | null {
  if (!obj) return null;

  obj.updateMatrixWorld(true);

  let triCount = 0;
  let meshCount = 0;
  let area = 0;

  const bbox = new THREE.Box3().setFromObject(obj);
  const ref = bbox.getCenter(new THREE.Vector3());

  let signedVol = 0;
  let sumAbsTetra = 0;

  const warnings: string[] = [];

  obj.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh || !(child as THREE.Mesh).geometry) return;

    const mesh = child as THREE.Mesh;
    const geom = mesh.geometry;
    const posAttr = geom.attributes?.position;
    if (!posAttr) return;

    meshCount++;

    const idx = geom.index;
    const mat = mesh.matrixWorld;

    const readVertex = (i: number, out: THREE.Vector3) => {
      out.fromBufferAttribute(posAttr, i);
      out.applyMatrix4(mat);
      out.sub(ref);
    };

    const tri = (i0: number, i1: number, i2: number) => {
      readVertex(i0, _vA);
      readVertex(i1, _vB);
      readVertex(i2, _vC);

      _ab.subVectors(_vB, _vA);
      _ac.subVectors(_vC, _vA);
      _cross.crossVectors(_ab, _ac);

      const triArea = 0.5 * _cross.length();
      area += triArea;

      const tet = _vA.dot(_vB.clone().cross(_vC)) / 6.0;
      signedVol += tet;
      sumAbsTetra += Math.abs(tet);

      triCount++;
    };

    if (idx) {
      for (let i = 0; i < idx.count; i += 3) {
        tri(idx.getX(i), idx.getX(i + 1), idx.getX(i + 2));
      }
    } else {
      for (let i = 0; i < posAttr.count; i += 3) {
        tri(i, i + 1, i + 2);
      }
    }
  });

  const absVol = Math.abs(signedVol);
  const cancellationRatio = sumAbsTetra > 0 ? absVol / sumAbsTetra : 0;

  let likelyClosed = true;
  if (triCount === 0) {
    warnings.push("No triangles found.");
    likelyClosed = false;
  } else {
    if (absVol < 1e-8 && area > 1e-6) {
      warnings.push("Mesh volume ~ 0 while surface area > 0 → likely open surface or winding cancellation.");
      likelyClosed = false;
    }
    if (cancellationRatio < 0.2) {
      warnings.push("Strong volume cancellation detected → mixed winding or open mesh. Validation may not match formulas.");
      likelyClosed = false;
    }
  }

  return {
    triCount,
    meshCount,
    areaWorld: area,
    signedVolumeWorld: signedVol,
    volumeWorld: absVol,
    cancellationRatio,
    likelyClosed,
    warnings,
  };
}

function percentErr(measured: number, expected: number): number {
  if (!isFinite(measured) || !isFinite(expected)) return NaN;
  const denom = Math.max(1e-12, Math.abs(expected));
  return (100 * (measured - expected)) / denom;
}

// =============================================================
// UI Components
// =============================================================
function Badge({ children }: { children: React.ReactNode }) {
  return <span className="px-2 py-1 rounded-md border border-white/10 bg-white/5 text-xs">{children}</span>;
}

function Accordion({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl overflow-hidden border border-white/10 my-2">
      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 transition"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="inline-block transition" style={{ transform: `rotate(${open ? 0 : -90}deg)` }}>
          ▾
        </span>
        <strong>{title}</strong>
      </button>
      {open && <div className="p-3 bg-black/10">{children}</div>}
    </div>
  );
}

// =============================================================
// Grounding
// =============================================================
const _tmpBox = new THREE.Box3();
const _tmpBoxWorld = new THREE.Box3();

function getWorldBox(obj: THREE.Object3D): THREE.Box3 {
  obj.updateMatrixWorld(true);

  if ((obj as THREE.Mesh).isMesh && (obj as THREE.Mesh).geometry && obj.children.length === 0) {
    const mesh = obj as THREE.Mesh;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    _tmpBox.copy(mesh.geometry.boundingBox!);
    _tmpBoxWorld.copy(_tmpBox).applyMatrix4(mesh.matrixWorld);
    return _tmpBoxWorld;
  }

  _tmpBoxWorld.setFromObject(obj);
  return _tmpBoxWorld;
}

function groundObject(obj: THREE.Object3D, skipGround: boolean = false) {
  if (!obj || skipGround) return;
  if (obj.matrixAutoUpdate) obj.updateMatrix();

  const box = getWorldBox(obj);
  if (!box || !isFinite(box.min.y)) return;

  const epsilon = 0.05;  // Larger clearance to prevent floor clipping
  if (box.min.y < epsilon) {
    const dy = epsilon - box.min.y;
    if (obj.matrixAutoUpdate) {
      obj.position.y += dy;
      obj.updateMatrix();
      obj.updateMatrixWorld(true);
    } else {
      if (obj.matrix) {
        obj.matrix.elements[13]! += dy;
      }
      obj.updateMatrixWorld(true);
    }
  }
}

// =============================================================
// Custom Grid Shader
// =============================================================
function CustomGrid({ minorStep, exposure }: { minorStep: number; exposure: number }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uColorMinor: { value: new THREE.Color(0x223041) },
      uColorMajor: { value: new THREE.Color(0x3c5a7a) },
      uColorAxes: { value: new THREE.Color(0x77aaff) },
      uOrigin: { value: new THREE.Vector2(0, 0) },
      uMinorStep: { value: 0.1 },
      uMajorEvery: { value: 10.0 },
      uLinePx: { value: 1.0 },
      uAxisLinePx: { value: 2.0 },
      uExposure: { value: 1.0 },
    }),
    []
  );

  useFrame(() => {
    if (materialRef.current && materialRef.current.uniforms) {
      const uniforms = materialRef.current.uniforms as any;
      if (uniforms.uMinorStep) uniforms.uMinorStep.value = Math.max(1e-6, minorStep);
      if (uniforms.uExposure) uniforms.uExposure.value = exposure;
    }
  });

  const vertexShader = `varying vec3 vWorld; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vWorld=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`;
  const fragmentShader = `
    precision highp float; varying vec3 vWorld;
    uniform vec3 uColorMinor,uColorMajor,uColorAxes;
    uniform vec2 uOrigin;
    uniform float uMinorStep,uMajorEvery,uLinePx,uAxisLinePx,uExposure;
    vec2 plane(vec3 w){ return vec2(w.x-uOrigin.x, w.z-uOrigin.y); }
    float dline(float c,float s){ float m=mod(c,s); return min(m,s-m); }
    float aaw(){ float wx=length(dFdx(vWorld.x))+length(dFdy(vWorld.x)); float wz=length(dFdx(vWorld.z))+length(dFdy(vWorld.z)); return max(1e-6,.5*(wx+wz)); }
    void main(){
      vec2 p=plane(vWorld);
      float sm=max(uMinorStep,1e-6); float SM=sm*uMajorEvery;
      float dx=dline(p.x,sm), dz=dline(p.y,sm); float dmn=min(dx,dz);
      float Dx=dline(p.x,SM), Dz=dline(p.y,SM); float dMJ=min(Dx,Dz);
      float dAx=max(abs(p.x),abs(p.y));
      float pix=aaw();
      float wmn=uLinePx*pix, wMJ=1.5*uLinePx*pix, wAx=uAxisLinePx*pix;
      float aMn=1.0-smoothstep(.5*wmn, wmn, dmn);
      float aMj=1.0-smoothstep(.5*wMJ, wMJ, dMJ);
      float aAx=1.0-smoothstep(.5*wAx, wAx, dAx);
      vec3 col=vec3(0.0); float a=0.0;
      if(aAx>0.0){col=uColorAxes;a=aAx;}
      else if(aMj>0.0){col=uColorMajor;a=aMj;}
      else if(aMn>0.0){col=uColorMinor;a=aMn;}
      else discard;
      gl_FragColor=vec4(col*uExposure,a);
    }
  `;

  return (
    <mesh renderOrder={-10} frustumCulled={false} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[100000, 100000]} />
      <shaderMaterial
        ref={materialRef as any}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

function GridOverlay({ url, repeat, opacity }: { url: string | null; repeat: number; opacity: number }) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (!url) {
      setTex(null);
      return;
    }
    new THREE.TextureLoader().load(url, (loaded) => {
      loaded.wrapS = loaded.wrapT = THREE.RepeatWrapping;
      loaded.repeat.set(repeat, repeat);
      setTex(loaded);
    });
  }, [url, repeat]);

  return (
    <mesh position={[0, 1e-4, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={-9} frustumCulled={false}>
      <planeGeometry args={[100000, 100000]} />
      <meshBasicMaterial transparent opacity={opacity} depthWrite={false} map={tex as any} />
    </mesh>
  );
}

// =============================================================
// Node Component
// =============================================================
interface NodeProps {
  id: string;
  type: string;
  initialMatrix?: number[] | undefined;
  color?: [number, number, number] | undefined;
  onSelect: (obj: THREE.Object3D) => void;
  registerNode: (id: string, obj: THREE.Object3D | null) => void;
  onDoubleClick?: (obj: THREE.Object3D) => void;
}

const Node = ({ id, type, initialMatrix, color, onSelect, registerNode, onDoubleClick }: NodeProps) => {
  const ref = useRef<THREE.Group | THREE.Mesh>(null);
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const obj = ref.current;
    if (!obj) return;

    registerNode(id, obj);

    if (initialMatrix) {
      obj.matrix.fromArray(initialMatrix);
      obj.matrixAutoUpdate = false;
      obj.updateMatrixWorld(true);
    } else if (type === "center_cube") {
      obj.position.set(0, 1.0, 0);
      obj.updateMatrix();
      obj.matrixAutoUpdate = false;
      obj.updateMatrixWorld(true);
    }

    obj.userData.kind = type;

    if (type === "box" || type === "center_cube") obj.userData.base = { w: 1, h: 1, d: 1 };
    if (type === "sphere") obj.userData.base = { r: 0.6 };
    if (type === "cylinder") obj.userData.base = { r: 0.6, h: 1.4 };
    if (type === "cone") obj.userData.base = { r: 0.7, h: 1.6 };
    if (type === "hemisphere") obj.userData.base = { r: 0.7 };
    if (type === "plane") obj.userData.base = { w: 1.5, h: 1.5 };
    if (type === "torus") obj.userData.base = { R: 0.8, r: 0.2 };

    groundObject(obj);

    if (type === "center_cube") onSelect(obj);

    // Default state: frozen deterministic transform
    obj.updateMatrix();
    obj.matrixAutoUpdate = false;
    obj.updateMatrixWorld(true);

    return () => registerNode(id, null);
  }, [id, type, initialMatrix, registerNode, onSelect]);

  const getMatColor = () => {
    if (color) return color;
    const colorMap: Record<string, number> = {
      box: 0x7cc2ff,
      center_cube: 0xff0000,
      sphere: 0xffe08a,
      cylinder: 0xaad7ff,
      cone: 0xffb1e6,
      hemisphere: 0xb7ffcc,
      plane: 0xa3ffd9,
      torus: 0xe3a7ff,
    };
    return colorMap[type] ?? 0xffffff;
  };

  const matColor = getMatColor();
  const commonMat = <meshStandardMaterial color={matColor as any} roughness={0.6} />;

  const handleClick = (e: any) => {
    e.stopPropagation();
    clickCountRef.current += 1;

    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);

    if (clickCountRef.current === 1) {
      clickTimerRef.current = window.setTimeout(() => {
        clickCountRef.current = 0;
        onSelect(ref.current!);
      }, 300);
    } else if (clickCountRef.current === 2) {
      clickCountRef.current = 0;
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
      onSelect(ref.current!);
      if (onDoubleClick) onDoubleClick(ref.current!);
    }
  };

  // Hemisphere: group with half-sphere + disk cap
  if (type === "hemisphere") {
    return (
      <group ref={ref as any} onClick={handleClick}>
        <mesh rotation={[0, 0, 0]}>
          <sphereGeometry args={[0.7, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
          {commonMat}
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <circleGeometry args={[0.7, 64]} />
          {commonMat}
        </mesh>
      </group>
    );
  }

  let geom: JSX.Element;
  if (type === "box" || type === "center_cube") geom = <boxGeometry args={[1, 1, 1]} />;
  else if (type === "sphere") geom = <sphereGeometry args={[0.6, 48, 32]} />;
  else if (type === "cylinder") geom = <cylinderGeometry args={[0.6, 0.6, 1.4, 48, 1]} />;
  else if (type === "cone") geom = <coneGeometry args={[0.7, 1.6, 48, 1]} />;
  else if (type === "plane") geom = <planeGeometry args={[1.5, 1.5]} />;
  else if (type === "torus") geom = <torusGeometry args={[0.8, 0.2, 24, 96]} />;
  else geom = <torusKnotGeometry args={[0.75, 0.25, 220, 32]} />;

  const isPlane = type === "plane";

  return (
    <mesh
      ref={ref as any}
      onClick={handleClick}
      rotation={isPlane ? [-Math.PI / 2, 0, 0] : [0, 0, 0]}
    >
      {geom}
      <meshStandardMaterial color={matColor as any} roughness={0.6} side={isPlane ? THREE.DoubleSide : THREE.FrontSide} />
    </mesh>
  );
};

function ThreeContextExposer({ setThreeCtx }: { setThreeCtx: (ctx: any) => void }) {
  const ctx = useThree();
  useEffect(() => {
    setThreeCtx(ctx);
  }, [ctx, setThreeCtx]);
  return null;
}

function FPSProbe({ onFps }: { onFps: (fps: number) => void }) {
  const last = useRef(performance.now());
  const acc = useRef(0);
  const frames = useRef(0);

  useFrame(() => {
    const now = performance.now();
    frames.current++;
    acc.current += now - last.current;
    last.current = now;
    if (acc.current >= 500) {
      const fps = (frames.current * 1000) / acc.current;
      frames.current = 0;
      acc.current = 0;
      onFps(fps);
    }
  });

  return null;
}

// =============================================================
// Animated Cube Component
// =============================================================
const AnimatedCube = ({ isAnimating }: { isAnimating: boolean }) => {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!isAnimating || !ref.current) return;
    ref.current.rotation.x += 0.01;
    ref.current.rotation.y += 0.012;
    ref.current.rotation.z += 0.008;
  });

  return (
    <mesh ref={ref} position={[5, 3, -5]} scale={0.8}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color="#ff6b9d"
        roughness={0.4}
        metalness={0.8}
        emissive="#ff1166"
        emissiveIntensity={0.3}
      />
    </mesh>
  );
};

// =============================================================
// Main Component
// =============================================================
interface SceneNode {
  id: string;
  type: string;
  initialMatrix?: number[];
  color?: [number, number, number];
}

// Stable Canvas contents component (no remounting on mode/space/selection changes)
type CanvasContentsProps = {
  setThreeCtx: (ctx: any) => void;
  setLocalFps: (fps: number) => void;
  minorStep: number;
  exposure: number;
  gridTextureUrl: string | null;
  gridTexRepeat: number;
  gridTexOpacity: number;
  sceneNodes: SceneNode[];
  handleSelect: (obj: THREE.Object3D | null) => void;
  registerNode: (id: string, obj: THREE.Object3D | null) => void;
  selectedObj: THREE.Object3D | null;
  controlMode: "translate" | "rotate" | "scale";
  controlSpace: "local" | "world";
  snapStep: number;
  recomputeValidation: (obj: THREE.Object3D | null) => void;
  groundObject: (obj: THREE.Object3D, skipGround?: boolean) => void;
  orbitControlsRef: React.MutableRefObject<any>;
  isTransformingRef: React.MutableRefObject<boolean>;
  freeMoveMode: boolean;
  setFreeMoveMode: (v: boolean) => void;
  setControlMode: (v: "translate" | "rotate" | "scale") => void;
  isAnimating: boolean;
};

const CanvasContents = React.memo(function CanvasContents(props: CanvasContentsProps) {
  const {
    setThreeCtx,
    setLocalFps,
    minorStep,
    exposure,
    gridTextureUrl,
    gridTexRepeat,
    gridTexOpacity,
    sceneNodes,
    handleSelect,
    registerNode,
    selectedObj,
    controlMode,
    controlSpace,
    snapStep,
    recomputeValidation,
    groundObject,
    orbitControlsRef,
    isTransformingRef,
    freeMoveMode,
    setFreeMoveMode,
    setControlMode,
    isAnimating,
  } = props;

  const tRef = React.useRef<any>(null);

  // Disable orbit while dragging gizmo
  React.useEffect(() => {
    const tc = tRef.current;
    if (!tc) return;

    const onDrag = (e: any) => {
      isTransformingRef.current = !!e.value;
      if (orbitControlsRef.current) orbitControlsRef.current.enabled = !e.value;
    };

    tc.addEventListener("dragging-changed", onDrag);
    return () => tc.removeEventListener("dragging-changed", onDrag);
  }, [orbitControlsRef, isTransformingRef]);

  return (
    <>
      <ThreeContextExposer setThreeCtx={setThreeCtx} />
      <FPSProbe onFps={setLocalFps} />

      <color attach="background" args={["#0b0e12"]} />
      <hemisphereLight args={["#ffffff", "#111321", 0.8]} />
      <directionalLight position={[10, 20, 10]} intensity={0.9} />

      <CustomGrid minorStep={minorStep} exposure={exposure} />
      <GridOverlay url={gridTextureUrl} repeat={gridTexRepeat} opacity={gridTexOpacity} />
      <axesHelper args={[5]} position={[0, 1e-3, 0]} />

      <AnimatedCube isAnimating={isAnimating} />

      {sceneNodes.map((node) => (
        <Node
          key={node.id}
          id={node.id}
          type={node.type}
          color={node.color}
          initialMatrix={node.initialMatrix}
          onSelect={handleSelect}
          registerNode={registerNode}
          onDoubleClick={(obj) => {
            setFreeMoveMode(true);
            setControlMode("translate");
            handleSelect(obj);
          }}
        />
      ))}

      {selectedObj && (
        <TransformControls
          ref={tRef}
          object={selectedObj}
          mode={controlMode}
          space={controlSpace}
          translationSnap={snapStep}
          rotationSnap={THREE.MathUtils.degToRad(15)}
          scaleSnap={0.1}
          onMouseUp={() => {
            selectedObj.updateMatrix();
            selectedObj.matrixAutoUpdate = false;
            selectedObj.updateMatrixWorld(true);
            groundObject(selectedObj, freeMoveMode);
            recomputeValidation(selectedObj);
            isTransformingRef.current = false;
            if (orbitControlsRef.current) orbitControlsRef.current.enabled = true;
          }}
        />
      )}

      <OrbitControls ref={orbitControlsRef} makeDefault enableDamping dampingFactor={0.1} target={[0, 1, 0]} />
    </>
  );
});

export default function LabMathWorkspacePage() {
  const [wsUrl, setWsUrl] = useState("ws://127.0.0.1:8765/scene");
  const [conn, setConn] = useState<"idle" | "connecting" | "ok" | "down">("idle");

  const [minorStep, setMinorStep] = useState(0.1);
  const [snapStep, setSnapStep] = useState(0.1);
  const [exposure, setExposure] = useState(1.0);

  const [hud, setHud] = useState({ fps: "--", bpm: "--", beat: 0 });
  const [localFps, setLocalFps] = useState<string | number>("--");

  const [controlMode, setControlMode] = useState<"translate" | "rotate" | "scale">("translate");
  const [controlSpace, setControlSpace] = useState<"local" | "world">("local");

  const [selectedObj, setSelectedObj] = useState<THREE.Object3D | null>(null);
  const [sceneNodes, setSceneNodes] = useState<SceneNode[]>([{ id: "center_cube", type: "center_cube" }]);

  const [gridTextureUrl, setGridTextureUrl] = useState<string | null>(null);
  const [gridTexRepeat, setGridTexRepeat] = useState(8);
  const [gridTexOpacity, setGridTexOpacity] = useState(0.55);

  const [metersPerUU, setMetersPerUU] = useState(1.0);
  const [displayUnit, setDisplayUnit] = useState("uu");

  const [validation, setValidation] = useState<MeshValidation | null>(null);
  const [regularMath, setRegularMath] = useState<RegularMathAnalysis | null>(null);

  const [freeMoveMode, setFreeMoveMode] = useState(false);
  const [isAnimating, setIsAnimating] = useState(true);
  const [selectedCharacterIdx, setSelectedCharacterIdx] = useState(5); // Default to Neutral Base

  const meshRefs = useRef(new Map<string, THREE.Object3D>());
  const orbitControlsRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<number | null>(null);
  const isTransformingRef = useRef(false);
  const [threeCtx, setThreeCtx] = useState<any>(null);

  const registerNode = (id: string, obj: THREE.Object3D | null) => {
    if (obj) meshRefs.current.set(id, obj);
    else meshRefs.current.delete(id);
  };

  const _selPos = useRef(new THREE.Vector3());
  const _selQuat = useRef(new THREE.Quaternion());
  const _selScale = useRef(new THREE.Vector3());

  function syncTRSFromMatrix(obj: THREE.Object3D) {
    obj.matrix.decompose(_selPos.current, _selQuat.current, _selScale.current);
    obj.position.copy(_selPos.current);
    _selQuat.current.normalize();
    obj.quaternion.copy(_selQuat.current);
    // Clamp scale to valid range (min 0.1, no max limit)
    obj.scale.set(
      clamp(_selScale.current.x, 0.1, Infinity),
      clamp(_selScale.current.y, 0.1, Infinity),
      clamp(_selScale.current.z, 0.1, Infinity)
    );
  }

  function freezeMatrixFromTRS(obj: THREE.Object3D) {
    obj.updateMatrix();
    obj.matrixAutoUpdate = false;
    obj.updateMatrixWorld(true);
  }

  function recomputeValidation(obj: THREE.Object3D | null) {
    if (!obj) {
      setValidation(null);
      setRegularMath(null);
      return;
    }
    if (obj.matrixAutoUpdate) freezeMatrixFromTRS(obj);
    const v = computeMeshAreaVolumeWorld(obj);
    setValidation(v);

    // Compute regular math analysis
    const math = performRegularMathAnalysis(obj);
    setRegularMath(math);
  }

  function handleSelect(obj: THREE.Object3D | null) {
    if (selectedObj && selectedObj !== obj) {
      freezeMatrixFromTRS(selectedObj);
    }

    if (obj) {
      syncTRSFromMatrix(obj);
      obj.matrixAutoUpdate = true;
      obj.updateMatrixWorld(true);

      groundObject(obj, freeMoveMode);

      recomputeValidation(obj);
    } else {
      setValidation(null);
    }

    setSelectedObj(obj);
  }

  useEffect(() => {
    function isTypingTarget(t: EventTarget | null): boolean {
      const el = t as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName?.toLowerCase();
      return tag === "input" || tag === "textarea" || tag === "select" || (el as any).isContentEditable === true;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;

      switch (e.code) {
        case "Escape":
          e.preventDefault();
          setFreeMoveMode(false);
          break;
        case "KeyW":
          e.preventDefault();
          setControlMode("translate");
          break;
        case "KeyE":
          e.preventDefault();
          setControlMode("rotate");
          break;
        case "KeyR":
          e.preventDefault();
          setControlMode("scale");
          break;
        case "KeyQ":
          e.preventDefault();
          setControlSpace((s) => (s === "local" ? "world" : "local"));
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true } as any);
  }, []);

  const connectWS = (url: string) => {
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }
    setConn("connecting");
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConn("ok");
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      ws.send(
        JSON.stringify({
          type: "viewport",
          width: window.innerWidth * dpr,
          height: window.innerHeight * dpr,
          devicePixelRatio: dpr,
        })
      );
    };

    ws.onmessage = (ev) => {
      const f = JSON.parse(ev.data);

      if (threeCtx && orbitControlsRef.current && f.camera?.view && f.camera?.proj) {
        const { camera } = threeCtx;
        const v = new THREE.Matrix4().fromArray(f.camera.view);
        const p = new THREE.Matrix4().fromArray(f.camera.proj);

        const world = v.clone().invert();
        const pos = new THREE.Vector3();
        const q = new THREE.Quaternion();
        const s = new THREE.Vector3();
        world.decompose(pos, q, s);

        camera.position.copy(pos);
        camera.quaternion.copy(q);
        camera.projectionMatrix.copy(p);

        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
        orbitControlsRef.current.target.copy(pos).addScaledVector(fwd, 5);
        orbitControlsRef.current.update();

        if (f.camera.exposure) setExposure(f.camera.exposure);
      }

      // Skip remote node updates - use local scene management only
      // if (Array.isArray(f.nodes)) {
      //   f.nodes.forEach((n: any) => {
      //     ...
      //   });
      // }

      setHud({
        fps: f.debug?.fps ? f.debug.fps.toFixed(0) : "--",
        bpm: f.signals?.bpm ? f.signals.bpm.toFixed(1) : "--",
        beat: f.signals?.beatPhase ?? 0,
      });
    };

    ws.onclose = () => {
      setConn("down");
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      // Don't auto-reconnect - user must click connect button
    };

    ws.onerror = () => {
      try {
        ws.close();
      } catch {}
    };
  };

  const spawnLocal = (kind: string) => {
    const id = `${kind}_${Math.random().toString(36).slice(2, 8)}`;
    const x = Math.round((Math.random() * 2 - 1) * 5);
    const z = Math.round((Math.random() * 2 - 1) * 5);
    // Spawn at y: 2.0 to ensure objects are above floor with room for geometry
    const m = new THREE.Matrix4().makeTranslation(x, 2.0, z);

    setSceneNodes((prev) => [...prev, { id, type: kind, initialMatrix: m.toArray() as number[], color: [0.8, 0.8, 0.9] }]);

    setTimeout(() => {
      const obj = meshRefs.current.get(id);
      if (obj) handleSelect(obj);
    }, 50);
  };

  const exportGLB = () => {
    if (!selectedObj) {
      alert("Select/spawn an object first.");
      return;
    }
    if (selectedObj.matrixAutoUpdate) freezeMatrixFromTRS(selectedObj);

    const exporter = new GLTFExporter();
    exporter.parse(
      selectedObj,
      (gltf: ArrayBuffer | string | { [key: string]: any }) => {
        const isString = typeof gltf === 'string';
        const isArrayBuffer = gltf instanceof ArrayBuffer;
        const blob = new Blob([gltf as any], { type: isString ? "application/json" : "application/octet-stream" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "selection." + (isString ? "gltf" : "glb");
        a.click();
        URL.revokeObjectURL(a.href);
      },
      (error: ErrorEvent | Error | string) => console.error(error),
      { binary: true }
    );
  };

  const onTextureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setGridTextureUrl(null);
      return;
    }
    setGridTextureUrl(URL.createObjectURL(file));
  };

  const analytic = useMemo(() => computeAnalyticMetricsWorld(selectedObj), [selectedObj]);

  const analyticDisp = useMemo(() => {
    if (!analytic) return null;
    const dims: Record<string, number> = {};
    for (const [k, v] of Object.entries(analytic.dimsWorld || {})) {
      dims[k] = toDisplayLength(v, displayUnit, metersPerUU);
    }
    return {
      ...analytic,
      dimsDisp: dims,
      volumeDisp: toDisplayVolume(analytic.volumeWorld, displayUnit, metersPerUU),
      lsaDisp: toDisplayArea(analytic.lsaWorld, displayUnit, metersPerUU),
      tsaDisp: toDisplayArea(analytic.tsaWorld, displayUnit, metersPerUU),
    };
  }, [analytic, displayUnit, metersPerUU]);

  const compare = useMemo(() => {
    if (!analytic || !validation) return null;

    const tsaErr = percentErr(validation.areaWorld, analytic.tsaWorld);
    const volErr = percentErr(validation.volumeWorld, analytic.volumeWorld);

    return {
      tsaErrPct: tsaErr,
      volErrPct: volErr,
      meshAreaDisp: toDisplayArea(validation.areaWorld, displayUnit, metersPerUU),
      meshVolDisp: toDisplayVolume(validation.volumeWorld, displayUnit, metersPerUU),
      meshAreaWorld: validation.areaWorld,
      meshVolWorld: validation.volumeWorld,
    };
  }, [analytic, validation, displayUnit, metersPerUU]);

  // Render stable canvas contents (no remounting on hotkey changes)

  return (
    <div className="h-screen w-screen flex overflow-hidden" style={{ background: "#141821", color: "#e6eefc" }}>
      {/* Sidebar */}
      <div
        className="w-[430px] min-w-[340px] max-w-[520px] overflow-auto border-r border-black/70 z-10"
        style={{ background: "linear-gradient(180deg,#1c2230,#161b26)" }}
      >
        <h2 className="text-xl font-extrabold m-4 mb-2">Workspace — Units + Validation</h2>

        {/* Units */}
        <div className="m-3 p-3 rounded-xl border border-white/10 bg-white/5">
          <div className="font-semibold mb-2">Units (Dimensional Analysis)</div>

          <div className="flex items-center gap-2 my-2">
            <label htmlFor="meters-per-uu" className="text-sm text-sky-200/80 w-28">
              m / uu
            </label>
            <input
              id="meters-per-uu"
              type="number"
              step={0.0001}
              value={metersPerUU}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setMetersPerUU(isFinite(v) && v > 0 ? v : 1.0);
              }}
              className="flex-1 px-2 py-2 rounded-md bg-white/10 border border-white/20 font-mono"
            />
          </div>

          <div className="flex items-center gap-2 my-2">
            <span className="text-sm text-sky-200/80 w-28">Display</span>
            <select
              aria-label="Display unit"
              value={displayUnit}
              onChange={(e) => setDisplayUnit(e.target.value)}
              className="flex-1 px-2 py-2 rounded-md bg-white/10 border border-white/20"
            >
              <option value="uu">uu (world)</option>
              <option value="m">m</option>
              <option value="cm">cm</option>
              <option value="mm">mm</option>
              <option value="in">in</option>
              <option value="ft">ft</option>
            </select>
          </div>

          <div className="text-xs text-sky-200/70 mt-2">
            <div>
              Lengths scale by <b>m/uu</b>. Areas scale by <b>(m/uu)²</b>. Volumes scale by <b>(m/uu)³</b>.
            </div>
          </div>


        </div>

        {/* Connection */}
        <div className="m-3 p-3 rounded-xl border border-white/10 bg-white/5">
          <div className="flex items-center gap-2 my-2">
            <span className="text-sm text-sky-200/80 w-24">Server</span>
            <input
              className="flex-1 px-2 py-2 rounded-md bg-white/10 border border-white/20"
              value={wsUrl}
              onChange={(e) => setWsUrl(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3 my-2">
            <button
              type="button"
              className="px-3 py-2 rounded-md border border-white/20 bg-emerald-400/20 hover:bg-emerald-400/30 font-bold"
              onClick={() => connectWS(wsUrl)}
            >
              Connect
            </button>
            <Badge>
              {conn === "ok" ? "Connected" : conn === "connecting" ? "Connecting…" : conn === "down" ? "Disconnected" : "Idle"}
            </Badge>
            <Badge>Remote FPS {hud.fps}</Badge>
            <Badge>Local FPS {typeof localFps === "string" ? localFps : localFps.toFixed(0)}</Badge>
          </div>
        </div>

        {/* Animation Controls */}
        <div className="m-3 p-3 rounded-xl border border-white/10 bg-white/5">
          <div className="font-semibold mb-2">Animation</div>
          <button
            type="button"
            onClick={() => setIsAnimating(!isAnimating)}
            className={`w-full px-3 py-2 rounded-md border border-white/20 font-semibold transition ${
              isAnimating ? "bg-emerald-500/40 hover:bg-emerald-500/50" : "bg-slate-500/40 hover:bg-slate-500/50"
            }`}
          >
            {isAnimating ? "⏸ Pause" : "▶ Resume"}
          </button>
        </div>

        {/* Character Inspector */}
        <div className="m-3 p-3 rounded-xl border border-white/10 bg-white/5">
          <div className="font-semibold mb-2">Character Presets</div>
          <select
            value={selectedCharacterIdx}
            onChange={(e) => setSelectedCharacterIdx(parseInt(e.target.value))}
            className="w-full px-2 py-2 rounded-md bg-white/10 border border-white/20 text-white mb-3"
          >
            {CHARACTER_PRESETS.map((char, idx) => (
              <option key={char.id} value={idx}>
                {idx + 1}. {char.name}
              </option>
            ))}
          </select>

          {CHARACTER_PRESETS[selectedCharacterIdx] && (
            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-sky-200/70">Skin:</span>
                  <div
                    className="w-full h-6 rounded border border-white/20 mt-1"
                    style={{ backgroundColor: CHARACTER_PRESETS[selectedCharacterIdx].materials.skinColor }}
                  />
                </div>
                <div>
                  <span className="text-sky-200/70">Hair:</span>
                  <div
                    className="w-full h-6 rounded border border-white/20 mt-1"
                    style={{ backgroundColor: CHARACTER_PRESETS[selectedCharacterIdx].materials.hairColor }}
                  />
                </div>
              </div>

              <div className="text-sky-200/70 mt-2">
                <div>Roughness: {CHARACTER_PRESETS[selectedCharacterIdx].materials.roughness.toFixed(2)}</div>
                <div>Metalness: {CHARACTER_PRESETS[selectedCharacterIdx].materials.metalness.toFixed(2)}</div>
              </div>

              <div className="text-sky-200/70 text-xs mt-2 bg-black/30 p-2 rounded">
                <div className="font-semibold mb-1">Morphs:</div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {Object.entries(CHARACTER_PRESETS[selectedCharacterIdx].morphs)
                    .filter(([_, v]) => Math.abs(v) > 0.01)
                    .map(([key, val]) => (
                      <div key={key} className="flex justify-between">
                        <span>{key}:</span>
                        <span className={val > 0 ? "text-green-400" : "text-blue-400"}>
                          {(val > 0 ? "+" : "")}{val.toFixed(2)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Grid / Snapping */}
        <div className="m-3 p-3 rounded-xl border border-white/10 bg-white/5 text-sky-100/90">
          <div className="flex items-center gap-2 my-2">
            <label htmlFor="minor-step" className="w-28">
              Minor Step
            </label>
            <input
              id="minor-step"
              type="number"
              step={0.0001}
              value={minorStep}
              onChange={(e) => setMinorStep(parseFloat(e.target.value) || 0.1)}
              className="flex-1 px-2 py-2 rounded-md bg-white/10 border border-white/20 font-mono"
            />
          </div>
          <div className="flex items-center gap-2 my-2">
            <label htmlFor="snap-step" className="w-28">
              Snap Step
            </label>
            <input
              id="snap-step"
              type="number"
              step={0.0001}
              value={snapStep}
              onChange={(e) => setSnapStep(parseFloat(e.target.value) || 0.1)}
              className="flex-1 px-2 py-2 rounded-md bg-white/10 border border-white/20 font-mono"
            />
          </div>
          <div className="flex items-center gap-2 my-2">
            <span className="w-28">Exposure</span>
            <input
              type="range"
              min={0.1}
              max={4}
              step={0.05}
              value={exposure}
              onChange={(e) => setExposure(parseFloat(e.target.value))}
              className="flex-1"
            />
          </div>

          <div className="text-xs text-sky-200/70 mt-2">
            <b>Controls:</b> W/E/R • Q local/world • Orbit: RMB • Pan: MMB • Zoom: wheel • Select: LMB
          </div>
        </div>

        {/* Tools */}
        <div className="m-3">
          <Accordion title="Tools" defaultOpen>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setControlMode("translate")}
                className={`py-2 rounded-md border border-white/20 ${
                  controlMode === "translate" ? "bg-blue-500/50" : "bg-white/10"
                } hover:bg-white/20`}
              >
                Move (W)
              </button>
              <button
                type="button"
                onClick={() => setControlMode("rotate")}
                className={`py-2 rounded-md border border-white/20 ${
                  controlMode === "rotate" ? "bg-blue-500/50" : "bg-white/10"
                } hover:bg-white/20`}
              >
                Rotate (E)
              </button>
              <button
                type="button"
                onClick={() => setControlMode("scale")}
                className={`py-2 rounded-md border border-white/20 ${
                  controlMode === "scale" ? "bg-blue-500/50" : "bg-white/10"
                } hover:bg-white/20`}
              >
                Scale (R)
              </button>
            </div>
            <div className="text-xs text-sky-200/70 mt-2 text-center">
              Space: <b>{controlSpace.toUpperCase()}</b> (press Q)
            </div>
          </Accordion>

          <Accordion title="Math Inspector (Analytic + Validation)" defaultOpen>
            {!selectedObj && <div className="text-sm text-white/70">Select an object to see metrics + validation.</div>}

            {selectedObj && analyticDisp && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-sky-200/80">Selected</div>
                    <div className="font-semibold">{analyticDisp.kind}</div>
                  </div>
                  <div className="text-right text-xs text-white/60">
                    {analyticDisp.approx ? (
                      <span className="text-amber-300">analytic approx</span>
                    ) : (
                      <span className="text-emerald-300">analytic exact</span>
                    )}
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-black/20 border border-white/10 font-mono text-xs">
                  <div className="text-sky-200/80">dims ({displayUnit})</div>
                  <div>
                    {JSON.stringify(
                      Object.fromEntries(Object.entries(analyticDisp.dimsDisp).map(([k, v]) => [k, +fmt(v, 6)]))
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2 rounded-lg bg-black/20 border border-white/10">
                    <div className="text-xs text-sky-200/80">Volume</div>
                    <div className="font-mono">
                      {fmt(analyticDisp.volumeDisp, 6)} <UnitPow unit={unitPowForDisplay(displayUnit, 3)} pow={3} />
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-black/20 border border-white/10">
                    <div className="text-xs text-sky-200/80">LSA</div>
                    <div className="font-mono">
                      {fmt(analyticDisp.lsaDisp, 6)} <UnitPow unit={unitPowForDisplay(displayUnit, 2)} pow={2} />
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-black/20 border border-white/10">
                    <div className="text-xs text-sky-200/80">TSA</div>
                    <div className="font-mono">
                      {fmt(analyticDisp.tsaDisp, 6)} <UnitPow unit={unitPowForDisplay(displayUnit, 2)} pow={2} />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="px-3 py-2 rounded-md border border-white/20 bg-white/10 hover:bg-white/20 text-sm"
                    onClick={() => recomputeValidation(selectedObj)}
                  >
                    Recompute Validation
                  </button>
                  {validation && (
                    <Badge>
                      tris {validation.triCount} • meshes {validation.meshCount}
                    </Badge>
                  )}
                </div>

                {validation && compare && (
                  <div className="p-2 rounded-lg bg-black/20 border border-white/10">
                    <div className="text-xs text-sky-200/80 mb-2">Mesh-derived validation (triangle integration)</div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 rounded bg-black/20 border border-white/10">
                        <div className="text-xs text-sky-200/80">Mesh Surface Area</div>
                        <div className="font-mono">
                          {fmt(compare.meshAreaDisp, 6)} <UnitPow unit={unitPowForDisplay(displayUnit, 2)} pow={2} />
                        </div>
                      </div>
                      <div className="p-2 rounded bg-black/20 border border-white/10">
                        <div className="text-xs text-sky-200/80">Mesh Volume</div>
                        <div className="font-mono">
                          {fmt(compare.meshVolDisp, 6)} <UnitPow unit={unitPowForDisplay(displayUnit, 3)} pow={3} />
                        </div>
                      </div>

                      <div className="p-2 rounded bg-black/20 border border-white/10">
                        <div className="text-xs text-sky-200/80">TSA Error</div>
                        <div className="font-mono">{fmt(compare.tsaErrPct, 3)}%</div>
                      </div>
                      <div className="p-2 rounded bg-black/20 border border-white/10">
                        <div className="text-xs text-sky-200/80">Volume Error</div>
                        <div className="font-mono">{fmt(compare.volErrPct, 3)}%</div>
                      </div>
                    </div>

                    <div className="text-xs text-white/70 mt-2">
                      Closed mesh heuristic:{" "}
                      {validation.likelyClosed ? (
                        <span className="text-emerald-300">likely closed</span>
                      ) : (
                        <span className="text-amber-300">open/mixed winding</span>
                      )}
                      {" • "}
                      cancellation ratio: <b className="font-mono">{fmt(validation.cancellationRatio, 3)}</b>
                    </div>

                    {validation.warnings?.length > 0 && (
                      <div className="mt-2 p-2 rounded bg-amber-500/10 border border-amber-300/20 text-xs text-amber-200/90">
                        {validation.warnings.map((w, i) => (
                          <div key={i}>• {w}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {analyticDisp.notes?.length > 0 && (
                  <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-300/20 text-xs text-amber-200/90">
                    {analyticDisp.notes.map((n, i) => (
                      <div key={i}>• {n}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Accordion>

          <Accordion title="Math Properties" defaultOpen>
            {!selectedObj && <div className="text-sm text-white/70">Select an object to see math analysis.</div>}

            {selectedObj && regularMath && (
              <div className="space-y-3">
                {/* Bounding Box */}
                <div className="p-2 rounded-lg bg-black/20 border border-cyan-300/20">
                  <div className="text-xs text-cyan-200/80 mb-1">📦 Bounding Box</div>
                  <div className="font-mono text-xs space-y-1">
                    <div>Min: [{fmt(regularMath.boundingBox.min[0], 3)}, {fmt(regularMath.boundingBox.min[1], 3)}, {fmt(regularMath.boundingBox.min[2], 3)}]</div>
                    <div>Max: [{fmt(regularMath.boundingBox.max[0], 3)}, {fmt(regularMath.boundingBox.max[1], 3)}, {fmt(regularMath.boundingBox.max[2], 3)}]</div>
                    <div>Size: [{fmt(regularMath.boundingBox.size[0], 3)}, {fmt(regularMath.boundingBox.size[1], 3)}, {fmt(regularMath.boundingBox.size[2], 3)}]</div>
                    <div>Center: [{fmt(regularMath.boundingBox.center[0], 3)}, {fmt(regularMath.boundingBox.center[1], 3)}, {fmt(regularMath.boundingBox.center[2], 3)}]</div>
                  </div>
                </div>

                {/* Transform */}
                <div className="p-2 rounded-lg bg-black/20 border border-blue-300/20">
                  <div className="text-xs text-blue-200/80 mb-1">🔄 Transform</div>
                  <div className="font-mono text-xs space-y-1">
                    <div>Position: [{fmt(regularMath.transform.position[0], 3)}, {fmt(regularMath.transform.position[1], 3)}, {fmt(regularMath.transform.position[2], 3)}]</div>
                    <div>Scale: [{fmt(regularMath.transform.scale[0], 3)}, {fmt(regularMath.transform.scale[1], 3)}, {fmt(regularMath.transform.scale[2], 3)}]</div>
                    <div>Rotation (rad): [{fmt(regularMath.transform.rotation[0], 3)}, {fmt(regularMath.transform.rotation[1], 3)}, {fmt(regularMath.transform.rotation[2], 3)}]</div>
                  </div>
                </div>
              </div>
            )}
          </Accordion>

          <Accordion title="Primitives (math-table aligned)" defaultOpen>
            <div className="grid grid-cols-2 gap-2">
              {["box", "sphere", "cylinder", "cone", "hemisphere", "plane", "torus"].map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => spawnLocal(k)}
                  className="py-2 rounded-md border border-white/20 bg-white/10 hover:bg-white/20 capitalize"
                >
                  {k}
                </button>
              ))}
            </div>
          </Accordion>
        </div>

        {/* Texture */}
        <div className="m-3 p-3 rounded-xl border border-white/10 bg-white/5 text-sky-100/90">
          <div className="font-semibold mb-2">Grid Texture</div>
          <div className="flex items-center gap-2 my-2">
            <label htmlFor="texture-upload" className="flex-1 text-sm cursor-pointer">
              Upload Image
            </label>
            <input
              id="texture-upload"
              type="file"
              accept="image/*"
              onChange={onTextureUpload}
              className="flex-1 text-sm"
              placeholder="Choose an image file"
            />
          </div>
          <div className="flex items-center gap-2 my-2">
            <label htmlFor="grid-repeat" className="w-28">
              Repeat
            </label>
            <input
              id="grid-repeat"
              type="number"
              min={1}
              max={256}
              value={gridTexRepeat}
              onChange={(e) => setGridTexRepeat(Math.max(1, Math.min(256, parseInt(e.target.value) || 8)))}
              className="flex-1 px-2 py-2 rounded-md bg-white/10 border border-white/20"
            />
          </div>
          <div className="flex items-center gap-2 my-2">
            <label htmlFor="grid-opacity" className="w-28">
              Opacity
            </label>
            <input
              id="grid-opacity"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={gridTexOpacity}
              onChange={(e) => setGridTexOpacity(parseFloat(e.target.value))}
              className="flex-1"
            />
          </div>
        </div>

        {/* Export */}
        <div className="m-3 p-3 rounded-xl border border-white/10 bg-white/5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="px-3 py-2 rounded-md border border-white/20 bg-emerald-400/20 hover:bg-emerald-400/30 font-bold"
              onClick={exportGLB}
            >
              Export GLB
            </button>
            <span className="text-sky-200/80 text-sm">(current selection)</span>
          </div>
        </div>
      </div>

      {/* Viewer */}
      <div className="flex-1 relative">
        <div className="absolute left-3 right-3 top-3 pointer-events-none flex justify-between gap-2 z-10">
          <div className="pointer-events-auto bg-black/40 border border-white/10 rounded-xl px-3 py-2 backdrop-blur">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${conn === "ok" ? "bg-emerald-400" : "bg-rose-400"}`} />
              <span className="text-xs text-sky-200/80 max-w-[480px] truncate">{wsUrl}</span>
              <Badge>BPM {hud.bpm}</Badge>
              <div className="w-40 h-1.5 rounded bg-white/20 overflow-hidden">
                <div
                  className="h-full bg-white/70 transition-all"
                  style={{ width: `${clamp(hud.beat, 0, 1) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <Canvas
          gl={{
            antialias: true,
            powerPreference: "high-performance",
            logarithmicDepthBuffer: true,
          }}
          camera={{ position: [5, 6, 8], fov: 75, near: 0.1, far: 50000 }}
          onPointerMissed={() => {
            if (isTransformingRef.current) return;
            setFreeMoveMode(false);
            handleSelect(null);
          }}
        >
          <CanvasContents
            setThreeCtx={setThreeCtx}
            setLocalFps={setLocalFps}
            minorStep={minorStep}
            exposure={exposure}
            gridTextureUrl={gridTextureUrl}
            gridTexRepeat={gridTexRepeat}
            gridTexOpacity={gridTexOpacity}
            sceneNodes={sceneNodes}
            handleSelect={handleSelect}
            registerNode={registerNode}
            selectedObj={selectedObj}
            controlMode={controlMode}
            controlSpace={controlSpace}
            snapStep={snapStep}
            recomputeValidation={recomputeValidation}
            groundObject={groundObject}
            orbitControlsRef={orbitControlsRef}
            isTransformingRef={isTransformingRef}
            freeMoveMode={freeMoveMode}
            setFreeMoveMode={setFreeMoveMode}
            setControlMode={setControlMode}
            isAnimating={isAnimating}
          />
        </Canvas>
      </div>
    </div>
  );
}
