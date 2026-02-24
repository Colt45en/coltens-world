#!/usr/bin/env node
import fs from "node:fs";

const lines = fs.readFileSync("tooling/speech/sounds.tsv", "utf8").split(/\r?\n/);

// Find E_006_THERE and E_008_THEY rows
for (let i = 1; i < lines.length; i++) {
  if (lines[i].includes("E_006_THERE") || lines[i].includes("E_008_THEY")) {
    const cols = lines[i].split("\t");
    const id = cols[1] || "";

    console.log(`\nRow for ${id}:`);
    console.log(`All columns (${cols.length} total):`);
    for (let j = 0; j < cols.length; j++) {
      if (cols[j]) console.log(`  [${j}] = "${cols[j]}"`);
    }
  }
}
