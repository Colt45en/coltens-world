# diagtool — SARIF + Ledger Diagnostics for World Engine

Parse **C++/GCC/Clang/MSVC** and **Python** compiler/runtime diagnostics, emit **GitHub-compatible SARIF 2.1.0** + an **append-only, content-addressed ledger**.

## Quick Start

### 1. Parse C++ build log → SARIF + ledger

```bash
cd coltens world
ninja -C build 2>&1 | python scripts/diagtool.py \
  --kind cpp \
  --emit sarif \
  --emit ledger \
  --srcroot "$(pwd)" \
  --sarif-out results.sarif.json \
  --ledger-out ledger.ndjson \
  --ledger-chain

# Outputs:
#   results.sarif.json    SARIF 2.1.0 (upload to GitHub)
#   ledger.ndjson         Content-addressed event log (append-only)
```

### 2. Parse Python test failures

```bash
python -m pytest 2>&1 | python scripts/diagtool.py \
  --kind python \
  --emit sarif \
  --emit ledger \
  --srcroot "$(pwd)" \
  --sarif-out pytest-results.sarif.json \
  --ledger-out pytest-ledger.ndjson
```

### 3. Auto-detect source

```bash
cat build.log | python scripts/diagtool.py \
  --kind auto \
  --emit normalized \
  --emit sarif \
  --emit ledger \
  --pretty  # Pretty-print (useful for debugging)
```

## Output Formats

### SARIF 2.1.0 (GitHub Code Scanning)

- **Schema**: `https://docs.oasis-open.org/sarif/sarif/v2.1.0/errata01/os/schemas/sarif-schema-2.1.0.json`
- **Levels**: `error|warning|note` (GitHub injects these into code scanning dashboard)
- **Fingerprints**: Deterministic partial fingerprint (`diagtool/v1`) for deduplication
- **Size limit**: Max 10MB gzip (GitHub hard limit)

Upload via GitHub Actions:
```yaml
- uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: results.sarif.json
    category: diagtool-cpp-build
```

### Ledger NDJSON (Content-Addressed, Append-Only)

Each line is an event envelope:
```json
{
  "schema": "we.ledger.event@1",
  "cid": "<sha256(record)>",
  "prev": "<previous event cid or null>",
  "runId": "<stable 16-char id>",
  "observedAtUtc": "2026-02-26T14:32:45.123Z",
  "record": {
    "type": "diagnostic",
    "sourceKind": "cpp|python",
    "severity": "error|warning|note|info",
    "path": "src/foo.cpp",
    "line": 42,
    "col": 15,
    "code": "C4267",      // MSVC code / Python exception type
    "message": "...",
    "raw": "...",        // Original line from compiler
    "related": [...],    // Context/hints
    "stack": [...]       // For Python tracebacks
  }
}
```

**Key properties**:
- `cid` = SHA256(canonical_json(record)) — content-addressed (immutable)
- `prev` = Previous event's CID (when `--ledger-chain` is set) — forms chain
- Ledger can be **replayed**, **verified**, **audited**

### Normalized JSON (intermediate format)

```json
{
  "schema_version": "1.0",
  "tool": "diagtool",
  "source_kind": "cpp|python|auto",
  "summary": {
    "errors": 5,
    "warnings": 12,
    "notes": 3
  },
  "diagnostics": [
    {
      "severity": "error",
      "path": "src/world.cpp",
      "line": 108,
      "col": 22,
      "code": "C2259",
      "message": "incomplete type is not allowed",
      "raw": "src/world.cpp:108:22: error: ...",
      "related": [...],
      "stack": []
    }
  ]
}
```

## CLI Reference

```
usage: diagtool.py [-h] [--kind {auto,cpp,python}] [--in INFILE]
                   [--emit {normalized,sarif,ledger}] [--pretty]
                   [--tool-name TOOL_NAME] [--tool-version TOOL_VERSION]
                   [--srcroot SRCROOT] [--sarif-out SARIF_OUT]
                   [--sarif-category SARIF_CATEGORY] [--max-results MAX_RESULTS]
                   [--ledger-out LEDGER_OUT] [--ledger-chain] [--run-id RUN_ID]

Options:
  --kind {auto,cpp,python}       Source kind (default: auto)
  --in INFILE                    Input file (default: stdin)
  --emit {normalized,sarif,ledger}  Output format (required, repeatable)
  --pretty                       Pretty JSON
  --tool-name NAME               Tool name for SARIF (default: diagtool)
  --tool-version VERSION         Tool version for SARIF (default: 1.0.0)
  --srcroot PATH                 Repo root (for relative paths, recommended in CI)
  --sarif-out PATH               Output file (default: results.sarif.json)
  --sarif-category CAT           SARIF category/run id (default: run ID)
  --max-results N                Cap SARIF results (prevent oversized uploads)
  --ledger-out PATH              Output file (default: ledger.ndjson)
  --ledger-chain                 Hash-chain events (append-only proof)
  --run-id ID                    Override run ID (default: hash(input)[:16])
```

## Integration with World Engine CI/CD

### For CMake builds (C++)

```bash
# In your CI script
set -o pipefail
cmake --build build 2>&1 | tee build.log

# Then:
python scripts/diagtool.py \
  --kind cpp \
  --emit sarif \
  --emit ledger \
  --in build.log \
  --srcroot "$GITHUB_WORKSPACE" \
  --ledger-chain \
  --sarif-out results.sarif.json \
  --ledger-out ledger.ndjson
```

### For pnpm builds (TypeScript)

```bash
# TypeScript errors get caught by `pnpm run typecheck`
# Redirect stderr through diagtool if needed
pnpm run typecheck 2>&1 | python scripts/diagtool.py \
  --kind auto \
  --emit sarif \
  --emit ledger \
  --srcroot "$(pwd)"
```

### For Python tests

```bash
pnpm run py:test 2>&1 | python scripts/diagtool.py \
  --kind python \
  --emit sarif \
  --emit ledger \
  --srcroot "$(pwd)" \
  --ledger-chain
```

## GitHub Actions Example

See `.github/workflows/code-scanning-diagtool.yml` for a full example:

```yaml
- name: Build → SARIF + ledger
  run: |
    set -o pipefail
    pnpm run build 2>&1 | tee build.log

- name: Parse diagnostics
  if: always()
  run: |
    python scripts/diagtool.py \
      --kind cpp \
      --emit sarif \
      --emit ledger \
      --srcroot "$GITHUB_WORKSPACE" \
      --ledger-chain

- name: Upload SARIF
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: results.sarif.json
    category: world-engine-build
```

## Determinism & Verification

The ledger is **deterministic**:
- Same build log → same `runId` (hash of input)
- Same diagnostic → same `cid` (hash of canonical record)
- `prev` chain proves append-only (no tampering)

**Verify ledger integrity** (for future enhancement):
```bash
# Re-compute each CID, check chain
ts-node scripts/verify-ledger.ts ledger.ndjson
# Should report: ✓ All events valid
```

## GitHub Code Scanning Limits

- **Max file size**: 10 MB gzipped (hard reject)
- **Max results**: ~10k per upload (recommendation)
- **Category**: Use `--sarif-category` to avoid conflicts with other tools

If build.log is huge, use `--max-results 5000` to cap SARIF output.

## No Dependencies

`diagtool.py` uses only **Python stdlib** (no `pip install` needed).
Runs on Python 3.6+ (tested on 3.11).

---

**Questions?** Check the docstring in `scripts/diagtool.py` or the example workflow in `.github/workflows/code-scanning-diagtool.yml`.
