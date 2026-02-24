#!/usr/bin/env node
/**
 * Final Verification Test - Speech Normalization System
 * Confirms all production files are in place and functional
 *
 * Requirements:
 * - Run under Node ESM (package.json: { "type": "module" }) OR rename file to .mjs
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const BASE = process.cwd();
const SPEECH_DIR = path.join(BASE, "tooling", "speech");

const hr = () => console.log(`${"=".repeat(60)}\n`);
const yesno = (b) => (b ? "✅" : "❌");

console.log(`\n🔍 World Engine Speech Normalization System - Final Verification\n`);
console.log(`Base: ${BASE}`);
console.log(`Speech Dir: ${SPEECH_DIR}\n`);

function existsFile(p) {
  try {
    return fs.existsSync(p) && fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function fileSizeBytes(p) {
  try {
    return fs.statSync(p).size;
  } catch {
    return 0;
  }
}

function formatBytes(n) {
  if (!Number.isFinite(n)) return "0 B";
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

// --- File lists
const files = [
  { name: "rewriter.config.json", type: "config", desc: "Compiled rules" },
  { name: "rewriter.mjs", type: "engine", desc: "Execution engine" },
  { name: "sounds-final.tsv", type: "source", desc: "Combined rules" },
  { name: "exceptions-clean.tsv", type: "source", desc: "Exception overrides" },
  { name: "test-rewriter.mjs", type: "test", desc: "Test harness" },
];

const docs = [
  { name: "SPEECH_NORMALIZATION_SYSTEM.md", desc: "Full spec" },
  { name: "SPEECH_SYSTEM_QUICK_REF.md", desc: "Developer guide" },
  { name: "SESSION_4_DELIVERY_SUMMARY.md", desc: "Delivery report" },
];

// --- Presence checks
console.log(`📦 Production Files:\n`);
let allPresent = true;

for (const file of files) {
  const filePath = path.join(SPEECH_DIR, file.name);
  const exists = existsFile(filePath);
  const status = yesno(exists);
  const size = exists ? ` (${formatBytes(fileSizeBytes(filePath))})` : "";
  console.log(`  ${status} ${file.name}${size}`);
  console.log(`     Type: ${file.type} | ${file.desc}`);
  allPresent = allPresent && exists;
}

console.log(`\n📚 Documentation:\n`);
for (const doc of docs) {
  const filePath = path.join(BASE, doc.name);
  const exists = existsFile(filePath);
  const status = yesno(exists);
  console.log(`  ${status} ${doc.name}`);
  console.log(`     ${doc.desc}`);
  allPresent = allPresent && exists;
}

// --- Config validation
console.log(`\n🔬 Configuration Validation:\n`);
let config = null;
let configPath = path.join(SPEECH_DIR, "rewriter.config.json");

if (!existsFile(configPath)) {
  console.log(`  ❌ Missing config: ${path.relative(BASE, configPath)}`);
  allPresent = false;
} else {
  try {
    const configText = fs.readFileSync(configPath, "utf8");
    config = JSON.parse(configText);

    const version = typeof config.version === "string" ? config.version : "N/A";
    const rulesCount = Array.isArray(config.rules) ? config.rules.length : 0;
    const exCount =
      config.exceptions && typeof config.exceptions === "object"
        ? Object.keys(config.exceptions).length
        : 0;

    console.log(`  ✅ JSON valid`);
    console.log(`     Version: ${version}`);
    console.log(`     Rules: ${rulesCount}`);
    console.log(`     Exceptions: ${exCount}`);
    console.log(`     Config Size: ${formatBytes(fileSizeBytes(configPath))}`);

    // Minimal structural sanity (keeps it deterministic but not overbearing)
    let structureOk = true;
    if (!Array.isArray(config.rules) || config.rules.length === 0) structureOk = false;

    if (structureOk) {
      const r0 = config.rules[0];
      const hasFields =
        r0 &&
        typeof r0.id === "string" &&
        typeof r0.pattern === "string" &&
        typeof r0.replace === "string";
      if (!hasFields) structureOk = false;
    }

    if (!structureOk) {
      console.log(`  ❌ Config structure invalid: expected non-empty rules with {id, pattern, replace}`);
      allPresent = false;
    } else {
      console.log(`\n  Rule Sample:`);
      console.log(`     ID: ${config.rules[0].id}`);
      console.log(`     Pattern: ${config.rules[0].pattern}`);
      console.log(`     Replace: ${config.rules[0].replace}`);
    }

    if (config.exceptions && typeof config.exceptions === "object") {
      const exEntries = Object.entries(config.exceptions);
      console.log(`\n  Exceptions Sample:`);
      for (const [input, output] of exEntries.slice(0, 3)) {
        console.log(`     "${input}" → "${output}"`);
      }
      if (exEntries.length > 3) console.log(`     ... and ${exEntries.length - 3} more`);
    }
  } catch (e) {
    console.log(`  ❌ Config error: ${String(e).split("\n")[0]}`);
    allPresent = false;
  }
}

// --- Engine test
console.log(`\n⚙️ Engine Test:\n`);
let engineOk = true;

try {
  const enginePath = path.join(SPEECH_DIR, "rewriter.mjs");
  if (!existsFile(enginePath)) throw new Error(`Missing engine file: ${enginePath}`);

  // IMPORTANT: dynamic import should use file:// URL
  const engineUrl = pathToFileURL(enginePath).href;
  const mod = await import(engineUrl);

  if (!mod || typeof mod.SpeechRewriter !== "function") {
    throw new Error(`Engine module missing export: SpeechRewriter`);
  }

  const rewriter = new mod.SpeechRewriter(configPath);

  // Deterministic micro-test
  const testText = "the quick brown fox";
  const result = rewriter.rewritePreservingCase(testText);
  const explanation = rewriter.explain(testText);

  const exceptionsApplied = Array.isArray(explanation?.exceptions) ? explanation.exceptions.length : 0;
  const rulesApplied = Array.isArray(explanation?.graphemes) ? explanation.graphemes.length : 0;

  console.log(`  ✅ Engine loaded`);
  console.log(`     Input: "${testText}"`);
  console.log(`     Output: "${result}"`);
  console.log(`     Exceptions applied: ${exceptionsApplied}`);
  console.log(`     Rules applied: ${rulesApplied}`);

  // Optional: fail if rewrite returns empty or non-string
  if (typeof result !== "string" || result.length === 0) {
    throw new Error(`rewritePreservingCase returned invalid output`);
  }
} catch (e) {
  engineOk = false;
  console.log(`  ❌ Engine test failed: ${String(e).split("\n")[0]}`);
}

// --- Summary
hr();

const passed = allPresent && engineOk;

if (passed) {
  const rulesCount = Array.isArray(config?.rules) ? config.rules.length : "N/A";
  const exCount =
    config?.exceptions && typeof config.exceptions === "object"
      ? Object.keys(config.exceptions).length
      : "N/A";
  const cfgSize = existsFile(configPath) ? formatBytes(fileSizeBytes(configPath)) : "N/A";

  console.log(`✅ VERIFICATION PASSED - All Files Present & Functional\n`);
  console.log(`📊 Summary:`);
  console.log(`   • Rules Compiled: ${rulesCount}`);
  console.log(`   • Exceptions: ${exCount}`);
  console.log(`   • Production Config Size: ${cfgSize}`);
  console.log(`   • Execution Engine Tested: ✅`);
  console.log(`   • Documentation Files: ✅`);
  console.log(`\n🚀 Ready for Integration - Next: Python Wrapper (Session 5)\n`);
} else {
  console.log(`❌ VERIFICATION FAILED\n`);
  console.log(`Fix the missing/failed items above and rerun.\n`);
  process.exitCode = 1;
}

hr();
