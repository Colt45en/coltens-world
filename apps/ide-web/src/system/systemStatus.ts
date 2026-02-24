/**
 * System Status Model — What's the health of core services?
 *
 * Drives the global status banner. Later, this gets:
 * - WS connection monitoring
 * - Nucleus health checks
 * - Brain/Lexicon pings
 * - Reconnect logic
 *
 * See SystemStatusContext.tsx for the React provider.
 */

export type ServiceHealth = "up" | "down" | "unknown";

export type SystemStatus = {
    ws: "connected" | "disconnected" | "connecting";
    nucleus: ServiceHealth;
    brain: ServiceHealth;
    lexicon: ServiceHealth;
    updatedAt: number; // epoch ms
};

export const DEFAULT_SYSTEM_STATUS: SystemStatus = {
    ws: "disconnected",
    nucleus: "unknown",
    brain: "unknown",
    lexicon: "unknown",
    updatedAt: Date.now(),
};
