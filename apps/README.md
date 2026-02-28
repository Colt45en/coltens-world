# 📱 Apps (Runtime Applications)

**Status**: 🟡 Heterogeneous — 13 applications at varying maturity levels

**Purpose**: Runtime deployable applications and interactive experience layers

---

## Application Inventory

| App | Status | Purpose | Entry | Notes |
|-----|--------|---------|-------|-------|
| **nucleus** | 🟢 Core | AI orchestration engine | `npm run dev` | Central command; routes to AI agents |
| **ide-web** | 🟢 Active | Web IDE (Vite+React) | Port 5173 | Live editor for world content |
| **preview-runtime** | 🟢 Active | Asset preview service | Port 5174 | Renders 3D/2D graphics |
| **py-sidecar** | 🟢 Active | Python async runner | Port 8011 | LLM calls, ML pipelines |
| **sim-server** | 🟢 Running | WebSocket sim authority | Port 8080 | Physics/game loop |
| **agenthub** | 🟡 Partial | Agent registry + mesh | Multi-port | Experimental; perf issues |
| **agent-server** | 🟡 Partial | Individual agent runner | Unknown | Part of hub ecosystem |
| **agent-suite** | 🟡 Partial | Agent tooling suite | Unknown | CLIs for agent ops |
| **avatar-lab** | 🟡 Sandbox | Avatar compiler testing | Dev-only | Character system lab |
| **avatar-sandbox** | 🟡 Sandbox | Avatar binary test env | Dev-only | Debug builds |
| **env-sandbox** | ⚪ Experimental | Environment tests | Dev-only | Not in mainline |
| **world-editor** | ⚪ Early | Content editor (Electron?) | Unknown | WIP desktop app |
| **web** | ⚪ Unknown | Project web docs? | Unknown | Legacy; check status |

---

## Health Summary

### ✅ Ready for Local Dev (5)
- nucleus, ide-web, preview-runtime, py-sidecar, sim-server

### 🟡 Needs Stabilization (5)
- agenthub (mesh/perf), agent-server, agent-suite, avatar-lab, avatar-sandbox

### ⚪ Unclear / Legacy (3)
- env-sandbox, world-editor, web

---

## Known Issues

1. **AgentHub Mesh**: Multi-port architecture has latency/stability issues (documented in AGENTHUB_DEPLOYMENT_CHECKLIST.md)
2. **Avatar Sandbox**: Conditional build chains; binaries not always linked correctly
3. **World Editor**: Status unclear; needs owner assignment
4. **E2E Start Path**: `start-dev.bat` hardcodes ports; no graceful fallback if port occupied

---

## Scripts That Drive Apps

From root `pnpm`:

```bash
pnpm dev                      # Runs scripts/dev.mjs (orchestrator)
pnpm --filter apps/nucleus run dev
pnpm --filter apps/ide-web run dev -- --port 5173
pnpm --filter apps/preview-runtime run dev -- --port 5174
```

**Orchestrator location**: `scripts/dev.mjs` (no guarantees on parallel launch order)

---

## Dependency Notes

- **Apps depend on packages/* contracts**: Tight coupling via protocol.ts, engine imports
- **No apps import from other apps**: Rule enforced (or should be)
- **Python sidecar**: HTTP-only boundary; language isolation respected ✅

---

## Recommended Next Steps

1. **Stabilize agenthub**: Profile mesh latency; reduce port sprawl
2. **Clarify world-editor**: Assign owner; decide Electron vs browser
3. **Document avatar build**: Why binaries sometimes don't link; automate checks
4. **Port conflict handling**: Make `start-dev.bat` resilient (port checking, fallback)

---

**Audit Date**: 2026-02-27
**Assessed By**: System Audit
