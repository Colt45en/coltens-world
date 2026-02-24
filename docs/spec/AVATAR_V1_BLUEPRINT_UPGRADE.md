# Avatar System V1 Blueprint Upgrade

## Scope

This page captures the V1 blueprint upgrade with:

1. Bottlenecks identified
2. Limiting factors fixed
3. Priority benchmark protocol + built-in bench harness

Follow-up upgrade:

- [Avatar V1.1 Blueprint Upgrade](./AVATAR_V1_1_BLUEPRINT_UPGRADE.md)

---

## 1) Bottlenecks (What Actually Limits Throughput)

### A) Hot-path CPU thrash (main limiting factor)

#### Symptoms

- Slider lag during drag
- FPS drop while editing
- React re-render spikes

#### Baseline root causes

- Rebuilding Leva schema on frequent updates
- Repeated scene traversal for morph mesh lookup
- Morph influence writes done with unnecessary repeated work

#### V1 fixes

- Cache morph target mesh and dictionary indices once
- Apply morph weights via precomputed index map
- Split state into:
  - `preview` (fast drag updates)
  - `commit` (debounced / on-release snapshot for history + export)

### B) GPU cost spikes (post-processing + shadows)

#### Symptoms

- CPU appears stable but FPS still drops
- Worse behavior on laptop/mobile GPUs

#### Root causes

- SSAO full-screen cost
- Large shadow map sizes
- Combined Bloom + SMAA + AO stack overhead

#### V1 fixes

- Quality tiers/toggles for AO/Bloom/SMAA
- Balanced defaults; AO is first disable target
- Lower default shadow map size with tuned values

### C) Export-time stalls (clone + parse)

#### Symptoms

- UI freeze on export

#### Root causes

- Deep `clone(true)` on heavy hierarchies
- Export work on main thread

#### V1 fixes

- Export live group by default (no deep clone)
- Track export duration in harness
- Keep an explicit `clone` safety option
- Preserve seam for future worker strategy

---

## 2) Benchmark Method (Priority Order)

1. Frame-time stability: avg + p95 + p99 (rAF delta)
2. Main-thread load: interaction/commit spike behavior
3. GPU pressure: draw calls, triangles, textures, post stack toggles
4. Export latency: GLB generation time
5. Memory trends: geometry/texture growth and browser memory where available

### Included in V1

- `PerfHUD` overlay (FPS, avg/p95/p99, triangles, draw calls)
- `bench.ts` (rolling percentiles + timed sections)
- Export timing metrics

---

## 3) V1 Repo-Ready Blueprint

### Install

```bash
npm create vite@latest my-avatar-app -- --template react-ts
cd my-avatar-app
npm install three @react-three/fiber @react-three/drei
npm install leva zustand
npm install @react-three/postprocessing postprocessing
```

Place avatar model at `public/avatar.glb`.

### Reference tree

```txt
src/
  App.tsx
  main.tsx
  avatar/
    AvatarScene.tsx
    AvatarModel.tsx
    dna.ts
    export/
      exportGLB.ts
    materials/
      buildAvatarMaterial.ts
  state/
    useAvatarStore.ts
  ui/
    AvatarControls.tsx
  perf/
    bench.ts
    PerfHUD.tsx
  styles.css
```

### Core architecture notes

- `AvatarModel.tsx`: cache morph mesh + index map once; no repeated traverse in hot path
- `useAvatarStore.ts`: preview vs commit split + undo/redo + debounced commit
- `AvatarScene.tsx`: quality toggles for AO/Bloom/SMAA and shadow sizing
- `exportGLB.ts`: benchmarked export timing and non-clone default
- `PerfHUD.tsx`: in-canvas benchmark overlay (must be mounted inside `<Canvas>`)

---

## 4) Key Code Snippets

### `bench.ts` (rolling frame benchmark)

```ts
export class RollingFrameBench {
  private buf: number[];
  private cap: number;
  private i = 0;
  private filled = false;
  private lastT = performance.now();
  private lastFpsT = performance.now();
  private frames = 0;
  private fps = 0;

  constructor(capacity = 240) {
    this.cap = capacity;
    this.buf = new Array(capacity).fill(16.67);
  }

  tick(now = performance.now()) {
    const dt = now - this.lastT;
    this.lastT = now;
    this.buf[this.i] = dt;
    this.i = (this.i + 1) % this.cap;
    if (this.i === 0) this.filled = true;

    this.frames += 1;
    if (now - this.lastFpsT >= 500) {
      const seconds = (now - this.lastFpsT) / 1000;
      this.fps = this.frames / Math.max(0.001, seconds);
      this.lastFpsT = now;
      this.frames = 0;
    }
  }
}
```

### `useAvatarStore.ts` pattern (preview vs commit)

```ts
setPreviewMorph(name, value) {
  set((s) => ({ previewMorphs: { ...s.previewMorphs, [name]: clamp01(value) } }));
  if (commitTimer) window.clearTimeout(commitTimer);
  commitTimer = window.setTimeout(() => {
    get().commitPreviewToHistory();
    commitTimer = null;
  }, 180);
}
```

### `AvatarModel.tsx` pattern (cached morph indices)

```ts
const cacheRef = useRef<MorphCache | null>(null);
useEffect(() => {
  cacheRef.current = buildMorphCache(root);
  const names = Object.keys(cacheRef.current?.indexByName ?? {}).sort((a, b) => a.localeCompare(b));
  onMorphNames(names);
}, [root, onMorphNames]);
```

### `AvatarScene.tsx` pattern (quality controls)

```tsx
<EffectComposer>
  {dna.postfx.smaa ? <SMAA /> : null}
  <SSAO intensity={dna.postfx.ao} radius={0.12} luminanceInfluence={0.6} />
  <Bloom intensity={dna.postfx.bloom} luminanceThreshold={0.65} luminanceSmoothing={0.2} />
</EffectComposer>
```

---

## 5) V1 Guarantees

- Hot-path CPU pressure reduced (cached morph target access + direct index writes)
- History churn reduced via preview/commit split and debounce
- GPU tuning available through explicit quality knobs
- Benchmark-first workflow embedded in runtime UX
- Material/export/state seams remain clean for V1.1 expansion

---

## 6) V1.1 Candidate Upgrades

- Preset save/load for DNA JSON + deterministic seed randomization
- Texture selection pipeline with caching
- Mask shader blend strategy (`onBeforeCompile` or `ShaderMaterial`)
- Auto quality scaler using frame-time thresholds (e.g., disable AO when p95 exceeds target)
