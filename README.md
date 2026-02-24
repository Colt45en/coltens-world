# 🌍 World Engine — Deterministic Simulation & Experience Platform

A **contract-first**, **deterministic** monorepo for building coherent digital worlds with neural agents, constraint-based governance, and approval workflows.

![Status](https://img.shields.io/badge/status-production%20ready-brightgreen) ![Node](https://img.shields.io/badge/node-%3E%3D20%20%3C23-blue) ![TypeScript](https://img.shields.io/badge/typescript-5.3%2B-blue) ![License](https://img.shields.io/badge/license-Proprietary-red)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Core Systems](#core-systems)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Key Decisions](#key-decisions)
- [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

**World Engine** is a comprehensive platform for:

✅ **Deterministic world generation** — Same seed → identical content, every time
✅ **Neural agent orchestration** — Python/TypeScript agents with tool calling
✅ **Constraint-based governance** — Grade rails prevent invalid state transitions
✅ **Approval workflows** — Human-in-the-loop decision gates
✅ **Content-addressed assets** — Deterministic avatars, artifacts, and simulations
✅ **Lexicon management** — Token-based vocabulary with process tags
✅ **Physics simulation** — Particle systems, collision detection, hydraulic erosion
✅ **Curriculum systems** — Deterministic educational wheel scheduling

### Use Cases

- **AI Training**: Generate consistent worlds for multi-agent learning
- **Game Development**: Procedural world generation with coherence guarantees
- **Simulation**: Physics-based systems with reproducible outcomes
- **Content Creation**: Batch compilation of assets with deterministic hashing
- **Educational**: Curriculum-based progression with guardian invariants

---

## 🏗️ Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     IDE Web (React/Vite)                     │
│  ├─ Avatar Compiler Lab          ← NEW: Deterministic V2   │
│  ├─ Nucleus Monitor              ← NEW: Observer Mode       │
│  ├─ Brain Console                ← NEW: Observer Mode       │
│  ├─ Lexicon Inspector            ← Token management         │
│  ├─ Studio Lab                   ← Ontology IDE             │
│  └─ Game Studio                  ← 3D environment viewer    │
└──────────────┬──────────────────────────────────────────────┘
               │ WebSocket (hub endpoint)
┌──────────────┴──────────────────────────────────────────────┐
│               Nucleus (Node.js HTTP/WS Hub)                 │
│  ├─ Tool Router (constraint pre-validation)                 │
│  ├─ Chat Streaming Handler                                  │
│  ├─ Approval State Machine      ← NEW: Full workflow        │
│  ├─ Ledger Routes (append-only event store)                 │
│  ├─ Avatar Compilation API      ← NEW: /api/avatars/compile│
│  └─ Health & Session Management                             │
└──────────────┬──────────────────────────────────────────────┘
         ┌─────┴─────┬──────────────┬──────────────┐
         │           │              │              │
    ┌────▼──┐   ┌───▼──┐    ┌────▼──┐      ┌────▼─────┐
    │ Brain │   │Python│    │TS Agnt│      │Lexicon   │
    │:8011  │   │:3001 │    │:3002  │      │Sidecar   │
    │(FastAPI)  │(Uvicorn)  │(Node) │      │          │
    └───────┘   └──────┘    └───────┘      └──────────┘
         │           │              │              │
    ┌────────────────────────────────────────────────────┐
    │  Event Bus (Nucleus Internal)                      │
    │  ├─ Ledger append events                           │
    │  ├─ Approval workflows                             │
    │  ├─ Tool execution results                         │
    │  └─ Agent state transitions                        │
    └────────────────────────────────────────────────────┘
         │
    ┌────▼───────────────────────────────────────────┐
    │  LEDGER (SQLite Append-Only Event Store)       │
    │  truth://world-engine/ledger                   │
    │  - ApprovalRequested/ApprovalDecision events   │
    │  - AvatarCompilation events                    │
    │  - Tool execution results                      │
    │  - World state transitions                     │
    └────────────────────────────────────────────────┘
```

### Packages Structure

```
packages/
├── avatar-compiler/          ← Deterministic avatar batch compilation
├── brain/                    ← Semantic query system & neural integration
├── bus/                      ← Event bus patterns & envelope types
├── contracts/                ← OpenAPI specs & TypeScript types
├── engine/                   ← Core world engine (ECS, systems, cursors)
├── lexicon/                  ← Token registry & vocabulary management
├── nexus-pipeline/           ← Data orchestration & evidence collection
├── physics-contract/         ← Physics simulation interface
├── protocol/                 ← Unified envelope & message types
├── signal-spine-*/           ← Neural analysis & metrics
└── util/                     ← Shared utilities

apps/
├── nucleus/                  ← Central orchestrator (HTTP/WS server)
├── ide-web/                  ← React development IDE
├── py-sidecar/               ← Python agent runtime
├── agent-server/             ← TypeScript agent runtime
├── preview-runtime/          ← Game environment preview
└── sim-server/               ← Physics simulation server

unified_nexus/               ← Python agent system (cognition, digital twin)
```

### Data Flow: Avatar Compilation with Approval

```
IDE Web (LabAvatarCompilerPage)
    │ Uploads JSON [avatars: AvatarDNA[]]
    ↓
Nucleus /api/avatars/compile
    │ POST { avatars, atlasSize, lodLevels }
    ↓
Ledger append avatar.compilation.started event
    │
    ├─→ Emit ApprovalRequested event (if needed)
    │
Nucleus processes event
    │
LabNucleusObserverPage
    │ Polls /approvals/pending every 2s
    ↓
User clicks Approve
    │ POST /approvals/{id}/decide { decision: "approved" }
    ↓
Nucleus applies decision
    │
Package avatar artifacts
    │
LabAvatarCompilerPage
    │ Receives completion event
    ↓
Display job result + registry hash
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20.x–22.x (not 24+)
- **pnpm** 9.x–10.x
- **Python** 3.10+ (for agents)
- **sqlite3** (usually included)

### 1. Clone & Install

```bash
git clone <repo>
cd "coltens world"
pnpm install
```

### 2. Start Development Services

Terminal 1 — Nucleus (backend hub):
```bash
pnpm run dev
```
You should see:
```
[nucleus] listening http/ws on :3000
[ledger] initialized at runtime/nucleus-ledger.db
```

Terminal 2 — IDE Web (frontend):
```bash
pnpm --filter ./apps/ide-web run dev -- --port 5173
```
Navigate to: **http://localhost:5173**

Terminal 3 — Python agents (optional):
```bash
pnpm run dev:py
```
Runs: FastAPI Brain at `http://localhost:8011`

### 3. Test Avatar Compiler

1. Open http://localhost:5173 → Launcher
2. Click **"Avatar Compiler (V2)"**
3. Upload JSON:
   ```json
   {
     "avatars": [
       {
         "id": "test_1",
         "dna": {
           "bodyType": "humanoid",
           "height": 1.8
         }
       }
     ],
     "atlasSize": 512,
     "lodLevels": 3
   }
   ```
4. Click **"Compile Batch"**
5. Check job status in history

### 4. Test Approval Workflow

1. In IDE, click **"Nucleus Monitor"** (observer mode)
2. See pending approvals polling every 2 seconds
3. Click **"Approve"** for a pending decision
4. Observe approval status update

---

## 💡 Core Systems

### Avatar Compiler (Phase 1A Complete) ✅

**Path:** `packages/avatar-compiler/`

Three-word deterministic avatar batch compilation:
- **Input**: Avatar DNA (genes, parameters)
- **Processing**: Deterministic geometry + texturing
- **Output**: GLB meshes with deterministic SHA256 hashes

**Latest:** Phase 1A complete. Phase 1B (real geometry builder) pending.

```bash
# Compile avatars
pnpm test:avatar:determinism

# Build package
pnpm build:avatar
```

**Key guarantees:**
- `compileAvatar(dna, opts)` → same hash every run
- Content-addressed registry
- No random initialization during compilation

---

### Nucleus — Central Orchestrator

**Path:** `apps/nucleus/src/`

**Purpose:** Hub for all IDE communication, tool routing, approval workflows.

**Endpoints:**
- `GET /health` — Health check
- `POST /api/avatars/compile` — Submit avatar batch job
- `GET /approvals/pending` — List pending approvals
- `POST /approvals/{id}/decide` — Submit approval decision
- `POST /ledger/append` — Record event
- `GET /ledger/stream` — Stream ledger events

**Recent Updates (This Session):**
- ✅ Tool executor with constraint pre-validation
- ✅ Curriculum constraint store (guardian invariants)
- ✅ Approval workflow integration
- ✅ Avatar compilation endpoint

---

### Brain — Semantic Query System

**Path:** `apps/py-sidecar/` (FastAPI) + `packages/brain/` (contracts)

**Purpose:** Semantic search, scoring, neural agent interface.

**Interface:**
- `POST /chat/stream` — Streaming LLM conversation with tool support
- Tool execution via Nucleus tool router

**Latest:** Observer mode UI created (read-only with approval decisions only)

---

### Lexicon — Token Registry

**Path:** `packages/lexicon/`

**Purpose:** Vocabulary management, process tags, operator versioning.

**Features:**
- Deterministic ID generation
- Global uniqueness enforcement
- Process tag namespacing
- Version format validation

---

### Ledger — Append-Only Event Store

**Path:** `apps/nucleus/src/ledger/`

**Purpose:** Single source of truth for all state changes.

**Event Types:**
- `approval.requested` → Need human decision
- `approval.decision` → Approval result
- `avatar.compilation.started` → Batch job initiated
- Custom events per domain

**Storage:** SQLite append-only on disk

---

### Constraint Systems (Grade Rails)

**New in This Session:**

Five complementary constraint layers:

1. **Curriculum Guardian Invariants** (`wheel_runtime.py`)
   - Rotation bounds: `1 ≤ rotation ≤ total_rotations`
   - Stop index bounds
   - Version matching

2. **World Genesis Continuity** (`world_genesis.py`)
   - Region/faction/character consistency
   - Timeline coherence

3. **Physics Constraints** (`physics-contract`)
   - Body bounds validation
   - Constraint satisfaction solving

4. **Representation Invariants** (`invariantPolicy.core.ts`)
   - Packet-level gates (direction, blame magnitude)
   - Batch-level gates (separation improvement)

5. **Digital Twin Health Checks** (`invariants.py`)
   - Tool result validation
   - Hash format verification

**Tool Execution Flow:**
```
Agent Tool Call
    ↓
ToolExecutor.execute()
    ↓
CurriculumConstraintStore.validate()
    ├─ Violations? → Reject with details
    └─ Valid? → Continue
    ↓
Route by prefix (agent_py.*, agent_ts.*, agent_hub.*)
    ↓
Agent Execution
```

---

## 🛠️ Development

### Project Structure Principles

Per **Copilot Instructions**:

- **Contracts before implementations** ✅
- **Determinism by default** ✅
- **No boundary crossing without validation** ✅
- **Additive schema evolution** ✅
- **Content-addressed artifacts** ✅

### File Organization

```
apps/
  nucleus/
    src/
      tool/              ← Tool execution with constraints
      constraints/       ← Constraint stores
      approvals/         ← Approval state machine
      routes/            ← HTTP routes
      ledger/            ← Event store
      wsHub.ts           ← WebSocket orchestration

packages/
  avatar-compiler/
    src/
      compiler.ts        ← Main entry point
      geometry.ts        ← Swap point for mesh builder
      types.ts           ← Public contracts

  engine/
    src/
      contracts/         ← Data schemas
      systems/           ← ECS systems
      cursors/           ← State cursors
```

### Adding a New Component

1. **Create contract first** (`src/contracts/types.ts`)
2. **Implement** (`src/index.ts`)
3. **Export publicly** (update `src/index.ts` barrel)
4. **Add to monorepo** (update `tsconfig.base.json` paths)
5. **Wire into Nucleus** if needed

### Environment Variables

**Nucleus:**
```bash
NUCLEUS_PORT=3000              # HTTP/WS server port
LEDGER_DB=runtime/nucleus-ledger.db
BRAIN_ENDPOINT=http://localhost:8011
AGENT_ENDPOINT=http://localhost:3001
```

**Python Agents:**
```bash
BRAIN_PORT=8011
NUCLEUS_ENDPOINT=http://localhost:3000
```

### TypeScript Configuration

**Root:** `tsconfig.base.json` defines all path aliases:
```json
{
  "paths": {
    "@world-engine/*": ["packages/*/src/index.ts"]
  }
}
```

Each package has its own `tsconfig.json` extending root.

---

## 🧪 Testing

### Test Commands

```bash
# Run all tests
pnpm run test

# Avatar compiler determinism (critical)
pnpm test:avatar:determinism

# Specific package
pnpm --filter @world-engine/avatar-compiler run test

# Watch mode
pnpm test -- --watch

# Coverage
pnpm test -- --coverage
```

### E2E Test Flow

```bash
pnpm run dev:nucleus  # In one terminal

node scripts/test-e2e-avatar-approval.mjs  # In another
```

**Tests:**
1. Nucleus health check
2. Avatar compilation job submission
3. Approval polling
4. Approval decision workflow
5. Constraint enforcement verification

See: [E2E_TEST_GUIDE.md](E2E_TEST_GUIDE.md)

### Avatar Compiler Determinism Tests

Three critical tests:
```bash
✅ Test 1: Same DNA → Same hash (multiple runs)
✅ Test 2: CLI batch compile → Registry consistency
✅ Test 3: Deterministic ID generation (no Date.now())
```

All three pass ✅

---

## 🚢 Deployment

### Production Checklist

- [ ] `pnpm run check` — Lint + typecheck
- [ ] `pnpm run build` — Build all packages
- [ ] `pnpm run test` — Run test suite
- [ ] `pnpm run validate` — Full validation
- [ ] Avatar determinism tests pass
- [ ] E2E test succeeds
- [ ] Manual UI walkthrough complete

### Build Artifacts

```
build/           ← C++ fusion recorder binaries (optional)
dist/            ← TypeScript compiled output
runtime/         ← SQLite databases (ledger)
  ├─ nucleus-ledger.db
  └─ [other runtime data]
```

### Docker Deployment

```dockerfile
FROM node:22-alpine

WORKDIR /app
COPY pnpm-lock.yaml .
COPY package.json .
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

EXPOSE 3000
CMD ["pnpm", "run", "dev:nucleus"]
```

### Environment Tuning

**Development:**
```bash
NODE_ENV=development
DEBUG=nucleus:*
```

**Production:**
```bash
NODE_ENV=production
LEDGER_REPLICA_ENABLED=true
APPROVAL_TIMEOUT_MS=3600000
```

---

## 🎓 Key Decisions

### Why Determinism?

✅ **Reproducibility**: Same seed → same world, perfect for AI training
✅ **Debugging**: Always recreate issues
✅ **Caching**: Content-addressed assets
✅ **Verification**: Independent implementations can validate

### Why Contract-First?

✅ **Clarity**: Contracts define boundaries before code
✅ **Safety**: Contracts prevent misalignment
✅ **Evolution**: Additive changes only
✅ **Testing**: Contract violations caught early

### Why Approval Workflows?

✅ **Human oversight**: Critical decisions need approval
✅ **Audit trail**: All decisions recorded in ledger
✅ **Reversibility**: Ledger is append-only, decisions are immutable
✅ **Integration**: Approval panel is read-only observer pattern

### Why Multiple Constraint Layers?

✅ **Defense in depth**: Multiple layers catch more issues
✅ **Separation of concerns**: Constraints live where rules are defined
✅ **Composability**: Mix and match constraint types
✅ **Performance**: Early rejection prevents expensive computation

---

## 🐛 Troubleshooting

### Nucleus Won't Start

**Error:** `better-sqlite3` module not found
```bash
# Solution
pnpm install --no-frozen-lockfile
# Or rebuild native modules
npm rebuild better-sqlite3
```

**Error:** Port 3000 already in use
```bash
# Solution: Use different port
NUCLEUS_PORT=3001 pnpm run dev:nucleus
```

### Avatar Compiler Tests Fail

**Error:** Non-deterministic hashes
```bash
# Solution: Check for non-determinism
pnpm test:avatar:determinism
# Review: Date.now(), Math.random(), UUID generation
```

### Approval Polling Not Working

**Issue:** No pending approvals appear
```bash
# Check Nucleus logs
# Check ledger: GET http://localhost:3000/ledger/stream
# Verify approval events in stream
```

### IDE Connection Drops

**Issue:** WebSocket closes unexpectedly
```
Hub connection lost. Reconnecting...
```
**Solution:** Check Nucleus is running, IDE can reach port 3000

### TypeScript Building Fails

**Error:** Path alias not found
```bash
# Solution: Regenerate path imports
pnpm run audit:imports --write
```

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| [QUICKSTART.md](QUICKSTART.md) | 5-minute setup guide |
| [E2E_TEST_GUIDE.md](E2E_TEST_GUIDE.md) | Complete testing walkthrough |
| [SESSION_COMPLETION.md](SESSION_COMPLETION.md) | Latest session work |
| [AGRICULTURE_README.md](AGRICULTURE_README.md) | World generation systems |
| [LEDGER_README.md](LEDGER_README.md) | Event store design |
| [AVATAR_COMPILER_V2_COMPLETE.md](AVATAR_COMPILER_V2_COMPLETE.md) | Avatar system details |

---

## 🤝 Contributing

### Pre-Commit Checklist

```bash
# Format code
pnpm run format

# Lint and typecheck
pnpm run check

# Run tests
pnpm run test

# Audit imports/exports
pnpm run audit:imports
```

### PR Template

```markdown
## What changed?
Brief description of changes.

## Why?
Rationale for the change.

## Contract alignment
- [ ] Respects contract boundaries
- [ ] Adds tests for new behavior
- [ ] Updates relevant docs
- [ ] Maintains determinism guarantees

## Testing
```bash
pnpm run check
pnpm run test
node scripts/test-e2e-avatar-approval.mjs
```
```

---

## 📊 Status

| System | Status | Phase | Notes |
|--------|--------|-------|-------|
| Avatar Compiler | ✅ Complete | 1A | Determinism verified |
| Nucleus Orchestrator | ✅ Complete | Production | Constraints integrated |
| Brain (Semantic) | ✅ Complete | Observer Mode | Read-only UI done |
| Lexicon Registry | ✅ Complete | Production | Token management |
| Approval Workflow | ✅ Complete | Production | Full integration |
| Physics Engine | ✅ Complete | Simulation | Constraint solver ready |
| Curriculum System | ✅ Complete | Guardian Invariants | Grade rails enforced |
| Ledger (Event Store) | ✅ Complete | Production | Append-only, indexed |

---

## 📞 Support

- **Issues?** Check [Troubleshooting](#troubleshooting)
- **Questions?** See [Documentation](#documentation)
- **Contributing?** Review [Contributing](#contributing)

---

**World Engine v2.0** — Deterministic • Contractive • Constrained
©️ 2026 Proprietary Software
