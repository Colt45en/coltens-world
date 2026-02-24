import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import Fastify from "fastify";
import type { ChatRequest, ChatResponse, Envelope, ToolResult } from "./contracts.js";

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

function isEnvelope(x: any): x is Envelope<any> {
    return x && typeof x === "object" && x.v === "1.0" && typeof x.kind === "string" && x.payload;
}

async function postJson<TReq, TRes>(url: string, body: TReq): Promise<TRes> {
    const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
    });
    if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`Brain HTTP ${res.status}: ${t || res.statusText}`);
    }
    return (await res.json()) as TRes;
}

// naive streaming splitter (makes the chat feel alive)
async function streamText(wsSend: (_msg: any) => void, traceId: string, convoId: string, fullText: string) {
    const chunks: string[] = [];
    const size = 18; // characters per chunk (tune)
    for (let i = 0; i < fullText.length; i += size) chunks.push(fullText.slice(i, i + size));

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

app.get("/ws/chat", { websocket: true }, (conn: any) => {
    const ws = conn.socket || conn;

    const wsSend = (env: Envelope<any>) => {
        try {
            ws.send(JSON.stringify(env));
        } catch (e) {
            app.log.error(e);
        }
    };

    ws.on("message", async (raw: any) => {
        let msg: any;
        try {
            msg = JSON.parse(String(raw));
        } catch {
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

        if (!isEnvelope(msg)) return;

        const traceId = msg.traceId || uid("trace");
        const kind = msg.kind;

        if (kind === "chat.request") {
            const req = msg.payload as ChatRequest;

            try {
                const brainRes = await postJson<ChatRequest, ChatResponse>(`${BRAIN_URL}/brain/chat`, req);

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
            } catch (e: any) {
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
            const toolRes = msg.payload as ToolResult;
            try {
                const followUp = await postJson<ToolResult, ChatResponse>(`${BRAIN_URL}/brain/tool_result`, toolRes);

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
            } catch (e: any) {
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
        }
    });
});

await app.listen({ port: PORT, host: "0.0.0.0" });
app.log.info(`Nucleus WS listening on ws://localhost:${PORT}/ws/chat`);
