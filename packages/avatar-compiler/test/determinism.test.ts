import assert from "node:assert/strict";
import test from "node:test";
import { compileAvatar, compileBatch } from "../src/compiler.js";
import type { AvatarDNA } from "../src/types.js";

test("compileAvatar is deterministic for same DNA (10 runs)", async () => {
  const dna: AvatarDNA & { avatar_id: string } = {
    avatar_id: "user_001",
    morphs: { smile: 0.42, brow_raise: 0.1 },
    materials: {
      skinColor: "#d8b59a",
      hairColor: "#8b4513",
      roughness: 0.85,
      metalness: 0.1,
    },
    postfx: { bloom: 0.25, ao: 0.45, smaa: true },
    quality: { shadows: true, shadowMapSize: 1024 },
  };

  const first = await compileAvatar(dna, { atlasSize: 256, lodLevels: 4, quantizeStep: 1e-6 });

  for (let i = 0; i < 10; i++) {
    const next = await compileAvatar(dna, { atlasSize: 256, lodLevels: 4, quantizeStep: 1e-6 });
    assert.equal(next.dna_hash, first.dna_hash);
    assert.equal(next.content_hash, first.content_hash);
    assert.equal(Buffer.compare(Buffer.from(next.bytes), Buffer.from(first.bytes)), 0, `Run ${i+1} produced different bytes`);
  }

  console.log(`✓ Determinism verified: same DNA → identical bytes across 10 runs`);
  console.log(`  dna_hash: ${first.dna_hash.slice(0, 20)}...`);
  console.log(`  content_hash: ${first.content_hash.slice(0, 20)}...`);
});

test("different DNA produces different hashes", async () => {
  const base: AvatarDNA & { avatar_id: string } = {
    avatar_id: "user_002",
    morphs: { smile: 0.0 },
    materials: { skinColor: "#d8b59a", hairColor: "#2b1d14", roughness: 0.85, metalness: 0 },
    postfx: { bloom: 0.25, ao: 0.45, smaa: true },
    quality: { shadows: true, shadowMapSize: 1024 },
  };

  const r1 = await compileAvatar(base, { atlasSize: 256 });

  const modified = { ...base, morphs: { smile: 0.8 } };
  const r2 = await compileAvatar(modified, { atlasSize: 256 });

  assert.notEqual(r1.dna_hash, r2.dna_hash);
  assert.notEqual(r1.content_hash, r2.content_hash);
  console.log(`✓ Different morphs produce different hashes`);
});

test("compileBatch returns stable ordering and hashes", async () => {
  const dnas = [
    {
      avatar_id: "beta",
      morphs: { smile: 0.2 },
      materials: { skinColor: "#d8b59a", hairColor: "#2b1d14", roughness: 0.85, metalness: 0 },
      postfx: { bloom: 0.25, ao: 0.45, smaa: true },
      quality: { shadows: true, shadowMapSize: 1024 },
    },
    {
      avatar_id: "alpha",
      morphs: { smile: 0.5 },
      materials: { skinColor: "#c8a489", hairColor: "#3b2d24", roughness: 0.8, metalness: 0.05 },
      postfx: { bloom: 0.3, ao: 0.5, smaa: true },
      quality: { shadows: false, shadowMapSize: 2048 },
    },
  ] as any[];

  const run1 = await compileBatch(dnas, { atlasSize: 256 });
  const run2 = await compileBatch(dnas, { atlasSize: 256 });

  // Order should be sorted by avatar_id
  assert.equal(run1[0].avatar_id, "alpha");
  assert.equal(run1[1].avatar_id, "beta");

  // Hashes should match across runs
  assert.equal(run1[0].content_hash, run2[0].content_hash);
  assert.equal(run1[1].content_hash, run2[1].content_hash);

  console.log(`✓ Batch compile returns stable ordering and consistent hashes`);
});
