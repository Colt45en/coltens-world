# Avatar System V1.2 Blueprint Upgrade

V1.2 introduces:

- Bake morphs into geometry at export time
- Per-part materials (skin, clothing, hair, eyes) without mask blending requirement

This page is a drop-in upgrade on top of V1.1.

---

## What Changes in V1.2

### 1) Bake Morph Targets (Export-Time)

Goal: convert current morph weights into base geometry so exported GLB does not depend on morph targets.

Works for:

- `Mesh`
- `SkinnedMesh` (skinning retained; morph target payload removed)

Approach:

- Start from base `position` and optional `normal`
- Apply weighted deltas for each active morph
- Support both relative and absolute morph target modes
- Write baked attributes back to a cloned geometry
- Clear morph attributes and influences

### 2) Per-part Materials (Runtime + Export)

Goal: avoid mask-shader dependency for common workflows.

Part detection order:

1. `mesh.userData.part` (preferred)
2. Name heuristics fallback (`skin`, `body`, `head`, `shirt`, `pants`, `hair`, `eyes`, etc.)

Part families:

- `skin`
- `clothing`
- `hair`
- `eyes`
- `other`

---

## V1.2 File Additions and Updates

### New: `src/avatar/export/bakeMorphTargets.ts`

```ts
import * as THREE from "three";

type BakeOptions = {
  bakeNormals?: boolean;
  clampWeights?: boolean;
};

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

export function bakeMorphTargetsIntoGeometry(
  mesh: THREE.Mesh | THREE.SkinnedMesh,
  opts: BakeOptions = {}
) {
  const geometry = mesh.geometry as THREE.BufferGeometry;
  const influences = (mesh as any).morphTargetInfluences as number[] | undefined;
  const dict = (mesh as any).morphTargetDictionary as Record<string, number> | undefined;
  const morphPos = geometry.morphAttributes?.position as THREE.BufferAttribute[] | undefined;

  if (!influences || !dict || !morphPos || morphPos.length === 0) return;

  const bakeNormals = opts.bakeNormals ?? true;
  const clampWeights = opts.clampWeights ?? true;

  const basePosAttr = geometry.getAttribute("position") as THREE.BufferAttribute;
  if (!basePosAttr) return;

  const basePos = basePosAttr.array as Float32Array;
  const bakedPos = new Float32Array(basePos.length);
  bakedPos.set(basePos);

  const relative = (geometry as any).morphTargetsRelative === true;

  for (let i = 0; i < morphPos.length; i++) {
    let w = influences[i] ?? 0;
    if (clampWeights) w = clamp01(w);
    if (w === 0) continue;

    const m = morphPos[i].array as Float32Array;

    if (relative) {
      for (let k = 0; k < bakedPos.length; k++) bakedPos[k] += w * m[k];
    } else {
      for (let k = 0; k < bakedPos.length; k++) bakedPos[k] += w * (m[k] - basePos[k]);
    }
  }

  const newGeom = geometry.clone();
  newGeom.setAttribute("position", new THREE.BufferAttribute(bakedPos, 3));
  newGeom.attributes.position.needsUpdate = true;

  if (bakeNormals) {
    const baseNAttr = newGeom.getAttribute("normal") as THREE.BufferAttribute | undefined;
    const morphN = newGeom.morphAttributes?.normal as THREE.BufferAttribute[] | undefined;

    if (baseNAttr && morphN && morphN.length > 0) {
      const baseN = baseNAttr.array as Float32Array;
      const bakedN = new Float32Array(baseN.length);
      bakedN.set(baseN);

      const relN = (newGeom as any).morphTargetsRelative === true;

      for (let i = 0; i < morphN.length; i++) {
        let w = influences[i] ?? 0;
        if (clampWeights) w = clamp01(w);
        if (w === 0) continue;

        const m = morphN[i].array as Float32Array;

        if (relN) {
          for (let k = 0; k < bakedN.length; k++) bakedN[k] += w * m[k];
        } else {
          for (let k = 0; k < bakedN.length; k++) bakedN[k] += w * (m[k] - baseN[k]);
        }
      }

      for (let k = 0; k < bakedN.length; k += 3) {
        const x = bakedN[k], y = bakedN[k + 1], z = bakedN[k + 2];
        const len = Math.sqrt(x * x + y * y + z * z) || 1;
        bakedN[k] = x / len;
        bakedN[k + 1] = y / len;
        bakedN[k + 2] = z / len;
      }

      newGeom.setAttribute("normal", new THREE.BufferAttribute(bakedN, 3));
      newGeom.attributes.normal.needsUpdate = true;
    } else {
      newGeom.computeVertexNormals();
    }
  }

  newGeom.morphAttributes = {};
  (newGeom as any).morphTargetsRelative = false;

  mesh.geometry = newGeom;

  for (let i = 0; i < influences.length; i++) influences[i] = 0;
  (mesh as any).morphTargetDictionary = undefined;
  (mesh as any).morphTargetInfluences = undefined;
}
```

### New: `src/avatar/materials/buildPartMaterials.ts`

```ts
import * as THREE from "three";
import type { AvatarDNA } from "../dna";

type Part = "skin" | "clothing" | "hair" | "eyes" | "other";

const loader = new THREE.TextureLoader();

function loadTex(url?: string, srgb = true) {
  if (!url) return null;
  const t = loader.load(url);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function inferPart(mesh: THREE.Object3D): Part {
  const ud = (mesh as any).userData ?? {};
  const explicit = (ud.part as string | undefined)?.toLowerCase();
  if (explicit === "skin" || explicit === "clothing" || explicit === "hair" || explicit === "eyes") return explicit;

  const name = (mesh.name || "").toLowerCase();

  if (/(skin|body|head|face|arm|leg|torso)/.test(name)) return "skin";
  if (/(shirt|cloth|clothes|pants|jeans|dress|jacket|hoodie|top|bottom)/.test(name)) return "clothing";
  if (/(hair|brow|beard|mustache)/.test(name)) return "hair";
  if (/(eye|iris|pupil)/.test(name)) return "eyes";
  return "other";
}

export function buildMaterialsByPart(dna: AvatarDNA) {
  const skinMap = loadTex(dna.textures?.skinMap);
  const clothingMap = loadTex(dna.textures?.clothingMap);

  const skin = new THREE.MeshStandardMaterial({
    color: new THREE.Color(dna.materials.skinColor),
    roughness: Math.max(0.55, dna.materials.roughness),
    metalness: dna.materials.metalness,
    map: skinMap ?? null,
  });

  const clothing = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#ffffff"),
    roughness: 0.9,
    metalness: 0.0,
    map: clothingMap ?? null,
  });

  const hair = new THREE.MeshStandardMaterial({
    color: new THREE.Color(dna.materials.hairColor),
    roughness: 0.55,
    metalness: 0.05,
  });

  const eyes = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#ffffff"),
    roughness: 0.25,
    metalness: 0.0,
  });

  const other = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#bdbdbd"),
    roughness: 0.85,
    metalness: 0.0,
  });

  return { skin, clothing, hair, eyes, other };
}
```

### Updated: `src/avatar/AvatarModel.tsx` (runtime per-part materials)

```tsx
import { buildMaterialsByPart, inferPart } from "./materials/buildPartMaterials";

useEffect(() => {
  const mats = buildMaterialsByPart(dnaForMaterial);

  root.traverse((obj) => {
    const m = obj as THREE.Mesh;
    if (!m.isMesh) return;

    const part = inferPart(m);

    if (part === "skin") m.material = mats.skin;
    else if (part === "clothing") m.material = mats.clothing;
    else if (part === "hair") m.material = mats.hair;
    else if (part === "eyes") m.material = mats.eyes;
    else m.material = mats.other;

    m.castShadow = true;
    m.receiveShadow = false;
  });
}, [root, dnaForMaterial]);
```

### Updated: `src/avatar/export/exportGLB.ts` (bake + part materials)

```ts
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import type * as THREE from "three";
import { timeSection } from "../../perf/bench";
import { bakeMorphTargetsIntoGeometry } from "./bakeMorphTargets";
import { buildMaterialsByPart, inferPart } from "../materials/buildPartMaterials";
import type { AvatarDNA } from "../dna";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

type ExportOpts = {
  filename?: string;
  clone?: boolean;
  bakeMorphs?: boolean;
  bakeNormals?: boolean;
  applyPartMaterials?: boolean;
};

export async function exportAvatarGLB(
  group: THREE.Object3D,
  dna: AvatarDNA,
  opts: ExportOpts = {}
) {
  const filename = opts.filename ?? "avatar.glb";
  const clone = opts.clone ?? true;
  const bakeMorphs = opts.bakeMorphs ?? true;
  const bakeNormals = opts.bakeNormals ?? true;
  const applyPartMaterials = opts.applyPartMaterials ?? true;

  const exporter = new GLTFExporter();

  const { ms, out } = await timeSection("export_glb_v12", async () => {
    const target = clone ? group.clone(true) : group;
    target.updateMatrixWorld(true);

    if (applyPartMaterials) {
      const mats = buildMaterialsByPart(dna);

      target.traverse((obj) => {
        const mesh = obj as any;
        if (!mesh?.isMesh) return;
        const part = inferPart(mesh);

        if (part === "skin") mesh.material = mats.skin;
        else if (part === "clothing") mesh.material = mats.clothing;
        else if (part === "hair") mesh.material = mats.hair;
        else if (part === "eyes") mesh.material = mats.eyes;
        else mesh.material = mats.other;
      });
    }

    if (bakeMorphs) {
      target.traverse((obj) => {
        const mesh = obj as any;
        if (!mesh?.isMesh) return;

        const hasMorphs =
          mesh.morphTargetInfluences &&
          Array.isArray(mesh.morphTargetInfluences) &&
          mesh.morphTargetInfluences.length > 0 &&
          mesh.geometry?.morphAttributes?.position?.length > 0;

        if (!hasMorphs) return;

        bakeMorphTargetsIntoGeometry(mesh, { bakeNormals });
      });
    }

    const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      exporter.parse(
        target,
        (result) => resolve(result as ArrayBuffer),
        (err) => reject(err),
        { binary: true, onlyVisible: true }
      );
    });

    return arrayBuffer;
  });

  const blob = new Blob([out], { type: "model/gltf-binary" });
  downloadBlob(blob, filename);

  return { ms, bytes: out.byteLength };
}
```

### Updated: `src/App.tsx` (pass `dna` into export)

```tsx
const dna = useAvatarStore((s) => s.history.present);

const { ms, bytes } = await exportAvatarGLB(g, dna, {
  filename: "avatar.glb",
  clone: true,
  bakeMorphs: true,
  bakeNormals: true,
  applyPartMaterials: true,
});
```

---

## Best Practice: Deterministic Part Tags

Prefer explicit part tagging in source assets using `userData.part` values:

- `skin`
- `clothing`
- `hair`
- `eyes`

This removes heuristic ambiguity and makes runtime/export behavior deterministic.

---

## Benchmark Proof Targets

- Export duration stability across repeated runs
- Exported GLB usability without morph target runtime dependencies
- Reduced shading complexity from per-part materials versus mask blend path

---

## V1.3 Candidate Direction

- Texture atlas baking by part
- Mesh merge by part to reduce draw calls
- Auto LOD generation and selection pipeline
