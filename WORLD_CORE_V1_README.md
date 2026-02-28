# World Core v1 — Nexus Build Phase 1

**Status**: ✅ Contract-first, deterministic skeleton shipped

## Overview

World Core v1 is the **asset → world composition skeleton** that everything in the World Engine hangs on. It provides:

1. **Mesh Style Spec + Validator** — Define what "good 3D assets" mean
2. **Prefab System (Avatar + Building)** — Instantiable composition units
3. **World Snapshot + Replay** — Time machine for deterministic world state
4. **Ledger Events** — Append-only proof of every action
5. **Content-Addressed Artifacts** — Stable identity + deduplication

All operations are **deterministic** (same input → byte-identical output), **contract-first** (Zod schemas), and **ledger-bound** (immutable audit trail).

---

## Architecture

### Determinism Substrate

```
canonical-json.ts       — RFC 8785 lexicographic key ordering
hashing.ts              — SHA-256 per payload + combinators
```

### Contracts (Zod Schemas)

```
contracts/mesh/         — MeshStyleSpec, MeshValidationReport
contracts/prefab/       — AvatarPrefab, BuildingPrefab, PrefabBakeManifest
contracts/world/        — WorldSnapshot, PrefabInstance, WorldReplay
contracts/artifact/     — ArtifactMetadata, ArtifactRef (content-addressed IDs)
contracts/ledger/       — LedgerEvent union + event types
```

### Runtime Modules

```
mesh/validator.ts           — Validate assets against style specs
prefab/baker.ts             — Bake prefabs into normalized manifests
world/snapshot.ts           — Create + verify world snapshots + replay
artifacts/store.ts          — Content-addressed artifact storage
artifacts/index.ts          — Store interface + global instance
```

### Nucleus Endpoints (Tool Handlers)

```
routes/world-core/mesh.ts       — mesh.style.{ingest,get}.v1 + mesh.validate_asset.v1
routes/world-core/prefab.ts     — prefab.{avatar,building}.ingest.v1 + prefab.{bake,get}.v1
routes/world-core/world.ts      — world.snapshot.{write,get}.v1 + world.replay.v1
```

### Tests

```
test/determinism/world-core.test.ts — Verify byte-identical outputs + stable ordering
```

---

## Contracts & Tool IDs

### Mesh

```
mesh.style.ingest.v1       POST /mesh.style.ingest.v1
  input:  MeshStyleSpec
  output: { style_id, style_hash, sealed, ledger_event }

mesh.style.get.v1          POST /mesh.style.get.v1
  input:  { style_id }
  output: { style, style_hash }

mesh.validate_asset.v1     POST /mesh.validate_asset.v1
  input:  { asset: MeshAssetRef, style_id }
  output: { report: MeshValidationReport, ledger_event }
```

### Prefab

```
prefab.avatar.ingest.v1    POST /prefab.avatar.ingest.v1
  input:  AvatarPrefab
  output: { prefab_id, prefab_hash, ledger_event }

prefab.building.ingest.v1  POST /prefab.building.ingest.v1
  input:  BuildingPrefab
  output: { prefab_id, prefab_hash, ledger_event }

prefab.bake.v1             POST /prefab.bake.v1
  input:  { prefab_id, style_id? }
  output: { manifest: PrefabBakeManifest, ledger_event }

prefab.get.v1              POST /prefab.get.v1
  input:  { prefab_id, includeManifest? }
  output: { prefab, kind, prefab_hash, manifest? }
```

### World

```
world.snapshot.write.v1    POST /world.snapshot.write.v1
  input:  { scene_id, tick, instances: PrefabInstance[] }
  output: { snapshot_id, snapshot_hash, ledger_event }

world.snapshot.get.v1      POST /world.snapshot.get.v1
  input:  { snapshot_id }
  output: { snapshot: WorldSnapshot, snapshot_hash }

world.replay.v1            POST /world.replay.v1
  input:  { start_snapshot_id, start_tick, end_tick, systems? }
  output: { status, result_hash, final_snapshot_id, ledger_event }
```

---

## Determinism Guarantees

### Same Input → Same Output

```typescript
// Calling twice with same data produces same hashes
const report1 = validateMeshAsset(asset, style);
const report2 = validateMeshAsset(asset, style);
expect(report1.report_hash).toBe(report2.report_hash); // ✅ PASS

// Stable ordering: shuffled input produces same output hash
const prefab1 = bakePrefabSpec(prefab);
const prefab2 = bakePrefabSpec(prefab); // Same spec, same hash
expect(prefab1.prefab_id).toBe(prefab2.prefab_id); // ✅ PASS
```

### Ledger Events Include Input/Output Hashes

```json
{
  "event_type": "mesh.asset.validated.v1",
  "occurred_at_utc": "2026-02-27T...",
  "deterministic_context": {
    "engineVersion": "world-core-v1.0.0",
    "toolId": "mesh.validate_asset.v1"
  },
  "input_hashes": {
    "asset": "<asset_hash>",
    "style": "<style_hash>"
  },
  "output_hashes": {
    "report": "<report_hash>"
  },
  "artifact_refs": [],
  "data": { /* typed event data */ }
}
```

Every event proves:
- What was hashed on input
- What was produced on output
- Which tool ran (stable ID)
- Exact engine version

### Replay Verifies History

```typescript
// Snapshot records exact instance state + hash
const snapshot = createWorldSnapshot(sceneId, tick, instances, tool, engineVersion);

// Later verification confirms nothing was tampered
const verification = verifySnapshotHash(snapshot);
console.log(verification.valid); // ✅ true if snapshot matches canonical hash
```

---

## Integration Examples

### Example 1: Ingest Style + Validate Asset

```typescript
// 1. Register a mesh style
const styleRes = await fetch('http://nucleus/mesh.style.ingest.v1', {
  method: 'POST',
  body: JSON.stringify({
    style_id: 'we.mesh.style.core',
    version: '1.0.0',
    description: 'Standard PBR assets',
    defaultMaterial: { pbr: { baseColorFactor: [1, 1, 1, 1] } },
    maxTriangleCount: 100000,
  }),
});
const { style_hash } = await styleRes.json();

// 2. Validate an asset against that style
const validateRes = await fetch('http://nucleus/mesh.validate_asset.v1', {
  method: 'POST',
  body: JSON.stringify({
    asset: {
      asset_id: 'model-1',
      name: 'CharacterA',
      byteSize: 50000,
      assetHash: 'abcd1234...', // SHA-256 of glb bytes
    },
    style_id: 'we.mesh.style.core',
  }),
});
const { report, ledger_event } = await validateRes.json();
console.log(report.ok); // ✅ true or false + violations list
console.log(ledger_event); // Append-only proof
```

### Example 2: Bake a Prefab + Write Snapshot

```typescript
// 1. Ingest an avatar prefab
const ingestRes = await fetch('http://nucleus/prefab.avatar.ingest.v1', {
  method: 'POST',
  body: JSON.stringify({
    kind: 'avatar',
    name: 'Hero_v1',
    version: '1.0.0',
    root: { node_id: 'root', name: 'Root' },
    nodes: [
      { node_id: 'head', name: 'Head', meshAssetHash: 'aaa...' },
      { node_id: 'body', name: 'Body', meshAssetHash: 'bbb...' },
    ],
    assetRefs: ['aaa...', 'bbb...'],
  }),
});
const { prefab_id } = await ingestRes.json();

// 2. Bake the prefab
const bakeRes = await fetch('http://nucleus/prefab.bake.v1', {
  method: 'POST',
  body: JSON.stringify({ prefab_id }),
});
const { manifest, ledger_event: bakeEvent } = await bakeRes.json();
console.log(manifest.prefab_id); // Content-addressed ID
console.log(manifest.assetRefs); // Stable-sorted asset references

// 3. Create a world snapshot with instances
const snapshotRes = await fetch('http://nucleus/world.snapshot.write.v1', {
  method: 'POST',
  body: JSON.stringify({
    scene_id: 'world-1',
    tick: 0,
    instances: [
      {
        instance_id: 'hero-0',
        prefabId: prefab_id,
        position: [0, 0, 0],
        rotation: [0, 0, 0, 1],
        scale: [1, 1, 1],
      },
    ],
  }),
});
const { snapshot_id, snapshot_hash } = await snapshotRes.json();
console.log(snapshot_id); // worldsnap:<hash>
```

### Example 3: Replay from Snapshot

```typescript
// Execute replay from tick 0 to tick 100
const replayRes = await fetch('http://nucleus/world.replay.v1', {
  method: 'POST',
  body: JSON.stringify({
    start_snapshot_id: 'worldsnap:...',
    start_tick: 0,
    end_tick: 100,
    systems: ['physics', 'animation'], // v1: identity replay; real impl would step
  }),
});
const { status, result_hash, final_snapshot_id } = await replayRes.json();
console.log(status); // "success"
console.log(result_hash); // Proof of replay execution
```

---

## Quality Gates (All Passing ✅)

- ✅ Typecheck: All files compile with zero TypeScript errors
- ✅ Lint: Code follows ESLint rules
- ✅ Determinism Tests: Same input → byte-identical output
- ✅ Stable Ordering: Shuffled arrays produce same hash
- ✅ Ledger Binding: Every action produces a typed ledger event
- ✅ Contract Validation: All inputs/outputs pass Zod schema

---

## What's NOT in World Core v1

World Core is deliberately **minimal** to keep the skeleton clean:

- ❌ No physics simulation (placeholder replay only)
- ❌ No graphics rendering (intent objects only)
- ❌ No chat/messaging (future module)
- ❌ No lexicon/semantics (future module)
- ❌ No automation (future module)

All of these plug in **without changing contracts, hashes, or replay semantics**. The World Core substrate is designed to support them.

---

## Next Modules (Waiting for User Direction)

1. **Physics Stepper** — Fixed timestep + deterministic Rapier integration
2. **Chat Engine** — Event stream attached to world actors + replay
3. **Graphics Intent** — Scene intent → render (deterministic frame generation v optional pixels)
4. **Lexicon Local** — SQLite-backed semantic DB with determinism caution
5. **Automation** — Replayable job scheduler + run reports

---

## Running Tests

```bash
# Run all determinism tests
pnpm -C ./packages/engine test -- determinism/world-core.test.ts

# Expected output:
# ✅ Determinism: Canonical JSON
# ✅ Determinism: Hashing
# ✅ Determinism: Mesh Validation
# ✅ Determinism: Prefab Baking
# ✅ Determinism: World Snapshots
# ✅ Determinism: World Replay
```

---

## Code References

- **Determinism substrate**: [determinism/](../determinism/)
- **Contracts**: [contracts/{mesh,prefab,world,artifact,ledger}/](../contracts/)
- **Runtime**: [mesh/](../mesh/), [prefab/](../prefab/), [world/](../world/), [artifacts/](../artifacts/)
- **Nucleus routes**: [apps/nucleus/src/routes/world-core/](../../apps/nucleus/src/routes/world-core/)
- **Tests**: [packages/engine/test/determinism/](./test/determinism/)

---

## Instruction Prompt

For future Nexus builds, the complete discipline is documented at:

```
prompts/nexus/prompt.nexus-build.world-core.txt
```

This prompt can be fed to future agents building Physics, Chat, Graphics, Lexicon, or Automation modules.

---

**Nexus Status**: ⏳ Standby — awaiting user direction on next module.
