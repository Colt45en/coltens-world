#!/usr/bin/env node
/* tooling/test-compilers.mjs
 *
 * Determinism gate:
 * For each tool, run it twice back-to-back.
 * The second run must produce ZERO file changes (added/modified/deleted).
 *
 * This is the fastest, most reliable "engine-grade" gate you can add without
 * hardcoding output paths or maintaining golden files.
 */

import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.dirname(__dirname); // go up from tooling/ to repo root
const RUNNER = path.join(REPO_ROOT, "tooling", "run.mjs");

function runNode(args) {
  return new Promise((resolve) => {
    const child = spawn("node", args, { cwd: REPO_ROOT, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("close", (code) => resolve({ code: code ?? 0, out, err }));
  });
}

function sumChanges(diff) {
  return (diff.added?.length ?? 0) + (diff.modified?.length ?? 0) + (diff.deleted?.length ?? 0);
}

async function listTools() {
  const r = await runNode([RUNNER, "--list"]);
  if (r.code !== 0) throw new Error(`Failed to list tools:\n${r.err}`);
  return r.out
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split(/\s+/)[0]);
}

async function runToolJson(toolId) {
  const r = await runNode([RUNNER, toolId, "--json"]);
  if (r.code !== 0 && !r.out.trim()) {
    throw new Error(`Tool '${toolId}' failed without JSON output:\n${r.err}`);
  }
  const parsed = JSON.parse(r.out);
  const result = parsed.results?.[0];
  if (!result) throw new Error(`No JSON result for tool '${toolId}'. Raw:\n${r.out}`);
  return { exitCode: result.exitCode, changes: result.changes, artifactsDir: result.artifactsDir, raw: r };
}

async function main() {
  const argv = process.argv.slice(2);
  const only = argv.filter((a) => !a.startsWith("--"));
  const verbose = argv.includes("--verbose") || argv.includes("-v");

  const toolIds = only.length ? only : await listTools();
  if (!toolIds.length) {
    console.error("[tooling/test-compilers] No tools found.");
    process.exit(1);
  }

  let failed = 0;

  for (const toolId of toolIds) {
    console.log(`\n🧪 ${toolId}`);

    const first = await runToolJson(toolId);
    if (first.exitCode !== 0) {
      failed++;
      console.error(`  ❌ first run failed (exit=${first.exitCode})`);
      if (verbose) {
        console.error(first.raw.err);
        console.error(first.raw.out);
      } else {
        console.error(`  artifacts: ${first.artifactsDir}`);
        console.error("  (re-run with --verbose for logs)");
      }
      continue;
    }

    const second = await runToolJson(toolId);
    if (second.exitCode !== 0) {
      failed++;
      console.error(`  ❌ second run failed (exit=${second.exitCode})`);
      if (verbose) {
        console.error(second.raw.err);
        console.error(second.raw.out);
      } else {
        console.error(`  artifacts: ${second.artifactsDir}`);
        console.error("  (re-run with --verbose for logs)");
      }
      continue;
    }

    const changed2 = sumChanges(second.changes);
    if (changed2 !== 0) {
      failed++;
      console.error(
        `  ❌ non-deterministic: second run produced changes (+${second.changes.added.length} ~${second.changes.modified.length} -${second.changes.deleted.length})`
      );
      console.error(`  artifacts: ${second.artifactsDir}`);
      if (verbose) {
        console.error(JSON.stringify(second.changes, null, 2));
      }
    } else {
      const changed1 = sumChanges(first.changes);
      console.log(`  ✅ ok (first run changes=${changed1}, second run changes=0)`);
      console.log(`  artifacts: ${second.artifactsDir}`);
    }
  }

  if (failed) {
    console.error(`\n[tooling/test-compilers] FAIL — ${failed} tool(s) non-deterministic or errored.`);
    process.exit(1);
  } else {
    console.log(`\n[tooling/test-compilers] PASS — all tools deterministic.`);
  }
}

main().catch((err) => {
  console.error(`[tooling/test-compilers] Fatal: ${err?.stack ?? String(err)}`);
  process.exit(1);
});
