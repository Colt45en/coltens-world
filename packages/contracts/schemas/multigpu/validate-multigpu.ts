import fs from "node:fs";
import path from "node:path";
import { parseMultiGpuFramePlan } from "./plan";

function readJson(p: string): unknown {
  const raw = fs.readFileSync(p, "utf8");
  return JSON.parse(raw);
}

function usage(): never {
  console.error(
    [
      "Usage:",
      "  pnpm tsx packages/engine/src/contracts/multigpu/validate-multigpu.ts [options] <plan.json> [...more]",
      "",
      "Options:",
      "  --fail-fast           Exit on first failure",
      "  --require-from-exists Require sync.fromSubmissionId to exist in plan.work.submissions (stricter)",
    ].join("\n")
  );
  process.exit(2);
}

function assertUnique(label: string, ids: string[]) {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) throw new Error(`Duplicate ${label} id: ${id}`);
    seen.add(id);
  }
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) usage();

  const failFast = args.includes("--fail-fast");
  const requireFromExists = args.includes("--require-from-exists");

  const files = args.filter((a) => a !== "--fail-fast" && a !== "--require-from-exists");
  if (files.length === 0) usage();

  let failed = 0;

  for (const file of files) {
    const abs = path.resolve(file);

    try {
      const json = readJson(abs);
      const plan = parseMultiGpuFramePlan(json);

      // -------------------------
      // Semantic checks (beyond schema)
      // -------------------------

      // work.frameIndex matches plan.frameIndex
      if (plan.work.frameIndex !== plan.frameIndex) {
        throw new Error(
          `work.frameIndex (${plan.work.frameIndex}) must equal plan.frameIndex (${plan.frameIndex})`
        );
      }

      // submissions frameIndex match plan frameIndex
      for (const s of plan.work.submissions) {
        if (s.frameIndex !== plan.frameIndex) {
          throw new Error(`submission ${s.id}: frameIndex must equal plan.frameIndex (${plan.frameIndex})`);
        }
      }

      // submission IDs unique
      assertUnique("submission", plan.work.submissions.map((s) => s.id));

      // dep IDs unique
      assertUnique("dependency", plan.deps.dependencies.map((d) => d.id));

      // sync edge IDs unique
      assertUnique("sync edge", plan.sync.edges.map((e) => e.id));

      // deps: producer <= consumer
      for (const d of plan.deps.dependencies) {
        if (d.producerFrameIndex > d.consumerFrameIndex) {
          throw new Error(`dep ${d.id}: producerFrameIndex must be <= consumerFrameIndex`);
        }
      }

      // sync: plan.sync.frameIndex matches plan.frameIndex
      if (plan.sync.frameIndex !== plan.frameIndex) {
        throw new Error(`sync.frameIndex (${plan.sync.frameIndex}) must equal plan.frameIndex (${plan.frameIndex})`);
      }

      // sync: "to" must exist in this plan's submissions
      const submissionSet = new Set(plan.work.submissions.map((s) => s.id));
      for (const e of plan.sync.edges) {
        if (!submissionSet.has(e.toSubmissionId)) {
          throw new Error(
            `sync edge ${e.id}: toSubmissionId (${e.toSubmissionId}) must exist in plan.work.submissions`
          );
        }
        if (requireFromExists && !submissionSet.has(e.fromSubmissionId)) {
          throw new Error(
            `sync edge ${e.id}: fromSubmissionId (${e.fromSubmissionId}) must exist in plan.work.submissions (strict mode)`
          );
        }
      }

      console.log(`✅ valid: ${file}`);
    } catch (err: any) {
      failed++;
      console.error(`❌ invalid: ${file}`);

      // Zod errors have .issues; other errors use message
      if (err?.issues && Array.isArray(err.issues)) {
        for (const issue of err.issues) {
          console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
        }
      } else {
        console.error(`  - ${String(err?.message ?? err)}`);
      }

      if (failFast) process.exit(1);
    }
  }

  process.exit(failed === 0 ? 0 : 1);
}

main();
