# World Engine IDE - README

A **full-featured World Engine IDE** with:

- Browser-based editor + live preview
- Deterministic game runtime (ECS)
- Multi-process architecture (Nucleus orchestrator)
- AI-assist brain grounded in a code lexicon
- Math catalog with numeric and symbolic operations

## 🚀 Quick Start (5 minutes)

**See [QUICKSTART.md](QUICKSTART.md) for step-by-step setup.**

Or run the setup script:

```bash
cd "c:\Users\colte\colten projects\coltens world"
.\scripts\setup.bat          # Windows
# OR
./scripts/setup.sh           # macOS/Linux
```

Then start development:

```bash
pnpm run dev
```

## Prerequisites

- Node.js 18+
- Python 3.9+ (for sidecar)
- pnpm 8+ (or npm/yarn)
- VS Code (recommended; auto-configures with workspace settings)

## Installation

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm run build
```

## Development

```bash
# Start all services: IDE Web, Nucleus, Preview, Sidecar
pnpm run dev

# In another terminal: Auto-fix ESLint issues
pnpm run lint:fix

# Format code with Prettier
pnpm run format

# Type check
pnpm run type-check
```

### Access Points

- **IDE Web**: <http://localhost:5173> (editor + panels)
- **Nucleus**: ws://localhost:3001 (orchestrator)
- **Preview**: <http://localhost:5174> (game runtime)
- **Sidecar**: <http://localhost:8000> (math/lexicon API)

### Running Individual Apps

```bash
# IDE Web
cd apps/ide-web && pnpm dev

# Nucleus orchestrator
cd apps/nucleus && pnpm dev

# Python Sidecar
cd apps/py-sidecar && pip install -r requirements.txt && python main.py

# Preview Runtime
cd apps/preview-runtime && pnpm dev
```

## �️ Compiler Infrastructure (HTML+TS)

World Engine provides two production-grade compilers for building web interfaces and demos:

### Compiler A: Vite (Modern Web Bundler)

```bash
# Development
pnpm dev:compiler-a              # Start dev server (port 5173)

# Production
pnpm build:compiler-a            # Optimized build
```

**Use for**: Real web applications, complex projects, dev tooling
**Output**: Hashed, minified, code-split bundles
**See**: [docs/HTML_TS_COMPILERS.md](docs/HTML_TS_COMPILERS.md)

### Compiler B: Single-File (Embedded esbuild)

```bash
# Development
pnpm dev:compiler-b              # Watch and rebuild on changes

# Production
pnpm build:compiler-b            # Self-contained HTML file
```

**Use for**: Demos, playgrounds, embedded widgets
**Output**: Single `.html` file with compiled JS inlined
**See**: [docs/HTML_TS_COMPILERS.md](docs/HTML_TS_COMPILERS.md)

### Testing & Integration

```bash
# Test both compilers
pnpm test:compilers              # Full acceptance test suite

# Build both for production
pnpm build:compilers             # Both ready to deploy

# Full pipeline (contracts + compilers + everything)
pnpm codegen                      # OpenAPI schema → TypeScript types → builds
```

**Testing Guide**: [docs/INTEGRATION_TESTING_GUIDE.md](docs/INTEGRATION_TESTING_GUIDE.md)
**Production Hardening**: [docs/PRODUCTION_HARDENING.md](docs/PRODUCTION_HARDENING.md)

## �🎯 VS Code Setup

This workspace includes **gold-standard** VS Code configuration:

- ✅ ESLint (flat config) + Prettier (zero conflicts)
- ✅ TypeScript strict mode + project references
- ✅ Debug all apps (Node, Chrome DevTools)
- ✅ Auto-fix on save + import organization
- ✅ 16+ recommended extensions (auto-install)

**Full details**: See [docs/VSCODE_SETUP.md](docs/VSCODE_SETUP.md)

### Press F5 to Debug

Pick a debug configuration:

- **"Nucleus: Debug"** - Debug Node server
- **"IDE Web: Debug"** - Debug editor UI
- **"Preview Runtime: Debug"** - Debug game engine
- **"World Engine: Debug All"** - Debug all three simultaneously

## Project Structure

### Packages (reusable modules)

- **`@world-engine/protocol`** - Message contracts (Zod)
- **`@world-engine/bus`** - Event bus with channels
- **`@world-engine/engine`** - ECS runtime
- **`@world-engine/graphics`** - Renderer bridge
- **`@world-engine/assets`** - Asset loader
- **`@world-engine/math`** - Math primitives
- **`@world-engine/lexicon`** - Code lexicon DB
- **`@world-engine/tooling`** - Build helpers

### Apps (applications)

- **`ide-web`** - Vite-based editor UI
- **`nucleus`** - Node orchestrator (WS hub, build, routes)
- **`py-sidecar`** - FastAPI math/lexicon service
- **`preview-runtime`** - Iframe-based engine + renderer

## Architecture

```
IDE Web (Vite)
    ↓ WS
Nucleus (Node) ← → Python Sidecar (FastAPI)
    ↑ WS
Preview Runtime (Iframe with ECS Engine)
```

All communication is **typed**, **validated**, and **logged**.

## Key Features

### 1. Typed Message Protocol

Every message is a `BusEnvelope` with UUID, timestamp, sender, session, and validated payload.

### 2. Event Bus

Multiplex channels for `system`, `files`, `build`, `runtime`, `graphics`, `lexicon`, `math`, `ai`.

### 3. ECS Engine

Deterministic entity-component system for game logic.

### 4. Lexicon

Machine-usable knowledge base: functions, types, constraints, examples.

### 5. Math Catalog

- Vectors, matrices, quaternions (TS)
- Symbolic computation (Python)
- Seeded RNG for determinism

## Development Workflow

1. **Edit code** in IDE Web
2. **Save** → Nucleus detects change
3. **Build** triggers automatically
4. **Preview updates** via hot reload
5. **Inspector** shows entity tree
6. **Lexicon browser** lets you explore APIs
7. **AI brain** can safely query lexicon to build features

## Testing

```bash
# Run all tests
pnpm test

# Type check
pnpm run type-check

# Lint
pnpm run lint
```

## Deployment

(Coming soon)

## Contributing

Follow the architectural rules:

- Protocol is the bottom (everyone can import)
- Bus depends only on protocol
- Engine depends on bus + math + assets
- Graphics depends on engine (read-only)
- Apps depend on packages, never the other way

## License

MIT

---

**Status**: Early MVP (Phase 1)
