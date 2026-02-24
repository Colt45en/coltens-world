#!/usr/bin/env node
/**
 * Codex CLI: Generate codex.manifest.json
 *
 * Usage:
 *   npx ts-node packages/codex/src/cli.ts --rootDir codex --manifestPath codex.manifest.json
 *   OR (after build):
 *   node --enable-source-maps ./dist/packages/codex/src/cli.js
 */

import { CodexRegistry } from "./registry";

const args = new Map<string, string>();
let i = 0;
while (i < process.argv.length) {
  if (process.argv[i]?.startsWith("--")) {
    const key = process.argv[i]!.substring(2);
    const value = process.argv[i + 1];
    if (value && !value.startsWith("--")) {
      args.set(key, value);
      i += 2;
    } else {
      i++;
    }
  } else {
    i++;
  }
}

const rootDir = args.get("rootDir") ?? "codex";
const manifestPath = args.get("manifestPath") ?? "codex.manifest.json";
const writeBack = args.has("writeBackCanonical");

console.error(`📂 CodexRegistry: scanning ${rootDir}/`);

const registry = new CodexRegistry({
  rootDir,
  patterns: ["**/*.codex.json"],
  manifestPath,
  writeBackCanonical: writeBack,
});

const result = await registry.load();

if (!result.ok) {
  console.error("❌ Codex load issues:");
  for (const issue of result.issues) {
    console.error(`\n  📄 ${issue.file}`);
    console.error(`     ${issue.error}`);
  }
  process.exit(1);
}

console.error(`\n✅ Loaded ${result.countLoaded} codex entries.`);
console.error(`   IDs: ${registry.listIds().join(", ")}`);
console.error(`\n🧾 Wrote manifest: ${manifestPath}`);

if (result.manifest) {
  console.error(`\n📊 Manifest:`);
  console.error(`   Generated: ${result.manifest.generated_at_utc}`);
  console.error(`   Root directory: ${result.manifest.root_dir}`);
  console.error(`   Entry count: ${result.manifest.count}`);
}

try {
  const rootDir = args.get("rootDir") ?? "codex";
  const manifestPath = args.get("manifestPath") ?? "codex.manifest.json";
  const writeBack = args.has("writeBackCanonical");

  console.error(`📂 CodexRegistry: scanning ${rootDir}/`);

  const registry = new CodexRegistry({
    rootDir,
    patterns: ["**/*.codex.json"],
    manifestPath,
    writeBackCanonical: writeBack,
  });

  const result = await registry.load();

  if (!result.ok) {
    console.error("❌ Codex load issues:");
    for (const issue of result.issues) {
      console.error(`\n  📄 ${issue.file}`);
      console.error(`     ${issue.error}`);
    }
    process.exit(1);
  }

  console.error(`\n✅ Loaded ${result.countLoaded} codex entries.`);
  console.error(`   IDs: ${registry.listIds().join(", ")}`);
  console.error(`\n🧾 Wrote manifest: ${manifestPath}`);

  if (result.manifest) {
    console.error(`\n📊 Manifest:`);
    console.error(`   Generated: ${result.manifest.generated_at_utc}`);
    console.error(`   Root directory: ${result.manifest.root_dir}`);
    console.error(`   Entry count: ${result.manifest.count}`);
  }
} catch (e) {
  console.error("Fatal error:", e);
  process.exit(1);
}
