#!/usr/bin/env node
"use strict";
/**
 * enforce-contracts-truth.js
 *
 * Ensures contracts mirrors (packages/engine/src/contracts, python/contracts_v1, etc.)
 * always match the source of truth (packages/contracts/schemas/).
 *
 * Usage:
 *   node scripts/enforce-contracts-truth.js       # Check only (fail if drift)
 *   node scripts/enforce-contracts-truth.js --fix # Sync mirrors from truth
 */

const fs = require("node:fs");
const fsp = require("node:fs").promises;
const path = require("node:path");
const crypto = require("node:crypto");
const cp = require("node:child_process");

function die(msg) {
  console.error(`❌ enforce-contracts-truth: ${msg}`);
  process.exit(1);
}

function info(msg) {
  console.log(`ℹ️  enforce-contracts-truth: ${msg}`);
}

function ok(msg) {
  console.log(`✅ enforce-contracts-truth: ${msg}`);
}

function repoRoot() {
  try {
    return cp.execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
  } catch {
    die("Not in a git repo (git rev-parse failed).");
  }
}

async function listFilesRecursive(dir) {
  const out = [];

  async function walk(d) {
    if (!fs.existsSync(d)) return;

    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        // Skip junk
        if (["node_modules", "dist", ".turbo", ".git", ".venv", "__pycache__"].includes(e.name)) {
          continue;
        }
        await walk(p);
      } else if (e.isFile()) {
        out.push(p);
      }
    }
  }

  await walk(dir);
  return out;
}

async function sha256File(fp) {
  const content = await fsp.readFile(fp);
  const hash = crypto.createHash("sha256");
  hash.update(content);
  return hash.digest("hex");
}

async function ensureDir(p) {
  try {
    await fsp.mkdir(p, { recursive: true });
  } catch (e) {
    if (e.code !== "EEXIST") throw e;
  }
}

async function copyFileEnsuringDir(src, dst) {
  await ensureDir(path.dirname(dst));
  await fsp.copyFile(src, dst);
}

async function removeExtraneousFiles(rootDir, allowedRelSet) {
  const files = await listFilesRecursive(rootDir);
  for (const abs of files) {
    const rel = path.relative(rootDir, abs).replace(/\\/g, "/");
    if (!allowedRelSet.has(rel)) {
      try {
        await fsp.unlink(abs);
        info(`Removed extra: ${rel}`);
      } catch (e) {
        console.warn(`Warning: Could not remove ${rel}: ${e.message}`);
      }
    }
  }
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const FIX = args.has("--fix");

  const ROOT = repoRoot();

  const SOURCE = path.join(ROOT, "packages", "contracts", "schemas");
  if (!fs.existsSync(SOURCE)) {
    die(`Source contracts dir not found: ${SOURCE}`);
  }

  const MIRRORS = [
    { name: "engine", dir: path.join(ROOT, "packages", "engine", "src", "contracts") },
    { name: "python_contracts_v1", dir: path.join(ROOT, "python", "contracts_v1") },
  ];

  info(`Truth: ${path.relative(ROOT, SOURCE)}`);
  info(`Mode: ${FIX ? "FIX (sync mirrors)" : "CHECK (fail on drift)"}`);

  // Build truth map: rel -> hash
  const truthFilesAbs = await listFilesRecursive(SOURCE);
  const truthMap = new Map(); // rel -> hash

  for (const abs of truthFilesAbs) {
    const rel = path.relative(SOURCE, abs).replace(/\\/g, "/");
    const hash = await sha256File(abs);
    truthMap.set(rel, hash);
  }

  if (truthMap.size === 0) {
    die("Truth dir has no files.");
  }

  info(`Truth contains ${truthMap.size} file(s).`);

  let hadError = false;

  for (const m of MIRRORS) {
    const mirrorDir = m.dir;
    const mirrorName = m.name;

    if (!fs.existsSync(mirrorDir)) {
      info(`Mirror missing (skipping): ${mirrorName} → ${path.relative(ROOT, mirrorDir)}`);
      continue;
    }

    const mirrorFilesAbs = await listFilesRecursive(mirrorDir);
    const mirrorSet = new Set(
      mirrorFilesAbs.map((abs) => path.relative(mirrorDir, abs).replace(/\\/g, "/"))
    );

    const drift = [];
    const missing = [];
    const extra = [];

    // Check for extra files in mirror
    for (const rel of mirrorSet) {
      if (!truthMap.has(rel)) {
        extra.push(rel);
      }
    }

    // Check for missing or drifted files
    for (const [rel, truthHash] of truthMap.entries()) {
      const target = path.join(mirrorDir, rel);
      if (!fs.existsSync(target)) {
        missing.push(rel);
      } else {
        const h = await sha256File(target);
        if (h !== truthHash) {
          drift.push(rel);
        }
      }
    }

    if (missing.length === 0 && drift.length === 0 && extra.length === 0) {
      ok(`Mirror OK: ${mirrorName}`);
      continue;
    }

    if (!FIX) {
      hadError = true;
      console.error(`\n❌ Mirror drift detected: ${mirrorName}`);
      console.error(`   Path: ${path.relative(ROOT, mirrorDir)}`);

      if (missing.length) {
        console.error(`\n   Missing (${missing.length}):`);
        for (const r of missing.slice(0, 5)) console.error(`     - ${r}`);
        if (missing.length > 5) console.error(`     ... and ${missing.length - 5} more`);
      }

      if (drift.length) {
        console.error(`\n   Changed (${drift.length}):`);
        for (const r of drift.slice(0, 5)) console.error(`     - ${r}`);
        if (drift.length > 5) console.error(`     ... and ${drift.length - 5} more`);
      }

      if (extra.length) {
        console.error(`\n   Extra (${extra.length}):`);
        for (const r of extra.slice(0, 5)) console.error(`     - ${r}`);
        if (extra.length > 5) console.error(`     ... and ${extra.length - 5} more`);
      }
    } else {
      info(`\n🔧 Fixing mirror: ${mirrorName}`);

      // Remove extra files
      const allowed = new Set(truthMap.keys());
      await removeExtraneousFiles(mirrorDir, allowed);

      // Sync missing + drifted files
      for (const rel of truthMap.keys()) {
        const src = path.join(SOURCE, rel);
        const dst = path.join(mirrorDir, rel);
        await copyFileEnsuringDir(src, dst);
      }

      ok(`Mirror synced: ${mirrorName}`);
    }
  }

  console.error("");
  if (hadError) {
    die("Contracts mirrors drifted from truth. Run with --fix to auto-sync or use codegen pipeline.");
  } else {
    ok("All mirrors match truth.");
  }
}

main().catch((e) => {
  die(e && e.stack ? e.stack : String(e));
});
