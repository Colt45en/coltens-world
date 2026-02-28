# 📦 Packages (Shared Libraries & Contracts)

**Status**: 🟢 Mature — 34 packages, well-structured, boundary-enforced

**Purpose**: Reusable libraries, protocols, and contracts that apps depend on

---

## Package Categories

### 🔴 **Core/Protocol (Foundational — everything builds on these)**

| Package | Purpose | Status | Notes |
|---------|---------|--------|-------|
| **protocol** | Zod schemas, message envelopes | 🟢 Rock-solid | Source of truth; versioned |
| **contracts** | OpenAPI → TypeScript types | 🟢 Generated | Auto-sync from openapi.json |
| **engine** | Deterministic simulation + systems | 🟢 Core | Determinism-first design |
| **lexicon** | Knowledge base + vocab | 🟢 Stable | Memory-backed; validated |
| **brain** | AI orchestration + prompts | 🟢 Active | LLM routing; prompt validation |

### 🟡 **Infrastructure (Proxies, Graph, Signal)**

| Package | Purpose | Status | Notes |
|---------|---------|--------|-------|
| **signal-spine-* (6 pkgs)** | Message queuing + resonant graph | 🟢 Mature | Complex; heavily tested |
| **nexus-contracts** | Nexus module types | 🟢 Defined | Used by py-sidecar |
| **nexus-pipeline** | Data transformation | 🟡 Partial | Some ops incomplete |
| **bus** | Event bus substrate | 🟢 Working | Lightweight; Zod-validated |
| **ledger-contracts** | Ledger schema + types | 🟢 Versioned | Append-only; audited |

### 🟡 **Domain/Feature Packages (Specialized)**

| Package | Purpose | Status | Notes |
|---------|---------|--------|-------|
| **avatar-compiler** | Character system codegen | 🟢 Solid | Phase 1+2 complete |
| **avatar-core** | Avatar runtime structs | 🟢 Stable | Binary format defined |
| **graphics** | Rendering abstractions | 🟡 Partial | GPU/WebGPU variants |
| **physics-contract** | Physics type defs | 🟡 Spec | No impl yet |
| **wegc-geometry** | WebGPU geometry | 🟢 Working | GPU compute kernels |
| **lego-prefab** | Prefab system | 🟡 Partial | Needs integration tests |
| **util** | General utilities | 🟢 Stable | Math, arrays, types |
| **math** | Advanced math lib | 🟢 Stable | Deterministic RNG |

### ⚪ **Experimental/Uncertain**

| Package | Purpose | Status | Notes |
|---------|---------|--------|-------|
| **automation-index** | Workflow indexing | ⚪ WIP | Unclear scope |
| **codex** | Content indexing | 🟡 Partial | Overlaps w/ brain? |
| **assets** | Asset registry | 🟡 Maintenance | Linked to icon gen |
| **env-sandbox** | Env testing | ⚪ Dev-only | No prod use |
| **artifacts** | Build outputs | ⚪ Unclear | Transient? |
| **flowstate** | State machine? | ⚪ Unknown | No docs |
| **nucleus-contracts** | Nucleus defs | 🟢 Defined | Paired w/ app |
| **tooling** | Internal build tools | 🟡 Partial | Mixed quality |

---

## Health Summary

### ✅ Strong (18 packages)
Protocol, contracts, engine, lexicon, brain, signal-spine (6), bus, ledger-contracts, avatar-compiler, avatar-core, math, util, wegc-geometry

### 🟡 Needs Review (10 packages)
nexus-pipeline, graphics, physics-contract, lego-prefab, automation-index, codex, assets, env-sandbox, flowstate, tooling

### ⚪ Unclear Owners (6 packages)
artifacts, artifacts, env-sandbox, flowstate, and a few with no README

---

## Dependency Rules (Enforced)

✅ All imports must go through `src/index.ts` public exports
✅ No app → app imports (only app → package allowed)
✅ `protocol` is foundational (no package imports protocol)
✅ Python sidecars communicate via HTTP boundary only

**Enforcement**: `boundary.rules.json` + `tools/boundary/check-boundaries.mjs`

---

## Known Issues

1. **Missing READMEs**: `artifacts/`, `automation-index/`, `codex/`, `env-sandbox/`, `flowstate/`, `tooling/` have no owner docs
2. **Overlapping Domains**: `codex` vs `brain` (both index content?); `physics-contract` vs `engine` physics
3. **Incomplete Tests**: `lego-prefab`, `nexus-pipeline` need integration tests
4. **Graphics Fragmentation**: GPU/WebGPU/CPU variants split across packages
5. **Math Determinism**: Verified for avatar/engine; unknown for `graphics` compute

---

## Build & Test Status

```bash
pnpm -w run build         # Should succeed; any package fails = blocker
pnpm -w run typecheck     # Strict mode; unused returns caught
pnpm -w run test          # Runs all package test suites (if defined)
pnpm -w run lint          # ESLint across all packages
```

**Current Pass Rate**: Unknown (CI gate not yet enforced on all packages)

---

## Recommended Actions

1. **Assign Owners**: Each of the 6 unclear packages needs a `OWNER.md` + README
2. **Kill or Integrate**: Decide fate of `codex` (merge into brain?) and `flowstate`,`artifacts`
3. **Physics Implementation**: Either implement or remove `physics-contract`
4. **Graphics Consolidation**: Unify GPU/CPU paths; document fallback strategy
5. **Test Coverage**: Enforce minimum test coverage gate for new packages

---

**Audit Date**: 2026-02-27
**Assessed By**: System Audit
