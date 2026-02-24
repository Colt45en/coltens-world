/**
 * Chat Handler for Nucleus
 *
 * Routes chat.request messages from IDE → Brain (FastAPI),
 * collects tool results, streams back chat.response events.
 * Also handles brain.chat (streamed agentic mode) with operator dispatch.
 */
import { ChatRequestSchema, ToolResultSchema, createEnvelope, nowMs, randomId, } from "@world-engine/protocol";
const BRAIN_HTTP_ENDPOINT = process.env.BRAIN_ENDPOINT || "http://localhost:8001";
export class ChatHandler {
    pendingToolResults = new Map();
    /**
     * Handle incoming chat.request from IDE
     */
    async handleChatRequest(env, ws) {
        const traceId = env.traceId;
        // Validate payload
        let req;
        try {
            req = ChatRequestSchema.parse(env.payload);
        }
        catch (err) {
            const error = createEnvelope("chat.error", { error: `Invalid ChatRequest: ${String(err)}` }, traceId, "nucleus");
            ws.send(JSON.stringify(error));
            return;
        }
        console.log(`[chat] ${traceId} convo=${req.convoId} user=${req.userId} persona=${req.persona} text="${req.text.slice(0, 50)}..."`);
        try {
            // Stream chat response from Brain
            await this.streamChatFromBrain(req, traceId, ws);
        }
        catch (err) {
            const error = createEnvelope("chat.error", { error: `Chat error: ${String(err)}` }, traceId, "nucleus");
            ws.send(JSON.stringify(error));
        }
    }
    /**
     * Call Brain endpoint and stream back events to UI
     */
    async streamChatFromBrain(req, traceId, ws) {
        const url = `${BRAIN_HTTP_ENDPOINT}/chat/stream`;
        const controller = new AbortController();
        const timeoutHandle = setTimeout(() => controller.abort(), 60_000);
        try {
            const resp = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    traceId,
                    ...req,
                }),
                signal: controller.signal,
            });
            if (!resp.ok) {
                throw new Error(`Brain returned ${resp.status}: ${await resp.text()}`);
            }
            if (!resp.body) {
                throw new Error("No response body from Brain");
            }
            // Stream events line-by-line (NDJSON)
            const reader = resp.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                for (let i = 0; i < lines.length - 1; i++) {
                    const lineEntry = lines[i];
                    if (!lineEntry)
                        continue;
                    const line = lineEntry.trim();
                    if (!line)
                        continue;
                    try {
                        const event = JSON.parse(line);
                        // Forward streaming event to UI as-is
                        ws.send(JSON.stringify(createEnvelope(`chat.stream_event`, event, traceId, "nucleus")));
                    }
                    catch (err) {
                        console.warn(`[chat] Failed to parse stream event: ${err}`);
                    }
                }
                const lastLine = lines[lines.length - 1];
                buffer = lastLine ?? "";
            }
            if (buffer.trim()) {
                try {
                    const event = JSON.parse(buffer);
                    ws.send(JSON.stringify(createEnvelope(`chat.stream_event`, event, traceId, "nucleus")));
                }
                catch (err) {
                    console.warn(`[chat] Failed to parse final stream event: ${err}`);
                }
            }
            // Signal completion
            const done = createEnvelope("chat.done", { traceId }, traceId, "nucleus");
            ws.send(JSON.stringify(done));
        }
        finally {
            clearTimeout(timeoutHandle);
        }
    }
    /**
     * Handle tool result from UI (e.g., recording completed)
     */
    async handleToolResult(env, ws) {
        const traceId = env.traceId;
        let result;
        try {
            result = ToolResultSchema.parse(env.payload);
        }
        catch (err) {
            console.warn(`[chat] Invalid ToolResult: ${err}`);
            return;
        }
        console.log(`[chat] ${traceId} tool_result tool=${result.name} ok=${result.ok}`);
        // Store for later Brain collection, or immediately forward to waiting Brain
        if (!this.pendingToolResults.has(traceId)) {
            this.pendingToolResults.set(traceId, []);
        }
        this.pendingToolResults.get(traceId).push(result);
        // TODO: If Brain is waiting for this specific tool, notify it
    }
    /**
     * Handle brain.chat (streamed agentic chat mode)
     * - Routes "patch:" prefix to PatchOperator
     * - Streams deltas back via brain.chat.delta messages
     * - Binds all chunks to traceId for IDE stream binding
     */
    async handleBrainChat(env, ws) {
        const t0 = Date.now();
        const { traceId, message, mode, context } = env.payload;
        let seq = 0;
        const HUB_INSTANCE_ID = "nucleus_1";
        function send(e) {
            try {
                ws.send(JSON.stringify(e));
            }
            catch (err) {
                console.warn(`[chat] Failed to send to client: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
        try {
            // 1) Initial delta so UI feels alive
            send({
                v: 2,
                id: randomId("srv"),
                type: "brain.chat.delta",
                ts: nowMs(),
                from: { role: "nucleus", instanceId: HUB_INSTANCE_ID },
                sessionId: env.sessionId,
                auth: env.auth,
                nonce: env.nonce || randomId("n"),
                payload: { traceId, seq: seq++, deltaText: "🧠 " },
            });
            console.log(`[brain.chat] ${traceId} mode=${mode ?? "assistant"} text="${message.slice(0, 50)}..."`);
            let finalText = "";
            let toolsUsed = [];
            let operatorExecuted;
            // 2) Detect intent and dispatch
            const text = message.trim();
            const wantsPatch = text.toLowerCase().startsWith("patch:");
            if (wantsPatch) {
                send({
                    v: 2,
                    id: randomId("srv"),
                    type: "brain.chat.delta",
                    ts: nowMs(),
                    from: { role: "nucleus", instanceId: HUB_INSTANCE_ID },
                    sessionId: env.sessionId,
                    auth: env.auth,
                    nonce: randomId("n"),
                    payload: { traceId, seq: seq++, deltaText: "Routing to PatchOperator…\n" },
                });
                try {
                    const opRes = await fetch("http://localhost:3000/operator/event", {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({
                            operatorId: "prompt.operator.patch",
                            sessionId: env.sessionId,
                            traceId,
                            payload: {
                                user_request: text.replace(/^patch:\s*/i, ""),
                                context: context ?? {},
                            },
                        }),
                    });
                    if (!opRes.ok) {
                        throw new Error(`operator/event failed ${opRes.status}`);
                    }
                    const opResult = await opRes.json();
                    operatorExecuted = {
                        operatorId: "prompt.operator.patch",
                        ok: true,
                    };
                    toolsUsed.push("prompt.operator.patch");
                    finalText =
                        "✅ PatchOperator result:\n\n```json\n" +
                            JSON.stringify(opResult, null, 2) +
                            "\n```";
                }
                catch (err) {
                    operatorExecuted = {
                        operatorId: "prompt.operator.patch",
                        ok: false,
                    };
                    finalText =
                        `❌ PatchOperator error:\n${err?.message ?? String(err)}`;
                }
            }
            else {
                // 3) Minimal fallback response
                send({
                    v: 2,
                    id: randomId("srv"),
                    type: "brain.chat.delta",
                    ts: nowMs(),
                    from: { role: "nucleus", instanceId: HUB_INSTANCE_ID },
                    sessionId: env.sessionId,
                    auth: env.auth,
                    nonce: randomId("n"),
                    payload: { traceId, seq: seq++, deltaText: "\nThinking…\n" },
                });
                finalText =
                    `**mode**: ${mode ?? "assistant"}\n` +
                        `**route**: ${context?.currentRoute ?? "(none)"}\n\n` +
                        `You said:\n> ${message}\n\n` +
                        `**Next**: Prefix messages with "patch:" to invoke PatchOperator\n` +
                        `(e.g., "patch: add a banner to the IDE layout")`;
            }
            const latency = Date.now() - t0;
            // 4) Send done (with audit trail)
            send({
                v: 2,
                id: randomId("srv"),
                type: "brain.chat.done",
                ts: nowMs(),
                from: { role: "nucleus", instanceId: HUB_INSTANCE_ID },
                sessionId: env.sessionId,
                auth: env.auth,
                nonce: randomId("n"),
                payload: {
                    traceId,
                    finalText,
                    toolsUsed,
                    audit: {
                        latency_ms: latency,
                        operatorExecuted,
                    },
                },
            });
            // Log for structured observability
            console.log(JSON.stringify({
                event: "brain.chat.done",
                traceId,
                latency_ms: latency,
                mode: mode ?? "assistant",
                toolsUsed,
            }));
        }
        catch (err) {
            console.error(`[brain.chat] ${traceId} error:`, err);
            send({
                v: 2,
                id: randomId("srv"),
                type: "brain.chat.error",
                ts: nowMs(),
                from: { role: "nucleus", instanceId: HUB_INSTANCE_ID },
                sessionId: env.sessionId,
                auth: env.auth,
                nonce: randomId("n"),
                payload: {
                    traceId,
                    code: "CHAT_FAIL",
                    message: err?.message ?? String(err),
                },
            });
        }
    }
}
export const chatHandler = new ChatHandler();
