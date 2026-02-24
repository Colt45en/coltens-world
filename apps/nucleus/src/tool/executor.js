/**
 * apps/nucleus/src/tool/executor.ts
 *
 * Tool execution orchestrator:
 * - query_lexicon: server-side (calls Python sidecar)
 * - record_screen: client-side (sends command to IDE, waits for effect)
 */
import { nowMs, randomId } from "@world-engine/protocol";
export class ToolExecutor {
    sendToIde;
    emitToIde;
    HUB_INSTANCE_ID;
    // Map toolCallId -> resolver for IDE tool.effect.v1 responses
    pending = new Map();
    constructor(sendToIde, // broadcast to IDE WS client(s)
    emitToIde, // send result to IDE (same as sendToIde typically)
    HUB_INSTANCE_ID = "nucleus_1") {
        this.sendToIde = sendToIde;
        this.emitToIde = emitToIde;
        this.HUB_INSTANCE_ID = HUB_INSTANCE_ID;
    }
    async execute(traceId, sessionId, call) {
        if (call.name === "query_lexicon") {
            return await this.execQueryLexicon(traceId, sessionId, call);
        }
        if (call.name === "record_screen") {
            return await this.execRecordScreenViaIde(traceId, sessionId, call);
        }
        return {
            v: 2,
            type: "tool.effect.v1",
            id: randomId("srv"),
            ts: nowMs(),
            from: { role: "nucleus", instanceId: this.HUB_INSTANCE_ID },
            sessionId,
            traceId,
            payload: {
                toolCallId: call.toolCallId,
                name: call.name,
                status: "error",
                error: { message: `Unknown tool: ${call.name}` },
            },
        };
    }
    // ----- server-side tool: query_lexicon -----
    async execQueryLexicon(traceId, sessionId, call) {
        const LEXICON_ENDPOINT = process.env.LEXICON_ENDPOINT || "http://127.0.0.1:3000";
        try {
            const term = String(call.args?.term ?? "");
            const k = Number(call.args?.k ?? 5);
            const res = await fetch(`${LEXICON_ENDPOINT}/leximorph/query`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ term, k }),
            });
            if (!res.ok) {
                throw new Error(`lexicon/query failed: ${res.status} ${res.statusText}`);
            }
            const data = await res.json();
            const env = {
                v: 2,
                type: "tool.effect.v1",
                id: randomId("srv"),
                ts: nowMs(),
                from: { role: "nucleus", instanceId: this.HUB_INSTANCE_ID },
                sessionId,
                traceId,
                payload: {
                    toolCallId: call.toolCallId,
                    name: "query_lexicon",
                    status: "ok",
                    result: data,
                },
            };
            this.emitToIde(env);
            return env;
        }
        catch (e) {
            const env = {
                v: 2,
                type: "tool.effect.v1",
                id: randomId("srv"),
                ts: nowMs(),
                from: { role: "nucleus", instanceId: this.HUB_INSTANCE_ID },
                sessionId,
                traceId,
                payload: {
                    toolCallId: call.toolCallId,
                    name: "query_lexicon",
                    status: "error",
                    error: { message: String(e?.message ?? e) },
                },
            };
            this.emitToIde(env);
            return env;
        }
    }
    // ----- client-side tool: record_screen -----
    // Sends command to IDE; waits for IDE to respond with tool.effect.v1
    async execRecordScreenViaIde(traceId, sessionId, call) {
        const commandEnv = {
            v: 2,
            type: "tool.command.v1",
            id: randomId("srv"),
            ts: nowMs(),
            from: { role: "nucleus", instanceId: this.HUB_INSTANCE_ID },
            sessionId,
            traceId,
            payload: call,
        };
        this.sendToIde(commandEnv);
        return await new Promise((resolve, reject) => {
            const timeoutMs = Number(call.args?.timeoutMs ?? 60_000);
            const timeout = setTimeout(() => {
                this.pending.delete(call.toolCallId);
                reject(new Error(`record_screen timed out after ${timeoutMs}ms`));
            }, timeoutMs);
            this.pending.set(call.toolCallId, { resolve, reject, timeout });
        }).catch((err) => {
            const env = {
                v: 2,
                type: "tool.effect.v1",
                id: randomId("srv"),
                ts: nowMs(),
                from: { role: "nucleus", instanceId: this.HUB_INSTANCE_ID },
                sessionId,
                traceId,
                payload: {
                    toolCallId: call.toolCallId,
                    name: "record_screen",
                    status: "error",
                    error: { message: String(err?.message ?? err) },
                },
            };
            this.emitToIde(env);
            return env;
        });
    }
    // Called by Nucleus when IDE sends tool.effect.v1 back
    handleToolEffectFromIde(env) {
        const tcid = env.payload?.toolCallId;
        if (!tcid)
            return;
        const pending = this.pending.get(tcid);
        if (!pending)
            return;
        clearTimeout(pending.timeout);
        this.pending.delete(tcid);
        pending.resolve(env);
    }
}
