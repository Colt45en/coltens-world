# `axis-codex-sim/v1` Schema (Phase 1)

Deterministic simulation export format for the Heart-driven Timeline Engine.

## Top-level

```json
{
  "schema": "axis-codex-sim/v1",
  "metadata": { "...": "..." },
  "config": { "...": "..." },
  "tick_log": [],
  "snapshots": []
}
```

## `metadata`

- `engine_name`: `"heart-timeline-engine"`
- `engine_version`: `"0.1.0"`
- `generated_by`: `"cpp"` | `"ts"`
- `generated_at_unix_ms`: integer (excluded from determinism comparisons)
- `deterministic_seed`: integer

## `config`

- `tick_count`: integer `>= 0`
- `dt_seconds`: finite number `> 0`
- `snapshot_every_ticks`: integer `> 0`
- `base_capacity`: integer `>= 0`
- `seed`: integer `>= 0`
- `axis_codex`: must equal
  - `x = "emergence"`
  - `y = "decision"`
  - `z = "time_memory"`
- `heart`: `HeartConfig`
- `initial_objects`: `VectorObject[]`

## `tick_log[]`

Per tick:
- `tick`
- `sim_time_seconds`
- `heart` (`resonance`, `capacity_scale`, `momentum`, `pulse_count`)
- `capacity_budget`
- `processed_objects`
- `deferred_objects`

## `snapshots[]`

Sparse state captures:
- `tick`
- `sim_time_seconds`
- `heart`
- `objects` (`VectorObject[]`)

## Determinism Notes

- Fixed timestep only
- Stable object ordering by `id`
- Floats rounded to 6 decimals on export
- `generated_at_unix_ms` must be ignored in deterministic equality checks
