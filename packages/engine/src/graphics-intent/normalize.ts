import type {
    ColorRgba,
    MaterialSpecV1,
    NodeSpecV1,
    Primitive,
    SceneSpecV1,
    TransformTrs,
    Vec3,
    ViewportSpecV1,
} from "../contracts/graphics-intent.v1";

export function quantize(n: number, step: number): number {
  if (!Number.isFinite(n)) throw new Error(`Non-finite number: ${n}`);
  // Deterministic rounding to nearest step
  const q = Math.round(n / step) * step;
  // Avoid -0
  return Object.is(q, -0) ? 0 : q;
}

export function normVec3(v: Vec3, step: number): Vec3 {
  return { x: quantize(v.x, step), y: quantize(v.y, step), z: quantize(v.z, step) };
}

export function normQuat(
  q: { x: number; y: number; z: number; w: number },
  step: number
) {
  return {
    x: quantize(q.x, step),
    y: quantize(q.y, step),
    z: quantize(q.z, step),
    w: quantize(q.w, step),
  };
}

export function normTrs(t: TransformTrs, step: number): TransformTrs {
  return {
    t: normVec3(t.t, step),
    r: normQuat(t.r, step),
    s: normVec3(t.s, step),
  };
}

export function normColorRgba(c: ColorRgba, step: number): ColorRgba {
  const clamp01 = (x: number) => Math.min(1, Math.max(0, quantize(x, step)));
  return {
    r: clamp01(c.r),
    g: clamp01(c.g),
    b: clamp01(c.b),
    a: clamp01(c.a),
  };
}

export function stableSortById<T extends Record<string, unknown>>(
  items: T[],
  idKey: keyof T
): T[] {
  return [...items].sort((a, b) => {
    const ai = String(a[idKey]);
    const bi = String(b[idKey]);
    return ai < bi ? -1 : ai > bi ? 1 : 0;
  });
}

export function normalizeMaterials(
  materials: MaterialSpecV1[],
  step: number
): MaterialSpecV1[] {
  const sorted = stableSortById(materials, "material_id");
  return sorted.map((m) => ({
    ...m,
    base_color: normColorRgba(m.base_color, step),
    metallic: quantize(m.metallic, step),
    roughness: quantize(m.roughness, step),
    emissive: {
      r: quantize(m.emissive.r, step),
      g: quantize(m.emissive.g, step),
      b: quantize(m.emissive.b, step),
    },
  }));
}

export function normalizeScene(scene: SceneSpecV1, step: number): SceneSpecV1 {
  const nodesSorted = stableSortById(scene.nodes, "node_id").map((n) => normalizeNode(n, step));
  const rootSorted = [...scene.root_nodes].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return {
    scene_id: scene.scene_id,
    root_nodes: rootSorted,
    nodes: nodesSorted,
  };
}

function normalizeNode(node: NodeSpecV1, step: number): NodeSpecV1 {
  const childrenSorted = [...node.children].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const base: NodeSpecV1 = {
    ...node,
    transform: normTrs(node.transform, step),
    children: childrenSorted,
  };

  if (base.mesh) {
    return {
      ...base,
      mesh: {
        ...base.mesh,
        // primitive fields are already finite validated; quantize dimensions:
        primitive: normalizePrimitive(base.mesh.primitive, step),
      },
    };
  }

  if (base.light) {
    return {
      ...base,
      light: {
        ...base.light,
        color: {
          r: quantize(base.light.color.r, step),
          g: quantize(base.light.color.g, step),
          b: quantize(base.light.color.b, step),
        },
        intensity: quantize(base.light.intensity, step),
      },
    };
  }

  if (base.camera) {
    return {
      ...base,
      camera: {
        ...base.camera,
        fov_deg:
          base.camera.fov_deg !== undefined ? quantize(base.camera.fov_deg, step) : undefined,
        near: base.camera.near !== undefined ? quantize(base.camera.near, step) : undefined,
        far: base.camera.far !== undefined ? quantize(base.camera.far, step) : undefined,
        left: base.camera.left !== undefined ? quantize(base.camera.left, step) : undefined,
        right: base.camera.right !== undefined ? quantize(base.camera.right, step) : undefined,
        top: base.camera.top !== undefined ? quantize(base.camera.top, step) : undefined,
        bottom:
          base.camera.bottom !== undefined ? quantize(base.camera.bottom, step) : undefined,
      },
    };
  }

  return base;
}

function normalizePrimitive(p: Primitive, step: number): Primitive {
  // Keep it explicit + safe; no "smart" reflection.
  if (p.kind === "box") {
    return {
      kind: "box" as const,
      width: quantize(p.width, step),
      height: quantize(p.height, step),
      depth: quantize(p.depth, step),
    };
  }
  if (p.kind === "sphere") {
    return {
      kind: "sphere" as const,
      radius: quantize(p.radius, step),
      width_segments: p.width_segments,
      height_segments: p.height_segments,
    };
  }
  if (p.kind === "plane") {
    return {
      kind: "plane" as const,
      width: quantize(p.width, step),
      height: quantize(p.height, step),
    };
  }
  if (p.kind === "cylinder") {
    return {
      kind: "cylinder" as const,
      radius_top: quantize(p.radius_top, step),
      radius_bottom: quantize(p.radius_bottom, step),
      height: quantize(p.height, step),
      radial_segments: p.radial_segments,
    };
  }
  const _exhaustive: never = p;
  throw new Error(`Unknown primitive kind: ${String(_exhaustive)}`);
}

export function normalizeViewport(vp: ViewportSpecV1, step: number): ViewportSpecV1 {
  return {
    ...vp,
    background: normColorRgba(vp.background, step),
    exposure: quantize(vp.exposure, step),
  };
}
