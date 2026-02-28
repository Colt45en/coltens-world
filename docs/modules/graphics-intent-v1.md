# Graphics Intent v1 — Deterministic Scene → RenderPacket

## Goal

Produce a **content-addressed RenderPacket** from:
- Scene snapshot
- Materials snapshot
- Viewport snapshot

A renderer (Three.js, native, headless) becomes a pure interpreter of the packet.

## Why This Structure

- Scene graphs and node hierarchies mirror common runtime scene representations (e.g., glTF scenes/nodes).
- JSON is hashed only after **canonicalization** (RFC 8785-style property sorting) to guarantee stable hashes.
- Deterministic render ordering (layer → render_order → node_id) enables multi-renderer consistency.

## Architecture

### Contracts

**Core Types:**
- `Vec3`, `Quat`, `Transform TRS` — spatial data with finite number validation
- `Primitive` — discriminated union (box, sphere, plane, cylinder) with dimensions
- `MaterialSpecV1` — color (RGBA), metallic, roughness, emissive
- `NodeSpecV1` — scene graph nodes (group, mesh, light, camera) with transform + children
- `SceneSpecV1` — collection of nodes with root node list
- `ViewportSpecV1` — resolution, background color, camera reference, tonemap + exposure

**Request/Response Shapes:**
- `SceneComposeRequestV1` / `SceneComposeResponseV1` — submit scene, get snapshot
- `MaterialBindRequestV1` / `MaterialBindResponseV1` — submit materials, get snapshot
- `ViewportDefineRequestV1` / `ViewportDefineResponseV1` — submit viewport, get snapshot
- `ViewportRenderRequestV1` / `ViewportRenderResponseV1` — compose render packet from snapshots

**Snapshot Envelope:**
- `SnapshotEnvelopeV1` — id, kind, created_at_utc, hash_sha256, canonical_json

**Ledger Events (4 types):**
- `gfx.scene_composed.v1` — points to scene snapshot hash
- `gfx.materials_bound.v1` — points to materials snapshot hash
- `gfx.viewport_defined.v1` — points to viewport snapshot hash
- `gfx.render_packet_created.v1` — points to render packet + component snapshots + command count

### Runtime Modules

#### `canonical.ts`
- **Purpose:** RFC 8785 JSON canonicalization (deterministic key sorting)
- **Exports:** `canonicalizeJson()`, `canonicalStringify()`
- **Properties:**
  - Recursively sorts object keys alphabetically
  - Disallows NaN/Infinity
  - Validates only plain objects and arrays

#### `hash.ts`
- **Purpose:** SHA-256 hashing
- **Exports:** `sha256Hex(data: string | Uint8Array): string`
- **Properties:**
  - Returns 64-character hex string
  - Deterministic across Node.js versions

#### `normalize.ts`
- **Purpose:** Quantization + stable sorting for deterministic snapshots
- **Key Functions:**
  - `quantize(n: number, step: number)` — round to nearest multiple of step (1e-6 default), avoid -0
  - `normVec3()`, `normQuat()`, `normColorRgba()` — quantize vector fields
  - `normTrs()` — normalize transform (translate, rotate, scale)
  - `stableSortById()` — sort by ID field lexicographically
  - `normalizeMaterials()` — sort by material_id, quantize color/metallic/roughness
  - `normalizeScene()` — sort nodes by node_id, sort root_nodes, sort all children alphabetically
  - `normalizeViewport()` — quantize background color + exposure
  - `normalizePrimitive()` — quantize dimension fields per primitive kind

#### `store.ts`
- **Purpose:** In-memory snapshot storage with deduplication
- **Class:** `GraphicsIntentStore`
- **Methods:**
  - `ingest(snapshot: SnapshotEnvelopeV1)` — store snapshot, assign sequence number per kind, detect collisions
  - `get(id: string)` — retrieve snapshot by content-addressed ID
  - Private `getSequence(kind)` — lookup sequence counter per snapshot kind

#### `builders.ts`
- **Purpose:** Request → snapshot transitions with ledger binding
- **Functions:**
  - `sceneCompose()` — normalize scene, create snapshot, emit ledger event
  - `materialBind()` — normalize materials, create snapshot, emit ledger event
  - `viewportDefine()` — normalize viewport, create snapshot, emit ledger event
  - `viewportRender()` — deterministic render command generation
    1. Parse scene/materials/viewport snapshots
    2. Build nodesById map, compile material lookup
    3. Walk scene graph depth-first (deterministic root order + child order)
    4. Collect mesh nodes with materials
    5. Sort commands by (layer, render_order, node_id)
    6. Assign deterministic command IDs
    7. Create render packet snapshot
    8. Emit ledger event with command count

### Tools (Nucleus Integration)

**Module:** `packages/engine/src/tools/graphics-intent-tools.ts`

**Class:** `GraphicsIntentToolkit`
- Wraps all four builders
- Binds requests to ledger emission

**Tool Functions:**
1. `scene_compose(req: SceneComposeRequestV1)` → response + ledger event
2. `material_bind(req: MaterialBindRequestV1)` → response + ledger event
3. `viewport_define(req: ViewportDefineRequestV1)` → response + ledger event
4. `viewport_render(req: ViewportRenderRequestV1)` → response + ledger event

**Nucleus Wiring:**
```typescript
// In your tool registry:
registerGraphicsIntentTools(toolRegistry, ledgerAppender);
```

## Determinism Rules

1. **Quantize floats to 1e-6** before storing:
   - Floating-point rounding errors disappear
   - `Object.is(q, -0)` check avoids -0 serialization pitfalls

2. **Stable-sort deterministically:**
   - Nodes by `node_id` (alphabetical)
   - Root nodes lexicographically
   - Children lexicographically
   - Materials by `material_id`

3. **Canonical JSON before hashing:**
   - Always sort object keys before stringifying
   - Disallow non-finite numbers

4. **Render command ordering (layer, render_order, node_id):**
   - Layer ascending (0 = background, 255 = foreground)
   - render_order ascending (local z-depth per layer)
   - node_id lexicographically (tiebreaker)

## Output Contract

### RenderPacket

```json
{
  "id": "gfx:render-packet-snap:<hash>",
  "kind": "render-packet",
  "created_at_utc": "2026-02-28T12:34:56Z",
  "hash_sha256": "<64-char hex>",
  "canonical_json": "{\"schema_version\": \"gfx-intent.v1\", \"scene_snapshot_id\": \"...\", ...}"
}
```

**Body (canonical_json parsed):**
```typescript
{
  schema_version: "gfx-intent.v1",
  scene_snapshot_id: "gfx:scene-snap:<hash>",
  materials_snapshot_id: "gfx:materials-snap:<hash>",
  viewport_snapshot_id: "gfx:viewport-snap:<hash>",
  commands: [
    {
      cmd_id: "gfx:cmd:<hash>",
      kind: "draw_primitive",
      draw_index: 0,
      node_id: "n_mesh_0",
      primitive: { kind: "box", width: 1, height: 1, depth: 1 },
      transform: { t: {...}, r: {...}, s: {...} },
      material: { ... },
      layer: 0,
      render_order: 10
    },
    ...
  ]
}
```

## Ledger Binding

Every tool call appends a thin ledger event:

- **gfx.scene_composed.v1:** scene_snapshot_id, scene_hash_sha256
- **gfx.materials_bound.v1:** materials_snapshot_id, materials_hash_sha256
- **gfx.viewport_defined.v1:** viewport_snapshot_id, viewport_hash_sha256
- **gfx.render_packet_created.v1:** render_packet_id, render_packet_hash_sha256, scene_snapshot_id, materials_snapshot_id, viewport_snapshot_id, command_count

All events include `time_utc`, `actor_id`, `request_id` for audit trail.

## Integration Example

```typescript
import { GraphicsIntentToolkit } from "@world-engine/engine/src/tools/graphics-intent-tools";

const kit = new GraphicsIntentToolkit();

// 1. Define scene
const sceneRes = kit.scene_compose({
  request_id: "req_1",
  actor_id: "alice",
  scene: {
    scene_id: "main",
    root_nodes: ["n_root"],
    nodes: [
      {
        node_id: "n_root",
        kind: "group",
        name: "Root",
        transform: { t: {x:0,y:0,z:0}, r: {x:0,y:0,z:0,w:1}, s: {x:1,y:1,z:1} },
        children: ["n_mesh"],
      },
      {
        node_id: "n_mesh",
        kind: "mesh",
        name: "My Box",
        transform: { ... },
        children: [],
        mesh: {
          primitive: { kind: "box", width: 1, height: 1, depth: 1 },
          material_id: "mat_001",
          layer: 0,
          render_order: 0,
        },
      },
    ],
  },
});

// 2. Bind materials
const mats = [
  {
    material_id: "mat_001",
    kind: "standard",
    base_color: { r: 0.8, g: 0.1, b: 0.1, a: 1 },
    metallic: 0,
    roughness: 0.5,
    emissive: { r: 0, g: 0, b: 0 },
  },
];
const matsRes = kit.material_bind({
  request_id: "req_2",
  actor_id: "alice",
  materials: mats,
});

// 3. Define viewport
const vpRes = kit.viewport_define({
  request_id: "req_3",
  actor_id: "alice",
  viewport: {
    viewport_id: "vp_1",
    width_px: 1280,
    height_px: 720,
    background: { r: 0.05, g: 0.05, b: 0.07, a: 1 },
    camera_node_id: "n_cam",
    tonemap: "aces",
    exposure: 1.0,
  },
});

// 4. Generate render packet
const renderRes = kit.viewport_render({
  request_id: "req_4",
  actor_id: "alice",
  scene_snapshot_id: sceneRes.output.scene_snapshot.id,
  materials_snapshot_id: matsRes.output.materials_snapshot.id,
  viewport_snapshot_id: vpRes.output.viewport_snapshot.id,
});

// 5. Render packet hash is deterministic:
console.log(renderRes.output.render_packet.hash_sha256);
// Same inputs → same hash across runs/devices
```

## Ledger Events (Append-Only Trail)

```typescript
sceneRes.ledger_event
// → {
//   type: "gfx.scene_composed.v1",
//   time_utc: "2026-02-28T12:34:56Z",
//   actor_id: "alice",
//   request_id: "req_1",
//   scene_snapshot_id: "gfx:scene-snap:...",
//   scene_hash_sha256: "..."
// }

fasterRes.ledger_event
// → {
//   type: "gfx.render_packet_created.v1",
//   time_utc: "2026-02-28T12:34:57Z",
//   actor_id: "alice",
//   request_id: "req_4",
//   render_packet_id: "gfx:render-packet-snap:...",
//   render_packet_hash_sha256: "...",
//   scene_snapshot_id: "...",
//   materials_snapshot_id: "...",
//   viewport_snapshot_id: "...",
//   command_count: 1
// }
```

## Known Limitations

1. **No animation support (v1):** Snapshots are static. Animated transforms require separate timeline module.
2. **No texture/image bindings (v1):** Only color + material scalars. Image binding in v2.
3. **No mesh deformation (v1):** Geometry is primitive-based only. Mesh asset support in future.
4. **No shadow/advanced lighting (v1):** Point/directional/ambient only. Advanced effects in future.
5. **No blending modes (v1):** Single pass. Advanced compositing in future.

## Testing

**Determinism Test:**
- 5 runs of scene-compose → material-bind → viewport-define → viewport-render
- Each run shuffles input arrays differently (deterministic shuffle via seeded RNG)
- Verifies all 5 runs produce identical snapshot hashes
- ✅ All hashes match → determinism proven

**Run:** `pnpm -C packages/engine run test -- --match="Graphics Intent*"`

## Next Steps

1. **Renderer integration:** Build Three.js interpreter for RenderPacket (client-side)
   - Parse `render_packet.canonical_json`
   - Loop through commands in order (layer, render_order)
   - Create Three.js mesh for each primitive + material
   - Display render packet hash in UI HUD

2. **Animation support (v2):** TimelineIntentV1 with keyframe tracks
   - Track positions, rotations, scales per node
   - Deterministic interpolation (quantized keyframes)
   - Content-addressed timeline snapshots

3. **Mesh assets (v2):** MeshIntentV1 for non-primitive geometry
   - glTF mesh references + LOD support
   - Deterministic mesh hashing (vertex + index canonical form)

4. **Advanced materials (v2):** Texture binding, PBR workflows
   - Texture ID → data URI hashing
   - Material preset library (deterministic enum)
