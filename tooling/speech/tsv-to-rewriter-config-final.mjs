#!/usr/bin/env node
/**
 * BRAIN ARCHITECTURE: Perception Layer → Normalizer (build-time compiler)
 *
 * Compile canonical sounds-final.tsv → rewriter.config.json
 *
 * Input schema (sounds-final.tsv):
 * - Comments: lines starting with #
 * - Data rows: kind, input, output, position [, context_before] [, context_after]
 *
 * Outputs:
 * - rewriter.config.json with deterministic rules (priority assigned by order)
 * - Separates exceptions vs heteronyms (conflict detection + HETERONYM_ALLOWLIST)
 * - Normalizes phone symbols (ɛ→ĕ, ɪ→ĭ, ʊ→ŭ) to prevent encoding conflicts
 */

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

function stripBom(s) {
  return s.replace(/^\ufeff/, "");
}

function normalizeEmpty(v) {
  const s = (v ?? "").trim();
  return s === "" || s === "∅" ? "" : s;
}

function splitTsvLine(line) {
  return line.split("\t");
}

function buildConfig({ rules, exceptions, heteronyms, vowels, voicedThList, sourceFile }) {
  const config = {
    schemaVersion: "1.0.0",
    kind: "speech.rewriter.config",
    generatedAt: new Date().toISOString(),
    source: {
      tsv: sourceFile,
    },
    settings: {
      vowels,
      voicedThList,
    },
    exceptions,
    rules,
  };

  // Only add heteronyms if there are any
  if (heteronyms && heteronyms.length > 0) {
    config.heteronyms = heteronyms;
  }

  return config;
}

async function main() {
  const inputFile = process.argv[2] ?? "sounds-final.tsv";
  const outputFile = process.argv[3] ?? "rewriter.config.json";

  const inputPath = path.resolve(process.cwd(), inputFile);
  const outputPath = path.resolve(process.cwd(), outputFile);

  // Load and parse TSV
  const raw = stripBom(await fs.readFile(inputPath, "utf8"));
  const allLines = raw.split(/\r?\n/g);

  // Filter: skip empty and comment lines
  const lines = allLines.filter((l) => {
    const trimmed = l.trim();
    return trimmed.length > 0 && !trimmed.startsWith("#");
  });

  if (lines.length === 0) {
    console.error(`[tsv] No data rows in ${inputFile}`);
    process.exit(1);
  }

  // Parse header
  const header = splitTsvLine(lines[0]).map((h) => h.trim());

  // Check if first row is a header or data
  // Header would be: kind, input, output, position, ...
  // Data would be: grapheme/exception, <word>, <output>, ...
  const isHeader = header[0] === "kind" && (header[1] === "id" || header[1] === "input");
  const dataStartIdx = isHeader ? 1 : 0;

  if (isHeader) {
    console.log(`[debug] Header: ${header.join(", ")}`);
  } else {
    console.log(`[debug] No header, treating all ${lines.length} lines as data`);
  }

  const exceptions = {};
  const rules = [];
  let priority = 10000; // Start high, decrement for deterministic order

  // Heteronym tracking
  const HETERONYM_ALLOWLIST = new Set([
    "read", "lead", "tear", "live", "use", "abuse", "refuse",
    "produce", "project", "present", "record", "contest", "digest",
    "increase", "desert", "insult", "object", "subject", "permit", "address",
    "close", "wind", "bow", "row", "sew", "dove"
  ]);

  const excMap = new Map();          // key -> chosen output
  const excAll = new Map();          // key -> Set(outputs) for conflict detection
  const heteronymsMap = new Map();   // key -> {input, default, alts}

  function normKey(k) {
    return String(k).trim().toLowerCase();
  }

  function normalizePhones(s) {
    // Canonicalize phoneme alphabet to prevent encoding conflicts
    return String(s)
      .replaceAll("ɛ", "ĕ")  // IPA epsilon → breve e
      .replaceAll("ɪ", "ĭ")  // IPA small cap I → breve i
      .replaceAll("ʊ", "ŭ"); // IPA upsilon → breve u
  }

  function addException(word, output) {
    const k = normKey(word);
    const v = normalizePhones(String(output).trim());

    if (!excAll.has(k)) excAll.set(k, new Set());
    excAll.get(k).add(v);

    if (!excMap.has(k)) {
      excMap.set(k, v);
      return;
    }

    if (excMap.get(k) === v) {
      // Exact duplicate - ignore silently
      return;
    }

    // Conflict detected
    const outputs = Array.from(excAll.get(k));

    if (!HETERONYM_ALLOWLIST.has(k)) {
      throw new Error(
        `[tsv] Conflict for "${k}": multiple outputs [${outputs.join(", ")}] but not in heteronym allowlist. ` +
        `Add to HETERONYM_ALLOWLIST or fix source data.`
      );
    }

    // Allowlisted heteronym: use first occurrence as default, track alts
    const defaultPron = excMap.get(k);
    const alts = outputs.filter(x => x !== defaultPron);

    if (!heteronymsMap.has(k)) {
      heteronymsMap.set(k, { input: k, default: defaultPron, alts });
      // Remove from exceptions map (will go in separate heteronyms section)
      excMap.delete(k);
      console.log(`[debug] Heteronym detected: "${k}" → default="${defaultPron}", alts=[${alts.join(", ")}]`);
    } else {
      // Update alts if more variants found
      const existing = heteronymsMap.get(k);
      const allAlts = [...new Set([...existing.alts, ...alts])];
      existing.alts = allAlts.filter(x => x !== existing.default);
    }
  }

  // Parse data rows
  for (let li = dataStartIdx; li < lines.length; li++) {
    const parts = splitTsvLine(lines[li]);
    const kind = normalizeEmpty(parts[0]).toLowerCase();
    const input = normalizeEmpty(parts[1]);
    const output = normalizeEmpty(parts[2]);
    const position = normalizeEmpty(parts[3]).toLowerCase() || "any";
    const contextBefore = parts.length > 4 ? normalizeEmpty(parts[4]) : "";
    const contextAfter = parts.length > 5 ? normalizeEmpty(parts[5]) : "";

    if (!input || !output) continue;

    if (kind === "exception") {
      // Exceptions are whole-word keyword overrides
      addException(input, output);
      console.log(`[debug] Row ${li}: Exception "${input}" → "${output}"`);
      continue;
    }

    if (kind === "grapheme") {
      // Rules are grapheme substitutions
      const ruleId = `G${String(li).padStart(4, "0")}_${input.toUpperCase()}`;
      rules.push({
        kind: "grapheme",
        id: ruleId,
        priority,
        notes: `grapheme rule: ${input} → ${output}`,
        pattern: input,
        replace: output,
        pos: position === "start" || position === "end" || position === "any" ? position : "any",
        flags: [],
        before: contextBefore,
        after: contextAfter,
      });
      priority--; // Decrement for next rule
      console.log(`[debug] Row ${li}: Rule "${input}" → "${output}" at "${position}"`);
      continue;
    }

    if (kind !== "") {
      console.log(`[debug] Row ${li}: Skipping (unknown kind="${kind}")`);
    }
  }

  console.log(`[ok] Parsed ${rules.length} grapheme rules + ${excMap.size} exceptions + ${heteronymsMap.size} heteronyms`);

  // Convert Maps to final format
  const exceptionsObj = Object.fromEntries([...excMap.entries()].sort(([a], [b]) => a.localeCompare(b)));
  const heteronymsArray = Array.from(heteronymsMap.values()).sort((a, b) => a.input.localeCompare(b.input));

  // Build config
  const config = buildConfig({
    rules,
    exceptions: exceptionsObj,
    heteronyms: heteronymsArray,
    vowels: "aeiouy",
    voicedThList: [
      "the", "this", "that", "these", "those", "there", "their",
      "they", "then", "than", "thee", "them", "thus",
    ],
    sourceFile: path.relative(process.cwd(), inputPath).split(path.sep).join("/"),
  });

  // Write output
  await fs.writeFile(outputPath, JSON.stringify(config, null, 2) + "\n", "utf8");
  console.log(`[ok] Wrote ${path.relative(process.cwd(), outputPath)}`);
  console.log(`[ok] Rules: ${rules.length}, Exceptions: ${Object.keys(config.exceptions).length}, Heteronyms: ${heteronymsArray.length}`);
}

main().catch((err) => {
  console.error(`[fatal] ${err?.stack ?? String(err)}`);
  process.exit(1);
});
