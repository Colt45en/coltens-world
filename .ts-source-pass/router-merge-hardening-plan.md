# Router Baseline Spec → TS-as-Source Patch Plan

## Scope analyzed

- `apps/ide-web/package.json`
- `apps/ide-web/tsconfig.json`
- `apps/ide-web/src/main.tsx`
- `apps/ide-web/src/world/WorldRouter.tsx`
- `apps/ide-web/src/world/AppRegistry.tsx`

## Current status (ground truth)

- `react-router-dom` is already present in `apps/ide-web/package.json` (v7.13.0).
- `src/main.tsx` is already the single canonical CSS import point for neon theme (`./styles/neon-nexus.css`).
- No `*.js`/`*.jsx` files exist under `apps/ide-web/src`.
- No explicit `.js` import specifiers were found in `apps/ide-web/src`.
- Router and registry are coherent, but route literals are duplicated across files.

## Repo-facing patch plan

### 1) Add typed route constants (eliminate string drift)

**New file:** `apps/ide-web/src/world/routes.ts`

```ts
export const ROUTES = {
  root: "/",
  hub: "/hub",
  apps: {
    root: "/apps",
    byId: (id: string) => `/apps/${id}`,
  },
  lab: {
    studio: "/lab/studio",
    launcherControl: "/lab/launcher-control",
    nucleus: "/lab/nucleus",
    brain: "/lab/brain",
    lexicon: "/lab/lexicon",
    chat: "/lab/chat",
    gameEngine: "/lab/game-engine",
    graphics: "/lab/graphics",
    worldGraph: "/lab/world-graph",
    nexus: "/lab/nexus",
    flowstate: "/lab/flowstate",
    evidence: "/lab/evidence",
    dashboard: "/lab/dashboard",
    pipelineResults: "/lab/pipeline-results",
  },
} as const;
```

### 2) Convert app model to discriminated union

**Edit:** `apps/ide-web/src/world/AppRegistry.tsx`

**Replace current interface with:**

```ts
export type WorldApp =
  | {
      id: string;
      name: string;
      description: string;
      icon: string;
      kind: "route";
      path: string;
      group?: "core" | "lab" | "tools" | "external";
    }
  | {
      id: string;
      name: string;
      description: string;
      icon: string;
      kind: "iframe";
      url: string;
      group?: "core" | "lab" | "tools" | "external";
    }
  | {
      id: string;
      name: string;
      description: string;
      icon: string;
      kind: "external";
      url: string;
      group?: "core" | "lab" | "tools" | "external";
    };
```

**Then replace literal route strings with `ROUTES.*` references in `WORLD_APPS`.**

### 3) Route usage normalization in router

**Edit:** `apps/ide-web/src/world/WorldRouter.tsx`

- Import `ROUTES` from `./routes`.
- Replace hard-coded route strings in:
  - `navigate(...)` calls
  - `<Route path="..." ... />` declarations
  - `/apps` redirects and `getIframeApps` mapping

This keeps `WorldRouter` and `AppRegistry` path definitions centralized.

### 4) Optional: route lazy loading containment pass

**Edit:** `apps/ide-web/src/world/WorldRouter.tsx`

- Keep current `<Suspense>` wrapper.
- Move heavy page imports (`../lab/*`, `../panels/*`, `../pages/*`) to `lazy(() => import(...))` in a separate pass.

Rationale: smaller edit hotspots and cleaner conflict boundaries in future PRs.

### 5) TS config alignment (migration-hardening)

**Edit:** `apps/ide-web/tsconfig.json`

```jsonc
{
  "compilerOptions": {
    "allowJs": false,
    "checkJs": false,
    "noEmit": true
  }
}
```

Notes:

- `allowJs=false` and `checkJs=false` align with TS-as-source policy.
- `noEmit=true` matches Vite app behavior and avoids emit churn.

## Deletion plan policy (explicit, not executed)

### Deletion candidate conditions

Delete `*.js/*.jsx` in app source only when all are true:

1. TS twin exists (`Foo.ts/tsx` next to `Foo.js/jsx`).
2. No importers reference JS twin after rewrite.
3. No package entrypoint references JS twin.
4. File is not an intentional runtime entrypoint shim.

### Staging order

1. `src/world/**`, `src/layout/**` (anchor modules)
2. `src/pages/**`, `src/lab/**`, `src/iframe/**`
3. `src/ui/**`, `src/fx/**`, `src/lib/**`
4. Remaining edge cases (dynamic imports/fixtures)

## Conflict-factory containment strategy

### Runtime/generated artifacts

- `pipeline_results/**` => generated-only, keep ignored.
- `review.queue.ndjson` => queue state, prefer ignored + `merge=ours` if tracked.
- `knowledge.ndjson` => either ignored or canonical+normalized (single-writer policy).

### Current repo alignment

Already present and aligned:

- `.gitignore` includes `pipeline_results/`.
- `.gitattributes` includes `pipeline_results/** merge=ours -text`.
- `.gitattributes` includes queue protection for `.brain/review/review.queue.ndjson`.

## Scanner weighting policy (next tweak)

Anchor modules to boost TS confidence in twin scoring:

- `apps/ide-web/src/main.tsx`
- `apps/ide-web/src/world/WorldRouter.tsx`
- `apps/ide-web/src/world/AppRegistry.tsx`
- `apps/ide-web/src/layout/NeonNexusLayout.tsx`

Implementation note: add an optional `--anchor` list to `tools/ts-source-pass/scan-twins.mjs` and increase score for edges touched by anchors.
