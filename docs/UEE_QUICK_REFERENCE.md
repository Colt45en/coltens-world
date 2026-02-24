# UEE-1 Quick Reference

## Task Types at a Glance

| Task Type          | Purpose                           | Required Inputs                        | Example Output                                    |
| ------------------ | --------------------------------- | -------------------------------------- | ------------------------------------------------- |
| `lexicon_op`       | Define term + artifact link       | `term`, `artifact`, `objective`        | `{ term, definition, provenance, artifact_link }` |
| `hce_run`          | Hypothesis-Constraint exploration | `topic`, `observations`, `constraints` | `{ analysis, insights, recommendations[] }`       |
| `scene`            | Procedural scene generation       | `scene_brief`                          | `{ prose, entities[], state, complexity_score }`  |
| `analyze_sentence` | NLP analysis                      | `sentence`                             | `{ structure, semantics, sentiment, entities[] }` |

## Common Patterns

### Parse & Validate

```typescript
import { parseUEE, hasRequiredInputs, narrowToLexiconOp } from "@we/protocol";

const result = parseUEE(raw);
if (!result.ok) throw new Error(result.message);

const envelope = result.envelope;
if (!hasRequiredInputs(envelope)) throw new Error("Missing required fields");
if (narrowToLexiconOp(envelope)) {
  /* type-safe */
}
```

### Build Response

```typescript
import { LexiconOpHandlerBase } from "@apps/nucleus/src/router/handlers/base";

class MyHandler extends LexiconOpHandlerBase {
  async executeTyped(envelope, context, lexicon_op) {
    // ... logic

    return this.success(context, outputs, audit, state_delta);
  }
}
```

### Register Handler

```typescript
import { getUEERouter } from "@apps/nucleus/src/router/uee";

const handler = new MyHandler();
getUEERouter().registerHandler("lexicon_op", (env, ctx) => handler.execute(env, ctx));
```

### Dispatch to Router

```typescript
const router = getUEERouter();
const response = await router.route(raw, sessionId);
ws.send(JSON.stringify(response));
```

## Schema Snippets

### Minimal Lexicon Op

```json
{
  "contract": { "type": "UnifiedEngineEnvelope", "version": "1.0.0" },
  "task": { "type": "lexicon_op", "id": "task-1", "mode": "interactive" },
  "inputs": {
    "lexicon_op": {
      "term": "Emergence",
      "artifact": "core.md",
      "objective": "Define in context"
    }
  }
}
```

### Full Lexicon Op with Controls

```json
{
  "contract": { "type": "UnifiedEngineEnvelope", "version": "1.0.0" },
  "task": { "type": "lexicon_op", "id": "task-1", "mode": "interactive" },
  "inputs": {
    "lexicon_op": {
      "term": "Emergence",
      "artifact": "core.md",
      "objective": "Define in context",
      "constraints": { "max_words": 300, "style": "academic" },
      "format": "prose_then_examples"
    }
  },
  "context": {
    "pov": "explorer",
    "world": "fantasy_world_v2",
    "story_state": { "tension": 7 }
  },
  "controls": {
    "return": {
      "include_prose": true,
      "include_json": true,
      "include_audit": true,
      "include_state_delta": true
    }
  }
}
```

### Minimal HCE Run

```json
{
  "contract": { "type": "UnifiedEngineEnvelope", "version": "1.0.0" },
  "task": { "type": "hce_run", "id": "task-2", "mode": "test" },
  "inputs": {
    "hce_run": {
      "topic": "How does economy affect power?",
      "observations": ["Resource scarcity", "Trade imbalance"],
      "assumptions": ["Actors are rational"],
      "constraints": { "max_iterations": 10 }
    }
  }
}
```

### Minimal Scene Generation

```json
{
  "contract": { "type": "UnifiedEngineEnvelope", "version": "1.0.0" },
  "task": { "type": "scene", "id": "task-3", "mode": "interactive" },
  "inputs": {
    "scene": {
      "scene_brief": {
        "setting": "Ancient library",
        "atmosphere": "tense",
        "pov": "explorer"
      }
    }
  }
}
```

### Minimal Sentence Analysis

```json
{
  "contract": { "type": "UnifiedEngineEnvelope", "version": "1.0.0" },
  "task": { "type": "analyze_sentence", "id": "task-4", "mode": "test" },
  "inputs": {
    "analyze_sentence": {
      "sentence": "The dragon emerged from the mist, wings unfurled."
    }
  }
}
```

## Response Structure

### Success Response

```json
{
  "ok": true,
  "taskId": "task-1",
  "taskType": "lexicon_op",
  "outputs": {
    "lexicon_op": {
      "term": "Emergence",
      "definition": "...",
      "provenance": "core.md",
      "artifact_link": { "file": "core.md", "line": 42 }
    }
  },
  "audit": {
    "speculative_items": [
      { "id": "s1", "detail": "explore", "hypothesized_payoff": "clarity", "due_by": "tomorrow" }
    ],
    "pov_compliance": {
      "passed": true,
      "notes": ["POV consistent"]
    }
  },
  "state_delta": {
    "story_state": { "last_term": "Emergence" },
    "lexicon_state": { "new_entries": 1 }
  }
}
```

### Error Response

```json
{
  "ok": false,
  "taskId": "task-1",
  "taskType": "lexicon_op",
  "errors": ["Handler not found", "Task type must be lowercase"]
}
```

## Type Narrowing

```typescript
import {
  narrowToLexiconOp,
  narrowToHceRun,
  narrowToScene,
  narrowToAnalyzeSentence,
  narrowByTaskType,
} from "@we/protocol";

// Specific narrowing
if (narrowToLexiconOp(envelope)) {
  const term = envelope.inputs.lexicon_op!.term; // Guarantees type
}

// Dynamic narrowing
const narrowed = narrowByTaskType(envelope, "lexicon_op");
if (narrowed) {
  // narrowed is type-narrowed to lexicon_op task
}
```

## Error Handling

```typescript
import { parseUEE, formatValidationErrors } from "@we/protocol";

try {
  const result = parseUEE(raw);
  if (!result.ok) {
    // Detailed error with paths
    console.error(formatValidationErrors(result.errors));
    return;
  }
} catch (err) {
  console.error("Unexpected error:", err);
}
```

## Logging Patterns

```typescript
class MyHandler extends LexiconOpHandlerBase {
  async executeTyped(envelope, context, lexicon_op) {
    this.logStart(context, { term: lexicon_op.term });

    try {
      const result = await this.doWork();
      this.logSuccess(context);
      return this.success(context, result);
    } catch (err) {
      this.logError(context, err);
      return this.error(context, err.message);
    }
  }
}
```

## Field Presence

### Always Present

- `contract` — Identifies as UEE v1.0.0
- `task` — Type, ID, mode
- `inputs` — Task-type specific
- `controls` — Output filtering config

### Optional

- `context` — POV, world, story_state, lexicon_entry
- `outputs` — Set by handler
- `audit` — Set by handler
- `state_delta` — Set by handler

## Handler Registration

```typescript
// Override default handler
const router = getUEERouter();
router.registerHandler("lexicon_op", myCustomHandler);

// Don't forget to bind `this` if using class methods
router.registerHandler("hce_run", (env, ctx) => handler.execute(env, ctx));

// List task types
console.log(router.getRegisteredTaskTypes());
// → ["lexicon_op", "hce_run", "scene", "analyze_sentence", "custom_type", ...]
```

## Audit Fields

| Field                 | Type     | Purpose                          |
| --------------------- | -------- | -------------------------------- |
| `speculative_items`   | Array    | Ideas to explore later           |
| `foreshadow_ledger`   | Array    | Event predictions                |
| `constraints_checked` | string[] | Which constraints were validated |
| `pov_compliance`      | Object   | POV consistency audit            |
| `connector_usage`     | number   | How many cross-term links used   |

## Controls.return Config

```typescript
{
  return: {
    include_prose: true,      // Include narrative explanation
    include_json: true,       // Include structured data
    include_audit: true,      // Include audit trail
    include_state_delta: true // Include state mutations
  }
}
```

Handler computes all; client filters via controls.

## Integration Checklist

- [ ] Import `parseUEE`, `narrowToLexiconOp`, etc. from `@we/protocol`
- [ ] Import `getUEERouter` from `@apps/nucleus/src/router/uee`
- [ ] Extend appropriate base handler class
- [ ] Implement `executeTyped()` method
- [ ] Register handler with router
- [ ] test with sample envelope
- [ ] Add to IDE's send button
- [ ] Display response in preview/lexicon panel
- [ ] Handle error responses gracefully
- [ ] Log to console for debugging

## Common Mistakes

❌ Not narrowing before accessing inputs:

```typescript
// BAD: runtime error if wrong type
const term = envelope.inputs.lexicon_op.term;

// GOOD: type-safe
if (narrowToLexiconOp(envelope)) {
  const term = envelope.inputs.lexicon_op!.term;
}
```

❌ Throwing exceptions instead of returning error response:

```typescript
// BAD: crashes router
throw new Error("Something failed");

// GOOD: handler returns error response
return this.error(context, "Something failed");
```

❌ Using raw task type without validation:

```typescript
// BAD: task type could be anything
const handler = this.handlers[rawTaskType];

// GOOD: router validates task type first
// (handled by router.route automatically)
```

❌ Not applying state_delta:

```typescript
// BAD: state gets lost
const response = await router.route(envelope, sessionId);

// GOOD: apply mutations
if (response.state_delta) {
  engine.applyDelta(response.state_delta);
}
```

## Resources

- **Full Integration Guide**: `docs/UEE_INTEGRATION.md`
- **Protocol Schema**: `packages/protocol/src/envelopes/uee/schema.ts`
- **Validation Guards**: `packages/protocol/src/envelopes/uee/guards.ts`
- **Router Implementation**: `apps/nucleus/src/router/uee.ts`
- **Handler Base Classes**: `apps/nucleus/src/router/handlers/base.ts`
- **Example Usage**: See test files in each package
