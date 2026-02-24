#!/usr/bin/env node
/**
 * Fix TSV column alignment by padding all rows to match header column count
 */

import fs from "node:fs";

if (process.argv.length !== 2) {
  console.error("Usage: fix-tsv-padding.mjs");
  process.exit(1);
}

console.log("Fixing TSV padding...");

const inPath = "sounds.tsv";
const outPath = "sounds.tsv.tmp";

if (!fs.existsSync(inPath)) {
  console.error(`Input file not found: ${inPath}`);
  process.exit(1);
}

if (fs.existsSync(outPath)) {
  console.error(`Output file already exists: ${outPath}`);
  process.exit(1);
}

const tsv = fs.readFileSync(inPath, "utf8");
const lines = tsv.split(/\r?\n/);

if (lines.length === 0) {
  console.error("Empty TSV");
  process.exit(1);
}

const headerLine = lines[0];
const headerCols = headerLine.split("\t");
const expectedCols = headerCols.length;

console.log(`Header has ${expectedCols} columns`);

const fixed = [headerLine];
for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim()) {
    fixed.push("");
    continue;
  }

  const cols = line.split("\t");
  while (cols.length < expectedCols) {
    cols.push("");
  }
  fixed.push(cols.slice(0, expectedCols).join("\t"));
}

const corrected = fixed.join("\n");
fs.writeFileSync(outPath, corrected, "utf8");
fs.renameSync(outPath, inPath);

console.log(`✓ Fixed ${fixed.length} lines, all padded to ${expectedCols} columns`);
