#!/usr/bin/env node
/**
 * Speech pipeline (canonical):
 * 1) Compile config from sounds-final.tsv
 * 2) Run tests (golden + determinism)
 *
 * Intended to be invoked from the tooling runner with:
 *   cwd = tooling/speech
 */

import { spawn } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));

function run(cmd, args, { cwd } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd, stdio: "inherit", shell: false });
    p.on("error", reject);
    p.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

async function main() {
  // 1) Compile canonical config (sounds-final.tsv -> rewriter.config.json)
  await run("node", ["tsv-to-rewriter-config-final.mjs"], { cwd: __dir });

  // 2) Test (must be pure)
  await run("node", ["test-rewriter.mjs", "--verbose"], { cwd: __dir });

  console.log("[ok] speech.pipeline complete");
}

main().catch((err) => {
  console.error(`[fatal] ${err?.stack ?? String(err)}`);
  process.exit(1);
});
