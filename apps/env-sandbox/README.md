# Env Sandbox — Contract-First Environment & Governance System

A TypeScript toolkit for deterministic, policy-enforced environment management with audit trails, snapshots, and a complete CLI for production orchestration.

## What It Does

This package provides **two independent but complementary systems**:

### Tier 1: EnvSandbox (Contract-First Governance)

- **Registry-based** environment keys with per-key metadata
- **Layer-based composition** (prime, subtle, material, data-plane)
- **Type checking** (string, number, boolean, json)
- **Policy enforcement** (allowlist gates, production locks, gating rules)
- **Append-only audit trail** (NDJSON queryable logs)
- **Profiles** (pre-defined environment snapshots)
- **CLI interface** with 14+ governance commands

### Tier 2: Sandbox (Deterministic Mutation Engine)

- **Recursive Creation Codex** bootstrap with philosophical framework
- **Immutable snapshots** + restore + diff
- **JSON path introspection** ($.a.b[0].c get/set)
- **Event bus** (MUTATION, SNAPSHOT, TICK, TOOL_RUN, ERROR)
- **Deterministic scheduler** (tick-based job queue)
- **Tool registry** + 5 built-in tools
- **Policy-enforced mutations** (mutation contracts)

Both systems can be used **standalone** or **together** via the CLI.

## Quick Start

```bash
# Install (monorepo context)
pnpm --filter env-sandbox install

# Initialize a new sandbox
node dist/index.js init

# Set typed environment variable
node dist/index.js set NODE_ENV production --layer material --actor "Colten"

# View current environment
node dist/index.js get --effective

# View audit trail
node dist/index.js history

# Snapshot state
node dist/index.js snapshot save "before-deploy"

# Run CosmosCodex demo (Tier 2)
pnpm --filter env-sandbox run demo
```

## Architecture

### Stores

- **`.sandbox/env.json`** — State + Codex (persisted after every mutation)
- **`.sandbox/audit.ndjson`** — Immutable event log (ISO timestamp + actor + reason)

### Layer Composition Order

```
prime (authoritative layer)
  ↓
subtle (philosophical override)
  ↓
material (runtime env vars)
  ↓
data-plane (persistent record)
  ↓
Effective Environment (ordered merge)
```

### Gates (Boolean Switches)

- **`production_lock`**: If true, blocks vars matching `production_locked_prefixes` (e.g., `SECRET_*`)
- **`resource_scarcity`**: If true, enforces mutation quotas
- **`observer_effect`**: If true, logs extra metadata per mutation

## Tier 1: CLI Commands

### Initialization & Governance

```bash
# Bootstrap new sandbox
node dist/index.js init

# View effective environment (composed layers)
node dist/index.js get --effective

# View specific layer
node dist/index.js get --layer prime

# Get single key
node dist/index.js get NODE_ENV
```

### Environment Mutation

```bash
# Set with type checking + audit
node dist/index.js set DATABASE_URL "postgres://localhost/db" \
  --layer material \
  --actor "DevOps" \
  --note "Local dev database"

# Profile-based sets (pre-defined templates)
node dist/index.js profiles define mydev \
  NODE_ENV=development \
  LOG_LEVEL=debug

node dist/index.js apply-profile mydev

# Unset and clear
node dist/index.js unset SECRET_TOKEN
node dist/index.js clear-layer subtle
```

### Governance & Validation

```bash
# View codex contract
node dist/index.js codex get

# Enable/disable gates
node dist/index.js gate-set production_lock true
node dist/index.js gates

# Validate environment against codex
node dist/index.js validate

# View policy metadata
node dist/index.js codex get | grep allowed_layers
```

### Audit & Time-Travel

```bash
# View entire audit trail
node dist/index.js history

# Query audit since timestamp
node dist/index.js history --since "2024-01-15T12:00:00Z"

# Immutable snapshot
node dist/index.js snapshot save "before-migration" --note "Pre-schema change"

# List snapshots
node dist/index.js snapshots

# Restore previous state
node dist/index.js snapshot restore "before-migration"

# Diff snapshots
node dist/index.js diff "before-migration" "after-migration"
```

### Binding Recursive Codex

```bash
# Load Recursive Creation Codex structure into environment
node dist/index.js bind-codex

# Now you can access via vars
node dist/index.js get PHILOSOPHICAL_FRAMEWORK_PRINCIPLES
```

### Execution with Injected Environment

```bash
# Run command with effective env vars injected
node dist/index.js run -- node app.js
node dist/index.js run -- pnpm exec build
```

## Tier 2: Programmatic API

### Sandbox + Built-in Tools

```typescript
import { Sandbox, tools } from "./sandbox-tools.js";

// Bootstrap with Recursive Creation Codex
const sb = Sandbox.bootstrap();

// Register built-in tools
sb.registerTool("setForceWeight", tools.setForceWeight);
sb.registerTool("setVar", tools.setVar);
sb.registerTool("addAgent", tools.addAgent);
sb.registerTool("advanceEpoch", tools.advanceEpoch);
sb.registerTool("delayedSetVar", tools.delayedSetVar);

// Listen to all events
sb.on((event) => {
  console.log(event.type, event);
});

// Run tools
sb.runTool("setVar", { key: "API_URL", value: "http://localhost:8001" });

// Control mutations explicitly
sb.setVar("NODE_ENV", "production");
sb.setForceWeight("entropy", 0.7);

// Immutable snapshots
sb.snapshot("stable", "Clean state");
sb.tick(5);
sb.diffCurrent("stable"); // What changed?

// Schedule deferred mutations
sb.schedule(10, "delayed-task", (ctx) => {
  ctx.setVar("SEAL_TIME", new Date().toISOString());
});

// Tick the scheduler
for (let i = 0; i < 15; i++) sb.tick(1);
```

### JSON Path Access

```typescript
import { getByPath, setByPath, parseJsonPath } from "./sandbox-tools.js";

const state = sb.getState();

// Get via path
const tick = getByPath(state, "$.environment.scheduler.tick");
const agentName = getByPath(state, "$.orchestration.agents[0].name");

// Set via path (returns new state, original unchanged)
const nextState = setByPath(state, "$.environment.forces['entropy'].weight", 0.8);
```

### Event Types

```typescript
type SandboxEvent =
  | { type: "SNAPSHOT"; tick: number; name: string; note?: string }
  | { type: "RESTORE"; tick: number; name: string }
  | {
      type: "MUTATION";
      tick: number;
      path: string;
      before: any;
      after: any;
      reason?: string;
      by?: string;
    }
  | { type: "TOOL_RUN"; tick: number; tool: string; input: any; reason?: string; by?: string }
  | { type: "SCHEDULED"; tick: number; id: string; dueTick: number; label: string }
  | { type: "TICK"; tick: number }
  | { type: "ERROR"; tick: number; message: string; context?: any };
```

## Built-in Tools (Tier 2)

### 5 Core Tools

1. **`setForceWeight`** — Adjust force weights (entropy, synchrony, selection)

   ```typescript
   sb.runTool("setForceWeight", { force: "entropy", weight: 0.7 });
   ```

2. **`setVar`** — Set environment variable

   ```typescript
   sb.runTool("setVar", { key: "API_KEY", value: "secret123" });
   ```

3. **`addAgent`** — Add synthetic agent to orchestration layer

   ```typescript
   sb.runTool("addAgent", { name: "Nexus", role: "Orchestrator", model: "Claude" });
   ```

4. **`advanceEpoch`** — Move to next epoch (carry forward imprints & constraints)

   ```typescript
   sb.runTool("advanceEpoch", {
     label: "E1: Emergence",
     resonance: ["cascade", "coherence"],
     carryTriggers: ["resource-scarcity"],
     carryInfluences: ["latent-synchrony"],
   });
   ```

5. **`delayedSetVar`** — Schedule mutation for future tick
   ```typescript
   sb.runTool("delayedSetVar", { key: "SEAL", value: "sealed", afterTicks: 5 });
   ```

## Development

```bash
# Run demo
pnpm --filter env-sandbox run demo

# Build
pnpm --filter env-sandbox run build

# Type check
pnpm --filter env-sandbox run type-check

# Build & watch
pnpm --filter env-sandbox run dev
```

## File Structure

```
apps/env-sandbox/
  src/
    types.ts           — Core Zod schemas (Key, LayerName, EnvMap, SandboxState)
    storage.ts         — File I/O utilities (read/write JSON)
    contracts.ts       — EnvCodex, type validation, deterministic stringify
    audit.ts           — Append-only NDJSON audit trail
    policy.ts          — Gate enforcement + allowlist validation
    sandbox.ts         — EnvSandbox class (governance API)
    index.ts           — CLI (14+ commands)
    sandbox-tools.ts   — Sandbox + 5 built-in tools (deterministic engine)
    demo.ts            — Example usage of both systems
  package.json
  tsconfig.json
```

## Integration Points

### With Nucleus (Node Orchestrator)

1. **File watcher** monitors `.sandbox/env.json`
2. **Build runner** injects effective env into build scripts
3. **Route handler** exposes `GET /env` for IDE
4. **WebSocket bridge** streams audit events to ide-web

### With IDE Web

1. **Environment panel** shows current layer composition
2. **Audit timeline** visualizes mutation history
3. **Snapshot browser** allows restore via UI
4. **Gate toggles** enable/disable production locks

### With Preview Runtime

1. **Injected env** at iframe startup
2. **Live mutation feed** via parent postMessage
3. **Snapshot events** for state time-travel

## Philosophy

> **Contract-first, audit-second, enforcement-first.**

- All environment keys must be declared upfront (in Codex registry)
- All mutations are immutably recorded (append-only audit)
- Policies are enforced at mutation boundary (gates, layers, allowlists)
- Type safety is mandatory (Zod validation at I/O)
- Snapshots enable deterministic replay + debugging

## License

MIT
