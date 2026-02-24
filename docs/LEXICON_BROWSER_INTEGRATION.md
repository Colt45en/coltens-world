# Lexicon Browser UI Integration Guide

## Overview

The **LexiconBrowser** is a React component that displays your lexicon index with interactive filtering and search. It lets developers:

- Search by term, canonical term, or process tag
- Filter by operator class and entry type
- Browse all lexicon entries with metadata
- Understand which operators are available

## Installation

### Step 1: Ensure dependencies

```bash
cd apps/ide-web
# React should already be installed
```

### Step 2: Make sure lexicon index exists

```bash
pnpm run lexicon:index
# Creates: docs/lexicon/lexicon.index.json
```

### Step 3: Import and wire into IDE

```tsx
// apps/ide-web/src/ui/panels/LexiconBrowserPanel.tsx
import { LexiconBrowser } from "@world-engine/brain/ui";
import fs from "fs";
import path from "path";

export const IdeLexiconBrowserPanel: React.FC = () => {
  const onLoadIndex = async (filePath: string) => {
    const abs = path.resolve(filePath);
    if (!fs.existsSync(abs)) {
      throw new Error(`Index not found: ${abs}`);
    }
    const raw = fs.readFileSync(abs, "utf8");
    return JSON.parse(raw);
  };

  return (
    <LexiconBrowser indexFilePath="docs/lexicon/lexicon.index.json" onLoadIndex={onLoadIndex} />
  );
};
```

### Step 4: Add to IDE layout

```tsx
// apps/ide-web/src/App.tsx
import { IdeLexiconBrowserPanel } from "./ui/panels/LexiconBrowserPanel";

export function App() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
      {/* Existing panels */}
      <div>
        <IdeLexiconBrowserPanel />
      </div>
    </div>
  );
}
```

## Usage

### Search

Type to search across:

- **Term**: exact match or substring
  e.g., "reason" → finds "reasoning operator"
- **Canonical Term**: alternate names
  e.g., "prompt" → finds "ai_prompt_lexicon"
- **Process Tag**: system identifiers
  e.g., "prompt.operator.decision" → exact tag match

### Filter by Operator Class

Dropdown groups entries by their operator class:

- `prompt.primitive` — base operators
- `prompt.operator` — complex reasoning operators
- `engine` — runtime/execution operators
- etc.

### Filter by Type

Shows entry type (usually `action_operator`):

- Select a type to focus on that category
- Most entries are `action_operator`

### Results Table

| Column             | Content                              |
| ------------------ | ------------------------------------ |
| **Term**           | Human-readable name + canonical term |
| **Process Tag**    | System identifier (copy-paste ready) |
| **Type**           | Entry classification                 |
| **Operator Class** | Category/grouping                    |
| **File**           | Source filename                      |

Click a row to view the full entry in your editor:

```tsx
// Add row click handler
onClick={() => {
  const filePath = path.join("docs/lexicon/entries", entry.file);
  vscode.commands.executeCommand("vscode.open", filePath);
}}
```

## Examples

### Find all decision operators

1. Set **Operator Class** → `prompt.operator`
2. Search **"decision"**
3. Results show all decision-related operators

### List all available operators

1. Leave search empty
2. Set **Filter by Type** → `action_operator`
3. Browse all entries

### Locate a specific operator by tag

1. Search box: type `prompt.operator.reasoning`
2. Results pinpoint the exact entry

### Export as JSON

```tsx
// Add export button
const exportEntries = () => {
  const json = JSON.stringify(lexiconHook.index, null, 2);
  downloadFile(json, "lexicon-export.json");
};
```

## Data Structure

The component displays entries from your `LexiconIndex`:

```typescript
{
  schema: { name: "ai_prompt_lexicon.index", version: "1.0.0" },
  generatedAt: "2026-02-12T15:30:00.000Z",
  rootDir: "docs/lexicon/entries",
  entries: [
    {
      process_tag: "prompt.primitive.concept",
      term: "Concept",
      canonical_term: "concept_extraction",
      type: "action_operator",
      operator_class: "prompt.primitive",
      file: "concept.lexicon.json"
    },
    ...
  ]
}
```

## Performance

- Index loads in <100ms
- Filtering is instant (client-side)
- Tables handle 1000+ entries smoothly

## Integration with MemoryPanel

Use LexiconBrowser + MemoryPanel together:

```tsx
// apps/ide-web/src/App.tsx
export function App() {
  const [activePanel, setActivePanel] = useState<"memory" | "lexicon">("memory");

  return (
    <div>
      <button onClick={() => setActivePanel("memory")}>Memory</button>
      <button onClick={() => setActivePanel("lexicon")}>Lexicon</button>

      {activePanel === "memory" && <IdeMemoryPanel />}
      {activePanel === "lexicon" && <IdeLexiconBrowserPanel />}
    </div>
  );
}
```

## Customization

### Custom header

```tsx
<LexiconBrowser indexFilePath="docs/lexicon/lexicon.index.json" onLoadIndex={onLoadIndex}>
  <h1 style={{ color: "#0066cc" }}>Operator Reference</h1>
</LexiconBrowser>
```

### Custom column render

```tsx
// Add custom cell formatter
const renderProcessTag = (tag: string) => {
  return (
    <code
      style={{
        background: "#fff3cd",
        padding: "2px 4px",
        borderRadius: "2px",
        cursor: "pointer",
      }}
      onClick={() => copyToClipboard(tag)}
      title="Click to copy"
    >
      {tag}
    </code>
  );
};
```

### Dark mode

```tsx
<LexiconBrowser
  style={{
    background: "#1e1e1e",
    color: "#e0e0e0",
  }}
/>
```

## TypeScript

```typescript
import { LexiconBrowser } from "@world-engine/brain/ui";
import type { LexiconIndex } from "@world-engine/brain/lexicon";

const Component: React.FC = () => {
  const onLoadIndex: (path: string) => Promise<LexiconIndex> = async (path) => {
    // return index
  };

  return <LexiconBrowser onLoadIndex={onLoadIndex} />;
};
```

## Troubleshooting

**"Index not found"**
Make sure to run `pnpm run lexicon:index` first.

**"Blank results"**
Check that `docs/lexicon/entries/*.lexicon.json` files exist and are valid Zod schemas.

**"Slow search"**
Turn off browser extensions. Client-side searching is instant; slowness usually means DevTools is heavy.

## Next Steps

- [ ] Add "jump to source" (opens lexicon.json in editor)
- [ ] Add "see concept chains" (link to Memory Chain CLI results)
- [ ] Add "usage stats" (how many times each operator was used)
- [ ] Add operator dependency graph (show which operators depend on which)
