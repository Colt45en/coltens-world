# UEE-1 Integration Guide

## Overview

**Unified Engine Envelope (UEE-1)** is the domain-specific task protocol for World Engine. It sits inside `BusEnvelope` as a payload to handle:

- **Lexicon Operations** — Term definitions, artifact linking
- **HCE Runs** — Hypothesis-Constraint-Exploration expansion
- **Scene Generation** — Procedural narrative scene creation
- **Sentence Analysis** — Linguistic structure & semantic analysis

**Key Design Principles:**

- ✅ **Transport ≠ Domain** — BusEnvelope handles routing/auth/retry; UEE-1 handles business logic
- ✅ **Conditional Validation** — Task type determines required inputs
- ✅ **Forward Compatible** — Custom task types supported via regex escape hatch
- ✅ **Auditable** — Speculative items, foreshadow ledger, POV compliance tracking
- ✅ **Stateful** — Tracks story_state + lexicon_state mutations

## Quick Start

### 1. Parse & Validate a UEE Envelope

```typescript
import { parseUEE, narrowToLexiconOp } from "@we/protocol";

const raw = JSON.parse(ws.data);

// Parse with validation
const result = parseUEE(raw);
if (!result.ok) {
  console.error("Validation failed:", result.message);
  return;
}

const envelope = result.envelope;

// Type-safe narrowing
if (narrowToLexiconOp(envelope)) {
  const { term, artifact, objective } = envelope.inputs.lexicon_op!;
  console.log(`Lexicon op: define "${term}" as artifact in "${artifact}"`);
}
```

### 2. Route Through Nucleus

```typescript
import { getUEERouter } from "@apps/nucleus/src/router/uee";

// Incoming WebSocket message from IDE
const router = getUEERouter();
const response = await router.route(raw, sessionId);

// Send back response (ok + outputs OR ok:false + errors)
ws.send(JSON.stringify(response));
```

### 3. Implement a Custom Handler

```typescript
import {
  LexiconOpHandlerBase,
  type UEEHandlerResponse,
  type UEEHandlerContext,
} from "@apps/nucleus/src/router/handlers/base";

class MyLexiconHandler extends LexiconOpHandlerBase {
  async executeTyped(envelope, context, lexicon_op) {
    this.logStart(context, { term: lexicon_op.term });

    // Business logic
    const expanded = await expandTerm(lexicon_op.term, lexicon_op.artifact);

    // Build audit
    const audit = {
      speculative_items: [
        this.createSpeculativeItem("hyp-001", "definition", "clarity", "tomorrow"),
      ],
      pov_compliance: this.createComplianceAudit(true, []),
    };

    // Build state delta
    const state_delta = this.createStateDelta(
      { last_term_defined: lexicon_op.term },
      { new_entry_id: expanded.id },
    );

    this.logSuccess(context);
    return this.success(context, { lexicon_op: expanded }, audit, state_delta);
  }
}

// Register
const handler = new MyLexiconHandler();
getUEERouter().registerHandler("lexicon_op", handler.execute.bind(handler));
```

## Architecture: Transport vs. Domain

### BusEnvelope (Transport Layer)

```typescript
{
  type: "uee",
  messageId: "msg-123",
  timestamp: "2024-01-01T12:00:00Z",
  sessionId: "sess-456",
  correlationId: "corr-789",
  payload: { /* UEE-1 envelope lives here */ },
  retry: { maxAttempts: 3 },
  auth: { token: "..." }
}
```

### UEE-1 Envelope (Domain Layer)

```typescript
{
  contract: { type: "UnifiedEngineEnvelope", version: "1.0.0" },
  task: { type: "lexicon_op", id: "task-123", mode: "interactive" },
  inputs: {
    lexicon_op: {
      term: "Speculative Realism",
      artifact: "SR.md",
      objective: "Define core concepts",
      constraints: [...],
      tradeoffs: {...},
      format: "prose"
    }
  },
  context: { pov: "third_person", world: "fantasy_world_v2" },
  controls: { return: { include_prose: true, include_json: true } },
  outputs?: { lexicon_op: { ... } }, // Set by handler
  audit?: { speculative_items: [...], pov_compliance: {...} }, // Set by handler
  state_delta?: { story_state: {...}, lexicon_state: {...} } // Set by handler
}
```

**Key Insight:** BusEnvelope routes the message; UEE-1 describes the work to do. This allows:

- ✅ Multiple UEE task types without modifying BusEnvelope
- ✅ Retry logic applies to all task types uniformly
- ✅ Easy to add new domain envelopes (HayakawaSchema, StoryDeltaSchema, etc.)

## Integration Points

### 1. IDE → Nucleus (WebSocket)

**File:** `apps/ide-web/src/bus/wsClient.ts`

```typescript
// IDE sends UEE task
const envelope = {
  contract: { type: "UnifiedEngineEnvelope", version: "1.0.0" },
  task: { type: "lexicon_op", id: "task-456", mode: "interactive" },
  inputs: { lexicon_op: { term: "Emergence", artifact: "core.md", objective: "..." } },
};

// Wrap in BusEnvelope
const busEnvelope = {
  type: "uee",
  messageId: generateId(),
  timestamp: new Date().toISOString(),
  sessionId: currentSessionId,
  payload: envelope,
};

ws.send(JSON.stringify(busEnvelope));
```

### 2. Nucleus Routes & Dispatches

**File:** `apps/nucleus/src/router/uee.ts`

```typescript
// Incoming from IDE
ws.on("message", async (raw) => {
  const router = getUEERouter();
  const response = await router.route(raw, sessionId);
  ws.send(JSON.stringify(response));
});
```

**Router Flow:**

1. Parse raw JSON → validate against UEE schema (conditional per task type)
2. Look up handler by task.type
3. Call handler with envelope + context
4. Filter outputs by controls.return config
5. Return response (ok + outputs OR ok:false + errors)

### 3. Nucleus Handler Implementations

**Lexicon Operations:** Connect to `@we/lexicon` package

```typescript
// TODO: Implement in handleLexiconOp
// Calls: lexicon.defineEntry(term, artifact, objective, constraints)
// Returns: entry { id, term, definition, provenance, artifact_link }
```

**HCE Runs:** Connect to physics/expansion engine

```typescript
// TODO: Implement in handleHceRun
// Calls: hce.expand(topic, observations, assumptions, metrics)
// Returns: expansion { analysis, insights, recommendations[], confidence }
```

**Scene Generation:** Connect to `AssetResourceManager + engine`

```typescript
// TODO: Implement in handleScene
// Calls: assetMgr.preload(...) → engine.generateScene(scene_brief, controls)
// Returns: scene { prose, entities[], state, metadata }
```

**Sentence Analysis:** Connect to NLP/sidecar

```typescript
// TODO: Implement in handleAnalyzeSentence
// Calls: sidecar.analyzeSentence(sentence)
// Returns: analysis { structure, semantics, sentiment, entities[] }
```

### 4. Preview Runtime (Game Engine)

**File:** `apps/preview-runtime/src/main.ts`

```typescript
// Receive scene generation output
const ueeResponse = await bus.request("nucleus", "uee.route", envelope);

if (ueeResponse.ok && ueeResponse.taskType === "scene") {
  // Instantiate entities from ueeResponse.outputs.scene.entities[]
  engine.instantiate(ueeResponse.outputs.scene.entities);

  // Apply state mutations
  if (ueeResponse.state_delta?.story_state) {
    storyManager.apply(ueeResponse.state_delta.story_state);
  }
}
```

## Handler Implementation Template

### Step 1: Extend Base Handler

```typescript
import { LexiconOpHandlerBase } from "@apps/nucleus/src/router/handlers/base";

class ProductionLexiconHandler extends LexiconOpHandlerBase {
  constructor(lexicon, logger) {
    super(logger);
    this.lexicon = lexicon;
  }

  async executeTyped(envelope, context, lexicon_op) {
    // Type narrowing guarantees lexicon_op fields exist
    const { term, artifact, objective } = lexicon_op;

    // Business logic
    const expanded = await this.lexicon.defineEntry({
      term,
      artifact,
      objective,
      constraints: lexicon_op.constraints || {},
      tradeoffs: lexicon_op.tradeoffs || {},
    });

    // Build audit
    const audit = {
      speculative_items: [],
      foreshadow_ledger: [],
      constraints_checked: Object.keys(lexicon_op.constraints || {}),
      pov_compliance: this.createComplianceAudit(true, []),
      connector_usage: 0,
    };

    // Build state delta
    const state_delta = this.createStateDelta(
      { last_term: term },
      { entry_id: expanded.id, entry_version: expanded.version },
    );

    return this.success(context, { lexicon_op: expanded }, audit, state_delta);
  }
}
```

### Step 2: Register Handler

```typescript
import { getUEERouter } from "@apps/nucleus/src/router/uee";

const lexicon = new LexiconService();
const handler = new ProductionLexiconHandler(lexicon, console);
const router = getUEERouter();

router.registerHandler("lexicon_op", (env, ctx) => handler.execute(env, ctx));
```

### Step 3: Test

```typescript
const test_envelope = {
  contract: { type: "UnifiedEngineEnvelope", version: "1.0.0" },
  task: { type: "lexicon_op", id: "test-1", mode: "test" },
  inputs: {
    lexicon_op: {
      term: "Emergence",
      artifact: "core.md",
      objective: "Define in context of complex systems",
      constraints: { max_words: 200, style: "academic" },
    },
  },
  controls: { return: { include_prose: true, include_json: true } },
};

const result = await router.route(test_envelope, "test-session");
console.assert(result.ok, "Handler failed");
console.assert(result.outputs?.lexicon_op, "No lexicon_op output");
```

## Error Handling

### Parsing Errors

```typescript
const result = parseUEE(raw);
if (!result.ok) {
  // User sent malformed JSON or wrong schema
  return respond({
    ok: false,
    taskId: "unknown",
    taskType: "unknown",
    errors: [result.message], // ZodError details
  });
}
```

### Validation Errors (Missing Required Inputs)

```typescript
// Router checks task.type against inputs
// E.g., lexicon_op without term/artifact/objective
if (!hasRequiredInputs(envelope)) {
  return respond({
    ok: false,
    taskId: envelope.task.id,
    taskType: envelope.task.type,
    errors: ["Missing required inputs for task type"],
  });
}
```

### Handler Execution Errors

```typescript
try {
  return await handler(envelope, context);
} catch (err) {
  return {
    ok: false,
    taskId: context.taskId,
    taskType: context.taskType,
    errors: [err.message],
  };
}
```

## Audit Trail

Every UEE response can include audit metadata:

```typescript
{
  ok: true,
  taskId: "...",
  audit: {
    speculative_items: [
      { id: "spec-1", detail: "explore", hypothesized_payoff: "clarity", due_by: "2025-01-15" },
    ],
    foreshadow_ledger: [
      { id: "fsh-1", detail: "...", payoff_hypothesis: "...", due_by: "..." },
    ],
    constraints_checked: ["max_words", "style"],
    pov_compliance: {
      passed: true,
      notes: ["3rd person maintained", "world_state consistent"],
      checked_at: "2025-01-01T12:00:00Z",
    },
    connector_usage: 3, // How many connectors were used
  }
}
```

**Use Cases:**

- ✅ Track speculative ideas for later exploration
- ✅ Audit POV consistency in storytelling
- ✅ Monitor constraint satisfaction
- ✅ Debug why a handler made certain choices

## State Delta

Track mutations to story state & lexicon:

```typescript
{
  ok: true,
  taskId: "...",
  state_delta: {
    story_state: {
      last_location: "city_center",
      current_tension: 8,
      pov_state: "confused",
    },
    lexicon_state: {
      new_terms: ["Speculative Realism"],
      modified_entries: ["Emergence"],
      connectors_added: [
        { from: "SR", to: "Emergence", relation: "specializes" },
      ],
    },
    delta_timestamp: "2025-01-01T12:00:00Z",
  }
}
```

**Apply to Runtime:**

```typescript
if (response.state_delta?.story_state) {
  Object.assign(engine.storyState, response.state_delta.story_state);
}

if (response.state_delta?.lexicon_state?.new_terms) {
  // Re-index lexicon
  lexicon.addTerms(response.state_delta.lexicon_state.new_terms);
}
```

## Output Filtering (controls.return)

Handlers can produce all outputs, but client controls which fields to receive:

```typescript
// Handler always computes both prose + JSON + audit
const fullResponse = {
  outputs: {
    lexicon_op: {
      term: "...",
      prose: "Long explanation...", // 800 words
      json: { structure: {...} }, // Detailed JSON
    }
  },
  audit: { /* ... */ },
  state_delta: { /* ... */ }
};

// But client requested only JSON
const envelope = {
  controls: { return: { include_prose: false, include_json: true, include_audit: false } },
};

// Router filters before responding
const filtered = {
  outputs: {
    lexicon_op: {
      term: "...",
      json: { structure: {...} },
    }
  }
  // prose, audit, state_delta omitted
};
```

## Forward Compatibility

### Custom Task Types

UEE-1 supports new task types via regex escape hatch:

```typescript
// Valid task types: lowercase + underscores + digits
// Examples: "lexicon_op", "ner_analysis", "math_eval_v2"

// Your custom task type
const envelope = {
  task: { type: "custom_nlp_task", id: "...", mode: "..." },
  inputs: {
    custom_nlp_task: {
      /* custom schema */
    },
  },
};

// Router will:
// 1. Accept it (matches regex)
// 2. Look for registered handler
// 3. Return "no handler for task type" if not found
// 4. Dispatch to handler if found
```

### Task Type Versioning

```typescript
// In future: support versioned task types
const envelope = {
  task: { type: "lexicon_op@2", id: "...", mode: "..." },
  // v2 inputs have different schema
  inputs: {
    lexicon_op: {
      /* v2 fields */
    },
  },
};

// Approach: Register separate handlers
router.registerHandler("lexicon_op@1", handleLexiconOpV1);
router.registerHandler("lexicon_op@2", handleLexiconOpV2);
```

## Best Practices

✅ **DO:**

- Use base handler classes (eliminates boilerplate)
- Validate envelope type before dispatch
- Log at start + success/error for debugging
- Include audit trail for complex operations
- Emit state_delta for any mutations
- Test handler with multiple input variations

❌ **DON'T:**

- Assume inputs are valid (always use narrowing guards)
- Modify envelope fields in-place
- Throw exceptions from handlers (return error response instead)
- Ignore state_delta opportunities (replay/audit trails depend on it)
- Create new instances of router (use getUEERouter singleton)

## Testing

### Unit Test Template

```typescript
import { describe, it, assert } from "@web/test-runner";
import { parseUEE } from "@we/protocol";
import { getUEERouter, resetUEERouter } from "@apps/nucleus/src/router/uee";

describe("UEE Router", () => {
  beforeEach(() => resetUEERouter());

  it("routes lexicon_op to registered handler", async () => {
    const router = getUEERouter();
    let called = false;

    router.registerHandler("lexicon_op", async (env, ctx) => {
      called = true;
      return { ok: true, taskId: ctx.taskId, taskType: "lexicon_op" };
    });

    const envelope = {
      contract: { type: "UnifiedEngineEnvelope", version: "1.0.0" },
      task: { type: "lexicon_op", id: "test-1", mode: "test" },
      inputs: {
        lexicon_op: { term: "Emergence", artifact: "core.md", objective: "..." },
      },
    };

    const response = await router.route(envelope, "test-session");

    assert(called, "Handler not called");
    assert(response.ok, "Response not ok");
  });

  it("rejects missing required inputs", async () => {
    const router = getUEERouter();
    const envelope = {
      contract: { type: "UnifiedEngineEnvelope", version: "1.0.0" },
      task: { type: "lexicon_op", id: "test-1", mode: "test" },
      inputs: {
        lexicon_op: { term: "Emergence" }, // Missing artifact, objective
      },
    };

    const response = await router.route(envelope, "test-session");

    assert(!response.ok, "Should reject incomplete inputs");
    assert(response.errors?.length > 0, "Should have error message");
  });
});
```

## See Also

- `packages/protocol/src/envelopes/uee/schema.ts` — Full Zod schema + types
- `packages/protocol/src/envelopes/uee/guards.ts` — Validation & narrowing utilities
- `apps/nucleus/src/router/uee.ts` — Router + dispatch implementation
- `apps/nucleus/src/router/handlers/base.ts` — Handler base classes + templates
- `packages/codex/` — System configuration (pre-requisite for HCE runs)
- `apps/py-sidecar/` — Python math/NLP evaluation (needed for sentence analysis)
