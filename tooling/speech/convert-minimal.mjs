#!/usr/bin/env node
/**
 * Convert complex TSV to minimal format
 */

import fs from "node:fs";

const lines = fs
  .readFileSync("sounds.tsv", "utf8")
  .split(/\r?\n/)
  .filter((l) => l.trim());
const header = lines[0].split("\t").map((h) => h.trim());

// Build index
const idx = Object.fromEntries(header.map((h, i) => [h, i]));

const minimal = [
  "# Speech normalization rules (converted to minimal format)",
  "# grapheme <tab> in <tab> out <tab> pos <tab> before <tab> after",
  "# exception <tab> in <tab> out",
  "",
];

for (let i = 1; i < lines.length; i++) {
  const cols = lines[i].split("\t");
  while (cols.length < header.length) cols.push("");

  const get = (k) => (cols[idx[k]] ?? "").trim();
  const kind = get("kind");

  if (kind === "grapheme") {
    const grapheme = get("grapheme");
    const out = get("out");
    const pos = get("pos") || "any";
    const before = get("before");
    const after = get("after");

    if (grapheme && out) {
      minimal.push(`grapheme\t${grapheme}\t${out}\t${pos}\t${before}\t${after}`);
    }
  } else if (kind === "exception") {
    const exc_in = get("exception_in");
    const exc_out = get("exception_out");

    if (exc_in && exc_out) {
      minimal.push(`exception\t${exc_in}\t${exc_out}`);
    }
  }
}

fs.writeFileSync("sounds-minimal.tsv", minimal.join("\n"), "utf8");
console.log(`✓ Converted to minimal format: ${minimal.length} lines`);
