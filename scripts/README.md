# 🔧 Scripts (Automation & Tooling)

**Status**: 🟡 Mixed — Functional orchestrators + incomplete diagnostics

**Purpose**: Build automation, dev orchestration, diagnostics, and maintenance scripts

---

## Core Scripts

### 🟢 **Production Use**

| Script | Purpose | Maturity | Command |
|--------|---------|----------|---------|
| **dev.mjs** | Dev environment orchestrator | 🟢 Stable | `pnpm dev` |
| **launch-all.mjs** | Production launcher | 🟢 Stable | `pnpm launch` |
| **repo-doctor.mjs** | Repository health check | 🟢 Mature | `pnpm run doctor` |
| **bootstrap-project.ps1** | Initial setup (PowerShell) | 🟡 Tested | `.\bootstrap-project.ps1` |
| **setup.sh / setup.bat** | Cross-platform setup | 🟡 Legacy | Used once, rarely maintained |

### 🟡 **Development/Diagnostic**

| Script | Purpose | Maturity | Command |
|--------|---------|----------|---------|
| **diagtool.py** | Build diagnostics → SARIF | 🟡 Partial | `python scripts/diagtool.py` |
| **import-export-tracker.mjs** | Boundary analysis | 🟢 Active | `pnpm run audit:imports` |
| **enforce-contracts-truth.js** | Contract validation | ⚪ Unknown | Not in root scripts |
| **test-e2e-avatar-approval.mjs** | Avatar E2E tester | 🟡 Partial | `pnpm run test:avatar` |
| **verify-ledger.ts** | Ledger audit | 🟡 Partial | Not exposed as root script |
| **doctor-windows-node.ps1** | Windows Node resolver | 🟢 New | `powershell -ExecutionPolicy Bypass -File ...` |

### ⚪ **Experimental / Unclear**

| Script | Purpose | Status | Notes |
|--------|---------|--------|-------|
| **startup-unified.mjs** | Unified startup? | ⚪ Unknown | Intent unclear |
| **generate-post-icons.mjs** | Icon generation | 🟡 Works | Narrow use case |
| **ledger/** (subdirectory) | Ledger utilities | 🟡 Partial | Multiple tools |
| **replay/** (subdirectory) | Test replay suite | 🟡 Partial | Determinism validation |
| **seed/** (subdirectory) | Test data seeding | 🟡 Partial | Avatar/engine seeding |
| **env/** (subdirectory) | Environment setup | 🟡 Partial | OS-specific configs |

---

## Script Dependencies

```
dev.mjs
  ├── apps/nucleus (npm link)
  ├── apps/ide-web (npm link)
  ├── apps/preview-runtime (npm link)
  └── apps/py-sidecar (Python venv)

launch-all.mjs
  ├── nucleus (production build)
  ├── sim-server (production build)
  └── External: pm2 / systemd (depends on OS)

repo-doctor.mjs
  ├── Filesystem checks (no deps)
  ├── .gitignore validation
  └── boundary.rules.json analysis
```

**Health**: `repo-doctor` is most robust; others have silent failures on missing deps

---

## Known Issues

1. **diagtool.py**: Parse errors on Windows; SARIF sometimes not created (fixed in CI but local runs fragile)
2. **launch-all.mjs**: Hardcoded ports; no fallback if port occupied; can't gracefully restart
3. **setup scripts**: Outdated; use with caution; `bootstrap-project.ps1` is newer/better
4. **Ledger utilities**: Scattered across subdirs; no unified entry point or docs
5. **Replay suite**: Works for avatars only; engine testing incomplete
6. **enforce-contracts-truth.js**: Not exposed; unclear if it still runs or is maintained

---

## Actual Usage Patterns

From root `package.json` scripts:

```json
{
  "dev": "node scripts/dev.mjs",
  "launch": "node scripts/launch-all.mjs",
  "launch:complete": "node scripts/launch-all.mjs",
  "doctor": "node scripts/repo-doctor.mjs",
  "audit:imports": "node scripts/import-export-tracker.mjs --root . --write --dot",
  "test:avatar": "pnpm -C packages/avatar-compiler run test",
  "test:replay": "vitest run scripts/replay/replay.test.ts --globals",
  "seed:world-engine": "tsx scripts/seed/seed-world-engine.ts --seed 1337"
}
```

**What's exposed vs. what exists**: Only ~40% of `/scripts` contents are wired into root scripts

---

## Environment Scripts (env/)

Windows-specific; used in `build:deterministic` and other gates:

```powershell
scripts/env/clean-env.ps1       # Ensures reproducible env vars
scripts/env/print-tooling-env.ps1  # Diagnostics
```

**Status**: 🟡 Windows-only; need bash equivalents for CI

---

## Quality Issues

| Issue | Impact | Severity |
|-------|--------|----------|
| Lost error context (scripts fail silently) | Dev confusion | 🟡 Medium |
| No unified CLI (must remember each script's flags) | UX friction | 🟡 Medium |
| SARIF generation flaky on local machines | CI/CD trust | 🟡 Medium |
| Port hardcoding (`dev.mjs`, `launch-all.mjs`) | Local dev conflicts | 🟡 Medium |
| Environment setup scattered across `.ps1`, `.sh`, `.bat` | Onboarding pain | 🟡 Medium |
| Incomplete ledger tooling | DevOps blind spots | 🟠 Low-Medium |

---

## Recommended Actions

1. **Unify CLI**: Create `pnpm run scripts:list` to show all available scripts w/ help
2. **Wrap diagtool**: Make `pnpm run diagnose` handle Windows/Linux differences
3. **Port negotiation**: Update `dev.mjs` + `launch-all.mjs` to detect occupied ports
4. **Expose ledger tools**: Add root scripts for ledger audit/verify/chain
5. **Consolidate env setup**: Choose bash OR PowerShell; don't maintain both
6. **Document each**: Add `-h / --help` flags and minimal docstrings to every script

---

**Audit Date**: 2026-02-27
**Assessed By**: System Audit
