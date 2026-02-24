# Autonomy Loop MVP: Multi-Agent Knowledge Artifact Pipeline

A deterministic, measured, governance-driven system that transforms raw input (code, text, world lore) into validated knowledge artifacts with decision records and weekly operational reports.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTONOMY LOOP PIPELINE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  INPUT (raw code/text/lore)                                    │
│    ↓                                                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ DETECTIVE (ingest.py)                                    │   │
│  │ - Tokenize: words + symbols                              │   │
│  │ - Extract raw claims with confidence                     │   │
│  │ - Deterministic EvidencePacket JSON                      │   │
│  └──────────────────────────────────────────────────────────┘   │
│    ↓                                                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ ALCHEMIST (transform.py)                                 │   │
│  │ - Morphology analysis (root + affixes)                   │   │
│  │ - Semantic lenses (multi-interpretation)                 │   │
│  │ - Process tag classification (define/call/import/...)    │   │
│  │ - Generates stable IDs (deterministic from content)      │   │
│  │ - LexiconEntry[] + RuneDecoderRow[]                      │   │
│  └──────────────────────────────────────────────────────────┘   │
│    ↓                                                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ ANALYST (gates.py)                                       │   │
│  │ - 5 Validation Gates:                                    │   │
│  │   1. schema_validation - All artifacts valid             │   │
│  │   2. determinism - Output hash matches expected          │   │
│  │   3. dedupe_audit - No ID collisions                     │   │
│  │   4. confidence_threshold - Min confidence met           │   │
│  │   5. traceability - batch_id + source_ref present        │   │
│  │ - Status: PASSED / WARNING / FAILED                      │   │
│  │ - ValidatedPlan JSON with gate details                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│    ↓                                                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ SPECIALIST (persist.py)                                  │   │
│  │ - SQLite schema with indexes                             │   │
│  │ - Merge policy governance (v1.0 - v3.0)                 │   │
│  │ - Review queue for low-confidence items                  │   │
│  │ - Merge history + policy versioning                      │   │
│  │ - Upsert with collision detection                        │   │
│  │ - Database: world.db                                     │   │
│  └──────────────────────────────────────────────────────────┘   │
│    ↓                                                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ PM (report.py)                                           │   │
│  │ - DecisionRecord: approval/block + rationale             │   │
│  │ - WeeklyOpsReport with 6 narrative modes:                │   │
│  │   A) slice_of_life - What ran                            │   │
│  │   B) rising_action - Metrics pressure                    │   │
│  │   C) conflict - Tradeoffs detected                       │   │
│  │   D) climax - Decision point                             │   │
│  │   E) falling_action - Mitigation results                 │   │
│  │   F) resolution - New baseline                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│    ↓                                                             │
│  OUTPUTS: 7 validated artifacts                                 │
│    - decision_record.json                                       │
│    - weekly_ops_report.json                                     │
│    - (+ evidence_packet, lexicon_entries, rune_rows, etc.)     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

```bash
# Python 3.10+
pip install -r apps/py-sidecar/requirements.txt

# TypeScript (for schema validation only; schemas exported from lexicon package)
# Already available in workspace
```

### Run Full Pipeline

```bash
cd apps/py-sidecar

python pipeline.py \
  --input <path-to-code-file> \
  --language TypeScript \
  --objective "extract API signatures and dependencies" \
  --narrative slice_of_life \
  --output-dir ../results
```

**Example:**

```bash
python pipeline.py \
  --input ../../ide-web/src/main.ts \
  --language TypeScript \
  --objective "extract IDE module structure" \
  --output-dir ../../pipeline_results
```

### Output Directory

```
pipeline_results/
├── pipeline.log                 # Execution log
├── evidence_packet.json         # Detective output
├── lexicon_entries.json         # Alchemist output
├── rune_rows.json              # Alchemist output
├── validated_plan.json         # Analyst output
├── world.db                    # Specialist SQLite database
├── decision_record.json        # PM output
└── weekly_ops_report.json      # PM output (narrative mode)
```

## Core Concepts

### 1. **State → Condition → Status** (Governance Spine)

Every artifact is computed, never asserted as "vibes":

| Concept       | Meaning        | Example                                                              |
| ------------- | -------------- | -------------------------------------------------------------------- |
| **State**     | Measured facts | `collision_rate: 0.08`, `avg_confidence: 0.82`                       |
| **Condition** | Boolean gates  | `determinism_verified: true`, `all_critical_gates_passed: false`     |
| **Status**    | Computed label | `GREEN` (all gates pass), `YELLOW` (warnings), `RED` (critical fail) |

### 2. **Meaning as Graded Claims**

Meaning is never stored as "it is X". Instead:

```json
{
  "semantic_lenses": [
    {
      "lens_name": "mathematical",
      "meaning": "Vec3 represents a 3D vector",
      "confidence": 0.95,
      "evidence_links": ["line 42", "examples/vector.ts"]
    },
    {
      "lens_name": "behavioral",
      "meaning": "Vec3 supports immutable operations",
      "confidence": 0.75
    }
  ],
  "overall_confidence": 0.75  // MIN of lenses
  "review_required": true  // confidence < 0.8
}
```

Low confidence → **automatic review queue** (not a guess; a measured policy).

### 3. **Dedupe as Policy Decision**

When two entries collide, the **Merge Policy** decides:

**Policy v1.0 (Naive)**

- Reject all collisions
- Safe but creates duplicates

**Policy v2.0 (Confidence-based)** ⬅ DEFAULT

- Merge if `min(confidence1, confidence2) > 0.8`
- Enables safe deduplication

**Policy v3.0 (Namespace-aware)**

- Same namespace → merge
- Different namespace → fork (create separate entries)

Decisions are logged in `merge_history` table + versioned.

### 4. **Objective Function = Measured Success**

Every batch specifies:

```json
{
  "objective": "detect API breaking changes",
  "constraints": [
    "deterministic output for same input",
    "schema-valid artifacts",
    "no regressions in coverage"
  ],
  "acceptance_tests": [
    { "test_name": "schema_valid", "gate": "schema_validation", "threshold": 100 },
    { "test_name": "determinism_ok", "gate": "determinism", "threshold": 1.0 }
  ]
}
```

Gates are **pass/fail**, not opinions.

## Artifacts (MVP Outputs)

### 1. **EvidencePacket** (Detective)

Raw tokens + meaning claims + unknowns in deterministic JSON.

```json
{
  "batch_id": "batch-abc123",
  "ingested_at": "2026-02-11T10:30:00Z",
  "tokens": [{ "token": "async", "token_type": "symbol", "count": 42, "initial_confidence": 0.9 }],
  "meaning_claims": [
    { "claim": "'async' is a JavaScript keyword", "confidence": 0.95, "source_ref": "line 5" }
  ],
  "content_hash": "9d3e8a2f1b4c"
}
```

### 2. **LexiconEntry[]** (Alchemist)

Structured vocabulary with morphology, semantic lenses, examples.

```json
{
  "entry_id": "lex-8f2e90a",
  "term": "async",
  "language": "TypeScript",
  "morphology": {"root": "async", "affixes": [], "pos": "keyword"},
  "semantic_lenses": [...],
  "overall_confidence": 0.95,
  "review_required": false
}
```

### 3. **RuneDecoderRow[]** (Alchemist)

Code symbols with process tags and methodology.

```json
{
  "rune_id": "rune-5d2e9c1",
  "symbol": "useEffect",
  "language": "TypeScript",
  "process_tag": "call",
  "tag_confidence": 0.85,
  "meaning": "React hook for side effects",
  "methodologies": [...]
}
```

### 4. **ValidatedPlan** (Analyst)

Gate results + determinism verification + collision audit.

```json
{
  "batch_id": "batch-abc123",
  "gates": [
    {"gate_name": "schema_validation", "passed": true},
    {"gate_name": "determinism", "passed": true},
    {"gate_name": "dedupe_audit", "passed": true},
    ...
  ],
  "overall_status": "passed",
  "content_hash": "3a2e91f8b4d"
}
```

### 5. **DecisionRecord** (PM)

Approval/block decision with rationale and risks.

```json
{
  "batch_id": "batch-abc123",
  "decisions": [
    {
      "decision_id": "DECIDE-batch-abc123-gates",
      "choice": "APPROVED",
      "rationale": "All critical gates passed",
      "authority": "PM / Automation",
      "decided_at": "2026-02-11T10:35:00Z"
    }
  ],
  "approved_for_release": true
}
```

### 6. **WeeklyOpsReport** (PM)

Narrative-driven operational summary with 6 story modes.

```json
{
  "week_starting": "2026-02-10",
  "narrative_mode": "rising_action",
  "what_changed": "Collision rate rising to 12%. Unknown tags at 8. Confidence dropping in lexicon domain.",
  "metrics": [
    {"metric_name": "collision_rate", "current_value": 0.12, "trend": "degrading", "status": "yellow"}
  ],
  "unknowns": [...],
  "health_score": 0.72,
  "status": "yellow",
  "next_week_priorities": [...]
}
```

## Governance: Merge Policies

### How Merging Works

When Detective → Alchemist → Analyst detects that two entries have the same key:

- `(term='vector', language='TypeScript', namespace='math')`

The **Merge Policy** decides:

```python
merge_policy = MergePolicy('2.0')  # Confidence-based
should_merge, reason = merge_policy.should_merge(entry1, entry2)

if should_merge:
  keep_entry = entry1 if entry1.confidence > entry2.confidence else entry2
  log_merge_decision(entry1.id, entry2.id, reason)
  store.upsert(keep_entry)
else:
  raise ValueError(f"Collision policy violation: {reason}")
```

### Policy Versioning

Each merge decision is logged with policy version:

```sql
INSERT INTO merge_history
  (decision_id, from_ids, to_id, policy_version, reason, decided_at)
VALUES
  ("merge-xyz", ["lex-old"], "lex-new", "2.0", "confidence > 0.8", ...)
```

This allows:

- **Audit trails**: Why was entry X merged into Y?
- **Policy migration**: Change policy v2.0 → v3.0, re-run batches, compare decisions
- **Governance**: Review board can override merges by changing policy

## Review Queue

Items with `review_required: true` are automatically added:

```sql
INSERT INTO review_queue
  (item_type, item_id, reason, priority, created_at)
VALUES
  ('lexicon', 'lex-abc123', 'Low confidence (0.65)', 'medium', ...)
```

Weekly PM report includes review queue size + priorities.

## Determinism & Reproducibility

**All deterministic hashes:**

- Token extraction uses sorted order
- IDs are generated from SHA256(content_key) deterministically
- EvidencePacket hash computed from sorted token list
- ValidatedPlan hash computed from gate results

**Same input → Same output HASH** (bit-for-bit reproducible).

You can replay a batch and confirm:

```bash
python gates.py --lex lex.json --rune rune.json --packet packet.json
# Compare content_hash fields — must match
```

## Integration with World Engine

### Using LexiconEntry in Nucleus

```typescript
// From packages/lexicon, import schemas
import { LexiconEntry, RuneDecoderRow } from "@world-engine/lexicon";

// Query from SQLite or memory
const entry = await lexicon.query({
  query: "async",
  language: "TypeScript",
});

// entry.semantic_lenses[0].meaning
// entry.overall_confidence
// entry.review_required
```

### Using RuneDecoderRow in IDE/Brain

```typescript
// Find code patterns
const runes = await lexicon.search({
  process_tag: "call",
  language: "TypeScript",
});

// runes[0].meaning, methodologies, confidence
```

## Operations: Running Weekly

### Day 1–4: Process Batch

```bash
# Monday: New code comes in
python pipeline.py --input new_code.ts --objective "extract API changes"
# → Outputs all 7 artifacts

# Check decision_record.json
# If "APPROVED", proceed to persistence

# Check weekly_ops_report.json with narrative_mode="rising_action"
# If collision_rate rising, escalate
```

### Week N: Generate Weekly Report

```bash
# Friday: Aggregate all batches from the week
python report.py \
  --plan validated_plan.json \
  --db world.db \
  --batch-id batch-1 \
  --narrative-mode "conflict" \
  --week 2026-02-10

# Read weekly_ops_report.json
# Identify regressions, unknowns, next actions
```

### Monthly: Policy Audit

```bash
# Query merge history
SELECT COUNT(*), policy_version FROM merge_history GROUP BY policy_version;

# If policy_version 2.0 has many collisions:
# - Consider tightening confidence threshold
# - OR migrate to policy v3.0 (namespace-aware)
# - Document decision in governance_changes
```

## Testing & Validation

### Run against test file

```bash
python pipeline.py \
  --input ../py-sidecar/leximorph.py \
  --language Python \
  --objective "extract lexicon morphology patterns"
```

### Validate determinism

```bash
# Run twice on same input
python pipeline.py --input test.ts > run1/
python pipeline.py --input test.ts > run2/

# Compare content hashes
diff run1/evidence_packet.json run2/evidence_packet.json  # Should be identical
diff run1/lexicon_entries.json run2/lexicon_entries.json  # Should be identical
diff run1/validated_plan.json run2/validated_plan.json    # Should be identical
```

### Inspect database

```bash
sqlite3 world.db

SELECT COUNT(*) FROM lexicon_entries;
SELECT term, overall_confidence, review_required FROM lexicon_entries WHERE review_required = 1;
SELECT from_ids, reason FROM merge_history;
```

## Roadmap: LEX-0007 → LEX-0010

| Item         | Purpose                       | Status                                                      |
| ------------ | ----------------------------- | ----------------------------------------------------------- |
| **LEX-0007** | Review Queue Management       | Partial (auto-add to queue; manual resolution UI not built) |
| **LEX-0008** | Process Tag Taxonomy Registry | Partial (hardcoded tags; registry UI not built)             |
| **LEX-0009** | Regression Test Harness       | Not implemented (but structure is in place)                 |
| **LEX-0010** | Policy Versioning UI          | Partial (policy versions in SQLite; UI not built)           |

## Files Reference

### Python (Detective → PM)

- `ingest.py` — Detective
- `transform.py` — Alchemist
- `gates.py` — Analyst
- `persist.py` — Specialist
- `report.py` — PM
- `pipeline.py` — Orchestrator

### TypeScript (Schemas)

- `packages/lexicon/src/autonomy-artifacts.ts` — Zod schemas
- `packages/lexicon/src/index.ts` — Exports

### Database

- `world.db` — SQLite with 6 tables + indexes + merge history

## Key Invariants

1. ✅ **Determinism**: Same input → same output hash always
2. ✅ **Traceability**: Everything has batch_id, source_ref, stable ID
3. ✅ **Schema Validity**: All artifacts validate against Zod schemas
4. ✅ **Measurement**: No vibes; gates are pass/fail; metrics are numbers
5. ✅ **Decision Safety**: Merge policy versioned; decisions logged; can audit
6. ✅ **Review Queue**: Low-confidence items auto-flagged; never silently wrong

## Troubleshooting

| Issue                          | Check                                                                    |
| ------------------------------ | ------------------------------------------------------------------------ |
| `schema_validation` gate fails | Run gates.py with `--output validated_plan.json`, inspect `failed_items` |
| Determinism gate fails         | Content hashes don't match; check for randomness in tokenization         |
| Dedupe collisions              | Query `merge_history` table; review policy version                       |
| High `review_required` count   | Confidence threshold too low or input too noisy; check `semantic_lenses` |
| Unknown process tags rising    | Add patterns to `ProcessTagClassifier` in `transform.py`                 |

## Philosophy

This system embodies:

- **Measured truth**: No assertions without evidence + confidence
- **Governed decisions**: Policy versioning, audit trails, override capability
- **Narrative action**: Weekly reports drive decisions, not vibes
- **Safety nets**: Review queues, gates, merge history, determinism checks
