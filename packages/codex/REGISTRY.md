# CodexRegistry — Runtime Usage Guide

**CodexRegistry** operationalizes the System Codex schema at runtime. It discovers, validates, canonicalizes, hashes, and lets you query codex files with full event notification and hot-reload support.

## Quick Start

### 1. Basic Load (One-Time)

```typescript
import { CodexRegistry } from "@we/codex";

const registry = new CodexRegistry({
  rootDir: "codex",
  manifestPath: "codex.manifest.json",
});

const result = await registry.load("boot");

if (!result.ok) {
  console.error("Codex validation issues:", result.issues);
  process.exit(1);
}

console.log(`✅ Loaded ${result.countLoaded} codex entries`);
const swarm = registry.getOrThrow("swarm.core");
```

### 2. With Event Bus (Recommended)

```typescript
import { CodexRegistry } from "@we/codex";

const registry = new CodexRegistry({
  rootDir: "codex",
  manifestPath: "codex.manifest.json",
  strictReady: true, // Block READY if any issues
});

// Listen for readiness
registry.events.on("CODEX_READY", ({ manifest }) => {
  console.log(`✅ Registry ready with ${manifest.count} codexes`);
});

registry.events.on("CODEX_INVALID", ({ issues }) => {
  console.error("❌ Validation issues:");
  for (const issue of issues) {
    console.error(`  ${issue.file}: ${issue.error}`);
  }
});

// Load once
await registry.load("boot");
```

### 3. With File Watching (Hot Reload)

```typescript
import { CodexRegistry } from "@we/codex";

const registry = new CodexRegistry({
  rootDir: "codex",
  manifestPath: "codex.manifest.json",
  watchDebounceMs: 200, // Debounce file changes (default: 150ms)
});

// Track file system events
registry.events.on("CODEX_FS_EVENT", ({ event, file }) => {
  console.log(`📝 Codex file ${event}: ${file}`);
});

registry.events.on("CODEX_LOAD_START", ({ reason }) => {
  if (reason === "fs_watch") console.log("🔄 Reloading from file change...");
});

// Initial load
await registry.load("boot");

// Start watching
await registry.watch();

// Cleanup when done
process.on("SIGINT", async () => {
  await registry.dispose();
  process.exit(0);
});
```

## Complete API

### Constructor

```typescript
new CodexRegistry(options, eventBus?)
```

**Options:**

| Option               | Type       | Default                                | Description                                                                 |
| -------------------- | ---------- | -------------------------------------- | --------------------------------------------------------------------------- |
| `rootDir`            | `string`   | (required)                             | Absolute or relative path to codex directory                                |
| `patterns`           | `string[]` | `["**/*.codex.json"]`                  | Glob patterns for file discovery                                            |
| `ignore`             | `string[]` | `["**/node_modules/**", "**/.git/**"]` | Glob patterns to exclude                                                    |
| `writeBackCanonical` | `boolean`  | `false`                                | Auto-format codex files to canonical JSON (⚠️ dangerous—write back to disk) |
| `manifestPath`       | `string`   | (optional)                             | Write deterministic manifest here after load                                |
| `strictReady`        | `boolean`  | `true`                                 | If `true`, only emit `CODEX_READY` when zero validation issues              |
| `watchDebounceMs`    | `number`   | `150`                                  | Milliseconds to debounce file watch before reload                           |

**Event Bus (optional):**

```typescript
const bus = new CodexEventBus();
const registry = new CodexRegistry(opts, bus); // Share bus across multiple registries
```

### Load

```typescript
await registry.load(reason?: "boot" | "manual" | "fs_watch")
```

Returns:

```typescript
{
  ok: boolean;                      // true if no validation issues
  issues: CodexLoadIssue[];         // Details on each failure
  countLoaded: number;              // # of valid codex files
  manifest: CodexManifest | null;   // Deterministic snapshot
}
```

**Events emitted:**

- `CODEX_LOAD_START({ reason })` — Load begins
- `CODEX_LOAD_RESULT({ result })` — Load completes (even with issues)
- `CODEX_READY({ manifest })` — Registry is healthy (only if `ok: true` or `strictReady: false`)
- `CODEX_INVALID({ issues })` — Validation issues found
- `CODEX_MANIFEST_UPDATED({ manifest })` — Manifest written to disk

### Watch

```typescript
await registry.watch();
```

Starts file watching. On `.codex.json` file changes, automatically reloads (debounced).

**Events emitted:**

- `CODEX_WATCH_STARTED({ rootDir })` — Watcher initialized
- `CODEX_FS_EVENT({ event, file })` — File change detected (~"add"|"change"|"unlink"~)
- `CODEX_LOAD_START({ reason: "fs_watch" })` — Reload triggered
- `CODEX_LOAD_RESULT(...)`, `CODEX_READY(...)`, `CODEX_INVALID(...)` — Load lifecycle

### Unwatch

```typescript
await registry.unwatch();
```

Stops file watching without clearing registry state.

**Events emitted:**

- `CODEX_WATCH_STOPPED({ rootDir })`

### Query Methods

```typescript
// O(1) lookups
registry.has(id: string): boolean
registry.get(id: string): SystemCodexEntry | undefined
registry.getOrThrow(id: string): SystemCodexEntry // throws if missing

// Collections
registry.listIds(): string[]                        // Sorted IDs
registry.list(): SystemCodexEntry[]                 // All entries (sorted)

// Cross-reference queries
registry.findByAgent(agentId: string): SystemCodexEntry[]
registry.findByTool(toolId: string): SystemCodexEntry[]
registry.findBySignal(signalId: string): SystemCodexEntry[]
registry.findByDataSource(sourceId: string): SystemCodexEntry[]
registry.findByModel(modelId: string): SystemCodexEntry[]
registry.findByLoop(loopId: string): SystemCodexEntry[]

// Provenance
registry.resolveFileForId(id: string): string | undefined  // Source file path
registry.getManifest(): CodexManifest | null               // Deterministic snapshot
```

### Dispose

```typescript
await registry.dispose();
```

Full cleanup: stops watch, clears all state. No further operations allowed.

## Events

### Event Types

```typescript
type CodexEventMap = {
  CODEX_LOAD_START: { reason: "boot" | "manual" | "fs_watch" };
  CODEX_LOAD_RESULT: { result: CodexLoadResult };
  CODEX_READY: { manifest: CodexManifest };
  CODEX_INVALID: { issues: CodexLoadIssue[] };
  CODEX_MANIFEST_UPDATED: { manifest: CodexManifest };
  CODEX_WATCH_STARTED: { rootDir: string };
  CODEX_WATCH_STOPPED: { rootDir: string };
  CODEX_FS_EVENT: { event: "add" | "change" | "unlink"; file: string };
};
```

### Event Bus API

```typescript
const unsub = registry.events.on("CODEX_READY", ({ manifest }) => {
  console.log(`Ready!`);
});

// Later
unsub(); // Unsubscribe

// Or manually
registry.events.off("CODEX_READY", listener);

// Clear all listeners
registry.events.clear();

// Query listener count (debugging)
registry.events.listenerCount("CODEX_READY");
```

## Integration Examples

### Nucleus (Node Server)

```typescript
// apps/nucleus/src/index.ts
import { CodexRegistry } from "@we/codex";

const registry = new CodexRegistry({
  rootDir: "codex",
  manifestPath: "codex.manifest.json",
  strictReady: true,
});

registry.events.on("CODEX_READY", ({ manifest }) => {
  console.log(`[Nucleus] Codex ready: ${manifest.count} systems`);
  // Can now safely query registry in handlers
});

registry.events.on("CODEX_INVALID", ({ issues }) => {
  console.error("[Nucleus] Codex validation failed:", issues);
  // Optionally halt server startup
});

await registry.load("boot");
await registry.watch();

export { registry };
```

Then use in handlers:

```typescript
// apps/nucleus/src/handlers.ts
import { registry } from "./index.ts";

export function getSystemInfo(systemId: string) {
  const system = registry.get(systemId);
  if (!system) return { error: `System ${systemId} not found` };
  return {
    name: system.name,
    agents: system.agents.map((a) => a.id),
    tools: system.tools.map((t) => t.id),
  };
}
```

### IDE Web (Vite)

```typescript
// apps/ide-web/src/main.ts
import { CodexRegistry } from "@we/codex";

const registry = new CodexRegistry({
  rootDir: "codex",
  manifestPath: "codex.manifest.json",
  watchDebounceMs: 300, // Slower debounce for network requests
});

registry.events.on("CODEX_READY", ({ manifest }) => {
  console.log(`[IDE] ${manifest.count} codexes loaded`);
  updateSystemsPanel(registry.list());
});

// Broadcast changes to WebSocket if connected
registry.events.on("CODEX_INVALID", ({ issues }) => {
  notifyUser(`System codex has ${issues.length} issues`, "warning");
});

await registry.load("boot");
```

### Bridging to Existing Bus

If you have an existing engine bus, bridge CodexRegistry:

```typescript
import { CodexRegistry, CodexEventBus } from "@we/codex";
import { engineBus } from "./engine-bus";

const codexBus = new CodexEventBus();

// Forward important events to engine bus
codexBus.on("CODEX_READY", ({ manifest }) => {
  engineBus.emit("SYSTEM_CONFIG_READY", { scope: "codex", count: manifest.count });
});

codexBus.on("CODEX_INVALID", ({ issues }) => {
  engineBus.emit("SYSTEM_CONFIG_ERROR", { scope: "codex", errors: issues });
});

const registry = new CodexRegistry(
  {
    rootDir: "codex",
    manifestPath: "codex.manifest.json",
    strictReady: true,
  },
  codexBus, // Pass shared bus
);

await registry.load("boot");
await registry.watch();
```

## CLI (Manifest Generation)

Generate or update manifests from the command line:

```bash
# Navigate to workspace root
cd .

# Generate manifest (default: codex/ → codex.manifest.json)
npx ts-node packages/codex/src/cli.ts

# Custom paths
npx ts-node packages/codex/src/cli.ts --rootDir ./systems --manifestPath ./manifests/systems.json

# Auto-format codex files to canonical JSON (⚠️ writes back to disk)
npx ts-node packages/codex/src/cli.ts --writeBackCanonical

# After build
node --enable-source-maps ./dist/packages/codex/src/cli.js --rootDir codex
```

## CI/CD Integration

### Setup Phase (setup.bat / setup.sh)

Add manifest generation to your setup pipeline:

```bash
# setup.sh
echo "📦 Generating Codex Manifest..."
npx ts-node packages/codex/src/cli.ts --rootDir codex --manifestPath codex/codex.manifest.json
if [ $? -ne 0 ]; then
  echo "❌ Codex validation failed"
  exit 1
fi
echo "✅ Codex manifest generated"
```

### Build Phase (GitHub Actions, CI)

```yaml
- name: Validate Codex
  run: |
    npx ts-node packages/codex/src/cli.ts --rootDir codex
    git diff --exit-code codex/ # Fail if any codex files changed
```

### Pre-Commit Hook

```bash
#!/bin/sh
# .git/hooks/pre-commit
npx ts-node packages/codex/src/cli.ts --rootDir codex --manifestPath codex.manifest.json
if ! git diff --exit-code codex/codex.manifest.json > /dev/null; then
  echo "❌ Codex manifest out of sync. Run: npx ts-node packages/codex/src/cli.ts"
  exit 1
fi
```

## Strict vs. Permissive Modes

### Strict Mode (Default: `strictReady: true`)

- `CODEX_READY` only emitted if `result.ok === true` (zero issues)
- Any invalid file blocks the "ready" signal
- Useful for: production, CI/CD gates, mission-critical systems

```typescript
const registry = new CodexRegistry({
  rootDir: "codex",
  strictReady: true, // DEFAULT
});
// CODEX_READY only if all files valid
// CODEX_INVALID still emitted even if some files are OK
```

### Permissive Mode (`strictReady: false`)

- `CODEX_READY` emitted even if some files have issues
- Still emits `CODEX_INVALID` to flag problems
- Useful for: development, gradual migration, partial deployments

```typescript
const registry = new CodexRegistry({
  rootDir: "codex",
  strictReady: false,
});
// CODEX_READY emitted regardless (developer can check issues)
```

## Performance & Limits

- **File discovery:** fast-glob on 10,000 files: ~50ms
- **Validation:** ~1ms per codex file (depends on size)
- **Watch debounce:** Default 150ms (editors write multiple times)
- **Memory:** ~50KB per codex file in registry

## Troubleshooting

### "Duplicate codex id found"

Error: Duplicate codex id "swarm.core" found.
First: codex/systems/swarm.codex.json
Second: codex/backup/swarm.codex.json

**Solution:** Remove duplicate file or rename one.

### "Content hash collision"

Error: Content hash collision: sha256 abc123... already used by id "swarm.v1",
cannot also assign to "swarm.v2".

**Solution:** Two codex files have identical content but different IDs. This is caught to prevent silent overwrites. Either fix the content diff or resolve ID conflict.

### Build Error: `chokidar not found`

Error: Cannot find module 'chokidar'

**Solution:** Run `npm install` to install dependencies (chokidar, fast-glob).

### Watch Not Triggering

- Verify `rootDir` path is correct (absolute or relative to `process.cwd()`)
- Check file patterns match (default: `**/*.codex.json`)
- Increase `watchDebounceMs` if editing too rapidly
- Check `ignore` patterns don't exclude your files

---

## Summary

| Feature    | Usage                                                    |
| ---------- | -------------------------------------------------------- |
| Load once  | `await registry.load("boot")`                            |
| Query      | `registry.getOrThrow("id")`, `registry.findByAgent(...)` |
| Hot reload | `await registry.watch()`                                 |
| Events     | `registry.events.on("CODEX_READY", ...)`                 |
| Manifest   | `registry.getManifest()` or written to disk              |
| Cleanup    | `await registry.dispose()`                               |
| CLI        | `npx ts-node packages/codex/src/cli.ts`                  |

**Next Steps:**

1. Integrate into Nucleus startup (boot load + watch)
2. Add IDE panel to show loaded codexes + validation status
3. Set up pre-commit hook to regenerate manifest
4. Add to CI/CD gate to block deployments on codex issues
