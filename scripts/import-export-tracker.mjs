#!/usr/bin/env node
/**
 * Import/Export Tracker (lazy incremental)
 * - Parses TS/JS/TSX/JSX using the TypeScript compiler API
 * - Tracks imports, exports, re-exports, and dependency edges
 * - Caches per-file content hash to avoid re-parsing unchanged files
 *
 * Usage:
 *   node scripts/import-export-tracker.mjs --root . --write
 *   node scripts/import-export-tracker.mjs --root . --write --watch
 *   node scripts/import-export-tracker.mjs --root . --write --watch --verbose
 */

import chokidar from "chokidar";
import fg from "fast-glob";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const argv = new Set(process.argv.slice(2));
const getArg = (name, def) => {
  const idx = process.argv.indexOf(name);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : def;
};

const ROOT = path.resolve(getArg("--root", process.cwd()));
const WRITE = argv.has("--write");
const WATCH = argv.has("--watch");
const VERBOSE = argv.has("--verbose");
const DOT = argv.has("--dot");

const OUT_DIR = path.join(ROOT, ".audit", "import-export");
const OUT_INDEX = path.join(OUT_DIR, "index.json");
const OUT_CACHE = path.join(OUT_DIR, "cache.json");
const OUT_DOT = path.join(OUT_DIR, "graph.dot");
const OUT_CYCLES = path.join(OUT_DIR, "cycles.json");
const OUT_OFFENDERS = path.join(OUT_DIR, "offenders.json");
const OUT_BARRELS = path.join(OUT_DIR, "barrels.json");

const DEFAULT_GLOBS = [
  "**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}",
  "!**/node_modules/**",
  "!**/dist/**",
  "!**/build/**",
  "!**/.next/**",
  "!**/.turbo/**",
  "!**/.cache/**",
  "!**/.git/**",
  "!**/coverage/**",
  "!**/out/**",
];

const nowIso = () => new Date().toISOString();

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function readJsonIfExists(p, fallback) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(p, obj) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

function sha1(text) {
  return crypto.createHash("sha1").update(text).digest("hex");
}

function readTextSafe(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

function isRelative(spec) {
  return spec.startsWith("./") || spec.startsWith("../");
}

function normalizeSlash(p) {
  return p.replaceAll("\\", "/");
}

function relFromRoot(abs) {
  return normalizeSlash(path.relative(ROOT, abs));
}

function tryResolveRelative(fromFileAbs, spec) {
  const base = path.resolve(path.dirname(fromFileAbs), spec);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    `${base}.mts`,
    `${base}.cts`,
    `${base}.mjs`,
    `${base}.cjs`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
    path.join(base, "index.js"),
    path.join(base, "index.jsx"),
    path.join(base, "index.mts"),
    path.join(base, "index.cts"),
    path.join(base, "index.mjs"),
    path.join(base, "index.cjs"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

function loadTsConfig(root) {
  const tsconfigPath = ts.findConfigFile(root, ts.sys.fileExists, "tsconfig.json");
  if (!tsconfigPath) return null;

  const read = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  if (read.error) return null;

  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, path.dirname(tsconfigPath));
  const options = parsed.options ?? {};
  const baseUrl = options.baseUrl
    ? path.resolve(path.dirname(tsconfigPath), options.baseUrl)
    : null;
  const pathsMap = options.paths ?? null;

  return {
    tsconfigPath,
    baseUrl,
    pathsMap,
  };
}

function compilePathPatterns(pathsMap) {
  if (!pathsMap) return [];
  const matchers = [];

  for (const [key, targets] of Object.entries(pathsMap)) {
    if (!Array.isArray(targets) || targets.length === 0) continue;

    const starIdx = key.indexOf("*");
    const prefix = starIdx >= 0 ? key.slice(0, starIdx) : key;
    const suffix = starIdx >= 0 ? key.slice(starIdx + 1) : "";

    matchers.push({
      key,
      prefix,
      suffix,
      hasStar: starIdx >= 0,
      targets,
    });
  }
  return matchers;
}

function tryResolveWildcardMatcher(spec, m, baseUrl, fromFileAbs) {
  if (!spec.startsWith(m.prefix) || !spec.endsWith(m.suffix)) return null;
  const middle = spec.slice(m.prefix.length, spec.length - m.suffix.length);

  for (const t of m.targets) {
    const replaced = t.replace("*", middle);
    const abs = path.resolve(baseUrl, replaced);
    const resolved = tryResolveRelative(
      fromFileAbs,
      normalizeSlash(path.relative(path.dirname(fromFileAbs), abs)),
    );
    if (resolved) return resolved;
    const direct = tryResolveAbsolute(abs);
    if (direct) return direct;
  }
  return null;
}

function tryResolveExactMatcher(spec, m, baseUrl) {
  if (spec !== m.prefix) return null;
  for (const t of m.targets) {
    const abs = path.resolve(baseUrl, t);
    const direct = tryResolveAbsolute(abs);
    if (direct) return direct;
  }
  return null;
}

function tryResolveTsPaths(spec, fromFileAbs, tsconf) {
  if (!tsconf?.baseUrl || !tsconf?.pathsMap) return null;
  const baseUrl = tsconf.baseUrl;
  const matchers = compilePathPatterns(tsconf.pathsMap);

  for (const m of matchers) {
    const resolved = m.hasStar
      ? tryResolveWildcardMatcher(spec, m, baseUrl, fromFileAbs)
      : tryResolveExactMatcher(spec, m, baseUrl);
    if (resolved) return resolved;
  }
  return null;
}

function tryResolveAbsolute(absBase) {
  const candidates = [
    absBase,
    `${absBase}.ts`,
    `${absBase}.tsx`,
    `${absBase}.js`,
    `${absBase}.jsx`,
    `${absBase}.mts`,
    `${absBase}.cts`,
    `${absBase}.mjs`,
    `${absBase}.cjs`,
    path.join(absBase, "index.ts"),
    path.join(absBase, "index.tsx"),
    path.join(absBase, "index.js"),
    path.join(absBase, "index.jsx"),
    path.join(absBase, "index.mts"),
    path.join(absBase, "index.cts"),
    path.join(absBase, "index.mjs"),
    path.join(absBase, "index.cjs"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

function parseFile(fileAbs) {
  const text = readTextSafe(fileAbs);
  if (text == null) return null;

  const kind = (() => {
    const ext = path.extname(fileAbs).toLowerCase();
    switch (ext) {
      case ".ts":
        return ts.ScriptKind.TS;
      case ".tsx":
        return ts.ScriptKind.TSX;
      case ".js":
        return ts.ScriptKind.JS;
      case ".jsx":
        return ts.ScriptKind.JSX;
      case ".mts":
        return ts.ScriptKind.TS;
      case ".cts":
        return ts.ScriptKind.TS;
      case ".mjs":
        return ts.ScriptKind.JS;
      case ".cjs":
        return ts.ScriptKind.JS;
      default:
        return ts.ScriptKind.Unknown;
    }
  })();

  const source = ts.createSourceFile(fileAbs, text, ts.ScriptTarget.ES2022, true, kind);

  const imports = [];
  const exports = [];
  const reexports = [];

  function pushImport(spec, detail) {
    imports.push({ spec, ...detail });
  }

  function pushExport(detail) {
    exports.push(detail);
  }

  function pushReexport(spec, kind, names) {
    reexports.push({ spec, kind, names: names ?? null });
  }

  function visit(node) {
    // import ... from "x";
    if (ts.isImportDeclaration(node)) {
      const spec =
        node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)
          ? node.moduleSpecifier.text
          : null;
      if (spec) {
        const clause = node.importClause;
        const typeOnly = clause?.isTypeOnly ?? false;

        if (!clause) {
          pushImport(spec, { kind: "sideEffect", typeOnly });
        } else {
          const names = [];
          let hasDefault = false;
          let hasNamespace = false;

          if (clause.name) {
            hasDefault = true;
          }
          if (clause.namedBindings) {
            if (ts.isNamespaceImport(clause.namedBindings)) {
              hasNamespace = true;
            } else if (ts.isNamedImports(clause.namedBindings)) {
              for (const el of clause.namedBindings.elements) {
                names.push(el.name.text);
              }
            }
          }

          pushImport(spec, {
            kind: "import",
            names: names.length ? names : undefined,
            default: hasDefault || undefined,
            namespace: hasNamespace || undefined,
            typeOnly: typeOnly || undefined,
          });
        }
      }
    }

    // import("x") dynamic
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const arg0 = node.arguments[0];
      if (arg0 && ts.isStringLiteral(arg0)) {
        pushImport(arg0.text, { kind: "dynamicImport" });
      }
    }

    // export const foo = ...
    if (
      ts.isVariableStatement(node) &&
      node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      const names = [];
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) names.push(decl.name.text);
      }
      if (names.length) pushExport({ kind: "exportNamed", names });
    }

    // export function/class/interface/type ...
    if (
      (ts.isFunctionDeclaration(node) ||
        ts.isClassDeclaration(node) ||
        ts.isInterfaceDeclaration(node) ||
        ts.isTypeAliasDeclaration(node) ||
        ts.isEnumDeclaration(node)) &&
      node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      const name = node.name?.text;
      if (name) pushExport({ kind: "exportNamed", names: [name] });
    }

    // export default ...
    if (ts.isExportAssignment(node)) {
      pushExport({ kind: "exportDefault", default: true });
    }

    // export { a, b as c } from "x"
    if (ts.isExportDeclaration(node)) {
      const spec =
        node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)
          ? node.moduleSpecifier.text
          : undefined;

      if (!node.exportClause) {
        // export * from "x"
        if (spec) pushReexport(spec, "exportAll", null);
      } else if (ts.isNamedExports(node.exportClause)) {
        const names = node.exportClause.elements.map((e) => e.name.text);
        if (spec) {
          pushReexport(spec, "exportNamed", names);
        } else {
          pushExport({ kind: "exportNamed", names });
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(source);

  return {
    file: relFromRoot(fileAbs),
    abs: fileAbs,
    hash: sha1(text),
    imports,
    exports,
    reexports,
  };
}

function buildIndex(existingIndex, fileRecordsByPath) {
  const tsconf = loadTsConfig(ROOT);

  const edges = [];
  const unresolved = [];

  for (const rec of Object.values(fileRecordsByPath)) {
    for (const imp of rec.imports) {
      const spec = imp.spec;
      let resolvedAbs = null;

      if (isRelative(spec)) {
        resolvedAbs = tryResolveRelative(rec.abs, spec);
      } else {
        resolvedAbs = tryResolveTsPaths(spec, rec.abs, tsconf);
      }

      if (resolvedAbs) {
        const to = relFromRoot(resolvedAbs);
        edges.push({
          from: rec.file,
          to,
          spec,
          kind: imp.kind,
        });
      } else {
        if (!isRelative(spec) && !tryResolveTsPaths(spec, rec.abs, tsconf)) {
          continue;
        }
        unresolved.push({
          from: rec.file,
          spec,
          kind: imp.kind,
        });
      }
    }

    for (const rx of rec.reexports) {
      const spec = rx.spec;
      let resolvedAbs = null;

      if (isRelative(spec)) {
        resolvedAbs = tryResolveRelative(rec.abs, spec);
      } else {
        resolvedAbs = tryResolveTsPaths(spec, rec.abs, loadTsConfig(ROOT));
      }

      if (resolvedAbs) {
        const to = relFromRoot(resolvedAbs);
        edges.push({
          from: rec.file,
          to,
          spec,
          kind: rx.kind,
          reexport: true,
        });
      } else {
        if (!isRelative(spec)) continue;
        unresolved.push({
          from: rec.file,
          spec,
          kind: rx.kind,
          reexport: true,
        });
      }
    }
  }

  // Reverse index: who imports each file
  const importers = {};
  for (const e of edges) {
    if (!importers[e.to]) importers[e.to] = [];
    importers[e.to].push({ from: e.from, spec: e.spec, kind: e.kind, reexport: !!e.reexport });
  }

  // Stats
  const files = Object.keys(fileRecordsByPath).sort();
  const index = {
    meta: {
      generatedAt: nowIso(),
      root: normalizeSlash(ROOT),
      fileCount: files.length,
      edgeCount: edges.length,
      unresolvedCount: unresolved.length,
    },
    files: {},
    edges,
    unresolved,
    importers,
  };

  for (const f of files) {
    const rec = fileRecordsByPath[f];
    index.files[f] = {
      imports: rec.imports,
      exports: rec.exports,
      reexports: rec.reexports,
      hash: rec.hash,
    };
  }

  return index;
}

function toDot(index) {
  const lines = [];
  lines.push("digraph Imports {");
  lines.push('  rankdir="LR";');
  lines.push("  node [shape=box];");

  for (const e of index.edges) {
    const from = e.from.replaceAll('"', '\\"');
    const to = e.to.replaceAll('"', '\\"');
    lines.push(`  "${from}" -> "${to}";`);
  }

  lines.push("}");
  return lines.join("\n");
}

function loadAllFiles() {
  const matches = fg.sync(DEFAULT_GLOBS, {
    cwd: ROOT,
    absolute: true,
    onlyFiles: true,
    followSymbolicLinks: false,
  });
  return matches.map((p) => path.resolve(p));
}

function isTrackedFile(abs) {
  const rel = relFromRoot(abs);
  if (rel.startsWith("node_modules/")) return false;
  if (rel.startsWith("dist/")) return false;
  if (rel.startsWith("build/")) return false;
  if (rel.startsWith(".next/")) return false;
  if (rel.startsWith(".turbo/")) return false;
  if (rel.startsWith(".git/")) return false;
  if (rel.startsWith("coverage/")) return false;
  if (rel.startsWith(".audit/")) return false;
  const ext = path.extname(abs).toLowerCase();
  return [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"].includes(ext);
}

function loadState() {
  const cache = readJsonIfExists(OUT_CACHE, { files: {} });
  const priorIndex = readJsonIfExists(OUT_INDEX, null);
  return { cache, priorIndex };
}

function saveState(cache, index) {
  if (!WRITE) return;
  ensureDir(OUT_DIR);
  writeJson(OUT_CACHE, cache);
  writeJson(OUT_INDEX, index);
  if (DOT) fs.writeFileSync(OUT_DOT, toDot(index), "utf8");
}

function log(...args) {
  console.log(...args);
}

function vlog(...args) {
  if (VERBOSE) console.log(...args);
}

function removeFileFromCache(cache, rel) {
  if (cache.files && cache.files[rel]) delete cache.files[rel];
}

function upsertRecord(cache, record) {
  cache.files ||= {};
  cache.files[record.file] = {
    hash: record.hash,
    updatedAt: nowIso(),
  };
}

function isBarrelFile(relFile) {
  const base = path.posix.basename(relFile);
  return (
    base === "index.ts" ||
    base === "index.tsx" ||
    base === "index.js" ||
    base === "index.mjs" ||
    base === "index.cjs"
  );
}

function buildAdjacency(index) {
  const adj = {};
  for (const f of Object.keys(index.files)) adj[f] = [];
  for (const e of index.edges) {
    if (!adj[e.from]) adj[e.from] = [];
    adj[e.from].push(e.to);
  }
  return adj;
}

function findCyclesTarjan(index) {
  const adj = buildAdjacency(index);

  let indexCounter = 0;
  const idx = {};
  const low = {};
  const stack = [];
  const onStack = new Set();
  const sccs = [];

  function strongconnect(v) {
    idx[v] = indexCounter;
    low[v] = indexCounter;
    indexCounter++;
    stack.push(v);
    onStack.add(v);

    for (const w of adj[v] ?? []) {
      if (idx[w] === undefined) {
        strongconnect(w);
        low[v] = Math.min(low[v], low[w]);
      } else if (onStack.has(w)) {
        low[v] = Math.min(low[v], idx[w]);
      }
    }

    if (low[v] === idx[v]) {
      const component = [];
      while (true) {
        const w = stack.pop();
        if (!w) break;
        onStack.delete(w);
        component.push(w);
        if (w === v) break;
      }
      sccs.push(component);
    }
  }

  for (const v of Object.keys(adj)) {
    if (idx[v] === undefined) strongconnect(v);
  }

  const edgesSet = new Set(index.edges.map((e) => `${e.from}→${e.to}`));
  const cycles = sccs
    .map((c) => c.slice().sort())
    .filter((c) => {
      if (c.length > 1) return true;
      const only = c[0];
      return edgesSet.has(`${only}→${only}`);
    })
    .map((nodes) => {
      const nodeSet = new Set(nodes);
      let internalEdges = 0;
      for (const e of index.edges) {
        if (nodeSet.has(e.from) && nodeSet.has(e.to)) internalEdges++;
      }
      return {
        nodes,
        size: nodes.length,
        internalEdges,
        severity: nodes.length * 10 + internalEdges,
      };
    })
    .sort((a, b) => b.severity - a.severity);

  return cycles;
}

function computeOffenders(index) {
  const fanOut = {};
  const fanIn = {};
  const dynamicImports = {};
  const externalImports = {};
  const reexportCount = {};
  const barrelHubScore = {};

  for (const f of Object.keys(index.files)) {
    fanOut[f] = 0;
    fanIn[f] = 0;
    dynamicImports[f] = 0;
    externalImports[f] = 0;
    reexportCount[f] = 0;
    barrelHubScore[f] = 0;
  }

  for (const [file, info] of Object.entries(index.files)) {
    for (const imp of info.imports ?? []) {
      if (imp.kind === "dynamicImport") dynamicImports[file] = (dynamicImports[file] ?? 0) + 1;
      if (!isRelative(imp.spec)) externalImports[file] = (externalImports[file] ?? 0) + 1;
    }
    reexportCount[file] = info.reexports?.length ?? 0;
  }

  for (const e of index.edges) {
    fanOut[e.from] = (fanOut[e.from] ?? 0) + 1;
    fanIn[e.to] = (fanIn[e.to] ?? 0) + 1;
    if (isBarrelFile(e.from) && e.reexport) {
      barrelHubScore[e.from] = (barrelHubScore[e.from] ?? 0) + 1;
    }
  }

  function topN(map, n = 25) {
    return Object.entries(map)
      .map(([file, score]) => ({ file, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, n);
  }

  return {
    generatedAt: nowIso(),
    fanOutTop: topN(fanOut),
    fanInTop: topN(fanIn),
    dynamicImportTop: topN(dynamicImports),
    externalImportTop: topN(externalImports),
    reexportTop: topN(reexportCount),
    barrelHubTop: topN(barrelHubScore),
  };
}

function resolveEffectiveExports(index) {
  const memo = {};
  const visiting = new Set();

  function getLocalExportNames(file) {
    const info = index.files[file];
    const out = new Set();
    let hasDefault = false;

    for (const ex of info?.exports ?? []) {
      if (ex.kind === "exportDefault") hasDefault = true;
      if (ex.kind === "exportNamed") for (const n of ex.names ?? []) out.add(n);
    }
    return { out, hasDefault };
  }

  function resolveFile(file) {
    if (memo[file]) return memo[file];
    if (visiting.has(file)) {
      memo[file] = { exported: new Set(), hasDefault: false, conflicts: {}, sources: {} };
      return memo[file];
    }
    visiting.add(file);

    const local = getLocalExportNames(file);
    const exported = new Set(local.out);
    let hasDefault = local.hasDefault;

    const sources = {};
    const conflicts = {};

    for (const n of exported) sources[n] = [file];

    const rx = index.files[file]?.reexports ?? [];
    for (const r of rx) {
      const targetEdges = index.edges.filter(
        (e) => e.from === file && e.reexport && e.spec === r.spec,
      );
      for (const te of targetEdges) {
        const target = te.to;
        const resolved = resolveFile(target);

        if (r.kind === "exportAll") {
          for (const n of resolved.exported) {
            if (exported.has(n)) {
              const prev = sources[n] ?? [];
              const next = Array.from(new Set([...prev, target]));
              sources[n] = next;
              if (next.length > 1) conflicts[n] = next;
            } else {
              exported.add(n);
              sources[n] = [target];
            }
          }
        } else if (r.kind === "exportNamed") {
          const names = r.names ?? [];
          for (const n of names) {
            if (resolved.exported.has(n)) {
              if (!exported.has(n)) {
                exported.add(n);
                sources[n] = [target];
              } else {
                const prev = sources[n] ?? [];
                const next = Array.from(new Set([...prev, target]));
                sources[n] = next;
                if (next.length > 1) conflicts[n] = next;
              }
            }
          }
        }
      }
    }

    visiting.delete(file);
    memo[file] = { exported, hasDefault, conflicts, sources };
    return memo[file];
  }

  const effective = {};
  for (const file of Object.keys(index.files)) {
    const r = resolveFile(file);
    effective[file] = {
      names: Array.from(r.exported).sort(),
      hasDefault: r.hasDefault,
      conflictNames: Object.keys(r.conflicts).sort(),
      conflicts: r.conflicts,
    };
  }

  const barrels = Object.keys(index.files)
    .filter(isBarrelFile)
    .sort()
    .map((file) => ({
      file,
      scope: index.files[file]?.scope,
      exportCount: effective[file].names.length + (effective[file].hasDefault ? 1 : 0),
      namedExports: effective[file].names,
      hasDefault: effective[file].hasDefault,
      conflictNames: effective[file].conflictNames,
      conflicts: effective[file].conflicts,
    }))
    .sort((a, b) => b.exportCount - a.exportCount);

  return {
    generatedAt: nowIso(),
    effective,
    barrels,
  };
}

function mainOnce() {
  ensureDir(OUT_DIR);
  const { cache } = loadState();

  const all = loadAllFiles();
  const fileRecordsByPath = {};

  let parsed = 0;
  let skipped = 0;

  for (const abs of all) {
    const rec = parseFile(abs);
    if (!rec) continue;

    const prev = cache.files?.[rec.file];
    if (prev && prev.hash === rec.hash) {
      skipped++;
    } else {
      parsed++;
      upsertRecord(cache, rec);
    }

    fileRecordsByPath[rec.file] = rec;
  }

  const currentSet = new Set(Object.keys(fileRecordsByPath));
  for (const f of Object.keys(cache.files ?? {})) {
    if (!currentSet.has(f)) delete cache.files[f];
  }

  const index = buildIndex(null, fileRecordsByPath);

  log(`✅ import-export index built`);
  log(
    `   files=${index.meta.fileCount} edges=${index.meta.edgeCount} unresolved=${index.meta.unresolvedCount}`,
  );
  vlog(`   parsed=${parsed} skipped=${skipped}`);

  // Compute analytics
  const cycles = findCyclesTarjan(index);
  const offenders = computeOffenders(index);
  const barrels = resolveEffectiveExports(index);

  saveState(cache, index);

  // Write analytics
  if (WRITE) {
    writeJson(OUT_CYCLES, { generatedAt: nowIso(), cycles });
    writeJson(OUT_OFFENDERS, offenders);
    writeJson(OUT_BARRELS, barrels);
  }
}

function mainWatch() {
  ensureDir(OUT_DIR);
  const { cache } = loadState();

  const fileRecordsByPath = {};
  for (const abs of loadAllFiles()) {
    const rec = parseFile(abs);
    if (rec) {
      fileRecordsByPath[rec.file] = rec;
      upsertRecord(cache, rec);
    }
  }

  let index = buildIndex(null, fileRecordsByPath);
  saveState(cache, index);

  log(`👀 watching for changes...`);
  log(`   output: ${relFromRoot(OUT_INDEX)}`);

  const watcher = chokidar.watch(ROOT, {
    ignored: (p) => {
      const abs = path.resolve(p);
      if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) return false;
      return !isTrackedFile(abs);
    },
    ignoreInitial: true,
    persistent: true,
  });

  const rebuild = (why) => {
    index = buildIndex(index, fileRecordsByPath);
    saveState(cache, index);

    // Compute analytics
    const cycles = findCyclesTarjan(index);
    const offenders = computeOffenders(index);
    const barrels = resolveEffectiveExports(index);

    // Write analytics
    if (WRITE) {
      writeJson(OUT_CYCLES, { generatedAt: nowIso(), cycles });
      writeJson(OUT_OFFENDERS, offenders);
      writeJson(OUT_BARRELS, barrels);
    }

    log(
      `🔁 updated (${why}) files=${index.meta.fileCount} edges=${index.meta.edgeCount} unresolved=${index.meta.unresolvedCount}`,
    );
  };

  const onChange = (abs) => {
    if (!isTrackedFile(abs)) return;
    const rec = parseFile(abs);
    const rel = rec ? rec.file : relFromRoot(abs);

    if (!rec) {
      removeFileFromCache(cache, rel);
      delete fileRecordsByPath[rel];
      rebuild(`remove/bad-parse ${rel}`);
      return;
    }

    const prevHash = cache.files?.[rel]?.hash;
    if (prevHash === rec.hash) return;

    fileRecordsByPath[rel] = rec;
    upsertRecord(cache, rec);
    rebuild(`change ${rel}`);
  };

  const onUnlink = (abs) => {
    const rel = relFromRoot(abs);
    removeFileFromCache(cache, rel);
    delete fileRecordsByPath[rel];
    rebuild(`unlink ${rel}`);
  };

  watcher
    .on("add", (p) => onChange(path.resolve(p)))
    .on("change", (p) => onChange(path.resolve(p)))
    .on("unlink", (p) => onUnlink(path.resolve(p)));
}

if (WATCH) mainWatch();
else mainOnce();
