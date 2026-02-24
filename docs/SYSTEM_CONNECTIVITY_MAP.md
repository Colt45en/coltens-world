# 🔗 System Connectivity Map - Complete File Dependencies

**Generated:** February 12, 2026
**Purpose:** Show exact file paths and inter-dependencies
**Scope:** All 19 packages + 5 apps + 12+ documentation files

---

## 📦 Package Dependency Matrix

```
┌─────────────────────────────────────────────────────────────────┐
│                    DEPENDENCY FLOW                              │
│  (Arrows show "depends on" direction)                            │
└─────────────────────────────────────────────────────────────────┘

LEAF LAYER (No dependencies):
  ├── protocol/src/          → Zod, TypeScript
  ├── math/src/              → Built-ins (random, Math)
  ├── graphics/src/          → Canvas API
  ├── assets/src/            → File system

CORE LAYER (Uses Leaf):
  ├── protocol/              ← math (random RNG)
  ├── bus/                   ← protocol (message types)
  ├── engine/                ← protocol, math (vectors)

AGENT LAYER (Uses Core):
  ├── brain/                 ← protocol, engine, math
  ├── lexicon/               ← protocol, engine
  ├── codex/                 ← protocol

THOUGHT LAYER (NEW, Uses Agent):
  ├── brain/src/thought/     ← protocol, lexicon
  ├── brain/src/memory/      ← protocol
  ├── brain/src/ui/          ← React, Recharts, protocol

APPLICATION LAYER (Uses all above):
  ├── ide-web/               ← bus, protocol, brain/ui
  ├── nucleus/               ← bus, protocol, engine, brain
  ├── preview-runtime/       ← engine, protocol
  ├── sim-server/            ← engine, protocol
  ├── py-sidecar/            ← protocol (via HTTP)
```

---

## 🗂️ Complete File Inventory & Dependencies

### **PACKAGES/PROTOCOL/** 📦 (Message Contracts)

```typescript
packages/protocol/src/
├── index.ts
│   exports: ALL types from below
│   size: 8 lines
│
├── types.ts
│   defines: SessionId, UserId, TraceId, MessageId
│   depends: zod
│   size: 50 lines
│
├── schemas.ts
│   defines: Envelope<T> generic schema
│   depends: types
│   size: 100 lines
│
├── envelopes/
│   ├── index.ts (exports all below)
│   ├── base.ts (Envelope generic)
│   ├── system.ts (lifecycle messages)
│   ├── uee.ts (agent messages)
│   ├── build.ts (build events)
│   └── ...
│   total: 15+ envelope types
│   size: 300+ lines
│
├── chat.ts ✨ NEW
│   defines:
│   • ChatRequest {userMessage, sessionId, artifacts}
│   • ChatResponse {summary, artifacts, citations}
│   • ToolCall, ToolResult, Citation
│   • MemoryWrite, ChatStreamEvent
│   depends: types, schemas, zod
│   size: 250 lines
│
├── types.ts
│   defines: Message type discriminators
│   (chat.request, chat.response, etc)
│   size: 50+ lines
│
└── uee.ts
    defines: UEE-1.0 agent types
    size: 100+ lines
```

**Status:** ✅ Complete (11+ message types defined)

---

### **PACKAGES/BRAIN/** 🧠 (AI Agent Core)

```typescript
packages/brain/src/
├── index.ts
│   exports: Brain, Population, Controller, ThoughtPipeline, MemoryStore
│   size: 10 lines
│
├── network.ts
│   class Network {
│     forward(inputs: number[]): number[]
│     mutate(rate: number)
│   }
│   size: 181 lines
│   depends: packages/math
│
├── population.ts
│   class Population {
│     generation: number
│     agents: Network[]
│     tick(world): void
│     train(fitnessFunc): void
│   }
│   size: 267 lines
│   depends: network.ts, packages/math
│
├── controller.ts
│   class AgentBrain {
│     model: Network
│     step(sensors, state): actions
│   }
│   size: 312 lines
│   depends: network.ts, Network, Sensor, Action
│
├── thought/
│   ├── index.ts (exports thoughtPipeline)
│   │
│   ├── thoughtTypes.ts
│   │   defines:
│   │   • ThoughtState (6-stage progression)
│   │   • KnowledgeArtifact (output record)
│   │   • StableId, IsoDateTime schemas
│   │   • ReasoningMode enum
│   │   depends: zod
│   │   size: 140 lines
│   │
│   ├── thoughtPipeline.ts
│   │   execute(input: ThoughtState): KnowledgeArtifact
│   │   orchestrates 6 stages:
│   │   1. runConceptStage()
│   │   2. runPerspectiveStage()
│   │   3. runSelfQuestioningStage()
│   │   4. runReasoningStage()
│   │   5. runDecisionStage()
│   │   6. runOptimizeStage()
│   │   depends: thoughtTypes, stages/*, memoryStore
│   │   size: 100 lines
│   │
│   ├── stages/
│   │   ├── concept.ts (extract goals, terms)
│   │   ├── perspective.ts (multi-angle views)
│   │   ├── self-questioning.ts (challenge assumptions)
│   │   ├── reasoning.ts (build evidence)
│   │   ├── decision.ts (select actions)
│   │   ├── optimize.ts (refine output)
│   │   │
│   │   all depend: thoughtTypes, lexicon queries
│   │   total size: 400 lines
│   │
│   └── memoryChain.schema.ts
│       defines:
│       • ChainLink (single artifact link)
│       • MemoryChain (concept evolution)
│       • beliefEvolution tracking
│       depends: zod, thoughtTypes
│       size: 100 lines
│
├── memory/
│   └── memoryStore.ts
│       class MemoryStore {
│         append(artifact: KnowledgeArtifact): void
│         query(filters): KnowledgeArtifact[]
│         stream(filters): AsyncIterator<KnowledgeArtifact>
│       }
│       depends: thoughtTypes, fs
│       size: 150 lines
│       reads/writes: .brain/memory/knowledge.ndjson
│
├── lexicon/
│   ├── lexiconIndex.schema.ts
│   │   defines:
│   │   • LexiconIndex schema
│   │   • LexiconEntry interface
│   │   depends: zod
│   │   size: 80 lines
│   │   reads: docs/lexicon/lexicon.index.json
│   │
│   └── (query helpers TBD)
│
├── ui/
│   ├── index.ts
│   │   exports: MemoryPanel, LexiconBrowser, all hooks
│   │   size: 10 lines
│   │
│   ├── MemoryPanel.tsx
│   │   React component
│   │   props: memoryFilePath, onInvokeMemoryStatsCli, onInvokeMemoryQueryCli
│   │   renders: Stats tab (Recharts) + Query tab (table)
│   │   depends: React, Recharts, useMemoryStats, useMemoryQuery
│   │   size: 466 lines
│   │
│   ├── LexiconBrowser.tsx
│   │   React component
│   │   props: indexFilePath, onLoadIndex
│   │   renders: Search + filter + results table
│   │   depends: React, useLexiconIndex
│   │   size: 320 lines
│   │
│   └── hooks/
│       ├── useMemoryStats.ts
│       │   hook: (filePath, opts) → {data, loading, error, refetch}
│       │   calls: onFetch callback (IDE implements)
│       │   depends: React
│       │   size: 60 lines
│       │
│       ├── useMemoryQuery.ts
│       │   hook: (filePath, opts) → {results, loading, error}
│       │   calls: onExecute callback (IDE implements)
│       │   depends: React
│       │   size: 65 lines
│       │
│       └── useLexiconIndex.ts
│           hook: (filePath) → {index, loading, error}
│           calls: onLoadIndex callback (IDE implements)
│           depends: React
│           size: 50 lines
│
└── cli/
    ├── lexicon-index.ts
    │   CLI: pnpm run lexicon:index
    │   reads: docs/lexicon/entries/*.lexicon.json
    │   outputs: docs/lexicon/lexicon.index.json
    │   size: 100 lines
    │
    ├── validate-lexicon-all.ts
    │   CLI: pnpm run lexicon:validate-all
    │   reads: index.json + entries
    │   outputs: validation report
    │   size: 80 lines
    │
    ├── memory-query.ts
    │   CLI: pnpm run memory:query -- --file ... --json --jsonl
    │   reads: .brain/memory/knowledge.ndjson
    │   filters: contains, concept, operator, date range
    │   size: 120 lines
    │
    ├── memory-stats.ts
    │   CLI: pnpm run memory:stats -- --file ... --since ... --top ...
    │   reads: .brain/memory/knowledge.ndjson
    │   outputs: timeline data, operator counts, concept counts
    │   size: 110 lines
    │
    └── memory-chain.ts
        CLI: pnpm run memory:chain -- --concept webgpu --json
        reads: .brain/memory/knowledge.ndjson
        traces: concept through artifacts
        outputs: ChainLink sequence + belief evolution
        size: 200 lines
```

**Status:** ✅ Complete (1,700+ lines total)

---

### **PACKAGES/ENGINE/** ⚙️ (ECS Runtime)

```typescript
packages/engine/src/
├── index.ts
│   exports: ECSEngine, System, Component, Entity, Snapshot
│
├── engine.ts
│   class ECSEngine {
│     entities: Map<EntityId, Entity>
│     systems: System[]
│     tick(deltaTime)
│     snapshot(): Snapshot
│   }
│
├── contracts/
│   ├── predictor.ts (Prediction interface)
│   ├── collision.ts (Collision detection)
│   ├── protocol.ts (Protocol contract utilities)
│   └── ...
│
├── prediction.ts (state prediction)
├── collision.ts (spatial queries)
├── snapshot.ts (serialize/deserialize)
└── systems/ (ECS systems)
    ├── physics.ts
    ├── rendering.ts
    └── ...
```

**Status:** ✅ Complete

---

### **PACKAGES/BUS/** 🚌 (Events & Routing)

```typescript
packages/bus/src/
├── index.ts
│   exports: Bus, Subscription, RequestResponse
│
├── bus.ts
│   class LocalBus {
│     subscribe<T>(channel, handler): Subscription
│     publish<T>(channel, message): void
│     request<Req, Resp>(channel, message): Promise<Resp>
│   }
│
├── channels.ts (channel definitions)
└── router.ts (message routing)
```

**Status:** ✅ Complete

---

### **PACKAGES/MATH/** 🔢 (Utilities)

```typescript
packages/math/src/
├── index.ts
│   exports: Vector3, randomNormal, RNG, stats
│
├── vector.ts (Vector operations)
├── rng.ts (Seeded random generator)
├── stats.ts (Statistical functions)
└── random.ts (Distribution generators)
```

**Status:** ✅ Complete

---

### **PACKAGES/LEXICON/** 📚 (Index & Query)

```typescript
packages/lexicon/src/
├── index.ts
│   exports: LexiconClient, query
│
├── client.ts
│   class LexiconClient {
│     load(path): LexiconIndex
│     query(term): LexiconEntry[]
│     search(text): LexiconEntry[]
│   }
│
├── schema.ts (LexiconIndex schema)
└── query.ts (Query helpers)
```

**Status:** ✅ Complete

---

## 📱 Application Layer Dependencies

### **APPS/IDE-WEB/** 🖥️ (React UI)

```typescript
apps/ide-web/src/
├── main.tsx
│   entry: React.createRoot(App)
│   depends: App
│
├── App.tsx
│   component: Main IDE container
│   renders: Panels (Memory, Lexicon, Inspector, Preview, Settings)
│   depends: panels/*, BusClient, protocol
│
├── bus/
│   ├── wsClient.ts
│   │   class WSClient {
│   │     connect(url, sessionId)
│   │     send(message): Promise<void>
│   │     subscribe(type, handler)
│   │   }
│   │   depends: protocol (Envelope types)
│   │   size: 150 lines
│   │
│   ├── protocol.ts (local message contracts)
│   └── index.ts (exports)
│
├── ui/
│   ├── panels/
│   │   ├── MemoryPanel.tsx ← PENDING INTEGRATION
│   │   │   source: packages/brain/src/ui/MemoryPanel.tsx
│   │   │   depends: @world-engine/brain/ui, Recharts
│   │   │
│   │   ├── LexiconBrowser.tsx ← PENDING INTEGRATION
│   │   │   source: packages/brain/src/ui/LexiconBrowser.tsx
│   │   │   depends: @world-engine/brain/ui
│   │   │
│   │   ├── InspectorPanel.tsx
│   │   │   renders: Entity tree
│   │   │   depends: engine contracts
│   │   │
│   │   ├── PreviewPanel.tsx
│   │   │   renders: iframe for preview-runtime
│   │   │   depends: preview-runtime protocol
│   │   │
│   │   ├── SettingsPanel.tsx
│   │   │   renders: IDE configuration
│   │   │   depends: (local state)
│   │   │
│   │   └── ChatPanel.tsx
│   │       renders: Chat UI (if integrated)
│   │       depends: ChatClient, protocol
│   │
│   └── styles/
│       └── index.css (dark theme, responsive)
│
├── vite.config.ts
│   defines: build, dev, alias config
│   alias: @world-engine/* → packages/*/src
│
├── package.json
│   deps: react, react-dom, vite, typescript, zod
│   scripts: dev, build, preview
│
└── tsconfig.json
    extends: ../../tsconfig.base.json
```

**Status:** 🔄 Core ready, panels PENDING integration

---

### **APPS/NUCLEUS/** 🌐 (Node Orchestrator)

```typescript
apps/nucleus/src/
├── index.ts
│   entry: server.listen(3000)
│   starts: wsHub
│
├── wsHub.ts
│   class WSHub {
│     connections: Map<sessionId, WebSocket>
│     broadcast(type, message): void
│     route(message): void
│   }
│   depends: ws, protocol
│   size: 300+ lines
│
├── router/
│   ├── index.ts (exports all handlers)
│   │
│   ├── handlers/
│   │   ├── chat.ts
│   │   │   handleChatRequest(message): Promise<ChatResponse>
│   │   │   calls: fetch('http://py-sidecar:8000/chat', ...)
│   │   │   depends: protocol, axios/node-fetch
│   │   │   size: 150 lines
│   │   │
│   │   ├── brainControl.ts
│   │   │   handles: brain.control messages
│   │   │   depends: brain package
│   │   │   size: 100 lines
│   │   │
│   │   ├── brainTrain.ts
│   │   │   handles: brain.train messages
│   │   │   depends: brain package
│   │   │   size: 100 lines
│   │   │
│   │   ├── uee.ts
│   │   │   handles: uee messages
│   │   │   routes to: brain handlers or engine
│   │   │   size: 50 lines
│   │   │
│   │   └── ...other handlers
│   │
│   ├── base.ts (BaseHandler class)
│   └── index.ts
│
├── services/
│   ├── ptyManager.ts (terminal access)
│   ├── fileWatcher.ts (watch src/)
│   └── sessionManager.ts (track sessions)
│
├── package.json
│   deps: express, ws, zod, axios
│   scripts: build, start, dev
│
└── tsconfig.json
    extends: ../../tsconfig.base.json
```

**Status:** 🔄 Core complete, chat handler template ready

---

### **APPS/PREVIEW-RUNTIME/** 👁️ (Iframe Engine)

```typescript
apps/preview-runtime/src/
├── main.ts
│   entry: initialize engine + renderer
│
├── engine.ts
│   initializes: ECSEngine from @world-engine/engine
│   calls: engine.tick() @ 60 FPS
│
├── renderer.ts
│   draws: entities to canvas
│   depends: graphics package
│
├── protocol.ts
│   handles: control messages from IDE
│   receives: snapshot requests
│   size: 100 lines
│
├── index.html
│   <canvas id="game"></canvas>
│
├── vite.config.ts
│   build: iframe bundle
│
└── package.json
    deps: @world-engine/*, vite, typescript
```

**Status:** ✅ Complete

---

### **APPS/PY-SIDECAR/** 🐍 (FastAPI)

```python
apps/py-sidecar/
├── app/
│   └── main.py
│       FastAPI app
│       endpoints:
│         POST /chat (synchronized)
│         POST /chat/stream (NDJSON)
│         GET /healthz
│
├── contracts.py
│   Pydantic models for request/response
│   depends on: packages/protocol (via JSON schema)
│
├── pipeline.py
│   thoughtPipelineExecutor(userMessage)
│   runs 6 stages (from packages/brain/src/thought)
│   depends: contracts, gates, leximorph
│
├── gates.py
│   safeguards: rate limit, size checks, auth
│
├── leximorph.py
│   operator lookup + execution
│   loads: docs/lexicon/lexicon.index.json
│
├── ingest.py
│   data import helpers
│
├── persist.py
│   write to .brain/memory/knowledge.ndjson
│
├── pyproject.toml
│   python = ">=3.9"
│   deps: fastapi, uvicorn, pydantic, zod-equivalent
│
└── package.json
    scripts: dev (uvicorn main:app --reload)
```

**Status:** 🔄 Core complete, handlers ready

---

## 🔗 Cross-Package Imports (Import Audit)

### **From packages/protocol:**

```typescript
// In packages/brain
import { Envelope, ChatRequest, ChatResponse } from "@world-engine/protocol";

// In packages/engine
import { Message, SessionId } from "@world-engine/protocol";

// In apps/nucleus
import { Envelope, Message } from "@world-engine/protocol";

// In apps/ide-web
import { ChatRequest, ChatResponse } from "@world-engine/protocol";
```

✅ **All via @world-engine/\* alias (tsconfig.base.json)**

---

### **From packages/brain/ui:**

```typescript
// In apps/ide-web/src/ui/panels/ (PENDING)
import { MemoryPanel, LexiconBrowser } from "@world-engine/brain/ui";
import { useMemoryStats, useMemoryQuery, useLexiconIndex } from "@world-engine/brain/ui/hooks";
```

✅ **Ready to import, just needs IDE wiring**

---

### **From packages/engine:**

```typescript
// In apps/preview-runtime
import { ECSEngine, System, Entity } from "@world-engine/engine";

// In apps/nucleus (brain handlers)
import { predictState, reconcile } from "@world-engine/engine";
```

✅ **All correct import paths**

---

## 📊 Dependency Graph Summary

```
DEPTH 0 (No dependencies):
  protocol/ ← Zod only

DEPTH 1 (Uses protocol):
  bus/
  engine/
  math/
  lexicon/

DEPTH 2 (Uses depth-1):
  brain/ ← engine, math, lexicon, protocol

DEPTH 3 (Uses depth-2):
  thought/ ← brain, lexicon, protocol
  ui/ ← brain, React, Recharts

DEPTH 4 (Applications):
  ide-web/ ← brain/ui, bus, protocol
  nucleus/ ← bus, protocol, brain
  preview-runtime/ ← engine, protocol
  py-sidecar/ ← protocol (via HTTP schema)
```

**Key Property:** ✅ **No circular dependencies** (DAG structure maintained)

---

## 📝 Documentation File Map

```
docs/
├── SYSTEM_AUDIT_2_0.md ← You are here
│   Purpose: Complete system mapping + architecture
│   Audience: Developers, architects
│   Size: 1000+ lines
│
├── BRAIN_CHAT_INTEGRATION.md
│   Purpose: Chat system step-by-step setup
│   Audience: Backend developers
│   Size: 500+ lines
│
├── MEMORY_PANEL_INTEGRATION.md
│   Purpose: Wire MemoryPanel into IDE
│   Audience: Frontend developers
│   Size: 300+ lines
│
├── MEMORY_CHAIN_GUIDE.md
│   Purpose: Use memory:chain CLI
│   Audience: Users, testers
│   Size: 200+ lines
│
├── LEXICON_BROWSER_INTEGRATION.md
│   Purpose: Wire LexiconBrowser into IDE
│   Audience: Frontend developers
│   Size: 300+ lines
│
├── BRAIN_SYSTEM.md
│   Purpose: Neural network architecture
│   Audience: ML developers
│   Size: 800+ lines
│
├── ARCHITECTURE.md
│   Purpose: High-level system design
│   Audience: Everyone
│   Size: 300+ lines
│
├── INTEGRATION_TESTING_GUIDE.md
│   Purpose: E2E test procedures
│   Audience: QA, testers
│   Size: 400+ lines
│
└── spec/
    └── ARCHITECTURE.md
        ECS specification + protocol design
```

---

## 🎯 Integration Readiness Checklist

### **Ready Now (Copy/Paste):**

- [x] MemoryPanel.tsx → apps/ide-web/src/ui/panels/
- [x] LexiconBrowser.tsx → apps/ide-web/src/ui/panels/
- [x] useMemoryStats hook → apps/ide-web/src/hooks/
- [x] useMemoryQuery hook → apps/ide-web/src/hooks/
- [x] useLexiconIndex hook → apps/ide-web/src/hooks/

### **Ready Now (Wire Callbacks):**

- [ ] IDE: implement onInvokeMemoryStatsCli (call pnpm run memory:stats)
- [ ] IDE: implement onInvokeMemoryQueryCli (call pnpm run memory:query)
- [ ] IDE: implement onLoadIndex (read docs/lexicon/lexicon.index.json)
- [ ] IDE: add Recharts dependency (pnpm add recharts)

### **Ready Now (Layout):**

- [ ] Add MemoryPanel to main IDE layout
- [ ] Add LexiconBrowser to main IDE layout
- [ ] Add tab/panel switcher (if desired)

### **Blocked On:**

- Nothing! All dependencies satisfied.

---

## 🚀 File Organization Best Practices

```
When adding new AI-related features, follow:

packages/
  brain/
    src/
      concept-name/          ← New feature = new folder
        ├── schema.ts        ← Zod schemas first
        ├── executor.ts      ← Logic implementation
        ├── cli.ts           ← Optional CLI tool
        ├── ui.tsx           ← Optional React component
        └── index.ts         ← Exports

export from:
  ├── packages/brain/src/index.ts (add: export * from "./concept-name")
  ├── packages/brain/src/ui/index.ts (if UI component)
  └── package.json (if new CLI script)
```

---

**End of Connectivity Map**
