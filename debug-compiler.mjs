#!/usr/bin/env node
import fs from "node:fs";

const tsv = fs.readFileSync("tooling/speech/sounds.tsv", "utf8");
const lines = tsv.split(/\r?\n/).filter((l) => l.length > 0 && !l.startsWith("#"));

const header = lines[0].split("\t");
const idx = Object.fromEntries(header.map((h, i) => [h, i]));

console.log("Header indices:");
for (const [name, i] of Object.entries(idx)) {
  console.log(`  ${name} -> ${i}`);
}

console.log("\nFirst data row:");
const row1 = lines[1].split("\t");
while (row1.length < header.length) row1.push("");

for (const col of [
  "kind",
  "id",
  "priority",
  "notes",
  "grapheme",
  "out",
  "pos",
  "before",
  "after",
]) {
  const i = idx[col];
  console.log(`  ${col} (idx ${i}) = "${row1[i]}"`);
}
