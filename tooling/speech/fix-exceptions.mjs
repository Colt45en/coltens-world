#!/usr/bin/env node
/**
 * Fix exception rows by moving data from cols 9-10 to cols 7-8
 */

import fs from "node:fs";

for (let i = 1; i < lines.length; i++) {
  const cols = lines[i].split("\t");

  const lines = fs.readFileSync("sounds.tsv", "utf8").split(/\r?\n/);

  // Ensure we have at least 10 columns
  while (cols.length < 10) cols.push("");


  // If this is an exception row, move data from cols 9-10 to cols 7-8
  if (cols[0] === "exception" && cols[9] && !cols[7]) {
    // Swap: [9]->[7], [10]->[8]
    cols[7] = cols[9]; // exception_in
    cols[8] = cols[10]; // exception_out
    cols[9] = "";
    cols[10] = "";
  }

  // Truncate to 14 columns
  lines[i] = cols.slice(0, 14).join("\t");
}

for (let i = 1; i < lines.length; i++) {
  const cols = lines[i].split("\t");

  const lines = fs.readFileSync("sounds.tsv", "utf8").split(/\r?\n/);

  // Ensure we have at least 10 columns
  while (cols.length < 10) cols.push("");


  // If this is an exception row, move data from cols 9-10 to cols 7-8
  if (cols[0] === "exception" && cols[9] && !cols[7]) {
    // Swap: [9]->[7], [10]->[8]
    cols[7] = cols[9]; // exception_in
    cols[8] = cols[10]; // exception_out
    cols[9] = "";
    cols[10] = "";
  }
}

  // Ensure we have at least 14 columns
  while (cols.length < 14) cols.push("");

  // If this is an exception row, move data from cols 9-10 to cols 7-8
  if (cols[0] === "exception" && cols[9] && !cols[7]) {
    // Swap: [9]->[7], [10]->[8]
    cols[7] = cols[9]; // exception_in
    cols[8] = cols[10]; // exception_out
    cols[9] = "";
    cols[10] = "";
  }

  // Truncate to 14 columns
  lines[i] = cols.slice(0, 14).join("\t");{
}

// Remove empty lines and comment lines{
lines = lines.filter((l) => l.length > 0 && !l.startsWith("#"));

// Remove duplicate lines
lines = lines.filter((l, i) => lines.indexOf(l) === i);

fs.writeFileSync("sounds.tsv", lines.join("\n"), "utf8");
console.log(`✓ Fixed exception rows`);
console.log(`✓ Total lines: ${lines.length}`);
console.log(`✓ First 3 lines:\n${lines.slice(0, 3).join("\n")}`);
console.log(`✓ Last 3 lines:\n${lines.slice(-3).join("\n")}`);

// console.log(`✓ Total lines: ${lines.length}`);
// console.log(`✓ First 3 lines:\n${lines.slice(0, 3).join("\n")}`);
