#!/usr/bin/env node
import fs from "node:fs";

const tsv = fs.readFileSync("tooling/speech/sounds.tsv", "utf8");
const lines = tsv.split(/\r?\n/).filter((l) => l.length > 0 && !l.startsWith("#"));

const header = lines[0].split("\t");
const idx = Object.fromEntries(header.map((h, i) => [h, i]));

// Find first exception row
let firstException = -1;
for (let i = 1; i < lines.length; i++) {
  const cols = lines[i].split("\t");
  if (cols[0] === "exception") {
    firstException = i;
    break;
  }
  if (i > 110) break;
}

if (firstException >= 0) {
  console.log(`First exception row at line ${firstException + 1}:`);
  const row = lines[firstException].split("\t");
  while (row.length < header.length) row.push("");

  for (const col of ["kind", "id", "priority", "notes", "exception_in", "exception_out"]) {
    const i = idx[col];
    console.log(`  ${col} (idx ${i}) = "${row[i]}"`);
  }
} else {
  console.log("No exception row found in first 110 lines");
}
