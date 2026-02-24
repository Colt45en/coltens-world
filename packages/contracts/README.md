# @we/contracts

**Type-safe contract definitions for Autonomy Loop API**, generated from a single source of truth (Pydantic models in Python).

## Architecture: Contract-First

```
Pydantic Models (Python canonical spec)
         ↓ (export_openapi.py)
OpenAPI 3.1 Schema (pinned in git, reviewable)
         ↓ (openapi-typescript)
TypeScript Types (never hand-edited, generated)
         ↓
TS HTTP Client (hand-written wrapper)
```

**Key principle:** One canonical spec → both language sides generated from it. If Python contracts change, TS breaks at compile-time until updated.

## Files

### Generated (never edit manually)

- **`openapi/openapi.json`** — OpenAPI 3.1 spec exported from Pydantic models
  - Deterministically serialized (sort_keys=True)
  - Git-tracked for reviewable diffs
  - Source of truth for API surface

- **`ts/types.ts`** — TypeScript types generated from OpenAPI
  - Output of `openapi-typescript` CLI
  - Regenerated whenever `openapi.json` changes
  - Imported by HTTP client

### Hand-written

- **`ts/client.ts`** — HTTP client with fetch API
  - Imports from generated `types.ts`
  - Provides strongly-typed methods for each endpoint
  - Handles timeouts, error parsing, JSON serialization

- **`ts/index.ts`** — Barrel export
  - Re-exports generated types
  - Re-exports client factory

- **`package.json`** — Package definition for @we/contracts
- **`tsconfig.json`** — TypeScript configuration

## Usage

### From TypeScript (IDE, Nucleus, plugins)

```typescript
import { createAutonomyLoopClient } from "@we/contracts";

const client = createAutonomyLoopClient("http://localhost:8001");

const result = await client.runBatch({
  source_id: "file:src/math.ts",
  kind: "code",
  language_hint: "TypeScript",
  text: "function optimize(x) { return x * 2; }",
  fail_on_unknown_tag: false,
});

console.log(result);
// {
//   EvidencePacket: { ... },
//   LexiconEntry: [ ... ],
//   RuneDecoderRow: [ ... ],
//   ValidatedPlan: { ... },
//   DecisionRecord: { ... }
// }
```

### Type safety

Generated types ensure:

- ✅ Request parameters validated at compile-time
- ✅ Response shapes known before runtime
- ✅ IDE autocomplete for all endpoints
- ✅ Detect breaking changes immediately (TypeScript compile fails)

## Contract Generation

### Initial setup

```bash
# Install dependencies (including openapi-typescript)
pnpm install

# Generate contracts (export OpenAPI spec + generate TS types)
pnpm contracts:gen
```

### Workflow

1. **Modify Python contracts** (canonical spec)

   ```python
   # apps/py-sidecar/contracts.py
   class RunBatchRequest(BaseModel):
       source_id: str = Field(..., min_length=1)
       # ... add new field ...
   ```

2. **Regenerate from canonical spec**

   ```bash
   pnpm contracts:gen
   ```

   This runs:
   - `contracts:export` (Python → OpenAPI JSON)
   - `contracts:ts` (OpenAPI JSON → TS types)

3. **Review and commit**

   ```bash
   git add packages/contracts/openapi/
   git commit -m "contract: add new field to RunBatchRequest"
   ```

4. **Update TS code** (import generated types)
   ```typescript
   // TS compiler now sees the new field
   const result = await client.runBatch({
     ...,
     newField: "value", // ✅ Now available, was ❌ compile error before
   });
   ```

## Commands

### Development

```bash
# Export Python contracts to OpenAPI JSON
pnpm contracts:export

# Generate TypeScript types from OpenAPI
pnpm contracts:ts

# Generate both (recommended)
pnpm contracts:gen

# Verify contracts are in sync (CI guard)
pnpm contracts:check
```

### In CI

```yaml
# 1. Ensure dependencies are installed
- run: pnpm install

# 2. Regenerate contracts
- run: pnpm contracts:gen

# 3. Fail if drift detected (uncommitted generated files)
- run: git diff --exit-code packages/contracts/
```

## Extending the Contract

### To add a new request type

1. **Define in Pydantic** (`apps/py-sidecar/contracts.py`)

   ```python
   class MyNewRequest(BaseModel):
       field1: str = Field(..., min_length=1)
       field2: int = Field(default=10, ge=0)
   ```

2. **Register in FastAPI app** (`apps/py-sidecar/app/main.py`)

   ```python
   @app.post("/autonomy/v1/my-endpoint")
   async def my_endpoint(req: MyNewRequest):
       return { "result": ... }
   ```

3. **Regenerate contracts**

   ```bash
   pnpm contracts:gen
   ```

4. **TypeScript now has types**
   ```typescript
   const types = require("@we/contracts");
   // types.MyNewRequest is now available
   ```

### To add validation rules

Pydantic `Field()` validators apply to both Python and TypeScript:

```python
class RunBatchRequest(BaseModel):
    source_id: str = Field(
        ...,
        min_length=1,
        max_length=256,
        pattern="^[a-zA-Z0-9_:-]+$",
        description="Unique identifier for the source"
    )
```

This becomes OpenAPI constraints → OpenAPI-generated TS types preserve the constraints as JSDoc comments.

## Determinism & Reproducibility

### OpenAPI export is deterministic

The `export_openapi.py` script uses:

- `json.dumps(..., sort_keys=True)` — Stable JSON key ordering
- `indent=2` — Consistent formatting
- Deterministic Pydantic schema ordering

**Result:** Same input → same OpenAPI JSON, no spurious diffs.

### TypeScript codegen is deterministic

The `openapi-typescript` CLI is deterministic:

- Same OpenAPI schema → same types.ts
- No random ordering or comments
- Safe to regenerate in CI

### Git workflow

```bash
# In CI, this must pass with exit code 0
pnpm contracts:gen
git diff --exit-code packages/contracts/

# If exit code is 1, contracts are drifted
# → developer must run pnpm contracts:gen locally and commit
```

## Troubleshooting

### Error: `ModuleNotFoundError: No module named 'fastapi'`

Python dependencies not installed:

```bash
cd apps/py-sidecar
pip install -r requirements.txt
# or with poetry:
poetry install
```

### Error: `openapi-typescript: command not found`

npm package not installed:

```bash
pnpm install
# or if node_modules is out of date:
pnpm install --force
```

### Error: `types.ts` is out of date

Regenerate from canonical spec:

```bash
pnpm contracts:gen
```

### Error: TypeScript compilation fails with unknown types

Make sure to regenerate after changing `contracts.py`:

```bash
pnpm contracts:export  # Update openapi.json
pnpm contracts:ts      # Regenerate types.ts
```

## Design Decisions

### Why contract-first?

- ✅ **Single source of truth** — Pydantic models are canonical
- ✅ **Type-safe boundaries** — TS compile errors if Python changes
- ✅ **Deterministic** — Same input → same output (safe for CI)
- ✅ **Versionable** — OpenAPI spec in git = reviewable API history
- ❌ (vs transpilation) — No shared code between languages, but avoids subtle transpilation bugs

### Why OpenAPI?

- ✅ **Industry standard** — Well-supported by tooling (openapi-typescript, Swagger UI, etc.)
- ✅ **Language-agnostic** — Works equally well for Python, TS, Go, Rust, etc.
- ✅ **Comprehensive** — Covers request/response types, validation, descriptions, examples
- ✅ **Deterministic tooling** — openapi-typescript is stable and reproducible

### Why never hand-edit types.ts?

- ✅ **No drift** — Generated types always match OpenAPI spec
- ✅ **Replay safety** — Regenerating doesn't lose changes (there are none)
- ✅ **CI-compatible** — Can regenerate in CI without conflicts
- ❌ (hand-editing) — Introduces type mismatches with Python, breaks contract-first principle

## See Also

- [Autonomy Loop API](`../../apps/py-sidecar/app/`)
- [Autonomy Loop Core](`../../apps/py-sidecar/autonomy_loop/`)
- [TypeScript Guide](`../../docs/VSCODE_SETUP.md`)
