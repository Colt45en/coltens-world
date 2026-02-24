#!/usr/bin/env node
/**
 * TSV -> rewriter.config.json
 *
 * TSV columns (preferred header):
 * kind, id, priority, notes, pattern, flags, replace, exception_in, exception_out,
 * grapheme, out, pos, before, after
 *
 * Output:
 * - exceptions: single-output words only { [lowerWord]: pron }
 * - heteronyms: multi-output allowlisted words [{ input, default, alts }]
 * - rules: grapheme rules sorted by priority desc, then id asc
 *
 * Determinism:
 * - exceptions / heteronyms are derived with conflict detection (no silent overwrite)
 * - grapheme rules sorted by (priority desc, id asc)
 */

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

function usage() {
  return `
Usage:
  node tooling/speech/tsv-to-rewriter-config.mjs [input.tsv] [output.json] [--vowels aeiouy] [--voiced-th the,this,that]

Defaults:
  input:  tooling/speech/sounds-final.tsv
  output: tooling/speech/rewriter.config.json
`.trim();
}

function parseArgs(argv) {
  const args = {
    input: null,
    output: null,
    vowels: "aeiouy",
    voicedThList: [
      "the",
      "this",
      "that",
      "these",
      "those",
      "there",
      "their",
      "they",
      "then",
      "than",
      "thee",
      "them",
      "thus",
    ],
  };

  const pos = [];
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--vowels") args.vowels = argv[++i] ?? args.vowels;
    else if (a.startsWith("--vowels=")) args.vowels = a.split("=")[1] ?? args.vowels;
    else if (a === "--voiced-th") {
      const raw = argv[++i] ?? "";
      args.voicedThList = raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    } else if (a.startsWith("--voiced-th=")) {
      const raw = a.split("=")[1] ?? "";
      args.voicedThList = raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    } else {
      pos.push(a);
    }
  }

  args.input = pos[0] ?? "tooling/speech/sounds-final.tsv";
  args.output = pos[1] ?? "tooling/speech/rewriter.config.json";
  return args;
}

function stripBom(s) {
  if (s && s.charCodeAt(0) === 0xfeff) return s.slice(1);
  return s;
}

function splitTsvLine(line) {
  // TSV is simple here: no quoted tabs expected.
  return line.split("\t");
}

function normalizeEmpty(v) {
  const s = (v ?? "").trim();
  return s === "" ? "" : s;
}

function toInt(v, fallback = 0) {
  const n = Number.parseInt(String(v), 10);
  return Number.isFinite(n) ? n : fallback;
}

function parseFlags(rawFlags) {
  const s = (rawFlags ?? "").trim();
  if (!s) return [];
  return s
    .split(/[,\s]+/g)
    .map((x) => x.trim())
    .filter(Boolean);
}

function safeKey(k) {
  return String(k ?? "").trim();
}

/**
 * Canonicalize phoneme symbol variants so we don't treat encoding differences as heteronyms.
 * These are SAFE given your dataset pattern: you already use ĕ and ĭ heavily.
 */
function normalizePhones(s) {
  return String(s ?? "")
    .trim()
    // IPA epsilon -> your short-e
    .replaceAll("ɛ", "ĕ")
    // IPA small-cap i -> your short-i
    .replaceAll("ɪ", "ĭ");

  // Optional (ONLY if you intend them equivalent in runtime):
  // .replaceAll("ʊ", "ŭ")
}

const HETERONYM_ALLOWLIST = new Set([
  "read",
  "lead",
  "tear",
  "live",
  "use",
  "abuse",
  "refuse",
  "produce",
  "project",
  "present",
  "record",
  "contest",
  "digest",
  "increase",
  "desert",
  "insult",
  "object",
  "subject",
  "permit",
  "address",
  "close",
  "wind",
  "bow",
  "row",
  "sew",
  "dove",
]);

function buildConfig({ rules, exceptions, heteronyms, vowels, voicedThList, sourceFile }) {
  return {
    schemaVersion: "1.0.0",
    kind: "speech.rewriter.config",
    generatedAt: new Date().toISOString(),
    source: { tsv: sourceFile },
    settings: { vowels, voicedThList },
    exceptions, // { [lowerWord]: output }
    heteronyms, // [{ input, default, alts }]
    rules, // sorted list
  };
}

async function main() {
  const args = parseArgs(process.argv);

  if (!args.input || !args.output) {
    console.error(usage());
    process.exit(1);
  }

  const inputPath = path.resolve(process.cwd(), args.input);
  const outputPath = path.resolve(process.cwd(), args.output);

  const raw = stripBom(await fs.readFile(inputPath, "utf8"));
  const lines = raw.split(/\r?\n/g).filter((l) => l.trim().length > 0);

  if (lines.length < 1) {
    console.error(`[tsv] Not enough lines in ${args.input}`);
    process.exit(1);
  }

  // Header detection: if first line isn't a header, use the default schema order and treat all lines as data.
  const defaultHeader = [
    "kind",
    "id",
    "priority",
    "notes",
    "pattern",
    "flags",
    "replace",
    "exception_in",
    "exception_out",
    "grapheme",
    "out",
    "pos",
    "before",
    "after",
  ];

  let header = splitTsvLine(lines[0]).map((h) => h.trim());
  let dataStart = 1;

  const looksLikeHeader =
    header.includes("kind") && header.includes("id") && header.includes("priority");

  if (!looksLikeHeader) {
    header = defaultHeader;
    dataStart = 0;
    console.log(`[debug] No header detected, treating all ${lines.length} lines as data`);
  }

  const idx = new Map(header.map((h, i) => [h, i]));
  function hasCol(name) {
    return idx.get(name) !== undefined;
  }
  function col(name) {
    const i = idx.get(name);
    if (i === undefined) throw new Error(`Missing TSV column: ${name}`);
    return i;
  }

  // Validate minimal columns
  for (const r of ["kind", "id", "priority"]) col(r);

  // Exception tracking (no silent overwrite)
  /** @type {Map<string, Set<string>>} */
  const excSeen = new Map();

  function addException(word, out, metaId = "") {
    const key = String(word ?? "").trim().toLowerCase();
    const v = normalizePhones(out);

    if (!key || !v) return;

    let set = excSeen.get(key);
    if (!set) {
      set = new Set();
      excSeen.set(key, set);
    }
    set.add(v);

    // If this is a true conflict and NOT allowlisted, fail fast with useful message.
    if (set.size > 1 && !HETERONYM_ALLOWLIST.has(key)) {
      const outs = [...set];
      throw new Error(
        `[tsv] Conflict for "${key}": multiple outputs [${outs.join(", ")}]` +
          (metaId ? ` (last seen id=${metaId})` : "") +
          ` but not in heteronym allowlist. Fix source data or allowlist explicitly.`
      );
    }
  }

  const rules = [];

  for (let li = dataStart; li < lines.length; li++) {
    const parts = splitTsvLine(lines[li]);
    const kind = normalizeEmpty(parts[col("kind")]).toLowerCase();
    const id = safeKey(parts[col("id")]);
    const priority = toInt(parts[col("priority")], 0);
    const notes = hasCol("notes") ? normalizeEmpty(parts[col("notes")]) : "";

    if (!id) continue;

    if (kind === "exception") {
      const exceptionIn = hasCol("exception_in") ? normalizeEmpty(parts[col("exception_in")]) : "";
      const exceptionOut = hasCol("exception_out") ? normalizeEmpty(parts[col("exception_out")]) : "";
      addException(exceptionIn, exceptionOut, id);
      continue;
    }

    if (kind !== "grapheme") continue;

    // Prefer named columns. Fallback to legacy columns if present.
    const pattern = hasCol("pattern") ? normalizeEmpty(parts[col("pattern")]) : "";
    // Your TSV uses "out" for grapheme replacement. "replace" is often blank.
    const replaceRaw =
      (hasCol("out") ? normalizeEmpty(parts[col("out")]) : "") ||
      (hasCol("replace") ? normalizeEmpty(parts[col("replace")]) : "");
    const replace = normalizePhones(replaceRaw);

    const pos = (hasCol("pos") ? normalizeEmpty(parts[col("pos")]) : "any").toLowerCase() || "any";
    const flags = hasCol("flags") ? parseFlags(parts[col("flags")]) : [];
    const before = hasCol("before") ? normalizeEmpty(parts[col("before")]) : "";
    const after = hasCol("after") ? normalizeEmpty(parts[col("after")]) : "";

    if (!pattern) continue;

    rules.push({
      kind: "grapheme",
      id,
      priority,
      notes,
      pattern,
      replace,
      pos: pos === "start" || pos === "end" || pos === "any" ? pos : "any",
      flags,
      before,
      after,
    });
  }

  // Finalize exceptions vs heteronyms (deterministic)
  const exceptions = Object.create(null);
  const heteronyms = [];

  const keys = [...excSeen.keys()].sort((a, b) => a.localeCompare(b));
  for (const key of keys) {
    const outs = [...excSeen.get(key)].sort((a, b) => a.localeCompare(b));
    if (outs.length === 1) {
      exceptions[key] = outs[0];
    } else {
      // allowlisted heteronym
      heteronyms.push({
        input: key,
        default: outs[0], // deterministic choice: lowest lexicographically
        alts: outs.slice(1),
      });
    }
  }

  // Deterministic sort: priority desc, id asc
  rules.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.id.localeCompare(b.id);
  });

  const config = buildConfig({
    rules,
    exceptions,
    heteronyms,
    vowels: args.vowels,
    voicedThList: args.voicedThList,
    sourceFile: path.relative(process.cwd(), inputPath).split(path.sep).join("/"),
  });

  await fs.writeFile(outputPath, JSON.stringify(config, null, 2) + "\n", "utf8");
  console.log(`[ok] Wrote ${path.relative(process.cwd(), outputPath)}`);
  console.log(`[ok] Rules: ${rules.length}, Exceptions: ${Object.keys(exceptions).length}, Heteronyms: ${heteronyms.length}`);
}

main().catch((err) => {
  console.error(`[fatal] ${err?.stack ?? String(err)}`);
  process.exit(1);
});
