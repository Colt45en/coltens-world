# Avatar Compilation & Pipeline Plan 🎭

## Executive Summary

Build a **deterministic, production-grade avatar compilation and delivery pipeline** that:
- ✅ Compiles avatar DNA → optimized GLB models
- ✅ Generates atlases + LODs for performance
- ✅ Batches exports for multiple avatars
- ✅ Integrates with Nucleus ledger for deterministic replay
- ✅ Supports real-time preview in avatar-lab UI
- ✅ Deploys avatars as content-addressed assets

---

## Current State Analysis

### ✅ What Exists

**Avatar Lab UI** (`apps/avatar-lab/`)
- Vite + React + Three.js interactive builder
- Real-time avatar morphing + material editing
- DNA storage (Zustand)
- Preset system (load/save/undo)
- Export button → GLB (single avatar only)

**Avatar System Components**
```
apps/avatar-lab/src/avatar/
├── AvatarModel.tsx          [3D model mesh + morphs]
├── AvatarScene.tsx          [Canvas + renderer]
├── dna.ts                   [DNA schema + defaults]
├── materials/
│   └── buildPartMaterials.ts [Material definitions]
└── export/
    ├── exportGLB.ts         [Single avatar export]
    ├── bakeMorphTargets.ts  [Morph optimization]
    ├── atlas/
    │   └── bakeAtlas.ts     [Texture atlas generation]
    ├── lod/
    │   └── buildLOD.ts      [Level of detail pipeline]
    └── merge/               [Merge parts by group]
```

**State Management**
- `useAvatarStore.ts` - Zustand store (history, presets, morphs)
- `presets.ts` - Preset save/load

### ❌ What's Missing

| Component | Status | Impact |
|-----------|--------|--------|
| Batch compilation | ❌ Missing | Can't compile multiple avatars |
| CLI tools | ❌ Missing | No headless export |
| Asset registry | ❌ Missing | No way to track exports |
| Deterministic seeding | ❌ Missing | Can't regenerate identical avatars |
| Texture generation | ❌ Missing | No procedural skin/clothing textures |
| Animation export | ❌ Missing | Avatars have no animations |
| WebAssembly morphing | ❌ Missing | CPU bottleneck for batch operations |
| CI/CD integration | ❌ Missing | No automated builds |
| Content addressing | ❌ Missing | No hash-based asset identity |

---

## Architecture: Full Avatar Pipeline

```
┌───────────────────────────────────────────────────────────────┐
│                    AVATAR DEFINITION LAYER                     │
├───────────────────────────────────────────────────────────────┤
│ DNA JSONs + Texture configs + Metadata                         │
│ (deterministic input for seeded generation)                    │
└─────────────────┬───────────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────────┐
│                  AVATAR COMPILER LAYER                          │
├───────────────────────────────────────────────────────────────┤
│ 1. Procedural Texture Generation (Perlin noise + colorize)    │
│ 2. Mesh Morphing (apply DNA → morph targets)                  │
│ 3. Material Assembly (colors + textures + properties)         │
│ 4. Atlas Baking (pack all textures into single image)         │
│ 5. LOD Generation (3-4 detail levels)                         │
│ 6. Merge & Optimize (combine meshes, clean normals)           │
│ 7. GLB Serialization (pack to binary)                         │
│ 8. Hash Computation (content-address the asset)               │
└─────────────────┬───────────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────────┐
│                  ASSET REGISTRY LAYER                           │
├───────────────────────────────────────────────────────────────┤
│ Metadata JSON:                                                  │
│ ├─ avatar_id                                                   │
│ ├─ content_hash (SHA-256 of GLB)                               │
│ ├─ dna_hash (SHA-256 of DNA input)                             │
│ ├─ texture_hashes                                              │
│ ├─ bounds                                                      │
│ ├─ poly_count                                                  │
│ └─ compilation_timestamp                                       │
└─────────────────┬───────────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────────┐
│                  DELIVERY LAYER                                 │
├───────────────────────────────────────────────────────────────┤
│ 1. Local filesystem (dev)                                      │
│ 2. Azure Blob Storage (prod)                                   │
│ 3. CDN cache (Vimeo / Cloudflare)                              │
│ 4. Streaming (gzip → client)                                  │
└───────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────┐
│                  INTEGRATION LAYER                             │
├───────────────────────────────────────────────────────────────┤
│ 1. Nucleus Ledger (record compilation as event)               │
│ 2. Agent-Server (avatar generation job)                       │
│ 3. IDE Web (display + manage avatars)                         │
│ 4. Runtime (load + render avatars)                            │
└───────────────────────────────────────────────────────────────┘
```

---

## Pipeline Phases

### Phase 1: Compilation Core (Weeks 1-2)

**Goal**: Build local, headless avatar compiler

**Tasks**:

1. **Create `packages/avatar-compiler`** (entry point)
   - Export: `compileAvatar(dna: AvatarDNA) → CompiledAsset`
   - Export: `compileBatch(avatars: AvatarDNA[]) → CompiledAsset[]`
   - Error handling + progress callbacks

2. **Extract avatar rendering logic** from Three.js to pure functions
   - Create `createAvatarMesh(dna) → BufferGeometry`
   - Create `applyMorphs(mesh, dna) → void`
   - Create `buildMaterials(dna) → Material[]`
   - **Avoid**: Document.createElement, window, DOM references

3. **Implement texture pipeline**
   - Procedural skin (Perlin noise + color shift)
   - Procedural clothing (fabric pattern + dye)
   - Mask/scar generation
   - Output: Canvas → PNG

4. **Implement atlas baking**
   - `bakeAtlas(materials[], size: number) → { texture: Texture, uvMaps: UVMap[] }`
   - Bin-packing algorithm (maximize space, minimize wasted pixels)
   - Mipmap generation

5. **Implement LOD generation**
   - 4 detail levels: full → medium → low → ultra-low
   - `generateLOD(mesh, targetPolyPercent) → BufferGeometry`
   - Preserve silhouette + important features

6. **Implement GLB export**
   - `exportGLB(mesh, textures, metadata) → Buffer`
   - Compress geometry (quantize positions)
   - Embed textures as base64 or separate

7. **Content addressing**
   - `hashAsset(glb: Buffer) → string` (SHA-256)
   - `hashDNA(dna: AvatarDNA) → string` (canonical JSON hash)
   - Deterministic: same input → same hash

**Deliverables**:
- ✅ `packages/avatar-compiler/` (300 lines)
- ✅ Compiler tests (determinism verified)
- ✅ Benchmark: compile speed (target: <1s per avatar)
- ✅ Output: GLB + metadata JSON

---

### Phase 2: Batch & CLI (Weeks 2-3)

**Goal**: Enable headless compilation of many avatars

**Tasks**:

1. **Create CLI tool** (`scripts/avatar/compile.mjs`)
   - Input: JSON array of avatars + DNA
   - Output: `avatars/` directory with GLBs + metadata
   - Flags:
     - `--input <file>` (JSON)
     - `--output <dir>` (default: ./avatars)
     - `--parallel <n>` (default: 1)
     - `--lod-levels <n>` (default: 4)
     - `--atlas-size <px>` (default: 2048)
   - Progress: `[1/100] username_avatar...`
   - Timing: `Compiled 100 avatars in 45s`

2. **Implement batch coordination**
   - Queue management (prevent mem exhaustion)
   - Worker pool (Node.js cluster module)
   - Error recovery (skip bad avatars, summarize failures)

3. **Create asset registry**
   - Write `avatars/registry.json`
   - Fields: `{ avatar_id, content_hash, dna_hash, poly_count, file_size, ... }`
   - Index by `content_hash` for dedup

4. **Add validation pass**
   - Check DNA valid (all fields present)
   - Check output GLB valid (can parse)
   - Check bounds reasonable (not zero-sized)

**Deliverables**:
- ✅ `scripts/avatar/compile.mjs` (200 lines)
- ✅ Example input: `scripts/avatar/examples/avatars.json` (10 sample DNAs)
- ✅ Registry format spec
- ✅ CI integration (GitHub Actions)

---

### Phase 3: Asset Storage & Distribution (Weeks 3-4)

**Goal**: Store avatars durably, serve efficiently

**Tasks**:

1. **Local storage** (development)
   - `runtime/avatars/` directory
   - Organized: `avatars/{content_hash}.glb`
   - Metadata: `avatars/{content_hash}.json`
   - Index: `avatars/index.json` (registry)

2. **Azure Blob Storage** (production)
   - Create container: `avatars-prod`
   - Upload: `glb/` + `metadata/` + `index.json`
   - Enable CDN (Vimeo, Cloudflare)
   - Compression: gzip on upload

3. **Registry service** (query interface)
   - Endpoint: `GET /avatars/index` → full registry
   - Endpoint: `GET /avatars/{content_hash}` → redirect to CDN
   - Cache: CloudFlare (365 day TTL, immutable)

4. **Ledger integration**
   - Event type: `avatar.compiled`
   - Event payload: `{ avatar_id, content_hash, dna_hash, file_size, compile_time_ms }`
   - Append to ledger on successful compilation

**Deliverables**:
- ✅ Azure storage setup (terraform or manual)
- ✅ Registry API endpoints
- ✅ CDN configuration
- ✅ Ledger event schema

---

### Phase 4: IDE Integration (Weeks 4-5)

**Goal**: Wire avatar compiler into IDE workflow

**Tasks**:

1. **Avatar Lab UI enhancements**
   - Button: "Batch Export" (select multiple presets)
   - Modal: upload DNA JSON file
   - Progress: live compilation status
   - Download: batch ZIP (all GLBs + metadata)

2. **Avatar Manager UI** (new page in IDE)
   - List all avatars (registry)
   - View metadata (poly count, size, hash)
   - Download link (redirect to CDN)
   - Recompile: trigger CLI
   - Delete: soft delete (archive metadata)

3. **Nucleus integration**
   - New route: `POST /avatars/compile`
   - Payload: `{ dnas: AvatarDNA[], metadata: {} }`
   - Async job: queue in agent-server
   - Response: `{ job_id }`
   - Polling: `GET /avatars/compile/{job_id}` (status)

4. **Agent-server job system**
   - Register job type: `avatar:compile`
   - Handler: call CLI tool
   - Store result in registry
   - Emit ledger event

**Deliverables**:
- ✅ Avatar Lab UI updates (component)
- ✅ Avatar Manager page (React)
- ✅ Nucleus compilation endpoint
- ✅ Agent-server job handler

---

### Phase 5: Runtime Integration (Weeks 5-6)

**Goal**: Load + render compiled avatars

**Tasks**:

1. **Loader implementation**
   - Loaders.KTX2Loader (compressed textures)
   - Loaders.GLTFLoader (avatar GLB)
   - Async loading + progress
   - Caching (in-memory + IndexedDB)

2. **Material reconstruction**
   - Read material metadata from JSON
   - Bind textures to materials (UV maps from LOD)
   - Apply post-processing (bloom, AO)

3. **Animation system**
   - Idle animation (slight sway)
   - Walk cycle (basic locomotion)
   - Emote animations
   - Export as separate GLB or embed in main

4. **Performance optimization**
   - Automatically select LOD based on distance
   - Frustum culling (don't render off-screen)
   - Mesh instancing (many avatars on screen)
   - Texture streaming (load lower-res while fetching high-res)

**Deliverables**:
- ✅ `AvatarLoader.ts` (300 lines)
- ✅ `AvatarShader.glsl` (material reconstruction)
- ✅ LOD selection logic
- ✅ Performance benchmarks

---

### Phase 6: Quality & Determinism (Weeks 6-7)

**Goal**: Ensure reproducibility + reliability

**Tasks**:

1. **Determinism testing**
   - Compile same DNA 10× → verify identical GLBs
   - Hash consistency: same DNA → same hash
   - Cross-platform (Windows, macOS, Linux)
   - Test vectors: edge cases (min/max morph values)

2. **Performance profiling**
   - Benchmark: single avatar (target: <500ms)
   - Benchmark: 100 avatars parallel (target: <60s)
   - Memory profiling: peak usage
   - Report: compare before/after optimizations

3. **Fuzzing**
   - Random DNA inputs (valid range)
   - Graceful failure: invalid values → defaults
   - Edge cases: extreme morphs, zero-size models
   - Stress test: 1000 avatars

4. **Documentation**
   - Avatar DNA schema (JSON schema file)
   - Compiler API (API doc)
   - CLI reference (`compile --help`)
   - Troubleshooting guide

**Deliverables**:
- ✅ Test suite (100+ tests)
- ✅ Performance report (benchmarks)
- ✅ Documentation files

---

### Phase 7: CI/CD & Automation (Week 7)

**Goal**: Automate compilation in pipeline

**Tasks**:

1. **GitHub Actions workflow** (`workflows/avatar-compile.yml`)
   - Trigger: on commit to `avatars/` or CLI changes
   - Jobs:
     - Test: determinism + fuzz
     - Compile: 100 test avatars
     - Upload: to Azure (if prod)
     - Report: benchmark comparison

2. **Commit hooks**
   - Pre-commit: lint avatar JSON
   - Pre-push: compile + validate

3. **Scheduled jobs**
   - Nightly: compile reference set (100 avatars)
   - Report: benchmark trend

4. **Artifact storage**
   - GitHub: store test outputs
   - Azure: store production avatars

**Deliverables**:
- ✅ GitHub Actions workflows
- ✅ Artifact management scripts

---

## Task Breakdown (Implementation Order)

| # | Task | Duration | Depends On | Owner |
|---|------|----------|-----------|-------|
| 1 | Extract renderer logic (no-DOM) | 2d | Nothing | You |
| 2 | Implement texture pipeline (Perlin) | 2d | #1 | You |
| 3 | Build atlas baker | 2d | #2 | You |
| 4 | Build LOD generator | 2d | #1 | You |
| 5 | Build content hashing | 1d | #4 | You |
| 6 | Create avatar-compiler package | 1d | #1-5 | You |
| 7 | Write compiler tests (determinism) | 2d | #6 | You |
| 8 | Create CLI tool | 1d | #6 | You |
| 9 | Implement batch coordination | 2d | #8 | You |
| 10 | Create asset registry | 1d | #9 | You |
| 11 | Add Nucleus endpoint | 1d | #10 | You |
| 12 | Wire agent-server job | 1d | #11 | You |
| 13 | Avatar Manager UI | 2d | #12 | You |
| 14 | Avatar Lab UI batch export | 1d | #12 | You |
| 15 | Implement AvatarLoader | 2d | #6 | You |
| 16 | Add LOD selection logic | 1d | #15 | You |
| 17 | Create test vectors | 1d | #7 | You |
| 18 | Performance profiling | 2d | #9 | You |
| 19 | Write documentation | 2d | #18 | You |
| 20 | GitHub Actions workflow | 1d | #19 | You |

**Total Estimate**: ~6-7 weeks (5 days/week, 8 hours/day)

---

## Implementation Checklist

### Phase 1: Compilation Core

- [ ] Create `packages/avatar-compiler/package.json`
- [ ] Create `packages/avatar-compiler/src/index.ts`
- [ ] Export `compileAvatar(dna) → CompiledAsset`
- [ ] Extract Three.js logic → pure functions
- [ ] Implement procedural texture generation
- [ ] Implement atlas baking
- [ ] Implement LOD generation
- [ ] Implement GLB export
- [ ] Implement content hashing (SHA-256)
- [ ] Write unit tests
- [ ] Test determinism (same input → same output)

### Phase 2: Batch & CLI

- [ ] Create `scripts/avatar/compile.mjs`
- [ ] Implement batch coordination (queue + workers)
- [ ] Create asset registry format
- [ ] Write example DNAs
- [ ] Add CLI flags (parallel, LOD levels, atlas size)
- [ ] Add error handling + reporting
- [ ] Test with 100 avatars

### Phase 3: Storage & Distribution

- [ ] Setup Azure Blob Storage
- [ ] Create registry API (Nucleus endpoints)
- [ ] Implement CDN caching
- [ ] Add Ledger event emission
- [ ] Test upload/download speed

### Phase 4: IDE Integration

- [ ] Update Avatar Lab UI
- [ ] Create Avatar Manager page
- [ ] Add Nucleus compilation endpoint
- [ ] Add agent-server job handler
- [ ] Test end-to-end (UI → compile → download)

### Phase 5: Runtime

- [ ] Create AvatarLoader
- [ ] Implement material reconstruction
- [ ] Add animation system
- [ ] Optimize performance
- [ ] Test on all target platforms

### Phase 6: Quality

- [ ] Run determinism tests
- [ ] Profile performance
- [ ] Fuzz testing
- [ ] Write documentation

### Phase 7: CI/CD

- [ ] Create GitHub Actions workflow
- [ ] Setup artifact storage
- [ ] Test automated compile
- [ ] Monitor benchmark trends

---

## Success Criteria

### Functional

- [ ] **Single Avatar Compile**: `compile(dna) → GLB` in <500ms
- [ ] **Batch Processing**: 100 avatars in <60s (parallel)
- [ ] **Determinism**: Same DNA → identical GLB hash (10 runs)
- [ ] **Export Quality**: GLB loads correctly in three.js viewer
- [ ] **LOD Validation**: All 4 LOD levels render correctly
- [ ] **Asset Registry**: Complete metadata for all avatars
- [ ] **CLI Tool**: `compile.mjs --input avatars.json --output avatars/`
- [ ] **Nucleus Integration**: `/avatars/compile` endpoint works
- [ ] **Registry API**: Can query avatar by content_hash
- [ ] **CI Pipeline**: Automated compile on commit

### Performance

- [ ] Single compile: <500ms
- [ ] Batch 100: <60s parallel
- [ ] Memory peak: <500MB
- [ ] GLB file size: <3MB (with atlas + textures)
- [ ] Load time: <2s (3G network)

### Quality

- [ ] 100% test coverage for compiler
- [ ] Determinism verified (cross-platform)
- [ ] Fuzz tested (edge cases + invalid inputs)
- [ ] Performance benchmarked (before/after)
- [ ] Documentation complete (API + CLI + troubleshooting)

### Integration

- [ ] Ledger event recorded for each compilation
- [ ] Agent-server can trigger compilation
- [ ] IDE shows compilation progress
- [ ] Runtime loads compiled avatars
- [ ] CDN caches avatars (365 days)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Three.js rendering in Node.js | HIGH | Use Headless GL or extract pure math |
| Memory explosion (batch mode) | HIGH | Queue + worker pool, profile early |
| Non-determinism (floating point) | HIGH | Canonical JSON hash, test 10x |
| Performance regression | MEDIUM | Benchmark before/after, CI gate |
| Asset storage costs | LOW | Implement deduplication, archive old |
| Cross-platform differences | MEDIUM | Test on 3 platforms, use standard libs |

---

## Next Immediate Steps

1. **Week 1 Planning**:
   - [ ] Review this plan with team
   - [ ] Identify blockers
   - [ ] Assign ownership

2. **Start Phase 1 (This Week)**:
   - [ ] Branch: `feature/avatar-compiler`
   - [ ] Create `packages/avatar-compiler/`
   - [ ] Extract render logic from Three.js
   - [ ] Implement `compileAvatar()` function
   - [ ] Write determinism tests

3. **Create Prototype CLI**:
   - [ ] Quick `compile.mjs` (Phase 2 appetizer)
   - [ ] Test with 5 sample avatars
   - [ ] Measure compile time

4. **Document & Share**:
   - [ ] Share this plan with stakeholders
   - [ ] Get feedback on architecture
   - [ ] Finalize scope (phases to accelerate/defer)

---

## Files to Create

### Phase 1
- `packages/avatar-compiler/package.json`
- `packages/avatar-compiler/src/index.ts`
- `packages/avatar-compiler/src/compiler.ts`
- `packages/avatar-compiler/src/textures.ts`
- `packages/avatar-compiler/src/atlas.ts`
- `packages/avatar-compiler/src/lod.ts`
- `packages/avatar-compiler/src/export.ts`
- `packages/avatar-compiler/src/hash.ts`
- `packages/avatar-compiler/test/compiler.test.ts`
- `packages/avatar-compiler/test/determinism.test.ts`

### Phase 2
- `scripts/avatar/compile.mjs`
- `scripts/avatar/examples/avatars.json`

### Phase 3
- `apps/nucleus/src/routes/avatars.ts`
- `apps/agent-server/src/jobs/compile-avatars.ts`

### Phase 4
- `apps/avatar-lab/src/ui/BatchExportModal.tsx`
- `apps/ide-web/src/pages/AvatarManagerPage.tsx`

### Phase 5
- `packages/engine/src/loaders/AvatarLoader.ts`

### Phase 6-7
- Tests, docs, CI workflows

---

## Estimated File Growth

| Package | Files | Lines | Purpose |
|---------|-------|-------|---------|
| `avatar-compiler` | 8 | 1,500 | Core compilation engine |
| `scripts/avatar` | 3 | 500 | CLI + examples |
| Nucleus routes | 1 | 200 | API endpoints |
| Agent-server jobs | 1 | 200 | Job handler |
| IDE pages | 2 | 400 | UI components |
| Runtime loader | 1 | 300 | GLB loading + rendering |
| Tests | 5 | 1,000 | Coverage + determinism |
| Docs | 3 | 500 | API + CLI + troubleshooting |
| **TOTAL** | **24** | **4,600** | **Full pipeline** |

---

## Success Looks Like

**Week 1-2**: ✅ You can compile a single avatar to GLB deterministically
**Week 2-3**: ✅ You can batch compile 100 avatars in <1min via CLI
**Week 3-4**: ✅ Avatars are stored + indexed + accessible via API
**Week 4-5**: ✅ IDE has UI for managing avatars + batch export
**Week 5-6**: ✅ Runtime can load + render compiled avatars smoothly
**Week 6-7**: ✅ Everything is tested, documented, + automated in CI

---

## Questions Before Starting?

1. **Scope**: Do you want all 7 phases or subset? (e.g., just phases 1-2 to start)
2. **Priority**: Are determinism + reproducibility critical? (affects tech choices)
3. **Scale**: How many avatars will you need to compile? (affects parallelization)
4. **Timeline**: Is 6-7 weeks realistic, or do you need faster?
5. **Storage**: Azure Blob + CDN, or different solution?

---

**Status**: Planning phase complete. Ready to implement. 🚀
