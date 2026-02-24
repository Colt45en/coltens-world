#!/usr/bin/env node
/**
 * Fix TSV: move grapheme/out/pos/before/after data from cols [10..13]
 * back to cols [9..13] by removing the extra empty column at index 9.
 *
 * Safe behavior:
 * - Creates a .bak backup
 * - Only fixes rows with:
 *   - at least 14 columns
 *   - cols[9] === "" (the extra empty column)
 */

import fs from "node:fs";
import path from "node:path";

const inPath = "tooling/speech/sounds.tsv";

if (!fs.existsSync(inPath)) {
  console.error(`❌ Input file not found: ${inPath}`);
  process.exitCode = 1;
  process.exit();
}

const raw = fs.readFileSync(inPath, "utf8");
const lines = raw.split(/\r?\n/);

const fixed = [];
let changed = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // Keep header as-is
  if (i === 0) {
    fixed.push(line);
    continue;
  }

  // Preserve blank lines
  if (!line.trim()) {
    fixed.push("");
    continue;
  }

  const cols = line.split("\t");

  // Only fix if we see the "extra empty column" at index 9
  // and the row is wide enough to have the shifted data.
  if (cols.length >= 14 && cols[9] === "") {
    // Remove the empty column at index 9:
    // keep 0..8, then append 10..end (skipping 9)
    const next = cols.slice(0, 9).concat(cols.slice(10));

    // Ensure consistent width (optional; keeps downstream tooling stable)
    while (next.length < 14) next.push("");

    fixed.push(next.join("\t"));
    changed++;
  } else {
    fixed.push(line);
  }
}

// Backup first (deterministic + safe)
const bakPath = `${inPath}.bak`;
fs.writeFileSync(bakPath, raw, "utf8");

// Write fixed output
fs.writeFileSync(inPath, fixed.join("\n"), "utf8");

console.log(`✓ Fixed ${changed} line(s) out of ${lines.length}`);
console.log(`✓ Backup written: ${bakPath}`);
