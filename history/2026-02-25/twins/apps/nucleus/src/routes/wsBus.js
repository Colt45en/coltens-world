import { PipelineEnvelopeSchema } from "@world-engine/engine";
import { globalBus } from "../bus/busHub";
const busSubscribers = new Map();
let subscriberCounter = 0;
export function setupBusHttpUpgradeHandler(wss, onUpgrade) {
    // Register upgrade handler for /ws/bus path
    onUpgrade("/ws/bus", (req, socket, head) => {
        wss.handleUpgrade(req, socket, head, (ws) => {
            const clientId = `bus-sub-${++subscriberCounter}`;
            console.log(`[busHub] Bus subscriber connected: ${clientId}`);
            // Subscribe to all pipeline events
            const unsubscribe = globalBus.subscribeMultiple([
                "pipeline.run.started",
                "pipeline.stage.started",
                "pipeline.stage.completed",
                "pipeline.run.completed",
                "pipeline.explain.request",
                "pipeline.explain.response",
            ], (env) => {
                // Validate before sending
                const validation = PipelineEnvelopeSchema.safeParse(env);
                if (!validation.success) {
                    console.warn(`[busHub] Invalid envelope:`, validation.error);
                    return;
                }
                try {
                    ws.send(JSON.stringify(env));
                }
                catch (err) {
                    console.error(`[busHub] Failed to send to ${clientId}:`, err);
                }
            });
            busSubscribers.set(clientId, { ws, clientId, unsubscribe });
            ws.on("close", () => {
                console.log(`[busHub] Bus subscriber disconnected: ${clientId}`);
                busSubscribers.delete(clientId);
                unsubscribe();
            });
            ws.on("error", (err) => {
                console.error(`[busHub] WS error from ${clientId}:`, err.message);
            });
        });
    });
}
/**
 * Get stats about bus connections
 */
export function getBusStats() {
    return {
        subscribers: busSubscribers.size,
        busStats: globalBus.getStats(),
    };
}
