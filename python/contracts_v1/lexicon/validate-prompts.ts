import fs from "node:fs";
import path from "node:path";
import { PromptEnvelopeSchema } from "./promptEnvelope.schema";
import { getOperatorSchema, listKnownOperatorTags } from "./promptOperatorRegistry";

type JsonValue = any;

function readJson(filePath: string): JsonValue {
  const raw = fs.readFileSync(filePath, "utf8");
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON: ${filePath}`);
  }
}

function isDirectory(p: string): boolean {
  return fs.existsSync(p) && fs.statSync(p).isDirectory();
}

function listJsonFilesRecursive(root: string): string[] {
  const out: string[] = [];
  const stack = [root];

  while (stack.length) {
    const cur = stack.pop()!;
    const entries = fs.readdirSync(cur, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(cur, e.name);
      if (e.isDirectory()) stack.push(full);
      else if (e.isFile() && e.name.toLowerCase().endsWith(".json")) out.push(full);
    }
  }
  return out;
}

function parseArgs(argv: string[]) {
  const args = new Set(argv.slice(2));
  const target = argv[2];

  // naive parse for --since=<iso>
  const sinceArg = argv.find((a) => a.startsWith("--since="));
  const since = sinceArg ? sinceArg.slice("--since=".length) : undefined;

  return {
    target,
    failOnUnknownTag: args.has("--fail-on-unknown-tag"),
    listTags: args.has("--list-tags"),
    since
  };
}

function shouldCheckBySince(filePath: string, sinceIso?: string): boolean {
  if (!sinceIso) return true;

  // If file has mtime newer than since, include it.
  // This is CI-friendly even if JSON doesn't have updatedAt.
  const sinceMs = Date.parse(sinceIso);
  if (!Number.isFinite(sinceMs)) {
    throw new Error(`Invalid --since value (must be ISO datetime): ${sinceIso}`);
  }
  const mtimeMs = fs.statSync(filePath).mtimeMs;
  return mtimeMs >= sinceMs;
}

function formatZodIssues(issues: { path: (string | number)[]; message: string }[]) {
  return issues.map((i) => {
    const at = i.path.length ? i.path.join(".") : "<root>";
    return `${at}: ${i.message}`;
  });
}

function main() {
  const { target, failOnUnknownTag, listTags, since } = parseArgs(process.argv);

  if (listTags) {
    console.log(listKnownOperatorTags().join("\n"));
    process.exit(0);
  }

  if (!target) {
    console.error(
      [
        "Usage:",
        "  pnpm tsx packages/engine/src/contracts/lexicon/validate-prompts.ts <fileOrFolder> [--fail-on-unknown-tag] [--since=<ISO>] [--list-tags]",
        "",
        "Examples:",
        "  pnpm tsx .../validate-prompts.ts docs/prompts",
        "  pnpm tsx .../validate-prompts.ts docs/prompts --fail-on-unknown-tag",
        "  pnpm tsx .../validate-prompts.ts docs/prompts --since=2026-02-12T00:00:00.000Z",
        "  pnpm tsx .../validate-prompts.ts --list-tags"
      ].join("\n")
    );
    process.exit(2);
  }

  const files = isDirectory(target) ? listJsonFilesRecursive(target) : [target];
  const filtered = files.filter((f) => shouldCheckBySince(f, since));

  if (filtered.length === 0) {
    console.log("OK: no files matched filter.");
    process.exit(0);
  }

  let invalidCount = 0;
  let checkedCount = 0;
  let skippedNonPromptCount = 0;
  let unknownTagCount = 0;

  for (const f of filtered) {
    let data: JsonValue;
    try {
      data = readJson(f);
    } catch (err: any) {
      invalidCount++;
      console.error(`✖ ${f}\n  - <root>: ${err.message}`);
      continue;
    }

    // Must at least match envelope
    const env = PromptEnvelopeSchema.safeParse(data);
    if (!env.success) {
      // Not a prompt artifact at all; skip silently to allow mixed folders
      skippedNonPromptCount++;
      continue;
    }

    const tag = env.data.code_process_tag;
    const schema = getOperatorSchema(tag);

    if (!schema) {
      unknownTagCount++;
      if (failOnUnknownTag) {
        invalidCount++;
        console.error(`✖ ${f}`);
        console.error(`  - code_process_tag: unknown operator tag "${tag}"`);
      }
      continue;
    }

    checkedCount++;
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      invalidCount++;
      console.error(`✖ ${f}`);
      for (const line of formatZodIssues(parsed.error.issues)) {
        console.error(`  - ${line}`);
      }
    }
  }

  if (invalidCount > 0) {
    console.error(
      `\nFAILED: ${invalidCount} invalid file(s). Checked: ${checkedCount}. Unknown tags: ${unknownTagCount}. Skipped non-prompts: ${skippedNonPromptCount}.`
    );
    process.exit(1);
  }

  console.log(
    `OK: checked: ${checkedCount}. unknown tags: ${unknownTagCount}. skipped non-prompts: ${skippedNonPromptCount}.`
  );
  process.exit(0);
}

main();
