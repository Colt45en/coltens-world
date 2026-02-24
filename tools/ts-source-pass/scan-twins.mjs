#!/usr/bin/env node
/**
 * TS-as-source twin scanner + patch planner
 * Usage:
 *   node tools/ts-source-pass/scan-twins.mjs --root . --out ./.ts-source-pass
 *
 * Produces:
 *   twin_report.json, twin_report.md, import_rewrites.json, delete_candidates.txt
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
const outDir = path.resolve(getArg("--out", path.join(root, ".ts-source-pass")));
const maxFileBytes = Number(getArg("--max-bytes", String(2_000_000))); // skip huge files by default
const verbose = args.includes("--verbose");

fs.mkdirSync(outDir, { recursive: true });

const exts = new Set([".ts",".tsx",".js",".jsx",".mjs",".cjs"]);
const ignoreDirNames = new Set(["node_modules",".git","dist","build","coverage",".next",".turbo",".cache"]);
const extraIgnorePrefix = [
  path.join(root, "pipeline_results"),
];

function isIgnoredDir(p){
  const bn = path.basename(p);
  if (ignoreDirNames.has(bn)) return true;
  for (const pref of extraIgnorePrefix) if (p.startsWith(pref)) return true;
  return false;
}

function walk(dir, out){
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes:true }); }
  catch { return; }
  for (const e of entries){
    const p = path.join(dir, e.name);
    if (e.isDirectory()){
      if (!isIgnoredDir(p)) walk(p, out);
      continue;
    }
    const ext = path.extname(e.name);
    if (exts.has(ext)) out.push(p);
    else if (e.name === "package.json") out.push(p);
    else if (e.name === "tsconfig.json" || e.name.endsWith(".tsconfig.json")) out.push(p);
  }
}

const files = [];
walk(root, files);

const codeFiles = files.filter(f => exts.has(path.extname(f)));
const packageJsons = files.filter(f => path.basename(f) === "package.json");
const tsconfigs = files.filter(f => path.basename(f) === "tsconfig.json" || f.endsWith(".tsconfig.json"));

const rel = (p)=> path.relative(root, p).replace(/\\/g,"/");

function fileHash(p){
  const st = fs.statSync(p);
  if (st.size > maxFileBytes) return null;
  const b = fs.readFileSync(p);
  return crypto.createHash("sha256").update(b).digest("hex");
}

function readText(p){
  const st = fs.statSync(p);
  if (st.size > maxFileBytes) return null;
  return fs.readFileSync(p, "utf8");
}

const importRe = [
  // import ... from "x"
  /\bimport\s+[^;]*?\s+from\s+["']([^"']+)["']/g,
  // import("x")
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  // export ... from "x"
  /\bexport\s+[^;]*?\s+from\s+["']([^"']+)["']/g,
  // require("x")
  /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
];

function scanImports(text){
  const out = [];
  const scanText = text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  for (const re of importRe){
    let m;
    while ((m = re.exec(scanText)) !== null){
      out.push(m[1]);
    }
  }
  return out;
}

function normalizePathImport(spec){
  // keep as-is for package imports
  if (!spec.startsWith(".") && !spec.startsWith("/")) return null;
  return spec;
}

const importersByTarget = new Map(); // resolved file -> Set(importer file)
const unresolvedImports = [];

function tryResolveImport(fromFile, spec){
  if (!spec) return null;
  const dir = path.dirname(fromFile);
  const base = path.resolve(dir, spec);
  const candidates = [];
  const knownExts = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
  const ext = path.extname(base).toLowerCase();

  // if spec already has a known code extension
  if (ext && knownExts.has(ext)) {
    candidates.push(base);
    const stem = base.slice(0, -ext.length);
    if (ext === ".js" || ext === ".jsx" || ext === ".mjs" || ext === ".cjs") {
      candidates.push(`${stem}.ts`, `${stem}.tsx`);
    }
  } else {
    if (ext && !knownExts.has(ext)) {
      candidates.push(`${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.jsx`, `${base}.mjs`, `${base}.cjs`);
    }

    for (const ext of [".ts",".tsx",".js",".jsx",".mjs",".cjs"]) candidates.push(base + ext);
    for (const ext of [".ts",".tsx",".js",".jsx",".mjs",".cjs"]) candidates.push(path.join(base, "index"+ext));
  }
  for (const c of candidates){
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

for (const f of codeFiles){
  const t = readText(f);
  if (t == null) continue;
  const imps = scanImports(t).map(normalizePathImport).filter(Boolean);
  for (const spec of imps){
    const resolved = tryResolveImport(f, spec);
    if (!resolved) {
      unresolvedImports.push({ importer: rel(f), spec });
      continue;
    }
    const key = path.resolve(resolved);
    if (!importersByTarget.has(key)) importersByTarget.set(key, new Set());
    importersByTarget.get(key).add(path.resolve(f));
  }
}

// Build twin candidates
function baseNoExt(p){
  const ext = path.extname(p);
  return p.slice(0, -ext.length);
}

const byBase = new Map(); // base -> files
for (const f of codeFiles){
  const b = baseNoExt(f);
  if (!byBase.has(b)) byBase.set(b, []);
  byBase.get(b).push(f);
}

function kindForExt(ext){
  if (ext === ".ts" || ext === ".tsx") return "ts";
  if (ext === ".js" || ext === ".jsx" || ext === ".mjs" || ext === ".cjs") return "js";
  return "other";
}

const twins = [];
for (const [b, arr] of byBase.entries()){
  const ts = arr.filter(f => kindForExt(path.extname(f)) === "ts");
  const js = arr.filter(f => kindForExt(path.extname(f)) === "js");
  if (!ts.length || !js.length) continue;
  // if multiple, keep best matching by ext priority
  const tsPick = ts.find(f => f.endsWith(".ts")) ?? ts[0];
  const jsPick = js.find(f => f.endsWith(".js")) ?? js[0];
  twins.push({ base: rel(b), ts: rel(tsPick), js: rel(jsPick) });
}

// Read package entrypoints
const entryRefs = [];
function addEntryRef(pkgPath, field, value){
  if (typeof value === "string") entryRefs.push({ pkg: rel(pkgPath), field, value });
}
function walkExports(pkgPath, node, prefix="exports"){
  if (!node) return;
  if (typeof node === "string") { entryRefs.push({ pkg: rel(pkgPath), field: prefix, value: node }); return; }
  if (typeof node !== "object") return;
  for (const [k,v] of Object.entries(node)){
    const p2 = `${prefix}.${k}`;
    walkExports(pkgPath, v, p2);
  }
}
for (const p of packageJsons){
  let j;
  try { j = JSON.parse(fs.readFileSync(p,"utf8")); } catch { continue; }
  for (const fld of ["main","module","types","typings","browser"]){
    if (j[fld]) addEntryRef(p, fld, j[fld]);
  }
  if (j.exports) walkExports(p, j.exports, "exports");
}

// Score & decide winner
function importerCount(absPath){
  const s = importersByTarget.get(path.resolve(absPath));
  return s ? s.size : 0;
}

function entryHits(relPath){
  return entryRefs.filter(r => {
    // normalize "./x" vs "x"
    const v = r.value.replace(/\\/g,"/");
    const p = relPath.replace(/\\/g,"/");
    return v === p || v === "./"+p || v.endsWith("/"+p);
  });
}

function similarity(tsAbs, jsAbs){
  const ht = fileHash(tsAbs);
  const hj = fileHash(jsAbs);
  if (!ht || !hj) return { sameHash:false, ratio:null };
  if (ht === hj) return { sameHash:true, ratio:1.0 };
  // cheap line-based similarity
  const tt = readText(tsAbs); const tj = readText(jsAbs);
  if (tt == null || tj == null) return { sameHash:false, ratio:null };
  const a = new Set(tt.split(/\r?\n/).map(l=>l.trim()).filter(Boolean));
  const b = new Set(tj.split(/\r?\n/).map(l=>l.trim()).filter(Boolean));
  const inter = [...a].filter(x=>b.has(x)).length;
  const denom = Math.max(1, Math.max(a.size, b.size));
  return { sameHash:false, ratio: inter/denom };
}

function decideTwin(t){
  const tsAbs = path.join(root, t.ts);
  const jsAbs = path.join(root, t.js);
  const tsImp = importerCount(tsAbs);
  const jsImp = importerCount(jsAbs);
  const tsEntries = entryHits(t.ts);
  const jsEntries = entryHits(t.js);
  const sim = similarity(tsAbs, jsAbs);

  // Confidence model (0..1)
  let scoreTS = 0;
  let scoreJS = 0;
  const reasons = [];

  if (tsImp || jsImp){
    if (tsImp > jsImp) { scoreTS += 2; reasons.push(`TS has more importers (${tsImp} vs ${jsImp})`); }
    if (jsImp > tsImp) { scoreJS += 2; reasons.push(`JS has more importers (${jsImp} vs ${tsImp})`); }
    if (tsImp === jsImp && tsImp > 0) reasons.push(`Equal importers (${tsImp})`);
  } else {
    reasons.push("No importers detected (dead/entry-only/or dynamic)");
  }

  if (tsEntries.length) { scoreTS += 2; reasons.push(`TS referenced by package entrypoints (${tsEntries.map(e=>e.field).join(", ")})`); }
  if (jsEntries.length) { scoreJS += 2; reasons.push(`JS referenced by package entrypoints (${jsEntries.map(e=>e.field).join(", ")})`); }

  if (sim.ratio != null){
    if (sim.sameHash) { scoreTS += 1; reasons.push("Exact content hash match"); }
    else if (sim.ratio >= 0.7) { scoreTS += 0.5; reasons.push(`High textual similarity (${(sim.ratio*100).toFixed(0)}%)`); }
    else reasons.push(`Low similarity (${(sim.ratio*100).toFixed(0)}%)`);
  } else {
    reasons.push("Similarity unknown (file too large / unreadable)");
  }

  // Prefer TS if tie, unless JS is an entrypoint and TS is not
  let winner = "ts";
  if (scoreJS > scoreTS) winner = "js";
  if (scoreJS === scoreTS){
    if (jsEntries.length && !tsEntries.length) winner = "js";
    else winner = "ts";
  }

  const margin = Math.abs(scoreTS - scoreJS);
  let confidence = 0.55 + 0.1 * Math.min(3, margin); // 0.55..0.85
  if (sim.sameHash) confidence = Math.max(confidence, 0.9);
  if (!tsImp && !jsImp && !tsEntries.length && !jsEntries.length) confidence = 0.35;

  const action = (winner === "ts")
    ? "rewrite-imports-to-ts-and-mark-js-delete-candidate"
    : "keep-js-source-ts-stale-or-types-only";

  return {
    ...t,
    ts_importers: tsImp,
    js_importers: jsImp,
    ts_entry_refs: tsEntries,
    js_entry_refs: jsEntries,
    similarity: sim,
    winner,
    confidence: Number(confidence.toFixed(2)),
    reasons,
    suggested_action: action
  };
}

const analyzed = twins.map(decideTwin);

// Rank: high confidence first; TS winners first (since TS-as-source pass)
analyzed.sort((a,b)=>{
  const aw = a.winner === "ts" ? 0 : 1;
  const bw = b.winner === "ts" ? 0 : 1;
  if (aw !== bw) return aw - bw;
  if (b.confidence !== a.confidence) return b.confidence - a.confidence;
  return a.base.localeCompare(b.base);
});

// Import rewrite suggestions for TS winners where someone imports the JS file
const rewrites = [];
for (const t of analyzed){
  if (t.winner !== "ts") continue;
  const jsAbs = path.join(root, t.js);
  const importers = importersByTarget.get(path.resolve(jsAbs));
  if (!importers) continue;
  for (const impAbs of importers){
    rewrites.push({
      importer: rel(impAbs),
      from: t.js,
      // prefer extensionless to let resolver pick TS
      toSpecifier: null, // computed by apply step
      reason: "JS twin imported but TS is source-of-truth",
    });
  }
}

const deleteCandidates = analyzed
  .filter(t => t.winner === "ts" && t.confidence >= 0.7)
  .map(t => t.js);

// Write outputs
fs.writeFileSync(path.join(outDir, "twin_report.json"), JSON.stringify({
  root: rel(root),
  stats: {
    code_files: codeFiles.length,
    twin_pairs: analyzed.length,
    rewrite_suggestions: rewrites.length,
    delete_candidates: deleteCandidates.length,
    unresolved_imports: unresolvedImports.length
  },
  twins: analyzed,
  unresolved_imports: unresolvedImports.slice(0, 500)
}, null, 2));

function mdEscape(s){ return s.replace(/\|/g,"\\|"); }

let md = `# TS-as-source twin report\n\n`;
md += `Root: \`${rel(root)}\`\n\n`;
md += `## Summary\n`;
md += `- Code files: **${codeFiles.length}**\n`;
md += `- Twin pairs: **${analyzed.length}**\n`;
md += `- Import rewrite suggestions: **${rewrites.length}**\n`;
md += `- Delete candidates (JS, confidence>=0.70): **${deleteCandidates.length}**\n`;
md += `- Unresolved relative imports (first 500 listed): **${unresolvedImports.length}**\n\n`;

md += `## Ranked twins\n\n`;
md += `| Rank | Base | Winner | Conf | TS importers | JS importers | TS entries | JS entries | Similarity | Reasoning |\n`;
md += `|---:|---|---|---:|---:|---:|---:|---:|---|---|\n`;
analyzed.slice(0, 250).forEach((t, i)=>{
  const sim = t.similarity?.sameHash ? "hash=1.00" : (t.similarity?.ratio==null ? "n/a" : t.similarity.ratio.toFixed(2));
  md += `| ${i+1} | \`${mdEscape(t.base)}\` | **${t.winner}** | ${t.confidence.toFixed(2)} | ${t.ts_importers} | ${t.js_importers} | ${t.ts_entry_refs.length} | ${t.js_entry_refs.length} | ${sim} | ${mdEscape(t.reasons.join("; "))} |\n`;
});
if (analyzed.length > 250) md += `\n> Showing first 250 twins. Full list in \`twin_report.json\`.\n`;

fs.writeFileSync(path.join(outDir, "twin_report.md"), md);
fs.writeFileSync(path.join(outDir, "import_rewrites.json"), JSON.stringify(rewrites, null, 2));
fs.writeFileSync(path.join(outDir, "delete_candidates.txt"), deleteCandidates.join("\\n") + (deleteCandidates.length ? "\\n" : ""));
fs.writeFileSync(path.join(outDir, "unresolved_imports.json"), JSON.stringify(unresolvedImports, null, 2));

if (verbose){
  console.log(`Wrote reports to ${outDir}`);
}
