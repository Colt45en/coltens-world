import { createHash } from "node:crypto";

function sha256(s: string) {
    return createHash("sha256").update(s).digest("hex");
}

export interface BusEnvelope {
    v: "1";
    id: string;
    ts: string;
    type: string;
    source: string;
    data: unknown;
}

export function makeEnvelope(type: string, source: string, data: unknown): BusEnvelope {
    const ts = new Date().toISOString();
    const id = `e_${sha256(`${type}:${source}:${ts}:${JSON.stringify(data)}`).slice(0, 16)}`;
    return { v: "1", id, ts, type, source, data };
}

export function broadcastEnvelope(app: any, env: BusEnvelope) {
    const payload = JSON.stringify(env);

    // fastify-websocket / ws pattern
    const wss = app?.websocketServer;
    const clients: any = wss?.clients;
    if (clients && typeof clients.forEach === "function") {
        clients.forEach((ws: any) => {
            try {
                if (ws.readyState === 1) ws.send(payload);
            } catch { }
        });
        return;
    }

    // fallback: if you have your own hub, wire it here
    if (app?.wsHub?.broadcast) {
        app.wsHub.broadcast(payload);
        return;
    }

    throw new Error(
        "No websocket broadcast target found (expected app.websocketServer.clients or app.wsHub.broadcast)."
    );
}
