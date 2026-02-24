#!/usr/bin/env node
/**
 * Test Harness for Speech Rewriter
 * Golden tests + determinism verification
 *
 * Usage:
 *   node tooling/speech/test-rewriter.mjs
 *   node tooling/speech/test-rewriter.mjs --verbose
 *   node tooling/speech/test-rewriter.mjs --config /path/to/config.json
 */

import { promises as fs } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig, buildRewriter } from "./rewriter.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = {
    verbose: false,
    config: resolve(__dir, "rewriter.config.json"),
  };

  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--verbose") {
      args.verbose = true;
    } else if (argv[i] === "--config" && i + 1 < argv.length) {
      args.config = argv[++i];
    }
  }

  return args;
}

const GOLDEN_TESTS = [
  {
    input: "the",
    expected: "ðə",
    description: "Exception: voiced TH in 'the'",
  },
  {
    input: "thin",
    expected: "ðin",
    description: "TH handling in 'thin' (per sounds-final.tsv)",
  },
  {
    input: "phone",
    expected: "fone",
    description: "Grapheme: 'ph' → 'f'",
  },
  {
    input: "knight",
    expected: "nīt",
    description: "Exception: 'knight' (per sounds-final.tsv)",
  },
  {
    input: "nation",
    expected: "našon",
    description: "Grapheme: 'tion' → 'šon' (per sounds-final.tsv)",
  },
  {
    input: "vision",
    expected: "vižon",
    description: "Grapheme: 'sion' → 'žon' (per sounds-final.tsv)",
  },
  {
    input: "moon",
    expected: "mūn",
    description: "Grapheme: 'oo' → 'ū' (per sounds-final.tsv)",
  },
  {
    input: "book",
    expected: "būk",
    description: "Grapheme: 'oo' → 'ū' before 'k' (per sounds-final.tsv)",
  },
  {
    input: "This,",
    expected: "Ðĭs,",
    description: "Voiced TH title case + punctuation preservation (normalized ĭ)",
  },
];

async function main() {
  const args = parseArgs(process.argv);

  try {
    console.log(
      `\n📖 Speech Rewriter Test Suite\n${"=".repeat(50)}\n`,
    );

    // Load config
    let config;
    try {
      config = await loadConfig(args.config);
      console.log(`✓ Config loaded: ${args.config}\n`);
    } catch (err) {
      console.error(`✗ Failed to load config: ${err.message}`);
      process.exit(1);
    }

    // Verify canonical source (prevent accidental drift)
    // Accept both "sounds-final.tsv" (when compiled from tooling/speech cwd)
    // and "tooling/speech/sounds-final.tsv" (when compiled from repo root)
    const gotSource = (config.source?.tsv ?? "").trim();
    const isCanonical = gotSource === "sounds-final.tsv" || gotSource === "tooling/speech/sounds-final.tsv";
    if (!isCanonical) {
      console.error(`[FAIL] Config source mismatch`);
      console.error(`  got : ${gotSource}`);
      console.error(`  want: sounds-final.tsv`);
      process.exit(1);
    }

    // Build rewriter
    const rewriter = buildRewriter(config);
    let passCount = 0;
    let failCount = 0;

    console.log("🧪 Golden Tests:\n");

    for (const test of GOLDEN_TESTS) {
      const result = rewriter.rewriteText(test.input);
      const passed = result === test.expected;

      if (passed) {
        passCount++;
        console.log(`  ✓ [PASS] ${test.description}`);
        if (args.verbose) {
          console.log(`         Input:    "${test.input}"`);
          console.log(`         Expected: "${test.expected}"`);
          console.log(`         Got:      "${result}"\n`);
        }
      } else {
        failCount++;
        console.log(`  ✗ [FAIL] ${test.description}`);
        console.log(`         Input:    "${test.input}"`);
        console.log(`         Expected: "${test.expected}"`);
        console.log(`         Got:      "${result}"\n`);
      }
    }

    // Determinism checks
    console.log(`\n🔄 Determinism Verification (${GOLDEN_TESTS.length} samples):\n`);

    const deterministicSamples = [
      "the quick brown fox jumps over the lazy dog",
      "nation, vision, phone, knight, thistle",
      "MOON book PHONE KNIGHT",
    ];

    let determinismOk = true;

    for (const sample of deterministicSamples) {
      const run1 = rewriter.rewriteText(sample);
      const run2 = rewriter.rewriteText(sample);

      if (run1 === run2) {
        console.log(`  ✓ [DETERMINISTIC] "${sample.substring(0, 40)}..."`);
      } else {
        console.log(`  ✗ [NON-DETERMINISTIC] "${sample.substring(0, 40)}..."`);
        console.log(`         Run 1: "${run1}"`);
        console.log(`         Run 2: "${run2}"`);
        determinismOk = false;
      }
    }

    // Summary
    console.log(`\n${"=".repeat(50)}`);
    console.log(
      `\n📊 Results: ${passCount}/${GOLDEN_TESTS.length} golden tests passed`,
    );

    if (failCount > 0) {
      console.log(`   ⚠️  ${failCount} test(s) failed\n`);
    }

    if (determinismOk) {
      console.log(`   ✓ Determinism check: PASSED\n`);
    } else {
      console.log(`   ✗ Determinism check: FAILED\n`);
      process.exit(1);
    }

    if (failCount === 0) {
      console.log(`\n🎉 All tests passed!\n`);
      process.exit(0);
    } else {
      console.log(`\n❌ Some tests failed.\n`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`\n❌ Error: ${err.message}\n`);
    if (args.verbose) {
      console.error(err.stack);
    }
    process.exit(1);
  }
}

main();
