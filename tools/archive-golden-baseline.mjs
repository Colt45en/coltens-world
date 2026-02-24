#!/usr/bin/env node
/**
 * Archive + Baseline Generator
 *
 * Creates a golden baseline archive with signed manifest
 * for future determinism comparisons and audit trail.
 *
 * Usage:
 *   node tools/archive-golden-baseline.mjs <results_dir>
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const resultsDir = process.argv[2] ?? "pipeline_results";

function sha256File(p) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(p))
    .digest("hex");
}

function ok(msg) {
  console.log(`✅ ${msg}`);
}

function info(msg) {
  console.log(`ℹ️  ${msg}`);
}

console.log("🏛️  GOLDEN BASELINE ARCHIVE GENERATOR");
console.log("====================================\n");

// Verify required files
const required = [
  "artifact_manifest.json",
  "run_record_signed.json",
  "world.db",
];

for (const file of required) {
  const p = path.join(resultsDir, file);
  if (!fs.existsSync(p)) {
    console.error(`❌ Missing: ${file}`);
    process.exit(1);
  }
}

ok("All required files present");

// Create baseline metadata
const baselineMetadata = {
  created_at: new Date().toISOString(),
  baseline_id: `baseline-${Date.now().toString(36)}`,
  run_id: "batch-8e663d5fa661",
  golden_baseline: true,
  checksum_manifest:
    "artifact_manifest.json (see for all artifact SHA256 hashes)",
  checksum_signed:
    "run_record_signed.json (manifest signature + boost summary)",
  database_snapshot: "world.db (persistent state at run completion)",
  usage_guidelines: [
    "1. For future pipeline runs on same input: use this as reference",
    "2. To verify determinism: compare output hashes to artifact_manifest.json",
    "3. If hashes match: pipeline is deterministic ✅",
    "4. If hashes differ: investigate divergence (code change, env change, etc.)",
  ],
  files_included: [
    {
      path: "artifact_manifest.json",
      purpose: "Central hash registry for all 9 artifacts",
      usage:
        "Compare future run outputs to these hashes for determinism verification",
    },
    {
      path: "run_record_signed.json",
      purpose: "Signed record with manifest signature + boost metadata",
      usage: "Audit trail for approval decisions + boost rationale",
    },
    {
      path: "world.db",
      purpose: "Persistent state snapshot produced by pipeline",
      usage:
        "Reference for state consistency across deterministic reruns (optional)",
    },
  ],
  replay_instructions:
    'Run: python -m autonomy_loop.pipeline --input "apps/ide-web/src/main.tsx" --output pipeline_results/replay_output',
  baseline_status: "READY",
};

// Write baseline metadata
const baselinePath = path.join(resultsDir, "baseline_metadata.json");
fs.writeFileSync(baselinePath, JSON.stringify(baselineMetadata, null, 2), "utf8");

ok(`Created baseline metadata: ${baselinePath}`);

// Create archive manifest
const archiveManifest = {
  archive_type: "golden_baseline",
  created: new Date().toISOString(),
  baseline_id: baselineMetadata.baseline_id,
  run_id: "batch-8e663d5fa661",
  location: resultsDir,
  files: {
    "artifact_manifest.json": {
      hash: sha256File(path.join(resultsDir, "artifact_manifest.json")),
      size: fs.statSync(path.join(resultsDir, "artifact_manifest.json")).size,
      role: "hash registry",
    },
    "run_record_signed.json": {
      hash: sha256File(path.join(resultsDir, "run_record_signed.json")),
      size: fs.statSync(path.join(resultsDir, "run_record_signed.json")).size,
      role: "approved run record",
    },
    "world.db": {
      hash: sha256File(path.join(resultsDir, "world.db")),
      size: fs.statSync(path.join(resultsDir, "world.db")).size,
      role: "state snapshot",
    },
    "baseline_metadata.json": {
      hash: "computed below",
      size: fs.statSync(baselinePath).size,
      role: "baseline guidelines",
    },
  },
  integrity_check: "All files content-hashed for audit trail",
};

// Recalculate with baseline_metadata hash
archiveManifest.files["baseline_metadata.json"].hash = sha256File(baselinePath);

const manifestPath = path.join(resultsDir, "baseline_archive_manifest.json");
fs.writeFileSync(
  manifestPath,
  JSON.stringify(archiveManifest, null, 2),
  "utf8"
);

ok(`Created archive manifest: ${manifestPath}`);

// Summary
console.log(`\n📦 BASELINE ARCHIVE CONTENTS`);
console.log(`===========================\n`);

for (const [file, meta] of Object.entries(archiveManifest.files)) {
  console.log(`${file}`);
  console.log(`  Role: ${meta.role}`);
  console.log(`  Hash: ${meta.hash.slice(0, 16)}…`);
  console.log(
    `  Size: ${(meta.size / 1024).toFixed(2)} KB\n`
  );
}

console.log(`🎯 NEXT STEPS`);
console.log(`=============\n`);
console.log(`1. Verify this directory is complete:`);
console.log(`   ls -la ${resultsDir}/`);
console.log(`\n2. Archive this directory for long-term storage:`);
console.log(`   tar czf baseline-batch-8e663d5fa661.tar.gz ${resultsDir}/`);
console.log(`\n3. When running pipeline replay, compare hashes:`);
console.log(
  `   python -m autonomy_loop.pipeline --input "apps/ide-web/src/main.tsx"`
);
console.log(
  `   node tools/validate-replay.mjs <replay_output> ${resultsDir}`
);
console.log(`\n4. Store golden baseline reference for future comparisons\n`);

ok(`Baseline archive generation complete!`);
console.log(`\n📍 Location: ${resultsDir}/`);
console.log(`🏛️  Status: READY FOR ARCHIVING + FUTURE REFERENCE`);
