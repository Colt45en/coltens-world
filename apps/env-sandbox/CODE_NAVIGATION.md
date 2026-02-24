# 🗺️ Env-Sandbox Code Navigation Guide

## Start Here

### Main Documentation

1. **[SESSION_3_COMPLETE_DELIVERY.md](SESSION_3_COMPLETE_DELIVERY.md)** (5 min read)
   - Overview of all three phases in this session
   - Real-world scenarios & integration map
   - Getting started in 3 steps

2. **[apps/env-sandbox/README.md](apps/env-sandbox/README.md)** (10 min read)
   - Architecture overview
   - All 14+ CLI commands explained
   - Programmatic API examples
   - Integration with Nucleus/IDE/Preview

3. **[apps/env-sandbox/SYSTEM_COMPLETE.md](apps/env-sandbox/SYSTEM_COMPLETE.md)** (10 min read)
   - Detailed design principles
   - Code organization & dependency graph
   - Development workflow

---

## Code Reading Order

### If You Want to **Understand the Architecture** (15 min)

```
types.ts
  ├─ Read: 130 lines of Zod schemas
  ├─ Understand: All core types (Key, Layer, EnvMap, Codex, State)
  └─ Key Concepts: Type safety, layer composition, codex structure

contracts.ts
  ├─ Read: 150 lines of contract definitions
  ├─ Understand: How Codex defines governance rules
  └─ Key Concepts: Registry allowlists, gates, type validation

policy.ts
  ├─ Read: 60 lines of enforcement logic
  ├─ Understand: How mutations are validated against policy
  └─ Key Concepts: Allowlist checking, gate enforcement, layer restrictions

sandbox.ts
  ├─ Read: 450+ lines of the main class
  ├─ Understand: Full API for environment management
  └─ Key Concepts: Snapshots, profiles, layers, auditing
```

**Time Investment**: 15 minutes
**Outcome**: "I understand how EnvSandbox works"

---

### If You Want to **Use the CLI** (5 min)

```
Read: apps/env-sandbox/README.md (CLI Commands section)
  ├─ init, get, set, unset, clear-layer
  ├─ gates, gate-set, validate
  ├─ snapshot, snapshots, restore, diff
  ├─ profiles, apply-profile
  └─ history, bind-codex, run

Then try:
  $ node dist/index.js init
  $ node dist/index.js set NODE_ENV production
  $ node dist/index.js get --effective
  $ node dist/index.js history
```

**Time Investment**: 5 minutes
**Outcome**: "I can control environments from the command line"

---

### If You Want to **Use the Sandbox Engine** (20 min)

```
sandbox-tools.ts
  ├─ Read: 800+ lines (starts with types, then Sandbox class)
  ├─ Understand: Event types, JSON path parsing, snapshots, scheduler
  └─ Key Concepts: Determinism, immutable state, tick-based execution

demo.ts
  ├─ Read: 150 lines of example code
  ├─ Understand: How to bootstrap, register tools, run tools, listen to events
  └─ Key Concepts: Tool runtime, event handling, diffing, scheduling

Then run:
  $ pnpm --filter env-sandbox run demo
```

**Time Investment**: 20 minutes
**Outcome**: "I can build state machines with deterministic mutations"

---

### If You Want to **Integrate into Your App** (30 min)

```
1. Choose your path:
   A. CLI (DevOps, scripts) → apps/env-sandbox/README.md (Tier 1 section)
   B. Node app (programmatic) → sandbox.ts + read EnvSandbox class
   C. Simulation (deterministic) → sandbox-tools.ts + demo.ts

2. Copy the example from README or demo.ts

3. Update imports to match your build system

4. Test:
   $ pnpm --filter env-sandbox run build
   $ node dist/index.js init
```

**Time Investment**: 30 minutes
**Outcome**: "I can integrate env-sandbox into my workflow"

---

## File-by-File Breakdown

### `src/types.ts` (130 lines)

**Purpose**: Define all core types using Zod

**Key Exports**:

- `KeySchema` — Uppercase identifier validation
- `LayerNameSchema` — Enum of 4 layers
- `EnvMapSchema` — Record of typed values
- `EnvCodexSchema` — Complete governance contract
- `SandboxStateSchema` — Full state machine
- `SandboxEventSchema` — Event discriminated union

**When to Read**:

- Need to understand what a valid Key looks like?
- Want to know what fields a Codex has?
- Confused about state structure?

---

### `src/storage.ts` (40 lines)

**Purpose**: File I/O utilities for persistence

**Key Functions**:

- `resolveStoragePaths()` — Returns .sandbox dir paths
- `readJsonFile()` — Safe JSON read with error handling
- `writeJsonFile()` — Pretty-print JSON with mkdir
- `ensureDir()` — Recursive directory creation

**When to Read**:

- Want to understand how state is persisted?
- Need to implement custom storage backend?

---

### `src/contracts.ts` (150 lines)

**Purpose**: Codex validation, type checking, deterministic stringify

**Key Functions**:

- `EnvCodexSchema` — Zod schema for governance contract
- `EnvKeySpecSchema` — Per-key metadata definition
- `parseTypedValue()` — Parse raw string according to kind
- `stableJsonStringify()` — Deterministic JSON (sorted keys)
- `codexToMap()` — Convert registry to Map for O(1) lookups

**When to Read**:

- Want to understand how type validation works?
- Need to add custom parsing rules?
- Curious about deterministic JSON?

---

### `src/audit.ts` (100 lines)

**Purpose**: Append-only NDJSON audit trail with queries

**Key Functions**:

- `AuditEvent` — Discriminated union of mutation types
- `appendAudit()` — Write immutable event
- `readAuditSince()` — Query with optional timestamp filter
- `resolveAuditPath()` — Path resolution

**When to Read**:

- Want to understand how mutations are logged?
- Need to query audit trail?
- Curious about NDJSON format?

---

### `src/policy.ts` (60 lines)

**Purpose**: Enforce governance rules at mutation boundary

**Key Functions**:

- `PolicyContext` — State + active gates
- `enforceKeyPolicy()` — Main validation logic
  - Allowlist check (fail_on_unknown_key)
  - Layer restrictions (allowed_layers per key)
  - Production lock (block SECRET\_\* if gate enabled)
  - Gate requirements (all required_gates must be true)

**When to Read**:

- Want to understand policy enforcement?
- Need to add custom gate types?
- Curious about how rules interact?

---

### `src/sandbox.ts` (450+ lines)

**Purpose**: EnvSandbox class — core governance API

**Key Sections**:

1. **Constructor** — Load from disk or init defaults
2. **Getters** — getEnvCodex(), getActiveLayer(), getLayerEnv()
3. **Mutation API** — setVarTyped(), unsetVar(), clearLayer()
4. **Profiles** — defineProfile(), applyProfile()
5. **Snapshots** — snapshot(), restore(), diffSnapshot()
6. **Codex Binding** — bindRecursiveCreationCodex()
7. **Persistence** — saveToFile() (after every mutation)

**When to Read**:

- Want to use EnvSandbox programmatically?
- Need to understand the full API?
- Building on top of EnvSandbox?

---

### `src/index.ts` (400+ lines)

**Purpose**: CLI interface with 14+ commands

**Key Sections**:

1. **Flag Parser** — Extract --flag value from argv
2. **Command Handlers**:
   - `init` — Bootstrap new sandbox
   - `get/set/unset/clear` — CRUD operations
   - `codex` — View/export/import governance contract
   - `gates` — View current gate state
   - `validate` — Hard schema check
   - `history` — Audit trail queries
   - `profiles` — Template management
   - `snapshot/*` — Time-travel operations
   - `run` — Execute with injected env
   - `bind-codex` — Load Codex into vars

**When to Read**:

- Want to understand all CLI commands?
- Need to add a new command?
- Building a GUI on top of CLI?

---

### `src/sandbox-tools.ts` (800+ lines)

**Purpose**: Deterministic mutation engine with Recursive Codex bootstrap

**Key Sections**:

1. **Types** — SandboxState, SandboxEvent, ToolContext
2. **Utilities** — diffJson(), parseJsonPath(), getByPath(), setByPath()
3. **Sandbox Class**:
   - `bootstrap()` — Create with default Recursive Codex
   - `set()/get()` — JSON path operations
   - `setVar()/setForceWeight()` — Convenience methods
   - `snapshot()/restore()` — Immutable state snapshots
   - `registerTool()` — Add custom tools
   - `runTool()` — Execute registered tool
   - `schedule()` — Deferred execution
   - `tick()` — Advance scheduler
   - `on()` — Event listener
4. **Built-in Tools** (5 core tools):
   - `setForceWeight` — Adjust force weights
   - `setVar` — Set environment var
   - `addAgent` — Add orchestration agent
   - `advanceEpoch` — Move to next epoch
   - `delayedSetVar` — Schedule mutation

**When to Read**:

- Want to build deterministic state machines?
- Need to understand scheduler + events?
- Building simulations or AI training loops?

---

### `src/demo.ts` (150 lines)

**Purpose**: Complete working example showing all APIs

**Shows**:

1. Bootstrap Sandbox with Recursive Codex
2. Register all 5 built-in tools
3. Run tools with inputs
4. Listen to events (MUTATION, TOOL_RUN, TICK, SNAPSHOT)
5. Snapshot before & after
6. Tick the scheduler (with deferred job)
7. Diff snapshots
8. Introspect state via JSON paths
9. List all events

**When to Read**:

- Want a quick copy-paste example?
- Need to verify API behavior?
- Building your own demo?

---

## Where to Find Answers

### "How do I...?"

**...set an environment variable?**

- CLI: `node dist/index.js set KEY value --layer material`
- Code: `sandbox.setVarTyped({key, raw, layer, actor})`
- Engine: `engine.setVar(key, value)`

**...define allowed environment keys?**

- File: `contracts.ts` → `EnvKeySpecSchema`
- Codex structure: `src/sandbox.ts` → `bindRecursiveCreationCodex()`
- CLI: `node dist/index.js codex get | grep registry`

**...enforce a policy rule?**

- File: `policy.ts` → `enforceKeyPolicy()`
- Gate example: production*lock blocks SECRET*\* keys
- Enable gate: `node dist/index.js gate-set production_lock true`

**...time-travel state?**

- CLI: `node dist/index.js snapshot save "before", snapshot restore "before"`
- Code: `engine.snapshot("name"), engine.restore("name")`
- Diff: `engine.diffSnapshots("a", "b")`

**...schedule a deferred action?**

- Code: `sandbox.schedule(10, "label", (ctx) => { ctx.setVar(...) })`
- Then: `sb.tick(10)` triggers the job
- Example: demo.ts → delayedSetVar tool

**...listen to mutations?**

- Code: `sandbox.on(event => { if (event.type === "MUTATION") ... })`
- Types: `src/sandbox-tools.ts` → `SandboxEvent` union
- Example: demo.ts → full event log

**...add a custom tool?**

- Code: `sb.registerTool("myTool", (ctx, input) => { ... })`
- Pattern: All 5 built-in tools in demo.ts
- API: `ctx.set(), ctx.setVar(), ctx.setForceWeight(), ctx.schedule()`

---

## Architecture Diagrams

### Tier 1: Governance Flow

```
User/CI/CD
    ↓
  CLI (index.ts)
    ↓ (flag parsing)
  Command Handler (set, get, snapshot, etc.)
    ↓ (load state)
  EnvSandbox (sandbox.ts)
    ├─ Codex (contracts.ts)
    ├─ Policy Check (policy.ts)
    ├─ Layer Composition
    ├─ Type Validation (contracts.ts)
    └─ Audit Log (audit.ts)
    ↓ (persist)
  .sandbox/env.json + .sandbox/audit.ndjson
```

### Tier 2: Deterministic Flow

```
Program/Simulation
    ↓
  Sandbox (sandbox-tools.ts)
    ├─ Bootstrap from Codex
    ├─ Tool Registry
    ├─ JSON Path (get/set/diff)
    ├─ Snapshots (immutable)
    ├─ Scheduler (tick-based)
    └─ Event Bus (listeners)
    ↓ (no persistence, in-memory)
  State + Events (for replay/analysis)
```

---

## Learning Path (Recommended)

### Beginner (< 1 hour)

1. Read: SESSION_3_COMPLETE_DELIVERY.md (key concepts)
2. Run: `pnpm --filter env-sandbox run demo`
3. Try: `node dist/index.js init && node dist/index.js get`

**Outcome**: Understand what env-sandbox does

---

### Intermediate (1-2 hours)

1. Read: apps/env-sandbox/README.md (all sections)
2. Read: src/types.ts (understand core types)
3. Read: demo.ts (understand API)
4. Try: Make changes to demo.ts and re-run it

**Outcome**: Can use env-sandbox in your code

---

### Advanced (2-4 hours)

1. Read: src/sandbox.ts (understand EnvSandbox)
2. Read: src/index.ts (understand CLI)
3. Read: src/policy.ts (understand enforcement)
4. Write: Custom tool for your domain

**Outcome**: Can extend env-sandbox

---

### Master (4+ hours)

1. Read: All src/\*.ts files (understand every detail)
2. Integrate env-sandbox into your project
3. Add custom gates, tools, and event listeners
4. Build UI on top of env-sandbox

**Outcome**: Own env-sandbox completely

---

## Quick Reference

### CLI

```bash
# Initialization
node dist/index.js init

# Read
node dist/index.js get [KEY] [--effective] [--layer LAYER]

# Write
node dist/index.js set KEY VALUE [--layer LAYER] [--actor NAME] [--reason]

# Governance
node dist/index.js gates                          # view
node dist/index.js gate-set GATE_NAME true|false # set

# Snapshots
node dist/index.js snapshot save "NAME" [--note]  # save
node dist/index.js snapshot restore "NAME"        # restore
node dist/index.js snapshots                      # list
node dist/index.js diff "A" "B"                   # compare

# Audit
node dist/index.js history [--since ISO]          # view trail

# Run
node dist/index.js run -- pnpm exec build         # inject env
```

### API

```typescript
// EnvSandbox (Tier 1)
const sb = new EnvSandbox(".sandbox/env.json");
sb.setVarTyped({ key, raw, layer, actor });
sb.getLayerEnv("material");
sb.snapshot("name");

// Sandbox (Tier 2)
const engine = Sandbox.bootstrap();
engine.setVar(key, value);
engine.setForceWeight(force, weight);
engine.snapshot("name");
engine.tick(n);
engine.on(event => { ... });
```

---

**Navigation Tip**: Most files include helpful comments at the top explaining their purpose. Start there!
