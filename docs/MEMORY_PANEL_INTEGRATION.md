# IDE Memory Panel Integration Guide

## Overview

The `MemoryPanel` is a React component that displays memory analytics from your knowledge artifact NDJSON file. It shows:

- **Stats tab:** Timeline, top operators, top concepts (using Recharts)
- **Query tab:** Full-text search + filtering by operator/concept

## Installation

### Step 1: Add dependencies to IDE web app

```bash
cd apps/ide-web
pnpm add recharts@latest
pnpm add -D @types/react
```

### Step 2: Import and wire into IDE

```tsx
// apps/ide-web/src/ui/panels/MemoryPanel.tsx (or similar location)
import { MemoryPanel } from "@world-engine/brain/ui";
import { execSync } from "child_process";

export const IdeMemoryPanel: React.FC = () => {
  const onInvokeMemoryStatsCli = async (opts) => {
    const cmd = `pnpm run memory:stats -- --file .brain/memory/knowledge.ndjson --json`;
    if (opts.since) cmd += ` --since ${opts.since}`;
    if (opts.until) cmd += ` --until ${opts.until}`;
    if (opts.top) cmd += ` --top ${opts.top}`;

    const output = execSync(cmd, { encoding: "utf8" });
    return JSON.parse(output);
  };

  const onInvokeMemoryQueryCli = async (opts) => {
    let cmd = `pnpm run memory:query -- --file .brain/memory/knowledge.ndjson --json`;
    if (opts.contains) cmd += ` --contains "${opts.contains}"`;
    if (opts.operator) cmd += ` --operator ${opts.operator}`;
    if (opts.concept) cmd += ` --concept "${opts.concept}"`;
    if (opts.since) cmd += ` --since ${opts.since}`;
    if (opts.until) cmd += ` --until ${opts.until}`;
    if (opts.limit) cmd += ` --limit ${opts.limit}`;

    const output = execSync(cmd, { encoding: "utf8" });
    return JSON.parse(output);
  };

  return (
    <MemoryPanel
      memoryFilePath=".brain/memory/knowledge.ndjson"
      onInvokeMemoryStatsCli={onInvokeMemoryStatsCli}
      onInvokeMemoryQueryCli={onInvokeMemoryQueryCli}
    />
  );
};
```

### Step 3: Add to IDE layout

```tsx
// apps/ide-web/src/App.tsx
import { IdeMemoryPanel } from "./ui/panels/MemoryPanel";

export function App() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
      {/* Existing panels */}
      <div style={{ gridColumn: 2 }}>
        <IdeMemoryPanel />
      </div>
    </div>
  );
}
```

### Step 4: Add to VS Code sidebar (optional)

In `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Memory Panel",
      "type": "chrome",
      "request": "attach",
      "port": 9222,
      "webRoot": "${workspaceFolder}/apps/ide-web",
      "preLaunchTask": "pnpm:dev:all"
    }
  ]
}
```

## Usage

### Stats Tab

1. Set date range (optional)
2. Adjust "Top N" slider for top K results
3. View:
   - **Timeline:** Artifacts per day
   - **Top Operators:** Most-used reasoning operators
   - **Top Concepts:** Most-mentioned concepts

### Query Tab

1. Enter search text (full-text in goal/summary/facts)
2. (Optional) Filter by operator tag
3. Click **Search**
4. View results in table
5. Click row to expand artifact details

## Data Flow

```
MemoryPanel (React)
├── useMemoryStats hook
│   └── calls onInvokeMemoryStatsCli
│       └── execSync("pnpm run memory:stats -- --json")
│           └── CLI reads .brain/memory/knowledge.ndjson
│               └── Parses, counts, returns stats JSON
│                   └── Recharts visualizes
│
├── useMemoryQuery hook
│   └── calls onInvokeMemoryQueryCli
│       └── execSync("pnpm run memory:query -- --json")
│           └── CLI reads .brain/memory/knowledge.ndjson
│               └── Filters by criteria
│                   └── Returns matching artifacts
│                       └── Table displays results
```

## Environment Setup

Ensure `.brain/memory/` directory exists:

```bash
mkdir -p .brain/memory
```

And your chat handler persists artifacts:

```typescript
import { appendArtifactNdjson } from "@world-engine/brain/memory";

export async function handleChat(userMessage: string) {
  const { finalAnswer, artifact } = runThoughtPipeline(userMessage);
  appendArtifactNdjson(".brain/memory/knowledge.ndjson", artifact);
  return finalAnswer;
}
```

## Styling

The component uses **inline styles** for portability. To customize:

```tsx
<MemoryPanel
  memoryFilePath=".brain/memory/knowledge.ndjson"
  onInvokeMemoryStatsCli={...}
  onInvokeMemoryQueryCli={...}
  style={{ fontFamily: "Courier New" }} // custom styles
/>
```

## Performance Notes

- For 10k+ artifacts, consider server-side pagination
- CLI runs synchronously; consider worker threads for large datasets
- Recharts re-renders on every stats fetch; memoize if needed

## Next Steps

- [ ] Add real-time updates via WebSocket
- [ ] Export results as CSV
- [ ] Add anomaly detection (spike in artifacts)
- [ ] Drill-down: click concept → show all related artifacts
