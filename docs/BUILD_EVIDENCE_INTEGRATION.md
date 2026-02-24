# Build Evidence Integration Guide

**Engine-grade deterministic build artifact capture + governance gates + IDE-Nucleus bus messaging**

This guide wires together the Build Evidence system across the World Engine stack.

---

## ✅ What You Have

### Phase 1: Core Evidence System (COMPLETE)

**Created:**

1. **[packages/protocol/src/buildEvidence.ts](packages/protocol/src/buildEvidence.ts)**
   - Zod schemas for build evidence packets
   - Deterministic JSON structure
   - Type definitions for TypeScript consumers

2. **[packages/lexicon/src/build-evidence.ts](packages/lexicon/src/build-evidence.ts)**
   - Lexicon consumer layer
   - Parser + type validation for evidence

3. **[apps/nucleus/src/services/compilerEvidence.ts](apps/nucleus/src/services/compilerEvidence.ts)**
   - Core evidence generation service
   - Supports: Vite + single-file esbuild
   - Hash stability verification (run twice)
   - Module graph extraction
   - Typecheck result capture

4. **[apps/nucleus/src/routes/buildEvidence.ts](apps/nucleus/src/routes/buildEvidence.ts)**
   - HTTP POST `/build/evidence` endpoint
   - Wires into Nucleus Fastify router

5. **[apps/py-sidecar/ingest_build.py](apps/py-sidecar/ingest_build.py)**
   - Converts compiler evidence → lexicon clips
   - CLI: `python ingest_build.py --in <evidence.json> --out <lexicon.json>`

6. **[apps/py-sidecar/gates_build.py](apps/py-sidecar/gates_build.py)**
   - Governance gates validation
   - `gate_build_integrity()` — outputs exist + hash valid
   - `gate_typecheck_ok()` — types checked
   - `gate_output_hash_stable()` — determinism proof
   - `run_all_build_gates()` — run all at once

### Phase 2: Bus Wiring (COMPLETE)

**Created:**

1. **[packages/protocol/src/bus/buildEvidenceBus.ts](packages/protocol/src/bus/buildEvidenceBus.ts)**
   - Bus event names: `build.evidence.request` + `build.evidence.generated`
   - Envelope schemas for both directions
   - Type-safe message definitions

2. **[apps/nucleus/src/bus/publish.ts](apps/nucleus/src/bus/publish.ts)**
   - `makeEnvelope(type, source, data)` — create deterministic envelope
   - `broadcastEnvelope(app, env)` — send to all WS clients
   - Works with fastify-websocket or custom wsHub

3. **[apps/nucleus/src/bus/handlers/buildEvidence.ts](apps/nucleus/src/bus/handlers/buildEvidence.ts)**
   - Handler for incoming `build.evidence.request` messages
   - Generates evidence + broadcasts `build.evidence.generated`

4. **[apps/ide-web/src/bus/buildEvidenceProtocol.ts](apps/ide-web/src/bus/buildEvidenceProtocol.ts)**
    - Protocol exports for IDE side
    - Message type definitions

5. **[apps/ide-web/src/bus/wsClientExtended.ts](apps/ide-web/src/bus/wsClientExtended.ts)**
    - Full WsBusClient implementation with build evidence methods
    - `requestBuildEvidence(req)` — send request
    - `onBuildEvidenceGenerated(cb)` — listen for results

---

## 🔧 Integration Steps

### Step 1: Update Protocol Exports

In **packages/protocol/src/index.ts**, add:

```ts
export * from "./buildEvidence";
export * from "./bus/buildEvidenceBus";
```

### Step 2: Update Nucleus HTTP Routes

In **apps/nucleus/src/routes.ts** (or wherever you register routes), add:

```ts
import { registerBuildEvidenceRoutes } from "./routes/buildEvidence";

export async function registerAllRoutes(app: FastifyInstance) {
  // existing routes...

  await registerBuildEvidenceRoutes(app);
}
```

### Step 3: Hook WS Handler into Nucleus

In **apps/nucleus/src/wsHub.ts** (or your WS message router), after you parse incoming JSON:

```ts
import { handleBuildEvidenceBusMessage } from "./bus/handlers/buildEvidence";

// Inside your ws.on("message", async (data) => { ... })
const raw = JSON.parse(String(data));

// Try build evidence handler first
if (await handleBuildEvidenceBusMessage(app, raw)) return;

// Fallthrough to existing handlers...
```

### Step 4: Broadcast from HTTP Route (Optional)

In **apps/nucleus/src/routes/buildEvidence.ts**, after creating evidence, add broadcast:

```ts
import { makeEnvelope, broadcastEnvelope } from "../bus/publish";
import { EVT_BUILD_EVIDENCE_GENERATED } from "@world-engine/protocol/bus/buildEvidenceBus";

// After: await writeBuildEvidencePacket(packet, evidenceOutAbs);

broadcastEnvelope(
  app,
  makeEnvelope(EVT_BUILD_EVIDENCE_GENERATED, "nucleus", {
    packet,
    evidencePath: evidenceOutAbs,
  }),
);
```

### Step 5: Use in IDE

In your IDE components (e.g., **apps/ide-web/src/ui/buildPanel.tsx**):

```tsx
import { WsBusClient } from "../bus/wsClientExtended";

export function BuildPanel() {
  const [evidence, setEvidence] = React.useState<BuildEvidencePacket | null>(null);

  React.useEffect(() => {
    const bus = new WsBusClient("ws://localhost:3000/ws", "ide-web");
    bus.connect();

    const unsub = bus.onBuildEvidenceGenerated((packet, path) => {
      setEvidence(packet);
      console.log("Build evidence ready:", path);
    });

    return () => unsub();
  }, []);

  return (
    <div>
      <button
        onClick={() => {
          bus.requestBuildEvidence({
            compiler: "vite",
            buildRoot: "apps/ide-web",
            runTwice: true,
            runTypecheck: true,
          });
        }}
      >
        Capture Evidence
      </button>
      {evidence && (
        <div>
          <p>Bundle Hash: {evidence.bundle_hash}</p>
          <p>Determinism: {evidence.determinism.hashStable ? "✅" : "⚠️"}</p>
        </div>
      )}
    </div>
  );
}
```

---

## 📋 Usage Patterns

### Pattern 1: CLI Evidence Generation (HTTP)

```bash
# Request evidence from Nucleus
curl -X POST http://localhost:3000/build/evidence \
  -H "Content-Type: application/json" \
  -d '{
    "compiler": "vite",
    "buildRoot": "apps/ide-web",
    "runTwice": true,
    "runTypecheck": true
  }'

# Returns JSON with packet + evidencePath
```

### Pattern 2: IDE Live Capture (WS)

```typescript
bus.requestBuildEvidence({
  compiler: "vite",
  buildRoot: "apps/ide-web",
  runTwice: true,
});

// Listen for result
bus.onBuildEvidenceGenerated((packet) => {
  console.log("Built with hash:", packet.bundle_hash);
});
```

### Pattern 3: Python Ingest Pipeline

```bash
# Generate evidence
curl -X POST http://localhost:3000/build/evidence \
  -d '{ ... }' > /tmp/evidence.json

# Ingest into lexicon
python ingest_build.py \
  --in /tmp/evidence.json \
  --out /tmp/lexicon-clip.json

# Validate against gates
python -c "
from gates_build import run_all_build_gates
import json
with open('/tmp/evidence.json') as f:
  evidence = json.load(f)
gates = run_all_build_gates(evidence)
print(json.dumps(gates, indent=2))
"
```

### Pattern 4: Pre-deployment Check

```bash
# Vite build with determinism proof
node tooling/test-compilers.mjs \
  --compiler vite \
  --buildRoot apps/ide-web \
  --runTwice

# Outputs: .artifacts/build-evidence/<id>.json
```

---

## 🎯 Key Design Facts

### Determinism Guarantee

✅ File hashes (SHA256) of all outputs
✅ Deterministic bundle_hash (canonical JSON order)
✅ Optional: run twice and compare hashes
✅ No timestamps in evidence packet ID (only compiler/buildRoot/mode/bundleHash)

### Governance Layers

1. **Compiler Level** — Vite/esbuild output
2. **Hash Level** — SHA256 stability
3. **Typecheck Level** — PASSED or ERRORS
4. **Gate Level** — Python validators decide if "good enough"

### Message Flow

```
IDE → (WS: build.evidence.request)
      ↓
Nucleus (service: generateBuildEvidence)
      ↓
Nucleus → (WS: build.evidence.generated + disk artifact)
      ↓
IDE + Python Sidecar listen for results
      ↓
(Optional) Python ingests → Lexicon, runs gates
```

---

## 📊 Artifact Structure

### .artifacts/build-evidence/

```
.artifacts/
  build-evidence/
    be_vite_<hash>.json           ← Nucleus writes here
    be_singlefile_esbuild_<hash>.json
```

Each file is:

```json
{
  "schemaVersion": "1.0.0",
  "id": "be_vite_abc123...",
  "ts": "2026-02-13T...",
  "compiler": "vite",
  "status": "passed",
  "repoRoot": "c:/...",
  "buildRoot": "c:/apps/ide-web",
  "outDir": "c:/apps/ide-web/dist",
  "mode": "production",
  "typecheck": { "ran": true, "passed": true, "errors": [] },
  "outputs": [
    { "path": "index.html", "bytes": 1234, "sha256": "abc..." },
    ...
  ],
  "bundle_hash": "def...",
  "module_graph": { "kind": "vite-manifest", "nodes": 42, ... },
  "buildErrors": [],
  "determinism": { "ranTwice": true, "hashStable": true, ... }
}
```

---

## ⚠️ Common Issues

### Issue: No websocket broadcast target

**Error:** `No websocket broadcast target found...`

**Fix:** Update `broadcastEnvelope()` in [apps/nucleus/src/bus/publish.ts](apps/nucleus/src/bus/publish.ts) to match your WS server pattern:

```ts
// If using different server, adapt this:
if (app?.io?.emit) {
  app.io.emit("message", JSON.stringify(env));
}
```

### Issue: Module not found: compilerEvidence

**Error:** `Cannot find module...compilerEvidence`

**Fix:** Ensure [apps/nucleus/src/services/](apps/nucleus/src/services/) directory exists

### Issue: Typecheck says no such file/directory

**Error:** `tsc not found`

**Fix:** Ensure project has TypeScript installed:

```bash
pnpm install -D typescript
```

---

## 🧪 Testing

### Test HTTP Endpoint

```bash
curl -X POST http://localhost:3000/build/evidence \
  -H "Content-Type: application/json" \
  -d '{"compiler":"vite","buildRoot":"apps/ide-web"}'
```

### Test WS Message

```ts
const bus = new WsBusClient("ws://localhost:3000/ws");
bus.connect();
bus.requestBuildEvidence({
  compiler: "vite",
  buildRoot: "apps/ide-web",
  runTwice: false,
});

setTimeout(() => {
  console.log("Check .artifacts/build-evidence/ for output");
}, 5000);
```

### Test Python Ingest

```bash
python ingest_build.py --in test.json --out out.json
```

### Test Gates

```bash
python -c "from gates_build import run_all_build_gates; print(run_all_build_gates({...}))"
```

---

## 🚀 Next Steps

**Optional improvements:**

1. **Add build.evidence.failed event** — separate channel for errors
2. **Add build.evidence.gated event** — Nucleus runs gates and publishes gate report
3. **Add IDE overlay** — render "build truth" in source editor
4. **Add CI integration** — hook evidence into pre-deployment checks
5. **Add monitoring** — track evidence across time (stability plots)

---

## 📎 File Reference

| File                                                                                             | Purpose        | Status |
| ------------------------------------------------------------------------------------------------ | -------------- | ------ |
| [packages/protocol/src/buildEvidence.ts](packages/protocol/src/buildEvidence.ts)                 | Core schemas   | ✅     |
| [packages/lexicon/src/build-evidence.ts](packages/lexicon/src/build-evidence.ts)                 | Lexicon layer  | ✅     |
| [apps/nucleus/src/services/compilerEvidence.ts](apps/nucleus/src/services/compilerEvidence.ts)   | Service impl   | ✅     |
| [apps/nucleus/src/routes/buildEvidence.ts](apps/nucleus/src/routes/buildEvidence.ts)             | HTTP route     | ✅     |
| [apps/py-sidecar/ingest_build.py](apps/py-sidecar/ingest_build.py)                               | Python ingest  | ✅     |
| [apps/py-sidecar/gates_build.py](apps/py-sidecar/gates_build.py)                                 | Governor gates | ✅     |
| [packages/protocol/src/bus/buildEvidenceBus.ts](packages/protocol/src/bus/buildEvidenceBus.ts)   | Bus protocol   | ✅     |
| [apps/nucleus/src/bus/publish.ts](apps/nucleus/src/bus/publish.ts)                               | Broadcaster    | ✅     |
| [apps/nucleus/src/bus/handlers/buildEvidence.ts](apps/nucleus/src/bus/handlers/buildEvidence.ts) | WS handler     | ✅     |
| [apps/ide-web/src/bus/buildEvidenceProtocol.ts](apps/ide-web/src/bus/buildEvidenceProtocol.ts)   | IDE protocol   | ✅     |
| [apps/ide-web/src/bus/wsClientExtended.ts](apps/ide-web/src/bus/wsClientExtended.ts)             | IDE client     | ✅     |

---

**Created:** Session 5 (Build Evidence Integration)
**Status:** Ready for integration + testing
**Next:** Wire integration points into your existing Nucleus/IDE codebase
