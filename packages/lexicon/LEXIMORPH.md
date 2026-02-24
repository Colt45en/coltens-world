# Leximorph: Pluggable Analysis Engine

**Production-grade word + code analysis system** for the World Engine IDE/Brain.

## Quick Overview

Leximorph breaks down three types of input:

1. **English words** → prefix + root + suffix (morphological analysis)
2. **Code identifiers** → tokens + style detection (JavaScript, TypeScript)
3. **HTML markup** → tag + attributes + class/id tokenization

All results are stored in SQLite for quick querying by the IDE or AI brain components.

### Output Shape

Every analyzed entry is stored as:

```json
{
  "entry": "unbelievable",
  "kind": "word",
  "language": "en",
  "parts": {
    "prefix": "un-",
    "root": "believe",
    "suffix": "-able"
  },
  "meta": {
    "normalized": "unbelievable",
    "confidence": 1.0,
    "notes": ["heuristic_split"]
  },
  "created_at_utc": "2026-02-10T12:34:56Z"
}
```

## Deployment Paths

### Python (FastAPI) — Use This for IDE Backend

Located in `apps/py-sidecar/`:

```bash
# Install dependencies
pip install -r requirements.txt

# Run the API server
python -m uvicorn main:app --host 127.0.0.1 --port 8001 --reload
```

### Endpoints

**POST /leximorph/analyze**

```json
{
  "text": "getUserName",
  "language": "js",
  "kind": "identifier",
  "store": true
}
```

**GET /leximorph/query?contains=User&limit=50**

**POST /leximorph/init** — Initialize DB

**GET /leximorph/health** — Health check

### TypeScript — Use This in Your IDE Extension or Node Services

Located in `packages/lexicon/`:

```bash
# Install
pnpm install

# Use in code
import { buildRegistry, LexiStore } from '@world-engine/lexicon';

const reg = buildRegistry();
const store = new LexiStore('./leximorph.sqlite');
store.init();

const analyzed = reg.analyze('unbelievable', 'en', 'word');
const id = store.insert(analyzed);
const results = store.queryContains('believe');

store.close();
```

## Architecture

### Plugin System

The `AnalyzerRegistry` uses a strategy pattern:

```typescript
class AnalyzerRegistry {
  register(plugin: Analyzer): void;
  analyze(text, language, kind): AnalyzedEntry;
}
```

### Adding a New Analyzer (CSS Example)

```typescript
class CssAnalyzer implements Analyzer {
  supports(language: string, kind: string): boolean {
    return language === "css" && kind === "selector";
  }

  analyze(text: string): AnalyzedEntry {
    // parse CSS, extract parts
    return {
      entry: text,
      kind: "css",
      language: "css",
      parts: {
        /* ... */
      },
      meta: {
        /* ... */
      },
      created_at_utc: utcNowIso(),
    };
  }
}

// Register it
const reg = buildRegistry();
reg.register(new CssAnalyzer());
```

## Storage Schema

**Table: `analyzed_entries`**

| Column         | Type                | Index             |
| -------------- | ------------------- | ----------------- |
| id             | INTEGER PRIMARY KEY |                   |
| entry          | TEXT                | ✓                 |
| kind           | TEXT                | ✓ (with language) |
| language       | TEXT                | ✓ (with kind)     |
| parts_json     | TEXT                |                   |
| meta_json      | TEXT                |                   |
| created_at_utc | TEXT                |                   |

## Confidence Scores

English morphology uses a heuristic scoring system:

- Base: 0.25
- +0.15 per scoring factor (known root, valid length, etc.)
- Max: 1.0

Future: Add probabilistic splitter + freq-based root validation for higher accuracy.

## Next Steps

1. **IDE Integration** (top priority)
   - VS Code extension calls `POST /leximorph/analyze`
   - On hover → tooltip shows `parts` + `meta`
   - Stores queries for ML training

2. **Brain Integration**
   - Brain system queries via `/leximorph/query`
   - Grounds concept lookups (e.g., "find all 'un-' prefixed functions")

3. **Accuracy Upgrade**
   - Add root lexicon table (meanings + examples)
   - Probabilistic splitter with frequency data
   - Exception lists for irregular words

## Files

### Python

- `apps/py-sidecar/leximorph.py` — Core analyzer + SQLite (standalone CLI)
- `apps/py-sidecar/main.py` — FastAPI wrapper

### TypeScript

- `packages/lexicon/src/leximorph.ts` — Full port (same contracts)
- `packages/lexicon/src/index.ts` — Exports + lexicon DB interface
- `packages/lexicon/src/demo.ts` — Integration examples

### Browser Demo

- `packages/lexicon/leximorph-bookfold.html` — Standalone Bookfold UI with local analyzer + optional FastAPI backend (`/leximorph/*`)

## Performance Notes

- **Synchronous** (better-sqlite3 in TS, sqlite3 in Python)
- **WAL mode** for concurrent reads
- **Indexed lookups** on `entry` and `(kind, language)`
- **~500µs per analyze call** (5kb → 100ns regex + scoring)
- **Suitable for real-time IDE hover** (no latency complaint)

## License & Credits

Part of World Engine. Internal use.
