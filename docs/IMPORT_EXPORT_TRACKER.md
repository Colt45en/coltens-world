# Import/Export Tracker: Dependency Graph Builder

## Overview

The **import-export-tracker** is a lazy-incremental dependency graph builder for the World Engine monorepo. It:

- **Parses all TS/JS/TSX/JSX files** using the TypeScript compiler API
- **Builds a dependency graph** (who imports from whom)
- **Records per-file exports** (named, default, re-exports)
- **Watches for changes** and updates incrementally in real-time
- **Outputs machine-readable data** for analysis, visualization, and auditing

### Output Artifacts

Generated in `.audit/import-export/`:

- **`index.json`** — Complete dependency graph, per-file imports/exports, reverse index
- **`cache.json`** — Content hashes for lazy updates (only re-parse changed files)
- **`graph.dot`** — Graphviz format (optional, visualize with Graphviz tools)

## Quick Start

### One-time audit

```bash
pnpm audit:imports
```

### Continuous watch mode

```bash
pnpm audit:imports:watch
```

Leave this running in a terminal tab while developing. Graph updates automatically as you edit files.

### VS Code integration

**Command Palette** → **Run Task** → Select:

- `Audit: Imports/Exports (once)` — Single run
- `Audit: Imports/Exports (watch)` — Leave running in background

## Example Output

### `index.json` Structure

```json
{
  "meta": {
    "generatedAt": "2026-02-10T15:30:45.123Z",
    "root": "/path/to/repo",
    "fileCount": 127,
    "edgeCount": 342,
    "unresolvedCount": 8
  },
  "files": {
    "packages/engine/src/index.ts": {
      "imports": [
        { "spec": "zod", "kind": "import", "names": ["z"], "typeOnly": false },
        {
          "spec": "./contracts/protocol/index.js",
          "kind": "import",
          "names": ["..."],
          "typeOnly": false
        }
      ],
      "exports": [
        { "kind": "exportNamed", "names": ["ECSEngine", "System", "Entity"] },
        { "kind": "exportDefault", "default": true }
      ],
      "reexports": [{ "spec": "./collision.js", "kind": "exportAll", "names": null }],
      "hash": "a1b2c3d4e5f6..."
    }
  },
  "edges": [
    {
      "from": "packages/engine/src/index.ts",
      "to": "packages/engine/src/contracts/protocol/index.ts",
      "spec": "./contracts/protocol/index.js",
      "kind": "import",
      "reexport": false
    }
  ],
  "importers": {
    "packages/engine/src/collision.ts": [
      {
        "from": "packages/engine/src/prediction.ts",
        "spec": "./collision",
        "kind": "import",
        "reexport": false
      }
    ]
  },
  "unresolved": [
    {
      "from": "apps/nucleus/src/services/simRunner.ts",
      "spec": "@prisma/client",
      "kind": "import"
    }
  ]
}
```

## Analyzing the Data

### Find all importers of a file

```javascript
const index = require("./.audit/import-export/index.json");
const file = "packages/engine/src/collision.ts";
console.log("Files importing from", file, ":");
console.log(index.importers[file]);
```

### Export inventory per package

```javascript
const fs = require("fs");
const index = require("./.audit/import-export/index.json");

const byPackage = {};
for (const [file, record] of Object.entries(index.files)) {
  const pkg = file.split("/")[1]; // packages/foo/src/...
  if (!byPackage[pkg]) byPackage[pkg] = [];

  // Collect all exports from this package
  for (const exp of record.exports) {
    if (exp.names) byPackage[pkg].push(...exp.names);
  }
}

console.log(JSON.stringify(byPackage, null, 2));
```

### Detect cycles (future)

```javascript
// Graph has edges; can run DFS to find cycles
// e.g., A → B → C → A
const edges = index.edges;
// Implement cycle detection here
```

### Cross-package imports

```javascript
// Find edges that cross workspace boundaries
const crossPkg = index.edges.filter((e) => {
  const fromPkg = e.from.split("/")[1];
  const toPkg = e.to.split("/")[1];
  return fromPkg !== toPkg && fromPkg !== "tools";
});
console.log("Cross-package imports:", crossPkg.length);
```

## CLI Options

```bash
node scripts/import-export-tracker.mjs [options]
```

| Option      | Default   | Purpose                           |
| ----------- | --------- | --------------------------------- |
| `--root`    | `.` (cwd) | Repo root (where to scan)         |
| `--write`   | false     | Write output files (else dry-run) |
| `--watch`   | false     | Watch mode (continuous update)    |
| `--verbose` | false     | Log parsed/skipped counts         |
| `--dot`     | false     | Generate Graphviz DOT file        |

### Examples

```bash
# One-time scan, write outputs, show graph.dot
pnpm audit:imports

# Watch mode with verbose logging
node scripts/import-export-tracker.mjs --root . --write --dot --watch --verbose

# Dry-run (no output files written)
node scripts/import-export-tracker.mjs --root . --verbose
```

## How It Works

### Parse Phase

1. Scan all `**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}` files
2. Ignore patterns: `node_modules`, `dist`, `build`, `.next`, `.turbo`, `.git`, `coverage`
3. Use TypeScript compiler AST to extract:
   - Import statements (`import { x } from "y"`)
   - Dynamic imports (`import("y")`)
   - Exports (`export const`, `export class`, `export default`)
   - Re-exports (`export * from`, `export { x } from`)
4. Build SHA1 hash of each file for caching

### Resolution Phase

1. For each import, resolve the target:
   - **Relative imports** (`./`, `../`) → try 8 file extension candidates + `index.*`
   - **Bare modules** (`zod`, `react`) → check `tsconfig.json` paths
   - **Path aliases** (`@we/engine`) → resolve via `tsconfig.json`
2. Record resolved edges (monorepo dependencies only; external modules skipped)
3. Build reverse index: "who imports this file?"

### Caching Phase

1. Store file hash in `cache.json`
2. On next run:
   - Re-parse only changed files
   - Re-build edges only for affected files
   - Very fast on large repos (often < 100ms incremental update)

### Watch Phase

1. Chokidar monitors file changes
2. On `add`, `change`, `unlink`:
   - Parse the changed file
   - Rebuild just that file's edges
   - Update reverse index
   - Write new `index.json`, `cache.json`, optionally `graph.dot`
3. Continues until interrupted (Ctrl+C)

## Integration with Nucleus Executor

If your engine executor (FileOps) modifies TS/JS files, you can hook the audit:

**apps/nucleus/src/services/executor.ts**

```typescript
import { spawn } from "child_process";
import path from "path";

export async function runAuditAfterOps(touchedFiles: string[]) {
  // Check if any files are TS/JS
  const hasCode = touchedFiles.some((f) => /\.(ts|tsx|js|jsx|mts|cts|mjs|cjs)$/.test(f));

  if (!hasCode) return; // Skip if no code files touched

  // Run import tracker (lazy incremental)
  return new Promise((resolve) => {
    const proc = spawn("pnpm", ["audit:imports"], { cwd: process.cwd() });
    proc.on("exit", () => resolve(undefined));
  });
}

// After your file operation ops run:
// const result = await executor.run(ops);
// await runAuditAfterOps(result.modifiedFiles);
```

## Visualization (Graphviz)

With `--dot` flag, generates `graph.dot` compatible with Graphviz:

```bash
# Generate PNG visualization
pnpm audit:imports
dot -Tpng .audit/import-export/graph.dot -o .audit/import-export/graph.png

# View PDF
dot -Tpdf .audit/import-export/graph.dot -o .audit/import-export/graph.pdf
```

For large graphs, filter to a single package:

```bash
# Just packages/engine
grep 'packages/engine' .audit/import-export/graph.dot > /tmp/engine.dot
dot -Tpng /tmp/engine.dot -o /tmp/engine.png
```

## Performance

| Repo Size              | First Run  | Incremental (watch) |
| ---------------------- | ---------- | ------------------- |
| Small (< 50 files)     | ~50ms      | ~5ms                |
| Medium (100–500 files) | ~100–200ms | ~10–30ms            |
| Large (1000+ files)    | ~500ms–1s  | ~50–100ms           |

**Note:** First run scans everything. Watch mode updates only changed file's edges, so updates are typically **100x faster** than initial scan.

## Troubleshooting

### Graph is empty

**Issue:** `.audit/import-export/index.json` has `fileCount: 0`

**Causes:**

- No TS/JS files in repo (check globs)
- All files matched by ignore patterns
- Permissions issue reading files

**Fix:**

```bash
pnpm audit:imports --verbose
# Shows parsed/skipped counts
```

### Unresolved imports are high

**Issue:** `.audit/import-export/index.json` has `unresolvedCount > 10`

**Causes:**

- Bare modules without `tsconfig.json` paths
- External packages (expected)
- Missing files in monorepo

**Analyze:**

```bash
node -e "
  const i = require('./.audit/import-export/index.json');
  console.log('Unresolved imports:');
  i.unresolved.forEach(u => console.log(\`  \${u.from} → \${u.spec}\`));
"
```

### Watch mode stops responding

**Issue:** `--watch` appears frozen

**Fix:**

- Press Ctrl+C to exit
- Restart: `pnpm audit:imports:watch`
- Check terminal for error messages

## Future Enhancements

### Cycle Detection

```bash
pnpm audit:imports --detect-cycles
# Output: .audit/cycles.json
```

### Rule Enforcement

```yaml
# .audit/rules.yaml
rules:
  - name: "no-cross-app"
    pattern: "apps/*/src"
    forbid: "apps/*/src" # no imports between apps

  - name: "protocol-only"
    pattern: "apps/nucleus/src"
    allow: ["packages/protocol", "packages/engine", "@prisma/client"]
```

### Per-Package Graphs

Split large graphs by workspace package:

```bash
pnpm audit:imports --split-by-package
# Output: .audit/import-export/packages/engine.json
#         .audit/import-export/apps/nucleus.json
```

## Files Reference

| File                                | Purpose                            |
| ----------------------------------- | ---------------------------------- |
| `scripts/import-export-tracker.mjs` | Main tracker script                |
| `.vscode/tasks.json`                | VS Code task integration           |
| `package.json`                      | `audit:imports` scripts            |
| `.audit/import-export/index.json`   | Output graph data                  |
| `.audit/import-export/cache.json`   | File hashes for incremental builds |
| `.audit/import-export/graph.dot`    | Graphviz format (optional)         |

## See Also

- [TypeScript Compiler API](https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API)
- [Chokidar](https://github.com/paulmillr/chokidar) — file watcher
- [Fast-Glob](https://github.com/mrmlnc/fast-glob) — file globbing
- [Graphviz](https://graphviz.org/) — graph visualization
