# World Engine Repository Unification Plan

## 🎯 Mission: One Spine, Many Skins

Transform the repository from multiple fractured timelines into a unified, production-grade monorepo where:

- ✅ **One brain** (packages/*) - canonical source of truth
- ✅ **Many bodies** (apps/*) - thin adapters and UIs
- ✅ **One language** (contracts + protocol) - seamless communication
- ✅ **Hard boundaries** - no accidental coupling

## 📊 Current State Analysis

### ✅ What's Working Well
- Core packages: `protocol`, `bus`, `contracts`, `engine`
- Tooling infrastructure: `pnpm`, `turbo`, `eslint`
- Apps: `nucleus`, `ide-web`, `env-sandbox`
- Agent integration established

### ❌ What's Fracturing "Seamless"

1. **Multiple Sources of Truth**
   - `packages/engine/src/contracts/**` (canonical)
   - `packages/contracts/**` (generated, but stale)
   - `autonomy-loop/contracts/v1/**` (duplicate)
   - `unified_nexus/contracts/v1/**` (duplicate)
   - `apps/sim-server/dist/packages/engine/src/contracts/**` (build artifact)

2. **Dist Dependencies**
   - Apps importing from other packages' `dist/` folders
   - Build artifacts becoming dependencies
   - Accidental coupling through generated code

3. **Duplicated Logic**
   - Same systems in `apps/` and `packages/`
   - Runtime apps containing library code
   - "Almost works" due to propagation issues

## 🧱 4-Layer Unification Model

### Layer 0: Governance (Root Rules)
**Enforce repository shape**

```json
// package.json
{
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "node scripts/dev.mjs",
    "build": "pnpm -r --if-present run build",
    "test": "pnpm -r --if-present run test",
    "check": "pnpm -r lint && pnpm -r typecheck && pnpm check:dist-imports",
    "contracts:sync": "node tools/codegen/sync-contracts.mjs"
  }
}
```

**Rules:**
- `apps/*` may import only from `packages/*` (or external deps)
- No imports from `dist/`
- No duplicated "source" folders (one module = one home)
- Contracts come from one canonical place

### Layer 1: Canonical Contracts (Single Source of Truth)

**Author here:** `packages/engine/src/contracts/**`

**Generated outputs:**
- `packages/contracts/` (TS client/types + validators)
- `python/contracts_v1/` (Python bindings)
- `autonomy-loop/contracts/v1/` (generated)
- `unified_nexus/contracts/v1/` (generated)

**Sync command:** `pnpm contracts:sync`

### Layer 2: Core Protocol + Bus (Single Event Language)

**Canonical location:** `packages/protocol`, `packages/bus`

**Rules:**
- All runtime communication uses `packages/protocol` envelopes
- All apps use `packages/bus` for transport
- No app invents its own message shapes

### Layer 3: Apps as Thin "Skins"

**App Architecture:**
```
apps/nucleus/           # Server adapter
├── src/
│   ├── routes/         # HTTP/WebSocket routes
│   ├── services/       # Runtime orchestration
│   └── index.ts        # Startup + wiring
└── package.json        # Only dependencies on packages/*

apps/ide-web/          # UI shell
├── src/
│   ├── components/     # React components
│   ├── hooks/          # Protocol hooks
│   └── main.tsx        # App entry
└── package.json        # Only dependencies on packages/*

apps/env-sandbox/      # Demo shell
└── src/
    └── index.ts        # Imports @coltens/env-sandbox
```

## 🚀 Implementation Phases

### Phase 1: Hygiene ✅ (COMPLETED)
- ✅ Created `tools/boundary/check-no-dist-imports.mjs`
- ✅ Added `check:dist-imports` script
- ✅ Verified no dist imports exist

### Phase 2: Single Source Contracts ✅ (COMPLETED)
- ✅ Created `tools/codegen/sync-contracts.mjs`
- ✅ Added `contracts:sync` script
- ✅ Established canonical location: `packages/engine/src/contracts/**`

### Phase 3: Remove Duplicated Source Packages
**Goal:** Apps become thin wrappers around packages

**Example: env-sandbox**
```bash
# Current (bad)
apps/env-sandbox/src/     # duplicated logic
packages/env-sandbox/src/ # canonical logic

# Target (good)
packages/env-sandbox/src/ # only source of truth
apps/env-sandbox/src/index.ts # thin wrapper
```

**Migration:**
1. Move all logic to `packages/env-sandbox/`
2. Update `apps/env-sandbox/package.json`:
```json
{
  "dependencies": {
    "@coltens/env-sandbox": "workspace:*"
  }
}
```
3. Replace `apps/env-sandbox/src/*` with imports

### Phase 4: One Command Dev Experience ✅ (COMPLETED)
- ✅ Created `scripts/dev.mjs` - starts all services
- ✅ Updated root `package.json` with unified commands
- ✅ Added graceful shutdown handling

## 🎯 Success Metrics

### "Seamless" Test
**Change a schema in `packages/engine/src/contracts/...`**
1. Run: `pnpm contracts:sync`
2. Start: `pnpm dev`
3. Verify: IDE-Web, Nucleus, Agent all agree (no payload errors)

### Repository Health
- ✅ `pnpm check` passes (lint + typecheck + boundary checks)
- ✅ `pnpm build` succeeds for all packages/apps
- ✅ `pnpm dev` starts all services correctly
- ✅ No dist imports detected

## 📋 Next Steps

1. **Run Phase 3** - Deduplicate source packages
2. **Test contracts sync** - Verify schema changes propagate
3. **Update CI/CD** - Use new unified commands
4. **Document boundaries** - Add CONTRIBUTING.md with rules

## 🧠 Key Insights

- **The fix isn't "more code"** - it's removing duplication
- **Boundaries prevent drift** - hard rules > conventions
- **Generation > sync** - automated pipelines > manual updates
- **One timeline** - changes propagate instantly everywhere

This unification will make "Colten's World" feel like one machine, not multiple systems fighting each other. 🌍⚙️</content>
<parameter name="filePath">c:\Users\colte\colten projects\coltens world\REPOSITORY_UNIFICATION.md
