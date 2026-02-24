#!/usr/bin/env node
/**
 * Apply confidence boost to lexicon entries based on whitelist
 *
 * Usage: node tools/boost-lexicon-confidence.mjs <input.json> <whitelist.json> <output.json>
 */

import fs from "node:fs";

const [inputPath, whitelistPath, outputPath] = process.argv.slice(2);

if (!inputPath || !whitelistPath || !outputPath) {
  console.error("Usage: node tools/boost-lexicon-confidence.mjs <input> <whitelist> <output>");
  process.exit(1);
}

const entries = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const boosts = JSON.parse(fs.readFileSync(whitelistPath, "utf8"));

// Build lookup
const boostMap = Object.fromEntries(boosts.map((b) => [b.term, b]));

let changed = 0;

// Apply boosts
for (const entry of entries) {
  const boost = boostMap[entry.term];
  if (boost) {
    const oldConf = entry.overall_confidence;
    entry.overall_confidence = boost.new_confidence;
    entry.review_required = boost.review_required;
    if (entry.semantic_lenses?.length) {
      entry.semantic_lenses[0].confidence = boost.new_confidence;
    }
    changed++;
    console.log(`✅ ${entry.term}: ${oldConf} → ${boost.new_confidence} (${boost.reason})`);
  }
}

fs.writeFileSync(outputPath, JSON.stringify(entries, null, 2), "utf8");
console.log(`\n📝 Processed ${entries.length} entries, boosted ${changed}`);
console.log(`✅ Output: ${outputPath}`);
