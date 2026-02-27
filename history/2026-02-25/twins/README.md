# Twins Archive — 2026-02-25

This folder contains files moved out of `src/` as part of a **TS-as-source twin cleanup**.

## Why these files are here
- They were identified as **JS twins** where:
  - TS is the winner
  - JS importers = 0
  - Suggested action = delete-candidate
- They were **moved (not deleted)** to keep the repo deterministic and reversible.

## Artifacts
- Plan: `history/2026-02-25/twins-plan.json`
- Manifest: `history/2026-02-25/twins-manifest.json`

## Restore (if needed)
To restore a file:
1. Move it back to its original path (see manifest)
2. Re-run tests / build

