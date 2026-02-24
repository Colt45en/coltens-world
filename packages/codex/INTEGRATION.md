# System Codex Integration Guide

This guide helps you integrate the hardened System Codex schema into your applications.

## Quick Start

### 1. Install & Depend

The `@we/codex` package is part of the workspace. Add to your app's `package.json`:

```json
{
  "dependencies": {
    "@we/codex": "0.0.1"
  }
}
```

### 2. Parse a Codex

```typescript
import { parseSystemCodexEntry } from "@we/codex";

const json = JSON.parse(fs.readFileSync("my-system.codex.json", "utf8"));
const codex = parseSystemCodexEntry(json); // Throws on validation error

console.log(codex.id, codex.agents.length);
```

### 3. Compute Hash & Canonical JSON

```typescript
import { snapshotSystemCodexEntry } from "@we/codex";

const snapshot = await snapshotSystemCodexEntry(codex);

console.log(snapshot.sha256); // Deterministic hash
console.log(snapshot.canonical_json); // Stable serialization
```

## Architecture Patterns

### Codex Registry (Load Multiple Files)

```typescript
import fs from "fs";
import path from "path";
import { parseSystemCodexEntry } from "@we/codex";

async function loadCodexRegistry(dir: string) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".codex.json"));
  const registry: Record<string, SystemCodexEntry> = {};

  for (const file of files) {
    try {
      const json = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
      registry[file.replace(".codex.json", "")] = parseSystemCodexEntry(json);
    } catch (err) {
      console.error(`Failed to load ${file}: ${err.message}`);
    }
  }

  return registry;
}
```

### Manifest Generation (For Audit Trails)

```typescript
import { snapshotSystemCodexEntry } from "@we/codex";

async function generateManifest(codex: SystemCodexEntry) {
  const snapshot = await snapshotSystemCodexEntry(codex);

  return {
    id: codex.id,
    name: codex.name,
    version: codex.schema_version,
    timestamp_utc: new Date().toISOString(),
    sha256: snapshot.sha256,
    stats: {
      agents: codex.agents.length,
      tools: codex.tools.length,
      signals: codex.signals.length,
      data_sources: codex.data_sources.length,
      loops: codex.loops.length,
    },
  };
}
```

### CI/CD: Validate No Drift

```typescript
// ci/validate-codex-hash.ts
import { snapshotSystemCodexEntry } from "@we/codex";

const prevHash = JSON.parse(process.env.PREV_CODEX_HASH);
const currentCodex = parseSystemCodexEntry(
  JSON.parse(fs.readFileSync("systems/main.codex.json", "utf8")),
);

const currentSnapshot = await snapshotSystemCodexEntry(currentCodex);

if (currentSnapshot.sha256 !== prevHash) {
  console.error("❌ Codex has changed without version bump");
  process.exit(1);
}
```

### Orchestration Integration

Use codex data to dynamically configure your orchestration layer:

```typescript
import { parseSystemCodexEntry } from "@we/codex";

const codex = parseSystemCodexEntry(configJson);

// Build agent router
const orchestrator = new Orchestrator({
  agents: codex.agents.map((a) => ({
    id: a.id,
    name: a.name,
    execute: getAgentExecutor(a.id),
    allowed_tools: a.tools_allowed,
  })),
  routing: codex.orchestration.routing,
  voting: codex.orchestration.voting,
  resilience: codex.orchestration.resilience,
});
```

## Type Safety

All TypeScript types are derived from Zod schemas:

```typescript
import type { SystemCodexEntry, AgentRoleSchema, ToolSchema } from "@we/codex";

function processAgent(agent: z.infer<typeof AgentRoleSchema>) {
  // ✅ agent.tools_allowed is typed as string[]
  // ✅ agent.spatial?.connections is typed as string[] | undefined
}

function analyzeSystem(codex: SystemCodexEntry) {
  // ✅ codex.agents is AgentRole[]
  // ✅ codex.tools is Tool[]
  // ✅ Full type hierarchy available
}
```

## Validation Patterns

### Custom Refinements

If you need to add your own validation rules post-parsing:

```typescript
import { parseSystemCodexEntry } from "@we/codex";

function validateAllAgentsHaveTools(codex: SystemCodexEntry) {
  const agents_without_tools = codex.agents.filter((a) => a.tools_allowed.length === 0);
  if (agents_without_tools.length > 0) {
    throw new Error(`Agents without tools: ${agents_without_tools.map((a) => a.id).join(", ")}`);
  }
}

const codex = parseSystemCodexEntry(json);
validateAllAgentsHaveTools(codex);
```

### Safe Parsing (Non-Throwing)

```typescript
import { SystemCodexEntrySchema } from "@we/codex";

const result = SystemCodexEntrySchema.safeParse(json);

if (!result.success) {
  console.error("Validation errors:");
  result.error.errors.forEach((e) => {
    console.error(`  ${e.path.join(".")}: ${e.message}`);
  });
} else {
  const codex = result.data; // Type-safe
}
```

## Performance Considerations

| Operation        | Time                        | Notes                          |
| ---------------- | --------------------------- | ------------------------------ |
| Parse (validate) | <1ms                        | Single pass, no tree traversal |
| Canonicalize     | <0.5ms                      | Pure JS sorting, no I/O        |
| SHA256 hash      | ~2ms (Node), ~5ms (browser) | Optional, can batch            |
| Full snapshot    | <10ms                       | All three operations           |

For large registries (100+ codexes):

- Parse & validate in parallel (per file)
- Batch hash computation (can do 10/sec)
- Cache canonical JSON if queried frequently

## Deployment Checklist

- [ ] Add `@we/codex` to app `package.json`
- [ ] Load codex on startup, fail if invalid
- [ ] Export manifest on deployment (timestamp, hash, stats)
- [ ] Store hash in version control (for drift detection)
- [ ] Add CI gate to reject unsigned changes
- [ ] Document custom extensions/overrides
- [ ] Set up schema versioning (when schema_version changes, plan migration)

## Next Steps

1. **Codex CLI** — Commands for `validate`, `diff`, `export`, `sign`
2. **Codex Rules Engine** — Governance: "no critical tools in agent_1", "max 5 agents"
3. **Codex Replay Log** — Store snapshots on every change
4. **Codex Dashboard** — Visualize agents, tools, signals, orchestration
5. **Codex Versioning** — Auto-migrate old schema_versions

---

**Questions?** See `packages/codex/README.md` for full API docs and schema reference.
