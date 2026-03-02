#!/usr/bin/env node

/**
 * Simple test runner for avatar-compiler
 * Runs determinism + functional tests without vitest dependency
 */

import { compileAvatar, compileBatch, DEFAULT_DNA } from "@world-engine/avatar-compiler";

let passed = 0;
let failed = 0;

const tests = [];

// Helper function to define tests
function test(name, fn) {
  tests.push({ name, fn });
}

// Helper assertions
function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`Expected ${expected}, got ${actual}. ${message}`);
  }
}

function assertTrue(value, message) {
  assert(value === true, message);
}

function assertDefined(value, message) {
  assert(value !== undefined && value !== null, message);
}

// ============================================================================
// Core Compilation Tests
// ============================================================================

test('compiles a default avatar to GLB', async () => {
  const asset = await compileAvatar(DEFAULT_DNA);

  assertDefined(asset, 'asset should be defined');
  assertDefined(asset.glb, 'glb should exist');
  assert(Buffer.isBuffer(asset.glb), 'glb should be a Buffer');
  assert(asset.glb.length > 100, 'glb should have content');
  assert(/^[a-f0-9]{64}$/.test(asset.contentHash), 'contentHash should be SHA-256 hex');
  assert(/^[a-f0-9]{64}$/.test(asset.dnaHash), 'dnaHash should be SHA-256 hex');
});

test('produces GLB with valid magic bytes', async () => {
  const asset = await compileAvatar(DEFAULT_DNA);
  const magic = asset.glb.toString('ascii', 0, 4);
  assertEquals(magic, 'glTF', 'must have glTF magic bytes');
});

test('includes metadata with bounding box', async () => {
  const asset = await compileAvatar(DEFAULT_DNA);
  const { metadata } = asset;

  assertDefined(metadata, 'metadata should exist');
  assertDefined(metadata.bounds, 'bounds should exist');
  assert(metadata.bounds.min.length === 3, 'bounds.min should have 3 components');
  assert(metadata.bounds.max.length === 3, 'bounds.max should have 3 components');
});

test('handles custom morphs', async () => {
  const dna = {
    morphs: { smile: 0.5, eyesOpen: 0.8 }
  };

  const asset = await compileAvatar(dna);
  assert(Buffer.isBuffer(asset.glb), 'should compile with custom morphs');
  assert(asset.contentHash.length === 64, 'should produce valid hash');
});

test('handles custom materials', async () => {
  const dna = {
    materials: {
      skinColor: '#ff0000',
      hairColor: '#00ff00',
      roughness: 0.5,
      metalness: 0.1
    }
  };

  const asset = await compileAvatar(dna);
  assert(Buffer.isBuffer(asset.glb), 'should compile with custom materials');
});

test('compiles quickly (<1s per avatar)', async () => {
  const start = performance.now();
  await compileAvatar(DEFAULT_DNA);
  const duration = performance.now() - start;

  assert(duration < 1000, `should compile in <1000ms, took ${duration.toFixed(0)}ms`);
  console.log(`   ├─ Compilation time: ${duration.toFixed(1)}ms`);
});

test('batch compiles multiple avatars', async () => {
  const avatars = [
    { id: 'avatar-1', dna: { morphs: { smile: 0.0 } } },
    { id: 'avatar-2', dna: { morphs: { smile: 0.5 } } },
    { id: 'avatar-3', dna: { morphs: { smile: 1.0 } } }
  ];

  const { success, errors } = await compileBatch(avatars);

  assertEquals(success.size, 3, 'should compile all 3 avatars');
  assertEquals(errors.length, 0, 'should have no errors');
});

// ============================================================================
// CRITICAL: Determinism Tests
// ============================================================================

test('[CRITICAL] produces identical GLB for same DNA (3x run)', async () => {
  const dna = {
    ...DEFAULT_DNA,
    morphs: { smile: 0.5, eyesOpen: 0.8 },
    materials: { skinColor: '#ff6b6b', hairColor: '#333333' }
  };

  const run1 = await compileAvatar(dna);
  const run2 = await compileAvatar(dna);
  const run3 = await compileAvatar(dna);

  assertEquals(run1.glb.toString('hex'), run2.glb.toString('hex'), 'run1 should equal run2');
  assertEquals(run2.glb.toString('hex'), run3.glb.toString('hex'), 'run2 should equal run3');
  assertEquals(run1.contentHash, run2.contentHash, 'hashes should match');
  assertEquals(run2.contentHash, run3.contentHash, 'hashes should match');

  console.log(`   ├─ Determinism verified: ${run1.contentHash.substring(0, 16)}...`);
});

test('[CRITICAL] produces identical output for default DNA (10x run)', async () => {
  const hashes = new Set();

  for (let i = 0; i < 10; i++) {
    const asset = await compileAvatar(DEFAULT_DNA);
    hashes.add(asset.contentHash);
  }

  assertEquals(hashes.size, 1, '10 runs should produce exact same hash');

  const hash = Array.from(hashes)[0];
  console.log(`   ├─ 10-run determinism: ${hash.substring(0, 16)}...`);
});

test('[CRITICAL] produces different hashes for different morphs', async () => {
  const dna0 = { ...DEFAULT_DNA, morphs: { smile: 0.0 } };
  const dna1 = { ...DEFAULT_DNA, morphs: { smile: 0.5 } };
  const dna2 = { ...DEFAULT_DNA, morphs: { smile: 1.0 } };

  const asset0 = await compileAvatar(dna0);
  const asset1 = await compileAvatar(dna1);
  const asset2 = await compileAvatar(dna2);

  const hashes = new Set([asset0.contentHash, asset1.contentHash, asset2.contentHash]);
  assertEquals(hashes.size, 3, 'different DNAs should produce different hashes');
});

test('[CRITICAL] DNA hash is deterministic', async () => {
  const dna1 = { ...DEFAULT_DNA, morphs: { smile: 0 } };
  const dna2 = { ...DEFAULT_DNA, morphs: { smile: 0.5 } };

  const assets1a = await compileAvatar(dna1);
  const assets1b = await compileAvatar(dna1);
  const assets2 = await compileAvatar(dna2);

  assertEquals(assets1a.dnaHash, assets1b.dnaHash, 'same DNA = same DNA hash');
  assert(assets1a.dnaHash !== assets2.dnaHash, 'different DNA = different DNA hash');
});

test('[CRITICAL] replay verification (compile then verify)', async () => {
  const dna = {
    ...DEFAULT_DNA,
    morphs: { smile: 0.42 }
  };

  // Initial compilation
  const initial = await compileAvatar(dna);
  const storedHash = initial.contentHash;

  // Simulate: weeks later, recompile same DNA
  const replayed = await compileAvatar(dna);
  const replayHash = replayed.contentHash;

  assertEquals(replayHash, storedHash, 'replay should produce same hash');
  console.log(`   ├─ Replay verification passed`);
});

// ============================================================================
// Run Tests
// ============================================================================

async function runTests() {
  console.log('\n🧪 Avatar Compiler Test Suite\n');

  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`✓ ${name}`);
      passed++;
    } catch (err) {
      console.log(`✗ ${name}`);
      console.log(`  └─ Error: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${tests.length} tests\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

// Run all tests
runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
