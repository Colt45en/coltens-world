import { startSimWsServer } from "./net/wsServer";
import type { BoxCollider } from "./sim/collision";
import { createWorld } from "./sim/world";

const port = Number(process.env.SIM_PORT ?? 4010);
const world = createWorld();

// Test level geometry: arena with walls
const staticColliders: BoxCollider[] = [
    // Top wall
    { x: 0, y: 0, width: 1200, height: 20 },
    // Bottom wall
    { x: 0, y: 680, width: 1200, height: 20 },
    // Left wall
    { x: 0, y: 0, width: 20, height: 700 },
    // Right wall
    { x: 1180, y: 0, width: 20, height: 700 },
    // Center obstacle (L-shaped)
    { x: 400, y: 250, width: 150, height: 30 },
    { x: 550, y: 250, width: 30, height: 150 },
];

const srv = startSimWsServer({ port, world, staticColliders });

console.log(`[sim-server] running ws://localhost:${port}`);

process.on("SIGINT", () => {
    console.log("[sim-server] shutting down...");
    srv.close();
    process.exit(0);
});
