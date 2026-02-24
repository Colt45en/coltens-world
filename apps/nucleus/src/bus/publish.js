import { createHash } from "node:crypto";
function sha256(s) {
    return createHash("sha256").update(s).digest("hex");
}
export function makeEnvelope(type, source, data) {
    const ts = new Date().toISOString();
    const id = `e_${sha256(`${type}:${source}:${ts}:${JSON.stringify(data)}`).slice(0, 16)}`;
    return { v: "1", id, ts, type, source, data };
}
export function broadcastEnvelope(app, env) {
    const payload = JSON.stringify(env);
    // fastify-websocket / ws pattern
    const wss = app?.websocketServer;
    const clients = wss?.clients;
    if (clients && typeof clients.forEach === "function") {
        clients.forEach((ws) => {
            try {
                if (ws.readyState === 1)
                    ws.send(payload);
            }
            catch { }
        });
        return;
    }
    // fallback: if you have your own hub, wire it here
    if (app?.wsHub?.broadcast) {
        app.wsHub.broadcast(payload);
        return;
    }
    throw new Error("No websocket broadcast target found (expected app.websocketServer.clients or app.wsHub.broadcast).");
}
