# World Engine 1.0 - Hardening Audit

**Document Type:** Code Review + Architectural Risk Assessment
**Date:** February 10, 2026
**Status:** Ready for Phase 1 Implementation

---

## 📊 Executive Summary

**Overall Assessment:** ✅ **Solid architecture. Ready for hardening.**

Your monorepo has the right fundamental shape:

- Clear spine (Nucleus orchestrator)
- Proper client/server separation
- Layered package dependencies
- BusEnvelope as universal transport

**But:** You're missing **security gates, determinism guarantees, and contract enforcement** that prevent cascading failures at scale.

**Impact:** Without these, your last 240 compile errors will resurface as **runtime chaos** when SimRunner diverges, UIhandlers fail validation, or brain_train starves WS heartbeats.

**Fix timeline:** Phase 1 (2-3 days), Phase 2 (1 week), Phase 3 (polish).

---

## ✅ What's Structurally Solid

### A. Nucleus as Orchestration Spine

| Aspect                   | Status | Why It Works                                      |
| ------------------------ | ------ | ------------------------------------------------- |
| Single authority         | ✅     | WS hub + routing + subprocess control centralized |
| Role-based routing       | ✅     | `from.role` drives broadcast logic                |
| File watcher integration | ✅     | Chokidar watches; broadcasts to IDE               |
| PTY manager              | ✅     | Veno handles terminal lifecycle                   |
| Task dispatch            | ✅     | UEE router maps task.type → handler               |

**Risk level:** LOW — This is the right pattern. Just needs auth gates.

### B. BusEnvelope as Universal Transport

Current fields:

- `v` (version)
- `id` (correlation)
- `type` (routing key)
- `ts` (ordering)
- `from` (role identity)
- `sessionId` (session tracking)
- `payload` (typed)

**Why it works:** One format + routable payloads = predictable debugging + stable schema.

**Risk level:** MEDIUM — Missing auth/capability/replay guards.

### C. Package Layering

```
✅ math          (pure, no deps)
    ↑
✅ protocol      (schemas, contracts, validation)
    ↑
✅ engine        (depends on math, protocol contracts)
✅ brain         (depends on math, engine)
✅ graphics      (depends on engine, three.js)
    ↑
✅ bus           (event system, independent)
✅ codex         (manifest registry)
✅ lexicon       (knowledge DB)
✅ assets        (loader, caching)
    ↑
✅ apps          (nucleus, ide, preview, sidecar)
```

**Why it works:** No circular deps, clear data flow, testable layers.

**Risk level:** LOW — Well structured. Just needs linked type checking.

---

## ❌ Biggest Gaps (Will Bite at Scale)

### Gap 1: No Envelope Authenticity or Trust Model

**Current State:**

```typescript
type BusEnvelope = {
  v: number;
  id: string;
  type: string;
  ts: number;
  from: { role: Role; instanceId: string }; // ← Declared, not proven
  sessionId: string;
  payload: unknown;
};
```

**Problems:**

1. `from.role` is **client-declared** → any WS client can spoof "nucleus"
2. No replay protection → same message re-sent twice executes twice
3. No rate limiting → malicious client can spam `brain_train` tasks
4. No capability gating → IDE could theoretically invoke admin-only ops
5. `payload: unknown` at boundary → no validation before routing

**What happens at scale:**

- Browser tab XSS injects fake "nucleus" messages → state corruption
- Attacker replays captured session → actions execute out-of-order
- Script sends 1000 `brain_train` requests/sec → Nucleus CPU spikes, WS dies

**Minimal fix (adds real safety):**

Add to BusEnvelope:

```typescript
type BusEnvelope<T extends string, P> = {
  v: number;
  id: string;
  nonce: string; // ← Random, never seen before
  type: T;
  ts: number;
  from: { role: Role; instanceId: string };
  sessionId: string;
  auth: {
    token?: string; // HMAC or JWT (session bound)
    capabilities?: string[]; // What this session can do
  };
  payload: P;
};
```

**Enforcement rule:**

```
1. Verify nonce not in (session.usedNonces cache from last 60s)
2. Verify token matches session (or reject with 401)
3. Verify task.type is in auth.capabilities (role-based)
4. Add rate limit per (sessionId, type)
5. Reject if payload size > 10MB (guard against zip bombs)
```

**Effort:** 2-3 hours (validation layer + session store)
**Risk level:** 🔴 **CRITICAL** — Security + correctness bottleneck

---

### Gap 2: Deterministic Simulation Boundary Not Fully Defined

**Current State:**

You say "deterministic ECS ticks" — good intent. But determinism **collapses** unless you pin:

- RNG source strategy
- Fixed-step tick policy
- State mutation isolation
- Input ordering

**Symptoms of breakage:**

```
1. Preview predicts frame N+1 using Math.random() ← different every run
2. Nucleus replays with different RNG seed ← divergence
3. SimRunner does side-write outside ECS.update() ← inconsistent state
4. Inputs arrive out-of-order ← tick is non-deterministic
```

**Current RNG in brain/network.ts:**

```typescript
// ✅ Good
const randomNormal = () => {
  /* Box-Muller with SeededRNG */
};

// ❌ Risk
// BUT: if you ever accidentally call Math.random() anywhere, it breaks
```

**Minimal fix (4 rules to lock down):**

```
RULE 1: All randomness from SeededRNG only
  Grep for "Math.random" → should be 0 results
  Grep for "crypto.random" → should be only in nonce generation
  Action: tsc pass with plugin that flags Math.random() as error

RULE 2: Fixed-step tick + input ordering
  Nucleus: accumulate dt, dispatch N fixed-step ticks
  Order: [inputs with earliest ts] → [simulate 16ms frame]
  Never: variable-step ticks or reordered inputs

RULE 3: No state mutations outside ECS update pass
  System methods only get entities[]; can't write globals
  SimRunner state changes only via engine APIs
  Preview prediction only reads current state + input

RULE 4: Tick scheduling deterministic
  Same input sequence + same RNG seed → same output forever
  Test: record 100 ticks of input, replay 3x, assert bytes match
```

**Effort:** 8-10 hours (contracts + tests)
**Risk level:** 🔴 **CRITICAL** — Breaks multiplayer sync + replay

---

### Gap 3: UEE Handler Responses Are Not Contract-Complete

**Current State:**

Handlers return ad-hoc responses:

```typescript
// brain_control returns
{ ok: true, actions: [...], reward: X, telemetry: {...} }

// brain_train returns
{ ok: false, taskId, errors }

// Both inconsistent, no error shape contracts
```

**Problem:**

- IDE can't build stable panels (different shapes per handler)
- Error handling is per-handler oneoff logic
- Telemetry/audit trail is informal
- Progress streaming impossible (no standard format)

**What happens at scale:**

- IDE code becomes 30 if/else chains checking every handler response shape
- Debugging "why did this task fail?" requires handler-specific logic
- Long tasks have no progress feedback (UI shows spinning wheel for 30 seconds)

**Minimal fix:**

Define **universal response contract**:

```typescript
type UEEResponse = {
  ok: boolean;
  taskId: string;
  taskType: string; // ← Echo for validation
  mode: "apply" | "plan" | "dryrun";
  durationMs: number;
  warnings: Array<{
    code: string;
    message: string;
    field?: string;
  }>;
  errors: Array<{
    code: string;
    message: string;
    field?: string;
    stack?: string;
  }>;
  outputs: Record<string, unknown>; // Handler-specific success data
  audit: {
    startTs: number;
    endTs: number;
    cpu?: number; // Memory used, CPU time, etc.
    memory?: number;
    warnings?: number;
  };
  state_delta?: Record<string, unknown>; // What changed globally
};
```

**Plus:** For long tasks, add streaming:

```typescript
type UEEProgress = {
  type: "uee.progress";
  taskId: string;
  percentComplete: 0-100;
  currentStep: string;
  eta?: number;              // Milliseconds remaining
};
```

**Effort:** 4-6 hours (contract definition + response builders)
**Risk level:** 🟠 **HIGH** — UX + debugging complexity

---

### Gap 4: SimRunner Protocol Lacks Versioning + Schema

**Current State:**

Informal JSON over stdio:

```typescript
// Nucleus → SimRunner
{ op: "tick", deltaTime: 0.016 }

// SimRunner → Nucleus
{ type: "tick", frameNumber: 1, entities: [...] }
```

**Problems:**

1. No strict enum for `op`/`type` → typos silently ignored
2. No validation → if SimRunner sends bad JSON, Nucleus hangs
3. No version field → can't upgrade protocol without breaking
4. No framing / message boundaries → streams can get corrupted
5. No size guards → SimRunner sends 500MB state, Nucleus OOMs

**What happens at scale:**

- SimRunner protocol drifts over time
- Nucleus gets partial messages on high latency → parsing fails
- State transfer becomes slow bottleneck with no compression
- Debugging "why is state mismatched?" requires manual stdio tracing

**Minimal fix:**

Define versioned, strict schema:

```typescript
type SimRunnerOp =
  | { v: 1; op: "tick"; id: string; ts: number; deltaTime: number }
  | { v: 1; op: "setInput"; id: string; entityId: string; action: Action }
  | { v: 1; op: "pause"; id: string }
  | { v: 1; op: "resume"; id: string };

type SimRunnerResponse =
  | { v: 1; id: string; ts: number; type: "tick"; frameNumber: number; entities: Entity[] }
  | { v: 1; id: string; ts: number; type: "collision"; a: string; b: string }
  | { v: 1; id: string; ts: number; type: "error"; code: string; message: string };

// With validation + max size guard
const MAX_SIMRUNNER_MESSAGE_SIZE = 50 * 1024 * 1024; // 50MB
```

**Effort:** 2-3 hours (schema + parsers)
**Risk level:** 🟠 **HIGH** — Operational stability

---

## 🚨 Highest-Risk Areas (Will Break in Production)

### Risk A: WebSocket Hub Becomes "God Object"

**Current State:**

`apps/nucleus/src/wsHub.ts` has ~200 lines, mixed:

- Connection lifecycle (open/close)
- Auth & role checking
- Message parsing
- File watcher integration
- Task routing
- Broadcast fanout
- Rate limiting check (missing)

**Complexity warnings:** 25 (limit 15)

**Problem:**

- Untestable (too many responsibilities)
- Fragile (one bug cascades across 6 subsystems)
- Hard to debug (all business logic in one place)
- No reusability (can't extract connection handling for tests)

**What happens at scale:**

- Any change to auth logic risks breaking broadcast
- Adding rate limiting requires rewriting whole module
- Debugging "why didn't this client get message?" is guess-and-check
- New developer takes 2 weeks to understand the logic flow

**Minimal fix (extract to modules):**

Currently:

```
wsHub.ts (200 LOC, 6 responsibilities)
```

Should be:

```
connectionLifecycle.ts  (open, close, heartbeat, cleanup)
authAndSession.ts       (token validation, capabilities, role gating)
parseAndValidate.ts     (Zod boundary, message parsing, error handling)
dispatcher.ts           (route by type, call handlers, collect response)
broadcaster.ts          (fanout rules, role-based filtering)
rateLimiter.ts          (track per-session rate, enforce limits)
wsHub.ts                (glue layer: coordinates above modules)
```

New wsHub becomes:

```typescript
async function handleMessage(ws, msg) {
  1. parseAndValidate.parse(msg)               ← Zod
  2. authAndSession.verifyToken(msg.sessionId) ← Auth
  3. dispatcher.route(msg)                      ← Dispatch
  4. broadcaster.fanout(msg, response)          ← Broadcast
}
```

**Effort:** 1 day (extract + test)
**Risk level:** 🔴 **CRITICAL** — Maintainability bottleneck

---

### Risk B: Brain Training Inside Nucleus Blocks Orchestrator

**Current State:**

`brain_train` handler runs CPU-heavy GA in-process:

```typescript
// apps/nucleus/src/router/handlers/brainTrain.ts
export async function handleBrainTrain(envelope, context) {
  const pop = new Population(config);
  for (let gen = 0; gen < 50; gen++) {
    pop.evaluate(...);    // ← CPU work on main thread
    pop.evolve(...);
  }
  return { bestFitness, ... };
}
```

**Problem:**

- Blocks WS event loop
- IDE stops receiving file watcher updates
- PTY terminal becomes laggy
- Other UEE tasks queue up, timeout

**Observable failure mode:**

```
IDE: "Why did my file change not broadcast? Why is terminal hanging?"
Nucleus: (silent — still in generation 30 of 50)
Client: (WebSocket times out waiting for response)
```

**Minimal fix (offload to worker):**

Option 1 — Node Worker Threads (fast, local):

```typescript
const worker = new Worker('./brainTrainWorker.ts');
worker.on('message', (progress) => {
  broadcaster.send(sessionId, { type: 'brain_train.progress', ... });
});
worker.postMessage({ config, population });
```

Option 2 — Child process (best isolation):

```typescript
const sim = spawn("node", ["brainTrainProcess.js"]);
sim.on("data", (chunk) => {
  // Stream progress messages back to client
});
sim.stdin.write(JSON.stringify({ config, population }));
```

**Effort:** 4-6 hours (worker setup + message plumbing)
**Risk level:** 🔴 **CRITICAL** — Production stability

---

### Risk C: `memory: Map<string, any>` Type Safety Grenade

**Current State:**

`packages/brain/src/controller.ts`:

```typescript
export class AgentBrain {
  memory: Map<string, any>; // ← Type bomb

  remember(key: string, value: any) {
    this.memory.set(key, value);
  }
}
```

**Problem:**

1. IDE autocomplete dies (any → no suggestions)
2. Refactoring memory keys breaks silently
3. Serialization is impossible (any doesn't serialize)
4. Type narrowing can't happen (you don't know the shape)

**Symptom:**

```typescript
// Code works during dev (luck)
const agent = agents.get(agentId);
const goal = agent.memory.get("currentGoal");
goal.priority; // ← Works if you set it right, crashes if you didn't

// But after a refactor:
// Did you serialize memory correctly? Did you restore it?
// Types can't tell you.
```

**Minimal fix:**

Option 1 — Known shape (best if memory is small):

```typescript
type AgentMemory = {
  currentGoal?: Goal;
  lastReward?: number;
  sensorHistory?: number[][];
};

export class AgentBrain {
  memory: AgentMemory = {};
}
```

Option 2 — Discriminated union (flexible):

```typescript
type MemoryEntry =
  | { key: "currentGoal"; value: Goal }
  | { key: "lastReward"; value: number }
  | { key: "sensorHistory"; value: number[][] };

export class AgentBrain {
  memory: Map<string, MemoryEntry["value"]> = new Map();
}
```

Option 3 — Keep flexible but narrow at boundary:

```typescript
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export class AgentBrain {
  memory: Map<string, JsonValue> = new Map();

  // Narrower when you need a specific field
  getCurrentGoal(): Goal | undefined {
    const raw = this.memory.get("currentGoal");
    if (raw && typeof raw === "object" && "priority" in raw) {
      return raw as Goal;
    }
    return undefined;
  }
}
```

**Effort:** 2-3 hours (define schema + migrate)
**Risk level:** 🟠 **HIGH** — Correctness + serialization

---

## 🔴 The "240 Errors" Root Cause Pattern

### Why You Still Have 240 Errors (Not Just Missing @types/node)

**Your claim:**

> Blocking Issue: Missing `@types/node` (prevents Node.js namespace resolution)

**Reality:** `@types/node` is _one_ of typically 3 buckets:

### Bucket 1: tsconfig / Module Resolution (~60 errors)

```json
// Problem: wrong moduleResolution, paths not set, baseUrl missing
{
  "compilerOptions": {
    "moduleResolution": "bundler", // ← Should be "node"
    "paths": {
      "@we/*": ["packages/*/src"] // ← Missing or wrong
    },
    "baseUrl": "."
  }
}
```

**Symptoms:**

```
Cannot find module '@we/protocol'
Cannot find module '@we/brain'
```

**Fix:** Verify `tsconfig.base.json` has correct paths + all packages have `tsconfig.json` extending it.

### Bucket 2: Package Export Maps (~80 errors)

```json
// Problem: "exports" field missing, or main/types pointing wrong place
{
  "name": "@we/brain",
  "main": "./dist/index.js", // ← Works AFTER build
  "types": "./dist/index.d.ts",
  // But during dev:
  // tsc can't find types yet (dist doesn't exist)

  // FIX: Add
  "exports": {
    ".": {
      "import": "./src/index.ts", // ← Dev time
      "types": "./src/index.ts"
    }
  }
}
```

**Symptoms:**

```
'@we/brain' has no exported member 'NeuralNetwork'
Cannot find type definition for '@we/brain'
```

**Fix:** Add `exports` field to every package.json.

### Bucket 3: Type Drift in Shared Packages (~100 errors)

```typescript
// packages/protocol/src/schemas.ts
export const UEESchema = z.object({
  task: z.object({
    type: z.enum([...]) // ← List is incomplete
  })
});

// apps/nucleus/src/router/uee.ts
// Tries to dispatch task.type that's not in schema → type error
```

**Symptoms:**

```
Type 'string' is not assignable to type '"brain_control" | "brain_train"'
Missing variant in discriminated union
```

**Fix:** Run `tsc` in each package individually to identify which types are drifting. Then align the schemas.

---

### Action: Verify These 3 After `npm install`

```powershell
# Test 1: TypeScript can resolve all paths
npx tsc --noEmit

# Test 2: Check tsconfig inheritance
cat tsconfig.base.json | grep -A 5 paths

# Test 3: Check package.json exports fields
for pkg in packages/*; do
  echo "=== $pkg ==="
  cat "$pkg/package.json" | grep '"exports"'
done

# Test 4: If errors remain, find root packages with drift
npx tsc --listFiles 2>&1 | grep "error TS" | head -20
```

**If errors > 50 after `npm install`:** The problem is **not** @types/node. Look for missing export maps or tsconfig paths.

---

## ✅ Concrete Audit Findings → Action Items

### Phase 1 — Stop the Bleeding (Correctness Guards)

**Timeline:** 2-3 days
**Goal:** Prevent runtime chaos from invalid messages

#### P1.1: Transport Boundary Zod Validation

- [ ] Add Zod validation layer at every transport boundary
  - WS incoming messages
  - WS outgoing messages
  - SimRunner stdio in/out
  - Python sidecar HTTP in/out
- [ ] Create `packages/protocol/src/contracts/` folder
  - `busEnvelope.schema.ts`
  - `ueeMessage.schema.ts`
  - `simRunnerMessage.schema.ts`
  - `sidecartMessage.schema.ts`
- [ ] Nucleus validates all incoming via Zod before routing
- [ ] IDE/Preview validate all incoming before using
- **Effort:** 6-8 hours

#### P1.2: Capability Gating for UEE Tasks

- [ ] Add `task.requiredCapabilities?: string[]` to UEE schema
- [ ] Add `auth.grantedCapabilities: string[]` to session store
- [ ] UEE router checks: `grantedCapabilities ⊇ requiredCapabilities`
- [ ] Create capability enum: `"file:read"`, `"file:write"`, `"brain:train"`, `"brain:control"`, etc.
- **Effort:** 4-6 hours

#### P1.3: Rate Limits + Message Size Guards

- [ ] Add per-session rate limit tracker (token bucket)
- [ ] Enforce: max 100 messages/sec per session
- [ ] Enforce: max 10MB payload per message
- [ ] Reject gracefully: return 429 "too many requests"
- **Effort:** 2-3 hours

#### P1.4: Structured Error Format

- [ ] Define error response shape (code + message + field + context)
- [ ] All handlers return consistent error format
- [ ] IDE can parse and display without special cases
- **Effort:** 3-4 hours

### Phase 2 — Determinism + Performance Stability

**Timeline:** 1 week
**Goal:** Ensure replay-ability, multiplayer sync, and consistent performance

#### P2.1: Fixed-Step Tick + Input Ordering

- [ ] Nucleus: accumulate dt, dispatch N=1 fixed-step ticks (16ms each)
- [ ] Input ordering: sort by timestamp before processing
- [ ] SimRunner: accept only fixed-step tick commands
- [ ] Test: record 100 ticks + inputs, replay 3x, assert bytes match
- **Effort:** 8-10 hours

#### P2.2: Deterministic RNG Policy

- [ ] Grep codebase: no `Math.random()` outside SeededRNG
- [ ] Every RNG instance seeded from config or replay input
- [ ] Add tsc plugin to flag `Math.random()` as error
- **Effort:** 4-6 hours

#### P2.3: Brain Training Off Main Thread

- [ ] Move `handleBrainTrain` to Worker Thread or child process
- [ ] Stream progress messages back to client
- [ ] Main thread stays responsive (< 50ms latency)
- **Effort:** 4-6 hours

#### P2.4: SimRunner Streaming Protocol Versioned

- [ ] Define OpCode enum + versioned schema
- [ ] Add framing / chunking for large states
- [ ] Add compression option (brotli) for state payloads
- [ ] Max message size guard (50MB)
- **Effort:** 6-8 hours

### Phase 3 — Developer Experience (DX + Stability)

**Timeline:** 1-2 weeks
**Goal:** Make development fast, debugging obvious, schema drift impossible

#### P3.1: Golden Path Scripts

- [ ] `npm run dev:all` launches 4 services with health check
- [ ] `npm run typecheck` validates all boundaries
- [ ] `npm run lint` checks for Math.random, unsafe memory access
- [ ] `npm run test:contracts` validates envelope schemas + handlers
- **Effort:** 4-5 hours

#### P3.2: Contract Test Suite

- [ ] Unit tests for every UEE handler (schema in → schema out)
- [ ] Integration test: send UEE envelope → verify response shape
- [ ] SimRunner message parsing tests
- [ ] Sidecar HTTP response schema tests
- **Effort:** 1 week

#### P3.3: Docs = Code

- [ ] Generate OpenAPI spec from BusEnvelope schema
- [ ] Generate contract docs from Zod schema
- [ ] IDE can link to schema definition
- **Effort:** 3-4 hours

---

## 🔧 Next Step: Which Area First?

To move forward with surgical precision, paste one of these and I'll give you exact file edits:

### Option A: Envelope Security (Gap 1)

> Current file: `packages/protocol/src/index.ts` (or schemas.ts)
> Goal: Add auth/nonce/capabilities fields to BusEnvelope
> Effort: 2-3 hours end-to-end

### Option B: UEE Response Contract (Gap 3)

> Current file: `apps/nucleus/src/router/handlers/base.ts`
> Goal: Standard response shape all handlers must return
> Effort: 4-6 hours end-to-end

### Option C: WS Hub Refactor (Risk A)

> Current file: `apps/nucleus/src/wsHub.ts`
> Goal: Split into 6 modules (lifecycle, auth, parse, route, broadcast, rate limit)
> Effort: 1 day end-to-end

### Option D: Determinism Lock-Down (Gap 2)

> Current file: `packages/engine/src/index.ts` (+ brain/network.ts)
> Goal: Fixed-step tick contract + RNG policy enforcement
> Effort: 8-10 hours end-to-end

### Option E: SimRunner Protocol (Gap 4)

> Current file: `apps/nucleus/src/services/simRunner.ts`
> Goal: Versioned, strict schema + framing
> Effort: 2-3 hours end-to-end

**Pick one, paste the file, and we'll drive it home. 💪**

---

## 📋 Quick Reference: Error Checklist

Use this to track progress through all phases:

```
Phase 1 — Correctness Guards
[ ] Zod schemas at all transport boundaries
[ ] Capability gating for UEE tasks
[ ] Rate limits + message size guards
[ ] Structured error format

Phase 2 — Determinism
[ ] Fixed-step tick + input ordering
[ ] Deterministic RNG policy
[ ] Brain training off main thread
[ ] SimRunner protocol versioned

Phase 3 — DX
[ ] Golden path scripts
[ ] Contract test suite
[ ] Docs = Code (OpenAPI, schema docs)

Verification (After Phase 1):
[ ] npm run typecheck → 0 errors
[ ] npm run dev:all → all 4 services healthy
[ ] WebSocket roundtrip < 50ms
[ ] Invalid message rejected with 400 + clear error

Verification (After Phase 2):
[ ] Replay test passes (same input seed → deterministic output)
[ ] Brain train doesn't block IDE
[ ] Long message stream works (> 1MB state)

Verification (After Phase 3):
[ ] npm run test:contracts passes
[ ] One-click onboarding for new dev
[ ] "Design change" is docs + code, not "update README"
```

---

**End of Audit**
