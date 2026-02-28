# COLTENS-WORLD: Architecture & Standards

**Version**: 1.0.0
**Last Updated**: 2026-02-24
**Status**: Golden Standard Blueprint

---

## 🎯 Core Principles (10 Invariants)

1. **One Root. No Nested Meta-Folders.**
   - Single `.git` directory at repository root
   - Never duplicate `.github/`, `.vscode/`, `.gitignore`, etc. in subdirectories
   - All config at top level or in relevant app/package directories only

2. **No Generated Outputs in Git**
   - source code ✅ (always in git)
   - compiled outputs ❌ (dist/, build/, node_modules/, .venv/, caches)
   - build process must be reproducible from clean checkout
   - `.gitignore` is strict and complete

3. **Single Package Manager (pnpm)**
   - One workspaces manifest: `pnpm-workspace.yaml`
   - One lockfile: `pnpm-lock.yaml`
   - No npm, Yarn, or mixed package managers
   - Enforce via `preinstall` script

4. **Contracts-First Development**
   - All schemas defined in `packages/contracts/schemas/`
   - Codegen runs before any runtime code imports contracts
   - Generated types/validators (TS, Python, OpenAPI) are produced deterministically by `pnpm run codegen`
   - Generated code is NOT committed to git (lives in `packages/contracts/dist/` or `.gitignored`, rebuilt during `pnpm install`)
   - Source schemas are committed; generated outputs are never hand-edited
   - CI gate: `pnpm run codegen:check` fails on drift (schema change without regeneration)

5. **Strict Boundary Enforcement**
   - Apps cannot import from other apps
   - Packages cannot import dist/ of other packages
   - Only import public `src/index.ts` exports
   - Protocol is foundation; engine builds on protocol; apps consume engine
   - `boundary.rules.json` is enforced in static analysis

6. **Determinism & Reproducibility**
   - Core logic is deterministic (given same inputs → same outputs)
   - Seeded randomness for simulations
   - No wall-clock time in core logic
   - Snapshot tests are generated, not hand-maintained
   - Replay database for deterministic replay testing

7. **CI Must Always Pass on Clean Checkout**
   - clean clone + install + build + test = success
   - No "works locally" excuses
   - Artifacts are uploaded, not committed
   - Test artifacts (playwright-report) stored separately

8. **Artifacts Are Separate from Source**
   - Build outputs (dist/, build/) are gitignored
   - Test reports (playwright-report/, test-results/) are gitignored
   - Deployment artifacts uploaded to CI (GitHub Actions, S3, etc.)
   - Optional: `artifacts/` folder for debugging summaries (still gitignored)

9. **Documented & Enforced Taxonomy**
   - Contracts are single source of truth
   - Apps/packages have clear responsibilities
   - Dependencies are explicit in `boundary.rules.json`
   - Every import is intentional (no accidental deep imports)
   - `CODEOWNERS` controls who reviews boundary changes

10. **Every Tool Lane Allowlisted**
    - Each tool (code generation, bundling, testing) has explicit input/output spec
    - `tooling/` contains codegen, validation, replay harness
    - Tools are versioned; output is deterministic
    - Tools themselves are source (kept in git)

---

## 📁 Repository Structure

```
coltens-world/                           # ← Root repo
├── .github/
│   ├── workflows/                       # ← CI/CD pipelines
│   │   ├── ci.yml                       # PR gate (lint, test, boundary)
│   │   ├── e2e.yml                      # E2E tests (Playwright, Python)
│   │   ├── codegen.yml                  # Auto-regenerate types
│   │   ├── security.yml                 # Dependency + secret scanning
│   │   └── release.yml                  # Versioning + publish
│   ├── CODEOWNERS                       # Who approves boundary changes
│   └── dependabot.yml                   # Automated dependency updates
│
├── .vscode/
│   ├── extensions.json                  # Recommended extensions
│   ├── settings.json                    # Shared editor settings
│   ├── tasks.json                       # Dev tasks (build, test, dev)
│   └── launch.json                      # Debug configs
│
├── apps/                                # ← User-facing applications
│   ├── nucleus/                         # Core orchestrator
│   │   ├── src/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── README.md
│   ├── ide-web/                         # Web IDE (Vite + React)
│   ├── agent-server/                    # AI agent WebSocket backend
│   ├── sim-server/                      # Physics simulation server
│   ├── py-sidecar/                      # Python microservice
│   ├── avatar-lab/                      # Avatar creation tool
│   ├── preview-runtime/                 # Preview rendering
│   ├── web/                             # Public website
│   ├── agenthub/                        # Agent management backend
│   └── agent-suite/                     # Research/eval tools
│
├── packages/                            # ← Shared libraries
│   ├── contracts/                       # ← SINGLE SOURCE OF TRUTH for schemas
│   │   ├── schemas/
│   │   │   ├── message.schema.json
│   │   │   ├── ledger.schema.json
│   │   │   ├── stream-event.schema.json
│   │   │   └── workflow.schema.json
│   │   ├── openapi/
│   │   │   └── openapi.json             # Generated from schemas
│   │   ├── dist/                        # Generated (gitignored): TS validators, Python pydantic
│   │   └── package.json
│   ├── protocol/                        # ← Re-exports generated TS types from contracts
│   │   ├── src/
│   │   │   ├── index.ts                 # Public exports (re-export from contracts)
│   │   │   └── [... message helpers ...]
│   │   └── package.json                 # Does NOT define new schemas
│   ├── engine/                          # ← Core simulation engine
│   ├── bus/                             # ← Event bus / message router
│   ├── ledger-contracts/                # ← Ledger schema contracts
│   ├── automation-index/                # ← Module registry & orchestration
│   ├── tooling/                         # ← Build utilities (internal)
│   ├── math/                            # ← Math utilities
│   ├── lexicon/                         # ← Vocabulary & constants
│   └── [... 19+ more packages ...]
│
├── tooling/                             # ← Automation & code generation
│   ├── codegen/
│   │   ├── generate-types.mjs           # TypeScript type generation
│   │   ├── generate-python.mjs          # Python pydantic generation
│   │   └── validators.mjs               # Runtime validators
│   ├── boundary/
│   │   └── check-imports.mjs            # Enforce architecture rules
│   ├── replay/
│   │   └── replay-engine.mjs            # Deterministic replay harness
│   ├── run.mjs                          # Tool runner orchestrator
│   └── tools.manifest.json              # Tool registry & versions
│
├── scripts/                             # ← Developer scripts
│   ├── dev.mjs                          # Start all services
│   ├── setup.sh                         # macOS/Linux setup
│   ├── setup.ps1                        # Windows setup
│   ├── doctor.sh                        # Repo health check
│   ├── repo-doctor.mjs                  # Automated health validator
│   └── launch-all.mjs                   # Launch entire ecosystem
│
├── docs/                                # ← Documentation
│   ├── spec/                            # Protocol & contract specs
│   ├── integration/                     # Integration guides
│   ├── runbooks/                        # Operations runbooks
│   ├── adr/                             # Architecture Decision Records
│   └── taxonomy/                        # Vocabulary & concepts
│
├── artifacts/                           # ← Debugging artifacts (GITIGNORED)
│   ├── ci/                              # CI logs & reports (uploaded separately)
│   ├── playwright/                      # E2E screenshots (uploaded separately)
│   ├── pipeline_runs/                   # Determinism replay logs
│   └── replays/                         # Deterministic replay databases
│
├── runtime/                             # ← Local machine state (GITIGNORED)
│   ├── db/                              # Local databases
│   ├── logs/                            # Runtime logs
│   ├── tmp/                             # Temporary files
│   └── cache/                           # Build/development caches
│
├── native/                              # ← C++ native code (if needed)
│   ├── cpp/
│   │   ├── CMakeLists.txt
│   │   ├── src/
│   │   ├── include/
│   │   └── tests/
│   └── build/                           # GITIGNORED
│
├── .editorconfig                        # Editor settings (all files)
├── .gitattributes                       # Git attributes (line endings)
├── .gitignore                           # Git ignore rules (comprehensive)
├── .prettierrc.json                     # Code formatting
├── .prettierignore                      # Files to skip formatting
├── eslint.config.mjs                    # Linting rules
├── tsconfig.base.json                   # Shared TypeScript config
├── tsconfig.json                        # Root TypeScript config
├── turbo.json                           # Turbo monorepo orchestration
├── pnpm-workspace.yaml                  # pnpm workspaces definition
├── pnpm-lock.yaml                       # Dependency lockfile
├── package.json                         # Root package definition
│
├── README.md                            # Project overview
├── CONTRIBUTING.md                      # Development guide
├── SECURITY.md                          # Security policy
├── ARCHITECTURE.md                      # This file
├── CHANGELOG.md                         # Version history
└── boundary.rules.json                  # Architecture enforcement rules
```

---

## 🔐 Dependency Layers (Build Order)

```
Layer 0: Contracts (Canonical Schema Authority)
└─ packages/contracts/schemas/ (SINGLE SOURCE OF TRUTH for all messages/types)
   ↓ codegen → TS types + Python Pydantic (dist/, gitignored)
   ↓
Layer 1: Protocol & Foundations
├─ packages/protocol/ (re-exports generated types from Layer 0, adds helpers)
├─ packages/contracts/ (codegen outputs, exposes generated validators)
└─ packages/ledger-contracts/ (schema contracts, generated)
   ↓
Layer 2: Core Infrastructure
├─ packages/engine/ (core simulation)
├─ packages/bus/ (event routing)
└─ packages/math/ (utilities)
   ↓
Layer 3: Features
├─ packages/automation-index/ (module registry)
├─ packages/lexicon/ (vocabulary)
└─ [... domain packages ...]
   ↓
Layer 4: Applications
├─ apps/nucleus/ (orchestrator)
├─ apps/agent-server/ (AI agents)
├─ apps/ide-web/ (IDE UI)
├─ apps/py-sidecar/ (Python services)
└─ [... other apps ...]
```

**Build Rule**:
1. Layer 0: Codegen runs (schemas → TS + Python)
2. Layers 1–4: tsc respects tsconfig.json dependency order. Turbo orchestrates parallel compilation.
3. Artifacts (dist/) are gitignored; deployment fetches clean builds.

---

## 🎯 Schema Authority Rule (Critical Anti-Pattern Prevention)

**Any cross-service message shape must have exactly ONE canonical schema located in `packages/contracts/schemas/`.**

This single rule prevents 90% of future schema drift and contract mismatches.

### Rules:
- ✅ Define schemas in: `packages/contracts/schemas/*.schema.json`
- ✅ Codegen produces TS types and Python Pydantic models
- ✅ Protocol, Brain, Nucleus, and all consumers import generated types
- ✅ Within a single service: local TypeScript interfaces can extend generated types
- ❌ NEVER define the same message shape in multiple places
- ❌ NEVER hand-edit generated types (they will be overwritten on next codegen)
- ❌ NEVER use unvalidated JSON as a message (always parse through generated validator)

### Example: StreamEvent (P0.4 Production Hardening)
```
✅ SOURCE: packages/contracts/schemas/stream-event.schema.json
   ↓ codegen
✅ Generated: packages/contracts/dist/stream-event.ts (TS validator)
✅ Generated: packages/contracts/dist/stream_event.py (Pydantic model)
   ↓ imports
✅ Protocol re-exports: packages/protocol/src/index.ts
✅ Nucleus imports: import { StreamEvent } from "@world-engine/protocol"
✅ Brain uses: from packages.contracts import StreamEvent (Python)
```

---

## 📋 CI Gates (Must Pass)

Every commit must pass ALL gates:

1. **Lint** (`pnpm run lint`)
   - ESLint, Prettier, format checks

2. **TypeScript Type Check** (`pnpm run typecheck`)
   - `tsc --noEmit`
   - Strict mode enabled
   - All packages must compile

3. **Unit Tests** (`pnpm run test:unit`)
   - Jest / Vitest
   - Coverage threshold: 70%+
   - Failure blocks merge

4. **Boundary Check** (`pnpm run boundary:check`)
   - Enforces architecture rules from `boundary.rules.json`
   - Prevents illegal imports
   - Failure blocks merge

5. **Codegen Check** (`pnpm run codegen:check`)
   - Runs codegen
   - Verifies no git diff
   - If schemas changed, types must be regenerated
   - Failure blocks merge

6. **Build Verification** (`pnpm run build`)
   - All packages and apps compile
   - No errors or warnings in strict mode
   - Artifacts are NOT committed

7. **E2E Tests** (Nightly, or on `main`)
   - Playwright test suite
   - Python integration tests
   - Report uploaded as CI artifact

8. **Security** (Scheduled daily)
   - Dependency vulnerability scan
   - Secret scanning (TruffleHog)
   - CodeQL analysis
   - License compliance check

---

## 📦 Adding a New Package

```bash
# 1. Create directory
mkdir -p packages/my-pkg/src
mkdir -p packages/my-pkg/test

# 2. Create package.json
cat > packages/my-pkg/package.json << 'EOF'
{
  "name": "@world-engine/my-pkg",
  "version": "0.0.1",
  "type": "module",
  "exports": {
    ".": "./dist/index.js",
    "./types": "./dist/index.d.ts"
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest"
  }
}
EOF

# 3. Create tsconfig.json
cat > packages/my-pkg/tsconfig.json << 'EOF'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "declaration": true
  },
  "include": ["src"],
  "exclude": ["test"]
}
EOF

# 4. Create src/index.ts with public exports
echo "export const myFunction = () => {};" > packages/my-pkg/src/index.ts

# 5. pnpm will auto-detect via pnpm-workspace.yaml
# 6. Run pnpm install to link workspace
pnpm install

# 7. Test the build
pnpm build
```

---

## 📱 Adding a New App

```bash
# Apps follow same pattern as packages
mkdir -p apps/my-app/src

# Use Vite for frontend apps
# Use Node.js for backend apps

# All apps import from packages/ only
# No app-to-app imports allowed
```

---

## ✅ Testing Strategy

### Unit Tests (Fast, PR gate)
```bash
pnpm run test:unit
# ✅ Deterministic
# ✅ Fast (<30 seconds)
# ✅ No side effects
```

### Integration Tests (Medium, optional in PR)
```bash
pnpm run test:integration
# ✅ Cross-package boundaries
# ✅ Contract validation
```

### E2E Tests (Slow, nightly on main)
```bash
pnpm run test:e2e
# ✅ Full application flow
# ✅ Playwright browser automation
# ✅ Python service integration
```

---

## 🚀 Deployment

### Build for Production
```bash
pnpm run build:prod
# 1. Clean
# 2. Generate contracts
# 3. Compile all packages
# 4. Bundle all apps
# 5. Create deployment artifacts
```

### Deploy Strategy
- **Frontend Apps**: Upload to CDN / static hosting
- **Backend Apps**: Container image → registry
- **Python Services**: Python runtime + dependencies (locked)
- **Native Code**: Pre-compiled binaries (if C++/Rust)

---

## 📋 Checklist: Before Every Commit

- [ ] Ran `pnpm run lint` locally
- [ ] Ran `pnpm run typecheck` locally
- [ ] Ran `pnpm run test:unit` locally
- [ ] Ran `pnpm run build` to verify no errors
- [ ] Did NOT commit any dist/, build/, node_modules/, .venv/
- [ ] All imports follow boundary rules
- [ ] If schemas changed, ran `pnpm run codegen`
- [ ] Commit message is descriptive

---

## 🆘 Common Issues

**Q: "Module not found" after git pull**
A: Run `pnpm install` to refresh workspace symlinks.

**Q: "dist is out of sync" error**
A: Run `pnpm run codegen` before committing schema changes.

**Q: "Boundary violation" on import**
A: Check `boundary.rules.json`. Either:
   - Fix the import, or
   - Add justified exception with reason

**Q: Build passes locally but fails in CI**
A: CI runs on clean checkout (no node_modules cache).
   - Run `rm -rf node_modules && pnpm install` and rebuild.
   - Verify all imports are relative/absolute (no symlink issues).

---

## 📚 References

- **Protocol**: `packages/protocol/README.md`
- **Engine**: `packages/engine/README.md`
- **Contracts**: `packages/contracts/README.md`
- **Contributing**: `CONTRIBUTING.md`
- **Boundary Rules**: `boundary.rules.json`
- **Workflows**: `.github/workflows/`

---

## 🔄 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-24 | Golden standard blueprint established |

---

**Last Updated**: 2026-02-24
**Maintainers**: Architecture Team
