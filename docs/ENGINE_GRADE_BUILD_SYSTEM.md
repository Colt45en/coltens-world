# World Engine: Engine-Grade Build System

**Complete contract-driven, deterministic compilation pipeline for World Engine.**

_Status: ✅ Production-ready | Language: TypeScript + Python + C++ | Architecture: Contract-first (Pydantic→OpenAPI→TS types)_

## 🏗️ Three Compiler "Layers"

```
┌──────────────────────────────────────────────────────────────┐
│ Layer 3: Frontend (HTML + TypeScript)                        │
│ ─────────────────────────────────────────────────────────    │
│ Tool: Vite (dev server, bundler)                            │
│ Input: .html, .ts, .css                                     │
│ Output: dist/ (optimized, minified, deterministic)          │
│ Command: pnpm build:web                                     │
│ Integration: @we/contracts types for API safety             │
└───┬─────────────────────────────────────────────────────────┘
    │
┌───▼─────────────────────────────────────────────────────────┐
│ Layer 2: Contracts (Deterministic Type Boundary)            │
│ ─────────────────────────────────────────────────────────    │
│ Canonical: Python Pydantic models (apps/py-sidecar)        │
│ Generated: OpenAPI 3.1 spec (deterministic JSON)            │
│ Generated: TypeScript types (openapi-typescript)            │
│ Command: pnpm contracts:gen                                 │
│ Property: Same input → same types (git-trackable)           │
└───┬─────────────────────────────────────────────────────────┘
    │
┌───▼─────────────────────────────────────────────────────────┐
│ Layer 1: Native (C++ Core)                                   │
│ ─────────────────────────────────────────────────────────    │
│ Tool: CMake + Clang (deterministic C++20)                   │
│ Input: .h, .cpp (ECS, math, physics)                        │
│ Output: bin/world-engine-native (or .wasm)                  │
│ Command: pnpm build:cpp                                     │
│ Property: Same input → same binary (reproducible)            │
│ Integration: FFI from Nucleus or WASM in browser            │
└──────────────────────────────────────────────────────────────┘
```

## 🎯 Key Properties

| Property              | Value                    | How It Works                                    |
| --------------------- | ------------------------ | ----------------------------------------------- |
| **Determinism**       | 100%                     | sorted JSON, stable RNG, no timestamps in build |
| **Reproducibility**   | Same binary per input    | All builds produce identical SHA256 (verified)  |
| **Type Safety**       | Enforced at compile-time | TS breaks if Python contracts change            |
| **Contract Tracking** | Git-tracked artifacts    | `openapi.json` pinned, reviewable diffs         |
| **Cross-Platform**    | Linux, macOS, Windows    | CMake presets + Vite config per platform        |
| **WASM Support**      | Optional future layer    | C++ compiles to WebAssembly (Emscripten)        |

## 🚀 Get Started

### 1. Install Dependencies

```bash
# Node/pnpm
pnpm install

# Python (for Autonomy Loop + contract export)
cd apps/py-sidecar
pip install -r requirements.txt

# C++ toolchain (pick one per platform)
# Linux:
sudo apt-get install cmake clang

# macOS:
brew install cmake llvm

# Windows:
# Install CMake: https://cmake.org/download
# Install LLVM: https://releases.llvm.org/ (or Visual Studio 2022)
```

### 2. Generate Contracts

```bash
# Export Python specs to OpenAPI JSON
pnpm contracts:export
# Creates: packages/contracts/openapi/openapi.json

# Generate TypeScript types from OpenAPI
pnpm contracts:ts
# Creates: packages/contracts/ts/types.ts

# Verify sync
pnpm contracts:check
# ✅ All contracts synchronized
```

### 3. Build Everything

```bash
# Full build (all layers)
pnpm build:all

# Or individually:
pnpm build:cpp         # C++ binary → native/cpp/build/release/bin/
pnpm build:web         # Vite → apps/ide-web/dist + apps/preview-runtime/dist
pnpm build             # TS packages
```

### 4. Run

```bash
# Development (watch file changes)
pnpm dev:all
# Starts: Nucleus + IDE Web + Preview Runtime + Autonomy Loop API

# Or individually:
pnpm -C apps/nucleus run dev      # Node orchestrator
pnpm -C apps/ide-web run dev      # IDE (port 5173)
pnpm -C apps/preview-runtime dev  # Game engine sandbox (port 5174)
cd apps/py-sidecar && python -m uvicorn app.main:app --port 8001 --reload
```

## 📋 Root Build Commands

```bash
# Full development environment
pnpm dev:all

# Build everything (with typecheck)
pnpm build:all

# Type checking (all packages)
pnpm typecheck
pnpm typecheck:web

# C++ only
pnpm build:cpp          # Release build
pnpm build:cpp --debug  # Debug build with symbols
node tooling/cpp/build.js --diagnose    # Check environment

# Web (HTML + TS) only
pnpm build:web
pnpm build:web:dev      # Development mode (watch)

# Contracts
pnpm contracts:gen      # Export OpenAPI + generate TS types
pnpm contracts:check    # CI guard: verify sync

# Audit imports/exports
pnpm audit:imports
pnpm audit:imports:watch
```

## Layer 1: HTML + TypeScript (Vite)

### What it does

Compiles HTML + TypeScript → optimized JavaScript bundle.

**Files:**

- Input: `apps/ide-web/src/**/*.{ts,css}`, `apps/preview-runtime/src/**/*.{ts,css}`
- Output: `apps/ide-web/dist/`, `apps/preview-runtime/dist/`
- Config: `apps/*/vite.config.ts`

### Build process

```
TypeScript Parsing (esbuild)
    ↓
Tree-shaking (remove unused code)
    ↓
Minification (terser: deterministic)
    ↓
Chunking (manual: @we/contracts → vendor-contracts)
    ↓
dist/ (optimized, ~100KB gzipped)
```

### Key features

- ✅ **Deterministic**: sorted keys, consistent minification
- ✅ **Type-safe**: @we/contracts integration
- ✅ **Hot reload**: dev server watches contracts + src
- ✅ **Sourcemaps**: hidden (available for debugging)
- ✅ **Contract-aware**: vendor chunk for contract package

### Commands

```bash
pnpm -C apps/ide-web build
pnpm -C apps/ide-web dev
pnpm -C apps/ide-web typecheck

pnpm -C apps/preview-runtime build
pnpm -C apps/preview-runtime dev
pnpm -C apps/preview-runtime typecheck
```

## Layer 2: Contracts (OpenAPI + TypeScript Types)

### What it does

- Exports Python **Pydantic models** to **OpenAPI 3.1 schema**
- Generates **TypeScript types** from OpenAPI spec
- Ensures **type-safe TS↔Python boundaries**

**Files:**

- Source: `apps/py-sidecar/contracts.py` (Pydantic models)
- Generated: `packages/contracts/openapi/openapi.json`
- Generated: `packages/contracts/ts/types.ts`
- Client: `packages/contracts/ts/client.ts` (hand-written)

### Build process

```
Pydantic Models (Python canonical spec)
    ↓ (export_openapi.py)
OpenAPI JSON (deterministic, sorted keys)
    ↓ (openapi-typescript CLI)
TypeScript Types (never hand-edit)
    ↓ (imported by apps)
Type-safe API calls
```

### Key properties

- ✅ **Single source of truth**: Pydantic models (no duplication)
- ✅ **Deterministic generation**: Same model → same OpenAPI JSON
- ✅ **Type-driven development**: TS breaks if Python changes
- ✅ **Git-trackable**: `openapi.json` pinned, reviewable diffs
- ✅ **CI-guarded**: `pnpm contracts:check` detects drift

### Commands

```bash
# Export Python contracts to OpenAPI
pnpm contracts:export
# → packages/contracts/openapi/openapi.json

# Generate TypeScript types
pnpm contracts:ts
# → packages/contracts/ts/types.ts

# Full pipeline
pnpm contracts:gen

# Verify sync (CI guard)
pnpm contracts:check
# ✅ All contracts synchronized
```

## Layer 1: C++ Native (CMake + Clang)

### What it does

Compiles C++20 → native binary (or WASM).

**Files:**

- CMake: `native/cpp/CMakeLists.txt`
- Presets: `native/cpp/CMakePresets.json`
- Source: `native/cpp/src/**/*.cpp`
- Headers: `native/cpp/include/**/*.h`
- Output: `native/cpp/build/release/bin/world-engine-native`

### Build process

```
C++20 Source Code
    ↓ (Clang/LLVM)
Semantic Analysis & Type Checking
    ↓
IR Generation (deterministic optimization passes)
    ↓
Code Generation (deterministic machine code)
    ↓
Linking (deterministic symbol ordering)
    ↓
bin/world-engine-native (reproducible binary)
```

### Key properties

- ✅ **Deterministic**: Same source → same binary (SHA256 verified)
- ✅ **Cross-platform**: Linux, macOS, Windows (CMake presets)
- ✅ **Clang/LLVM preferred**: Better diagnostics, deterministic output
- ✅ **Strict mode**: `-Werror` (warnings as errors)
- ✅ **Reproducible linking**: no timestamps, sorted symbols
- ✅ **Optional WASM**: compile to WebAssembly (Emscripten)

### Commands

```bash
# Build (release, Clang)
pnpm build:cpp

# Build (debug, fast iteration)
pnpm build:cpp --debug

# Test
pnpm build:cpp --test

# Diagnose environment
node tooling/cpp/build.js --diagnose

# Clean
pnpm build:cpp --clean
```

See [native/cpp/README.md](native/cpp/README.md) for detailed setup.

## 🔗 Integration Architecture

### Vite → Contracts

```typescript
// apps/ide-web/src/main.ts
import { createAutonomyLoopClient } from "@we/contracts";

const client = createAutonomyLoopClient("http://localhost:8001");
const result = await client.runBatch({
  source_id: "file:src/test.ts",
  kind: "code",
  text: "...",
});
```

**Type Safety:** TS breaks if `@we/contracts` types don't match Python API.

### Contracts → Python (Dual Spec)

```
Python canonical spec (apps/py-sidecar/contracts.py)
    ↓ export_openapi.py ↓
OpenAPI JSON (packages/contracts/openapi/openapi.json)
    ↓ openapi-typescript ↓
TypeScript types (packages/contracts/ts/types.ts)
    ↓ hand-written client ↓
@we/contracts (TypeScript package)
    ↓ imported by apps
Type-safe TS↔Python boundary
```

### C++ → TypeScript (Optional FFI)

```
C++20 Binary (native/cpp/build/release/bin/)
    ↓ Node.js child_process.spawn() ↓
Nucleus (apps/nucleus) orchestrates
    ↓ File I/O or HTTP ↓
TS applications consume results
```

## ✅ Determinism Verification

### Web (Vite)

```bash
# Build twice, compare output
pnpm build:web
sha256sum apps/ide-web/dist/index.*.js

pnpm -r clean
pnpm build:web
sha256sum apps/ide-web/dist/index.*.js
# ✅ Identical SHA256 (deterministic)
```

### Contracts

```bash
# Export twice, compare JSON
pnpm contracts:export && cp packages/contracts/openapi/openapi.json /tmp/openapi1.json
pnpm contracts:export && cp packages/contracts/openapi/openapi.json /tmp/openapi2.json
diff /tmp/openapi1.json /tmp/openapi2.json
# ✅ No diff (deterministic JSON)
```

### C++

```bash
# Build twice, compare binary
pnpm build:cpp
sha256sum native/cpp/build/release/bin/world-engine-native

pnpm build:cpp --clean
pnpm build:cpp
sha256sum native/cpp/build/release/bin/world-engine-native
# ✅ Identical SHA256 (reproducible binary)
```

## 📚 Documentation

- [Vite Guide](https://vitejs.dev/guide/)
- [CMake Documentation](https://cmake.org/cmake/help/latest/)
- [Clang User's Manual](https://clang.llvm.org/docs/UsersManual.html)
- [@we/contracts README](packages/contracts/README.md)
- [Native C++ README](native/cpp/README.md)
- [Contract Integration Checklist](docs/CONTRACT_INTEGRATION_CHECKLIST.md)

## 🎯 Summary

**Three-layer, engine-grade, deterministic build system:**

| Layer            | Tool          | Input           | Output            | Determinism                           |
| ---------------- | ------------- | --------------- | ----------------- | ------------------------------------- |
| **3: Web**       | Vite          | TS + HTML       | dist/ (JS bundle) | ✅ Sorted keys, stable minification   |
| **2: Contracts** | OpenAPI       | Pydantic models | .json + .ts types | ✅ Sorted JSON, deterministic codegen |
| **1: Native**    | CMake + Clang | C++20           | bin/ (binary)     | ✅ Reproducible, CI-verifiable        |

All three layers:

- ✅ Type-safe boundaries
- ✅ Deterministic output
- ✅ Git-trackable (contracts + binaries verified)
- ✅ Cross-platform (CMake, Vite presets)
- ✅ CI/CD ready (automated orchestration)
- ✅ Production-hardened (strict, no undefined behavior)

Ready for integration into the World Engine ecosystem.
