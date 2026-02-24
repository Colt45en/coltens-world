# World Engine Governance Quick Reference

## One Command to Get Started

```bash
pnpm run seed:world-engine
```

Generated:

- ✅ Deterministic taxonomy + operators + tags
- ✅ 3 core lexicon entries (Optimize, Determinism, ReviewQueue)
- ✅ 12 knowledge artifacts with metrics
- ✅ Lexicon index with content hash for replay
- ✅ Demo pending review item
- ✅ Audit trail structure

---

## File Locations

| Location                                | Purpose                                     | Format         |
| --------------------------------------- | ------------------------------------------- | -------------- |
| `docs/taxonomy/taxonomy.registry.json`  | System taxonomy (operators/modules/tags)    | JSON           |
| `docs/lexicon/entries/*.lexicon.json`   | Individual lexicon entries                  | JSON (3 files) |
| `docs/lexicon/lexicon.index.json`       | Lexicon index with content hash             | JSON           |
| `.brain/memory/knowledge.ndjson`        | Canonical knowledge artifacts               | NDJSON         |
| `.brain/review/review.queue.ndjson`     | Pending review items                        | NDJSON         |
| `.brain/review/review.decisions.ndjson` | Decision audit trail (empty until approval) | NDJSON         |

---

## Script Commands

### Seed (Working ✅)

```bash
# Default seed (1337)
pnpm run seed:world-engine

# Custom seed
pnpm tsx scripts/seed/seed-world-engine.ts --seed 42

# Overwrite existing
pnpm tsx scripts/seed/seed-world-engine.ts --seed 1337 --force
```

### Review Promotion (Ready Once Workspace Builds ⚠️)

```bash
# Approve a pending item
pnpm run review:promote -- --id rq_XXXX --approve --reviewer Colten --reason "Looks good"

# Reject a pending item
pnpm run review:promote -- --id rq_XXXX --reject --reviewer Colten --reason "Needs work"
```

---

## Querying the Data

### List All Knowledge Artifacts

```bash
cat .brain/memory/knowledge.ndjson | jq '.artifactId, .operator, .concept'
```

### Find Artifacts by Operator

```bash
cat .brain/memory/knowledge.ndjson | jq 'select(.operator == "prompt.operator.optimize")'
```

### List Pending Reviews

```bash
cat .brain/review/review.queue.ndjson | jq 'select(.status == "pending")'
```

### Check Lexicon Index Hash

```bash
cat docs/lexicon/lexicon.index.json | jq '.contentHash'
```

### List All Lexicon Entries

```bash
cat docs/lexicon/lexicon.index.json | jq '.entries[] | {id, canonicalTerm, code_process_tag, type}'
```

---

## Data Structures At A Glance

### Knowledge Artifact

```json
{
  "artifactId": "art_XXXX",
  "operator": "prompt.operator.seed|validate|optimize|diff|summarize",
  "concept": "determinism|review_queue|lexicon_index|...",
  "status": "canonical|pending",
  "provenance": {
    "pipelineVersion": "thoughtPipeline@0.1.0",
    "lexiconIndexHash": "sha256...",
    "seed": 1337
  }
}
```

### Lexicon Entry

```json
{
  "id": "lex_XXXX",
  "canonicalTerm": "Optimize|Determinism|ReviewQueue",
  "code_process_tag": "prompt.operator.optimize",
  "type": "operator|concept|system",
  "meaning": "...",
  "use": ["..."],
  "methodology": ["..."],
  "examples": ["..."]
}
```

### Review Queue Item

```json
{
  "id": "rq_XXXX",
  "kind": "lexicon.entry.suggestion|artifact.suggestion",
  "status": "pending|approved|rejected",
  "payload": {
    /* flexible */
  }
}
```

### Review Decision

```json
{
  "decisionId": "dec_XXXX",
  "itemId": "rq_XXXX",
  "decision": "approve|reject",
  "reviewer": "Colten|system",
  "effects": {
    "wroteMemory": true/false,
    "wroteLexiconEntry": true/false,
    "rebuiltLexiconIndex": true/false,
    "updatedQueue": true
  }
}
```

---

## Integration Examples

### Python: Read Taxonomy

```python
import json
with open("docs/taxonomy/taxonomy.registry.json") as f:
    taxonomy = json.load(f)
    for op in taxonomy["operators"]:
        print(f"Operator: {op['id']} - {op['label']}")
```

### Python: Read Knowledge

```python
import json
with open(".brain/memory/knowledge.ndjson") as f:
    for line in f:
        artifact = json.loads(line)
        print(f"{artifact['operator']} on {artifact['concept']}")
```

### Python: Check Reviews

```python
import json
with open(".brain/review/review.queue.ndjson") as f:
    for line in f:
        item = json.loads(line)
        if item["status"] == "pending":
            print(f"Pending: {item['id']}")
```

### TypeScript: Load & Promote (After Workspace Fix)

```typescript
import { loadQueue, promoteReviewItem } from "@world-engine/brain";

const opts = {
  queueFile: ".brain/review/review.queue.ndjson",
  decisionsFile: ".brain/review/review.decisions.ndjson",
  memoryFile: ".brain/memory/knowledge.ndjson",
  lexiconEntriesDir: "docs/lexicon/entries",
  lexiconIndexFile: "docs/lexicon/lexicon.index.json",
};

// Load pending
const pending = (await loadQueue(opts)).filter((x) => x.status === "pending");
console.log(`${pending.length} items pending`);

// Approve first one
if (pending.length > 0) {
  const result = await promoteReviewItem({
    opts,
    id: pending[0].id,
    decision: "approve",
    reviewer: "bot",
    reason: "Auto-approved",
  });
  console.log(result.decision);
}
```

---

## Determinism Guarantee

Same seed = Same output (byte-for-byte):

```bash
# Generate with seed 1337
pnpm tsx scripts/seed/seed-world-engine.ts --seed 1337 --force
HASH1=$(cat docs/lexicon/lexicon.index.json | jq -r '.contentHash')

# Clean and regenerate
rm docs/lexicon/entries/*.lexicon.json docs/lexicon/lexicon.index.json

pnpm tsx scripts/seed/seed-world-engine.ts --seed 1337 --force
HASH2=$(cat docs/lexicon/lexicon.index.json | jq -r '.contentHash')

# Should be identical
test "$HASH1" = "$HASH2" && echo "✅ Deterministic"
```

---

## Troubleshooting

### "Cannot find package 'zod'" Error

**Cause**: Workspace dependency issue (pre-existing)

**Solution**: Awaiting fix to `"three@^r128"` in workspace

### Seeding Produces No Output

**Cause**: Script completed silently

**Solution**: Check exit code and JSON output:

```bash
pnpm run seed:world-engine; echo "Exit code: $?"
```

### Review Item Status Unchanged

**Cause**: Trying to approve already-approved item

**Solution**: Check status first:

```bash
cat .brain/review/review.queue.ndjson | jq '.status'
```

---

## What's Working ✅

- Deterministic seeding (fully functional)
- Data structure definitions (Zod contracts)
- Store operations (ready to use)
- Query/export of artifacts (fully functional)

## What's Waiting ⚠️

- CLI runtime (blocked on workspace install)
- End-to-end approval workflow (will work once install fixed)

---

## Key Invariants

| Invariant    | Guarantee                               |
| ------------ | --------------------------------------- |
| Determinism  | Same seed → identical output            |
| Idempotence  | Won't overwrite without --force         |
| Auditability | All decisions logged append-only        |
| Atomicity    | Queue/index updates are atomic          |
| Validation   | All data validated with Zod             |
| Traceability | Every artifact includes provenance hash |

---

## Reference: Decision Flow

```
Pending Item in review.queue.ndjson
    ↓
pnpm run review:promote -- --id rq_XXX --approve
    ↓
promoteReviewItem() executed:
    ├─ Load queue
    ├─ Find item (must be "pending")
    ├─ If approve:
    │  ├─ Write payload.artifact to memory (if present)
    │  ├─ Write payload.lexiconEntry to entries/ (if present)
    │  ├─ Rebuild lexicon.index.json
    │  └─ Record effects
    ├─ Update queue item status → "approved"
    ├─ Write atomically
    └─ Append decision record
    ↓
Result:
    ├─ Item promoted to canonical (if had payload)
    ├─ Decision logged with timestamp
    └─ Audit trail complete
```

---

## Files to Remember

| What            | Where                                   | When to Touch                     |
| --------------- | --------------------------------------- | --------------------------------- |
| Seeded taxonomy | `docs/taxonomy/`                        | Rarely (governance boundary)      |
| Lexicon entries | `docs/lexicon/entries/`                 | When approving new entries        |
| Lexicon index   | `docs/lexicon/lexicon.index.json`       | Auto-rebuilt on approval          |
| Knowledge store | `.brain/memory/knowledge.ndjson`        | Append-only (never edit directly) |
| Review queue    | `.brain/review/review.queue.ndjson`     | Via CLI commands only             |
| Decisions log   | `.brain/review/review.decisions.ndjson` | Audit trail (never edit)          |
