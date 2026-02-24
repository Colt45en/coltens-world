#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Boundary Guard: DAG enforcement for packages
 * - Parses tsconfig path aliases
 * - Finds workspace packages (packages/*)
 * - Builds dependency edges from actual imports + package.json
 * - Enforces allowed edges (DAG rules from allowed-edges.json)
 * - Reports violations with file + import + chain details
 *
 * Usage:
 *   node tools/boundary/check-boundaries.mjs
 *   node tools/boundary/check-boundaries.mjs --root .
 *   node tools/boundary/check-boundaries.mjs --json
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const argv = new Set(process.argv.slice(2));
const ROOT = getArgValue("--root") ?? path.resolve(__dirname, "../..");
const JSON_MODE = argv.has("--json");
const CONFIG_PATH = path.join(ROOT, "tools/boundary/allowed-edges.json");

function getArgValue(flag) {
  const i = process.argv.indexOf(flag);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return null;
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function listDirs(p) {
  if (!exists(p)) return [];
  return fs
    .readdirSync(p, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

function processEntry(ent, cur, out, exts, ignoreDirs, stack) {
  const full = path.join(cur, ent.name);
  if (ent.isDirectory()) {
    if (!ignoreDirs.has(ent.name)) {
      stack.push(full);
    }
  } else {
    const ext = path.extname(ent.name).toLowerCase();
    if (exts.has(ext)) {
      out.push(full);
    }
  }
}

function walkFiles(dir, exts, ignoreDirs) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    if (!exists(cur)) continue;
    for (const ent of fs.readdirSync(cur, { withFileTypes: true })) {
      processEntry(ent, cur, out, exts, ignoreDirs, stack);
    }
  }
  return out;
}

function normalizeSlashes(p) {
  return p.replaceAll("\\", "/");
}

function loadTsconfigPaths(root) {
  const tsconfigPath = path.join(root, "tsconfig.json");
  if (!exists(tsconfigPath)) return { baseUrl: root, paths: {} };

  const tsconfig = readJson(tsconfigPath);
  const baseUrlRel = tsconfig.compilerOptions?.baseUrl ?? ".";
  const baseUrl = path.resolve(root, baseUrlRel);
  const paths = tsconfig.compilerOptions?.paths ?? {};
  return { baseUrl, paths };
}

function compilePathMatchers(pathsObj) {
  const matchers = [];
  for (const [alias, targets] of Object.entries(pathsObj)) {
    const hasStar = alias.includes("*");
    const escaped = alias.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
    const re = hasStar
      ? new RegExp(String.raw`^` + escaped.replaceAll(String.raw`\*`, "(.+)") + String.raw`$`)
      : new RegExp(String.raw`^` + escaped + String.raw`$`);

    matchers.push({
      alias,
      hasStar,
      re,
      targets: Array.isArray(targets) ? targets : [targets],
    });
  }
  return matchers;
}

function tryResolveTarget(tgt, star, baseUrl, root, hasStar) {
  const replaced = hasStar ? tgt.replace("*", star) : tgt;
  const abs = path.resolve(baseUrl, replaced);
  const hit = resolveFile(abs);
  if (hit) return hit;
  const abs2 = path.resolve(root, replaced);
  return resolveFile(abs2);
}

function resolveWithTsconfigPaths(spec, baseUrl, matchers, root) {
  for (const m of matchers) {
    const mm = spec.match(m.re);
    if (!mm) continue;
    const star = m.hasStar ? mm[1] : null;

    for (const tgt of m.targets) {
      const result = tryResolveTarget(tgt, star, baseUrl, root, m.hasStar);
      if (result) return result;
    }
  }
  return null;
}

function resolveFile(abs) {
  const candidates = [];
  if (exists(abs) && fs.statSync(abs).isFile()) return abs;

  const ext = path.extname(abs);
  if (!ext) {
    for (const e of [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts", ".d.ts"]) {
      candidates.push(abs + e);
    }
  }
  if (exists(abs) && fs.statSync(abs).isDirectory()) {
    for (const e of [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"]) {
      candidates.push(path.join(abs, "index" + e));
    }
  }
  for (const c of candidates) {
    if (exists(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

function getWorkspacePackages(root) {
  const pkgsDir = path.join(root, "packages");
  const dirs = listDirs(pkgsDir);
  const pkgs = [];

  for (const d of dirs) {
    const pkgRoot = path.join(pkgsDir, d);
    const pkgJsonPath = path.join(pkgRoot, "package.json");
    if (!exists(pkgJsonPath)) continue;
    const pkgJson = readJson(pkgJsonPath);
    if (!pkgJson.name) continue;
    pkgs.push({
      name: pkgJson.name,
      dir: pkgRoot,
      srcDir: path.join(pkgRoot, "src"),
      packageJson: pkgJson,
    });
  }

  return pkgs;
}

function indexPackageByDir(packages) {
  const entries = packages
    .map((p) => ({ dir: path.resolve(p.dir), name: p.name }))
    .sort((a, b) => b.dir.length - a.dir.length);
  return entries;
}

function findPackageForFile(fileAbs, dirIndex) {
  const f = path.resolve(fileAbs);
  for (const ent of dirIndex) {
    if (f.startsWith(ent.dir + path.sep) || f === ent.dir) return ent.name;
  }
  return null;
}

function extractImports(sourceText) {
  const out = [];
  const patterns = [
    /\bimport\s+[^;]*?\s+from\s+["']([^"']+)["']/g,
    /\bexport\s+[^;]*?\s+from\s+["']([^"']+)["']/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(sourceText))) out.push(m[1]);
  }
  return out;
}

function isRelative(spec) {
  return spec.startsWith("./") || spec.startsWith("../") || spec.startsWith("/");
}

function isNodeBuiltin(spec) {
  if (spec.startsWith("node:")) return true;
  const builtins = new Set([
    "fs", "path", "url", "crypto", "http", "https", "os", "stream", "zlib", "events",
    "buffer", "util", "child_process", "net", "tls", "timers", "worker_threads"
  ]);
  return builtins.has(spec);
}

function resolveRelativeImport(fromFile, spec) {
  const base = spec.startsWith("/")
    ? path.join(ROOT, spec)
    : path.resolve(path.dirname(fromFile), spec);
  return resolveFile(base);
}

function addEdgeToMap(edges, src, dst, detail) {
  if (!src || !dst || src === dst) return;
  if (!edges.has(src)) edges.set(src, new Map());
  const m = edges.get(src);
  if (!m.has(dst)) m.set(dst, []);
  m.get(dst).push(detail);
}

function processImportSpec(spec, file, srcPkg, config) {
  if (!spec || isNodeBuiltin(spec)) return;

  const { baseUrl, matchers, root, dirIndex, packages, edges } = config;

  if (isRelative(spec)) {
    const resolved = resolveRelativeImport(file, spec);
    if (!resolved) return;
    const dstPkg = findPackageForFile(resolved, dirIndex);
    if (dstPkg && dstPkg !== srcPkg) {
      addEdgeToMap(edges, srcPkg, dstPkg, {
        kind: "import",
        file,
        spec,
        resolved,
      });
    }
    return;
  }

  const resolvedByPaths = resolveWithTsconfigPaths(spec, baseUrl, matchers, root);
  if (resolvedByPaths) {
    const dstPkg = findPackageForFile(resolvedByPaths, dirIndex);
    if (dstPkg && dstPkg !== srcPkg) {
      addEdgeToMap(edges, srcPkg, dstPkg, {
        kind: "import",
        file,
        spec,
        resolved: resolvedByPaths,
      });
    }
    return;
  }

  const dstPkg = packages.find((p) => p.name === spec)?.name ?? null;
  if (dstPkg && dstPkg !== srcPkg) {
    addEdgeToMap(edges, srcPkg, dstPkg, {
      kind: "import",
      file,
      spec,
      resolved: null,
    });
  }
}

function processPackageImportsForFile(file, config) {
  const text = fs.readFileSync(file, "utf8");
  const imports = extractImports(text);
  for (const spec of imports) {
    processImportSpec(spec, file, config.srcPkg, config);
  }
}

function addDeclaredDependenciesEdges(packages, edges) {
  for (const pkg of packages) {
    const deps = {
      ...(pkg.packageJson.dependencies ?? {}),
      ...(pkg.packageJson.devDependencies ?? {}),
      ...(pkg.packageJson.peerDependencies ?? {}),
    };
    for (const depName of Object.keys(deps)) {
      const isWorkspace = packages.some((p) => p.name === depName);
      if (isWorkspace && depName !== pkg.name) {
        addEdgeToMap(edges, pkg.name, depName, {
          kind: "package.json",
          file: path.join(pkg.dir, "package.json"),
          spec: depName,
          resolved: null,
        });
      }
    }
  }
}

function buildImportEdges({ root, packages, tsPaths }) {
  const { baseUrl, paths } = tsPaths;
  const matchers = compilePathMatchers(paths);
  const dirIndex = indexPackageByDir(packages);

  const ignoreDirs = new Set(["node_modules", "dist", "build", ".turbo", ".next", ".git", "coverage", ".vite", ".cache"]);
  const exts = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"]);

  const edges = new Map();

  for (const pkg of packages) {
    const files = walkFiles(pkg.srcDir, exts, ignoreDirs);
    for (const file of files) {
      processPackageImportsForFile(file, {
        srcPkg: pkg.name,
        baseUrl,
        matchers,
        root,
        dirIndex,
        packages,
        edges,
      });
    }
  }

  addDeclaredDependenciesEdges(packages, edges);

  return edges;
}

function loadRules(configPath) {
  if (!exists(configPath)) {
    throw new Error(`Missing boundary config: ${configPath}`);
  }
  const cfg = readJson(configPath);
  const rules = cfg.rules ?? {};
  return rules;
}

function isAllowedEdge(rules, src, dst) {
  const rule = rules[src];
  if (!rule) return false;
  const allow = rule.allow ?? [];
  if (allow.includes("*")) return true;
  return allow.includes(dst);
}

function shortestPath(edges, start, goal) {
  const q = [start];
  const prev = new Map();
  prev.set(start, null);

  while (q.length) {
    const cur = q.shift();
    if (cur === goal) break;
    const nexts = edges.get(cur);
    if (!nexts) continue;
    for (const nxt of nexts.keys()) {
      if (prev.has(nxt)) continue;
      prev.set(nxt, cur);
      q.push(nxt);
    }
  }

  if (!prev.has(goal)) return null;

  const chain = [];
  let x = goal;
  while (x) {
    chain.push(x);
    x = prev.get(x);
  }
  chain.reverse();
  return chain;
}

function main() {
  const tsPaths = loadTsconfigPaths(ROOT);
  const packages = getWorkspacePackages(ROOT);
  const rules = loadRules(CONFIG_PATH);

  const edges = buildImportEdges({
    root: ROOT,
    packages,
    tsPaths,
  });

  // Detect violations
  const violations = [];
  for (const [src, dstMap] of edges.entries()) {
    for (const [dst, details] of dstMap.entries()) {
      if (!isAllowedEdge(rules, src, dst)) {
        for (const d of details) {
          violations.push({
            src,
            dst,
            detail: d,
          });
        }
      }
    }
  }

  // Output
  if (JSON_MODE) {
    process.stdout.write(JSON.stringify({ ok: violations.length === 0, violations }, null, 2));
    process.exit(violations.length ? 2 : 0);
  }

  if (!violations.length) {
    console.log("✅ Boundary Guard: PASS (no forbidden edges)");
    process.exit(0);
  }

  console.log(`❌ Boundary Guard: FAIL (${violations.length} forbidden import(s))\n`);

  const keyMap = new Map();
  for (const v of violations) {
    const k = `${v.src} -> ${v.dst}`;
    if (!keyMap.has(k)) keyMap.set(k, []);
    keyMap.get(k).push(v);
  }

  for (const [k, group] of keyMap.entries()) {
    const [src, dst] = k.split(" -> ");
    console.log(`🚫 Forbidden edge: ${src}  →  ${dst}`);

    const chain = shortestPath(edges, src, dst) ?? [src, dst];
    console.log(`   Package chain: ${chain.join("  →  ")}`);

    const shown = group.slice(0, 8);
    for (const v of shown) {
      const d = v.detail;
      const fileRel = normalizeSlashes(path.relative(ROOT, d.file));
      const resolvedRel = d.resolved ? normalizeSlashes(path.relative(ROOT, d.resolved)) : null;
      console.log(`   - ${d.kind}: ${fileRel}`);
      console.log(`     import: "${d.spec}"${resolvedRel ? `  →  ${resolvedRel}` : ""}`);
    }
    if (group.length > shown.length) {
      console.log(`   … +${group.length - shown.length} more`);
    }
    console.log("");
  }

  console.log("Fix options:");
  console.log("  1) Move shared code to allowed dependency (protocol/contracts/bus/math).");
  console.log("  2) Refactor to invert dependency via bus messages/contracts.");
  console.log("  3) If intended, update tools/boundary/allowed-edges.json (not recommended).");

  process.exit(2);
}

main();
