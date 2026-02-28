/**
 * NSG v1.0 Parser Determinism Tests
 *
 * Validates that:
 * 1. Same input → same AST hash across 5 independent runs
 * 2. Operator precedence is stable and correct
 * 3. Associativity rules are enforced (left-assoc for +)
 * 4. Canonicalization produces identical form every time
 * 5. Feature/payload maps are always sorted
 */

import { describe, expect, it } from "vitest";
import { canonicalize, hashNode } from "./nsg-canon";
import { parseSingleExpression } from "./nsg-parser";

describe("NSG Parser Determinism", () => {
  /**
   * Test 1: Hash Determinism
   * Same input → identical hash across 5 independent parses
   */
  it("test-1: same input produces identical hash across 5 runs", () => {
    const inputs = [
      "@morphology: (re:MOR + struct:MOR + ion:MOR)!",
      "salt:SEM <-> sound:PHO -> structure:SEM!",
      "word:LEX | stem:LEX | root:LEX",
      "? (restructuring:LEX / morphology.rules)",
      "(@contact: english:LEX <-> spanish:LEX)[mode=code_switch]",
    ];

    for (const input of inputs) {
      const hashes: string[] = [];

      for (let i = 0; i < 5; i++) {
        const ast = parseSingleExpression(input);
        const canonical = canonicalize(ast);
        const hash = hashNode(ast);
        hashes.push(hash);
      }

      // All 5 runs must produce identical hash
      for (let i = 1; i < hashes.length; i++) {
        expect(hashes[i]).toBe(hashes[0], `Run ${i} hash mismatch for: ${input}`);
      }
    }
  });

  /**
   * Test 2: Operator Precedence Stability
   * Confirm parsing follows fixed operator precedence:
   * alt < link < flow < fuse < amp < split
   */
  it("test-2: operator precedence is stable and correct", () => {
    // Test alt has lowest precedence (binds loosest)
    // a + b | c + d should parse as (a + b) | (c + d), not (a + (b | c)) + d
    const ast1 = parseSingleExpression("a + b | c + d");
    expect(ast1.kind).toBe("Alt");
    if (ast1.kind === "Alt") {
      expect(ast1.children[0].kind).toBe("Fuse");
      expect(ast1.children[1].kind).toBe("Fuse");
    }

    // Test + binds tighter than <->
    // a <-> b + c should parse as a <-> (b + c), not (a <-> b) + c
    const ast2 = parseSingleExpression("a <-> b + c");
    expect(ast2.kind).toBe("Link");
    if (ast2.kind === "Link") {
      expect(ast2.children[1].kind).toBe("Fuse");
    }

    // Test -> binds tighter than <->
    // a <-> b -> c should parse as a <-> (b -> c)
    const ast3 = parseSingleExpression("a <-> b -> c");
    expect(ast3.kind).toBe("Link");
    if (ast3.kind === "Link") {
      expect(ast3.children[1].kind).toBe("Flow");
    }

    // Test * binds tighter than +
    // a + b * c should parse as a + (b * c)
    const ast4 = parseSingleExpression("a + b * c");
    expect(ast4.kind).toBe("Fuse");
    if (ast4.kind === "Fuse" && ast4.children.length === 2) {
      expect(ast4.children[1].kind).toBe("Amp");
    }
  });

  /**
   * Test 3: Associativity Stability
   * Confirm left-associativity for +, *, and other multi-arg operators
   * a + b + c should produce Fuse([a, b, c], not nested structure
   */
  it("test-3: associativity rules stable (left-assoc for +)", () => {
    // a + b + c should flatten to Fuse([a, b, c])
    const ast1 = parseSingleExpression("a + b + c");
    expect(ast1.kind).toBe("Fuse");
    if (ast1.kind === "Fuse") {
      expect(ast1.children.length).toBe(3);
      expect(ast1.children[0].kind).toBe("Term");
      expect(ast1.children[1].kind).toBe("Term");
      expect(ast1.children[2].kind).toBe("Term");
    }

    // a * b * c should produce Amp(Amp(a, b), c) (binary, left-assoc)
    const ast2 = parseSingleExpression("a * b * c");
    expect(ast2.kind).toBe("Amp");
    if (ast2.kind === "Amp") {
      expect(ast2.children[0].kind).toBe("Amp");
      expect(ast2.children[1].kind).toBe("Term");
    }

    // a <-> b <-> c should flatten to Link([a, b, c])
    const ast3 = parseSingleExpression("a <-> b <-> c");
    expect(ast3.kind).toBe("Link");
    if (ast3.kind === "Link") {
      expect(ast3.children.length).toBe(3);
    }
  });

  /**
   * Test 4: Canonicalization Stability
   * Same AST → identical canonical form and hash every time
   */
  it("test-4: canonicalization produces identical form every time", () => {
    const input = "@morphology: (a:MOR[role=prefix] + b:MOR[role=root] + c:MOR[role=suffix]{decomp=abc})!";
    const canonicals: string[] = [];

    for (let i = 0; i < 5; i++) {
      const ast = parseSingleExpression(input);
      const canonical = canonicalize(ast);
      const canonicalJSON = JSON.stringify(canonical, null, 0);
      canonicals.push(canonicalJSON);
    }

    // All 5 canonicals must be identical
    for (let i = 1; i < canonicals.length; i++) {
      expect(canonicals[i]).toBe(canonicals[0], `Canonicalization mismatch on run ${i}`);
    }
  });

  /**
   * Test 5: Feature/Payload Sorting
   * Feature and payload maps always have sorted keys (deterministic canonical form)
   */
  it("test-5: feature and payload keys are always sorted", () => {
    // Create term with features in non-sorted order
    const input = "term:LEX[zebra=1,apple=2,banana=3]{z_val=1,a_val=2,m_val=3}";
    const ast = parseSingleExpression(input);
    const canonical = canonicalize(ast);

    if (canonical.kind === "Term") {
      // Features must be sorted by key
      const featureKeys = Object.keys(canonical.features);
      const sortedKeys = [...featureKeys].sort();
      expect(featureKeys).toEqual(sortedKeys, "Feature keys not sorted");

      // Payload must be sorted by key
      const payloadKeys = Object.keys(canonical.payload);
      const sortedPayloadKeys = [...payloadKeys].sort();
      expect(payloadKeys).toEqual(sortedPayloadKeys, "Payload keys not sorted");
    }
  });

  /**
   * Bonus test: Operator precedence interaction stress test
   * Complex expression with multiple operators at different levels
   */
  it("test-bonus: complex precedence interaction stability", () => {
    const input = "a:SEM <-> b:PHO -> c:LEX + d:LEX * e:LEX | f:LEX";

    // Parse 5 times and verify hash stability
    const hashes: string[] = [];
    for (let i = 0; i < 5; i++) {
      const ast = parseSingleExpression(input);
      const hash = hashNode(ast);
      hashes.push(hash);
    }

    // All hashes must match
    for (let i = 1; i < hashes.length; i++) {
      expect(hashes[i]).toBe(hashes[0], `Complex expr hash mismatch on run ${i}`);
    }

    // Verify top-level kind (should be Alt due to lowest precedence)
    const ast = parseSingleExpression(input);
    expect(ast.kind).toBe("Alt");
  });

  /**
   * Bonus test 2: Seal and Query operators preserve determinism
   */
  it("test-bonus-2: seal and query operators stable", () => {
    const inputs = [
      "(a + b + c)!",
      "? (x:LEX / morphology.rules)",
      "! (a + b)!",
    ];

    for (const input of inputs) {
      const hashes: string[] = [];
      for (let i = 0; i < 5; i++) {
        const ast = parseSingleExpression(input);
        const hash = hashNode(ast);
        hashes.push(hash);
      }

      for (let i = 1; i < hashes.length; i++) {
        expect(hashes[i]).toBe(hashes[0], `Seal/Query hash mismatch on run ${i}`);
      }
    }
  });
});
