import type { BusEnvelopeV1, PipelineEnvelope } from "@world-engine/engine";
import { BusEnvelopeV1Schema } from "@world-engine/engine";

type NexusV1EventEnvelope = {
    v: 1;
    event_id: string;
    event_type: string;
    ts_ms: number;
    trace_id: string;
    seq: number;
    payload: Record<string, unknown>;
};

/**
 * WsBusClient
 *
 * IDE-Web client for subscribing to pipeline events via the bus hub.
 * Features:
 * - Auto-reconnect
 * - Local cache of recent envelopes
 * - Callbacks for stage events
 * - Trace-aware (groups events by traceId)
 */

export interface BusClientHandlers {
    onConnect?: () => void;
    onDisconnect?: () => void;
    onEnvelope?: (env: BusEnvelopeV1) => void;
    onPipelineRunStarted?: (env: PipelineEnvelope) => void;
    onPipelineStageStarted?: (env: PipelineEnvelope) => void;
    onPipelineStageCompleted?: (env: PipelineEnvelope) => void;
    onPipelineRunCompleted?: (env: PipelineEnvelope) => void;
    onError?: (err: Error) => void;
}

export interface BusClientConfig {
    /** URL of bus hub (e.g., "ws://localhost:3000") */
    url: string;
    /** Auto-reconnect attempts (-1 = infinite) */
    reconnectAttempts?: number;
    /** Delay between reconnect attempts (ms) */
    reconnectDelayMs?: number;
    /** Max envelopes to cache per trace */
    maxEnvelopesPerTrace?: number;
}

export class WsBusClient {
    private readonly config: Required<BusClientConfig>;
    private ws: WebSocket | null = null;
    private readonly handlers: BusClientHandlers;
    private readonly envelopesCache = new Map<string, BusEnvelopeV1[]>();
    private isConnecting = false;
    private reconnectCount = 0;

    constructor(config: BusClientConfig, handlers: BusClientHandlers = {}) {
        this.config = {
            url: config.url,
            reconnectAttempts: config.reconnectAttempts ?? 5,
            reconnectDelayMs: config.reconnectDelayMs ?? 1000,
            maxEnvelopesPerTrace: config.maxEnvelopesPerTrace ?? 200,
        };
        this.handlers = handlers;
    }

    /**
     * Connect to bus hub
     */
    connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.isConnecting) {
                reject(new Error("Already connecting"));
                return;
            }

            this.isConnecting = true;

            try {
                this.ws = new WebSocket(this.config.url);

                this.ws.onopen = () => {
                    console.log("[WsBusClient] Connected to bus hub");
                    this.isConnecting = false;
                    this.reconnectCount = 0;
                    this.handlers.onConnect?.();
                    resolve();
                };

                this.ws.onmessage = (evt) => {
                    this.handleMessage(evt.data);
                };

                this.ws.onclose = () => {
                    console.log("[WsBusClient] Disconnected from bus hub");
                    this.isConnecting = false;
                    this.handlers.onDisconnect?.();
                    this.maybeReconnect();
                };

                this.ws.onerror = (evt) => {
                    const err = new Error(`WS error: ${evt.type}`);
                    console.error("[WsBusClient] Error:", err);
                    this.handlers.onError?.(err);
                    reject(err);
                };
            } catch (err) {
                this.isConnecting = false;
                reject(err);
            }
        });
    }

    /**
     * Disconnect from bus hub
     */
    disconnect(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    /**
     * Get cached envelopes for a trace
     */
    getTraceEnvelopes(traceId: string): BusEnvelopeV1[] {
        return this.envelopesCache.get(traceId) ?? [];
    }

    /**
     * Get recent envelopes (last N by timestamp across all traces)
     */
    getRecentEnvelopes(count: number): BusEnvelopeV1[] {
        const all: BusEnvelopeV1[] = [];
        for (const envs of this.envelopesCache.values()) {
            all.push(...envs);
        }
        // Sort by timestamp desc, take top N
        const sorted = [...all];
        sorted.sort((a: BusEnvelopeV1, b: BusEnvelopeV1) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
        return sorted.slice(0, count);
    }

    /**
     * Clear cache for a trace
     */
    clearTrace(traceId: string): void {
        this.envelopesCache.delete(traceId);
    }

    /**
     * Get all active traceIds in cache
     */
    getActiveTraceIds(): string[] {
        return Array.from(this.envelopesCache.keys());
    }

    /** --- Internal --- */

    private handleMessage(data: string): void {
        try {
            const parsed = JSON.parse(data);
            const validation = BusEnvelopeV1Schema.safeParse(parsed);

            if (!validation.success) {
                console.warn("[WsBusClient] Invalid envelope:", validation.error);
                return;
            }

            const env = validation.data;

            // Bridge Nexus runtime envelopes into the flowstate evidence channel.
            this.dispatchNexusBridgeEvent(env);

            // Cache it
            this.cacheEnvelope(env);

            // Notify generic handler
            this.handlers.onEnvelope?.(env);

            // Notify type-specific handlers
            if (env.type === "pipeline.run.started") {
                this.handlers.onPipelineRunStarted?.(env as PipelineEnvelope);
            } else if (env.type === "pipeline.stage.started") {
                this.handlers.onPipelineStageStarted?.(env as PipelineEnvelope);
            } else if (env.type === "pipeline.stage.completed") {
                this.handlers.onPipelineStageCompleted?.(env as PipelineEnvelope);
            } else if (env.type === "pipeline.run.completed") {
                this.handlers.onPipelineRunCompleted?.(env as PipelineEnvelope);
            }
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            console.error("[WsBusClient] Failed to handle message:", error);
            this.handlers.onError?.(error);
        }
    }

    private dispatchNexusBridgeEvent(env: BusEnvelopeV1): void {
        if (globalThis.window === undefined) {
            return;
        }

        const candidate = this.extractNexusEvent(env);
        if (!candidate) {
            return;
        }

        const bridged = new CustomEvent<NexusV1EventEnvelope>("nexus:v1:event", {
            detail: candidate,
            bubbles: true,
            cancelable: false,
        });
        globalThis.dispatchEvent(bridged);
    }

    private extractNexusEvent(env: BusEnvelopeV1): NexusV1EventEnvelope | null {
        const data = env.data;
        if (!data || typeof data !== "object") {
            return null;
        }

        const raw = data as Record<string, unknown>;
        if (raw.v !== 1) {
            return null;
        }
        if (typeof raw.event_type !== "string" || typeof raw.trace_id !== "string") {
            return null;
        }

        return {
            v: 1,
            event_id: typeof raw.event_id === "string" ? raw.event_id : env.id,
            event_type: raw.event_type,
            ts_ms: typeof raw.ts_ms === "number" ? raw.ts_ms : Date.parse(env.ts),
            trace_id: raw.trace_id,
            seq: typeof raw.seq === "number" ? raw.seq : 0,
            payload: raw.payload && typeof raw.payload === "object"
                ? (raw.payload as Record<string, unknown>)
                : {},
        };
    }

    private cacheEnvelope(env: BusEnvelopeV1): void {
        const { traceId } = env;

        if (!this.envelopesCache.has(traceId)) {
            this.envelopesCache.set(traceId, []);
        }

        const envs = this.envelopesCache.get(traceId)!;
        envs.push(env);

        // Trim if over limit
        if (envs.length > this.config.maxEnvelopesPerTrace) {
            envs.shift();
        }
    }

    private maybeReconnect(): void {
        if (
            this.config.reconnectAttempts === -1 ||
            this.reconnectCount < this.config.reconnectAttempts
        ) {
            this.reconnectCount++;
            const delay = this.config.reconnectDelayMs * Math.pow(1.5, this.reconnectCount - 1);
            console.log(`[WsBusClient] Reconnecting in ${delay}ms (attempt ${this.reconnectCount})`);
            setTimeout(() => this.connect().catch(console.error), delay);
        }
    }

    /**
     * Adapter API: subscribe to a specific event type (for legacy hooks)
     * Returns an unsubscriber function.
     */
    subscribe(
        eventType: string,
        handler: (envelope: BusEnvelopeV1) => void
    ): () => void {
        // Setup a map of subscriptions if not already
        if (!(this as any)._subscriptions) {
            (this as any)._subscriptions = new Map<string, Set<Function>>();
        }

        const subs = (this as any)._subscriptions as Map<string, Set<Function>>;

        if (!subs.has(eventType)) {
            subs.set(eventType, new Set());
        }

        subs.get(eventType)!.add(handler);

        // Augment onEnvelope to dispatch to subscribers if not already done
        if (!(this as any)._originalOnEnvelope) {
            (this as any)._originalOnEnvelope = this.handlers.onEnvelope;
            this.handlers.onEnvelope = (env: BusEnvelopeV1) => {
                // Call original handler
                (this as any)._originalOnEnvelope?.(env);

                // Dispatch to subscriptions
                const handlers = subs.get(env.type);
                if (handlers) {
                    handlers.forEach((h) => h(env));
                }
            };
        }

        // Return unsubscriber
        return () => {
            subs.get(eventType)?.delete(handler);
        };
    }

    /**
     * Getter: is connection established?
     */
    get isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }
}
