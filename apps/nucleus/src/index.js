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
import { WebSocketServer } from "ws";
import { handleHealthCheck } from "./routes/health";
import { handleBusReplayRequest } from "./routes/busReplay";
import { handleOperatorEvent } from "./routes/operatorEvent";
import { setupBusHttpUpgradeHandler } from "./routes/wsBus";
import { handlePipelineResultsIndex, handlePipelineResultsFile } from "./routes/http/pipelineResults";
import { handleFlowstateAnalyze } from "./routes/http/flowstate";
import { handleLeximorph } from "./routes/http/leximorph";
import { createHub } from "./wsHub";
const PORT = Number(process.env.NUCLEUS_PORT ?? "3000");
const server = http.createServer((req, res) => {
    // Health check first (used by launcher for readiness gating)
    if (handleHealthCheck(req, res))
        return;
    // Pipeline results API (for IDE viewer)
    if (handlePipelineResultsIndex(req, res))
        return;
    if (handlePipelineResultsFile(req, res))
        return;
    // FlowState analysis endpoint
    if (handleFlowstateAnalyze(req, res))
        return;
    // Leximorph Bookfold + proxy endpoints
    if (handleLeximorph(req, res))
        return;
    // Try operator event routes
    if (handleOperatorEvent(req, res))
        return;
    // Try bus replay routes
    if (handleBusReplayRequest(req, res))
        return;
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("world-engine nucleus ok\n");
});
const wss = new WebSocketServer({ server });
createHub(wss);
// Register /ws/bus upgrade handler
setupBusHttpUpgradeHandler(wss, (pathname, handler) => {
    server.on("upgrade", (req, socket, head) => {
        if (req.url?.startsWith(pathname)) {
            handler(req, socket, head);
        }
    });
});
server.listen(PORT, () => {
    console.log(`[nucleus] listening http/ws on :${PORT} (+ /ws/bus + /bus/*)`);
    console.log(`[nucleus] IDE MUST use ws://localhost:${PORT} (hub), NOT /ws/bus`);
});
