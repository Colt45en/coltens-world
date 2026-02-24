#!/usr/bin/env node
/**
 * Minimal TSV-to-Config Compiler (v2)
 *
 * Simpler format:
 * - For grapheme rules: grapheme <tab> out <tab> position <tab> context_before <tab> context_after
 * - For exceptions: exception <tab> input <tab> output
 *
 * Usage:
 *   node minimal-compiler.mjs < rules.tsv > config.json
 */

import fs from "node:fs";

const rules = [];
const exceptions = {};

const data = fs.readFileSync(0, "utf8").split(/\r?\n/);

for (const line of data) {
  if (!line.trim() || line.startsWith("#")) continue;

  const parts = line.split("\t").map((p) => p.trim());
  if (parts.length < 2) continue;

  const type = parts[0].toLowerCase();

  if (type === "grapheme") {
    // grapheme <tab> in <tab> out <tab> pos <tab> before <tab> after
    if (parts.length < 3) continue;
    const [, graphemeIn, graphemeOut, pos = "any", before = "", after = ""] = parts;

    if (!graphemeIn || !graphemeOut) continue;

    const afterRegex = parseContext(after);
    const beforeRegex = parseContext(before);
    const lit = graphemeIn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    let pattern = lit;
    if (afterRegex) pattern = `(?<=${afterRegex})` + pattern;
    if (beforeRegex) pattern = pattern + `(?=${beforeRegex})`;

    const posLower = pos.toLowerCase();
    if (["start", "begin"].includes(posLower)) pattern = `\\b${pattern}`;
    if (["end"].includes(posLower)) pattern = `${pattern}\\b`;
    if (["whole"].includes(posLower)) pattern = `\\b${pattern}\\b`;

    rules.push({
      id: `G_${graphemeIn.toUpperCase()}_${graphemeOut.toUpperCase()}`,
      priority: 100,
      pattern,
      flags: "gi",
      replace: graphemeOut,
      type: "grapheme",
    });
  } else if (type === "exception") {
    // exception <tab> in <tab> out
    if (parts.length < 3) continue;
    const [, excIn, excOut] = parts;
    if (!excIn || !excOut) continue;
    exceptions[excIn.toLowerCase()] = excOut;
  }
}

// Sort by priority (higher first)
rules.sort((a, b) => b.priority - a.priority);

const config = {
  version: "2.0.0",
  notes: "Grapheme rules + exceptions for speech normalization",
  exceptions,
  rules,
};

console.log(JSON.stringify(config, null, 2));

function parseContext(ctx) {
  if (!ctx) return "";
  ctx = String(ctx).trim();

  if (ctx === "vowel") return "[aeiouy]";
  if (ctx === "consonant") return "[^aeiouy ]";
  if (ctx.startsWith("set:")) {
    const set = ctx.slice(4);
    return `[${set.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}]`;
  }
  if (ctx.startsWith("re:")) return ctx.slice(3);

  // Treat as literal character set
  return `[${ctx.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}]`;
}
