# Autonomy Loop: Usage Examples & World Engine Integration

This guide shows how to:

1. Run the pipeline on sample code
2. Query results from SQLite
3. Use LexiconEntry/RuneDecoderRow in Nucleus, IDE, and preview runtime
4. Integrate with World Engine's AI brain

---

## Part 1: Running the Pipeline on Sample Code

### Sample Input: TypeScript File

Create `test_input.ts`:

```typescript
/**
 * Example vector math module for the World Engine
 */

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export class Vec3 implements Vector3 {
  x: number;
  y: number;
  z: number;

  constructor(x: number = 0, y: number = 0, z: number = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  /**
   * Compute the magnitude (length) of this vector
   */
  public magnitude(): number {
    return Math.sqrt(this.x ** 2 + this.y ** 2 + this.z ** 2);
  }

  /**
   * Normalize this vector (return unit vector in same direction)
   */
  public normalize(): Vec3 {
    const mag = this.magnitude();
    if (mag === 0) return new Vec3(0, 0, 0);
    return new Vec3(this.x / mag, this.y / mag, this.z / mag);
  }

  /**
   * Dot product with another vector
   */
  public dot(other: Vec3): number {
    return this.x * other.x + this.y * other.y + this.z * other.z;
  }
}
```

### Run the Pipeline

```bash
cd apps/py-sidecar

python pipeline.py \
  --input ../../test_input.ts \
  --language TypeScript \
  --objective "extract vector math API" \
  --narrative rising_action \
  --output-dir ../../results
```

### Inspect Outputs

#### Evidence Packet (Detective Output)

```json
{
  "schema_version": "1.0.0",
  "batch_id": "batch-9d3e8a2f",
  "ingested_at": "2026-02-11T11:00:00.000Z",
  "objective": "extract vector math API",
  "tokens": [
    {"token": "Vector3", "token_type": "symbol", "language": "TypeScript", "count": 2, "initial_confidence": 0.95},
    {"token": "Vec3", "token_type": "symbol", "language": "TypeScript", "count": 5, "initial_confidence": 0.95},
    {"token": "magnitude", "token_type": "word", "language": "TypeScript", "count": 2, "initial_confidence": 0.8},
    {"token": "normalize", "token_type": "word", "language": "TypeScript", "count": 2, "initial_confidence": 0.8},
    ...
  ],
  "meaning_claims": [
    {
      "claim": "'Vector3' is an interface",
      "confidence": 0.95,
      "source_ref": "line 6",
      "falsification_test": "Verify Vector3 is declared as interface"
    },
    {
      "claim": "'Vec3' is a class",
      "confidence": 0.95,
      "source_ref": "line 10",
      "falsification_test": "Verify Vec3 is declared as class"
    },
    {
      "claim": "'magnitude' is a method",
      "confidence": 0.85,
      "source_ref": "line 22",
      "falsification_test": "Verify magnitude() is a method of Vec3"
    }
  ],
  "unknowns": [],
  "content_hash": "d4e2f8a1"
}
```

#### Lexicon Entries (Alchemist Output)

```json
[
  {
    "schema_version": "1.0.0",
    "entry_id": "lex-9d3e8a2f",
    "batch_id": "batch-9d3e8a2f",
    "term": "Vector3",
    "language": "TypeScript",
    "namespace": "default",
    "morphology": {
      "root": "vector",
      "affixes": [],
      "pos": "noun"
    },
    "semantic_lenses": [
      {
        "lens_name": "structural",
        "meaning": "TypeScript interface defining x, y, z number properties",
        "evidence_links": ["line 6"],
        "confidence": 0.95
      },
      {
        "lens_name": "mathematical",
        "meaning": "Represents a point or direction in 3D space",
        "evidence_links": ["comments"],
        "confidence": 0.8
      }
    ],
    "aliases": ["Vector", "3DVector"],
    "examples": [
      {
        "context": "export interface Vector3 { x: number; y: number; z: number; }",
        "source_ref": "line 6-9"
      }
    ],
    "overall_confidence": 0.8,
    "review_required": false,
    "content_hash": "a8f2e91d"
  },
  {
    "entry_id": "lex-5d2e9c1",
    "term": "Vec3",
    "language": "TypeScript",
    "semantic_lenses": [
      {
        "lens_name": "implementation",
        "meaning": "Concrete class implementing Vector3 interface with magnitude, normalize, dot methods",
        "evidence_links": ["lines 10-48"],
        "confidence": 0.95
      }
    ],
    "overall_confidence": 0.95,
    "review_required": false,
    "content_hash": "c3e1d7f2"
  },
  {
    "entry_id": "lex-8f7e6d5",
    "term": "magnitude",
    "language": "TypeScript",
    "semantic_lenses": [
      {
        "lens_name": "mathematical",
        "meaning": "Computes L2 norm (Euclidean length) of the vector",
        "evidence_links": ["line 22-25"],
        "confidence": 0.9
      }
    ],
    "overall_confidence": 0.9,
    "review_required": false,
    "content_hash": "b4f3c2e8"
  }
]
```

#### Rune Decoder Rows (Alchemist Output)

```json
[
  {
    "schema_version": "1.0.0",
    "rune_id": "rune-5d2e9c1",
    "batch_id": "batch-9d3e8a2f",
    "symbol": "Vec3",
    "language": "TypeScript",
    "process_tag": "define",
    "tag_confidence": 0.95,
    "meaning": "Class definition for 3D vector implementation",
    "methodologies": [
      {
        "pattern": "Constructor pattern with default parameters",
        "confidence": 0.9,
        "evidence": "Lines 16-21 show constructor initializing x, y, z with defaults"
      },
      {
        "pattern": "Instance methods for vector operations",
        "confidence": 0.85,
        "evidence": "magnitude(), normalize(), dot() methods"
      }
    ],
    "namespace": "default",
    "occurrence_count": 5,
    "overall_confidence": 0.9,
    "review_required": false,
    "content_hash": "d1e5f9a3"
  },
  {
    "rune_id": "rune-8f7e2c1",
    "symbol": "magnitude",
    "language": "TypeScript",
    "process_tag": "call",
    "tag_confidence": 0.75,
    "meaning": "Method call for computing vector length",
    "methodologies": [
      {
        "pattern": "Used internally by normalize() method",
        "confidence": 0.8,
        "evidence": "Called on line 31: const mag = this.magnitude();"
      }
    ],
    "occurrence_count": 2,
    "overall_confidence": 0.78,
    "review_required": false,
    "content_hash": "e2f6a0b4"
  }
]
```

#### Validated Plan (Analyst Output)

```json
{
  "schema_version": "1.0.0",
  "batch_id": "batch-9d3e8a2f",
  "validated_at": "2026-02-11T11:01:30.000Z",
  "gates": [
    {
      "gate_name": "schema_validation",
      "passed": true,
      "message": "Schema valid"
    },
    {
      "gate_name": "determinism",
      "passed": true,
      "message": "Determinism verified: d1e5f9a3"
    },
    {
      "gate_name": "dedupe_audit",
      "passed": true,
      "message": "No collisions"
    },
    {
      "gate_name": "confidence_threshold",
      "passed": true,
      "message": "Mean confidence: 0.88",
      "threshold": { "minimum": 0.7 }
    },
    {
      "gate_name": "traceability",
      "passed": true,
      "message": "Traceability OK"
    }
  ],
  "overall_status": "passed",
  "determinism_verified": true,
  "content_hash": "f3e7b1c5"
}
```

#### Decision Record (PM Output)

```json
{
  "schema_version": "1.0.0",
  "batch_id": "batch-9d3e8a2f",
  "batch_objectives": ["extract vector math API"],
  "critical_gates": ["schema_validation", "determinism", "traceability"],
  "decisions": [
    {
      "decision_id": "DECIDE-batch-9d3e8a2f-gates",
      "choice": "APPROVED",
      "rationale": "All critical gates passed. Schema valid, determinism verified, traceability confirmed.",
      "authority": "PM / Automation",
      "decided_at": "2026-02-11T11:02:00.000Z"
    }
  ],
  "anomalies": [],
  "approved_for_release": true,
  "content_hash": "g4f8c2d6"
}
```

#### Weekly Ops Report (PM Output)

```json
{
  "schema_version": "1.0.0",
  "week_starting": "2026-02-10",
  "batches_processed": ["batch-9d3e8a2f"],
  "narrative_mode": "rising_action",
  "what_changed": "Collision rate STABLE at 0.0%. Unknown tags: 0 items. Pressure is controlled.",
  "metrics": [
    {
      "metric_name": "lexicon_entries_processed",
      "current_value": 8,
      "trend": "improving",
      "status": "green"
    },
    {
      "metric_name": "collision_rate",
      "current_value": 0.0,
      "trend": "stable",
      "status": "green"
    },
    {
      "metric_name": "unknown_process_tags",
      "current_value": 0,
      "trend": "improving",
      "status": "green"
    }
  ],
  "unknowns": [],
  "next_week_priorities": [
    {
      "priority": "high",
      "action": "Expand process tag taxonomy (add 'compute', 'aggregate')",
      "owner": "Taxonomy Team"
    }
  ],
  "health_score": 0.95,
  "status": "green",
  "content_hash": "h5f9d3e7"
}
```

---

## Part 2: Query Results from SQLite

### Basic Queries

```bash
sqlite3 results/world.db
```

**Find all vector-related entries:**

```sql
SELECT entry_id, term, overall_confidence, review_required
FROM lexicon_entries
WHERE term LIKE '%vec%' or term LIKE '%Vector%';
```

**Check review queue:**

```sql
SELECT item_id, reason, priority FROM review_queue WHERE resolved_at IS NULL;
```

**Inspect merge history:**

```sql
SELECT * FROM merge_history;
```

**Get rune rows for code symbols:**

```sql
SELECT symbol, process_tag, overall_confidence
FROM rune_decoder_rows
WHERE process_tag = 'define';
```

---

## Part 3: Use in World Engine

### Example 1: Nucleus (Node Server) — Brain Integration

```typescript
// In apps/nucleus/src/brain-interface.ts

import { LexiconEntry, RuneDecoderRow, ArtifactSchemas } from "@world-engine/lexicon";
import Database from "better-sqlite3";

class BrainLexicon {
  private db: Database.Database;

  constructor(dbPath: string = "world.db") {
    this.db = new Database(dbPath);
  }

  /**
   * Query lexicon for a term's meaning across all semantic lenses
   */
  async queryMeaning(term: string, language: string = "TypeScript"): Promise<LexiconEntry | null> {
    const stmt = this.db.prepare(`
      SELECT entry_id, term, language, semantic_lenses_json, overall_confidence, review_required
      FROM lexicon_entries
      WHERE term = ? AND language = ?
      LIMIT 1
    `);

    const row = stmt.get(term, language) as any;
    if (!row) return null;

    return {
      entry_id: row.entry_id,
      term: row.term,
      language: row.language,
      semantic_lenses: JSON.parse(row.semantic_lenses_json),
      overall_confidence: row.overall_confidence,
      review_required: row.review_required,
    } as LexiconEntry;
  }

  /**
   * Get all methodology patterns for a code symbol
   */
  async queryMethodologies(symbol: string): Promise<RuneDecoderRow | null> {
    const stmt = this.db.prepare(`
      SELECT rune_id, symbol, process_tag, methodologies_json, overall_confidence
      FROM rune_decoder_rows
      WHERE symbol = ?
      LIMIT 1
    `);

    const row = stmt.get(symbol) as any;
    if (!row) return null;

    return {
      rune_id: row.rune_id,
      symbol: row.symbol,
      process_tag: row.process_tag,
      methodologies: JSON.parse(row.methodologies_json),
      overall_confidence: row.overall_confidence,
    } as RuneDecoderRow;
  }

  /**
   * Search lexicon by confidence threshold (for brain reasoning)
   */
  async searchHighConfidence(minConfidence: number = 0.8): Promise<LexiconEntry[]> {
    const stmt = this.db.prepare(`
      SELECT entry_id, term, language, semantic_lenses_json, overall_confidence
      FROM lexicon_entries
      WHERE overall_confidence >= ?
      ORDER BY overall_confidence DESC
    `);

    const rows = stmt.all(minConfidence) as any[];
    return rows.map((row) => ({
      entry_id: row.entry_id,
      term: row.term,
      language: row.language,
      semantic_lenses: JSON.parse(row.semantic_lenses_json),
      overall_confidence: row.overall_confidence,
    }));
  }
}

// Usage in AI brain
const brainLexicon = new BrainLexicon("world.db");

// When brain encounters term 'magnitude'
const magEntry = await brainLexicon.queryMeaning("magnitude", "TypeScript");
if (magEntry) {
  console.log(`Meaning: ${magEntry.semantic_lenses[0].meaning}`);
  console.log(`Confidence: ${magEntry.overall_confidence}`);
  console.log(`Needs review: ${magEntry.review_required}`);
}

// When brain needs pattern for calling 'Vec3'
const vec3Rune = await brainLexicon.queryMethodologies("Vec3");
if (vec3Rune) {
  console.log(`Process: ${vec3Rune.process_tag}`);
  console.log(`Patterns: ${vec3Rune.methodologies.map((m) => m.pattern).join("\n")}`);
}
```

### Example 2: IDE Web — Query Results for Autocomplete

```typescript
// In apps/ide-web/src/ai-assistant.ts

import { LexiconEntry } from "@world-engine/lexicon";

class AIAssistant {
  private lexicon: BrainLexicon;

  async autocompleteSymbol(partial: string): Promise<string[]> {
    // Query DB for symbols starting with 'partial'
    const db = new Database("world.db");
    const stmt = db.prepare(`
      SELECT symbol FROM rune_decoder_rows
      WHERE symbol LIKE ?
      ORDER BY overall_confidence DESC
      LIMIT 10
    `);

    const results = stmt.all(`${partial}%`) as any[];
    return results.map((r) => r.symbol);
  }

  async explainSymbol(symbol: string): Promise<string> {
    const rune = await this.lexicon.queryMethodologies(symbol);
    if (!rune) return `Unknown symbol: ${symbol}`;

    return `
      Symbol: ${rune.symbol}
      Process: ${rune.process_tag}
      Confidence: ${(rune.overall_confidence * 100).toFixed(0)}%
      Patterns:
      ${rune.methodologies.map((m) => `  - ${m.pattern} (${m.evidence})`).join("\n")}
    `;
  }
}
```

### Example 3: Preview Runtime — Embedding Lore

```typescript
// In apps/preview-runtime/src/world-context.ts
// Load lexicon entries as world lore/codex

import { LexiconEntry } from "@world-engine/lexicon";

class WorldContext {
  private lexicon: Map<string, LexiconEntry> = new Map();

  async loadLexicon(dbPath: string) {
    const db = new Database(dbPath);
    const stmt = db.prepare("SELECT * FROM lexicon_entries ORDER BY overall_confidence DESC");
    const rows = stmt.all() as any[];

    for (const row of rows) {
      this.lexicon.set(row.term, {
        entry_id: row.entry_id,
        term: row.term,
        semantic_lenses: JSON.parse(row.semantic_lenses_json),
        overall_confidence: row.overall_confidence,
      } as LexiconEntry);
    }

    console.log(`Loaded ${this.lexicon.size} terms into world context`);
  }

  getTermMeaning(term: string): string | null {
    const entry = this.lexicon.get(term);
    if (!entry || entry.semantic_lenses.length === 0) return null;

    // Return primary meaning (highest confidence lens)
    const primaryLens = entry.semantic_lenses[0];
    return `${primaryLens.meaning} (confidence: ${primaryLens.confidence})`;
  }
}

// In world initialization
const worldContext = new WorldContext();
await worldContext.loadLexicon("world.db");

// Entities can query meaning of code terms
const vecMeaning = worldContext.getTermMeaning("Vec3");
// → "Concrete class implementing Vector3 interface with magnitude, normalize, dot methods (confidence: 0.95)"
```

---

## Part 4: Integrate into AI Brain Decision Making

### Example: Using Confidence in Brain Reasoning

```typescript
// Brain uses confidence scores to decide reasoning strategy

class AIReasoner {
  async reasonAboutSymbol(symbol: string): Promise<{ action: string; confidence: number }> {
    const rune = await brainLexicon.queryMethodologies(symbol);

    if (!rune) {
      return {
        action: "UNKNOWN_SYMBOL: flag for review",
        confidence: 0,
      };
    }

    if (rune.overall_confidence > 0.9) {
      // High confidence → use directly
      return {
        action: `CONFIDENT: Use ${rune.process_tag} pattern for ${symbol}`,
        confidence: rune.overall_confidence,
      };
    } else if (rune.overall_confidence > 0.7) {
      // Medium confidence → use with caution
      return {
        action: `CAUTIOUS: ${rune.symbol} is ${rune.process_tag} (review needed)`,
        confidence: rune.overall_confidence,
      };
    } else {
      // Low confidence → escalate
      return {
        action: `LOW_CONFIDENCE: ${rune.symbol} needs human validation before use`,
        confidence: rune.overall_confidence,
      };
    }
  }
}
```

---

## Summary

| Component       | Usage                                                                   |
| --------------- | ----------------------------------------------------------------------- |
| **Detective**   | Extract tokens + claims from raw code                                   |
| **Alchemist**   | Build LexiconEntry + RuneDecoderRow with morphology + process tags      |
| **Analyst**     | Validate gates (schema, determinism, dedupe, confidence, traceability)  |
| **Specialist**  | Persist to SQLite; apply merge policy; manage review queue              |
| **PM**          | Generate DecisionRecord + WeeklyOpsReport with narrative                |
| **Integration** | Query SQLite from Nucleus, IDE, Preview; use confidence in AI reasoning |

---

**Ready to run:** `python pipeline.py --input <file> --language TypeScript --objective "extract"`

**Ready to query:** `sqlite3 world.db SELECT ...`

**Ready to integrate:** Import `LexiconEntry`, `RuneDecoderRow` from `@world-engine/lexicon`
