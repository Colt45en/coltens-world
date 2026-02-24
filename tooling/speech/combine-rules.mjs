#!/usr/bin/env node
/**
 * Combine sounds-minimal.tsv grapheme rules with exceptions-clean.tsv
 */

import fs from "node:fs";

const graphemes = fs.readFileSync("sounds-minimal.tsv", "utf8");
const exceptions = fs.readFileSync("exceptions-clean.tsv", "utf8");

const combined = [
  "# World Engine Speech Normalization Rules",
  "# 100 grapheme rules + 257 exceptions = 357 total rules",
  "",
  "# GRAPHEME RULES",
  "# Format: grapheme <tab> input <tab> output <tab> position <tab> context_before <tab> context_after",
]
  .concat(graphemes.split(/\r?\n/).filter((l) => !l.startsWith("#")))
  .concat(["", "# EXCEPTIONS", "# Format: exception <tab> input <tab> output"])
  .concat(exceptions.split(/\r?\n/).filter((l) => !l.startsWith("#") && l.trim()));

fs.writeFileSync("sounds-final.tsv", combined.join("\n"), "utf8");
console.log(`✓ Combined: ${combined.length} lines total`);
