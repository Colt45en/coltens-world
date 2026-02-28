# 🐍 Python (Auxiliary Utilities)

**Status**: 🟡 Functional but disconnected — Not integrated into main build

**Purpose**: Development utilities, labs generation, geometry/graphics helpers

**Warning**: This is separate from `apps/py-sidecar` (which is the main Python runtime)

---

## Contents

| File/Dir | Purpose | Status | Notes |
|----------|---------|--------|-------|
| **lab_generator.py** | Generate test lab environments | 🟡 Works | Extensible via lab_extensions |
| **lab_extensions.py** | Plugin system for labs | 🟡 Works | Custom room/object generation |
| **labs_api.py** | REST API for labs | 🟡 Works | Docs in LAB_EXTENSIONS_GUIDE.md |
| **lab_extensions_examples.py** | Example plugins | 🟢 Reference | Good starting point |
| **geometry_engine.py** | Compute geometries | 🟡 Partial | Unclear integration w/ graphics |
| **graphics_generator.py** | Render assets | 🟡 Partial | Overlaps w/ packages/graphics? |
| **contracts_v1/** | Schema definitions | ⚪ Legacy? | Too old to use; v2 in main? |
| **requirements.txt** | Python deps | 🟡 Outdated | pinned versions; may be stale |
| **generate_labs.py** | CLI generator | 🟡 Works | Entry point for lab creation |

---

## Integration Issues

1. **Not in main build**: `scripts/` doesn't invoke these; manual `python` calls only
2. **Duplicate contracts**: `contracts_v1/` conflicts with main `packages/contracts`
3. **Geometry overlap**: Both `geometry_engine.py` here AND `packages/wegc-geometry`
4. **Graphics confusion**: `graphics_generator.py` here; `packages/graphics` in monorepo; Which one wins?
5. **Requirements drift**: `requirements.txt` not pinned to `apps/py-sidecar` deps

---

## Recommended Actions

1. **Decide usage**: Are these still active? Legacy? Move to `docs/examples/` if obsolete
2. **Consolidate contracts**: Reuse `packages/contracts` schemas, not `contracts_v1/`
3. **Unify geometry**: Choose between local vs. package; document rationale
4. **Merge dependencies**: Align `requirements.txt` with `apps/py-sidecar/requirements.txt`
5. **Add to CI**: If these are active, `pnpm py:lint` + `pnpm py:test` should run these too

---

**Audit Date**: 2026-02-27
