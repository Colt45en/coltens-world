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

import http from "node:http";
import { URL } from "node:url";
import { WebSocketServer } from "ws";
import type { ApprovalStateMachine } from "./approvals/state-machine";
import type { Ledger } from "./ledger/ledger";
import { handleBusReplayRequest } from "./routes/busReplay";
import { handleHealthCheck } from "./routes/health";
import { handleAvatarCompile } from "./routes/http/avatars";
import { handleFlowstateAnalyze } from "./routes/http/flowstate";
import { handleLeximorph } from "./routes/http/leximorph";
import { handlePipelineResultsFile, handlePipelineResultsIndex } from "./routes/http/pipelineResults";
import { createLedgerRoutes, initializeLedger } from "./routes/ledger";
import { handleOperatorEvent } from "./routes/operatorEvent";
import { setupBusHttpUpgradeHandler } from "./routes/wsBus";
import { createHub } from "./wsHub";

const PORT = Number(process.env.NUCLEUS_PORT ?? "3000");

// Ledger initialization (append-only event store)
let ledger: Ledger;
let approvals: ApprovalStateMachine;
let ledgerRoutesHandler: (req: any, res: any) => Promise<boolean>;

async function setupLedger() {
  const { ledger: ledgerInstance, approvals: approvalsInstance } = await initializeLedger();
  ledger = ledgerInstance;
  approvals = approvalsInstance;
  ledgerRoutesHandler = createLedgerRoutes(ledger, approvals);
  console.log(`[nucleus] Ledger initialized at ${process.env.LEDGER_DB || 'runtime/nucleus-ledger.db'}`);
}

const server = http.createServer(async (req: any, res: any) => {
  // Health check first (used by launcher for readiness gating)
  if (handleHealthCheck(req, res)) return;

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
});

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
  // Initialize ledger before serving requests
  await setupLedger();

  console.log(`[nucleus] listening http/ws on :${PORT} (+ /ws/bus + /bus/* + /ledger/* + /approvals/*)`);
  console.log(`[nucleus] IDE MUST use ws://localhost:${PORT} (hub), NOT /ws/bus`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[nucleus] Shutting down...");
  if (ledger) {
    ledger.close();
    console.log("[nucleus] Ledger closed");
  }
  server.close(() => {
    console.log("[nucleus] Server closed");
    process.exit(0);
  });
});
