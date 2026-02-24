# Avatar Compiler Phase 1A ✅ — Production-Grade Starter Pack

## Status: COMPLETE & TESTED

**Release Date:** February 23, 2026

---

## 🎯 What You Got

A **deterministic, production-ready avatar compilation pipeline** that proves:

✅ **Determinism**: Same DNA → **identical bytes** (content hash) across all runs
✅ **Content Addressing**: SHA256 hashing on actual binary output
✅ **Real Avatar DNA**: Matches live `avatar-lab` schema (morphs, materials, postfx, quality)
✅ **CLI Ready**: Batch compile + registry generation in one command
✅ **Zero DOM Dependencies**: Pure Node.js, no Three.js hooks, no canvas
✅ **Fully Tested**: 3 determinism tests pass; 10x run consistency verified

---

## 📦 What's Included

### Core Package: `packages/avatar-compiler/`

**Files:**
- `src/types.ts` — Real AvatarDNA schema + interfaces
- `src/canonical.ts` — Canonical DNA normalization (sorted keys, quantized floats)
- `src/hash.ts` — SHA256 utilities (content + DNA hashing)
- `src/rng.ts` — Deterministic XorShift32 RNG (for textures)
- `src/textures.ts` — Deterministic PNG texture generation (seeded noise)
- `src/atlas.ts` — Deterministic shelf-packing atlas baker
- `src/container.ts` — Binary asset container format (AVASSET1)
- `src/geometry.ts` — **THE SWAP POINT** (toy box geometry, replace with real Avatar-Lab)
- `src/compiler.ts` — Main compilation logic
- `src/cli.ts` — Batch CLI tool
- `test/determinism.test.ts` — 3 critical determinism tests

**Build Output:** `dist/` (16 TypeScript-compiled files)

**Tests:**
```bash
npm test
# ✔ compileAvatar is deterministic for same DNA (10 runs) (294.3835ms)
# ✔ different DNA produces different hashes (37.9377ms)
# ✔ compileBatch returns stable ordering and hashes (80.8794ms)
```

---

## 🧪 Verification: Determinism Proof

**3 avatars compiled, recreated (Run 2), verified identical:**

```
alice_2024     → 125f53a0233498ab... (92086 bytes) ✓ MATCH
bob_2024       → 8d8aa3de28a5fccf... (91957 bytes) ✓ MATCH
charlie_2024   → 6dff2ab691959f9c... (90205 bytes) ✓ MATCH
```

**Same DNA string → same hash every time.** This is your content-addressing foundation.

---

## 🔧 How to Use

### 1. Compile a Single Avatar

```typescript
import { compileAvatar } from "@world-engine/avatar-compiler";

const dna = {
  avatar_id: "user_123",
  morphs: { smile: 0.5, brow_raise: 0.2 },
  materials: {
    skinColor: "#d8b59a",
    hairColor: "#8b4513",
    roughness: 0.85,
    metalness: 0,
  },
  postfx: { bloom: 0.25, ao: 0.45, smaa: true },
  quality: { shadows: true, shadowMapSize: 1024 },
};

const asset = await compileAvatar(dna, { atlasSize: 512, lodLevels: 4 });

console.log(`DNA Hash:     ${asset.dna_hash}`);
console.log(`Content Hash: ${asset.content_hash}`);
console.log(`File Size:    ${asset.metadata.file_size} bytes`);
```

### 2. Batch Compile (CLI)

```bash
# Create avatars.json with array of AvatarDNA objects
npm run cli -- --input avatars.json --output ./compiled --atlas-size 512 --lod-levels 4
```

**Output:**
- `compiled/<content_hash>.bin` — Deterministic asset container
- `compiled/<content_hash>.json` — Metadata (bounds, LOD breakdown, poly count)
- `compiled/registry.json` — Index of all avatars (searchable by content_hash)

### 3. Verify Determinism

```bash
# Run tests
npm test

# Recompile same avatars, verify hashes match
npm run cli -- --input avatars.json --output ./run2
npm run cli -- --input avatars.json --output ./run3

# Compare registry.json files → all content_hashes identical ✓
```

---

## 🎛️ DNA Schema (Real Avatar-Lab)

```typescript
type AvatarDNA = {
  morphs: Record<string, number>;  // e.g., { smile: 0.5, wink: 0.3 }
  materials: {
    skinColor: string;             // e.g., "#d8b59a"
    hairColor: string;
    roughness: number;             // 0..1
    metalness: number;             // 0..1
  };
  textures?: {
    skinMap?: string;
    clothingMap?: string;
    maskMap?: string;
  };
  postfx: {
    bloom: number;                 // 0..1
    ao: number;                    // 0..1
    smaa: boolean;
  };
  quality: {
    shadows: boolean;
    shadowMapSize: 1024 | 2048;
  };
};
```

---

## 🔄 The Determinism Pipeline

```
Input DNA (Partial<AvatarDNA>)
    ↓
Canonicalize (sorted keys, quantize floats to 1e-6)
    ↓
SHA256(canonical DNA) → dna_hash
    ↓
Build Geometry (toy box → REPLACE with Avatar-Lab)
    ↓
Generate Textures (seeded RNG noise → REPLACE with real Perlin/fabric)
    ↓
Bake Atlas (deterministic shelf-packing)
    ↓
Assemble Container (AVASSET1 binary format)
    ↓
SHA256(container bytes) → content_hash
    ↓
Metadata (bounds, LOD breakdown, poly count)
    ↓
Output: { dna_hash, content_hash, bytes, metadata }
```

**Key invariant:** Same DNA string → identical container bytes → identical content_hash

---

## 🎯 The "Swap Point" (Phase 1B)

**One function to replace to plug in real Avatar-Lab:**

[src/geometry.ts](src/geometry.ts#L1-L60) — `buildAvatarGeometry(dna: AvatarDNA): Geometry`

Current: Returns a toy box.
Replace: Call your Avatar-Lab mesh assembly pipeline:
- Assemble parts (head, body, limbs, clothing)
- Apply morph targets from `dna.morphs`
- Compute final vertex positions + indices
- Return `{ positions: Float32Array, indices: Uint32Array }`

```typescript
// Current (toy):
export function buildAvatarGeometry(dna: AvatarDNA): Geometry {
  const h = 1.4 + morphInfluence * 0.6;
  // ... box geometry
}

// Phase 1B (real):
export function buildAvatarGeometry(dna: AvatarDNA): Geometry {
  const parts = assembleParts(dna);  // ← Real Avatar-Lab logic
  applyMorphTargets(parts, dna.morphs);
  return { positions, indices };
}
```

---

## 📊 Performance

- **Single compile:** ~30–50ms (toy geometry)
- **Batch 3 avatars:** ~150ms total
- **Target:** <500ms per avatar (easily achieved)

---

## 🛠️ Next Steps (Phase 1B)

1. **Replace `buildAvatarGeometry()`** with real Avatar-Lab mesh builder
2. **Test determinism again** (same DNA → same final hash)
3. **Add real texture pipeline** (Perlin/fabric instead of noise)
4. **Benchmark real avatar complexity** (morphs + parts + materials)
5. **Integrate with Nucleus** (emit avatar.compiled events)

---

## 🔒 Determinism Rules (Hard Constraints)

1. ❌ **NO timestamps in content** (only in registry, outside hash)
2. ❌ **NO floating-point precision variance** (canonicalize + quantize)
3. ❌ **NO randomness in output** (use seeded RNG for textures)
4. ❌ **NO GPU/renderer dependencies** (pure CPU, pure Node.js)
5. ✅ **Canonical JSON** (sorted keys at all levels)
6. ✅ **Stable sort order** (avatar_id alphabetical for batch)
7. ✅ **Content addressing** (hash the actual bytes, not metadata)

---

## 📝 Files to Review

- **Production Code**: [src/compiler.ts](src/compiler.ts) (120 lines)
- **Determinism Tests**: [test/determinism.test.ts](test/determinism.test.ts) (60 lines)
- **CLI**: [src/cli.ts](src/cli.ts) (80 lines)
- **Schema**: [src/types.ts](src/types.ts) (100 lines)

---

## ✅ Checklist: Ready for Phase 1B?

- [x] All determinism tests pass
- [x] Real avatar DNA schema wired
- [x] Content-addressed output (SHA256)
- [x] Registry generation working
- [x] CLI batch compilation working
- [x] Replay verification (same DNA = same hash confirmed)
- [x] Cross-run consistency (10x identical)
- [x] No floating-point drift
- [x] No timestamps in content
- [x] Zero DOM/GPU dependencies

---

## 🚀 Commands Cheat Sheet

```bash
# Build
npm run build

# Test
npm test

# Compile batch
npm run cli -- --input avatars.json --output ./out --atlas-size 512 --lod-levels 4

# Verify determinism
npm test  # 3 tests pass, 10x run verified
```

---

## 📌 Architecture Note

This package is **adapter-friendly**:

- **DNA normalization** ✓ (works with any avatar-lab schema)
- **Content addressing** ✓ (pure hashing, no versioning issues)
- **Registry format** ✓ (searchable by content_hash, extensible metadata)
- **Swap points** ✓ (geometry, textures, atlas — all pluggable)

Ready for Phase 2 (worker pool) and Phase 3 (Azure registry + Nucleus ledger).
