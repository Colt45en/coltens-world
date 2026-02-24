# Avatar Compiler Implementation Guide

Quick reference for building the avatar compilation pipeline.

## Phase 1: Skeleton Implementation

### Step 1: Create Package Structure

```bash
# From coltens world/
mkdir -p packages/avatar-compiler/src
mkdir -p packages/avatar-compiler/test
touch packages/avatar-compiler/package.json
touch packages/avatar-compiler/tsconfig.json
touch packages/avatar-compiler/src/index.ts
touch packages/avatar-compiler/src/types.ts
touch packages/avatar-compiler/src/compiler.ts
touch packages/avatar-compiler/test/compiler.test.ts
```

### Step 2: Package.json Structure

```json
{
  "name": "@world-engine/avatar-compiler",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "three": "^r128",
    "zod": "^3.22"
  },
  "devDependencies": {
    "@types/node": "^20",
    "typescript": "^5",
    "vitest": "^1"
  }
}
```

### Step 3: Types Definition

**`src/types.ts`**:
```typescript
import { AvatarDNA } from "../../../apps/avatar-lab/src/avatar/dna";

/**
 * Compiled avatar asset with metadata
 */
export interface CompiledAsset {
  /** Content-addressed GLB buffer */
  glb: Buffer;

  /** SHA-256 hash of GLB (immutable ID) */
  contentHash: string;

  /** SHA-256 hash of input DNA */
  dnaHash: string;

  /** Metadata about the compiled asset */
  metadata: AssetMetadata;
}

export interface AssetMetadata {
  /** Source avatar DNA hash */
  dnaHash: string;

  /** Total polygon count (all LODs) */
  polygonCount: number;

  /** Per-LOD breakdown */
  lodBreakdown: Array<{
    level: number;
    polygonCount: number;
    textureSize: number;
  }>;

  /** Uncompressed size before GLB encoding */
  uncompressedSize: number;

  /** Compressed GLB size */
  compressedSize: number;

  /** Bounding box */
  bounds: {
    min: [number, number, number];
    max: [number, number, number];
  };

  /** Compilation duration (ms) */
  compilationTime: number;

  /** Timestamp */
  timestamp: string;

  /** Version of compiler used */
  compilerVersion: string;
}

/**
 * Compilation options
 */
export interface CompileOptions {
  /** atlas size in pixels (default: 2048) */
  atlasSize?: number;

  /** LOD detail levels (default: [1, 0.6, 0.35, 0.2]) */
  lodRatios?: number[];

  /** Texture quality (default: "high") */
  textureQuality?: "low" | "medium" | "high";

  /** Include procedural textures (default: true) */
  generateTextures?: boolean;
}

/**
 * Batch compilation for multiple avatars
 */
export interface BatchCompileOptions extends CompileOptions {
  /** Worker threads (default: 1) */
  parallelWorkers?: number;

  /** Progress callback */
  onProgress?: (current: number, total: number, current_id: string) => void;
}
```

### Step 4: Main Compiler Function

**`src/compiler.ts`**:
```typescript
import crypto from 'crypto';
import { AvatarDNA, DEFAULT_DNA } from '../../../apps/avatar-lab/src/avatar/dna';
import { CompiledAsset, CompileOptions, AssetMetadata } from './types';

/**
 * Compile a single avatar DNA to GLB
 */
export async function compileAvatar(
  dna: AvatarDNA,
  options: CompileOptions = {}
): Promise<CompiledAsset> {
  const startTime = performance.now();
  const defaultedDna = { ...DEFAULT_DNA, ...dna };

  // Step 1: Hash input for determinism verification
  const dnaHash = hashDNA(defaultedDna);

  try {
    // Step 2: Create Three.js scene (pure math, no DOM)
    const { mesh, materials } = await createAvatarGeometry(defaultedDna);

    // Step 3: Apply morphs
    applyMorphTargets(mesh, defaultedDna);

    // Step 4: Generate textures (procedural)
    const textures = await generateTextures(defaultedDna, options.textureQuality || 'high');

    // Step 5: Bind materials
    bindMaterials(mesh, textures, materials);

    // Step 6: Bake atlas (combine all textures)
    const { texture: atlasTexture, uvMaps } = await bakeAtlas(
      materials,
      options.atlasSize || 2048
    );

    // Step 7: Generate LODs
    const lods = generateLODs(mesh, options.lodRatios || [1, 0.6, 0.35, 0.2]);

    // Step 8: Merge geometry
    const optimized = mergeGeometry(lods);

    // Step 9: Encode to GLB
    const glb = await encodeGLB(optimized, atlasTexture);

    // Step 10: Hash output GLB
    const contentHash = hashBuffer(glb);

    // Compile metadata
    const compilationTime = performance.now() - startTime;
    const metadata = createMetadata(dnaHash, contentHash, mesh, compilationTime);

    return {
      glb,
      contentHash,
      dnaHash,
      metadata
    };
  } catch (err) {
    console.error(`[Compiler] Failed to compile avatar:`, err);
    throw new Error(`Avatar compilation failed: ${err.message}`);
  }
}

/**
 * Batch compile multiple avatars (parallelized)
 */
export async function compileBatch(
  avatars: Array<{ id: string; dna: AvatarDNA }>,
  options: CompileOptions & { parallelWorkers?: number; onProgress?: Function } = {}
): Promise<Map<string, CompiledAsset>> {
  const results = new Map<string, CompiledAsset>();
  const parallelWorkers = options.parallelWorkers || 1;

  // Process in chunks to avoid memory explosion
  const chunkSize = parallelWorkers;
  for (let i = 0; i < avatars.length; i += chunkSize) {
    const chunk = avatars.slice(i, i + chunkSize);
    const promises = chunk.map(async ({ id, dna }) => {
      const asset = await compileAvatar(dna, options);
      results.set(id, asset);
      options.onProgress?.(i + chunk.indexOf({ id, dna }), avatars.length, id);
    });

    await Promise.all(promises);
  }

  return results;
}

// ============================================================================
// Helper Functions (stubs - actual implementations in separate files)
// ============================================================================

async function createAvatarGeometry(dna: AvatarDNA) {
  // Extract from AvatarModel.tsx - render, get BufferGeometry + Materials
  // NO DOM CALLS - use `gl` context from offscreen canvas
  throw new Error('Implement: createAvatarGeometry');
}

function applyMorphTargets(mesh: any, dna: AvatarDNA) {
  // Set morphTargetInfluences on mesh based on dna.morphs
  throw new Error('Implement: applyMorphTargets');
}

async function generateTextures(dna: AvatarDNA, quality: string) {
  // Procedurally generate:
  // - Skin texture (Perlin noise + color shift)
  // - Hair texture (procedural pattern)
  // - Clothing texture (UV repeating pattern)
  // Return: { skinMap, hairMap, clothingMap }
  throw new Error('Implement: generateTextures');
}

function bindMaterials(mesh: any, textures: any, materials: any[]) {
  // Apply textures to materials
  throw new Error('Implement: bindMaterials');
}

async function bakeAtlas(materials: any[], size: number) {
  // Bin-pack all textures into single atlas
  // You can use `three/examples/jsm/utils/TextureAtlas`
  // Return: { texture: Texture, uvMaps: Map }
  throw new Error('Implement: bakeAtlas');
}

function generateLODs(mesh: any, ratios: number[]) {
  // Use `three/examples/jsm/geometries/BufferGeometryUtils`
  // Simplify mesh to specified triangle ratios
  // Return: LOD group with 4 meshes
  throw new Error('Implement: generateLODs');
}

function mergeGeometry(lods: any) {
  // Merge LOD meshes by body part
  // Return: optimized scene
  throw new Error('Implement: mergeGeometry');
}

async function encodeGLB(optimized: any, atlas: any) {
  // Use `three/examples/jsm/exporters/GLTFExporter`
  // Export all LODs + single atlas texture
  // Compress using quantization
  // Return: Buffer
  throw new Error('Implement: encodeGLB');
}

function hashDNA(dna: AvatarDNA): string {
  // Canonical JSON stringify + SHA-256
  const canonical = JSON.stringify(dna, Object.keys(dna).sort());
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

function hashBuffer(buffer: Buffer): string {
  // SHA-256 of buffer
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function createMetadata(
  dnaHash: string,
  contentHash: string,
  mesh: any,
  compilationTime: number
): AssetMetadata {
  const bounds = mesh.geometry.boundingBox;

  return {
    dnaHash,
    polygonCount: mesh.geometry.attributes.position.count / 3,
    lodBreakdown: [], // TODO: compute per LOD
    uncompressedSize: 0, // TODO: calc
    compressedSize: 0, // TODO: calc
    bounds: {
      min: bounds.min.toArray(),
      max: bounds.max.toArray()
    },
    compilationTime,
    timestamp: new Date().toISOString(),
    compilerVersion: '0.1.0'
  };
}
```

### Step 5: Test Strategy

**`test/compiler.test.ts`**:
```typescript
import { describe, it, expect } from 'vitest';
import { compileAvatar, hashDNA } from '../src/compiler';
import { AvatarDNA, DEFAULT_DNA } from '../../../apps/avatar-lab/src/avatar/dna';

describe('Avatar Compiler', () => {
  it('compiles a single avatar to GLB', async () => {
    const dna = { ...DEFAULT_DNA, morphs: { smile: 0.5 } };
    const asset = await compileAvatar(dna);

    expect(asset.glb).toBeInstanceOf(Buffer);
    expect(asset.glb.length).toBeGreaterThan(1000); // sanity check
    expect(asset.contentHash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
  });

  it('produces deterministic output', async () => {
    const dna = { ...DEFAULT_DNA, morphs: { smile: 0.5 } };

    // Compile 3 times
    const r1 = await compileAvatar(dna);
    const r2 = await compileAvatar(dna);
    const r3 = await compileAvatar(dna);

    // All GLBs should be identical
    expect(r1.contentHash).toBe(r2.contentHash);
    expect(r2.contentHash).toBe(r3.contentHash);
    expect(r1.glb).toEqual(r2.glb);
    expect(r2.glb).toEqual(r3.glb);
  });

  it('uses consistent DNA hash', async () => {
    const dna = DEFAULT_DNA;
    const hash1 = hashDNA(dna);
    const hash2 = hashDNA(dna);
    expect(hash1).toBe(hash2);
  });

  it('detects DNA differences', async () => {
    const dna1 = { ...DEFAULT_DNA, morphs: { smile: 0.0 } };
    const dna2 = { ...DEFAULT_DNA, morphs: { smile: 0.5 } };

    expect(hashDNA(dna1)).not.toBe(hashDNA(dna2));
  });
});
```

---

## Phase 2: CLI Implementation

**`scripts/avatar/compile.mjs`**:
```javascript
#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { compileAvatar, compileBatch } from '../../packages/avatar-compiler/dist/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const argv = yargs(hideBin(process.argv))
  .option('input', {
    alias: 'i',
    describe: 'Input JSON file with avatar DNAs',
    type: 'string',
    demandOption: true
  })
  .option('output', {
    alias: 'o',
    describe: 'Output directory for GLBs + metadata',
    type: 'string',
    default: './avatars'
  })
  .option('parallel', {
    alias: 'p',
    describe: 'Number of parallel workers',
    type: 'number',
    default: 4
  })
  .option('atlas-size', {
    describe: 'Texture atlas size (pixels)',
    type: 'number',
    default: 2048
  })
  .option('lod-levels', {
    describe: 'LOD detail ratios (comma-separated)',
    type: 'string',
    default: '1,0.6,0.35,0.2'
  })
  .parseSync();

async function main() {
  console.log('🎭 Avatar Compiler v0.1.0');
  console.log('');

  // Load input
  if (!fs.existsSync(argv.input)) {
    throw new Error(`Input file not found: ${argv.input}`);
  }

  const inputData = JSON.parse(fs.readFileSync(argv.input, 'utf-8'));
  const avatars = Array.isArray(inputData) ? inputData : inputData.avatars || [];

  console.log(`📋 Loaded ${avatars.length} avatars from ${argv.input}`);

  // Create output directory
  if (!fs.existsSync(argv.output)) {
    fs.mkdirSync(argv.output, { recursive: true });
  }

  // Compile
  const lodRatios = argv['lod-levels'].split(',').map(Number);
  const registry = [];
  let successCount = 0;
  let failureCount = 0;

  const startTime = Date.now();

  const results = await compileBatch(avatars, {
    parallelWorkers: argv.parallel,
    atlasSize: argv['atlas-size'],
    lodRatios: lodRatios,
    onProgress: (current, total, id) => {
      const percent = ((current / total) * 100).toFixed(1);
      process.stdout.write(`\r✨ [${percent}%] ${current}/${total} - ${id}`);
    }
  });

  // Save outputs
  results.forEach(({ id, dna }, asset) => {
    try {
      const glbPath = path.join(argv.output, `${asset.contentHash}.glb`);
      const metaPath = path.join(argv.output, `${asset.contentHash}.json`);

      fs.writeFileSync(glbPath, asset.glb);
      fs.writeFileSync(metaPath, JSON.stringify(asset.metadata, null, 2));

      registry.push({
        avatar_id: id,
        content_hash: asset.contentHash,
        dna_hash: asset.dnaHash,
        file_size: asset.glb.length,
        polygon_count: asset.metadata.polygonCount,
        ...asset.metadata
      });

      successCount++;
    } catch (err) {
      console.error(`\n❌ Failed to save ${id}:`, err.message);
      failureCount++;
    }
  });

  // Save registry
  const registryPath = path.join(argv.output, 'registry.json');
  fs.writeFileSync(registryPath, JSON.stringify({ avatars: registry }, null, 2));

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n`);
  console.log(`✅ Compilation complete in ${duration}s`);
  console.log(`  ✓ Success: ${successCount}`);
  console.log(`  ✗ Failed: ${failureCount}`);
  console.log(`  📂 Output: ${argv.output}`);
  console.log(`  📋 Registry: ${registryPath}`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
```

---

## Phase 3: Asset Registry

**`apps/nucleus/src/routes/avatars.ts`**:
```typescript
import express from 'express';
import path from 'path';
import fs from 'fs';

export function createAvatarRoutes(avatarDir: string) {
  const router = express.Router();

  // GET /avatars/registry - List all avatars
  router.get('/registry', (req, res) => {
    try {
      const registryPath = path.join(avatarDir, 'registry.json');
      const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
      res.json(registry);
    } catch (err) {
      res.status(404).json({ error: 'Registry not found' });
    }
  });

  // GET /avatars/:contentHash - Get avatar metadata
  router.get('/:contentHash', (req, res) => {
    try {
      const metaPath = path.join(avatarDir, `${req.params.contentHash}.json`);
      const metadata = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      res.json(metadata);
    } catch (err) {
      res.status(404).json({ error: 'Avatar not found' });
    }
  });

  // GET /avatars/:contentHash/download - Stream GLB file
  router.get('/:contentHash/download', (req, res) => {
    try {
      const glbPath = path.join(avatarDir, `${req.params.contentHash}.glb`);
      res.download(glbPath);
    } catch (err) {
      res.status(404).json({ error: 'Avatar GLB not found' });
    }
  });

  return router;
}
```

---

## Integration Checklist

- [ ] Create `packages/avatar-compiler/`
- [ ] Add to `pnpm-workspace.yaml`
- [ ] Update root `package.json` with build scripts
- [ ] Run `pnpm install` to link package
- [ ] Write determinism tests
- [ ] Test with 5 sample avatars
- [ ] Create CLI tool
- [ ] Test CLI: `node scripts/avatar/compile.mjs --input avatars.json`
- [ ] Add Nucleus routes
- [ ] Add agent-server job handler
- [ ] Integration tests (full pipeline)

---

## Quick Start (This Week)

```bash
# 1. Create package + basic types/compiler stubs
cd packages && mkdir avatar-compiler && cd avatar-compiler
npm init -y
# ... fill in files ...

# 2. Build package
pnpm build

# 3. Write first test
pnpm test

# 4. Implement first function (createAvatarGeometry)
# - Extract from AvatarModel.tsx
# - Test in isolation

# 5. Implement remaining functions iteratively
# - One per day
# - Test determinism after each

# 6. Create CLI wrapper
# - Test with 1 avatar (single file)
# - Test with 5 avatars (batch)

# 7. Wire into Nucleus
# - Add /avatars/compile endpoint
# - Test via HTTP
```

The goal: **By Friday, you can run `node scripts/avatar/compile.mjs` and get a GLB.**

Good luck! 🚀
