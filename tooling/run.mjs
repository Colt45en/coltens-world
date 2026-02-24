#!/usr/bin/env node
/* tooling/run.mjs
 *
 * Single entrypoint for all tooling tasks.
 *
 * Features:
 * - Runs a tool by id (or runs "all")
 * - Captures filesystem change-set (added/modified/deleted) + SHA256 hashes
 * - Writes manifests under tooling/dist/<toolId>/<timestamp>/
 * - Designed for determinism auditing: run twice, second run should be "no changes"
 */

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let REPO_ROOT = path.dirname(__dirname); // go up from tooling/ to repo root

// Fallback: if tools.manifest.json is not found, traverse up looking for package.json
async function findRepoRoot() {
  let current = REPO_ROOT;
  for (let i = 0; i < 10; i++) {
    try {
      await fs.stat(path.join(current, "tooling", "tools.manifest.json"));
      return current; // found it
    } catch {
      const parent = path.dirname(current);
      if (parent === current) break; // reached filesystem root
      current = parent;
    }
  }
  return REPO_ROOT; // fallback to original
}

REPO_ROOT = await findRepoRoot();
const DIST_ROOT = path.join(REPO_ROOT, "tooling", "dist");
const BASELINE_ROOT = path.join(REPO_ROOT, "tooling", "baselines");

const DEFAULT_IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  "tooling/dist",
  "dist",
  "build",
  ".next",
  ".turbo",
  ".vite",
  ".cache",
  ".pytest_cache",
  ".venv",
  "venv"
]);

// ----------------------------- CLI -----------------------------

function parseArgs(argv) {
  const args = {
    cmd: "run",
    toolId: null,
    all: false,
    json: false,
    verbose: false,
    list: false,
    expectedMode: null
  };

  const positionals = [];
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") args.json = true;
    else if (a === "--verbose" || a === "-v") args.verbose = true;
    else if (a === "--list") args.list = true;
    else if (a.startsWith("--expected-mode=")) args.expectedMode = a.split("=")[1];
    else if (a === "--expected-mode") args.expectedMode = argv[++i];
    else positionals.push(a);
  }

  if (positionals[0] === "baseline") {
    args.cmd = "baseline";
    positionals.shift();
  }

  if (positionals[0] === "all") {
    args.all = true;
    positionals.shift();
  } else if (positionals[0] && !positionals[0].startsWith("--")) {
    args.toolId = positionals.shift();
  }

  args.rest = positionals;
  return args;
}

function usage() {
  return `
Usage:
  node tooling/run.mjs --list
  node tooling/run.mjs <toolId> [--json] [--verbose] [--expected-mode strict|warn]
  node tooling/run.mjs all [--json] [--verbose] [--expected-mode strict|warn]
  node tooling/run.mjs baseline <toolId|all> [--verbose]

Examples:
  node tooling/run.mjs codegen.gen_ts_types --expected-mode warn
  node tooling/run.mjs baseline codegen.gen_ts_types
  node tooling/run.mjs all --verbose
`.trim();
}

// ----------------------------- IO -----------------------------

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function writeBaseline(toolId, baseline) {
  await ensureDir(BASELINE_ROOT);
  const p = path.join(BASELINE_ROOT, `${toolId}.baseline.json`);
  await fs.writeFile(p, JSON.stringify(baseline, null, 2) + "\n", "utf8");
  return p;
}

function normalizeRel(filePath) {
  const rel = path.relative(REPO_ROOT, filePath);
  return rel.split(path.sep).join("/");
}

function suggestExpectedOutputsFromPaths(paths) {
  const norm = paths.map(normalizeRel);
  norm.sort((a, b) => a.localeCompare(b));

  const byDir = new Map();
  for (const p of norm) {
    const dir = p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "";
    const arr = byDir.get(dir) ?? [];
    arr.push(p);
    byDir.set(dir, arr);
  }

  const suggestions = [];
  const sortedDirs = [...byDir.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [dir, items] of sortedDirs) {
    if (items.length >= 2 && dir !== "") {
      suggestions.push(`${dir}/**`);
    } else {
      suggestions.push(...items);
    }
  }

  const uniq = [];
  const seen = new Set();
  for (const s of suggestions) {
    if (!seen.has(s)) {
      seen.add(s);
      uniq.push(s);
    }
  }
  return uniq;
}

function collectChangedPaths(diff) {
  const paths = [];
  for (const a of diff.added) paths.push(a.path);
  for (const m of diff.modified) paths.push(m.path);
  for (const d of diff.deleted) paths.push(d.path);
  paths.sort((a, b) => a.localeCompare(b));
  return paths;
}

function isoStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(
    d.getUTCHours()
  )}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

async function sha256File(filePath) {
  const buf = await fs.readFile(filePath);
  return sha256(buf);
}

function isIgnored(relPath) {
  const parts = relPath.split(path.sep);
  for (const p of parts) {
    if (DEFAULT_IGNORE_DIRS.has(p)) return true;
  }
  return false;
}

function normalizePath(p) {
  // Normalize to forward slashes for cross-platform consistency
  return p.split(path.sep).join("/");
}

async function walkFiles(rootDir) {
  const out = [];
  async function rec(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const abs = path.join(dir, e.name);
      const rel = normalizePath(path.relative(REPO_ROOT, abs));
      if (isIgnored(rel)) continue;
      if (e.isDirectory()) await rec(abs);
      else if (e.isFile()) out.push(abs);
    }
  }
  await rec(rootDir);
  return out;
}

async function snapshotFiles(watchPaths) {
  const roots = watchPaths.map((p) => path.join(REPO_ROOT, p));
  const files = [];
  for (const r of roots) {
    try {
      const st = await fs.stat(r);
      if (st.isFile()) files.push(r);
      else if (st.isDirectory()) files.push(...(await walkFiles(r)));
    } catch {
      // ignore missing paths
    }
  }

  // Build map: rel -> { size, mtimeMs, hash }
  // Hashing everything can be heavy; we do it anyway because this is a determinism gate.
  const map = new Map();
  for (const abs of files) {
    const rel = normalizePath(path.relative(REPO_ROOT, abs));
    try {
      const st = await fs.stat(abs);
      const hash = await sha256File(abs);
      map.set(rel, { size: st.size, mtimeMs: st.mtimeMs, sha256: hash });
    } catch {
      // if file disappears during snapshot, skip
    }
  }
  return map;
}

function diffSnapshots(before, after) {
  const added = [];
  const modified = [];
  const deleted = [];

  for (const [rel, a] of after.entries()) {
    const b = before.get(rel);
    if (!b) added.push({ path: rel, sha256: a.sha256, size: a.size });
    else if (b.sha256 !== a.sha256) modified.push({ path: rel, before: b.sha256, after: a.sha256 });
  }
  for (const [rel, b] of before.entries()) {
    if (!after.has(rel)) deleted.push({ path: rel, sha256: b.sha256, size: b.size });
  }

  // Stable sort for determinism
  added.sort((x, y) => x.path.localeCompare(y.path));
  modified.sort((x, y) => x.path.localeCompare(y.path));
  deleted.sort((x, y) => x.path.localeCompare(y.path));

  return { added, modified, deleted };
}

function runCommand({ cwd, command }, { verbose }) {
  return new Promise((resolve) => {
    const [bin, ...args] = command;
    const child = spawn(bin, args, {
      cwd: path.isAbsolute(cwd) ? cwd : path.join(REPO_ROOT, cwd),
      stdio: verbose ? "inherit" : ["ignore", "pipe", "pipe"],
      env: process.env
    });

    let stdout = "";
    let stderr = "";

    if (!verbose) {
      child.stdout?.on("data", (d) => (stdout += d.toString()));
      child.stderr?.on("data", (d) => (stderr += d.toString()));
    }

    child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr }));
  });
}

async function writeRunArtifacts(toolId, run) {
  const dir = path.join(DIST_ROOT, toolId, run.timestamp);
  await ensureDir(dir);

  const manifestPath = path.join(dir, "manifest.json");
  const hashesPath = path.join(dir, "hashes.json");
  const logsPath = path.join(dir, "logs.json");

  // hashes.json is a flat map (path -> sha256) for added+modified after-state files
  const hashes = {};
  for (const a of run.diff.added) hashes[a.path] = a.sha256;
  for (const m of run.diff.modified) hashes[m.path] = m.after;

  const manifest = {
    schemaVersion: "1.0.0",
    toolId,
    timestamp: run.timestamp,
    exitCode: run.exitCode,
    durationMs: run.durationMs,
    cwd: run.cwd,
    command: run.command,
    watchPaths: run.watchPaths,
    allowChanges: run.allowChanges,
    expectedOutputsMode: run.expectedOutputsMode ?? null,
    changes: {
      added: run.diff.added.length,
      modified: run.diff.modified.length,
      deleted: run.diff.deleted.length
    },
    artifactsDir: path.relative(REPO_ROOT, dir)
  };

  const logs = {
    stdout: run.stdout,
    stderr: run.stderr
  };

  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  await fs.writeFile(hashesPath, JSON.stringify(hashes, null, 2) + "\n", "utf8");
  await fs.writeFile(logsPath, JSON.stringify(logs, null, 2) + "\n", "utf8");

  return { dir, manifestPath, hashesPath, logsPath };
}

// ----------------------------- Runner -----------------------------

async function loadManifest() {
  const p = path.join(REPO_ROOT, "tooling", "tools.manifest.json");
  const mf = await readJson(p);
  if (!mf || !Array.isArray(mf.tools)) {
    throw new Error("Invalid tooling/tools.manifest.json: missing tools[]");
  }
  return mf;
}

async function runTool(tool, { verbose, expectedModeOverride }) {
  const start = Date.now();
  const timestamp = isoStamp();

  const watchPaths = tool.watchPaths?.length ? tool.watchPaths : ["tooling"];
  const before = await snapshotFiles(watchPaths);

  const result = await runCommand(
    { cwd: tool.cwd ?? ".", command: tool.command },
    { verbose }
  );

  const after = await snapshotFiles(watchPaths);
  const diff = diffSnapshots(before, after);

  const durationMs = Date.now() - start;
  const mode = expectedModeOverride ?? tool.expectedOutputsMode ?? "strict";
  const isModeWarn = mode === "warn";
  const isModeStrict = mode === "strict";

  const run = {
    timestamp,
    exitCode: result.code,
    durationMs,
    cwd: tool.cwd ?? ".",
    command: tool.command,
    watchPaths,
    allowChanges: !!tool.allowChanges,
    expectedOutputsMode: mode,
    diff,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    outputViolations: []
  };

  // If tool is declared "no changes allowed", enforce it.
  if (!tool.allowChanges) {
    const changed = diff.added.length + diff.modified.length + diff.deleted.length;
    if (changed !== 0 && run.exitCode === 0) {
      run.exitCode = 2;
      run.stderr += `\n[tooling/run] Tool '${tool.id}' is not allowed to change files, but it did.\n`;
    }
  }

  // Enforce expectedOutputs if provided
  if (run.exitCode === 0 && tool.expectedOutputs && tool.expectedOutputs.length > 0) {
    // Check which changes fall outside expectedOutputs
    function matchesPattern(filePath, patterns) {
      for (const pat of patterns) {
        if (pat.endsWith("/**")) {
          const dir = pat.slice(0, -3);
          if (filePath.startsWith(dir + "/")) return true;
        } else if (filePath === pat) {
          return true;
        }
      }
      return false;
    }

    for (const a of diff.added) {
      if (!matchesPattern(a.path, tool.expectedOutputs)) {
        run.outputViolations.push(a.path);
      }
    }
    for (const m of diff.modified) {
      if (!matchesPattern(m.path, tool.expectedOutputs)) {
        run.outputViolations.push(m.path);
      }
    }
    for (const d of diff.deleted) {
      if (!matchesPattern(d.path, tool.expectedOutputs)) {
        run.outputViolations.push(d.path);
      }
    }

    if (run.outputViolations.length > 0) {
      const msg =
        `\n[tooling/run] Tool '${tool.id}' wrote outside expectedOutputs (mode=${mode}).\n` +
        run.outputViolations.map((p) => `  - ${p}`).join("\n") +
        "\n";

      if (isModeStrict) {
        run.exitCode = 3;
        run.stderr += msg;
      } else if (isModeWarn) {
        run.stderr += msg;
      }
    }
  }

  const artifacts = await writeRunArtifacts(tool.id, run);

  return { toolId: tool.id, run, artifacts };
}

async function main() {
  // Find the actual repo root by traversing up from tooling/run.mjs location
  let repoRoot = path.dirname(__dirname); // start: go up from tooling/ to repo root
  for (let i = 0; i < 10; i++) {
    try {
      await fs.stat(path.join(repoRoot, "tooling", "tools.manifest.json"));
      break; // found it
    } catch {
      const parent = path.dirname(repoRoot);
      if (parent === repoRoot) break; // reached filesystem root
      repoRoot = parent;
    }
  }

  // Update globals with correct REPO_ROOT
  Object.defineProperty(globalThis, 'REPO_ROOT', { value: repoRoot, configurable: true });

  const args = parseArgs(process.argv);
  const mf = await loadManifest();

  if (args.list) {
    for (const t of mf.tools) {
      console.log(`${t.id}  —  ${t.name ?? ""}`.trim());
    }
    return;
  }

  if (args.cmd === "baseline" && !args.all && !args.toolId) {
    console.error(usage());
    process.exit(1);
  }

  if (args.cmd === "run" && !args.all && !args.toolId) {
    console.error(usage());
    process.exit(1);
  }

  const selected = args.all
    ? mf.tools
    : mf.tools.filter((t) => t.id === args.toolId);

  if (!selected.length) {
    console.error(`[tooling/run] Unknown tool id: ${args.toolId}`);
    console.error("Use: node tooling/run.mjs --list");
    process.exit(1);
  }

  await ensureDir(DIST_ROOT);

  const results = [];
  for (const tool of selected) {
    if (!args.json) {
      console.log(
        `\n▶ ${args.cmd === "baseline" ? "baseline " : ""}${tool.id}${tool.name ? ` — ${tool.name}` : ""}`
      );
    }

    const r = await runTool(tool, {
      verbose: args.verbose,
      expectedModeOverride: args.expectedMode
    });
    results.push(r);

    if (args.cmd === "baseline") {
      const changed = collectChangedPaths(r.run.diff);
      const baseline = {
        schemaVersion: "1.0.0",
        toolId: tool.id,
        createdAt: r.run.timestamp,
        command: r.run.command,
        cwd: r.run.cwd,
        watchPaths: r.run.watchPaths,
        touchedPaths: changed,
        suggestedExpectedOutputs: suggestExpectedOutputsFromPaths(changed)
      };

      const baselinePath = await writeBaseline(tool.id, baseline);

      if (!args.json) {
        console.log(`  baseline: ${path.relative(REPO_ROOT, baselinePath)}`);
        console.log(`  touched: ${changed.length} path(s)`);
        console.log("  suggested expectedOutputs:");
        for (const s of baseline.suggestedExpectedOutputs) {
          console.log(`    - ${s}`);
        }
      }
    } else if (!args.json) {
      const c = r.run.diff;
      console.log(
        `  exit=${r.run.exitCode}  +${c.added.length} ~${c.modified.length} -${c.deleted.length}  (${r.run.durationMs}ms)`
      );
      console.log(`  artifacts: ${path.relative(REPO_ROOT, r.artifacts.dir)}`);
      if (r.run.exitCode !== 0 && !args.verbose) {
        console.log("  (re-run with --verbose to see tool output)");
      }
    }
  }

  const maxExit = results.reduce((m, r) => Math.max(m, r.run.exitCode), 0);

  if (args.json) {
    const payload = results.map((r) => ({
      toolId: r.toolId,
      exitCode: r.run.exitCode,
      durationMs: r.run.durationMs,
      changes: r.run.diff,
      artifactsDir: path.relative(REPO_ROOT, r.artifacts.dir)
    }));
    console.log(JSON.stringify({ schemaVersion: "1.0.0", results: payload }, null, 2));
  }

  process.exit(maxExit);
}

main().catch((err) => {
  console.error(`[tooling/run] Fatal: ${err?.stack ?? String(err)}`);
  process.exit(1);
});
