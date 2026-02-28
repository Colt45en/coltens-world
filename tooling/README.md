# 🏗️ Tooling (Build Infrastructure & Codegen)

**Status**: 🟡 Functional but messy — Multiple build systems, some unused

**Purpose**: Compilation, code generation, build transformation, and deployment tooling

---

## Tooling Inventory

### 🟢 **Primary Build System**

| Tool | Purpose | Status | Maturity |
|------|---------|--------|----------|
| **Turbo** | Monorepo task orchestration | 🟢 Core | `turbo.json` configured |
| **pnpm workspaces** | Package manager + hoisting | 🟢 Core | Single lockfile system |
| **ESLint** | JavaScript linting | 🟢 Active | `.eslintrc.json` + plugins |
| **Prettier** | Code formatting | 🟢 Applied | `.prettierrc.json` |
| **TypeScript** | Type checking | 🟢 Strict | `tsconfig.base.json` + per-package |

### 🟡 **Codegen & Schema Tools**

| Tool | Purpose | Status | Notes |
|------|---------|--------|-------|
| **openapi-typescript** | OpenAPI → TS types | 🟢 Working | `pnpm run contracts:ts` |
| **sync-contracts.mjs** | Contract file sync | 🟢 Maintained | `tools/codegen/sync-contracts.mjs` |
| **export_openapi.py** | OpenAPI JSON export | 🟡 Python | `tooling/codegen/export_openapi.py` |
| **htmlts** | HTML+TS compiler | 🟡 Custom tool | `tooling/htmlts` package |
| **avatar-compiler** | Avatar binary codegen | 🟢 Mature | Phase 1 + 2 complete |

### 🟡 **Build Asset Tools**

| Tool | Purpose | Status | Notes |
|------|---------|--------|-------|
| **C++ Build (CMake)** | Native modules | 🟡 Partial | `build/` directory; build.js orchestration |
| **WebGPU Compute** | GPU shaders | 🟢 Stable | Geometry data transform |
| **Icon Generator** | Post icons (PNG) | 🟢 Working | `scripts/generate-post-icons.mjs` |
| **Prefab System** | 3D object definitions | 🟡 Partial | `tools/gen-room-prefab.mjs` |

### ⚪ **Miscellaneous / Unclear**

| Tool | Purpose | Status | Notes |
|------|---------|--------|-------|
| **spy.mjs** | Dependency spy? | ⚪ Unknown | Location/purpose unclear |
| **run.mjs** | ??? | ⚪ Unknown | `tooling/run.mjs` intent? |
| **test-compilers.mjs** | Compiler diagnostics | 🟡 Partial | Avatar + htmlts testing |
| **boundary/** | Boundary enforcement | 🟢 Active | `tools/boundary/check-boundaries.mjs` |
| **spine.mjs** | Signal Spine tool | 🟡 Partial | Audit/replay/doctor commands |

---

## Directory Structure

```
tooling/
├── codegen/
│   ├── export_openapi.py       (OpenAPI export)
│   └── sync-contracts.mjs      (Contract syncing)
├── htmlts/                      (HTML+TS compiler package)
├── run.mjs                      (Workflow runner?)
├── test-compilers.mjs           (Diagnostics)
└── [other utilities]

tools/
├── boundary/                    (Import rule enforcement)
│   ├── check-boundaries.mjs
│   └── check-no-dist-imports.mjs
├── codegen/
│   ├── build.js                 (C++ build orchestration)
│   └── [avatar tools]
├── gen-room-prefab.mjs          (3D assets)
├── spine.mjs                    (Signal Spine diagnostics)
└── [misc utilities]
```

**Problem**: Duplication between `tooling/` and `tools/`; unclear ownership

---

## Build Pipeline

Typical workflow:

```bash
# 1. Type check
pnpm typecheck

# 2. Lint
pnpm lint

# 3. Generate code (optional, if contracts updated)
pnpm contracts:gen

# 4. Build packages + apps
pnpm build
  ├─ C++ modules (Ninja + CMake)
  ├─ TypeScript (tsc)
  ├─ Avatar compiler (codegen)
  ├─ HtmlTS (custom)
  └─ Web apps (Vite)

# 5. Test (per-package)
pnpm test

# 6. Deploy (launch script)
pnpm launch
```

**Current Status**: Steps 1–4 mostly reliable; step 5 spotty; step 6 manual

---

## Known Issues

1. **Dual tooling dirs**: Both `tooling/` and `tools/` exist; unclear if one should be deleted
2. **C++ build complexity**: CMake + Ninja + node bridge; failures are hard to debug
3. **Codegen triggers unclear**: When does `sync-contracts.mjs` auto-run? Manual `pnpm contracts:gen`?
4. **Schema divergence**: Python `export_openapi.py` + TS `contracts:ts`; can go out of sync
5. **Missing docs**: No `tooling/README.md` or per-tool quick refs
6. **Test compiler**: Works for avatars; doesn't test htmlts determinism

---

## Quality Metrics

| Aspect | Status | Notes |
|--------|--------|-------|
| **Reproducibility** | 🟡 Conditional | Deterministic if env locked; env setup scattered |
| **Error Messages** | 🟡 Unclear | C++ failures opaque; Python errors swallowed |
| **Caching** | 🟡 Partial | Turbo caching works; C++ rebuild sometimes full |
| **CI Integration** | 🟢 Set up | Workflows exist; not all blocking on pass |
| **Local Reproducibility** | 🟡 Difficult | Windows env setup fragile; diagtool flaky |

---

## Recommended Actions

1. **Consolidate tooling**: Merge `tools/` into `tooling/`; clarify ownership
2. **Document each tool**: Add `tooling/[tool]/README.md` with usage + troubleshooting
3. **Unified codegen**: Single entry point for all code generation (OpenAPI, avatar, htmlts)
4. **C++ error handling**: Capture CMake JSON output; parse and pretty-print errors
5. **Test coverage**: Extend `test-compilers.mjs` to include htmlts determinism checks
6. **Validate on build**: Make `pnpm build` fail fast if outputs diverge (schema mismatch check)

---

**Audit Date**: 2026-02-27
**Assessed By**: System Audit
