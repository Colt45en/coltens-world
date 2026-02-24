# Avatar System V1.1 Blueprint Upgrade

## Overview

V1.1 extends the V1 blueprint with:

- Presets (save/load/rename/delete), local storage persistence, and deterministic seed randomization
- Mask shader blend (skin + clothing via grayscale mask) on top of `MeshStandardMaterial`
- Auto quality scaler driven by frame-time and render pressure signals

Follow-up upgrade:

- [Avatar V1.2 Blueprint Upgrade](./AVATAR_V1_2_BLUEPRINT_UPGRADE.md)

---

## 0) Install

If V1 dependencies are already present, no additional packages are required.

```bash
npm install three @react-three/fiber @react-three/drei
npm install leva zustand
npm install @react-three/postprocessing postprocessing
```

Optional textures under `public/`:

- `public/skin.jpg`
- `public/clothing.jpg`
- `public/mask.png` (grayscale: white = clothing, black = skin)

---

## 1) New and Updated File Tree

```txt
src/
  avatar/
    materials/
      buildAvatarMaterial.ts       (UPDATED: mask shader + texture support)
  perf/
    AutoQualityScaler.tsx          (NEW)
  state/
    presets.ts                     (NEW)
    useAvatarStore.ts              (UPDATED: presets + runtime quality overrides + seeded randomize)
  ui/
    AvatarControls.tsx             (UPDATED: presets UI + seed randomize + mask inputs)
  avatar/AvatarScene.tsx           (UPDATED: include scaler + runtime overrides)
```

---

## 2) New: `src/state/presets.ts`

### Purpose

- Persist preset collections in local storage
- Validate and sanitize loaded data
- Provide deterministic enough local ID generation

```ts
import type { AvatarDNA } from "../avatar/dna";

export type Preset = {
  id: string;
  name: string;
  dna: AvatarDNA;
  createdAt: number;
  updatedAt: number;
};

const KEY = "we.avatar.presets.v1";

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function loadPresets(): Preset[] {
  const data = safeParse<Preset[]>(localStorage.getItem(KEY));
  if (!data || !Array.isArray(data)) return [];
  return data
    .filter((p) => p && typeof p.id === "string" && typeof p.name === "string" && p.dna)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function savePresets(presets: Preset[]) {
  localStorage.setItem(KEY, JSON.stringify(presets));
}

export function newId() {
  return `p_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}
```

---

## 3) Updated: `src/state/useAvatarStore.ts`

### V1.1 additions

- Preset CRUD operations
- `seedRandomize()` with deterministic PRNG
- `runtimeQuality` overrides excluded from undo/redo history

```ts
// Highlights only (full implementation from upgrade spec)

type RuntimeQuality = {
  aoEnabled?: boolean;
  smaaEnabled?: boolean;
  bloomScale?: number;
  shadowsEnabled?: boolean;
  shadowMapSize?: 1024 | 2048;
};

// deterministic PRNG
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// state shape additions
// presets, presetSelectedId, seed, runtimeQuality

// operations added
// saveCurrentAsPreset, loadPreset, renamePreset, deletePreset
// setSeed, seedRandomize
// setRuntimeQuality, clearRuntimeQuality
```

---

## 4) Updated: `src/avatar/materials/buildAvatarMaterial.ts`

### Mask shader seam

- Keeps PBR behavior with `MeshStandardMaterial`
- Uses mask texture (red channel) to mix skin and clothing layers
- Supports both texture-driven and color fallback paths
- Uses `onBeforeCompile` for low-friction incremental adoption

```ts
// Design summary
// - load skin/clothing/mask textures
// - create MeshStandardMaterial as base
// - if mask exists, inject uniforms and map-fragment blend logic
// - blend = mix(skinSample, clothSample, mask.r)
// - mark material for update when defines/uniform contract changes
```

---

## 5) New: `src/perf/AutoQualityScaler.tsx`

### Policy (degrade order)

1. Disable SSAO
2. Reduce bloom
3. Disable shadows
4. Lower shadow map size
5. Disable SMAA (last resort)

### Trigger model

- Monitors p95 frame time over rolling windows
- Degrades after sustained bad windows
- Recovers slowly under sustained good windows
- Includes guard for heavy-scene conditions using draw calls and triangle count

```tsx
// Design summary
// - useFrame + RollingFrameBench
// - tiered runtime quality via setRuntimeQuality
// - hysteresis: separate degrade/recover thresholds and sample counts
```

---

## 6) Updated: `src/avatar/AvatarScene.tsx`

### Integration points

- Merges authored DNA quality with runtime overrides from scaler
- Mounts `PerfHUD` and `AutoQualityScaler` inside `Canvas`
- Gates post-processing passes via runtime policy

```tsx
// Effective values derive from:
// shadowsEnabled = runtimeQ.shadowsEnabled ?? dna.quality.shadows
// shadowMapSize = runtimeQ.shadowMapSize ?? dna.quality.shadowMapSize
// aoEnabled = runtimeQ.aoEnabled ?? true
// smaaEnabled = runtimeQ.smaaEnabled ?? dna.postfx.smaa
// bloomScale = runtimeQ.bloomScale ?? 1
```

---

## 7) Updated: `src/ui/AvatarControls.tsx`

### V1.1 UI additions

- Preset selector + save/rename/delete actions
- Seed input + deterministic randomize action
- Texture path controls (`skinMap`, `clothingMap`, `maskMap`) stored in DNA

```tsx
// Design summary
// - add presets panel (top)
// - keep action bar (bottom)
// - extend Leva schema with texture controls
```

---

## 8) Required DNA Contract Tweak (`src/avatar/dna.ts`)

Add texture slots to DNA and defaults:

```ts
textures?: {
  skinMap?: string;
  clothingMap?: string;
  maskMap?: string;
};
```

Recommended defaults:

```ts
textures: {
  skinMap: "/skin.jpg",
  clothingMap: "/clothing.jpg",
  maskMap: "/mask.png",
}
```

---

## 9) AvatarModel Hook Change

Update material construction call to pass texture payload:

```ts
const mat = buildAvatarMaterial(dnaForMaterial, dnaForMaterial.textures);
```

---

## V1.1 Outcomes

- Auto-scaling controls p95 frame-time regressions under load
- Presets improve iteration speed and repeatability
- Seed randomization enables deterministic variant generation
- Mask shader provides practical single-mesh skin/clothing separation without a hard mesh split

---

## Suggested V1.2 Direction

- Morph bake option during export
- Per-part material split (skin/clothing meshes)
- Worker-driven heavy geometry experiments while preserving UI responsiveness
