#!/usr/bin/env node
/**
 * Applies import rewrites suggested by scan-twins.
 * Usage:
 *   node tools/ts-source-pass/apply-import-rewrites.mjs --root . --plan ./.ts-source-pass/import_rewrites.json --write
 * Without --write, it prints a unified diff to stdout.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const args = process.argv.slice(2);
const getArg = (k, d=null) => {
  const i = args.indexOf(k);
  if (i === -1) return d;
  return args[i+1] ?? d;
};
const root = path.resolve(getArg("--root", "."));
const planPath = path.resolve(getArg("--plan", path.join(root, ".ts-source-pass", "import_rewrites.json")));
const write = args.includes("--write");

const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
const rel = (p)=> path.relative(root, p).replace(/\\/g,"/");

function read(p){ return fs.readFileSync(p, "utf8"); }
function sha(s){ return crypto.createHash("sha1").update(s).digest("hex"); }

function specToExtensionless(spec){
  // convert ./x.js -> ./x
  return spec.replace(/\.(jsx|js|mjs|cjs)$/,"");
}

function rewriteFile(filePath, targets){
  let src = read(filePath);
  let changed = src;

  for (const t of targets){
    // rewrite occurrences of the import specifier that exactly matches the JS twin path (relative)
    // We rewrite both "./foo.js" and "./foo.jsx" forms that match the basename.
    const fromBase = t.from.replace(/\\/g,"/").replace(/^\.?\//,"");
    const candidates = [fromBase];
    // also allow extension variants
    const fromNoExt = fromBase.replace(/\.(jsx|js|mjs|cjs)$/,"");
    candidates.push(fromNoExt + ".js", fromNoExt + ".jsx", fromNoExt + ".mjs", fromNoExt + ".cjs");

    for (const spec of candidates){
      const re = new RegExp(`(["'])((?:\\./|\\.\\./)[^"']*?)${spec.replace(/[.*+?^${}()|[\\]\\]/g,"\\$&")}\\1`, "g");
      changed = changed.replace(re, (m,q,pre)=> `${q}${pre}${specToExtensionless(spec)}${q}`);
    }
  }

  if (changed === src) return null;
  return { before: src, after: changed };
}

function groupByImporter(plan){
  const m = new Map();
  for (const item of plan){
    const key = item.importer;
    if (!m.has(key)) m.set(key, []);
    m.get(key).push(item);
  }
  return m;
}

function diffUnified(aPath, bPath, aText, bText){
  // minimal unified diff (line-based)
  const aLines = aText.split(/\r?\n/);
  const bLines = bText.split(/\r?\n/);
  // simple LCS is heavy; use a small diff: show whole file replacement when changed
  // (works fine for review; can swap to 'diff' lib later)
  return [
    `--- a/${aPath}`,
    `+++ b/${bPath}`,
    `@@ -1,${aLines.length} +1,${bLines.length} @@`,
    ...aLines.map(l=>`-${l}`),
    ...bLines.map(l=>`+${l}`),
    ""
  ].join("\n");
}

const grouped = groupByImporter(plan);
const patches = [];
let rewrittenCount = 0;

for (const [importerRel, items] of grouped.entries()){
  const abs = path.join(root, importerRel);
  if (!fs.existsSync(abs)) continue;
  const res = rewriteFile(abs, items);
  if (!res) continue;

  if (write){
    fs.writeFileSync(abs, res.after, "utf8");
    rewrittenCount++;
  } else {
    patches.push(diffUnified(importerRel, importerRel, res.before, res.after));
  }
}

if (!write){
  process.stdout.write(patches.join("\n"));
} else {
  console.log(`Rewrote imports in ${rewrittenCount} files.`);
}
