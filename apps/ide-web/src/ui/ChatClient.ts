/**
 * ChatClient - WebSocket-based agentic chat interface (engine-grade)
 *
 * Handles:
 * - WebSocket connection to Nucleus root hub (ws://localhost:3000)
 * - System handshake with system.hello / system.welcome
 * - Chat message sending (with world context)
 * - Streaming response rendering (token-by-token)
 * - Tool execution (local UI tools)
 * - Citation rendering
 * - Memory persistence
 *
 * Hardened against undefined errors with real close diagnostics.
 */

import type {
    ChatRequest,
    ToolCall,
    ToolResult
} from "@world-engine/protocol";

export interface ChatClientConfig {
    userId: string;
    convoId: string;
    wsUrl?: string;
    onMessage?: (_text: string) => void;
    onToolCall?: (_tool: ToolCall) => Promise<void>;
    onToolsQueued?: (_tools: ToolCall[]) => void;
    onToolCommand?: (_env: any) => Promise<void>; // Handle tool.command.v1
    onToolEffect?: (_env: any) => void;            // Display tool.effect.v1 results
    onCitation?: (_url: string, _title: string, _snippet?: string) => void;
    onMemoryWrite?: (key: string, value: string) => void;
    onError?: (error: string) => void;
    onStreamStart?: () => void;
    onStreamEnd?: () => void;
}

/**
 * Engine-grade WebSocket diagnostic message
 */
interface WsDiagnostic {
    event: "open" | "error" | "close" | "timeout" | "exception";
    url: string;
    readyState: number;
    phase?: "connecting" | "open_no_welcome" | "welcomed" | undefined;
    code?: number | undefined;
    reason?: string | undefined;
    wasClean?: boolean | undefined;
    afterMs?: number | undefined;
}

export class ChatClient {
    private readonly config: ChatClientConfig;
    private ws: WebSocket | null = null;
    private pendingTraceId: string | null = null;
    private sessionId: string | null = null;
    private sessionToken: string | null = null;
    private instanceId: string | null = null;
    private handshakeDone = false;
    private intentionalClose = false;
    private handshakeTimer: ReturnType<typeof setTimeout> | null = null;
    private readonly recentHistory: Array<{ role: "user" | "bot"; content: string }> = [];

    constructor(config: ChatClientConfig) {
        this.config = {
            wsUrl: config.wsUrl || "ws://localhost:3000",
            userId: config.userId,
            convoId: config.convoId,
            onMessage: config.onMessage,
            onToolCall: config.onToolCall,
            onToolsQueued: config.onToolsQueued,
            onToolCommand: config.onToolCommand,
            onToolEffect: config.onToolEffect,
            onCitation: config.onCitation,
            onMemoryWrite: config.onMemoryWrite,
            onError: config.onError,
            onStreamStart: config.onStreamStart,
            onStreamEnd: config.onStreamEnd,
        } as ChatClientConfig;
    }

    /**
     * Format WebSocket diagnostics for display
     */
    private _formatDiagnostic(d: WsDiagnostic): string {
        const reason = d.reason ? JSON.stringify(d.reason) : '"(none)"';
        const code = typeof d.code === "number" ? d.code : -1;
        const clean = typeof d.wasClean === "boolean" ? d.wasClean : false;
        const phase = d.phase ?? "welcomed";
        const after = typeof d.afterMs === "number" ? ` after=${d.afterMs}ms` : "";
        return `[${d.event}] url=${d.url} phase=${phase} state=${d.readyState} code=${code} reason=${reason} clean=${clean}${after}`;
    }

    connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            let done = false;
            let sawOpen = false;

            const finalizeOnce = (kind: "close" | "timeout" | "exception", detail: string) => {
                if (done) return;
                done = true;
                this.config.onError?.(`Connection failed: ${detail}`);
                try {
                    this.ws?.close();
                } catch {
                    // no-op
                }
                reject(new Error(detail));
            };

            const getPhase = (): WsDiagnostic["phase"] => {
                if (this.handshakeDone) return "welcomed";
                return sawOpen ? "open_no_welcome" : "connecting";
            };

            try {
                const url = this.config.wsUrl!;
                console.log(`[chat] Connecting to ${url}`);

                this.intentionalClose = false;
                this.handshakeDone = false;

                this.ws = new WebSocket(url);

                const handleWelcome = () => {
                    console.log("[chat] Handshake complete!", {
                        sessionId: this.sessionId,
                        instanceId: this.instanceId,
                    });
                    this.ws!.removeEventListener("open", handleOpen);
                    if (this.handshakeTimer) {
                        clearTimeout(this.handshakeTimer);
                        this.handshakeTimer = null;
                    }
                    done = true;
                    resolve();
                };

                const handleOpen = () => {
                    sawOpen = true;
                    console.log("[chat] WebSocket opened, sending system.hello handshake");
                    this._sendHandshake();

                    if (this.handshakeTimer) {
                        clearTimeout(this.handshakeTimer);
                        this.handshakeTimer = null;
                    }

                    this.handshakeTimer = setTimeout(() => {
                        if (!this.handshakeDone) {
                            const err = this._formatDiagnostic({
                                event: "timeout",
                                url,
                                phase: sawOpen ? "open_no_welcome" : "connecting",
                                readyState: this.ws?.readyState ?? WebSocket.CLOSED,
                                afterMs: 5000,
                            });
                            console.error("[chat]", err);
                            finalizeOnce("timeout", err);
                        }
                    }, 5000);
                };

                this.ws.addEventListener("open", handleOpen);

                this.ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        console.log("[chat] Received:", data.type || data.kind);

                        // Handle handshake response
                        if (data.type === "system.welcome") {
                            this.sessionId = data.sessionId;
                            this.sessionToken = data.auth?.token;
                            this.instanceId = data.payload?.assignedInstanceId;
                            this.handshakeDone = true;
                            handleWelcome();
                            return;
                        }

                        // Handle other messages after handshake is complete
                        if (this.handshakeDone) {
                            this._handleMessage(data);
                        }
                    } catch (err) {
                        const msg = this._formatDiagnostic({
                            event: "exception",
                            url,
                            phase: getPhase(),
                            readyState: this.ws?.readyState ?? WebSocket.CLOSED,
                            reason: err instanceof Error ? err.message : String(err),
                        });
                        console.error("[chat] Failed to parse message:", msg, err);
                        if (!this.handshakeDone) {
                            finalizeOnce("exception", msg);
                        }
                    }
                };

                this.ws.onerror = (event: Event) => {
                    // Browser events give no details; rely on onclose
                    const diagnostic: WsDiagnostic = {
                        event: "error",
                        url,
                        phase: getPhase(),
                        readyState: this.ws?.readyState ?? WebSocket.CLOSED,
                    };
                    const msg = `WebSocket error event: ${this._formatDiagnostic(diagnostic)}`;
                    console.error("[chat]", msg, event);
                    // Don't reject here; wait for onclose for details
                };

                this.ws.onclose = (event: CloseEvent) => {
                    if (this.handshakeTimer) {
                        clearTimeout(this.handshakeTimer);
                        this.handshakeTimer = null;
                    }
                    if (this.intentionalClose) {
                        this.handshakeDone = false;
                        return;
                    }

                    // Now we have the real close reason
                    const diagnostic: WsDiagnostic = {
                        event: "close",
                        url,
                        phase: getPhase(),
                        readyState: this.ws?.readyState ?? WebSocket.CLOSED,
                        code: event.code,
                        reason: event.reason,
                        wasClean: event.wasClean,
                    };
                    const msg = this._formatDiagnostic(diagnostic);
                    console.log(`[chat] Disconnected: ${msg}`);

                    if (this.handshakeDone) {
                        this.config.onError?.(`Connection failed: ${msg}`);
                    } else {
                        finalizeOnce("close", msg);
                    }
                    this.handshakeDone = false;
                };
            } catch (err) {
                const msg = `WebSocket initialization error: ${err instanceof Error ? err.message : String(err)}`;
                console.error("[chat]", msg);
                finalizeOnce("exception", msg);
            }
        });
    }

    private _sendHandshake(): void {
        const helloEnvelope = {
            v: 2,
            id: this._generateId(),
            type: "system.hello",
            ts: Date.now(),
            from: {
                role: "ide",
                instanceId: this._generateId("client")
            },
            sessionId: "",
            payload: {
                requestedRole: "ide"
            }
        };

        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(helloEnvelope));
            console.log("[chat] Sent system.hello handshake");
        }
    }

    private _generateId(prefix = "msg"): string {
        return `${prefix}_${Date.now().toString(16)}_${Math.random().toString(16).slice(2)}`;
    }

    close(): void {
        this.intentionalClose = true;
        if (this.handshakeTimer) {
            clearTimeout(this.handshakeTimer);
            this.handshakeTimer = null;
        }
        try {
            this.ws?.close(1000, "client closing");
        } catch {
            // no-op
        }
        this.ws = null;
        this.handshakeDone = false;
    }

    disconnect(): void {
        this.close();
    }

    /**
     * Send a tool effect back to Nucleus
     * (used when IDE completes a tool.command.v1 like record_screen)
     */
    sendToolEffect(traceId: string, toolCallId: string, name: string, status: string, resultOrError: any): void {
        if (this.ws?.readyState !== WebSocket.OPEN) {
            throw new Error("WebSocket not connected");
        }

        const payload = status === "ok"
            ? { toolCallId, name, status, result: resultOrError }
            : { toolCallId, name, status, error: { message: resultOrError } };

        const envelope = {
            v: 2,
            id: this._generateId("eff"),
            type: "tool.effect.v1",
            ts: Date.now(),
            from: {
                role: "ide",
                instanceId: this.instanceId || "ide_unknown"
            },
            sessionId: this.sessionId,
            traceId,
            payload,
        };

        this.ws.send(JSON.stringify(envelope));
    }

    /**
     * Send a chat message with context
     */
    async sendMessage(
        text: string,
        context?: Record<string, any>
    ): Promise<void> {
        if (this.ws?.readyState !== WebSocket.OPEN) {
            throw new Error("WebSocket not connected");
        }

        if (!this.handshakeDone || !this.sessionId || !this.sessionToken) {
            throw new Error("Handshake not complete");
        }

        const traceId = this._generateId("trace");
        this.pendingTraceId = traceId;

        const chatRequest: ChatRequest = {
            convoId: this.config.convoId,
            userId: this.config.userId,
            text,
            persona: "general",
            recentHistory: this.recentHistory.slice(-20),
            context: context || {
                mapId: "default",
                playerPos: [0, 0, 0],
                visibleEntities: [],
            },
        };

        // Use BusEnvelope format for Nucleus wire protocol
        const envelope = {
            v: 2,
            id: this._generateId("msg"),
            type: "chat.request.v1",
            ts: Date.now(),
            from: {
                role: "ide",
                instanceId: this.instanceId || "ide_unknown"
            },
            sessionId: this.sessionId,
            nonce: this._generateId("nonce"),
            auth: {
                kind: "session" as const,
                token: this.sessionToken
            },
            payload: chatRequest
        };

        console.log(`[chat] Sending request ${traceId}: "${text.slice(0, 50)}..."`);
        this.config.onStreamStart?.();
        this.recentHistory.push({ role: "user", content: text });

        this.ws.send(JSON.stringify(envelope));
    }

    /**
     * Handle messages from Nucleus (after handshake)
     * Supports new streaming protocol: chat.delta.v1, chat.tool_call.v1, chat.done.v1
     */
    private _handleMessage(env: any): void {
        const { type, payload, traceId, messageId } = env;

        // Ignore if not for our current request
        if (traceId !== this.pendingTraceId) {
            console.debug(`[chat] Ignoring event for different trace: ${traceId}`);
            return;
        }

        switch (type) {
            // Stream lifecycle events
            case "chat.stream.started.v1": {
                console.log(`[chat] Stream started: ${messageId}`);
                this.config.onStreamStart?.();
                break;
            }

            // Token/delta streaming
            case "chat.delta.v1": {
                const textDelta = payload?.text_delta || "";
                if (textDelta) {
                    this.config.onMessage?.(textDelta);
                }
                break;
            }

            // Tool invocation
            case "chat.tool_call.v1": {
                const toolPayload = payload?.payload || payload;
                const tool: ToolCall = {
                    name: toolPayload.name || "",
                    args: toolPayload.arguments || {},
                    timeout: toolPayload.timeout || 30000,
                    critical: toolPayload.critical || false,
                };
                // Queue tool calls, don't execute until stream.done
                this._queueToolCall(tool);
                break;
            }

            // Stream completion
            case "chat.done.v1": {
                console.log(`[chat] Stream done: ${payload?.stop_reason}`);
                // Execute any queued tool calls here
                this._executeQueuedToolCalls();
                this.config.onStreamEnd?.();
                break;
            }

            // Error during streaming
            case "chat.stream.error.v1": {
                console.error(`[chat] Stream error: ${payload?.error}`);
                this.config.onError?.(payload?.error || "Unknown stream error");
                this.config.onStreamEnd?.();
                break;
            }

            // Stream ended
            case "chat.stream.ended.v1": {
                console.log(`[chat] Stream ended`);
                break;
            }

            // Tool execution frames
            case "tool.command.v1": {
                this.config.onToolCommand?.(env);
                break;
            }

            case "tool.effect.v1": {
                this.config.onToolEffect?.(env);
                break;
            }

            // Batch tool completion
            case "tool.batch.done.v1": {
                console.log(`[chat] Tool batch done: ${env.payload?.count} tools executed`);
                break;
            }

            // Backward compatibility: legacy message types
            case "chat.stream_event": {
                this._handleStreamEvent(payload);
                break;
            }

            case "chat.response": {
                console.log(`[chat] Chat response received: ${traceId}`);
                this.config.onStreamEnd?.();
                break;
            }

            case "chat.error": {
                console.error(`[chat] Error: ${payload.error}`);
                this.config.onError?.(payload.error);
                this.config.onStreamEnd?.();
                break;
            }

            default:
                console.warn(`[chat] Unknown message type: ${type}`);
        }
    }

    /**
     * Queue of tool calls to execute after stream completes
     */
    private toolCallQueue: ToolCall[] = [];

    /**
     * Queue a tool call for execution
     */
    private _queueToolCall(tool: ToolCall): void {
        console.log(`[chat] Queueing tool call: ${tool.name}`);
        this.toolCallQueue.push(tool);
    }

    /**
     * Execute all queued tool calls
     */
    private async _executeQueuedToolCalls(): Promise<void> {
        if (this.toolCallQueue.length === 0) return;

        console.log(`[chat] Executing ${this.toolCallQueue.length} queued tool calls`);
        // Notify UI of tools that will be executed
        this.config.onToolsQueued?.(this.toolCallQueue);

        for (const tool of this.toolCallQueue) {
            await this._executeToolCall(tool);
        }
        this.toolCallQueue = [];
    }

    /**
     * Handle a single stream event (legacy: from chat.stream_event payload)
     */
    private _handleStreamEvent(event: any): void {
        // event should have a "type" field indicating the event type
        const eventType = event.type;

        switch (eventType) {
            case "text_chunk": {
                const chunk: string = event.chunk || event.text || "";
                this.config.onMessage?.(chunk);
                break;
            }

            case "tool_call": {
                const call = event.call || event;
                const tool: ToolCall = {
                    name: call.name,
                    args: call.args || {},
                    timeout: call.timeout || 30000,
                    critical: call.critical || false,
                };
                this._executeToolCall(tool);
                break;
            }

            case "citation": {
                const cit = event.citation || event;
                this.config.onCitation?.(cit.url, cit.title, cit.snippet);
                break;
            }

            case "memory_write": {
                const mem = event.write || event;
                this.config.onMemoryWrite?.(mem.key, mem.value);
                break;
            }

            case "done": {
                console.debug(`[chat] Stream done: ${event.stop_reason}`);
                this.config.onStreamEnd?.();
                break;
            }

            default:
                console.debug(`[chat] Unknown stream event type: ${eventType}`);
        }
    }

    /**
     * Execute a tool call (UI-local tools)
     */
    private async _executeToolCall(tool: ToolCall): Promise<void> {
        console.log(`[chat] Executing tool: ${tool.name}`, tool.args);

        const startTime = Date.now();
        let result: ToolResult;

        try {
            switch (tool.name) {
                case "record_screen": {
                    result = await this._recordScreen(tool.args);
                    break;
                }

                case "record_audio": {
                    result = await this._recordAudio(tool.args);
                    break;
                }

                case "chart_render": {
                    result = await this._renderChart(tool.args);
                    break;
                }

                default: {
                    throw new Error(`Unknown tool: ${tool.name}`);
                }
            }
        } catch (err) {
            result = {
                name: tool.name,
                ok: false,
                data: null,
                error: String(err),
                durationMs: Date.now() - startTime,
            };
        }

        if (this.ws?.readyState === WebSocket.OPEN && this.pendingTraceId) {
            this.sendToolEffect(
                this.pendingTraceId,
                this._generateId("tool"),
                tool.name,
                result.ok ? "ok" : "error",
                result.ok ? result.data : (result.error ?? "Tool execution failed"),
            );
        }
        this.config.onToolCall?.(tool);
    }

    /**
     * Record screen (stub)
     */
    private async _recordScreen(args: Record<string, any>): Promise<ToolResult> {
        const duration = args.duration || 10;
        console.log(`[tools] Recording screen for ${duration}s`);

        // Stub implementation: returns synthetic artifact metadata.
        return {
            name: "record_screen",
            ok: true,
            data: {
                url: "blob:recording",
                duration,
                format: "webm",
            },
            durationMs: duration * 1000,
        };
    }

    /**
     * Record audio (stub)
     */
    private async _recordAudio(args: Record<string, any>): Promise<ToolResult> {
        const duration = args.duration || 5;
        console.log(`[tools] Recording audio for ${duration}s`);

        // Stub implementation: returns synthetic artifact metadata.
        return {
            name: "record_audio",
            ok: true,
            data: {
                url: "blob:audio",
                duration,
                format: "mp3",
            },
            durationMs: duration * 1000,
        };
    }

    /**
     * Render chart (stub)
     */
    private async _renderChart(args: Record<string, any>): Promise<ToolResult> {
        const dataset = args.dataset || [];
        console.log(`[tools] Rendering chart with ${dataset.length} points`);

        // Stub implementation: returns synthetic artifact metadata.
        return {
            name: "chart_render",
            ok: true,
            data: {
                url: "blob:chart.svg",
                pointCount: dataset.length,
                type: args.type || "line",
            },
            durationMs: 500,
        };
    }
}
