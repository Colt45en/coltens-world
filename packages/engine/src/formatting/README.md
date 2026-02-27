# 📝 World Engine Formatting Kernel

**Deterministic text normalization, sort keys, and bibliography formatting** — integrated into `packages/engine/`.

## Overview

This formatting kernel provides **contract-first**, **deterministic** tools for:

1. **Punctuation Governor** — normalizes text (spacing, terminal punctuation, deduplication)
2. **Canonical Sort Keys** — locale-free, stable sorting (FNV-1a 64-bit tiebreak)
3. **Author Truncation** — rule-based contributor formatting (max authors, et al. rules)
4. **Bibliography Formatting** — type-specific schemes (Book, Journal, Patent, Case, Internet)
5. **Tool Lane Integration** — Nucleus/tool_call compatible handlers

## Architecture

```
packages/engine/src/
├── contracts/
│   └── formatting.ts          ← Contract definitions (types + I/O schemas)
├── formatting/
│   ├── index.ts               ← Barrel export
│   ├── locale.ts              ← Language rules (EN_US)
│   ├── canon.ts               ← FNV-1a hashing + normalization
│   ├── governor.ts            ← Punctuation normalization
│   ├── authors.ts             ← Contributor formatting
│   ├── sort.ts                ← Sort key building + sorting
│   ├── biblio.ts              ← Bibliography formatting
│   └── tools.ts               ← Nucleus tool handlers
└── test/
    └── formatting.test.ts      ← Determinism + contract tests
```

## Quick Start

### 1. Import the kernel

```typescript
import {
  PunctuationGovernor,
  buildSortKey,
  sortDeterministically,
  formatBibEntry,
  createEngineFormattingTools
} from "@world-engine/engine";
```

### 2. Normalize text

```typescript
const gov = new PunctuationGovernor({ locale: "en-US" });
const clean = gov.govern("  hello   ,    world  ");
// → "hello, world."
```

### 3. Build deterministic sort keys

```typescript
const plan = {
  fieldOrder: ["author", "title", "year"],
  includeYear: true,
  yearField: "year"
};

const { canonical_key, tie_break, raw_key } = buildSortKey(
  {
    id: "doc_123",
    fields: { author: "Smith", title: "Patterns", year: 2020 }
  },
  plan
);
```

### 4. Sort deterministically

```typescript
const sorted = sortDeterministically(entries, plan);
// Ordered by (canonical_key, tie_break) — same result every time
```

### 5. Format bibliography

```typescript
const bibLines = formatBibEntry(
  {
    id: "book_1",
    sourceType: "Book",
    title: "The Pragmatic Programmer",
    contributors: {
      Author: {
        people: [
          { last: "Hunt", first: "Andrew" },
          { last: "Thomas", first: "David" }
        ]
      }
    },
    publisher: "Addison-Wesley",
    year: 1999
  },
  getLocale("en-US"),
  { maxAuthors: 3, etAlPosition: 3 },
  new PunctuationGovernor({ locale: "en-US" })
);
// → "HUNT A., THOMAS D. The Pragmatic Programmer. Addison-Wesley. 1999."
```

## Core Concepts

### Determinism

All operations are **purely functional** and **reproducible**:

```typescript
// Call 1000 times, get the same result
const k1 = buildSortKey(entry, plan);
const k2 = buildSortKey(entry, plan);
// k1 === k2 ✓
```

No random numbers, no wall-clock time, no side effects.

### Locale-Independent Sort Keys

The canonical sort key is **normalized** so that equivalent text sorts the same way across systems:

```typescript
const k1 = buildSortKey({ id: "x", fields: { title: "Café" } }, plan);
const k2 = buildSortKey({ id: "x", fields: { title: "cafe" } }, plan);
// k1.canonical_key === k2.canonical_key ✓
// (both normalize to "cafe")
```

### Explicit Missing-Data Rules

Each bibliography type has **explicit** rules for missing fields:

```typescript
// Book with no publisher → uses "sine nomine" (no name)
const formatted = formatBook(
  {
    id: "b",
    title: "Unknown Work",
    // publisher omitted
  },
  locale,
  rules,
  gov
);
// → "Unknown Work. sine nomine. [year if present]"
```

### Tiebreaking

When two entries have the **same** canonical sort key, they break ties using a stable hash of their ID:

```typescript
const a = buildSortKey({ id: "a_123", fields: { title: "A" } }, plan);
const b = buildSortKey({ id: "b_456", fields: { title: "A" } }, plan);
// a.canonical_key === b.canonical_key
// But tie-break via: fnv1a64Hex("a_123") vs fnv1a64Hex("b_456")
```

## Integration: Wiring into Nucleus

### 1. Register tools in your agent router

```typescript
// In your Nucleus agent handler / tool dispatcher:
import { createEngineFormattingTools } from "@world-engine/engine";

const tools = {
  ...createEngineFormattingTools(),
  // ... your other tools
};

// Now available:
// - engine.format.govern_text
// - engine.sort.build_key
// - engine.sort.sort_entries
// - engine.bib.format
```

### 2. Call via tool_call envelope

```json
{
  "kind": "tool.call",
  "name": "engine.format.govern_text",
  "args": {
    "text": "  hello  , world  "
  }
}
```

Response:

```json
{
  "text": "hello, world."
}
```

### 3. Store formatted output in your records

When saving a record (bibliography entry, memory node, artifact, etc.):

```typescript
const display = gov.govern(rawText);
const { canonical_key, tie_break } = buildSortKey(entry, plan);

// Store all three:
record.display = display;
record.sort_key = canonical_key;
record.sort_tie = tie_break;
```

Then when querying, sort by `(record.sort_key, record.sort_tie)`.

## API Reference

### `PunctuationGovernor`

```typescript
class PunctuationGovernor {
  constructor(opts?: GovernOptions);
  govern(input: string): string;
}

interface GovernOptions {
  locale?: LocaleId;
  ensureTerminalPunct?: boolean; // default true
  terminalPunct?: string;        // default "."
  collapseWhitespace?: boolean;  // default true
  removeSpaceBeforePunct?: boolean; // default true
  dedupePunctuation?: boolean;   // default true
  ensureSpaceAfterPunct?: boolean; // default true
}
```

### `buildSortKey(entry, plan): SortKeyParts`

```typescript
interface SortKeyParts {
  raw_key: string;        // original fields joined
  canonical_key: string;  // normalized (locale-free)
  tie_break: string;      // FNV-1a 64-bit hash of id
}

interface SortKeyEntry {
  id: string;
  type?: string;
  fields: Record<string, Json>;
}

interface SortKeyPlan {
  fieldOrder: string[];   // which fields, in order
  includeYear?: boolean;  // include year field?
  yearField?: string;     // default "year"
}
```

### `sortDeterministically(entries, plan): SortKeyEntry[]`

Returns entries sorted by `(canonical_key, tie_break)`.

### `formatBibEntry(entry, locale, rules, gov): string`

Formats a single bibliography entry. Type dispatch:
- `Book`, `BookSection`
- `JournalArticle`, `ArticleInAPeriodical`
- `ConferenceProceedings`, `Report`
- `InternetSite`, `DocumentFromInternetSite`
- `Patent`, `Case`, `Film`, `Misc`

### `formatContributors(list, locale, rules, gov): string`

Formats `Author`, `Editor`, `Translator`, `Inventor`, `Director`, `Counsel` roles.

## Testing

Run determinism tests:

```bash
cd packages/engine
pnpm test -- test/formatting.test.ts
```

Tests cover:

- **Canonicalization**: FNV-1a determinism, locale-free normalization
- **Governance**: spacing, punctuation, terminal markers, deduplication
- **Author truncation**: corporate, people, et al. rules
- **Sort key building**: deterministic reproducibility, field order
- **Sorting**: by (canonical_key, tie_break), field inclusion toggles

## Extending

### Add a new locale

Edit [locale.ts](./src/formatting/locale.ts):

```typescript
export const FR_FR: LocaleRules = {
  id: "fr-FR",
  space: " ",
  listSeparator: ", ",
  // ... customize per language
};

export function getLocale(id: LocaleId | undefined): LocaleRules {
  switch (id ?? "en-US") {
    case "fr-FR":
      return FR_FR;
    // ...
  }
}
```

### Add a new bibliography type

Edit [biblio.ts](./src/formatting/biblio.ts):

```typescript
function formatMyType(e: BibEntry, loc: LocaleRules, rules: AuthorRules, gov: PunctuationGovernor): string {
  // Explicit missing-data rules per field
  const title = present(e.title) || loc.sineNomine;
  // ... assemble parts
  return joinNonEmpty(parts, loc.groupSeparator);
}

export function formatBibEntry(...): string {
  switch (e.sourceType) {
    case "MyType":
      return gov.govern(formatMyType(...));
    // ...
  }
}
```

## Design Principles

✅ **Contract-First**: Type-defined I/O, no implicit behavior
✅ **Deterministic**: Same input → same output, always
✅ **Composable**: Rules + governors + plans stack safely
✅ **Explicit**: Missing data, truncation, ordering all declared
✅ **Locale-Aware**: Rules per language, but keys are universal
✅ **Tool-Ready**: Nucleus tool_call compatible

## Use Cases

1. **Citation/Bibliography Management** — stable sort keys for database indexes
2. **Memory/Note Labels** — govern display text, compute sort keys for retrieval
3. **UI String Normalization** — ensure punctuation consistency across UIs
4. **Artifact Naming** — canonicalize artifact titles for deduplication
5. **Lexicon Entry Formatting** — rule-based display + deterministic ordering
6. **Log Aggregation** — normalize message formatting before indexing

## Next Steps

- [ ] Add your locale (FR_FR, DE_DE, etc.)
- [ ] Integrate with your artifact/record persistence layer
- [ ] Add more bibliography types (Thesis, TechReport, etc.)
- [ ] Hook into Nucleus agent router
- [ ] Build UI components that use the governor (display names, captions)

---

**Questions?** Check [formatting.test.ts](./test/formatting.test.ts) for working examples.
