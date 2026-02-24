# Autonomy Loop

**Deterministic multi-agent knowledge artifact pipeline** — Detective → Alchemist → Analyst → Specialist → PM

Converts raw text or code into six JSON artifacts through five specialized roles. Status is computed ONLY from measured gate results (red/yellow/green), not vibes.

## Quick Start

### Install

```bash
cd autonomy-loop
pip install -e .
```

### CLI Usage

#### Ingest: Extract EvidencePacket from stdin

```bash
echo "function optimize(x) { return x * 2; }" | python -m autonomy_loop.cli ingest \
  --source-id "file:src/math.ts" \
  --kind code \
  --language-hint TypeScript
```

Output: `EvidencePacket` JSON with batch_id, tokens, meaning claims, objective.

#### Run Batch: Full pipeline end-to-end

```bash
cat src/optimizer.ts | python -m autonomy_loop.cli run-batch \
  --source-id "file:src/optimizer.ts" \
  --kind code
```

Output: Complete artifact bundle:

- `EvidencePacket` — raw tokenization + claims
- `LexiconEntry[]` — language terms with morphology
- `RuneDecoderRow[]` — code symbols with process tags
- `ValidatedPlan` — gate results + status (red/yellow/green)
- `DecisionRecord` — decision snapshot with policy versions

#### Weekly Report: Query DB and generate narrative

```bash
python -m autonomy_loop.cli weekly-report \
  --days 7 \
  --mode operations
```

Output: `WeeklyOpsReport` with metrics, facts, gate conditions, status, and narrative.

### API Usage

Start server:

```bash
python -m autonomy_loop.api
```

Server listens on `http://127.0.0.1:8001`.

#### POST /run_batch

```bash
curl -X POST http://127.0.0.1:8001/run_batch \
  -H "Content-Type: application/json" \
  -d '{
    "source_id": "file:src/optimizer.ts",
    "kind": "code",
    "language_hint": "TypeScript",
    "text": "function optimize(x) { return x * 2; }"
  }'
```

Returns: Complete artifact bundle (JSON).

#### GET /health

```bash
curl http://127.0.0.1:8001/health
```

Returns: `{"status": "ok"}`

## Database

Batches are stored in `data/autonomy_loop.sqlite`:

### Tables

- **batches** — One row per batch (EvidencePacket, ValidatedPlan, DecisionRecord stored as JSON)
- **lexicon_entries** — Language terms from batch (one row per unique (language, term); stores LexiconEntry JSON)
- **rune_rows** — Code symbols from batch (one row per unique (code_language, symbol, process_tag); stores RuneDecoderRow JSON)
- **review_queue** — Auto-populated from low-confidence items (status, created_at, resolved_at, resolution_note for workflow tracking)

### Query Examples

**Get all batches from last 7 days:**

```sql
SELECT batch_id, created_at, status FROM batches
WHERE created_at >= datetime('now', '-7 days');
```

**Get review queue for high-priority items:**

```sql
SELECT * FROM review_queue
WHERE status = 'pending'
ORDER BY created_at DESC
LIMIT 20;
```

**Get unique process tags from all code symbols:**

```sql
SELECT DISTINCT process_tag FROM rune_rows ORDER BY process_tag;
```

## Architecture

### Five Roles

1. **Detective** (`extract.py`) — Tokenize raw text, extract meaning claims (graded by confidence + falsification tests), output `EvidencePacket`
2. **Alchemist** (`transform.py`) — Morphology analysis, semantic lens inference, code symbol process tag classification; output `LexiconEntry[]` + `RuneDecoderRow[]`
3. **Analyst** (`validate.py`) — Run 4 gate validators (schema, determinism, traceability, confidence), compute status (red/yellow/green)
4. **Specialist** (`db.py`) — Persist artifacts, manage merge policies (v1.0–v3.0), auto-populate review queue from low-confidence items
5. **PM** (`report.py`) — Generate `WeeklyOpsReport` with narrative modes (operations, rising_action, conflict, climax, falling_action, resolution)

### Key Invariants

- **Determinism**: Same input → identical output hash (reproducible via `stable_id()` and canonical JSON)
- **Traceability**: batch_id + source_id on all artifacts
- **Schema Validity**: JSON Schema validation against contracts (Draft 2020-12)
- **Measured Status**: Derived ONLY from gate results; never subjective
- **Review Queue**: Auto-populated from low-confidence items (confidence < 0.30 or review_required flag)
- **Policy Versioning**: Merge policies logged; collision handling is auditable

### Contracts

All artifacts conform to JSON Schemas in `contracts/v1/`:

- `EvidencePacket.schema.json` — batch input with claims + objective
- `LexiconEntry.schema.json` — language term with morphology
- `RuneDecoderRow.schema.json` — code symbol with process tag
- `ValidatedPlan.schema.json` — gate results + status (red/yellow/green)
- `DecisionRecord.schema.json` — decision snapshot with policy versions
- `WeeklyOpsReport.schema.json` — weekly ops report with narrative

## Development

### Testing Determinism

Run same input twice and compare hashes:

```bash
INPUT="function optimize(x) { return x * 2; }"

# Run 1
echo "$INPUT" | python -m autonomy_loop.cli run-batch \
  --source-id "test" --kind code > run1.json

# Run 2
echo "$INPUT" | python -m autonomy_loop.cli run-batch \
  --source-id "test" --kind code > run2.json

# Compare hashes in ValidatedPlan.hashes
jq '.ValidatedPlan.hashes' run1.json
jq '.ValidatedPlan.hashes' run2.json
```

If determinism is working, hashes will be identical.

### Testing Review Queue Auto-Population

Run a batch with low-confidence claims (auto-generated meaning_claims start at confidence=0.15):

```bash
python -m autonomy_loop.cli run-batch \
  --source-id "test" --kind text < sample.txt

# Query review queue
sqlite3 data/autonomy_loop.sqlite \
  "SELECT artifact_type, reason, COUNT(*) FROM review_queue GROUP BY artifact_type;"
```

Review queue should contain rows with `reason = 'low_confidence'` for all meaning claims.

### Integration with World Engine

#### From Nucleus → Autonomy Loop

1. Send `autonomy.batch` request on Bus:

   ```typescript
   bus.request("autonomy", "autonomy.batch", {
     source_id: "file:src/optimizer.ts",
     kind: "code",
     language_hint: "TypeScript",
     text: readFileSync("src/optimizer.ts", "utf-8"),
   });
   ```

2. Autonomy Loop responds with artifact bundle
3. Store in IDE workspace for lexicon queries

#### From IDE → Lexicon

Query lexicon entries by term:

```typescript
const entries = await db.execute(
  "SELECT entry_json FROM lexicon_entries WHERE language = ? AND term = ?",
  ["English", "optimize"],
);
```

#### From Preview Runtime → Process Tags

Query code symbols by process tag:

```typescript
const renderSymbols = await db.execute("SELECT row_json FROM rune_rows WHERE process_tag = ?", [
  "render",
]);
```

## Policy Versioning

Merge policies define how to handle collisions:

- **v1.0** (naive) — Fork on collision (never merge duplicate terms)
- **v2.0** (confidence-based) — Merge if confidence >= threshold
- **v3.0** (namespace-aware) — Merge if same namespace + trace

Policies are logged in `DecisionRecord.policy_versions` and stored in `review_queue` for audit.

## Status Computation

Status is computed ONLY from gate results:

- **Red** — Hard fail (schema invalid OR traceability broken)
- **Yellow** — Soft warn (confidence < 0.30 OR review_queue populated)
- **Green** — All gates pass

No subjective calls; no vibes.

## Troubleshooting

### Determinism Mismatch

**Symptom:** Running same batch twice produces different hashes.

**Diagnosis:** Check tokenization order (should be stable-sorted) and JSON serialization (ensure sort_keys=True).

**Fix:** Rebuild `stable_sorted()` with `sorted()` to ensure reproducibility.

### Low Confidence Loop

**Symptom:** Review queue keeps growing; manual resolution not keeping up.

**Diagnosis:** Meaning claims confidence too low (default 0.15); threshold too high (default 0.30).

**Fix:** Tune confidence thresholds in `extract.py` and `validate.py`.

### Missing Process Tags

**Symptom:** Code symbols marked as "unknown_tag".

**Diagnosis:** Symbol not in `CONTROLLED_PROCESS_TAGS` vocabulary.

**Fix:** Add new token to `CONTROLLED_PROCESS_TAGS` in `transform.py` or classify as "unknown_tag" and flag for taxonomy review.

## License

Autonomy Loop © 2025 — Part of World Engine.

Determinism is a feature, not a bug.
