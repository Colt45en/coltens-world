# 🔌 Formatting Kernel → Nucleus Integration Guide

**Drop-in instructions for wiring the deterministic formatting kernel into your Nucleus agent + World Engine records.**

## 1. Package Side: Export from Engine

Already done! ✅

```typescript
// packages/engine/src/index.ts exports:
export * from "./formatting/index.js";
export * from "./contracts/formatting.js";

// Available to other packages:
import {
  PunctuationGovernor,
  buildSortKey,
  createEngineFormattingTools,
  // ... etc
} from "@world-engine/engine";
```

## 2. Nucleus: Register Tool Handlers

Find your `AgentHub` or tool router (the place where you map tool names → handlers).

### Example: In your Nucleus agent service

```typescript
// apps/nucleus/src/agent/tools.ts (or wherever your tool map lives)
import { createEngineFormattingTools } from "@world-engine/engine";

// Create the formatter tool map
const formattingTools = createEngineFormattingTools();

// Merge into your existing tools
export const toolHandlers = {
  // ... your existing tools
  ...formattingTools,

  // You now have:
  // - "engine.format.govern_text"
  // - "engine.sort.build_key"
  // - "engine.sort.sort_entries"
  // - "engine.bib.format"
};
```

### Example: In your agent request handler

```typescript
// apps/nucleus/src/agent/handle-request.ts
import { toolHandlers } from "./tools.js";

async function handleToolCall(toolName: string, args: unknown): Promise<unknown> {
  const handler = toolHandlers[toolName];
  if (!handler) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  try {
    return handler(args);
  } catch (err) {
    return {
      error: String(err),
      toolName
    };
  }
}
```

## 3. Store Formatted Output in Records

Whenever you persist a record that needs stable UI order:

```typescript
import {
  PunctuationGovernor,
  buildSortKey,
  getLocale,
  type SortKeyPlan
} from "@world-engine/engine";

interface MyRecord {
  id: string;
  display: string;       // ← Governed (clean) text
  sort_key: string;      // ← Canonical key
  sort_tie: string;      // ← Tiebreaker hash
  // ... other fields
}

// When saving a record:
async function saveRecord(raw: { id: string; text: string }): Promise<MyRecord> {
  const gov = new PunctuationGovernor({ locale: "en-US" });
  const display = gov.govern(raw.text);

  const plan: SortKeyPlan = {
    fieldOrder: ["display"],  // sort by display text (already governed)
    includeYear: false
  };

  const { canonical_key, tie_break } = buildSortKey(
    { id: raw.id, fields: { display } },
    plan
  );

  return {
    id: raw.id,
    display,
    sort_key: canonical_key,
    sort_tie: tie_break
  };
}
```

### Querying with Sort Keys

```typescript
// When retrieving records, sort by (sort_key, sort_tie):
const records = await db.query(
  `SELECT * FROM my_table ORDER BY sort_key ASC, sort_tie ASC`
);
// Result is deterministically ordered ✓
```

## 4. Agent Calls → Format Tool Invocation

When an agent needs to normalize text *during* a task:

```typescript
// Agent handler receives a request like:
{
  "messages": [
    {
      "role": "user",
      "content": "Normalize this citation: James Hunt   and    David Thomas..."
    }
  ]
}

// Agent can call:
{
  "kind": "tool.call",
  "name": "engine.format.govern_text",
  "args": {
    "text": "James Hunt   and    David Thomas..."
  }
}

// Response:
{
  "text": "James Hunt and David Thomas."
}
```

## 5. Bibliography Formatting in Views

If you're rendering citations or bibliography lists:

```typescript
import { formatBibEntry, getLocale } from "@world-engine/engine";
import type { BibEntry } from "@world-engine/engine";

function BibliographyList({ entries }: { entries: BibEntry[] }) {
  const loc = getLocale("en-US");
  const gov = new PunctuationGovernor({ locale: "en-US" });
  const rules = { maxAuthors: 3, etAlPosition: 1 };

  return (
    <div>
      {entries.map((entry) => (
        <p key={entry.id}>
          {formatBibEntry(entry, loc, rules, gov)}
        </p>
      ))}
    </div>
  );
}
```

## 6. Example: Memory Node with Sort Key

Here's a complete example for a memory node that uses the formatter:

```typescript
import { PunctuationGovernor, buildSortKey } from "@world-engine/engine";

interface MemoryNode {
  id: string;
  label: string;         // raw user input
  label_governed: string; // clean display
  sort_key: string;
  sort_tie: string;
  content: string;
  created_at: string;
}

async function createMemoryNode(input: {
  id: string;
  label: string;
  content: string;
}): Promise<MemoryNode> {
  const gov = new PunctuationGovernor({ locale: "en-US" });
  const label_governed = gov.govern(input.label);

  const { canonical_key, tie_break } = buildSortKey(
    {
      id: input.id,
      fields: { label: label_governed, content: input.content.slice(0, 100) }
    },
    { fieldOrder: ["label", "content"], includeYear: false }
  );

  return {
    id: input.id,
    label: input.label,
    label_governed,
    sort_key: canonical_key,
    sort_tie: tie_break,
    content: input.content,
    created_at: new Date().toISOString()
  };
}

// Usage:
const node = await createMemoryNode({
  id: "mem_001",
  label: "   Important   Finding  about deterministic systems",
  content: "..."
});

console.log(node.label_governed);
// → "Important Finding about deterministic systems."
```

## 7. Tool Pipeline Example

Use case: **Agent drafts a bibliography entry, we format it, compute sort key, then save.**

```typescript
// Agent response contains a bibliography entry:
const agentOutput = {
  sourceType: "Book",
  title: "Designing Data-Intensive Applications",
  contributors: {
    Author: {
      people: [{ last: "Kleppmann", first: "Martin" }]
    }
  },
  publisher: "O'Reilly Media",
  year: 2017
};

// Step 1: Call formatting tool (via tool_call)
const formattedText = await callTool("engine.bib.format", {
  entries: [{ id: "db_001", ...agentOutput }],
  options: { maxAuthors: 5, etAlPosition: 5 }
});
// → { lines: [...], ordered_ids: [...] }

// Step 2: Save to database with sort key
const savedRecord = {
  ...agentOutput,
  display: formattedText.lines[0].text,
  sort_key: formattedText.lines[0].sort_key,
  sort_tie: formattedText.lines[0].tie_break
};

await db.insert("bibliography", savedRecord);
```

## 8. Testing Your Integration

### Unit test: Governor + Sort Key

```typescript
import test from "node:test";
import assert from "node:assert";
import { PunctuationGovernor, buildSortKey } from "@world-engine/engine";

test("integration: govern + sort", () => {
  const gov = new PunctuationGovernor({ locale: "en-US" });
  const text = "  hello  , world  ";
  const governed = gov.govern(text);
  assert.equal(governed, "hello, world.");

  const { canonical_key } = buildSortKey(
    { id: "x", fields: { text: governed } },
    { fieldOrder: ["text"], includeYear: false }
  );
  assert.equal(canonical_key, "hello world");
});
```

### Integration test: Agent → Formatter Tool → DB

```typescript
test("integration: agent formats and saves", async () => {
  const handler = toolHandlers["engine.format.govern_text"];
  const result = handler({ text: "  messy  input  " });

  assert.deepEqual(result, { text: "messy input." });
});
```

## 9. Deployment Checklist

- [ ] Update `packages/engine/package.json` to ensure TypeScript is dev dependency
- [ ] Run `pnpm build` in `packages/engine` to compile formatting module
- [ ] In Nucleus (`apps/nucleus`), import and register `createEngineFormattingTools()`
- [ ] Update your record schema to include `sort_key` and `sort_tie` fields
- [ ] Add migration: backfill existing records with sort keys
- [ ] Update queries to order by `(sort_key, sort_tie)`
- [ ] Add tests for governor + sort key round-trip
- [ ] Document in your API docs which tools are available

## 10. Troubleshooting

### "Module not found: @world-engine/engine"

```bash
# Make sure formatting is exported
cd packages/engine
pnpm build

# Check export:
cat src/index.ts | grep "formatting"
# Should see: export * from "./formatting/index.js";
```

### Tool not in router

```typescript
// Debug: check if tool is registered
console.log(Object.keys(toolHandlers).filter(k => k.includes("format")));
// Should see:
// - engine.format.govern_text
// - engine.sort.build_key
// - engine.sort.sort_entries
// - engine.bib.format
```

### Sort keys differ between runs

If sort keys are changing, check:

1. **Same plan?** Field order and includeYear must match
2. **Same locale?** Different locales → different normalization
3. **Async time?** (should be none, but verify no Date.now() in canon logic)

```typescript
// This should be true:
const k1 = buildSortKey(entry, plan);
const k2 = buildSortKey(entry, plan);
assert.equal(k1.canonical_key, k2.canonical_key); // must pass
```

---

## Summary

You now have:

1. ✅ **Contract-first** formatting kernel in `packages/engine`
2. ✅ **Nucleus-compatible** tool handlers (4 tools available)
3. ✅ **Deterministic** output (reproducible sort keys + normalized text)
4. ✅ **Extensible** (add locales, bibliography types, rules easily)

**Next**: Wire it into your specific use cases (memory nodes, citations, artifacts, etc.)

**Questions?** See [packages/engine/src/formatting/README.md](./README.md)
