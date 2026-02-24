#!/usr/bin/env node
import fs from "node:fs";

const lines = fs.readFileSync("tooling/speech/sounds.tsv", "utf8").split(/\r?\n/);

// Find first exception row
for (let i = 1; i < Math.min(110, lines.length); i++) {
  if (lines[i].startsWith("exception")) {
    const cols = lines[i].split("\t");
    console.log(`Line ${i + 1} has ${cols.length} columns:`);
    for (let j = 0; j < Math.min(14, cols.length); j++) {
      console.log(`  [${j}] = "${cols[j]}"`);
    }

    if (cols.length < 14) {
      console.log("\nPadding to 14 columns...");
      while (cols.length < 14) cols.push("");
      console.log("After padding:");
      for (let j = 0; j < 14; j++) {
        console.log(`  [${j}] = "${cols[j]}"`);
      }
    }

    break;
  }
}
