/**
 * Nucleus WS Hub & Router
 *
 * CRITICAL: Two separate WS endpoints exist:
 *
 * 1. ws://localhost:3000 (THE HUB - IDE ONLY)
 *    ├─ Purpose: Hub for IDE orchestration + session mgmt
 *    ├─ Auth: Implicit (IDE is trusted local client)
 *    ├─ Use case: IDE connects here (apps/ide-web/src/main.tsx)
 *    └─ Security: Rate limiting, nonce validation, role gating
 *
 * 2. ws://localhost:3000/ws/bus (tool/service bus - NOT FOR IDE)
 *    ├─ Purpose: Raw bus for direct tools/services
 *    ├─ Auth: Required (token-based)
 *    ├─ Use case: Sidecar, tools, operator services
 *    └─ Security: Same gating as hub, but explicit routing
 *
 * ⚠️  DEVELOPER NOTE:
 *    DO NOT wire IDE to /ws/bus. It bypasses intended architecture.
 *    IDE MUST use ws://localhost:3000 (hub endpoint).
 *    This is not a preference; it's a security boundary.
 *
 */

import { ArtifactStore } from "@world-engine/artifacts";
import { WorldEngineRuntime, createConceptExtractionPipeline } from "@world-engine/engine";
import { HashChainedLedger } from "@world-engine/ledger";
import http from "node:http";
import { URL } from "node:url";
import { WebSocketServer } from "ws";
import type { ApprovalStateMachine } from "./approvals/state-machine";
import type { Ledger } from "./ledger/ledger";
import { createArtifactsRoutes } from "./routes/artifacts-routes.js";
import { handleBusReplayRequest } from "./routes/busReplay";
import { handleHealthCheck } from "./routes/health";
import { handleAvatarCompile } from "./routes/http/avatars";
import { handleFlowstateAnalyze } from "./routes/http/flowstate";
import { handleLeximorph } from "./routes/http/leximorph";
import { handlePipelineResultsFile, handlePipelineResultsIndex } from "./routes/http/pipelineResults";
import { createLedgerRoutes, initializeLedger } from "./routes/ledger";
import {
  createArtifactLedgerRoutes,
  initializeArtifactLedger,
} from "./routes/ledger-artifact-routes.js";
import { handleOperatorEvent } from "./routes/operatorEvent";
import { createToolCallRoutes } from "./routes/tool_call.js";
import { createWorldEngineRoutes } from "./routes/world_engine.js";
import { setupBusHttpUpgradeHandler } from "./routes/wsBus";
import { createHub } from "./wsHub";

const PORT = Number(process.env.NUCLEUS_PORT ?? "3000");
const WORLD_ROOT = process.env.WORLD_ROOT ?? ".world";

// Ledger initialization (append-only event store)
let ledger: Ledger;
let approvals: ApprovalStateMachine;
let ledgerRoutesHandler: (req: any, res: any) => Promise<boolean>;

// Provenance ledger + artifact store
let artifactLedger: HashChainedLedger;
let artifactStore: ArtifactStore;
let artifactLedgerRoutes: (req: any, res: any) => Promise<boolean>;
let artifactsRoutes: (req: any, res: any) => Promise<boolean>;
let toolCallRoutes: (req: any, res: any) => Promise<boolean>;

// World Engine: Ring-based deterministic simulation
let worldEngine: WorldEngineRuntime;
let worldEngineRoutes: (req: any, res: any) => Promise<boolean>;

async function setupLedger() {
  const { ledger: ledgerInstance, approvals: approvalsInstance } = await initializeLedger();
  ledger = ledgerInstance;
  approvals = approvalsInstance;
  ledgerRoutesHandler = createLedgerRoutes(ledger, approvals);
  console.log(`[nucleus] Ledger initialized at ${process.env.LEDGER_DB || 'runtime/nucleus-ledger.db'}`);
}

async function setupProvenanceLedger() {
  // Initialize hash-chained ledger (provenance spine)
  artifactLedger = await initializeArtifactLedger({ worldRoot: WORLD_ROOT });
  artifactStore = new ArtifactStore({ rootDir: WORLD_ROOT, ledger: artifactLedger });

  // Create route handlers
  artifactLedgerRoutes = createArtifactLedgerRoutes(artifactLedger);
  artifactsRoutes = createArtifactsRoutes({ artifactStore, ledger: artifactLedger });
  toolCallRoutes = createToolCallRoutes(artifactLedger);

  console.log(`[nucleus] Provenance ledger initialized at ${WORLD_ROOT}/ledger/ledger.ndjson`);
}

async function setupWorldEngine() {
  // Initialize World Engine: deterministic ring-based simulation
  worldEngine = new WorldEngineRuntime();

  // Register concept extraction pipeline (metaprocess ring)
  worldEngine.registerPipeline(
    createConceptExtractionPipeline({
      windowSize: 4,
      minFreq: 2,
      maxNodes: 500,
    })
  );

  // Create route handlers
  worldEngineRoutes = createWorldEngineRoutes(worldEngine);

  console.log(
    `[nucleus] World Engine initialized (rings: roots, metaprocess, thought, perception)`
  );
}

const server = http.createServer(async (req: any, res: any) => {
  // Health check first (used by launcher for readiness gating)
  if (handleHealthCheck(req, res)) return;

  // World Engine routes (ring-based deterministic simulation)
  if (worldEngineRoutes && (await worldEngineRoutes(req, res))) return;

  // Artifact + provenance ledger routes
  if (artifactLedgerRoutes && (await artifactLedgerRoutes(req, res))) return;
  if (artifactsRoutes && (await artifactsRoutes(req, res))) return;
  if (toolCallRoutes && (await toolCallRoutes(req, res))) return;

  // Ledger routes (append-only event store)
  if (ledgerRoutesHandler && (await ledgerRoutesHandler(req, res))) return;

  // Avatar compilation API
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (await handleAvatarCompile(url.pathname, req, res)) return;

  // Pipeline results API (for IDE viewer)
  if (handlePipelineResultsIndex(req, res)) return;
  if (handlePipelineResultsFile(req, res)) return;

  // FlowState analysis endpoint
  if (handleFlowstateAnalyze(req, res)) return;

  // Leximorph Bookfold + proxy endpoints
  if (handleLeximorph(req, res)) return;

  // Try operator event routes
  if (handleOperatorEvent(req, res)) return;

  // Try bus replay routes
  if (handleBusReplayRequest(req, res)) return;

  res.writeHead(200, { "content-type": "text/plain" });
  res.end("world-engine nucleus ok\n");
});;

const wss = new WebSocketServer({ server });
createHub(wss);

// Register /ws/bus upgrade handler
setupBusHttpUpgradeHandler(wss, (pathname: string, handler: (req: any, socket: any, head: any) => void) => {
  server.on("upgrade", (req: any, socket: any, head: any) => {
    if (req.url?.startsWith(pathname)) {
      handler(req, socket, head);
    }
  });
});

server.listen(PORT, async () => {
  // Initialize ledgers before serving requests
  await setupLedger();
  await setupProvenanceLedger();
  await setupWorldEngine();

  console.log(
    `[nucleus] listening http/ws on :${PORT} (+ /ws/bus + /bus/* + /ledger/* + /artifacts/* + /tool_call/* + /world/* + /approvals/*)`
  );
  console.log(`[nucleus] IDE MUST use ws://localhost:${PORT} (hub), NOT /ws/bus`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[nucleus] Shutting down...");
  if (ledger) {
    ledger.close();
    console.log("[nucleus] Ledger closed");
  }
  // World Engine cleanup (currently stateless, reserved for future pipelines)
  console.log("[nucleus] World Engine shut down");
  server.close(() => {
    console.log("[nucleus] Server closed");
    process.exit(0);
  });
});;
