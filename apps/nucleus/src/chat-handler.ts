/**
 * Chat Handler for Nucleus
 *
 * Routes chat.request messages from IDE → Brain (FastAPI),
 * collects tool results, streams back chat.response events.
 * Also handles brain.chat (streamed agentic mode) with operator dispatch.
 */

import {
  ChatRequestSchema,
  ToolResultSchema,
  createEnvelope,
  nowMs,
  randomId,
  type BusEnvelope,
  type ChatRequest,
  type Envelope,
  type MessageMap,
  type ToolResult,
} from "@world-engine/protocol";
import type { WebSocket } from "ws";

const BRAIN_HTTP_ENDPOINT = process.env.BRAIN_ENDPOINT || "http://localhost:8011";

export class ChatHandler {
  private pendingToolResults = new Map<string, ToolResult[]>();

  /**
   * Handle incoming chat.request from IDE
   */
  async handleChatRequest(env: Envelope<ChatRequest>, ws: WebSocket): Promise<void> {
    const traceId = env.traceId;

    // Validate payload
    let req: ChatRequest;
    try {
      req = ChatRequestSchema.parse(env.payload);
    } catch (err) {
      const error: Envelope<{ error: string }> = createEnvelope(
        "chat.error",
        { error: `Invalid ChatRequest: ${String(err)}` },
        traceId,
        "nucleus"
      );
      ws.send(JSON.stringify(error));
      return;
    }

    console.log(
      `[chat] ${traceId} convo=${req.convoId} user=${req.userId} persona=${req.persona} text="${req.text.slice(0, 50)}..."`
    );

    try {
      // Stream chat response from Brain
      await this.streamChatFromBrain(req, traceId, ws);
    } catch (err) {
      const error: Envelope<{ error: string }> = createEnvelope(
        "chat.error",
        { error: `Chat error: ${String(err)}` },
        traceId,
        "nucleus"
      );
      ws.send(JSON.stringify(error));
    }
  }

  /**
   * Call Brain endpoint and stream back events to UI with:
   * - Abort support (client disconnect)
   * - Backpressure (ws.bufferedAmount)
   * - Schema validation (StreamEvent)
   * - Monotonic seq + turnId tracking
   */
  private async streamChatFromBrain(
    req: ChatRequest,
    traceId: string,
    ws: WebSocket
  ): Promise<void> {
    const turnId = randomId("turn");
    const url = `${BRAIN_HTTP_ENDPOINT}/chat/stream`;

    // P0.2: Abort on client disconnect
    const abort = new AbortController();
    const onWsClose = () => abort.abort("ws_closed");
    ws.once("close", onWsClose);

    const timeoutHandle = setTimeout(() => abort.abort("timeout"), 60_000);

    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          traceId,
          turnId,
          ...req,
        }),
        signal: abort.signal,
      });

      if (!resp.ok) {
        throw new Error(`Brain returned ${resp.status}: ${await resp.text()}`);
      }

      if (!resp.body) {
        throw new Error("No response body from Brain");
      }

      // P0.4: Use unified StreamEvent validator
      const { validateStreamEvent } = await import("@world-engine/protocol");

      // P0.3: Track WebSocket backpressure
      const MAX_WS_BUFFERED = 2 * 1024 * 1024; // 2MB
      const WS_DRAIN_POLL_MS = 10;

      async function waitForDrain() {
        while (ws.readyState === ws.OPEN && ws.bufferedAmount > MAX_WS_BUFFERED) {
          await new Promise((r) => setTimeout(r, WS_DRAIN_POLL_MS));
        }
      }

      // P0.1: Track seq for ordering
      let seq = 0;

      // P0.3: Stream line-by-line with new ndjsonLines utility
      const { ndjsonLines } = await import("./ndjson.js");

      for await (const line of ndjsonLines(resp.body)) {
        // P0.2: Check if client closed
        if (ws.readyState !== ws.OPEN) {
          console.log(`[chat] ${traceId} client closed, stopping stream`);
          break;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(line);
        } catch (err) {
          console.warn(`[chat] ${traceId} failed to parse JSON: ${err}`);
          const error: Envelope<{ error: string }> = createEnvelope(
            "chat.error",
            { error: `Invalid stream JSON: ${String(err)}` },
            traceId,
            "nucleus"
          );
          ws.send(JSON.stringify(error));
          continue;
        }

        // P0.4: Validate schema before forwarding
        const validated = validateStreamEvent(parsed);
        if (!validated) {
          console.warn(`[chat] ${traceId} schema validation failed:`, parsed);
          const error: Envelope<{ error: string }> = createEnvelope(
            "chat.error",
            {
              error: `Invalid stream event schema`,
            },
            traceId,
            "nucleus"
          );
          ws.send(JSON.stringify(error));
          continue;
        }

        // Inject turnId + seq if missing (Brain might not have them yet)
        const enriched: any = {
          ...validated,
          turnId: validated.turnId || turnId,
          seq: validated.seq !== undefined ? validated.seq : seq++,
          ts: validated.ts || Date.now(),
        };

        // P0.3: Backpressure
        await waitForDrain();

        // Forward to IDE
        ws.send(JSON.stringify(createEnvelope(`chat.stream_event`, enriched, traceId, "nucleus")));

        // Stop on completion
        if (enriched.type === "done" || enriched.type === "error") {
          break;
        }
      }

      // Signal completion
      const done: Envelope<{ traceId: string; turnId: string }> = createEnvelope(
        "chat.done",
        { traceId, turnId },
        traceId,
        "nucleus"
      );
      ws.send(JSON.stringify(done));
    } catch (err: any) {
      const reason = abort.signal.aborted
        ? `cancelled: ${String(abort.signal.reason ?? "unknown")}`
        : `chat error: ${err?.message ?? "unknown"}`;

      console.log(`[chat] ${traceId} stream ended: ${reason}`);

      const error: Envelope<{ error: string }> = createEnvelope(
        "chat.error",
        { error: reason },
        traceId,
        "nucleus"
      );
      ws.send(JSON.stringify(error));
    } finally {
      ws.off("close", onWsClose);
      clearTimeout(timeoutHandle);
    }
  }

  /**
   * Handle tool result from UI (e.g., recording completed)
   */
  async handleToolResult(env: Envelope<ToolResult>, ws: WebSocket): Promise<void> {
    const traceId = env.traceId;

    let result: ToolResult;
    try {
      result = ToolResultSchema.parse(env.payload);
    } catch (err) {
      console.warn(`[chat] Invalid ToolResult: ${err}`);
      return;
    }

    console.log(`[chat] ${traceId} tool_result tool=${result.name} ok=${result.ok}`);

    // Store for later Brain collection, or immediately forward to waiting Brain
    if (!this.pendingToolResults.has(traceId)) {
      this.pendingToolResults.set(traceId, []);
    }
    this.pendingToolResults.get(traceId)!.push(result);

    // TODO: If Brain is waiting for this specific tool, notify it
  }

  /**
   * Handle brain.chat (streamed agentic chat mode)
   * - Routes "patch:" prefix to PatchOperator
   * - Streams deltas back via brain.chat.delta messages
   * - Binds all chunks to traceId for IDE stream binding
   */
  async handleBrainChat(
    env: BusEnvelope<
      "brain.chat",
      { traceId: string; message: string; mode?: string; context?: Record<string, unknown> }
    >,
    ws: WebSocket
  ): Promise<void> {
    const t0 = Date.now();
    const { traceId, message, mode, context } = env.payload;
    let seq = 0;

    const HUB_INSTANCE_ID = "nucleus_1";

    function send<T extends keyof MessageMap>(e: BusEnvelope<T, MessageMap[T]>): void {
      try {
        ws.send(JSON.stringify(e));
      } catch (err) {
        console.warn(
          `[chat] Failed to send to client: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    try {
      // 1) Initial delta so UI feels alive
      send({
        v: 2,
        id: randomId("srv"),
        type: "brain.chat.delta" as const,
        ts: nowMs(),
        from: { role: "nucleus" as const, instanceId: HUB_INSTANCE_ID },
        sessionId: env.sessionId,
        auth: env.auth,
        nonce: env.nonce || randomId("n"),
        payload: { traceId, seq: seq++, deltaText: "🧠 " },
      } as BusEnvelope<"brain.chat.delta", MessageMap["brain.chat.delta"]>);

      console.log(
        `[brain.chat] ${traceId} mode=${mode ?? "assistant"} text="${message.slice(0, 50)}..."`
      );

      let finalText = "";
      let toolsUsed: string[] = [];
      let operatorExecuted: { operatorId: string; ok: boolean } | undefined;

      // 2) Detect intent and dispatch
      const text = message.trim();
      const wantsPatch = text.toLowerCase().startsWith("patch:");

      if (wantsPatch) {
        send({
          v: 2,
          id: randomId("srv"),
          type: "brain.chat.delta" as any,
          ts: nowMs(),
          from: { role: "nucleus", instanceId: HUB_INSTANCE_ID },
          sessionId: env.sessionId,
          auth: env.auth,
          nonce: randomId("n"),
          payload: { traceId, seq: seq++, deltaText: "Routing to PatchOperator…\n" },
        } as any);

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
            "✅ PatchOperator result:\n\n```json\n" + JSON.stringify(opResult, null, 2) + "\n```";
        } catch (err: any) {
          operatorExecuted = {
            operatorId: "prompt.operator.patch",
            ok: false,
          };
          finalText = `❌ PatchOperator error:\n${err?.message ?? String(err)}`;
        }
      } else {
        // 3) Minimal fallback response
        send({
          v: 2,
          id: randomId("srv"),
          type: "brain.chat.delta" as any,
          ts: nowMs(),
          from: { role: "nucleus", instanceId: HUB_INSTANCE_ID },
          sessionId: env.sessionId,
          auth: env.auth,
          nonce: randomId("n"),
          payload: { traceId, seq: seq++, deltaText: "\nThinking…\n" },
        } as any);

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
        type: "brain.chat.done" as any,
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
      } as any);

      // Log for structured observability
      console.log(
        JSON.stringify({
          event: "brain.chat.done",
          traceId,
          latency_ms: latency,
          mode: mode ?? "assistant",
          toolsUsed,
        })
      );
    } catch (err: any) {
      console.error(`[brain.chat] ${traceId} error:`, err);

      send({
        v: 2,
        id: randomId("srv"),
        type: "brain.chat.error" as any,
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
      } as any);
    }
  }
}

export const chatHandler = new ChatHandler();
