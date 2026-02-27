#!/usr/bin/env node

/**
 * Extract JS-winner and mixed pairs from twins plan for decision-making
 * Usage: node tools/twins/extract-decisions.mjs
 */

import fs from "node:fs/promises";

async function main() {
  try {
    const planPath = "./history/2026-02-25/twins-plan.json";
    const plan = JSON.parse(await fs.readFile(planPath, "utf8"));

    const jsWinners = plan.needsDecision.filter((e) => e.winner === "js");
    const mixed = plan.needsDecision.filter((e) => e.winner === "mixed");

    console.log(`\n### JS-Winner Decisions (${jsWinners.length} files)\n`);

    // Group by package
    const grouped = {};
    jsWinners.forEach((e) => {
      const pkg = e.jsPath.split("/").slice(0, 2).join("/");
      if (!grouped[pkg]) grouped[pkg] = [];
      grouped[pkg].push(e);
    });

    // Display grouped
    Object.entries(grouped)
      .sort()
      .forEach(([pkg, items]) => {
        const file = items.map((e) => e.jsPath.split("/").pop());
        const importers = items.map((e) => e.js_importers);
        console.log(
          `\n**${pkg}** (${items.length} files, ${Math.max(...importers)} max importers)`
        );
        items.forEach((e, i) => {
          const fname = e.jsPath.split("/").pop();
          console.log(`  - \`${fname}\` (${e.js_importers} importers)`);
        });
      });

    console.log(`\n\n### Mixed Entrypoint Decisions (${mixed.length} files)\n`);
    mixed.forEach((e) => {
      console.log(`- ${e.jsPath} (${e.js_importers} JS importers, TS unused)`);
    });

    console.log(
      `\n\n## Summary\n\nTotal needing decisions: ${jsWinners.length + mixed.length}`
    );
    console.log(`- JS winners (keep JS?): ${jsWinners.length}`);
    console.log(`- Mixed (entrypoint fix): ${mixed.length}`);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

main();
