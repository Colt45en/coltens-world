import fs from "node:fs";

const tsv = fs.readFileSync("sounds.tsv", "utf8");
const lines = tsv.split(/\r?\n/).filter((l) => l.length > 0 && !l.startsWith("#"));

console.log(`Total lines: ${lines.length}`);
console.log(`\nFirst 3 lines:\n`);

for (let i = 0; i < Math.min(3, lines.length); i++) {
  const cols = lines[i].split("\t");
  console.log(
    `Line ${i}: ${cols.length} columns\n  ${cols.map((c, j) => `[${j}]="${c}"`).join("\n  ")}\n`,
  );
}
