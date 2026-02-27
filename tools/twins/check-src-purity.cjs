#!/usr/bin/env node
/* tools/twins/check-src-purity.cjs
 *
 * Fails if any .js/.mjs/.cjs/.jsx exists under any src/ folder.
 * (Adjust allowlist if you have intentional JS sources.)
 *
 * Usage:
 *   node tools/twins/check-src-purity.cjs
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "history", ".turbo", ".pnpm", ".next"]);
const BAD_EXT = new Set([".js", ".mjs", ".cjs", ".jsx"]);

function walk(dir, hits) {
  const ents = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(p, hits);
    } else if (e.isFile()) {
      const ext = path.extname(e.name).toLowerCase();
      if (BAD_EXT.has(ext)) hits.push(p);
    }
  }
}

function main() {
  const hits = [];
  walk(ROOT, hits);

  const srcHits = hits.filter((p) => p.replace(/\\/g, "/").includes("/src/"));
  if (!srcHits.length) {
    console.log("✅ src purity check passed (no JS in src/).");
    process.exit(0);
  }

  console.error("❌ src purity check FAILED. JS files found under src/:");
  for (const p of srcHits) {
    console.error("  - " + path.relative(ROOT, p).replace(/\\/g, "/"));
  }
  console.error("\nFix: migrate to TS or move to history/ (or add explicit allowlist logic).");
  process.exit(1);
}

main();
