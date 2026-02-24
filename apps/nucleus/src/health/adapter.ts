import type { Role } from "@world-engine/protocol";
import type { BusLike, HubPresence } from "./poller";

/**
 * Adapters to integrate health poller with wsHub's existing structures
 */

/** Adapter that wraps wsHub client/WS infrastructure to appear as HubPresence */
export function createHubPresenceAdapter(clientsSet: Set<any>): HubPresence {
    return {
        isRoleConnected(role: "ide" | "preview" | "brain" | "sidecar"): boolean {
            for (const client of clientsSet) {
                if (client.role === role) return true;
            }
            return false;
        },

        roleCount(role: "ide" | "preview" | "brain" | "sidecar"): number {
            let count = 0;
            for (const client of clientsSet) {
                if (client.role === role) count++;
            }
            return count;
        }
    };
}

/**
 * Adapter wrapping wsHub's broadcastTo function as a BusLike.
 *
 * Note: This publishes to "ide" role so the IDE receives health updates.
 * The actual bus envelope shape follows @world-engine/protocol conventions.
 */
export function createBusLikeAdapter(broadcastToFn: (role: Role | "ide", env: any) => void): BusLike {
    return {
        publish(env: {
            channel: string;
            type: string;
            payload: unknown;
            sessionId: string;
            traceId?: string;
        }): void {
            // Construct a full envelope compatible with BusEnvelope<T, U>
            const fullEnv = {
                v: 2,
                id: `health.${Math.random().toString(36).slice(2, 11)}`,
                type: "system.health",
                ts: Date.now(),
                from: { role: "nucleus", instanceId: "nucleus_1" },
                sessionId: env.sessionId,
                traceId: env.traceId,
                payload: env.payload
            };

            // Broadcast to IDE clients
            broadcastToFn("ide" as const, fullEnv);
        }
    };
}
