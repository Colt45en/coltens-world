/**
 * NSG v1.0 Ring Registry & Lexicon Determinism Tests (Phase 19b)
 *
 * Validates that:
 * 1. Ring registry order is stable across multiple calls
 * 2. Type promotion rules are deterministic
 * 3. Lexicon lookups are deterministic
 * 4. Query scoring produces identical results on 5 runs
 * 5. Candidate ranking is stable (same input → same rank order)
 */

import { describe, expect, it } from "vitest";
import type { Term } from "./nsg-ast";
import { getLexiconStats, lookupLexicon } from "./nsg-lexicon";
import { areTypesCompatible, promote } from "./nsg-promotion-table";
import { queryDecompose, rankCandidates } from "./nsg-query-scorer";
import { getAllRings } from "./nsg-ring-registry";

describe("NSG Ring Registry & Lexicon Determinism", () => {
  /**
   * Test 1: Ring Registry Order Stability
   * Ring order must never vary; always return rings in same sequence
   */
  it("test-1: ring registry order is stable across 5 calls", () => {
    const ring_sequences: string[][] = [];

    for (let i = 0; i < 5; i++) {
      const rings = getAllRings();
      const ids = rings.map((r) => r.id);
      ring_sequences.push(ids);
    }

    // All 5 sequences must be identical
    for (let i = 1; i < ring_sequences.length; i++) {
      expect(ring_sequences[i]).toEqual(
        ring_sequences[0],
        `Ring order mismatch on run ${i}`
      );
    }

    // Verify expected order
    expect(ring_sequences[0]).toEqual([
      "computational",
      "contact",
      "descriptive",
      "historical",
      "acquisition",
      "morphology",
      "phonetics",
      "phonology",
      "pragmatics",
      "prosody",
      "psycholinguistics",
      "semantics",
      "sociolinguistics",
      "syntax",
      "typology",
    ]);
  });

  /**
   * Test 2: Type Promotion Determinism
   * Same type pair → identical promoted type across 5 runs
   */
  it("test-2: type promotion rules are deterministic", () => {
    const test_cases = [
      { op: "fuse", left: "MOR", right: "MOR", expected: "LEX" },
      { op: "fuse", left: "LEX", right: "LEX", expected: "LEX" },
      { op: "fuse", left: "MOR", right: "LEX", expected: "LEX" },
      { op: "amp", left: "SEM", right: "CMP", expected: "SEM" },
      { op: "split", left: "ANY", right: "ANY", expected: "CMP" },
      { op: "flow", left: "PHO", right: "MOR", expected: "MOR" },
      { op: "link", left: "SEM", right: "LEX", expected: "PAIR" },
    ] as const;

    for (const test of test_cases) {
      const results: (string | null)[] = [];

      for (let i = 0; i < 5; i++) {
        const result = promote(
          test.op as "fuse" | "amp" | "split" | "flow" | "link" | "alt",
          test.left as any,
          test.right as any
        );
        results.push(result);
      }

      // All 5 results must match
      for (let i = 1; i < results.length; i++) {
        expect(results[i]).toEqual(
          results[0],
          `Promotion mismatch for ${test.op}(${test.left}, ${test.right}) on run ${i}`
        );
      }

      // Verify against expected
      if (test.expected !== "ANY") {
        expect(results[0]).toBe(test.expected);
      }
    }
  });

  /**
   * Test 3: Lexicon Lookup Determinism
   * Same key → identical entry across 5 lookups
   */
  it("test-3: lexicon lookups are deterministic", () => {
    const test_keys = ["re", "ion", "struct", "morph", "unknown_affix"];

    for (const key of test_keys) {
      const results: (any)[] = [];

      for (let i = 0; i < 5; i++) {
        const entry = lookupLexicon(key);
        results.push(entry);
      }

      // All 5 results must match
      for (let i = 1; i < results.length; i++) {
        expect(JSON.stringify(results[i])).toEqual(
          JSON.stringify(results[0]),
          `Lexicon lookup mismatch for "${key}" on run ${i}`
        );
      }
    }
  });

  /**
   * Test 4: Query Scoring Determinism
   * Same term decomposition → identical scores and ranking across 5 runs
   */
  it("test-4: query scoring is deterministic across 5 runs", () => {
    const test_terms: Term[] = [
      {
        kind: "Term",
        atom: "restructuring",
        type: "LEX",
        features: {},
        payload: {},
      },
      {
        kind: "Term",
        atom: "ization",
        type: "LEX",
        features: {},
        payload: {},
      },
      {
        kind: "Term",
        atom: "morphology",
        type: "LEX",
        features: {},
        payload: {},
      },
    ];

    for (const term of test_terms) {
      const results: any[] = [];

      for (let i = 0; i < 5; i++) {
        const result = queryDecompose(term);
        results.push(result);
      }

      // All 5 results must match (including scores)
      for (let i = 1; i < results.length; i++) {
        expect(JSON.stringify(results[i])).toEqual(
          JSON.stringify(results[0]),
          `Query scoring mismatch for "${term.atom}" on run ${i}`
        );
      }
    }
  });

  /**
   * Test 5: Candidate Ranking Stability
   * Same candidate set → identical ranked order across 5 runs
   */
  it("test-5: candidate ranking is stable", () => {
    const candidates = [
      {
        segments: ["re", "struct"],
        confidence: 0.9,
        root_match_length: 6,
        canonical_order: "prefix-re-root-struct",
      },
      {
        segments: ["struct", "ion"],
        confidence: 0.85,
        root_match_length: 6,
        canonical_order: "root-struct-suffix-ion",
      },
      {
        segments: ["restructuring"],
        confidence: 0.5,
        root_match_length: 0,
        canonical_order: "root-restructuring",
      },
    ];

    for (let run = 0; run < 5; run++) {
      const ranked = rankCandidates(candidates);
      const ranks = ranked.map((c) => c.canonical_order);

      // All 5 runs must produce identical ranking
      if (run > 0) {
        const prev_run_ranked = rankCandidates(candidates);
        const prev_ranks = prev_run_ranked.map((c) => c.canonical_order);
        expect(ranks).toEqual(prev_ranks, `Ranking order mismatch on run ${run}`);
      }
    }
  });

  /**
   * Test Bonus 1: Lexicon Statistics Determinism
   * Lexicon counts must be stable
   */
  it("test-bonus-1: lexicon statistics are deterministic", () => {
    const stats_list: any[] = [];

    for (let i = 0; i < 5; i++) {
      const stats = getLexiconStats();
      stats_list.push(stats);
    }

    // All stats must match
    for (let i = 1; i < stats_list.length; i++) {
      expect(stats_list[i]).toEqual(stats_list[0], `Stats mismatch on run ${i}`);
    }
  });

  /**
   * Test Bonus 2: Type Compatibility Matrix Determinism
   * Type compatibility must never vary
   */
  it("test-bonus-2: type compatibility matrix is deterministic", () => {
    const test_pairs = [
      ["PHO", "MOR"],
      ["MOR", "LEX"],
      ["LEX", "SEM"],
      ["SEM", "PRG"],
    ] as const;

    for (const [t1, t2] of test_pairs) {
      const results: boolean[] = [];

      for (let i = 0; i < 5; i++) {
        const compatible = areTypesCompatible(t1 as any, t2 as any);
        results.push(compatible);
      }

      // All 5 results must match
      for (let i = 1; i < results.length; i++) {
        expect(results[i]).toEqual(
          results[0],
          `Compatibility mismatch for ${t1}/${t2} on run ${i}`
        );
      }
    }
  });
});
