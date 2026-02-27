# 📋 Formatting Kernel — API Quick Reference

## Imports

```typescript
import {
  // Contracts
  type GovernOptions,
  type SortKeyEntry,
  type SortKeyPlan,
  type BibEntry,
  type BibSourceType,

  // Classes
  PunctuationGovernor,

  // Functions
  buildSortKey,
  sortDeterministically,
  formatBibEntry,
  formatContributors,
  getLocale,
  fnv1a64Hex,
  normalizeForKey,
  createEngineFormattingTools,

  // Locale
  EN_US
} from "@world-engine/engine";
```

## Punctuation Governor

```typescript
const gov = new PunctuationGovernor(opts?: GovernOptions);

gov.govern(text: string): string
```

**Options:**
```typescript
interface GovernOptions {
  locale?: "en-US";              // default: en-US
  ensureTerminalPunct?: boolean; // default: true
  terminalPunct?: string;        // default: "."
  collapseWhitespace?: boolean;  // default: true
  removeSpaceBeforePunct?: boolean; // default: true
  removeSpaceAfterOpenBracket?: boolean; // default: true
  removeSpaceBeforeCloseBracket?: boolean; // default: true
  dedupePunctuation?: boolean;   // default: true
  ensureSpaceAfterPunct?: boolean; // default: true
}
```

**Examples:**
```typescript
gov.govern("  hello  , world  ");      // → "hello, world."
gov.govern("hello!!!!");               // → "hello!."
gov.govern("hello...");                // → "hello..." (kept)
gov.govern("hello");                   // → "hello." (added)
gov.govern('(  test  )');              // → "(test)."
```

## Sort Keys

```typescript
const { canonical_key, tie_break, raw_key } = buildSortKey(
  entry: SortKeyEntry,
  plan: SortKeyPlan
);
```

**Types:**
```typescript
interface SortKeyEntry {
  id: string;              // unique ID (for tie-break)
  type?: string;           // optional: record type
  fields: Record<string, Json>;
}

interface SortKeyPlan {
  fieldOrder: string[];    // e.g., ["author", "title", "year"]
  includeYear?: boolean;   // default: true
  yearField?: string;      // default: "year"
}

interface SortKeyParts {
  raw_key: string;         // original joined text
  canonical_key: string;   // normalized for sorting
  tie_break: string;       // FNV-1a 64-bit hash
}
```

**Example:**
```typescript
const parts = buildSortKey(
  {
    id: "doc_123",
    fields: { author: "Smith", title: "Patterns", year: 2020 }
  },
  { fieldOrder: ["author", "title", "year"], includeYear: true }
);

// parts.canonical_key → "smith patterns 2020" (normalized)
// parts.tie_break → "a1b2c3d4e5f6g7h8" (hash of "doc_123")
```

## Deterministic Sorting

```typescript
const sorted = sortDeterministically(
  entries: SortKeyEntry[],
  plan: SortKeyPlan
): SortKeyEntry[]
```

Sorts by `(canonical_key, tie_break)` — reproducible every time.

**Example:**
```typescript
const sorted = sortDeterministically(myEntries, myPlan);
// Same result on every call ✓
```

## Bibliography Formatting

```typescript
const text = formatBibEntry(
  entry: BibEntry,
  locale: LocaleRules,
  rules: AuthorRules,
  gov: PunctuationGovernor
): string
```

**Supported Types:**
- `Book`, `BookSection`
- `JournalArticle`, `ArticleInAPeriodical`
- `ConferenceProceedings`, `Report`
- `InternetSite`, `DocumentFromInternetSite`
- `Patent`, `Case`, `Film`, `Misc`

**Types:**
```typescript
interface BibEntry {
  id: string;
  sourceType: BibSourceType;
  title?: string;
  shortTitle?: string;
  year?: number;
  publisher?: string;
  contributors?: {
    Author?: ContributorList;
    Editor?: ContributorList;
    // ... etc
  };
}

interface ContributorList {
  corporate?: string;                 // Organization name
  people?: ContributorPerson[];       // Array of people
}

interface ContributorPerson {
  first?: string;                     // First name
  middle?: string;
  last?: string;
}

interface AuthorRules {
  maxAuthors: number;    // when to switch to "et al." (e.g., 3)
  etAlPosition: number;  // how many to show before "et al." (e.g., 1)
}
```

**Example:**
```typescript
const text = formatBibEntry(
  {
    id: "book_1",
    sourceType: "Book",
    title: "Clean Code",
    contributors: {
      Author: {
        people: [{ last: "Martin", first: "Robert" }]
      }
    },
    publisher: "Prentice Hall",
    year: 2008
  },
  getLocale("en-US"),
  { maxAuthors: 3, etAlPosition: 3 },
  new PunctuationGovernor()
);
// → "MARTIN R. Clean Code. Prentice Hall. 2008."
```

## Contributors

```typescript
const text = formatContributors(
  list: ContributorList | undefined,
  locale: LocaleRules,
  rules: AuthorRules,
  gov: PunctuationGovernor
): string
```

**Example:**
```typescript
const text = formatContributors(
  {
    people: [
      { last: "Smith", first: "John" },
      { last: "Doe", first: "Jane" }
    ]
  },
  getLocale("en-US"),
  { maxAuthors: 10, etAlPosition: 10 },
  gov
);
// → "SMITH J., DOE J."
```

## Canonicalization

```typescript
// Deterministic normalize for sorting
const key = normalizeForKey(text: string): string;

// Stable hash (FNV-1a 64-bit)
const hash = fnv1a64Hex(text: string): string;
```

**Examples:**
```typescript
normalizeForKey("Café au Lait")     // → "cafe au lait"
normalizeForKey("CaFé au LAIT")     // → "cafe au lait"
normalizeForKey("café.au;lait")     // → "cafe au lait" (punct removed)

fnv1a64Hex("hello world")          // → "a1b2c3d4e5f6g7h8"
fnv1a64Hex("hello world")          // → "a1b2c3d4e5f6g7h8" (same)
```

## Locales

```typescript
const loc = getLocale(id?: LocaleId): LocaleRules;
```

**Available:** `"en-US"`

**LocaleRules:**
```typescript
interface LocaleRules {
  id: LocaleId;
  space: string;                   // " "
  nbSpace: string;                 // non-breaking space
  listSeparator: string;           // ", "
  groupSeparator: string;          // ". "
  authorsSeparator: string;        // ", "
  endChars: string;                // ".!?…)]}\""'"
  dot: string;                     // "."
  and: string;                     // "and"
  andOthers: string;               // "et al."
  sineNomine: string;              // "sine nomine"
  sineLoco: string;                // "sine loco"
  // ... more
}
```

## Nucleus Tools

```typescript
const tools = createEngineFormattingTools(): Record<string, ToolHandler>;

// Available tools:
// - "engine.format.govern_text"  (normalize text)
// - "engine.sort.build_key"       (build sort key)
// - "engine.sort.sort_entries"    (sort deterministically)
// - "engine.bib.format"           (format bibliography)
```

**Tool: engine.format.govern_text**
```typescript
// Input
{ text: string, options?: GovernOptions }

// Output
{ text: string }
```

**Tool: engine.sort.build_key**
```typescript
// Input
{ entry: SortKeyEntry, plan: SortKeyPlan, locale?: LocaleId }

// Output
{ canonical_key: string, tie_break: string, raw_key: string }
```

**Tool: engine.sort.sort_entries**
```typescript
// Input
{ entries: SortKeyEntry[], plan: SortKeyPlan, locale?: LocaleId }

// Output
{ ordered_ids: string[] }
```

**Tool: engine.bib.format**
```typescript
// Input
{
  entries: BibEntry[],
  options?: { locale?: LocaleId, maxAuthors?: number, etAlPosition?: number }
}

// Output
{
  lines: Array<{ id: string, text: string, sort_key: string, tie_break: string }>,
  ordered_ids: string[]
}
```

## Common Patterns

### Normalize and sort

```typescript
const governor = new PunctuationGovernor({ locale: "en-US" });

const records = items.map(item => ({
  ...item,
  display: governor.govern(item.rawText)
}));

const sorted = sortDeterministically(records, {
  fieldOrder: ["display"],
  includeYear: false
});
```

### Bibliography + metadata

```typescript
const { lines, ordered_ids } = toolHandlers["engine.bib.format"]({
  entries: bibEntries,
  options: { maxAuthors: 3, etAlPosition: 1 }
});

const byId = Object.fromEntries(lines.map(l => [l.id, l]));
// Now access: byId[id].text, byId[id].sort_key, etc.
```

### Store in database

```typescript
const display = governor.govern(rawText);
const { canonical_key, tie_break } = buildSortKey(
  { id, fields: { text: display } },
  plan
);

await db.insert("table", {
  id,
  display,
  sort_key: canonical_key,
  sort_tie: tie_break
});
```

### Query with sort

```typescript
const rows = await db.query(
  "SELECT * FROM table WHERE category = ? ORDER BY sort_key, sort_tie",
  [category]
);
// Ordered deterministically ✓
```

---

## Determinism Guarantee

**Same inputs → same output, always.**

```typescript
const a = gov.govern("  test  ");
const b = gov.govern("  test  ");
// a === b ✓

const k1 = buildSortKey(entry, plan);
const k2 = buildSortKey(entry, plan);
// k1 === k2 ✓

const sorted1 = sortDeterministically(entries, plan);
const sorted2 = sortDeterministically(entries, plan);
// sorted1[i].id === sorted2[i].id for all i ✓
```

No randomness. No time. No side effects.

---

**Full docs:** [packages/engine/src/formatting/README.md](../packages/engine/src/formatting/README.md)
**Integration:** [FORMATTING_KERNEL_INTEGRATION.md](../FORMATTING_KERNEL_INTEGRATION.md)
