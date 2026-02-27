/**
 * Formatting Module Tests
 * Determinism + normalization guarantees
 */

import assert from "node:assert/strict";
import test from "node:test";

import { formatContributors } from "../src/formatting/authors.js";
import { fnv1a64Hex, normalizeForKey } from "../src/formatting/canon.js";
import { PunctuationGovernor } from "../src/formatting/governor.js";
import { getLocale } from "../src/formatting/locale.js";
import { buildSortKey, sortDeterministically } from "../src/formatting/sort.js";

test("Canonicalization: FNV-1a is deterministic", () => {
  const h1 = fnv1a64Hex("hello world");
  const h2 = fnv1a64Hex("hello world");
  assert.equal(h1, h2);
  assert.equal(h1.length, 16); // 64-bit hex
});

test("Canonicalization: locale-free normalization", () => {
  const ak1 = normalizeForKey("Café au lait");
  const ak2 = normalizeForKey("CAFE AU LAIT");
  assert.equal(ak1, ak2); // should be "cafe au lait"
  assert.equal(ak1, "cafe au lait");
});

test("PunctuationGovernor: normalizes spacing + punctuation", () => {
  const gov = new PunctuationGovernor({ locale: "en-US" });
  const out = gov.govern("  Hello ,   world..  (  test  )  ");
  assert.equal(out, "Hello, world. (test).");
});

test("PunctuationGovernor: respects existing terminal punctuation", () => {
  const gov = new PunctuationGovernor({ locale: "en-US" });
  const out1 = gov.govern("hello world");
  const out2 = gov.govern("hello world!");
  const out3 = gov.govern("hello world?");

  assert.equal(out1, "hello world."); // adds dot
  assert.equal(out2, "hello world!"); // keeps !
  assert.equal(out3, "hello world?"); // keeps ?
});

test("PunctuationGovernor: dedupes punctuation", () => {
  const gov = new PunctuationGovernor({ locale: "en-US" });
  const out = gov.govern("hello!!!!");
  assert.equal(out, "hello!.");
});

test("PunctuationGovernor: handles ellipsis", () => {
  const gov = new PunctuationGovernor({ locale: "en-US" });
  const out1 = gov.govern("hello..");
  const out2 = gov.govern("hello...");
  const out3 = gov.govern("hello....");

  assert.equal(out1, "hello.");
  assert.equal(out2, "hello...");
  assert.equal(out3, "hello...");
});

test("Author formatting: corporate contributors", () => {
  const loc = getLocale("en-US");
  const gov = new PunctuationGovernor({ locale: "en-US", ensureTerminalPunct: false });

  const out = formatContributors(
    { corporate: "MIT Press" },
    loc,
    { maxAuthors: 3, etAlPosition: 1 },
    gov
  );

  assert.equal(out, "MIT Press");
});

test("Author formatting: truncation with et al.", () => {
  const loc = getLocale("en-US");
  const gov = new PunctuationGovernor({ locale: "en-US", ensureTerminalPunct: false });

  const out = formatContributors(
    {
      people: [
        { last: "Smith", first: "John" },
        { last: "Zed", first: "Amy" },
        { last: "Kline", first: "Bo" },
        { last: "Fourth", first: "Extra" }
      ]
    },
    loc,
    { maxAuthors: 3, etAlPosition: 1 },
    gov
  );

  assert.equal(out, "SMITH J., et al.");
});

test("Author formatting: no truncation if count <= max", () => {
  const loc = getLocale("en-US");
  const gov = new PunctuationGovernor({ locale: "en-US", ensureTerminalPunct: false });

  const out = formatContributors(
    {
      people: [
        { last: "Smith", first: "John" },
        { last: "Zed", first: "Amy" }
      ]
    },
    loc,
    { maxAuthors: 3, etAlPosition: 1 },
    gov
  );

  assert.ok(out.includes("SMITH J."));
  assert.ok(out.includes("ZED A."));
  assert.false(out.includes("et al."));
});

test("Sort key building: deterministic reproducibility", () => {
  const plan = { fieldOrder: ["author", "title", "year"], includeYear: true, yearField: "year" } as const;
  const entry = { id: "doc_123", fields: { author: "Smith", title: "Patterns", year: 2020 } };

  const k1 = buildSortKey(entry as any, plan);
  const k2 = buildSortKey(entry as any, plan);

  assert.deepEqual(k1, k2);
  assert.notEqual(k1.canonical_key, ""); // normalized
  assert.equal(k1.tie_break.length, 16); // FNV-1a hex
});

test("Sorting: deterministic ordering by (canonical_key, tie_break)", () => {
  const plan = { fieldOrder: ["author", "title", "year"], includeYear: true, yearField: "year" } as const;

  const entries = [
    { id: "y", fields: { author: "A", title: "Alpha", year: 2020 } },
    { id: "z", fields: { author: "A", title: "Alpha", year: 2020 } },
    { id: "x", fields: { author: "A", title: "Zeta", year: 2020 } }
  ];

  const sorted = sortDeterministically(entries as any, plan);

  // y and z have the same canonical key, so sorted by tie_break (hash of id)
  const yTie = fnv1a64Hex("y");
  const zTie = fnv1a64Hex("z");
  const xTie = fnv1a64Hex("x");

  // y and z sort before x (A < Z)
  assert.equal(sorted[2].id, "x");

  // y vs z: sorted by tie_break
  if (yTie < zTie) {
    assert.equal(sorted[0].id, "y");
    assert.equal(sorted[1].id, "z");
  } else {
    assert.equal(sorted[0].id, "z");
    assert.equal(sorted[1].id, "y");
  }
});

test("Sorting: field order matters", () => {
  const plan1 = { fieldOrder: ["author", "title", "year"], includeYear: true, yearField: "year" } as const;
  const plan2 = { fieldOrder: ["title", "author", "year"], includeYear: true, yearField: "year" } as const;

  const entry = { id: "doc", fields: { author: "Smith", title: "Patterns", year: 2020 } };

  const k1 = buildSortKey(entry as any, plan1);
  const k2 = buildSortKey(entry as any, plan2);

  // Different field order → different canonical keys
  assert.notEqual(k1.canonical_key, k2.canonical_key);
});

test("Sorting: includeYear controls year field", () => {
  const planWith = { fieldOrder: ["author", "year"], includeYear: true, yearField: "year" } as const;
  const planWithout = { fieldOrder: ["author", "year"], includeYear: false, yearField: "year" } as const;

  const entry = { id: "doc", fields: { author: "Smith", year: 2020 } };

  const k1 = buildSortKey(entry as any, planWith);
  const k2 = buildSortKey(entry as any, planWithout);

  // With year: should include 2020
  assert.ok(k1.raw_key.includes("2020") || k1.canonical_key.includes("2020"));
  // Without year: should not include it
  assert.false(k2.canonical_key.includes("2020"));
});
