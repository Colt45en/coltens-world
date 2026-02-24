# World Engine Governance & Memory Seeding Implementation

## Overview

Implemented a complete deterministic seeding system and review queue workflow for World Engine governance, memory management, and lexicon indexing. This enables:

- ✅ **Deterministic initialization** of governance structures (taxonomy, lexicon, memory)
- ✅ **Review queue** for quarantining unvalidated artifacts and entries
- ✅ **Approval workflow** to promote items from review → canonical memory/lexicon
- ✅ **Decision logging** for full traceability and audit trail
- ✅ **Atomic writes** to prevent data corruption
- ✅ **Zod contracts** for strict validation across all data structures

---

## Architecture

```
┌─ scripts/seed/seed-world-engine.ts (Deterministic Generator)
│  ├─ Generates taxonomy.registry.json
│  ├─ Generates lexicon entries + lexicon.index.json
│  ├─ Generates 12 knowledge.ndjson artifacts
│  └─ Generates review.queue.ndjson (demo item)
│
├─ packages/brain/src/review/
│  ├─ reviewTypes.ts (Zod schemas + types)
│  ├─ reviewStore.ts (Store operations)
│  └─ cli/review-promote.ts (CLI for approve/reject)
│
└─ Directory structure:
   ├─ docs/taxonomy/taxonomy.registry.json
   ├─ docs/lexicon/
   │  ├─ entries/*.lexicon.json
   │  └─ lexicon.index.json
   └─ .brain/
      ├─ memory/knowledge.ndjson (canonical)
      ├─ review/
      │  ├─ review.queue.ndjson (pending)
      │  └─ review.decisions.ndjson (audit log)
      └─ README.md
```

---

## Implementation Details

### 1. **Seeding Script** — `scripts/seed/seed-world-engine.ts`

**Purpose**: Deterministically generate governance + memory + lexicon structures from a single seed.

**Features**:

- **Deterministic RNG**: Uses mulberry32 seeded RNG (no Math.random())
- **Stable IDs**: sha256-based stable ID generation for reproducibility
- **Idempotent**: Won't overwrite existing files unless `--force` flag used
- **Content-addressed**: All structures include hash provenance for replay

**Generated Artifacts**:

1. **taxonomy.registry.json** — Governance structure

   ```json
   {
     "schemaVersion": "1.0.0",
     "generatedAt": "2026-02-12T...",
     "operators": [...],
     "modules": [...],
     "tags": [...],
     "allowUnknownTags": false
   }
   ```

2. **lexicon entries** (3 core entries: Optimize, Determinism, ReviewQueue)

   ```json
   {
     "id": "lex_XXXXXXXXXXXX",
     "canonicalTerm": "Optimize",
     "code_process_tag": "prompt.operator.optimize",
     "type": "operator",
     "meaning": "...",
     "use": [...],
     "methodology": [...],
     "examples": [...],
     "anti_patterns": [...],
     "tests_validation": [...]
   }
   ```

3. **lexicon.index.json** — Index & content hash for replay

   ```json
   {
     "schemaVersion": "1.0.0",
     "generatedAt": "2026-02-12T...",
     "entries": [{"id", "canonicalTerm", "code_process_tag", "type", "file"}, ...],
     "contentHash": "sha256..."
   }
   ```

4. **knowledge.ndjson** — 12 canonical artifacts with provenance

   ```ndjson
   {"artifactId": "art_XXXXXXXXXXXX", "operator": "prompt.operator.seed", "concept": "determinism", ...}
   {"artifactId": "art_XXXXXXXXXXXX", "operator": "prompt.operator.validate", ...}
   ...
   ```

5. **review.queue.ndjson** — Demo pending review item
   ```ndjson
   {"id": "rq_XXXXXXXXXXXX", "kind": "artifact.suggestion", "status": "pending", ...}
   ```

**Usage**:

```bash
# Run with default seed (1337)
pnpm run seed:world-engine

# Run with custom seed
pnpm tsx scripts/seed/seed-world-engine.ts --seed 1337

# Overwrite existing files (careful!)
pnpm tsx scripts/seed/seed-world-engine.ts --seed 1337 --force
```

**Output**: JSON summary with hashes and file paths

```json
{
  "seed": 1337,
  "wrote": {
    "taxonomyRegistry": true,
    "lexiconEntries": true,
    "lexiconIndex": true,
    "memoryNdjson": true,
    "reviewQueueNdjson": true
  },
  "hashes": {
    "taxonomyRegistryHash": "sha256...",
    "lexiconIndexHash": "sha256..."
  }
}
```

---

### 2. **Review Types & Contracts** — `packages/brain/src/review/reviewTypes.ts`

**Purpose**: Strict Zod-based contracts for review queue items, decisions, and artifacts.

**Exports**:

```typescript
// Enums/types
export type ReviewKind = "lexicon.entry.suggestion" | "artifact.suggestion";
export type ReviewStatus = "pending" | "approved" | "rejected";

// Schemas
ReviewQueueItemSchema; // Review item (pending/approved/rejected)
ReviewDecisionSchema; // Audit record of approval/rejection decision
LexiconEntrySchema; // Lexicon entry (minimal but extendable)
KnowledgeArtifactSchema; // Knowledge artifact with provenance

// Validators
IsoDateTimeSchema; // RFC 3339 ISO datetime
```

**Example Review Item**:

```typescript
interface ReviewQueueItem {
  schemaVersion: "1.0.0";
  id: string; // rq_XXXXXXXXXXXX
  createdAt: string; // ISO datetime
  kind: ReviewKind; // lexicon.entry.suggestion | artifact.suggestion
  status: ReviewStatus; // pending | approved | rejected
  reason: string; // Why this was queued
  payload: unknown; // Flexible for different item types
}
```

**Example Review Decision**:

```typescript
interface ReviewDecision {
  schemaVersion: "1.0.0";
  decisionId: string; // dec_XXXXXXXXXXXX
  itemId: string; // ref to original review queue item
  decidedAt: string; // ISO datetime
  decision: "approve" | "reject";
  reviewer: string; // Who made the decision
  reason: string; // Why approve/reject
  effects: {
    wroteMemory: boolean; // Appended to knowledge.ndjson
    wroteLexiconEntry: boolean; // Wrote to docs/lexicon/entries/
    rebuiltLexiconIndex: boolean; // Rebuilt docs/lexicon/lexicon.index.json
    updatedQueue: boolean; // Updated review.queue.ndjson
  };
}
```

---

### 3. **Review Store** — `packages/brain/src/review/reviewStore.ts`

**Purpose**: Store operations for reading/updating review queue and writing decisions.

**Key Functions**:

```typescript
// Load all pending items
async function loadQueue(opts: ReviewPromoteOptions): Promise<ReviewQueueItem[]>;

// Find single item by ID
async function loadQueueItemById(
  opts: ReviewPromoteOptions,
  id: string,
): Promise<ReviewQueueItem | null>;

// Promote item (approve/reject) → atomically update queue + write decision
async function promoteReviewItem(params: {
  opts: ReviewPromoteOptions;
  id: string;
  decision: "approve" | "reject";
  reviewer: string;
  reason: string;
}): Promise<PromoteResult>;

// Rebuild lexicon index from entries directory (deterministic, sorted)
async function rebuildLexiconIndex(lexiconEntriesDir: string): Promise<LexiconIndex>;
```

**Effects on Approve**:

1. If `payload.artifact` present → append to `.brain/memory/knowledge.ndjson`
2. If `payload.lexiconEntry` present → write to `docs/lexicon/entries/{id}.lexicon.json`
3. If lexicon entry written → rebuild `docs/lexicon/lexicon.index.json` (deterministically)
4. Update review queue item status → approved
5. Append decision record to `.brain/review/review.decisions.ndjson` (append-only audit log)

**Atomicity**:

- Queue file rewritten atomically (write to temp, then rename)
- Decisions appended (append-only, safe)
- Lexicon index written atomically

---

### 4. **Review Promotion CLI** — `packages/brain/src/cli/review-promote.ts`

**Purpose**: Command-line tool to approve/reject review items.

**Usage**:

```bash
# Approve a review item
pnpm run review:promote -- --id rq_XXXXXXXXXXXX --approve --reviewer Colten --reason "Looks good"

# Reject a review item
pnpm run review:promote -- --id rq_XXXXXXXXXXXX --reject --reviewer Colten --reason "Needs taxonomy update"

# With explicit paths
pnpm run review:promote -- \
  --id rq_XXXXXXXXXXXX \
  --approve \
  --reviewer Colten \
  --reason "Promote to canonical" \
  --queue-file .brain/review/review.queue.ndjson \
  --decisions-file .brain/review/review.decisions.ndjson \
  --memory-file .brain/memory/knowledge.ndjson \
  --lexicon-entries-dir docs/lexicon/entries \
  --lexicon-index-file docs/lexicon/lexicon.index.json
```

**Output**: JSON decision record

```json
{
  "schemaVersion": "1.0.0",
  "decisionId": "dec_XXXXXXXXXXXX",
  "itemId": "rq_XXXXXXXXXXXX",
  "decidedAt": "2026-02-12T12:34:56Z",
  "decision": "approve",
  "reviewer": "Colten",
  "reason": "Promote to canonical",
  "effects": {
    "wroteMemory": false,
    "wroteLexiconEntry": false,
    "rebuiltLexiconIndex": false,
    "updatedQueue": true
  }
}
```

---

## Workflow Example

### Step 1: Seed the system

```bash
pnpm run seed:world-engine
```

Creates:

- `docs/taxonomy/taxonomy.registry.json`
- `docs/lexicon/entries/lex_*.lexicon.json` (3 entries)
- `docs/lexicon/lexicon.index.json`
- `.brain/memory/knowledge.ndjson` (12 artifacts)
- `.brain/review/review.queue.ndjson` (1 demo item: `rq_XXXXXXXXXXXX`)

### Step 2: List pending review items

```bash
# Manually inspect
cat .brain/review/review.queue.ndjson

# Or query
pnpm run review:promote -- --help  # See current options
jq -s 'map(select(.status == "pending"))' .brain/review/review.queue.ndjson
```

### Step 3: Approve a demo item (no-op since it has no artifact/lexicon)

```bash
pnpm run review:promote -- \
  --id rq_XXXXXXXXXXXX \
  --approve \
  --reviewer "System" \
  --reason "Demo item acknowledged"
```

Result:

- `rq_XXXXXXXXXXXX` status → `approved` in `review.queue.ndjson`
- Decision record appended to `review.decisions.ndjson`
- No memory/lexicon written (demo item has no payload.artifact)

### Step 4: Query audit trail

```bash
cat .brain/review/review.decisions.ndjson | jq '.[] | {decisionId, decision, reviewer, reason}'
```

---

## Data Structures & Invariants

### Taxonomy Registry

- **Purpose**: Defines operators, modules, tags for the entire system
- **Managed by**: Seed script (bootstrap only)
- **Updated by**: Manual edit → requires revalidation
- **Role**: Reference for all downstream validation

### Lexicon Entries

- **Purpose**: Define terms, operators, concepts with methodology & examples
- **Managed by**: Review queue promotions (append-only for approved entries)
- **Location**: `docs/lexicon/entries/lex_*.lexicon.json`
- **Index**: `docs/lexicon/lexicon.index.json` (rebuilt on each promotion)
- **Guarantee**: Index hash changes when entries change → enables replay detection

### Knowledge Artifacts

- **Purpose**: Store thought process, decisions, analysis results
- **Managed by**: Review queue promotions + direct append
- **Location**: `.brain/memory/knowledge.ndjson` (append-only)
- **Provenance**: Every artifact includes `provenance.lexiconIndexHash` + `seed` for traceability

### Review Queue

- **Purpose**: Quarantine unknown/unvalidated items
- **Status**: pending → approved/rejected (one-way transition)
- **Format**: NDJSON (can rewrite atomically on decision)
- **Invariant**: Once status leaves "pending", it never changes

### Review Decisions (Audit Log)

- **Purpose**: Record who decided what and when
- **Format**: Append-only NDJSON (never rewrite)
- **Queryable by**: itemId, reviewer, decision, timestamp
- **Guarantee**: Complete audit trail for governance

---

## Integration Points

### Brain System

```typescript
import { ReviewDecision, loadQueue, promoteReviewItem } from "@world-engine/brain";

// Check pending reviews
const pending = (await loadQueue(opts)).filter((x) => x.status === "pending");

// Automatically promote safe items
for (const item of pending) {
  if (isSafeToPromote(item)) {
    await promoteReviewItem({
      opts,
      id: item.id,
      decision: "approve",
      reviewer: "autopilot",
      reason: "Auto-approved",
    });
  }
}
```

### Chat/Agent System

When brain detects an unknown tag:

1. Create review item with `payload.lexiconEntry` or `payload.artifact`
2. Queue it to `review.queue.ndjson`
3. Await human approval via `review:promote` CLI

### CI/CD Integration

```bash
# In CI: fail on unknown tags
pnpm tsx tooling/validate-governance.ts --fail-on-unknown-tag

# Seed on fresh clone
pnpm run seed:world-engine

# Rebuild indices
pnpm run lexicon:index

# Validate schema compliance
pnpm run contracts:check
```

---

## Files Created/Modified

### Created

- `scripts/seed/seed-world-engine.ts` (422 lines, fully deterministic)
- `packages/brain/src/review/reviewTypes.ts` (Zod schemas)
- `packages/brain/src/review/reviewStore.ts` (Store operations + atomic writes)
- `packages/brain/src/cli/review-promote.ts` (CLI tool)

### Modified

- `packages/brain/src/index.ts` (Added exports for review module)
- `package.json` (Added `seed:world-engine` and `review:promote` scripts)

---

## Safety & Correctness Guarantees

✅ **Determinism**: Same seed → identical output (seeded RNG, sorted file reads)
✅ **Idempotency**: Rerunning seed without `--force` won't overwrite
✅ **Atomicity**: Queue/index updates are atomic (write-then-rename)
✅ **Audit Trail**: All decisions logged append-only in `review.decisions.ndjson`
✅ **Schema Validation**: All reads/writes validated with Zod
✅ **Provenance**: Every artifact includes lexicon hash + seed for replay
✅ **No Data Loss**: Review decisions are one-way; history preserved

---

## Next Steps

Optional enhancements:

1. **Auto-enqueue CLI**: `pnpm run review:enqueue -- --artifact <file.json>`
   - Creates properly-formatted review items from arbitrary JSON

2. **Query CLI**: `pnpm run review:query -- --pending | --approved | --all`
   - List/filter review queue and decision history

3. **Governance Validator**: `pnpm run validate:governance -- --fail-on-unknown-tag`
   - Catch unknown tags/operators in the pipeline before seeding

4. **Lexicon Diff**: `pnpm run lexicon:diff -- --old <hash1> --new <hash2>`
   - Show what changed between lexicon indices (deterministic)

---

## Testing Locally

```bash
# 1. Seed the system
pnpm run seed:world-engine

# 2. Inspect generated files
ls -la docs/taxonomy/
ls -la docs/lexicon/entries/
cat .brain/memory/knowledge.ndjson | wc -l
cat .brain/review/review.queue.ndjson | jq '.id'

# 3. Approve the demo item
pnpm run review:promote -- \
  --id $(cat .brain/review/review.queue.ndjson | jq -r '.id') \
  --approve \
  --reviewer Colten \
  --reason "Demo approved"

# 4. Verify decision was recorded
cat .brain/review/review.decisions.ndjson | jq '.decision,.reviewer'

# 5. Verify queue item was updated
cat .brain/review/review.queue.ndjson | jq '.status'
```

Expected:

- Queue item status changed to `approved`
- Decision record created with reviewer, timestamp, reason
- No changes to already-approved demo item (idempotent)
