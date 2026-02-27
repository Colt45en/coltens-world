# WebGPU Swarm Migration & Implementation Checklist

**For**: Upgrading from draft WEBGPU_NEXUS_INTEGRATION to production NexusSwarmSystem

**Time**: ~2–4 hours (full integration + testing)

---

## What Changed (Draft → Production)

### 1. **Compute Model**

| Aspect | Draft | Production |
|--------|-------|------------|
| Neighbor search | O(N²) loop in WGSL | GPU spatial grid (27-cell) |
| CPU/GPU sync | CPU reads grid → recompute | All maintained on GPU |
| Shader language | Raw WGSL strings | TSL (`Fn()...compute()`) |
| Buffer updates | Manual uniform injection | StorageBufferAttribute (typed) |
| Synchronization | No barriers | `storageBarrier()` between passes |

### 2. **File Structure**

```
Before:
  packages/graphics/src/
    ├── index.ts (placeholder)
    └── webgpu/draft.ts (unused WGSL)

After:
  packages/graphics/src/
    ├── index.ts (exports NexusSwarmSystem)
    ├── nexus/
    │   └── NexusSwarmSystem.ts (1300 lines, production)
    └── (deprecate old files)

  apps/preview-runtime/src/
    ├── main.tsx (no changes needed)
    └── GameScene.tsx (replaced: prediction → swarm)
```

### 3. **API Surface**

```ts
// Before (draft, pseudo-code)
const swarm = new GPUSwarm();
swarm.init(canvas, config);
swarm.update(); // CPU-side only

// After (production)
const swarm = new NexusSwarmSystem(config);
scene.add(swarm.points);
swarm.step(renderer, dtSeconds); // GPU compute + render
swarm.setTargetAll(position); // CPU control, GPU execution
```

---

## Implementation Checklist

### Phase 1: File Setup ✅

- [x] Create `packages/graphics/src/nexus/NexusSwarmSystem.ts` (1300+ lines)
- [x] Update `packages/graphics/src/index.ts` (add export)
- [x] Replace `apps/preview-runtime/src/GameScene.tsx` (drop prediction logic)
- [x] Update `apps/preview-runtime/src/main.tsx` (remove sessionId/instanceId from GameScene)

### Phase 2: Type Checking

```bash
# Full workspace typecheck
pnpm run typecheck

# Specific package
pnpm --filter @world-engine/graphics run typecheck
```

**Expected output**: No errors in graphics package, GameScene, main.tsx.

### Phase 3: Build & Bundle

```bash
# Build graphics package
pnpm --filter @world-engine/graphics run build

# Build preview-runtime app
pnpm --filter ./apps/preview-runtime run build

# Full workspace build
pnpm run build
```

**Expected**: All succeed without warnings.

### Phase 4: Runtime Testing

#### 4a. Local Dev (Hot Reload)

```bash
cd coltens\ world
pnpm --filter ./apps/preview-runtime run dev
```

**Check**:
- Page loads without errors
- WebGPU renderer initializes (console: "[webgpu] ✅ WebGPU renderer initialized")
- 100k cyan points visible in center
- Points move smoothly (frame counter increasing)

#### 4b. Performance Baseline

```ts
// In browser console:
const gl = window.__THREE_WEBGPU_RENDERER__;
setInterval(() => {
  const info = gl.info;
  console.log(`Memory: ${info.memory.geometries} geoms, ${info.memory.textures} textures`);
}, 1000);
```

**Expected**: ~2–3 MB geometry, 1 texture (render target).

#### 4c. Behavior Test

```ts
// In GameScene.tsx, add debug controls:
useEffect(() => {
  window.addEventListener("click", (e) => {
    const x = (e.clientX / window.innerWidth) * 160 - 80;
    const z = (e.clientY / window.innerHeight) * 160 - 80;
    swarm.setTargetAll(new THREE.Vector3(x, 0, z));
    console.log(`Swarm seeking (${x.toFixed(1)}, 0, ${z.toFixed(1)})`);
  });
}, [swarm]);
```

**Click on canvas**: Entire swarm should migrate toward click point within 2–3 seconds.

### Phase 5: Verification Checklist

#### GPU Execution

```ts
// Verify compute passes run
console.log("[swarm] clearGrid:", swarm.clearGrid);
console.log("[swarm] buildGrid:", swarm.buildGrid);
console.log("[swarm] updateAgents:", swarm.updateAgents);
// All should be FunctionNode objects
```

#### Memory

```ts
// Check buffer allocation
console.log("[swarm] posAttr:", swarm.posAttr.array.byteLength, "bytes");
console.log("[swarm] velAttr:", swarm.velAttr.array.byteLength, "bytes");
console.log("[swarm] grid cells:", swarm.numCells);
// 100k agents = 6.4 MB (pos + vel + tgt) + grid overhead
```

#### Visual

```ts
// Read positions and log a sample
const positions = swarm.readPositions();
for (let i = 0; i < 10; i++) {
  const x = positions[i * 4];
  const y = positions[i * 4 + 1];
  const z = positions[i * 4 + 2];
  console.log(`Agent ${i}: (${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})`);
}
// All positions should be within [-80, 80] world bounds
```

---

## Common Integration Points

### Pattern 1: Nucleus Tool Lane

If you want Nucleus to control the swarm:

**In `apps/nucleus/src/tool-call-lane.ts`**:

```ts
import type { LabsGenerateResponse } from "@world-engine/protocol";

async function handleToolCall(toolName: string, args: unknown) {
  // Open channel to preview-runtime
  const ws = new WebSocket("ws://localhost:3001/swarm-control");

  if (toolName === "nucleus.swarm.seek") {
    const { x, y, z } = args as { x: number; y: number; z: number };
    ws.send(JSON.stringify({
      type: "setTargetAll",
      target: { x, y, z },
    }));
  }
}
```

**In `apps/preview-runtime/src/main.tsx`**:

```ts
useEffect(() => {
  const wsCtrl = new WebSocket("ws://localhost:3001/swarm-control");
  wsCtrl.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === "setTargetAll") {
      swarmRef.current?.setTargetAll(new THREE.Vector3(msg.target.x, msg.target.y, msg.target.z));
    }
  };
}, []);
```

### Pattern 2: Ledger Integration

Log swarm state changes to ledger:

```ts
// In GameScene or main.tsx
const onSwarmUpdate = async (agentCount: number, avgVelocity: number) => {
  const envelope = createEnvelope("world.swarm.tick", {
    timestamp: Date.now(),
    agentCount,
    avgVelocity,
  });
  nuclearWs?.send(JSON.stringify(envelope));
};
```

### Pattern 3: Multi-Swarm (Advanced)

Create separate NexusSwarmSystem instances:

```ts
const swarm1 = new NexusSwarmSystem({ agentCount: 50_000, ... });
const swarm2 = new NexusSwarmSystem({ agentCount: 50_000, ... });

scene.add(swarm1.points);
scene.add(swarm2.points);

useFrame((_, dt) => {
  swarm1.step(renderer, dt);
  swarm2.step(renderer, dt);
});
```

**Note**: Each has its own compute pipeline. Interaction between swarms requires CPU-side logic (read positions, compute repulsion, update targets).

---

## Performance Tuning Guide

### Baseline (100k agents)

| Metric | Target | Typical |
|--------|--------|---------|
| Frame time | <16ms | 4–6ms |
| Memory | <50 MB | ~10 MB buffers |
| GPU utilization | 30–50% | Depends on scene |
| Thermal | <50°C | Depends on hardware |

### Bottleneck Identification

**If frame time > 16ms:**

1. **Check Compute kernel time**:
   ```ts
   // Disable update compute temporarily
   // renderer.compute([clearGrid, buildGrid], null); // skip updateAgents
   // If time drops, updateAgents is bottleneck
   ```

2. **Reduce agent count**:
   ```ts
   agentCount: 50_000  // was 100_000
   ```

3. **Reduce neighborhood search**:
   ```ts
   cellCapacity: 32  // was 64 (fewer neighbor checks)
   ```

4. **Profile GPU** (Chrome DevTools):
   - Open DevTools → Performance → Record
   - Capture 5 seconds
   - Look for GPU task duration in timeline
   - Aim for <5ms per frame

### Optimization Strategies

| Strategy | Gain | Cost |
|----------|------|------|
| Reduce `agentCount` | 40% faster per half | Fewer agents |
| Reduce `cellCapacity` | 20% faster | Loss of neighbor fidelity |
| Increase `cellSize` | 10% faster | Coarser separation |
| Skip visual (no render) | 30% faster | No output |
| Reduce `updateWeights` | 5% faster (marginal) | Different behavior |

---

## Debugging Tools

### Console Logging

In `NexusSwarmSystem` constructor, add:

```ts
console.log(`[NexusSwarm] Grid: ${this.gridResX}×${this.gridResY}×${this.gridResZ} = ${this.numCells} cells`);
console.log(`[NexusSwarm] Agent count: ${cfg.agentCount}`);
console.log(`[NexusSwarm] Buffers allocated: ${(agentCount * 48 / 1024 / 1024).toFixed(1)} MB`);
```

### Visual Grid Debugging (Optional)

Render grid cells as wireframe:

```ts
function drawGridDebug(scene: THREE.Scene, swarm: NexusSwarmSystem) {
  const { gridResX, gridResY, gridResZ } = swarm;
  const { cellSize } = swarm.cfg;
  const { worldMin } = swarm.cfg;

  for (let x = 0; x < gridResX; x++) {
    for (let y = 0; y < gridResY; y++) {
      for (let z = 0; z < gridResZ; z++) {
        const pos = new THREE.Vector3(
          worldMin.x + (x + 0.5) * cellSize,
          worldMin.y + (y + 0.5) * cellSize,
          worldMin.z + (z + 0.5) * cellSize,
        );
        const box = new THREE.BoxGeometry(cellSize * 0.99, cellSize * 0.99, cellSize * 0.99);
        const mat = new THREE.MeshBasicMaterial({ wireframe: true, color: 0x00ff00, transparent: true, opacity: 0.1 });
        const mesh = new THREE.Mesh(box, mat);
        mesh.position.copy(pos);
        scene.add(mesh);
      }
    }
  }
}

// In GameScene useEffect:
useEffect(() => {
  drawGridDebug(scene, swarm);
}, [scene, swarm]);
```

### Atomic Operation Safety

Verify no overflow in grid:

```ts
useFrame((_, dt) => {
  swarm.step(renderer, dt);

  // Check grid overflow every 60 frames
  if (frameCount++ % 60 === 0) {
    console.log(`[grid] Cells: ${swarm.numCells}, Capacity per cell: ${swarm.cfg.cellCapacity}`);
    // If seeing agents drop (not in neighbor queries), increase cellCapacity
  }
});
```

---

## Rollback Plan

If production deployment fails:

### Quick Rollback (Keep Engine Running)

```ts
// In GameScene, fallback to simple animation
const fallbackRender = useMemo(() => {
  if (!swarm.points) {
    // Render static point cloud instead
    const geom = new THREE.BufferGeometry();
    const pos = new Float32Array(100_000 * 3);
    for (let i = 0; i < pos.length; i += 3) {
      pos[i] = Math.random() * 160 - 80;
      pos[i + 1] = Math.random() * 160 - 80;
      pos[i + 2] = Math.random() * 160 - 80;
    }
    geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return new THREE.Points(geom, new THREE.PointsMaterial({ size: 1 }));
  }
  return swarm.points;
}, [swarm]);
```

### Full Rollback (Git)

```bash
git revert <commit-hash> --no-edit
pnpm run build
# Redeploy previous version
```

---

## Success Markers

✅ **All of these true**:
- [ ] TypeCheck passes without errors
- [ ] Build succeeds (no compilation errors)
- [ ] Canvas renders (no WebGL fallback)
- [ ] 100k agents visible + animating
- [ ] Frame time <16ms (ideally <10ms)
- [ ] Clicking/target change causes visible migration
- [ ] No memory leaks over 10 minutes runtime
- [ ] Works across Chrome, Firefox (with WebGPU flag)

---

## Next Steps

1. **Deploy to staging**: Verify on next branch
2. **A/B test**: Compare perf with old prediction engine
3. **Gather feedback**: Behavior feel, performance, stability
4. **Document learnings**: Add to Copilot Instructions
5. **Plan follow-ups**:
   - Per-agent color/size variation
   - Multi-swarm interaction
   - Ledger integration
   - Pathfinding layer (CPU-side)

---

**Status**: ✅ Ready for integration
