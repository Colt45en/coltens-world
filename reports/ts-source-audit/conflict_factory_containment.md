# Conflict Factory Containment Plan

## Scope

- `.brain/memory/knowledge.ndjson`
- `.brain/review/review.queue.ndjson`
- `pipeline_results/**`

## Policy decisions

- `pipeline_results/**`: generated artifacts only; do not edit manually.
- `.brain/memory/knowledge.ndjson`: canonical memory store; single-writer mutation policy.
- `.brain/review/review.queue.ndjson`: queue state; mutable runtime file with compaction/rotation.

## Operational rules

1. Pipeline jobs write only to `pipeline_results/**` and never rewrite source files.
2. Memory writes are serialized through one process (no concurrent writers).
3. Review queue supports append/pop semantics and periodic compaction into snapshots.
4. Runtime writes should include deterministic ordering for replay/debug exports.

## Merge control recommendations

- Keep `pipeline_results/` ignored as generated output.
- Keep `.brain/review/*.ndjson` ignored as mutable queue state.
- Keep `.brain/memory/*.ndjson` ignored in active development branches unless you intentionally maintain curated snapshots.
- If curated snapshots are needed, store immutable snapshots under a dedicated folder (example: `artifacts/memory-snapshots/`) and never overwrite existing files.

## CI/pre-commit suggestions

- Add a guard that blocks tracked updates in `.brain/review/*.ndjson` and `pipeline_results/**`.
- Optionally allow `.brain/memory/*.ndjson` only when commit message includes an explicit snapshot tag (example: `[memory-snapshot]`).
