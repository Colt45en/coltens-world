/**
 * Chat Streaming Integration for wsHub
 *
 * Handles chat.request with streaming via NDJSON protocol.
 * Bridges Brain (FastAPI) streaming response → IDE via WebSocket.
 * Executes tools (query_lexicon server-side, record_screen client-side).
 *
 * CONSTRAINT ENFORCEMENT:
 * All agent tools are validated against curriculum constraints before dispatch.
 */

import type { BusEnvelope } from "@world-engine/protocol";
import { nowMs, randomId } from "@world-engine/protocol";
import type { WebSocket } from "ws";
import { CurriculumConstraintStore } from "../constraints/CurriculumConstraintStore";
import { readNdjsonStream } from "../ndjson";
import { ToolExecutor } from "../tool/executor";
import type { ToolCall } from "../tool/types";

const BRAIN_ENDPOINT = process.env.BRAIN_ENDPOINT || "http://localhost:8011";

function send(ws: WebSocket, payload: any): void {
    if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(payload));
    }
}

/**
 * Handle chat.request.v1 with streaming
 *
 * Pipes Brain NDJSON stream → IDE WebSocket as chat events
 * Collects tool calls and executes them when stream completes
 */
export async function handleChatRequestStreaming(
    ws: WebSocket,
    env: BusEnvelope<any, any>,
    sessionId: string,
    token: string,
    HUB_INSTANCE_ID: string,
    toolExecutorsBySession: Map<string, ToolExecutor>
): Promise<void> {
    const payload = env.payload as any;
    const traceId = env.id ?? randomId("tr");
    const messageId = payload.messageId ?? randomId("m");

    console.log(
        `[chat] stream=${true} traceId=${traceId} convoId=${payload.convoId || "default"} prompt="${payload.prompt?.slice(0, 40)}..."`
    );

    const controller = new AbortController();
    const toolCalls: ToolCall[] = []; // Collect tool calls during streaming

    // Initialize constraint store for this session
    // (In production, would be populated from ledger curriculum events)
    const constraintStore = new CurriculumConstraintStore();

    // Create tool executor with constraint validation enabled
    const toolExecutor = new ToolExecutor(
        (e) => send(ws, e),  // sendToIde (broadcast)
        (e) => send(ws, e),  // emitToIde (same)
        HUB_INSTANCE_ID,
        constraintStore     // constraint pre-validation
    );

    // Register executor for this session so tool.effect.v1 can find it
    toolExecutorsBySession.set(sessionId, toolExecutor);

    try {
        // Signal stream started
        send(ws, {
            v: 2,
            type: "chat.stream.started.v1",
            id: randomId("srv"),
            ts: nowMs(),
            from: { role: "nucleus", instanceId: HUB_INSTANCE_ID },
            sessionId,
            traceId,
            payload: { messageId },
        });

        // Request Brain streaming endpoint
        const brainRes = await fetch(`${BRAIN_ENDPOINT}/chat/stream`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                convoId: payload.convoId ?? "default",
                messageId,
                prompt: payload.prompt ?? "",
                stream: true,
                tools: payload.tools ?? null,
            }),
            signal: controller.signal,
        });

        if (!brainRes.ok || !brainRes.body) {
            throw new Error(`Brain stream failed: ${brainRes.status} ${brainRes.statusText}`);
        }

        // Stream NDJSON chunks from Brain
        for await (const chunk of readNdjsonStream(brainRes.body)) {
            if (!chunk || typeof chunk !== "object") continue;

            const chunkType = chunk.type ?? "chat.delta.v1";

            // Collect tool calls for later execution
            if (chunkType === "chat.tool_call.v1") {
                const toolCallId = chunk.payload?.toolCallId ?? `tc-${messageId}-${toolCalls.length}`;
                toolCalls.push({
                    toolCallId,
                    name: chunk.payload?.name as any,
                    args: chunk.payload?.arguments ?? chunk.payload?.args ?? {},
                });
                console.log(`[chat] Collected tool: ${chunk.payload?.name} (id=${toolCallId})`);
            }

            // Forward as WS envelope with continuity
            send(ws, {
                v: 2,
                type: chunkType,
                id: randomId("srv"),
                ts: nowMs(),
                from: { role: "nucleus", instanceId: HUB_INSTANCE_ID },
                sessionId,
                traceId: chunk.traceId ?? traceId,
                messageId: chunk.messageId ?? messageId,
                payload: chunk.payload ?? {},
            });

            // When stream ends, execute all collected tools
            if (chunkType === "chat.done.v1") {
                if (toolCalls.length > 0) {
                    console.log(`[chat] Executing ${toolCalls.length} tools for message ${messageId}`);
                    for (const call of toolCalls) {
                        await toolExecutor.execute(traceId, sessionId, call);
                    }

                    // Signal tool phase complete
                    send(ws, {
                        v: 2,
                        type: "tool.batch.done.v1",
                        id: randomId("srv"),
                        ts: nowMs(),
                        from: { role: "nucleus", instanceId: HUB_INSTANCE_ID },
                        sessionId,
                        traceId,
                        messageId,
                        payload: { count: toolCalls.length },
                    });
                }
            }
        }
    } catch (err: any) {
        console.error(`[chat] stream error:`, err?.message);
        send(ws, {
            v: 2,
            type: "chat.stream.error.v1",
            id: randomId("srv"),
            ts: nowMs(),
            from: { role: "nucleus", instanceId: HUB_INSTANCE_ID },
            sessionId,
            traceId,
            payload: {
                messageId,
                error: String(err?.message ?? err),
            },
        });
    } finally {
        send(ws, {
            v: 2,
            type: "chat.stream.ended.v1",
            id: randomId("srv"),
            ts: nowMs(),
            from: { role: "nucleus", instanceId: HUB_INSTANCE_ID },
            sessionId,
            traceId,
            payload: { messageId },
        });

        // Clean up executor from global map
        toolExecutorsBySession.delete(sessionId);
    }
}

/**
 * Patch guide for wsHub.ts:
 *
 * 1) Add import at top:
 *    import { handleChatRequestStreaming } from "./routes/chat"
 *    import { readNdjsonStream } from "../ndjson"
 *
 * 2) In message type validation (~line 155):
 *    case "chat.request.v1":
 *      return ["cap:chat:send"];
 *
 * 3) In grantCapsForRole IDE section (~line 180):
 *    "cap:chat:send",
 *
 * 4) In known message types check (~line 410):
 *    env.type === "chat.request.v1" ||
 *
 * 5) In message dispatch loop (~line 540), add:
 *    // ---- chat request (streaming) ----
 *    if (env.type === "chat.request.v1") {
 *      await handleChatRequestStreaming(ws, env, sessionId, token, HUB_INSTANCE_ID);
 *      return;
 *    }
 */

// ============================================================================
// STREAMING CHAT HANDLER
// ============================================================================
