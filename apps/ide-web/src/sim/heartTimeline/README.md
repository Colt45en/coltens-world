# Heart Timeline TS Bridge

Deterministic browser-side implementation of the `axis-codex-sim/v1` Heart/Timeline engine.

- `types.ts`: public schema-facing interfaces
- `schema.ts`: hand-written config/export validators
- `heart.ts`: resonance + capacity scaling
- `engine.ts`: deterministic simulation loop
- `io.ts`: stable JSON import/export helpers

Phase 1 is UI-first and runs in the browser (no backend required).
