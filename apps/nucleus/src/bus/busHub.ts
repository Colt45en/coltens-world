// TODO: Import from @world-engine/engine when available
// import type { BusEnvelopeV1 } from "@world-engine/engine";
import { EventEmitter } from "node:events";

// Placeholder type for BusEnvelopeV1
type BusEnvelopeV1 = any;

/**
 * LocalEnvelopeBus
 *
 * In-memory pub/sub for BusEnvelopes.
 * - Subscribers listen by event type
 * - Envelopes cached per traceId for replay
 * - Later: swap for distributed bus (Redis, NATS, etc.)
 */

export interface BusHubConfig {
    /** Max envelopes to store per traceId (for replay) */
    maxEnvelopesPerTrace?: number;
    /** Max total traces to keep (FIFO eviction) */
    maxTraces?: number;
}

type EnvelopeListener = (env: BusEnvelopeV1) => void;

export class LocalEnvelopeBus extends EventEmitter {
    private config: Required<BusHubConfig>;
    /** envsByTraceId[traceId] = [env1, env2, ..] (oldest first) */
    private envsByTraceId = new Map<string, BusEnvelopeV1[]>();
    /** Subscribers by event type: e.g., "pipeline.stage.completed" -> [listener1, ...] */
    private listenersByType = new Map<string, Set<EnvelopeListener>>();

    constructor(config: BusHubConfig = {}) {
        super();
        this.config = {
            maxEnvelopesPerTrace: config.maxEnvelopesPerTrace ?? 500,
            maxTraces: config.maxTraces ?? 1000,
        };
    }

    /**
     * Publish an envelope
     * - Broadcast to subscribers listening to this type
     * - Cache for replay
     */
    publish(envelope: BusEnvelopeV1): void {
        // Notify subscribers
        const listeners = this.listenersByType.get(envelope.type);
        if (listeners) {
            for (const listener of listeners) {
                try {
                    listener(envelope);
                } catch (err) {
                    console.error(`[busHub] listener error for type=${envelope.type}:`, err);
                }
            }
        }

        // Cache for replay
        this.cacheEnvelope(envelope);

        // Emit on EventEmitter too (for loose coupling)
        this.emit(envelope.type, envelope);
    }

    /**
     * Subscribe to envelopes of a specific type
     * Returns an unsubscribe function
     */
    subscribe(type: string, listener: EnvelopeListener): () => void {
        if (!this.listenersByType.has(type)) {
            this.listenersByType.set(type, new Set());
        }
        this.listenersByType.get(type)!.add(listener);

        // Return unsubscribe function
        return () => {
            this.listenersByType.get(type)?.delete(listener);
        };
    }

    /**
     * Subscribe to multiple types at once
     */
    subscribeMultiple(types: string[], listener: EnvelopeListener): () => void {
        const unsubs = types.map((t) => this.subscribe(t, listener));
        return () => unsubs.forEach((u) => u());
    }

    /**
     * Get all cached envelopes for a traceId
     */
    getTraceEnvelopes(traceId: string): BusEnvelopeV1[] {
        return this.envsByTraceId.get(traceId) ?? [];
    }

    /**
     * Get the tail N envelopes for a traceId
     */
    getTraceEnvelopesTail(traceId: string, count: number): BusEnvelopeV1[] {
        const all = this.getTraceEnvelopes(traceId);
        return all.slice(Math.max(0, all.length - count));
    }

    /**
     * Get all active traceIds
     */
    getAllTraceIds(): string[] {
        return Array.from(this.envsByTraceId.keys());
    }

    /**
     * Clear cache for a specific traceId (e.g., after upload to DB)
     */
    clearTrace(traceId: string): void {
        this.envsByTraceId.delete(traceId);
    }

    /**
     * Get bus stats
     */
    getStats(): {
        activeTraces: number;
        totalEnvelopes: number;
        listenerCounts: Record<string, number>;
    } {
        let totalEnvelopes = 0;
        for (const envs of this.envsByTraceId.values()) {
            totalEnvelopes += envs.length;
        }

        const listenerCounts: Record<string, number> = {};
        for (const [type, listeners] of this.listenersByType.entries()) {
            listenerCounts[type] = listeners.size;
        }

        return {
            activeTraces: this.envsByTraceId.size,
            totalEnvelopes,
            listenerCounts,
        };
    }

    /** --- Internal --- */

    private cacheEnvelope(envelope: BusEnvelopeV1): void {
        const { traceId } = envelope;

        if (!this.envsByTraceId.has(traceId)) {
            this.envsByTraceId.set(traceId, []);
        }

        const envs = this.envsByTraceId.get(traceId)!;
        envs.push(envelope);

        // Trim if over limit
        if (envs.length > this.config.maxEnvelopesPerTrace) {
            envs.shift(); // Remove oldest
        }

        // Trim total traces if needed (FIFO)
        if (this.envsByTraceId.size > this.config.maxTraces) {
            const oldestTrace = this.envsByTraceId.keys().next().value as string;
            this.envsByTraceId.delete(oldestTrace);
        }
    }
}

/**
 * Global bus instance (can be replaced with distributed bus later)
 */
export const globalBus = new LocalEnvelopeBus({
    maxEnvelopesPerTrace: 500,
    maxTraces: 1000,
});
