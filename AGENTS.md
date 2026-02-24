# World Engine: Agent Development Guide

This guide provides essential tips for working with the World Engine codebase, including the Digital Twin Cortex, Nucleus orchestration, and tooling systems.

---

## Codebase Structure

```
coltens world/
├── apps/                    # Standalone applications
│   ├── agent-server/        # Agent coordination server
│   ├── nucleus/             # Core orchestration runtime
│   ├── web/                 # Web UI
│   └── py-sidecar/          # Python runtime bridge
├── packages/                # Shared libraries
├── unified_nexus/           # Python: Nucleus + EventBus + ToolRuntime
│   ├── nucleus/             # Orchestration layer
│   ├── tool_runtime.py      # Tool execution engine
│   ├── event_bus.py         # Event/command bus
│   ├── logging/             # DeterministicEventLog
│   └── storage/             # SQLiteImprintStore
├── tooling/                 # Build-time tools
│   └── speech/              # Speech normalization pipeline
├── docs/                    # Architecture documentation
└── tests/                   # Integration tests
```

---

## Dev Environment Tips

### Navigation

- **Jump to package**: `pnpm dlx turbo run where <project_name>`
- **List all packages**: `pnpm list --depth 0`
- **Check package name**: Look at `name` field in `package.json` (skip workspace root)

### Package Management

- **Install dependencies**: `pnpm install --filter <project_name>`
- **Add dependency**: `pnpm add <dependency> --filter <project_name>`
- **Update lockfile**: `pnpm install` (from workspace root)

### Creating New Packages

**React + TypeScript + Vite**:
```bash
pnpm create vite@latest apps/<new-app> -- --template react-ts
cd apps/<new-app>
pnpm install
```

**Python Module**:
```bash
mkdir -p unified_nexus/<module_name>
touch unified_nexus/<module_name>/__init__.py
# Add to pyproject.toml or requirements.txt
```

### Python Environment

- **Activate virtual environment**: `python -m venv .venv && .venv\Scripts\activate` (Windows) or `source .venv/bin/activate` (Unix)
- **Install Python deps**: `pip install -r requirements.txt`
- **Run Python scripts**: `python -m unified_nexus.nucleus.nucleus` (module mode)

---

## Working with the BRAIN Architecture

### Core Concepts

The World Engine uses a **BRAIN architecture** with these components:

| Component | Purpose | Location |
|-----------|---------|----------|
| **Nucleus** | Orchestration + tick loop | `unified_nexus/nucleus/nucleus.py` |
| **EventBus** | Event broadcast + command routing | `unified_nexus/event_bus.py` |
| **ToolRuntime** | Serial tool execution | `unified_nexus/tool_runtime.py` |
| **Memory** | Deterministic event log + SQLite imprints | `unified_nexus/logging/`, `unified_nexus/storage/` |

### Event Flow (Critical Constraint)

**ONLY Nucleus may emit events** (`emit_event_nucleus_only` enforces this).

**Standard flow**:
```
1. Nucleus emits nucleus.tick event
2. Subscribers (Cognition, etc.) react
3. Subscribers send nucleus.tool_call commands
4. Nucleus emits nucleus.tool_call events
5. ToolRuntime executes tool
6. ToolRuntime sends cognition.request_emit command
7. Nucleus emits result event (dt.tool.result)
```

### Adding a New Tool

**Step 1: Define the tool function**

Create `unified_nexus/tools/<your_tool>.py`:

```python
"""BRAIN ARCHITECTURE: Tool Runtime → <Your Domain>"""

from typing import Any, Dict


async def your_tool_name(args: Dict[str, Any]) -> Dict[str, Any]:
    """
    Tool description.
    
    Args:
        case_id: Correlation ID
        call_id: Tool call ID
        <your_args>: Tool-specific parameters
    
    Returns:
        {
            "<result_key>": result_value,
            "hash": "sha256:..." (if artifact)
        }
    """
    # Extract args
    case_id = str(args.get("case_id", ""))
    your_param = args.get("your_param", default_value)
    
    # Execute logic (deterministic!)
    result = do_computation(your_param)
    
    # Return structured result
    return {
        "case_id": case_id,
        "result_key": result,
    }
```

**Step 2: Register the tool**

Add to tool registry (wherever you instantiate ToolRuntime):

```python
from unified_nexus.tools.your_tool import your_tool_name

tools = {
    "your.tool.name": your_tool_name,
    # ... other tools
}

runtime = ToolRuntime(bus, tools)
```

**Step 3: Call the tool**

From Cognition or any subscriber:

```python
await nucleus.call_tool("your.tool.name", {
    "case_id": "case_001",
    "call_id": "call_12345",
    "your_param": 42
})
```

**Step 4: Test determinism**

```python
# Same input → same output (hash-stable)
result1 = await your_tool_name({"your_param": 42})
result2 = await your_tool_name({"your_param": 42})
assert result1 == result2  # Must be identical
```

---

## Testing Instructions

### Running Tests

**All tests (workspace root)**:
```bash
pnpm turbo run test
```

**Single package**:
```bash
pnpm turbo run test --filter <project_name>
# OR from package directory:
cd apps/<project_name>
pnpm test
```

**Focus on specific test**:
```bash
pnpm vitest run -t "<test name pattern>"
```

**Python tests (pytest)**:
```bash
pytest unified_nexus/tests/
pytest unified_nexus/tests/test_nucleus.py -v
pytest -k "test_emit_ordering"  # Run specific test
```

**Playwright E2E tests**:
```bash
npx playwright test
npx playwright test --ui  # Interactive mode
```

### Test Requirements

**Before committing**:
- ✅ All tests pass: `pnpm turbo run test`
- ✅ No lint errors: `pnpm lint`
- ✅ No type errors: `pnpm turbo run typecheck`
- ✅ Python tests pass: `pytest`

**After changing files**:
- Run `pnpm lint --filter <project_name>` to verify ESLint + TypeScript
- Run `pnpm typecheck --filter <project_name>` for type validation
- Update tests for code changes (even if not explicitly requested)

### CI Pipeline

Check `.github/workflows/` for CI configuration:
- `ci.yml` - Main CI pipeline (lint, test, typecheck)
- `playwright.yml` - E2E tests
- Python tests may be in separate workflow

---

## Speech Rewriter System (Tooling)

### Files

- **Compiler**: `tooling/speech/tsv-to-rewriter-config-final.mjs`
- **Source**: `tooling/speech/sounds-final.tsv`
- **Output**: `tooling/speech/rewriter.config.json`
- **Runtime**: `tooling/speech/rewriter.mjs`
- **Heteronyms**: `tooling/speech/heteronym_resolver.mjs`

### Recompiling Speech Rules

```bash
cd tooling/speech
node tsv-to-rewriter-config-final.mjs sounds-final.tsv rewriter.config.json
```

**Invariants**:
- No duplicate exceptions (compiler detects conflicts)
- Phone normalization: `ɛ→ĕ`, `ɪ→ĭ`, `ʊ→ŭ`
- Heteronyms in HETERONYM_ALLOWLIST (26 words)

### Adding Speech Rules

1. Edit `sounds-final.tsv` (TSV format: `grapheme\tphones\ttype`)
2. Run compiler (above command)
3. Verify output: 97 grapheme rules + 184 exceptions + 25 heteronyms
4. Test: `node rewriter.mjs "test sentence"`

---

## Digital Twin Cortex (Physiology Simulation)

### Architecture

See [docs/PHYSIOLOGY_SIMULATION.md](docs/PHYSIOLOGY_SIMULATION.md) for complete architecture.

**BRAIN Layers**:
1. **RETINA** (Perception) - DICOM ingest, normalization
2. **V-CORTEX** (Recognition) - Segmentation
3. **CONNECTOME** (Topology) - Graph building
4. **BRAINSTEM** (Simulation) - Hemodynamics, cardiac cycle
5. **MOTOR** (Biomechanics) - Kinesiology, ocular motion
6. **OCCIPITAL** (Rendering) - 2D MPR/MIP output
7. **HIPPOCAMPUS** (Memory) - Snapshots, audit

### Running a Simulation

**Step 1: Ingest case**:
```bash
pnpm run nucleus -- digital_twin.ingest \
  --case-id case_001 \
  --dicom-path ./data/case_001/series_001
```

**Step 2: Full pipeline**:
```bash
pnpm run nucleus -- digital_twin.reconstruct \
  --case-id case_001 \
  --target-systems vascular,skeletal
```

**Step 3: Export**:
```bash
pnpm run nucleus -- digital_twin.export \
  --case-id case_001 \
  --format bundle
```

### Truth Labels (Scientific Honesty)

Every artifact includes provenance:
- **🔵 MEASURED**: Directly from imaging
- **🟠 INFERRED**: Model estimates
- **🟣 SYNTHESIZED**: Template-based

Always label outputs appropriately in tool results.

---

## PR Instructions

### Title Format

```
[<project_name>] <Brief description>

Examples:
[nucleus] Add tool correlation with Future-based result handling
[speech] Fix duplicate exception entries in sounds-final.tsv
[docs] Create Digital Twin Cortex architecture documentation
```

### Checklist

**Before submitting PR**:
- [ ] All tests pass: `pnpm turbo run test`
- [ ] No lint errors: `pnpm lint`
- [ ] No type errors: `pnpm turbo run typecheck`
- [ ] Python tests pass: `pytest` (if applicable)
- [ ] Documentation updated (if API changes)
- [ ] Added tests for new code
- [ ] Verified determinism (for tools/simulation)
- [ ] Checked event correlation (trace_id, call_id)

**PR Description Template**:

```markdown
## Summary
<Brief description of changes>

## Changes
- <Change 1>
- <Change 2>

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests pass
- [ ] Manual testing completed

## Architecture Impact
<How this affects BRAIN components, if applicable>

## Related Issues
Fixes #<issue_number>
```

---

## Common Workflows

### Debugging Event Flow

1. **Enable verbose logging**: Set `LOG_LEVEL=DEBUG` in environment
2. **Check deterministic log**: `./runtime/events.v1.ndjson`
3. **Query SQLite imprints**: `sqlite3 ./runtime/nexus.db "SELECT * FROM imprints ORDER BY seq DESC LIMIT 10"`
4. **Trace specific call**: Search for `call_id` or `trace_id` in logs

### Checking Event Order

```python
# Verify seq ordering
import sqlite3
conn = sqlite3.connect("./runtime/nexus.db")
cursor = conn.execute("SELECT seq, event_type FROM imprints ORDER BY seq")
for row in cursor:
    print(f"seq={row[0]}, type={row[1]}")
```

### Verifying Determinism

```bash
# Run twice, compare outputs
pnpm run nucleus -- <command> --seed 12345 > output1.txt
pnpm run nucleus -- <command> --seed 12345 > output2.txt
diff output1.txt output2.txt  # Should be identical
```

### Adding Invariants (Health Checks)

Create `unified_nexus/dt_invariants.py`:

```python
from .event_bus import EventBus

class InvariantRegistry:
    def __init__(self, bus: EventBus):
        self.bus = bus
        self.bus.subscribe_event("dt.tool.result", self._check)
    
    async def _check(self, evt):
        # Validate outputs
        if <invariant_violated>:
            # Emit health.failed event via cognition.request_emit
            pass
```

---

## Performance Targets

### Simulation
- Tick rate: 60 Hz (16.67 ms/tick)
- Tool execution: <10 ms/call (for hot path tools)
- Memory footprint: <4 GB per case

### Rendering
- Frame rate: 30-60 fps
- Frame generation: <50 ms/frame

### Benchmarking

```bash
# Time a tool call
time pnpm run nucleus -- <tool_call>

# Python profiling
python -m cProfile -o profile.stats -m unified_nexus.nucleus.nucleus
python -c "import pstats; pstats.Stats('profile.stats').sort_stats('cumtime').print_stats(20)"
```

---

## Documentation

### Key Documents

- [BRAIN_CHAT_ARCHITECTURE.md](docs/BRAIN_CHAT_ARCHITECTURE.md) - Core architecture
- [PHYSIOLOGY_SIMULATION.md](docs/PHYSIOLOGY_SIMULATION.md) - Digital Twin Cortex
- [AGENT_SYSTEM_QUICKSTART.md](docs/AGENT_SYSTEM_QUICKSTART.md) - Agent getting started
- [ARCHITECTURE_QUICK_REFERENCE_DIAGRAMS.md](docs/ARCHITECTURE_QUICK_REFERENCE_DIAGRAMS.md) - Visual guides

### Architecture Comments

All modules include architecture mapping comments:

```python
"""
BRAIN ARCHITECTURE: <Layer> → <Component>

Example:
BRAIN ARCHITECTURE: Tool Runtime → Physics Solvers
Maps to Digital Twin Cortex BRAINSTEM layer.
"""
```

Always add these to new modules for traceability.

---

## Getting Help

### Before Asking

1. Check [docs/](docs/) for architecture documentation
2. Search codebase for similar patterns: `grep -r "pattern" unified_nexus/`
3. Check existing tests for usage examples
4. Review event log for runtime behavior

### When Reporting Issues

Include:
- **Reproduction steps**
- **Expected vs actual behavior**
- **Relevant logs** (event log, SQLite queries)
- **Architecture context** (which BRAIN layer?)
- **Correlation IDs** (trace_id, call_id)

---

*Last Updated: February 22, 2026*
*World Engine BRAIN v1.0*
