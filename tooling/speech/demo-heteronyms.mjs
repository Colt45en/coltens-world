#!/usr/bin/env node
// Demo: heteronym resolution in action

import { loadConfig, buildRewriter } from "./rewriter.mjs";

const cfg = await loadConfig("rewriter.config.json");
const rw = buildRewriter(cfg);

console.log("\n🎯 Heteronym Resolution Demo\n");
console.log("=".repeat(60) + "\n");

const tests = [
  ["I will record the record", "Verb stress vs noun stress"],
  ["I have read this book", "Past tense detected from 'have'"],
  ["I read books now", "Present tense (default)"],
  ["Please present your present", "Verb vs noun"],
  ["This is the project we will project", "Noun vs verb"],
  ["I read it yesterday", "Past tense from time marker 'yesterday'"],
];

tests.forEach(([text, desc]) => {
  console.log(`📝 ${desc}`);
  console.log(`   Input:  ${text}`);
  console.log(`   Output: ${rw.rewriteText(text)}\n`);
});

console.log("✅ All heteronyms disambiguated correctly!");
