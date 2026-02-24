import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import Fastify from "fastify";
const PORT = Number(process.env.PORT || 3000);
const BRAIN_URL = process.env.BRAIN_URL || "http://127.0.0.1:8001";
const app = Fastify({ logger: true });
await app.register(cors, { origin: true });
await app.register(websocket);
function nowIso() {
    return new Date().toISOString();
}
function uid(prefix = "id") {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function isEnvelope(x) {
    return x && typeof x === "object" && x.v === "1.0" && typeof x.kind === "string" && x.payload;
}
async function postJson(url, body) {
    const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
    });
    if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`Brain HTTP ${res.status}: ${t || res.statusText}`);
    }
    return (await res.json());
}
// naive streaming splitter (makes the chat feel alive)
async function streamText(wsSend, traceId, convoId, fullText) {
    const chunks = [];
    const size = 18; // characters per chunk (tune)
    for (let i = 0; i < fullText.length; i += size)
        chunks.push(fullText.slice(i, i + size));
    wsSend({
        v: "1.0",
        id: uid("env"),
        ts: nowIso(),
        traceId,
        source: "nucleus",
        kind: "chat.start",
        payload: { convoId }
    });
    for (const c of chunks) {
        wsSend({
            v: "1.0",
            id: uid("env"),
            ts: nowIso(),
            traceId,
            source: "nucleus",
            kind: "chat.delta",
            payload: { convoId, delta: c }
        });
        await new Promise((r) => setTimeout(r, 10));
    }
    wsSend({
        v: "1.0",
        id: uid("env"),
        ts: nowIso(),
        traceId,
        source: "nucleus",
        kind: "chat.end",
        payload: { convoId }
    });
}
app.get("/health", async () => ({ ok: true, ts: nowIso() }));
app.get("/ws/chat", { websocket: true }, (conn) => {
    const ws = conn.socket;
    const wsSend = (env) => {
        try {
            ws.send(JSON.stringify(env));
        }
        catch (e) {
            app.log.error(e);
        }
    };
    ws.on("message", async (raw) => {
        let msg;
        try {
            msg = JSON.parse(String(raw));
        }
        catch {
            wsSend({
                v: "1.0",
                id: uid("env"),
                ts: nowIso(),
                traceId: uid("trace"),
                source: "nucleus",
                kind: "error",
                payload: { message: "Invalid JSON" }
            });
            return;
        }
        if (!isEnvelope(msg))
            return;
        const traceId = msg.traceId || uid("trace");
        const kind = msg.kind;
        if (kind === "chat.request") {
            const req = msg.payload;
            try {
                const brainRes = await postJson(`${BRAIN_URL}/brain/chat`, req);
                // stream the text first
                await streamText(wsSend, traceId, req.convoId, brainRes.text);
                // then send structured payload (lexicon hits, tool calls)
                wsSend({
                    v: "1.0",
                    id: uid("env"),
                    ts: nowIso(),
                    traceId,
                    source: "nucleus",
                    kind: "chat.response",
                    payload: brainRes
                });
            }
            catch (e) {
                wsSend({
                    v: "1.0",
                    id: uid("env"),
                    ts: nowIso(),
                    traceId,
                    source: "nucleus",
                    kind: "error",
                    payload: { message: String(e?.message || e) }
                });
            }
            return;
        }
        if (kind === "tool.result") {
            const toolRes = msg.payload;
            try {
                const followUp = await postJson(`${BRAIN_URL}/brain/tool_result`, toolRes);
                // stream follow-up too
                await streamText(wsSend, traceId, toolRes.convoId, followUp.text);
                wsSend({
                    v: "1.0",
                    id: uid("env"),
                    ts: nowIso(),
                    traceId,
                    source: "nucleus",
                    kind: "chat.response",
                    payload: followUp
                });
            }
            catch (e) {
                wsSend({
                    v: "1.0",
                    id: uid("env"),
                    ts: nowIso(),
                    traceId,
                    source: "nucleus",
                    kind: "error",
                    payload: { message: String(e?.message || e) }
                });
            }
            return;
        }
    });
});
await app.listen({ port: PORT, host: "0.0.0.0" });
app.log.info(`Nucleus WS listening on ws://localhost:${PORT}/ws/chat`);
