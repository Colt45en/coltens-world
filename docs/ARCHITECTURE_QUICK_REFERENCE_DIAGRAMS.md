# 📈 System Architecture Quick Reference Diagrams

**Purpose:** Visual reference for system design at a glance
**Updated:** February 12, 2026

---

## 1️⃣ Complete System Topology

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        WORLD ENGINE IDE                                 │
│  Deterministic Game Engine + AI Thought Brain                           │
└─────────────────────────────────────────────────────────────────────────┘

                            🖥️ IDE WEB (React)
                    ┌──────────────────────────┐
                    │ Panels                   │
                    │ ├─ Memory Panel          │
                    │ ├─ Lexicon Browser       │
                    │ ├─ Inspector             │
                    │ ├─ Preview Frame         │
                    │ └─ Chat (optional)       │
                    └───────────┬──────────────┘
                                │ WebSocket
                                ▼
                    ┌──────────────────────────┐
                    │ 🌐 NUCLEUS (Node)        │
                    │ ├─ WS Hub                │
                    │ ├─ Route Handlers        │
                    │ └─ Services              │
                    └───────────┬──────────────┘
                                │ HTTP POST
                                ▼
        ┌───────────────────────────────────────────────┐
        │      🐍 PYTHON SIDECAR (FastAPI)             │
        │  ┌──────────────────────────────────────┐   │
        │  │ 6-Stage Thought Pipeline             │   │
        │  │ 1. Concept → Term extraction         │   │
        │  │ 2. Observe → Multi-perspective       │   │
        │  │ 3. Question → Challenge assumptions  │   │
        │  │ 4. Reason → Build evidence           │   │
        │  │ 5. Decide → Select actions           │   │
        │  │ 6. Optimize → Refine output          │   │
        │  └──────────────────────────────────────┘   │
        │           ↓              ↓                   │
        │     ┌─────────────┐ ┌──────────────┐       │
        │     │   Lexicon   │ │ Memory Store │       │
        │     │   (index)   │ │ (NDJSON)     │       │
        │     └─────────────┘ └──────────────┘       │
        └───────────────────────────────────────────────┘
                                △
                                │ (results)
                                │
        ┌───────────────────────────────────────────────┐
        │     👁️ PREVIEW RUNTIME (Iframe)              │
        │  ┌──────────────────────────────────────┐   │
        │  │ ECS Engine (60 FPS tick)             │   │
        │  │ ├─ Systems (physics, collision, etc) │   │
        │  │ ├─ Components (transform, sprite)    │   │
        │  │ └─ Entities (game objects)           │   │
        │  └──────────────────────────────────────┘   │
        │           ↓ (snapshots, screenshots)        │
        │  ┌──────────────────────────────────────┐   │
        │  │ Renderer (Canvas 2D)                 │   │
        │  └──────────────────────────────────────┘   │
        └───────────────────────────────────────────────┘
```

---

## 2️⃣ Message Flow Sequence

```
USER MESSAGE: "Tell me about WebGPU"
    ▼
IDE React Component (ChatUI.tsx)
    ├─ Capture input text
    ├─ Validate (not empty)
    ├─ Create ChatRequest envelope
    │   {
    │     type: "chat.request",
    │     userMessage: "Tell me about WebGPU",
    │     sessionId: "user-123",
    │     timestamp: 2026-02-12T15:30:00Z
    │   }
    └─ WebSocket → Nucleus
        ▼
Nucleus WSHub (wsHub.ts)
    ├─ Receive on connection
    ├─ Parse envelope
    ├─ Validate type = "chat.request"
    └─ Route to: routeHandler["chat.request"]
        ▼
Route Handler (apps/nucleus/src/router/handlers/chat.ts)
    ├─ Validate envelope with Zod
    ├─ Extract: userMessage, artifacts[], sessionId
    ├─ Build HTTP POST body
    │   {
    │     userMessage: "Tell me about WebGPU",
    │     currentArtifacts: [],
    │     sessionId: "user-123"
    │   }
    └─ fetch('http://localhost:8000/chat', {method: 'POST', body})
        ▼
Python Sidecar FastAPI /chat endpoint (apps/py-sidecar/app/main.py)
    ├─ Receive POST
    ├─ Validate Pydantic schema
    ├─ Create ThoughtState
    │   {
    │     userMessage: "Tell me about WebGPU",
    │     stage: "concept",
    │     concepts: [],
    │     ...
    │   }
    └─ Execute thoughtPipeline(state)
        ▼
STAGE 1: CONCEPT (packages/brain/src/thought/stages/concept.ts)
    ├─ Extract: goal = "explain WebGPU"
    ├─ Parse terms: ["WebGPU", "graphics API", "compute"]
    ├─ Update state.concepts[] and state.stage = "observe_perspective"
    └─ Continue to next stage
        ▼
STAGE 2: OBSERVE_PERSPECTIVE (packages/brain/src/thought/stages/perspective.ts)
    ├─ View from: developer, artist, researcher angles
    ├─ Query lexicon: find relevant operators
    │   Lexicon.query("gpu_api_operator", "graphics")
    │   → Returns: definitions, examples, constraints
    ├─ Update state.observations[] and stage = "self_questioning"
    └─ Continue to next stage
        ▼
STAGE 3: SELF_QUESTIONING (packages/brain/src/thought/stages/self-questioning.ts)
    ├─ Challenge assumptions:
    │   "Is WebGPU right for all use cases?"
    │   "What about compatibility?"
    ├─ Generate alternatives: ["Vulkan", "Metal", "DirectX"]
    ├─ Update state.alternatives[] and stage = "reasoning"
    └─ Continue to next stage
        ▼
STAGE 4: REASONING (packages/brain/src/thought/stages/reasoning.ts)
    ├─ Gather facts from lexicon
    ├─ Build evidence chains
    ├─ Select reasoning mode: "inductive" (examples → pattern)
    ├─ Update state and stage = "decision"
    └─ Continue to next stage
        ▼
STAGE 5: DECISION (packages/brain/src/thought/stages/decision.ts)
    ├─ Evaluate tradeoffs
    ├─ Select final answer
    ├─ Generate response summary
    ├─ Update state.finalAnswer and stage = "optimize"
    └─ Continue to next stage
        ▼
STAGE 6: OPTIMIZE (packages/brain/src/thought/stages/optimize.ts)
    ├─ Remove redundancy
    ├─ Add citations
    ├─ Mark memory: persist/ephemeral/doNotStore
    ├─ Create KnowledgeArtifact
    │   {
    │     id: "artifact-uuid",
    │     userGoal: "Tell me about WebGPU",
    │     facts: ["WebGPU is a portable graphics API", ...],
    │     decision: "WebGPU is best for cross-platform",
    │     responseSummary: "WebGPU offers...",
    │     operatorsUsed: ["gpu_api_operator", "comparison_operator"],
    │     memory: {
    │       persist: ["webgpu_definition"],
    │       ephemeral: [],
    │       doNotStore: []
    │     }
    │   }
    └─ End of pipeline
        ▼
Memory Store (packages/brain/src/memory/memoryStore.ts)
    ├─ Serialize artifact to JSON
    ├─ Append to .brain/memory/knowledge.ndjson
    │   {one artifact per line}
    │   {one artifact per line}
    │   ...
    └─ Return to sidecar
        ▼
Python Sidecar Response (apps/py-sidecar/app/main.py)
    ├─ Create ChatResponse envelope
    │   {
    │     type: "chat.response",
    │     summary: "WebGPU is a portable graphics and compute...",
    │     artifacts: [KnowledgeArtifact],
    │     citations: [{term: "WebGPU", source: "lexicon"}],
    │     timestamp: 2026-02-12T15:30:05Z
    │   }
    └─ Return HTTP 200 with body
        ▼
Nucleus Handler (apps/nucleus/src/router/handlers/chat.ts)
    ├─ Receive response
    ├─ Wrap in ChatResponse envelope
    └─ Broadcast via wsHub.broadcast("chat.response", message)
        ▼
IDE WebSocket Client (apps/ide-web/src/bus/wsClient.ts)
    ├─ Receive message on socket
    ├─ Parse envelope and validate
    ├─ Emit to React subscribers
        ▼
IDE React Component (ChatUI.tsx)
    ├─ Receive in useEffect listener
    ├─ Update state.messages[]
    │   {role: "assistant", content: "WebGPU is a portable...", citations: [...]}
    ├─ Re-render message list
    └─ Display to user ✓

OPTIONAL: User Opens Memory Panel
    ├─ Click "Memory" tab
    ├─ MemoryPanel component mounts
    ├─ Call hook.onInvokeMemoryStatsCli({since: "2d", top: 25})
    │   → Invokes: pnpm run memory:stats -- --file ... --json
    │   → Returns: Chart data (artifacts per day, operators used, concepts)
    ├─ Render Recharts TimelineChart with data
    └─ User sees graph of recent thoughts

OPTIONAL: User Opens Lexicon Browser
    ├─ Click "Lexicon" tab
    ├─ LexiconBrowser component mounts
    ├─ Call hook.onLoadIndex("docs/lexicon/lexicon.index.json")
    │   → Reads file from disk
    │   → Returns: LexiconIndex with all entries
    ├─ Display: searchable, filterable table of operators
    ├─ User searches: "webgpu"
    │   → Filters: term.includes("webgpu") || process_tag.includes("webgpu")
    └─ Results show: the GPU API operators + their definitions
```

---

## 3️⃣ Data Structure Hierarchy

```
┌─────────────────────────────────────────────────────────┐
│              KNOWLEDGE ARTIFACT                         │
│  (Output of 6-stage thought pipeline)                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  id: string (stable UUID)                              │
│  createdAt: ISO8601 DateTime                            │
│                                                         │
│  ┌─── INPUT ───────────────────────────────────────┐   │
│  │ userGoal: string                  ✓ Required    │   │
│  │ constraints: string[]             ✓ Required    │   │
│  │ tradeoffPriority: string[]        ✓ Required    │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─── THINKING ────────────────────────────────────┐   │
│  │ facts: string[]                   ✓ Evidence    │   │
│  │ assumptions: string[]             ✓ Premises    │   │
│  │ uncertainties: string[]           ✓ Gaps        │   │
│  │ selectedReasoningMode: enum       ✓ Validated   │   │
│  │   ("deductive"|"inductive"|       │   {mode}    │   │
│  │    "abductive"|"mixed")           │             │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─── OUTPUT ──────────────────────────────────────┐   │
│  │ decision: string                  ✓ What we did │   │
│  │ acceptanceTestsOrMetrics: string[] ✓ Validation │   │
│  │ responseSummary: string           ✓ To user     │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─── TRACEABILITY ────────────────────────────────┐   │
│  │ operatorsUsed: StableId[]         ✓ Which tools │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─── MEMORY ──────────────────────────────────────┐   │
│  │ memory: {                                        │   │
│  │   persist: string[]              ✓ Long-term    │   │
│  │   ephemeral: string[]            ✓ Session-only │   │
│  │   doNotStore: string[]           ✓ Privacy      │   │
│  │ }                                                │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
              ↓ Appended to NDJSON
     .brain/memory/knowledge.ndjson
              ↓ (one per line)
        {artifact 1}
        {artifact 2}
        {artifact 3}
        ...
```

---

## 4️⃣ 6-Stage Pipeline Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    THOUGHT PIPELINE                              │
│  Input: userMessage: string                                      │
│  Output: KnowledgeArtifact                                        │
└──────────────────────────────────────────────────────────────────┘

    INPUT: "Tell me about WebGPU"
      ↓
      ↓
┌─────────────────────────────────────────────────────────────────┐
│ STAGE 1: CONCEPT EXTRACTION                                     │
├─────────────────────────────────────────────────────────────────┤
│ Purpose: Identify key terms, goals, domains                     │
│                                                                 │
│ Input:  ThoughtState { userMessage, stage: "concept", ... }    │
│ Logic:  NLP → extract terms, identify domain                    │
│ Output: ThoughtState.concepts[] = ["WebGPU", "GPU", "API"]      │
│         ThoughtState.stage = "observe_perspective"              │
│                                                                 │
│ File: packages/brain/src/thought/stages/concept.ts             │
└─────────────────────────────────────────────────────────────────┘
      ↓
      ↓
┌─────────────────────────────────────────────────────────────────┐
│ STAGE 2: PERSPECTIVE OBSERVATION                                │
├─────────────────────────────────────────────────────────────────┤
│ Purpose: View from multiple angles (developer, user, architect) │
│                                                                 │
│ Input:  ThoughtState { concepts[], stage: "observe_..." }      │
│ Logic:  For each perspective:                                   │
│           • How does developer see this?                        │
│           • How does end-user see this?                         │
│           • How does architect see this?                        │
│ Output: ThoughtState.observations[] populated                   │
│         ThoughtState.stage = "self_questioning"                 │
│                                                                 │
│ File: packages/brain/src/thought/stages/perspective.ts         │
│                                                                 │
│ LEXICON QUERY HAPPENS HERE:                                     │
│   Find operators: gpu_api_operator, comparison_operator, etc    │
└─────────────────────────────────────────────────────────────────┘
      ↓
      ↓
┌─────────────────────────────────────────────────────────────────┐
│ STAGE 3: SELF-QUESTIONING & ALTERNATIVES                        │
├─────────────────────────────────────────────────────────────────┤
│ Purpose: Challenge assumptions, generate alternatives           │
│                                                                 │
│ Input:  ThoughtState { observations[], stage: "self_..." }     │
│ Logic:  Ask hard questions:                                     │
│           • Is WebGPU the best approach?                        │
│           • What about Vulkan/Metal/DirectX?                    │
│           • What about compatibility?                           │
│ Output: ThoughtState.alternatives[] populated                   │
│         ThoughtState.discriminatingQuestions[] = questions      │
│         ThoughtState.stage = "reasoning"                        │
│                                                                 │
│ File: packages/brain/src/thought/stages/self-questioning.ts    │
└─────────────────────────────────────────────────────────────────┘
      ↓
      ↓
┌─────────────────────────────────────────────────────────────────┐
│ STAGE 4: EVIDENCE GATHERING & REASONING                         │
├─────────────────────────────────────────────────────────────────┤
│ Purpose: Build logical chains, select reasoning mode            │
│                                                                 │
│ Input:  ThoughtState { alternatives[], stage: "reasoning" }    │
│ Logic:  For each alternative:                                   │
│           • Gather evidence (from lexicon, facts)               │
│           • Build chains (e.g., A → B → C)                     │
│           • Evaluate strength                                   │
│ Mode Selection:                                                 │
│   • Deductive: Specific → General (rules → conclusions)         │
│   • Inductive: Specific → General (examples → patterns)         │
│   • Abductive: Observation → Best Explanation                  │
│   • Mixed: Combination of modes                                 │
│                                                                 │
│ Output: ThoughtState.evidence[] populated                       │
│         ThoughtState.reasoningMode = selected mode              │
│         ThoughtState.stage = "decision"                         │
│                                                                 │
│ File: packages/brain/src/thought/stages/reasoning.ts           │
└─────────────────────────────────────────────────────────────────┘
      ↓
      ↓
┌─────────────────────────────────────────────────────────────────┐
│ STAGE 5: DECISION MAKING                                        │
├─────────────────────────────────────────────────────────────────┤
│ Purpose: Select best action/answer based on evidence            │
│                                                                 │
│ Input:  ThoughtState { evidence[], reasoning[], stage: "..." }  │
│ Logic:  Weighted evaluation:                                     │
│           1. Score each alternative on tradeoff axes            │
│           2. Apply user priorities                              │
│           3. Select winner + rationale                          │
│         Generate response:                                       │
│           • Write summary of decision                           │
│           • Include citations (lexicon refs)                    │
│                                                                 │
│ Output: ThoughtState.finalAnswer = selected decision            │
│         ThoughtState.constraints & tradeoffs = justified        │
│         ThoughtState.stage = "optimize"                         │
│                                                                 │
│ File: packages/brain/src/thought/stages/decision.ts            │
└─────────────────────────────────────────────────────────────────┘
      ↓
      ↓
┌─────────────────────────────────────────────────────────────────┐
│ STAGE 6: OPTIMIZATION & MEMORY PLANNING                         │
├─────────────────────────────────────────────────────────────────┤
│ Purpose: Polish output, mark what to remember                   │
│                                                                 │
│ Input:  ThoughtState { finalAnswer, all state, stage: "opt.." } │
│ Logic:  Polish:                                                  │
│           • Remove redundancy                                    │
│           • Add citations to operators used                      │
│           • Check for logical gaps                              │
│         Planning:                                                │
│           • What facts should we persist? (learning)            │
│           • What should stay ephemeral? (context)               │
│           • What should never store? (privacy)                  │
│                                                                 │
│ Output: KnowledgeArtifact created:                              │
│         {                                                        │
│           userGoal, constraints, tradeoffs,                     │
│           facts, assumptions, uncertainties,                    │
│           selectedReasoningMode, decision,                      │
│           responseSummary, operatorsUsed,                       │
│           memory: {persist, ephemeral, doNotStore}              │
│         }                                                         │
│                                                                 │
│ File: packages/brain/src/thought/stages/optimize.ts             │
└─────────────────────────────────────────────────────────────────┘
      ↓
      ↓
    RESULT: KnowledgeArtifact
      • Append to .brain/memory/knowledge.ndjson
      • Return summary to user via ChatResponse
      • Ready to be analyzed by Memory Panel + Memory Chain CLI
```

---

## 5️⃣ UI Components Connection

```
IDE Web App
│
├─ MemoryPanel (React component)
│  ├─ Props:
│  │  ├─ memoryFilePath: ".brain/memory/knowledge.ndjson"
│  │  ├─ onInvokeMemoryStatsCli: callback
│  │  └─ onInvokeMemoryQueryCli: callback
│  │
│  ├─ Tabs:
│  │  ├─ STATS TAB
│  │  │  ├─ useMemoryStats() hook
│  │  │  │  └─ calls: onInvokeMemoryStatsCli(opts)
│  │  │  │     → Child invokes: pnpm run memory:stats -- --json
│  │  │  ├─ Renders: LineChart (artifacts/day timeline)
│  │  │  ├─ Renders: BarChart (top operators used)
│  │  │  └─ Renders: BarChart (top concepts mentioned)
│  │  │
│  │  └─ QUERY TAB
│  │     ├─ useMemoryQuery() hook
│  │     │  └─ calls: onInvokeMemoryQueryCli(opts)
│  │     │     → Child invokes: pnpm run memory:query -- --json
│  │     ├─ Search box (text input)
│  │     ├─ Operator filter (dropdown)
│  │     └─ Results table
│  │        ├─ Columns: goal, decision, operators, timestamp
│  │        └─ Sortable, filterable
│  │
│  └─ Integration:
│     IDE provides:
│       onInvokeMemoryStatsCli = (opts) => {
│         const result = await exec(`pnpm run memory:stats -- ${opts}`);
│         return JSON.parse(result);
│       }
│
├─ LexiconBrowser (React component)
│  ├─ Props:
│  │  ├─ indexFilePath: "docs/lexicon/lexicon.index.json"
│  │  └─ onLoadIndex: callback
│  │
│  ├─ Features:
│  │  ├─ useLexiconIndex() hook
│  │  │  └─ calls: onLoadIndex(path)
│  │  │     → Child: readFile("docs/lexicon/lexicon.index.json")
│  │  ├─ Search box (term, canonical_term, process_tag)
│  │  ├─ Filter dropdowns:
│  │  │  ├─ operator_class (prompt.primitive, prompt.operator, etc)
│  │  │  └─ type (action_operator, etc)
│  │  └─ Results table
│  │     ├─ Columns: Term, Process Tag, Type, Operator Class, File
│  │     ├─ Stats banner: "1,247 entries, generated 2h ago"
│  │     └─ Sortable, clickable (open source file)
│  │
│  └─ Integration:
│     IDE provides:
│       onLoadIndex = (path) => {
│         const content = readFileSync(path, 'utf8');
│         return JSON.parse(content);
│       }
│
└─ Inspector Panel (existing)
   Preview Frame Panel (existing)
   Settings Panel (existing)
   Chat Panel (if integrated)
```

---

## 6️⃣ CLI Tools Summary

```
PACKAGE.JSON SCRIPTS (in monorepo root):

pnpm run lexicon:index
  └─ Runs: packages/brain/src/cli/lexicon-index.ts
  ├─ Reads: docs/lexicon/entries/*.lexicon.json
  ├─ Outputs: docs/lexicon/lexicon.index.json
  └─ Purpose: Generate searchable index of all operators

pnpm run lexicon:validate-all
  └─ Runs: packages/brain/src/cli/validate-lexicon-all.ts
  ├─ Reads: lexicon.index.json + all entry files
  ├─ Outputs: validation report to console
  └─ Purpose: Ensure all entries conform to schema

pnpm run memory:query -- [options]
  └─ Runs: packages/brain/src/cli/memory-query.ts
  ├─ Options:
  │  ├─ --file <path> (default: .brain/memory/knowledge.ndjson)
  │  ├─ --contains <text> (search in decision + summary)
  │  ├─ --operator <name> (filter by operatorsUsed)
  │  ├─ --concept <name> (filter by facts mentioning concept)
  │  ├─ --since <date> (ISO8601, e.g., 2026-02-01)
  │  ├─ --until <date>
  │  ├─ --limit <n> (max results, default 50)
  │  ├─ --json (output full artifacts as JSON)
  │  └─ --jsonl (output one result per line)
  ├─ Output: Table (console) or JSON or JSONL
  └─ Purpose: Query memory artifacts by multiple filters

pnpm run memory:stats -- [options]
  └─ Runs: packages/brain/src/cli/memory-stats.ts
  ├─ Options:
  │  ├─ --file <path> (default: .brain/memory/knowledge.ndjson)
  │  ├─ --since <date> (default: 30 days ago)
  │  ├─ --until <date>
  │  ├─ --top <n> (max results, default: 20)
  │  ├─ --json (output stats as JSON)
  │  └─ --jsonl (output per-line stats)
  ├─ Output:
  │  ├─ Timeline: artifacts per day
  │  ├─ Top operators: most frequently used
  │  └─ Top concepts: most frequently mentioned
  └─ Purpose: Aggregate statistics for visualization

pnpm run memory:chain -- [options]
  └─ Runs: packages/brain/src/cli/memory-chain.ts
  ├─ Options:
  │  ├─ --file <path> (default: .brain/memory/knowledge.ndjson)
  │  ├─ --concept <name> (required: e.g., "webgpu")
  │  ├─ --json (output full MemoryChain structure)
  │  └─ --jsonl (output ChainLink per line)
  ├─ Output:
  │  ├─ Readable timeline of how concept evolved
  │  ├─ Links: first mention → reasoning → decision → outcome
  │  ├─ Belief evolution: before/after each mention
  │  └─ Confidence scoring (0.0–1.0)
  └─ Purpose: Trace concept development over time

EXAMPLE USAGE:

# Generate lexicon index
$ pnpm run lexicon:index
✓ Generated: docs/lexicon/lexicon.index.json (1247 operators)

# Search memory for decisions about WebGPU
$ pnpm run memory:query -- --concept webgpu --json
[
  {
    "id": "artifact-xyz",
    "userGoal": "Tell me about WebGPU",
    "decision": "WebGPU is portable compute API",
    "operatorsUsed": ["gpu_api_operator"],
    ...
  }
]

# Get stats (ready for Recharts)
$ pnpm run memory:stats -- --since 2026-02-05 --json
{
  "timeline": [
    {"date": "2026-02-05", "count": 3},
    {"date": "2026-02-06", "count": 7},
    ...
  ],
  "topOperators": [
    {"operator": "reasoning_operator", "count": 12},
    ...
  ]
}

# Trace concept evolution
$ pnpm run memory:chain -- --concept webgpu --json
{
  "concept": "webgpu",
  "chainLength": 5,
  "links": [
    {
      "artifactId": "artifact-1",
      "concept": "webgpu",
      "decision": "investigate WebGPU",
      "beliefBefore": 0.3,
      "beliefAfter": 0.7,
      "confidence": 0.65
    },
    ...
  ],
  "beliefEvolution": [0.3, 0.5, 0.7, 0.8, 0.85]
}

# Streaming mode (for real-time UI)
$ pnpm run memory:stats -- --jsonl | jq '.operator'
reasoning_operator
gpu_api_operator
comparison_operator
...
```

---

## 7️⃣ File Size & Complexity Matrix

```
Package/App              Files  LOC    Complexity   Status
─────────────────────────────────────────────────────────────
protocol                   8   700    Low          ✅ Complete
bus                         5   300    Medium       ✅ Complete
engine                     10  1200    High         ✅ Complete
math                        5   400    Medium       ✅ Complete
brain (neural)              3   760    High         ✅ Complete
brain (thought)             8  1200    Medium       ✅ Complete
brain (memory)              1   150    Low          ✅ Complete
brain (lexicon)             2   200    Low          ✅ Complete
brain (ui)                  6   850    Medium       ✅ Complete
brain (cli)                 5   550    Low          ✅ Complete
─────────────────────────────────────────────────────────────
  PACKAGES TOTAL          53  6310    Mixed        ✅ Complete
─────────────────────────────────────────────────────────────
ide-web                    15  2000    Medium       🔄 Pending
nucleus                    12  1500    High         🔄 Pending
preview-runtime            10  1200    Medium       ✅ Complete
sim-server                 10  1500    High         ✅ Complete
py-sidecar                 12  2000    High         🔄 Pending
─────────────────────────────────────────────────────────────
  APPS TOTAL              59  8200    Mixed        🔄 Mixed
─────────────────────────────────────────────────────────────
Documentation             20  5000+   Low          ✅ Complete
─────────────────────────────────────────────────────────────
GRAND TOTAL             132 19510+   Mixed        ✅ 95%

Legend:
✅ Complete = Ready to use
🔄 Pending = Ready, needs IDE wiring
⚠️  WIP = In progress
```

---

## 8️⃣ Dependency Injection Pattern

```
How IDE integrates memory/lexicon CLIs without importing them:

┌─────────────────────────────────────────────────────────────┐
│  IDE COMPONENT (MemoryPanel.tsx)                            │
│                                                             │
│  Props:                                                     │
│    onInvokeMemoryStatsCli?: (opts) => Promise<data>        │
│                                                             │
│  Usage:                                                     │
│    const data = await onInvokeMemoryStatsCli({             │
│      since: "7d",                                           │
│      top: 25,                                               │
│      json: true                                             │
│    });                                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
              ▲
              │ (IDE injects callback)
              │
┌─────────────────────────────────────────────────────────────┐
│  IDE PARENT (apps/ide-web/src/App.tsx)                      │
│                                                             │
│  Code:                                                      │
│    const onInvokeMemoryStatsCli = async (opts) => {         │
│      const cmd = `pnpm run memory:stats -- \                │
│        --file ${opts.file} \                                │
│        --since ${opts.since} \                              │
│        --json`;                                             │
│      const result = await exec(cmd);  // spawn subprocess   │
│      return JSON.parse(result);                             │
│    };                                                       │
│                                                             │
│    return <MemoryPanel                                      │
│      onInvokeMemoryStatsCli={onInvokeMemoryStatsCli}       │
│    />;                                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘

Benefits:
✅ Components have no hard dependency on CLI
✅ IDE decides HOW to invoke (shell, HTTP, IPC, etc)
✅ Easy to mock for testing
✅ Loose coupling = easy to refactor
```

---

**End of Quick Reference Diagrams**
