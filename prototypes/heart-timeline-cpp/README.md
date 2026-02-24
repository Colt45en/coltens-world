# Heart Timeline C++ Reference (Phase 1)

Deterministic C++20 reference implementation for the `axis-codex-sim/v1` Heart-driven Timeline Engine.

Features:
- Fixed-step `TimelineEngine`
- `Heart` resonance -> capacity scaling
- JSON config import + export (`axis-codex-sim/v1`)
- CLI (`heart_timeline_cli`)
- Doctest unit tests

## Build

```bash
cmake -S . -B build
cmake --build build
ctest --test-dir build
```

## Run

```bash
./build/heart_timeline_cli --config examples/example_config.json --out simulation_export.json --print-summary
```

## Notes

- Phase 1 uses deterministic capacity scaling only (no event spawning policy loop).
- `generated_at_unix_ms` is excluded from determinism-comparable export hashing.
