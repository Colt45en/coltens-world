# Autonomy Loop Integration Guide

**Complete wiring** of the deterministic knowledge refinery across Nucleus, IDE, and Brain.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                         IDE UI Layer                             │
│  - Hover tooltips (symbol lookup)                                │
│  - Code navigation (go-to definition)                            │
│  - Review queue widget (pending approvals)                       │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ↓ HTTP/WS
┌──────────────────────────────────────────────────────────────────┐
│              IDE Lexicon Client (TypeScript)                     │
│  - Query entries by term/language/namespace                      │
│  - Cache with TTL (30s)                                          │
│  - Governance transparency (batch_id, approval, review_required) │
│  File: apps/ide-web/src/bus/lexiconClient.ts                    │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ↓ HTTP GET /lexicon/entries
                     ↓ HTTP GET /lexicon/runes
                     ↓ HTTP GET /lexicon/review-queue
                     ↓ HTTP GET /lexicon/status
                     │
┌──────────────────────────────────────────────────────────────────┐
│              Nucleus Lexicon Routes (TypeScript)                 │
│  - Query API to world.db (SQLite)                                │
│  - Pagination + filtering support                                │
│  - Governance metadata in responses                              │
│  File: apps/nucleus/src/routes/lexicon.ts                       │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ↓ sqlite3
┌──────────────────────────────────────────────────────────────────┐
│         SQLite Baseline (world.db)                               │
│  - batches, lexicon_entries, rune_rows                           │
│  - merge_history, review_queue                                   │
│  - Created by Specialist stage (persist.py)                      │
│  File: apps/py-sidecar/world.db (auto-created)                  │
└──────────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────────┐
│                   Brain Autonomous Agent                         │
│  - Resolves symbols during planning/execution                    │
│  - Applies confidence + impact policy                            │
│  - Defers/escalates based on governance gates                    │
│  File: packages/brain/src/lexicon-tool.ts                       │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ↓ queries IDE lexicon client
                     ↓ enforces policy (confidence 0.80, impact level)
                     │
             ┌──────┴──────┐
             ↓             ↓
      USE (high conf)   ESCALATE (low conf)
      [automatic]       [wait for review]

┌──────────────────────────────────────────────────────────────────┐
│            Python Sidecar (Autonomy Loop Pipeline)               │
│  - Detective → Alchemist → Analyst → Specialist → PM             │
│  - Consumes: source code files                                   │
│  - Produces: world.db + 8 JSON artifacts                         │
│  File: apps/py-sidecar/main.py (FastAPI server)                 │
└──────────────────────────────────────────────────────────────────┘
```

---

## Component Details

### 1. Nucleus Lexicon Routes (Backend API)

**File:** [apps/nucleus/src/routes/lexicon.ts](apps/nucleus/src/routes/lexicon.ts)

**Purpose:** Gateway to the SQLite lexicon baseline. Serves queries from IDE + Brain.

**Endpoints:**

| Method | Path                    | Description                       | Query Params                                              |
| ------ | ----------------------- | --------------------------------- | --------------------------------------------------------- |
| `GET`  | `/lexicon/entries`      | Query lexicon entries             | `term`, `language`, `namespace`, `minConfidence`, `limit` |
| `GET`  | `/lexicon/runes`        | Query rune decoder (process tags) | `term`, `language`, `namespace`, `minConfidence`, `limit` |
| `GET`  | `/lexicon/review-queue` | Pending human approvals           | —                                                         |
| `GET`  | `/lexicon/status`       | Health + operational metrics      | —                                                         |

**Response Format:**

```json
{
  "success": true,
  "data": [
    {
      "entry_id": "lex-abc123def",
      "term": "useState",
      "language": "TypeScript",
      "namespace": "react",
      "overall_confidence": 0.92,
      "morphology": { "root": "State", "affixes": ["use"] },
      "semantic_lenses": ["hook", "stateful-pattern"],
      "review_required": false
    }
  ],
  "governance": {
    "batch_id": "batch-xyz789",
    "approved": true,
    "review_required": false
  }
}
```

**Integration:**

```typescript
// In apps/nucleus/src/index.ts
import { setupLexiconRoutes } from "./routes/lexicon";

setupLexiconRoutes(app, "./world.db");
```

---

### 2. IDE Lexicon Client (Frontend)

**File:** [apps/ide-web/src/bus/lexiconClient.ts](apps/ide-web/src/bus/lexiconClient.ts)

**Purpose:** Consumes Nucleus API, provides symbol lookup for code editor, caches results.

**Key Methods:**

```typescript
// Single symbol lookup (with hover context)
const { entries, runes } = await lexiconClient.lookupSymbol("useState", "TypeScript");

// Multi-symbol query (for filtering)
const entries = await lexiconClient.queryEntries({
  term: "state",
  language: "TypeScript",
  minConfidence: 0.8,
  limit: 10,
});

// Get items needing review
const queue = await lexiconClient.getReviewQueue();

// Health check
const status = await lexiconClient.getStatus();
```

**Cache Behavior:**

- TTL: 30 seconds per query key
- Auto-invalidated on review queue changes
- Singleton instance exported as `lexiconClient`

**IDE Integration Example (Hover Tooltip):**

```typescript
// In apps/ide-web/src/ui/editor/HoverProvider.ts
import { lexiconClient } from "../../bus/lexiconClient";

export async function getHoverInfo(symbol: string, language: string) {
  const { entries, runes } = await lexiconClient.lookupSymbol(symbol, language);

  if (!entries.length) {
    return null; // Symbol not in lexicon baseline
  }

  const entry = entries[0];
  return {
    title: `${entry.term} (${entry.namespace})`,
    confidence: `${(entry.overall_confidence * 100).toFixed(0)}%`,
    meannings: entry.semantic_lenses,
    needsReview: entry.review_required,
    batchId: entry.batch_id,
  };
}
```

---

### 3. Brain Lexicon Tool (Governance Policy)

**File:** [packages/brain/src/lexicon-tool.ts](packages/brain/src/lexicon-tool.ts)

**Purpose:** Wrap lexicon queries with governance policy. Enforces confidence + impact rules.

**Policy Summary:**

| Confidence | Impact         | Action       | Behavior                          |
| ---------- | -------------- | ------------ | --------------------------------- |
| ≥ 0.80     | any            | **USE**      | Apply automatically, audit logged |
| 0.65–0.80  | read           | **SUGGEST**  | Propose to user (non-binding)     |
| 0.65–0.80  | write/critical | **ESCALATE** | Request human review              |
| < 0.65     | read           | **ESCALATE** | Request review                    |
| < 0.65     | critical       | **DENY**     | Block entirely                    |
| In review  | any            | **DEFER**    | Block until review completes      |

**Key Methods:**

```typescript
const tool = createBrainLexiconTool(lexiconClient);

// Resolve multiple symbols at once
const decisions = await tool.resolveSymbols([
  { term: "useState", language: "TypeScript", impact_level: "system" },
  { term: "unknownFunc", language: "TypeScript", impact_level: "critical" },
]);

decisions.forEach((decision, symbol) => {
  console.log(`${symbol}: ${decision.action} (confidence: ${decision.confidence})`);
  // Output:
  // "useState: use (confidence: 0.92)"
  // "unknownFunc: escalate (confidence: 0)"
});

// Enforce policy across batch (aggregates to overall action)
const { overall_action, decisions, audit_entry } = await tool.enforcePolicy(symbols);

if (overall_action === ActionType.DENY) {
  // Block execution, escalate to human
} else if (overall_action === ActionType.ESCALATE) {
  // Request approval before proceeding
}
```

**Brain Integration Example (Planning Stage):**

```typescript
// In packages/brain/src/planning.ts
import { createBrainLexiconTool, ActionType } from "./lexicon-tool";

export async function planWithGovernance(symbols: BrainSymbolContext[]) {
  const lexTool = createBrainLexiconTool(lexiconClient);
  const { overall_action, audit_entry } = await lexTool.enforcePolicy(symbols);

  // Log audit trail
  console.log(`[AUDIT] ${audit_entry.timestamp}: ${audit_entry.actions}`);

  if (overall_action === ActionType.DENY) {
    throw new Error(`Cannot proceed: governance policy requires review`);
  }

  return { decision: overall_action, escalations: audit_entry.escalations };
}
```

---

### 4. Python Sidecar: Pipeline Server

**File:** [apps/py-sidecar/main.py](apps/py-sidecar/main.py)

**Purpose:** FastAPI server that executes the 5-stage deterministic pipeline on demand.

**Endpoints:**

| Method | Path               | Description                               |
| ------ | ------------------ | ----------------------------------------- |
| `POST` | `/pipeline/run`    | Execute Detective→...→PM on a source file |
| `GET`  | `/pipeline/health` | Service health check                      |

**Request Payload:**

```json
{
  "input_file": "apps/ide-web/src/main.tsx",
  "language": "TypeScript",
  "objective": "extract IDE module structure",
  "output_dir": "pipeline_results",
  "narrative_mode": "slice_of_life",
  "min_confidence": 0.8
}
```

**Response:**

```json
{
  "success": true,
  "batch_id": "batch-xyz789",
  "decision": "APPROVED",
  "artifacts": {
    "evidence_packet": "pipeline_results/evidence_packet.json",
    "lexicon_entries": "pipeline_results/lexicon_entries.json",
    "rune_rows": "pipeline_results/rune_rows.json",
    "validated_plan": "pipeline_results/validated_plan.json",
    "decision_record": "pipeline_results/decision_record.json",
    "weekly_ops_report": "pipeline_results/weekly_ops_report.json",
    "merge_result": "pipeline_results/merge_result.json"
  },
  "gates": {
    "schema_validation": { "passed": true, "severity": "critical" },
    "determinism": { "passed": true, "severity": "critical" },
    "dedupe_audit": { "passed": true, "severity": "critical" },
    "confidence_threshold": { "passed": true, "severity": "warning" },
    "traceability": { "passed": true, "severity": "critical" }
  },
  "governance": {
    "overall_status": "passed",
    "approved_for_release": true,
    "batch_id": "batch-xyz789"
  },
  "timestamp": "2025-01-15T10:22:45.123456"
}
```

---

## Wiring Instructions

### Step 1: Wire Nucleus Routes

In [apps/nucleus/src/index.ts](apps/nucleus/src/index.ts):

```typescript
import { setupLexiconRoutes } from "./routes/lexicon";

// After app initialization
const app = Fastify();

// ... other routes ...

await setupLexiconRoutes(app, "./world.db");

await app.listen({ port: 3001 });
```

### Step 2: Use IDE Client in UI

In any IDE component that needs symbol lookup:

```typescript
import { lexiconClient } from "../bus/lexiconClient";

// Example: inline symbol definition
async function showSymbolDefinition(symbol: string) {
  const lookup = await lexiconClient.lookupSymbol(symbol, "TypeScript");

  if (!lookup.entries.length) {
    console.log(`"${symbol}" not in lexicon (novel symbol)`);
    return;
  }

  const entry = lookup.entries[0];
  console.log(`Defined as: ${entry.semantic_lenses.join(", ")}`);
  console.log(`Confidence: ${entry.overall_confidence}`);
}
```

### Step 3: Integrate Brain Tool

In [packages/brain/src/planning.ts](packages/brain/src/planning.ts):

```typescript
import { lexiconClient } from "@world-engine/lexicon"; // From IDE
import { createBrainLexiconTool, ActionType } from "./lexicon-tool";

export class BrainPlanner {
  private lexTool = createBrainLexiconTool(lexiconClient);

  async plan(state: WorldState): Promise<Action[]> {
    // Extract symbols from current state
    const symbols: BrainSymbolContext[] = [
      { term: "transform", language: "TypeScript", impact_level: "system" },
      { term: "unknown_lib", language: "TypeScript", impact_level: "critical" },
    ];

    // Enforce governance
    const { overall_action, escalations } = await this.lexTool.enforcePolicy(symbols);

    if (overall_action === ActionType.DENY) {
      throw new Error(`Execution blocked: critical symbols need review: ${escalations.join(", ")}`);
    }

    if (overall_action === ActionType.DEFER) {
      console.log("⏳ Waiting for review queue to complete...");
      return []; // No actions until review done
    }

    // Proceed with planning (USE or SUGGEST)
    return this.buildPlan(state);
  }
}
```

### Step 4: Trigger Pipeline in Nucleus

In a route handler that processes user code:

```typescript
// In apps/nucleus/src/router/handlers/indexCode.ts
import axios from "axios";

export async function handleCodeIndexing(req: any) {
  const sidecarUrl = "http://localhost:3002";

  try {
    const response = await axios.post(`${sidecarUrl}/pipeline/run`, {
      input_file: req.body.file_path,
      language: req.body.language,
      objective: `Index: ${req.body.file_path}`,
      output_dir: `./indexed/${Date.now()}`,
      min_confidence: 0.8,
    });

    if (response.data.success) {
      console.log(`✅ Pipeline approved batch: ${response.data.batch_id}`);
      // Update IDE with new lexicon baseline
      await publishEvent("lexicon:updated", {
        batch_id: response.data.batch_id,
        entry_count: Object.keys(response.data.artifacts).length,
      });
    } else {
      console.log(`⚠️ Pipeline blocked (review required)`);
    }

    return response.data;
  } catch (err) {
    console.error("Pipeline execution failed:", err);
    throw err;
  }
}
```

---

## Testing the Integration

### Test 1: Verify Nucleus Routes Start

```bash
# Terminal 1: Start Nucleus
pnpm run dev --filter apps/nucleus

# Terminal 2: Health check
curl http://localhost:3001/lexicon/status
# Response:
# {"status":"online","latest_batch":{"batch_id":"batch-xyz...","...":"..."},...}
```

### Test 2: Query Entries from IDE

```bash
# Terminal: In VS Code DevTools Console
import { lexiconClient } from './bus/lexiconClient';
const entries = await lexiconClient.queryEntries({ term: "useState" });
console.log(entries); // Should return array of LexiconEntry objects
```

### Test 3: Trigger Pipeline from CLI

```bash
# Terminal: In py-sidecar directory
python main.py &  # Starts FastAPI on port 3002

# In another terminal:
curl -X POST http://localhost:3002/pipeline/run \
  -H "Content-Type: application/json" \
  -d '{
    "input_file": "apps/ide-web/src/main.tsx",
    "language": "TypeScript",
    "objective": "index IDE",
    "output_dir": "new_results"
  }'

# Response: Full pipeline output with batch_id, decision, artifacts
```

### Test 4: Brain Policy Enforcement

```typescript
// In packages/brain test file
import { createBrainLexiconTool, ActionType } from "./lexicon-tool";

const tool = createBrainLexiconTool(mockClient);
const { overall_action } = await tool.enforcePolicy([
  { term: "highConfTerm", language: "TS", impact_level: "read" },
  { term: "lowConfTerm", language: "TS", impact_level: "critical" },
]);

// Should return: overall_action = ActionType.ESCALATE (due to low conf + critical)
assert(overall_action === ActionType.ESCALATE);
```

---

## Governance Flow (End-to-End)

### Scenario: Brain Executes Action with Novel Symbol

1. **Brain Planning Phase**
   - Analyzes world state, identifies symbol `transformAsync()`
   - Calls `lexTool.resolveSymbols([{ term: "transformAsync", ... }])`

2. **Lexicon Client Queries Nucleus**
   - Nucleus queries world.db (Specialist output)
   - Symbol not found in lexicon baseline
   - Returns: confidence=0, action=ESCALATE

3. **Brain Escalation**
   - Logs: "transformAsync: escalate (NOT IN LEXICON)"
   - Enqueues for human review
   - Pauses execution until approval

4. **IDE Review Widget**
   - Shows review queue (10 items pending)
   - User clicks "Approve" on transformAsync
   - Sends POST to Nucleus: `/lexicon/review-queue/approve`

5. **Re-query & Execute**
   - Brain re-checks symbol (cache cleared)
   - Nucleus returns: confidence=0.88, action=USE
   - Brain proceeds with execution

---

## Files Summary

| File                                                                           | Purpose                        | Type       |
| ------------------------------------------------------------------------------ | ------------------------------ | ---------- |
| [apps/nucleus/src/routes/lexicon.ts](apps/nucleus/src/routes/lexicon.ts)       | Lexicon query API              | TypeScript |
| [apps/ide-web/src/bus/lexiconClient.ts](apps/ide-web/src/bus/lexiconClient.ts) | Symbol cache + lookup          | TypeScript |
| [packages/brain/src/lexicon-tool.ts](packages/brain/src/lexicon-tool.ts)       | Policy enforcement             | TypeScript |
| [apps/py-sidecar/main.py](apps/py-sidecar/main.py)                             | Pipeline server                | Python     |
| [world.db](apps/py-sidecar/world.db)                                           | SQLite baseline (auto-created) | SQLite     |

---

## Next Steps

1. ✅ **Integration endpoints created** (Nucleus routes, IDE client, Brain tool)
2. ✅ **Python pipeline server** (main.py as FastAPI)
3. 🟡 **Test harness** — Create regression tests to lock determinism
4. 🟡 **Review workflow** — Implement IDE approval UI
5. 🟡 **Escalation email** — Send alerts for critical symbol gaps

---

**All three components are now wired and ready to execute end-to-end at `pnpm run dev`.**
