import { Grid, OrbitControls, TransformControls } from "@react-three/drei";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

// =============================================================
// Types
// =============================================================
type ControlMode = "translate" | "rotate" | "scale";
type ControlSpace = "local" | "world";

type ShapeKind =
  | "box"
  | "sphere"
  | "cylinder"
  | "cone"
  | "hemisphere"
  | "plane"
  | "torus";

type SceneNode = {
  id: string;
  type: ShapeKind;
  initialMatrix?: number[];
  color?: [number, number, number];
};

type UnitName = "uu" | "m" | "cm" | "mm" | "in" | "ft";

type PrefabAabb = {
  min: [number, number, number];
  max: [number, number, number];
  size: [number, number, number];
  center: [number, number, number];
};

type PrefabMetrics = {
  kind: string;
  approx: boolean;
  notes: string[];
  dimsWorld: Record<string, number>;
  volumeWorld: number; // uu^3
  lsaWorld: number; // uu^2
  tsaWorld: number; // uu^2
};

type PrefabDescriptorV1 = {
  v: 1;
  id: string;
  kind: ShapeKind;
  matrixWorld: number[]; // 16
  aabbWorld: PrefabAabb;
  metrics: PrefabMetrics | null;
  units: { metersPerUU: number; displayUnit: UnitName };
};

// =============================================================
// Utils (fast, deterministic)
// =============================================================
const UNIT_TO_METERS: Record<UnitName, number> = {
  uu: 1,
  m: 1.0,
  cm: 0.01,
  mm: 0.001,
  in: 0.0254,
  ft: 0.3048,
};

const PI = Math.PI;
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const safeAbs = (x: number) => Math.abs(x || 0);
const almostEqual = (a: number, b: number, eps = 1e-5) => Math.abs(a - b) <= eps;

function fmt(n: number, digits = 6): string {
  if (!isFinite(n)) return "--";
  const abs = Math.abs(n);
  if (abs > 1e7) return n.toExponential(3);
  if (abs !== 0 && abs < 1e-6) return n.toExponential(3);
  return n.toFixed(digits);
}

function toDisplayLength(worldLen: number, unit: UnitName, metersPerUU: number): number {
  if (!isFinite(worldLen)) return NaN;
  if (unit === "uu") return worldLen;
  const meters = worldLen * metersPerUU;
  return meters / UNIT_TO_METERS[unit];
}

function toDisplayArea(worldArea: number, unit: UnitName, metersPerUU: number): number {
  if (!isFinite(worldArea)) return NaN;
  if (unit === "uu") return worldArea;
  const m2 = worldArea * metersPerUU * metersPerUU;
  const u = UNIT_TO_METERS[unit];
  return m2 / (u * u);
}

function toDisplayVolume(worldVol: number, unit: UnitName, metersPerUU: number): number {
  if (!isFinite(worldVol)) return NaN;
  if (unit === "uu") return worldVol;
  const m3 = worldVol * metersPerUU * metersPerUU * metersPerUU;
  const u = UNIT_TO_METERS[unit];
  return m3 / (u * u * u);
}

// =============================================================
// Correct-ish analytic math (WORLD UNITS)
// - Volume is exact for all below (including elliptical cases).
// - Surface area: exact when uniform; good approximations when non-uniform.
// =============================================================

// Knud Thomsen approximation for ellipsoid surface area (very good)
function ellipsoidAreaApprox(a: number, b: number, c: number): number {
  const p = 1.6075;
  const ap = Math.pow(a, p);
  const bp = Math.pow(b, p);
  const cp = Math.pow(c, p);
  return 4 * PI * Math.pow((ap * bp + ap * cp + bp * cp) / 3, 1 / p);
}

// Ramanujan II ellipse perimeter approximation (excellent)
function ellipsePerimeterApprox(a: number, b: number): number {
  const A = Math.max(0, a);
  const B = Math.max(0, b);
  if (A === 0 && B === 0) return 0;
  if (A === 0) return 2 * PI * B;
  if (B === 0) return 2 * PI * A;

  const h = Math.pow((A - B) / (A + B), 2);
  return PI * (A + B) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
}

function getTRSScales(obj: THREE.Object3D): { sx: number; sy: number; sz: number } {
  const scale = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();

  if (obj.matrixAutoUpdate) {
    scale.copy(obj.scale);
  } else {
    obj.matrix.decompose(p, q, scale);
  }

  return { sx: safeAbs(scale.x), sy: safeAbs(scale.y), sz: safeAbs(scale.z) };
}

const SHAPE_BASE: Record<ShapeKind, any> = {
  box: { w: 1, h: 1, d: 1 },
  sphere: { r: 0.6 },
  cylinder: { r: 0.6, h: 1.4 },
  cone: { r: 0.7, h: 1.6 },
  hemisphere: { r: 0.7 },
  plane: { w: 1.5, h: 1.5 },
  torus: { R: 0.8, r: 0.2 },
};

function computeAnalyticMetricsWorld(obj: THREE.Object3D | null): PrefabMetrics | null {
  if (!obj) return null;

  const kind = (obj.userData?.kind as ShapeKind) || "box";
  const base = obj.userData?.base || SHAPE_BASE[kind];

  const { sx, sy, sz } = getTRSScales(obj);

  const out: PrefabMetrics = {
    kind,
    approx: false,
    notes: [],
    dimsWorld: {},
    volumeWorld: NaN,
    lsaWorld: NaN,
    tsaWorld: NaN,
  };

  if (kind === "box") {
    const w = (base.w ?? 1) * sx;
    const h = (base.h ?? 1) * sy;
    const d = (base.d ?? 1) * sz;

    out.dimsWorld = { w, h, d };
    out.volumeWorld = w * h * d;
    out.tsaWorld = 2 * (w * h + w * d + h * d);
    out.lsaWorld = 2 * h * (w + d);
    if (almostEqual(w, h) && almostEqual(h, d)) {
      out.kind = "cube";
      out.dimsWorld = { s: (w + h + d) / 3 };
      const s = out.dimsWorld.s!;
      out.volumeWorld = s * s * s;
      out.lsaWorld = 4 * s * s;
      out.tsaWorld = 6 * s * s;
    }
    return out;
  }

  if (kind === "sphere") {
    // sphere under non-uniform scale becomes ellipsoid
    const r0 = base.r ?? 0.6;
    const a = r0 * sx;
    const b = r0 * sy;
    const c = r0 * sz;

    out.dimsWorld = { rX: a, rY: b, rZ: c };
    out.volumeWorld = (4 / 3) * PI * a * b * c;

    if (almostEqual(a, b) && almostEqual(b, c)) {
      const r = (a + b + c) / 3;
      out.dimsWorld = { r };
      out.tsaWorld = 4 * PI * r * r;
      out.lsaWorld = out.tsaWorld;
    } else {
      out.approx = true;
      const newLocal =
        "Non-uniform scale → ellipsoid. Volume exact; surface area uses Knud Thomsen approximation.";
      out.notes.push(newLocal);
      out.tsaWorld = ellipsoidAreaApprox(a, b, c);
      out.lsaWorld = out.tsaWorld;
    }
    return out;
  }

  if (kind === "cylinder") {
    // cylinder under non-uniform X/Z is an elliptical cylinder
    const r0 = base.r ?? 0.6;
    const h0 = base.h ?? 1.4;

    const rx = r0 * sx;
    const rz = r0 * sz;
    const h = h0 * sy;

    const baseArea = PI * rx * rz; // exact (ellipse)
    const perimeter = ellipsePerimeterApprox(rx, rz); // approx
    const lsa = perimeter * h; // approx (very good)
    const tsa = lsa + 2 * baseArea;

    out.dimsWorld = { rX: rx, rZ: rz, h };
    out.volumeWorld = baseArea * h; // exact
    out.lsaWorld = lsa;
    out.tsaWorld = tsa;

    if (!almostEqual(sx, sz)) {
      out.approx = true;
      const newLocal =
        "Elliptical cylinder: volume exact; lateral area uses ellipse perimeter approximation.";
    }
    return out;
  }

  if (kind === "cone") {
    // cone under non-uniform X/Z is an elliptical cone
    const r0 = base.r ?? 0.7;
    const h0 = base.h ?? 1.6;

    const rx = r0 * sx;
    const rz = r0 * sz;
    const h = h0 * sy;

    const baseArea = PI * rx * rz; // exact
    const perimeter = ellipsePerimeterApprox(rx, rz); // approx

    // slant lengths along principal directions; average them (good approximation)
    const lx = Math.sqrt(rx * rx + h * h);
    const lz = Math.sqrt(rz * rz + h * h);
    const lAvg = 0.5 * (lx + lz);

    // Circle case: LSA = π r l  = ( (2πr) * l )/2  -> generalize with ellipse perimeter
    const lsa = (perimeter * lAvg) / 2; // approx
    const tsa = lsa + baseArea;

    out.dimsWorld = { rX: rx, rZ: rz, h, lX: lx, lZ: lz };
    out.volumeWorld = (1 / 3) * baseArea * h; // exact
    out.lsaWorld = lsa;
    out.tsaWorld = tsa;

    if (!almostEqual(sx, sz)) {
      out.approx = true;
      out.notes.push("Elliptical cone: volume exact; lateral area approximated using ellipse perimeter + avg slant length.");
    }
    return out;
  }

  if (kind === "hemisphere") {
    // hemisphere under scaling is half-ellipsoid (assuming cut by XZ plane)
    const r0 = base.r ?? 0.7;
    const a = r0 * sx; // x radius
    const b = r0 * sy; // y radius
    const c = r0 * sz; // z radius

    const fullEllVol = (4 / 3) * PI * a * b * c;
    const hemiVol = 0.5 * fullEllVol; // exact
    const baseArea = PI * a * c; // ellipse in XZ plane (exact)
    const fullEllArea = ellipsoidAreaApprox(a, b, c);
    const curved = 0.5 * fullEllArea; // approx

    out.dimsWorld = { rX: a, rY: b, rZ: c };
    out.volumeWorld = hemiVol;
    out.lsaWorld = curved;
    out.tsaWorld = curved + baseArea;
    out.approx = true;
    out.notes.push("Scaled hemisphere treated as half-ellipsoid. Volume exact; curved surface uses ellipsoid area approximation / 2.");
    return out;
  }

  if (kind === "plane") {
    const w0 = base.w ?? 1.5;
    const h0 = base.h ?? 1.5;
    const w = w0 * sx;
    const h = h0 * sy;
    const area = w * h;

    out.dimsWorld = { w, h };
    out.volumeWorld = 0;
    out.lsaWorld = area;
    out.tsaWorld = area;
    out.notes.push("Plane is 2D: volume=0. LSA/TSA shown as area.");
    return out;
  }

  if (kind === "torus") {
    const R0 = base.R ?? 0.8;
    const r0 = base.r ?? 0.2;

    // base torus formulas in object space
    const V0 = 2 * PI * PI * R0 * r0 * r0;
    const A0 = 4 * PI * PI * R0 * r0;

    // volume under any linear scale is exact by determinant
    const det = sx * sy * sz;
    out.volumeWorld = V0 * Math.abs(det);

    // area under non-uniform scale is not exact; use pair-product average scale
    const areaScale = (Math.abs(sx * sy) + Math.abs(sx * sz) + Math.abs(sy * sz)) / 3;
    out.tsaWorld = A0 * areaScale;
    out.lsaWorld = out.tsaWorld;

    out.dimsWorld = { R: R0, r: r0, sx, sy, sz };
    out.approx = !almostEqual(sx, sy) || !almostEqual(sy, sz);
    if (out.approx) out.notes.push("Torus: volume exact (det scale). Surface area uses pair-product average scale approximation.");
    return out;
  }

  return null;
}

// =============================================================
// Prefab AABB + Grounding
// =============================================================
const _tmpBox = new THREE.Box3();
const _tmpSize = new THREE.Vector3();
const _tmpCenter = new THREE.Vector3();

function computeAabbWorld(obj: THREE.Object3D): PrefabAabb {
  obj.updateMatrixWorld(true);
  _tmpBox.setFromObject(obj);
  _tmpBox.getSize(_tmpSize);
  _tmpBox.getCenter(_tmpCenter);
  return {
    min: [_tmpBox.min.x, _tmpBox.min.y, _tmpBox.min.z],
    max: [_tmpBox.max.x, _tmpBox.max.y, _tmpBox.max.z],
    size: [_tmpSize.x, _tmpSize.y, _tmpSize.z],
    center: [_tmpCenter.x, _tmpCenter.y, _tmpCenter.z],
  };
}

function groundToPlaneY0(obj: THREE.Object3D, epsilon = 0.0) {
  obj.updateMatrixWorld(true);
  _tmpBox.setFromObject(obj);
  if (!isFinite(_tmpBox.min.y)) return;

  const dy = (0 + epsilon) - _tmpBox.min.y;
  if (dy <= 0) return;

  // Respect current edit mode (TRS if auto update, else matrix)
  if (obj.matrixAutoUpdate) {
    obj.position.y += dy;
    obj.updateMatrix();
  } else if (obj.matrix?.elements) {
    obj.matrix.elements[13]! += dy;
  }
  obj.updateMatrixWorld(true);
}

// =============================================================
// Primitives (Prefab-safe, low poly)
// =============================================================
const SHAPE_COLOR: Record<ShapeKind, number> = {
  box: 0x7cc2ff,
  sphere: 0xffe08a,
  cylinder: 0xaad7ff,
  cone: 0xffb1e6,
  hemisphere: 0xb7ffcc,
  plane: 0xa3ffd9,
  torus: 0xe3a7ff,
};

function Node({
  id,
  type,
  initialMatrix,
  color,
  onSelect,
  registerNode,
}: {
  id: string;
  type: ShapeKind;
  initialMatrix?: number[];
  color?: [number, number, number];
  onSelect: (obj: THREE.Object3D) => void;
  registerNode: (id: string, obj: THREE.Object3D | null) => void;
}) {
  const ref = useRef<THREE.Object3D>(null);

  useEffect(() => {
    const obj = ref.current;
    if (!obj) return;

    registerNode(id, obj);

    obj.userData.kind = type;
    obj.userData.base = SHAPE_BASE[type];

    // Deterministic transform: frozen by default
    if (initialMatrix) {
      obj.matrix.fromArray(initialMatrix);
      obj.matrixAutoUpdate = false;
      obj.updateMatrixWorld(true);
    } else {
      obj.position.set(0, 1, 0);
      obj.updateMatrix();
      obj.matrixAutoUpdate = false;
      obj.updateMatrixWorld(true);
    }

    // Ground once on create
    groundToPlaneY0(obj, 0.0);

    return () => registerNode(id, null);
  }, [id, type, initialMatrix, registerNode]);

  const matColor = useMemo(() => {
    if (color) return new THREE.Color(color[0], color[1], color[2]).getHex();
    return SHAPE_COLOR[type];
  }, [color, type]);

  const handleDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const obj = ref.current;
    if (!obj) return;
    onSelect(obj);
  };

  const commonMat = <meshStandardMaterial color={matColor} roughness={0.6} />;

  if (type === "hemisphere") {
    return (
      <group ref={ref as any} onPointerDown={handleDown}>
        <mesh>
          <sphereGeometry args={[0.7, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          {commonMat}
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.7, 48]} />
          {commonMat}
        </mesh>
      </group>
    );
  }

  const isPlane = type === "plane";
  const geom =
    type === "box" ? (
      <boxGeometry args={[1, 1, 1]} />
    ) : type === "sphere" ? (
      <sphereGeometry args={[0.6, 32, 16]} />
    ) : type === "cylinder" ? (
      <cylinderGeometry args={[0.6, 0.6, 1.4, 32, 1]} />
    ) : type === "cone" ? (
      <coneGeometry args={[0.7, 1.6, 32, 1]} />
    ) : type === "plane" ? (
      <planeGeometry args={[1.5, 1.5]} />
    ) : (
      <torusGeometry args={[0.8, 0.2, 16, 48]} />
    );

  return (
    <mesh
      ref={ref as any}
      onPointerDown={handleDown}
      rotation={isPlane ? [-Math.PI / 2, 0, 0] : [0, 0, 0]}
    >
      {geom}
      <meshStandardMaterial color={matColor} roughness={0.6} side={isPlane ? THREE.DoubleSide : THREE.FrontSide} />
    </mesh>
  );
}

// =============================================================
// Canvas Contents
// =============================================================
function Scene({
  nodes,
  selected,
  setSelected,
  registerNode,
  controlMode,
  controlSpace,
  snapStep,
  onTransformCommit,
}: {
  nodes: SceneNode[];
  selected: THREE.Object3D | null;
  setSelected: (o: THREE.Object3D | null) => void;
  registerNode: (id: string, obj: THREE.Object3D | null) => void;
  controlMode: ControlMode;
  controlSpace: ControlSpace;
  snapStep: number;
  onTransformCommit: (obj: THREE.Object3D) => void;
}) {
  const orbitRef = useRef<any>(null);
  const tRef = useRef<any>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    const tc = tRef.current;
    if (!tc) return;
    const onDrag = (e: any) => {
      draggingRef.current = !!e.value;
      if (orbitRef.current) orbitRef.current.enabled = !e.value;
    };
    tc.addEventListener("dragging-changed", onDrag);
    return () => tc.removeEventListener("dragging-changed", onDrag);
  }, []);

  return (
    <>
      <color attach="background" args={["#0b0e12"]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[10, 20, 10]} intensity={0.85} />

      {/* Simple, fast grid (no shader math) */}
      <Grid
        infiniteGrid
        cellSize={snapStep}
        cellThickness={0.75}
        sectionSize={snapStep * 10}
        sectionThickness={1.5}
        fadeDistance={250}
        fadeStrength={2}
        position={[0, 0, 0]}
      />
      <axesHelper args={[5]} position={[0, 1e-3, 0]} />

      {nodes.map((n) => (
        <Node
          key={n.id}
          id={n.id}
          type={n.type}
          initialMatrix={n.initialMatrix}
          color={n.color}
          registerNode={registerNode}
          onSelect={(obj) => {
            // unfreeze to edit
            obj.matrix.decompose(obj.position, obj.quaternion, obj.scale);
            obj.matrixAutoUpdate = true;
            obj.updateMatrixWorld(true);
            setSelected(obj);
          }}
        />
      ))}

      {selected && (
        <TransformControls
          ref={tRef}
          object={selected}
          mode={controlMode}
          space={controlSpace}
          translationSnap={snapStep}
          rotationSnap={THREE.MathUtils.degToRad(15)}
          scaleSnap={0.1}
          onMouseUp={() => {
            // freeze to deterministic prefab matrix
            selected.updateMatrix();
            selected.matrixAutoUpdate = false;
            selected.updateMatrixWorld(true);

            // ground + commit metrics
            groundToPlaneY0(selected, 0.0);
            onTransformCommit(selected);

            if (orbitRef.current) orbitRef.current.enabled = true;
          }}
        />
      )}

      <OrbitControls ref={orbitRef} makeDefault enableDamping dampingFactor={0.1} target={[0, 1, 0]} />
    </>
  );
}

// =============================================================
// Main: Prefab Studio Page
// =============================================================
export default function LabPrefabStudioPage() {
  const [controlMode, setControlMode] = useState<ControlMode>("translate");
  const [controlSpace, setControlSpace] = useState<ControlSpace>("local");
  const [snapStep, setSnapStep] = useState(0.5);

  const [metersPerUU, setMetersPerUU] = useState(1.0);
  const [displayUnit, setDisplayUnit] = useState<UnitName>("uu");

  const [nodes, setNodes] = useState<SceneNode[]>([{ id: "box_0000", type: "box" }]);
  const [selected, setSelected] = useState<THREE.Object3D | null>(null);

  const refs = useRef(new Map<string, THREE.Object3D>());
  const spawnCounter = useRef(1); // deterministic within session

  const registerNode = useCallback((id: string, obj: THREE.Object3D | null) => {
    if (obj) refs.current.set(id, obj);
    else refs.current.delete(id);
  }, []);

  const recompute = useCallback((obj: THREE.Object3D | null) => {
    if (!obj) return null;
    obj.updateMatrixWorld(true);
    return computeAnalyticMetricsWorld(obj);
  }, []);

  const [metrics, setMetrics] = useState<PrefabMetrics | null>(null);
  const [aabb, setAabb] = useState<PrefabAabb | null>(null);

  const onTransformCommit = useCallback(
    (obj: THREE.Object3D) => {
      setMetrics(recompute(obj));
      setAabb(computeAabbWorld(obj));
    },
    [recompute]
  );

  useEffect(() => {
    if (!selected) {
      setMetrics(null);
      setAabb(null);
      return;
    }
    selected.updateMatrixWorld(true);
    setMetrics(recompute(selected));
    setAabb(computeAabbWorld(selected));
  }, [recompute, selected]);

  const spawn = useCallback((kind: ShapeKind) => {
    const n = spawnCounter.current++;
    const id = `${kind}_${String(n).padStart(4, "0")}`;

    // deterministic spawn pattern (no Math.random)
    const grid = 2;
    const ix = (n % 5) - 2;
    const iz = Math.floor(n / 5) - 2;
    const x = ix * grid;
    const z = iz * grid;

    const m = new THREE.Matrix4().makeTranslation(x, 2, z);

    setNodes((prev) => [...prev, { id, type: kind, initialMatrix: m.toArray() as number[] }]);

    // select after mount
    window.setTimeout(() => {
      const obj = refs.current.get(id);
      if (obj) setSelected(obj);
    }, 30);
  }, []);

  const exportPrefab = useCallback(() => {
    if (!selected) {
      alert("Select an object first.");
      return;
    }

    // ensure deterministic frozen matrix
    if (selected.matrixAutoUpdate) {
      selected.updateMatrix();
      selected.matrixAutoUpdate = false;
      selected.updateMatrixWorld(true);
    }

    const kind = (selected.userData?.kind as ShapeKind) || "box";
    const id = `${kind}_selection`;

    const descriptor: PrefabDescriptorV1 = {
      v: 1,
      id,
      kind,
      matrixWorld: selected.matrixWorld.toArray(),
      aabbWorld: computeAabbWorld(selected),
      metrics: computeAnalyticMetricsWorld(selected),
      units: { metersPerUU, displayUnit },
    };

    // Download JSON
    const jsonBlob = new Blob([JSON.stringify(descriptor, null, 2)], { type: "application/json" });
    const jsonA = document.createElement("a");
    jsonA.href = URL.createObjectURL(jsonBlob);
    jsonA.download = `${id}.prefab.json`;
    jsonA.click();
    URL.revokeObjectURL(jsonA.href);

    // Export GLB
    const exporter = new GLTFExporter();
    exporter.parse(
      selected,
      (gltf) => {
        const ab = gltf as ArrayBuffer;
        const blob = new Blob([ab], { type: "model/gltf-binary" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${id}.glb`;
        a.click();
        URL.revokeObjectURL(a.href);
      },
      (err) => console.error(err),
      { binary: true }
    );
  }, [displayUnit, metersPerUU, selected]);

  const disp = useMemo(() => {
    if (!metrics) return null;
    const dimsDisp: Record<string, number> = {};
    for (const [k, v] of Object.entries(metrics.dimsWorld)) {
      dimsDisp[k] = toDisplayLength(v, displayUnit, metersPerUU);
    }
    return {
      kind: metrics.kind,
      approx: metrics.approx,
      notes: metrics.notes,
      dimsDisp,
      volDisp: toDisplayVolume(metrics.volumeWorld, displayUnit, metersPerUU),
      lsaDisp: toDisplayArea(metrics.lsaWorld, displayUnit, metersPerUU),
      tsaDisp: toDisplayArea(metrics.tsaWorld, displayUnit, metersPerUU),
    };
  }, [displayUnit, metersPerUU, metrics]);

  return (
    <div
      className="h-screen w-screen flex overflow-hidden bg-[#141821] text-[#e6eefc]"
    >
      {/* Sidebar */}
      <div className="w-[420px] min-w-[320px] max-w-[520px] overflow-auto border-r border-black/70">
        <div className="p-4">
          <h2 className="text-xl font-extrabold">Prefab Studio</h2>
          <div className="text-xs text-sky-200/70 mt-1">
            Deterministic transforms • Analytic metrics • Export GLB + .prefab.json
          </div>

          {/* Units */}
          <div className="mt-4 p-3 rounded-xl border border-white/10 bg-white/5">
            <div className="font-semibold mb-2">Units</div>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-sm text-sky-200/80 w-28">m / uu</label>
              <input
                type="number"
                step={0.0001}
                value={metersPerUU}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setMetersPerUU(isFinite(v) && v > 0 ? v : 1.0);
                }}
                className="flex-1 px-2 py-2 rounded-md bg-white/10 border border-white/20 font-mono"
                title="Meters per world unit"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-sky-200/80 w-28">Display</label>
              <select
                aria-label="Display unit"
                value={displayUnit}
                onChange={(e) => setDisplayUnit(e.target.value as UnitName)}
                className="flex-1 px-2 py-2 rounded-md bg-white/10 border border-white/20"
              >
                <option value="uu">uu</option>
                <option value="m">m</option>
                <option value="cm">cm</option>
                <option value="mm">mm</option>
                <option value="in">in</option>
                <option value="ft">ft</option>
              </select>
            </div>
          </div>

          {/* Grid / snapping */}
          <div className="mt-4 p-3 rounded-xl border border-white/10 bg-white/5">
            <div className="font-semibold mb-2">Grid / Snapping</div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-sky-200/80 w-28">Snap step</label>
              <input
                type="number"
                step={0.01}
                value={snapStep}
                onChange={(e) => setSnapStep(Math.max(0.01, parseFloat(e.target.value) || 0.5))}
                className="flex-1 px-2 py-2 rounded-md bg-white/10 border border-white/20 font-mono"
                placeholder="0.5"
              />
            </div>
            <div className="text-xs text-sky-200/70 mt-2">
              Hotkeys: W/E/R • Q (local/world) • Select: LMB • Orbit: RMB
            </div>
          </div>

          {/* Tools */}
          <div className="mt-4 p-3 rounded-xl border border-white/10 bg-white/5">
            <div className="font-semibold mb-2">Transform</div>
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
            <button
              type="button"
              onClick={() => setControlSpace((s) => (s === "local" ? "world" : "local"))}
              className="mt-2 w-full py-2 rounded-md border border-white/20 bg-white/10 hover:bg-white/20"
            >
              Space: <b>{controlSpace.toUpperCase()}</b> (Q)
            </button>
          </div>

          {/* Spawn primitives */}
          <div className="mt-4 p-3 rounded-xl border border-white/10 bg-white/5">
            <div className="font-semibold mb-2">Spawn Primitives</div>
            <div className="grid grid-cols-2 gap-2">
              {(
                ["box", "sphere", "cylinder", "cone", "hemisphere", "plane", "torus"] as ShapeKind[]
              ).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => spawn(k)}
                  className="py-2 rounded-md border border-white/20 bg-white/10 hover:bg-white/20 capitalize"
                >
                  {k}
                </button>
              ))}
            </div>
          </div>

          {/* Metrics */}
          <div className="mt-4 p-3 rounded-xl border border-white/10 bg-white/5">
            <div className="font-semibold mb-2">Prefab Metrics</div>
            {!selected && (
              <div className="text-sm text-white/70">Select an object to view metrics.</div>
            )}

            {selected && disp && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-sky-200/80">Selected</div>
                    <div className="font-semibold">{disp.kind}</div>
                  </div>
                  <div className="text-right text-xs">
                    {disp.approx ? (
                      <span className="text-amber-300">approx</span>
                    ) : (
                      <span className="text-emerald-300">exact</span>
                    )}
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-black/20 border border-white/10 font-mono text-xs">
                  <div className="text-sky-200/80">dims ({displayUnit})</div>
                  <div>
                    {JSON.stringify(
                      Object.fromEntries(
                        Object.entries(disp.dimsDisp).map(([k, v]) => [k, +fmt(v, 6)])
                      )
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2 rounded-lg bg-black/20 border border-white/10">
                    <div className="text-xs text-sky-200/80">Volume</div>
                    <div className="font-mono">{fmt(disp.volDisp, 6)}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-black/20 border border-white/10">
                    <div className="text-xs text-sky-200/80">LSA</div>
                    <div className="font-mono">{fmt(disp.lsaDisp, 6)}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-black/20 border border-white/10">
                    <div className="text-xs text-sky-200/80">TSA</div>
                    <div className="font-mono">{fmt(disp.tsaDisp, 6)}</div>
                  </div>
                </div>

                {aabb && (
                  <div className="p-2 rounded-lg bg-black/20 border border-white/10 font-mono text-xs">
                    <div className="text-sky-200/80">AABB (world)</div>
                    <div>
                      size: [{fmt(aabb.size[0], 3)}, {fmt(aabb.size[1], 3)}, {fmt(aabb.size[2], 3)}]
                    </div>
                    <div>
                      min: [{fmt(aabb.min[0], 3)}, {fmt(aabb.min[1], 3)}, {fmt(aabb.min[2], 3)}]
                    </div>
                    <div>
                      max: [{fmt(aabb.max[0], 3)}, {fmt(aabb.max[1], 3)}, {fmt(aabb.max[2], 3)}]
                    </div>
                  </div>
                )}

                {disp.notes?.length > 0 && (
                  <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-300/20 text-xs text-amber-200/90">
                    {disp.notes.map((n, i) => (
                      <div key={i}>• {n}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Export */}
          <div className="mt-4 p-3 rounded-xl border border-white/10 bg-white/5">
            <button
              type="button"
              onClick={exportPrefab}
              className="w-full px-3 py-2 rounded-md border border-white/20 bg-emerald-400/20 hover:bg-emerald-400/30 font-bold"
            >
              Export Prefab (GLB + JSON)
            </button>
            <div className="text-xs text-sky-200/70 mt-2">
              Output: <b>kind_selection.glb</b> + <b>kind_selection.prefab.json</b>
            </div>
          </div>
        </div>
      </div>

      {/* Viewer */}
      <div className="flex-1">
        <Canvas
          gl={{ antialias: true, powerPreference: "high-performance" }}
          camera={{ position: [5, 6, 8], fov: 75, near: 0.1, far: 5000 }}
          onPointerMissed={() => {
            setSelected(null);
            setMetrics(null);
            setAabb(null);
          }}
        >
          <Scene
            nodes={nodes}
            selected={selected}
            setSelected={(o) => setSelected(o)}
            registerNode={registerNode}
            controlMode={controlMode}
            controlSpace={controlSpace}
            snapStep={snapStep}
            onTransformCommit={onTransformCommit}
          />
        </Canvas>
      </div>
    </div>
  );
}
