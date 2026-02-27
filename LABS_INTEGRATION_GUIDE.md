# Lab Generator Integration Guide

**Status**: ✅ Contract-first, deterministic, platform-ready
**Last Updated**: 2026-02-25

---

## Quick Start (5 minutes)

### 1. Install dependencies
```bash
cd "coltens world\python"
pip install -r requirements.txt
```

### 2. Start the API (local dev)
```bash
cd "coltens world\python"
uvicorn labs_api:app --reload --port 8787
```

### 3. Test endpoints
```bash
# List labs
curl http://localhost:8787/labs/list

# Generate all labs
curl -X POST http://localhost:8787/labs/generate \
  -H "Content-Type: application/json" \
  -d '{"output_dir": "labs", "write_manifest": true}'

# Generate one lab
curl -X POST http://localhost:8787/labs/generate \
  -H "Content-Type: application/json" \
  -d '{"lab_id": "la01_regression_from_scratch"}'
```

---

## Architecture Overview

### Files Created

| File | Purpose | Role |
|------|---------|------|
| `packages/protocol/src/contracts/labs.ts` | TS type defs + JSON schemas | Contract source of truth |
| `python/labs_api.py` | FastAPI HTTP service | Tool-call endpoint |
| `.github/workflows/labs.yml` | CI generation + tests | Automated validation |
| `python/requirements.txt` | Python dependencies | Environment pinning |

### Contract Flow

```
Contracts (TS)
  ├─ LabId enum (8 lab IDs)
  ├─ LabsGenerateRequest type
  ├─ LabsGenerateResponse type
  ├─ JSON schemas for validation
  │
Tool Implementations
  ├─ FastAPI (python/labs_api.py)
  │   ├─ POST /labs/generate
  │   ├─ GET /labs/list
  │   └─ GET /health
  │
  └─ Nucleus Tool Lane (agent_py.*)
      ├─ agent_py.labs.generate
      └─ agent_py.labs.list
```

---

## Generated Artifacts

### Per-Lab Structure

After running generation, each lab folder contains:

```
labs/la01_regression_from_scratch/
├── la01_regression_from_scratch_starter.py     # Student template
├── la01_regression_from_scratch_test.py         # Pytest suite
├── la01_regression_from_scratch_README.md       # Instructions
└── manifest.json                                # Audit proof
```

### manifest.json Format

```json
{
  "lab_id": "la01_regression_from_scratch",
  "generated_at_utc": "2026-02-25T23:59:59Z",
  "files": [
    {
      "path": "la01_regression_from_scratch_starter.py",
      "sha256": "abc123...",
      "bytes": 2048
    }
  ]
}
```

### _catalog.json (Global Metadata)

Located at `python/labs/_catalog.json`:

```json
{
  "generated_at_utc": "2026-02-25T23:59:59Z",
  "lab_count": 8,
  "labs": {
    "la01_regression_from_scratch": {
      "dir": "/absolute/path/to/labs/la01_regression_from_scratch",
      "readme": "/absolute/path/.../README.md",
      "starter": "/absolute/path/.../starter.py",
      "test": "/absolute/path/.../test.py",
      "manifest": "/absolute/path/.../manifest.json"
    }
  }
}
```

---

## Integration Modes

### Mode 1: Local Development (Standalone)

**Scenario**: You run lab generation manually on your machine.

**Commands**:
```bash
# Start API
cd python && uvicorn labs_api:app --reload --port 8787

# In another terminal, generate labs
curl -X POST http://localhost:8787/labs/generate \
  -H "Content-Type: application/json" \
  -d '{"output_dir": "labs", "write_manifest": true}'
```

**Output**: `python/labs/` with all artifacts + `_catalog.json`

---

### Mode 2: CI/CD Automation

**Scenario**: Every push generates labs + validates them.

**What happens**:
1. `.github/workflows/labs.yml` triggers on push/PR
2. Generates all labs
3. Validates `manifest.json` + `_catalog.json` (JSON schema)
4. Runs `pytest` on all `*_test.py` files
5. Uploads artifacts to GitHub workflow run
6. Reports to job summary

**No committed artifacts** → labs are always fresh + deterministic.

---

### Mode 3: Nucleus / AgentHub Tool Integration

**Scenario**: An AI agent generates labs via tool_call.

#### 3a) Local Setup (with Nucleus)

Assuming Nucleus runs on `localhost:3000`, and has a Python sidecar on `localhost:8011`:

**Step 1**: Start the labs API in a new terminal

```bash
cd python
uvicorn labs_api:app --host 127.0.0.1 --port 8787
```

**Step 2**: In Nucleus, define a tool_call route

**Pseudocode** (your tool lane router):

```javascript
// File: apps/nucleus/src/tool-call-lane.ts (existing)

// Add this route:
if (toolName.startsWith("agent_py.labs.")) {
  const method = toolName.split(".").pop();
  const baseUrl = "http://127.0.0.1:8787";

  if (method === "list") {
    return await fetch(`${baseUrl}/labs/list`).then(r => r.json());
  }

  if (method === "generate") {
    return await fetch(`${baseUrl}/labs/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    }).then(r => r.json());
  }
}
```

**Step 3**: Agent can now call

```yaml
Tool: agent_py.labs.list
→ Lists all 8 available labs

Tool: agent_py.labs.generate
Args:
  lab_id: "la01_regression_from_scratch"
  output_dir: "/tmp/student_labs"
  write_manifest: true
→ Generates that specific lab + manifest
```

#### 3b) Production Setup (with AgentHub)

If you have a dedicated AgentHub deployment that manages multiple Python sidecars:

**Modify `labs_api.py`** to accept requests with ledger context:

```python
from typing import Optional

class LabsGenerateRequest(BaseModel):
    lab_id: Optional[str] = None
    output_dir: str = "labs"
    write_manifest: bool = True
    # Optional: ledger context for audit trail
    ledger_event_id: Optional[str] = None  # trace back to the request
```

Then in the response, include the event_id so AgentHub can link generation ↔ ledger.

---

## Contract Validation

### Option A: Zod (TypeScript runtime)

If you want to validate incoming tool_call requests in Nucleus:

```typescript
import { z } from "zod";
import { LabsGenerateRequestSchema } from "@world-engine/protocol";

// Zod schema from JSON schema (manual conversion, or use json-schema-to-zod)
const LabsGenerateReq = z.object({
  lab_id: z.enum([
    "la01_regression_from_scratch",
    // ... rest of enums
  ]).optional(),
  output_dir: z.string().min(1).default("labs"),
  write_manifest: z.boolean().default(true),
});

// Validate tool_call args
const validReq = LabsGenerateReq.parse(toolCallArgs);
```

### Option B: JSON Schema (any language)

Use Ajv or similar:

```python
# In python/labs_api.py (optional enhancement)
from jsonschema import validate

def validate_request(req_json):
    schema = {
        "$ref": "worldengine.labs.generate.request.schema.json",
        # ... (from contracts/labs.ts)
    }
    validate(instance=req_json, schema=schema)
```

---

## Determinism & Hash Verification

### Why Hashing?

Labs contain auto-generated code. If you generate the same lab twice, you want proof they're bytewise identical.

### How to verify

```bash
# After generation, check manifest
cat python/labs/la01_regression_from_scratch/manifest.json

# Manually verify a file
sha256sum python/labs/la01_regression_from_scratch/la01_regression_from_scratch_starter.py

# Compare to manifest
# Both should match (lowercase hex, 64 chars)
```

### Reproducibility Guarantee

Given the same `LabGenerator` code + same Python version + same OS:
- Same `lab_id` → same SHA256 hash
- Different `lab_id` → different hash
- If hashes drift, the generator code changed (audit trail!)

---

## CI/CD Guardrails

### What `.github/workflows/labs.yml` Does

1. **Triggers on**:
   - Push to `main`/`develop`
   - PR changes to lab generator files
   - Manual workflow dispatch

2. **Validates**:
   - All `manifest.json` files are valid JSON
   - Global `_catalog.json` is valid JSON
   - All tests pass (failures allowed in PR)

3. **Artifacts**:
   - Uploads `python/labs/` folder
   - Uploads test results
   - 7-day retention (configurable)

### Adding More Validation (Optional)

In `.github/workflows/labs.yml`, after the tests:

```yaml
      - name: Validate with JSON schema
        run: |
          # Install Ajv CLI if needed
          npm install -g ajv-cli
          # Validate each manifest
          for manifest in python/labs/*/manifest.json; do
            ajv validate -s packages/protocol/src/contracts/labs.ts -d "$manifest"
          done
```

---

## Gitignore Settings (Artifact Management)

### Option A: Don't track generated labs (recommended)

Add to `.gitignore`:

```gitignore
# Generated labs (always fresh from CI or manual run)
python/labs/
python/_catalog.json

# Python cache
python/__pycache__/
python/**/__pycache__/
python/.pytest_cache/
```

**Benefit**: Repo stays small; labs are always in sync with generator.

### Option B: Track labs (curriculum distribution)

Omit the above from `.gitignore`, then:

```bash
# After generation, commit
git add python/labs/
git add python/_catalog.json
git commit -m "chore: regenerate labs with latest generator"
```

**Benefit**: Repo self-contains curriculum; can distribute standalone.

**Tradeoff**: Larger git history; extra care needed on generator changes.

---

## Troubleshooting

### "ModuleNotFoundError: No module named 'lab_generator'"

**Fix**: Ensure `lab_generator.py` is in the same directory as `labs_api.py` (or adjust import path):

```python
# In labs_api.py
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from lab_generator import LabGenerator
```

### "Port 8787 already in use"

```bash
# Use a different port
uvicorn labs_api:app --port 8888

# Or kill the existing process
lsof -i :8787  # macOS/Linux
netstat -ano | findstr :8787  # Windows
taskkill /PID <PID> /F  # Windows
```

### Generated files have different hashes = not deterministic

**Diagnose**:
1. Run generation twice, compare manifests
2. Check Python version consistency (`python --version`)
3. Check if `lab_generator.py` uses `datetime.now()` or random seeding (use fixed seed!)

**Fix**: Ensure `LabGenerator.generate_lab()` is pure (no external randomness/time).

---

## Next Steps

### For your Lab Generator

1. **Ensure determinism**:
   - No `import random` (use seeded `np.random.RandomState(seed=42)`)
   - No `from datetime import datetime; datetime.now()` in codegen
   - Document any external deps

2. **Update `lab_generator.py`**:
   - Ensure `.generate_lab(lab_id)` returns dict with keys: `main_code`, `test_code`, `readme`
   - Make it pure + deterministic

3. **Test locally**:
   ```bash
   cd python
   pip install -r requirements.txt
   uvicorn labs_api:app --reload
   # In another terminal
   curl http://localhost:8787/labs/list
   ```

### For Nucleus Integration

1. **In `apps/nucleus/src/tool-lane.ts`** (or similar):
   - Add router for `agent_py.labs.*` → forward to `http://localhost:8787`
   - Optional: log request/response to ledger

2. **In UI** (if using AgentHub):
   - Add a tool card for "Generate Lab"
   - Input selector for `lab_id` enum
   - Output shows `catalog_path` (link to generated labs)

### For Testing

```bash
# Run all lab tests
cd python
pytest labs/**/*_test.py -v

# Or just one
pytest labs/la01_regression_from_scratch/la01_regression_from_scratch_test.py -v
```

---

## Files You Now Have

✅ **Contract** (`packages/protocol/src/contracts/labs.ts`)
   - 8 lab IDs (enum)
   - Request/Response types
   - JSON schemas for Ajv/validation

✅ **API** (`python/labs_api.py`)
   - FastAPI service with endpoints
   - Deterministic hashing + manifests
   - Ready for tool_call integration

✅ **CI** (`.github/workflows/labs.yml`)
   - Generate labs on every push
   - Validate manifests + tests
   - Upload artifacts

✅ **Dependencies** (`python/requirements.txt`)
   - FastAPI, Uvicorn, Pytest, Pydantic

---

## Success Criteria ✅

- [ ] Run `python labs_api.py` locally → API starts on 8787
- [ ] Call `GET /labs/list` → returns 8 lab IDs
- [ ] Call `POST /labs/generate` → labs folder created with manifests
- [ ] Run CI workflow → labs generate + tests validated
- [ ] Nucleus/tool-lane forwards `agent_py.labs.*` to API

---

**You're now "World Engine ready" for lab generation.** 🎯

Contract, implementation, and CI are all in place. Just wire up your tool lane in Nucleus + you have a full platform integration! 🚀
