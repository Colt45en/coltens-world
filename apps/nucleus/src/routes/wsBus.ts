// TODO: Import from @world-engine/engine when available
// import type { BusEnvelopeV1 } from "@world-engine/engine";
// import { PipelineEnvelopeSchema } from "@world-engine/engine";
import { WebSocketServer, type WebSocket } from "ws";
import { globalBus } from "../bus/busHub";

// Placeholder types
type BusEnvelopeV1 = any;
const PipelineEnvelopeSchema = {
  parse: (x: any) => x,
  safeParse: (x: any) => ({ success: true, data: x, error: undefined })
};

/**
 * Bus WS Handler
 *
 * Integrates with nucleus's WebSocket server to allow clients to subscribe to pipeline events.
 * - Route: /ws/bus (handled separately in index.ts or wsHub.ts)
 * - Each connection broadcasts all pipeline envelopes
 */

interface BusSubscriber {
    ws: WebSocket;
    clientId: string;
    unsubscribe: () => void;
}

const busSubscribers = new Map<string, BusSubscriber>();
let subscriberCounter = 0;

export function setupBusHttpUpgradeHandler(
    wss: WebSocketServer,
    onUpgrade: (pathname: string, handler: (req: any, socket: any, head: any) => void) => void
) {
    // Register upgrade handler for /ws/bus path
    onUpgrade("/ws/bus", (req: any, socket: any, head: any) => {
        wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
            const clientId = `bus-sub-${++subscriberCounter}`;
            console.log(`[busHub] Bus subscriber connected: ${clientId}`);

            // Subscribe to all pipeline events
            const unsubscribe = globalBus.subscribeMultiple(
                [
                    "pipeline.run.started",
                    "pipeline.stage.started",
                    "pipeline.stage.completed",
                    "pipeline.run.completed",
                    "pipeline.explain.request",
                    "pipeline.explain.response",
                ],
                (env: BusEnvelopeV1) => {
                    // Validate before sending
                    const validation = PipelineEnvelopeSchema.safeParse(env);
                    if (!validation.success) {
                        console.warn(`[busHub] Invalid envelope:`, validation.error);
                        return;
                    }

                    try {
                        ws.send(JSON.stringify(env));
                    } catch (err) {
                        console.error(`[busHub] Failed to send to ${clientId}:`, err);
                    }
                }
            );

            busSubscribers.set(clientId, { ws, clientId, unsubscribe });

            ws.on("close", () => {
                console.log(`[busHub] Bus subscriber disconnected: ${clientId}`);
                busSubscribers.delete(clientId);
                unsubscribe();
            });

            ws.on("error", (err: Error) => {
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
