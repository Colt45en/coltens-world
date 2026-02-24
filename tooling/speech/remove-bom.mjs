#!/usr/bin/env node
import fs from "node:fs";

const content = fs.readFileSync("rewriter.config.json", "utf8");
let cleaned = content;


// Remove BOM if present
if (cleaned.charCodeAt(0) === 0xfeff) {
  cleaned = cleaned.slice(1);
}

fs.writeFileSync("rewriter.config.json", cleaned, "utf8");
console.log("✓ Removed BOM from rewriter.config.json");
