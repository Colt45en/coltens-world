import { EventEmitter } from "node:events";
export class LocalEnvelopeBus extends EventEmitter {
    config;
    /** envsByTraceId[traceId] = [env1, env2, ..] (oldest first) */
    envsByTraceId = new Map();
    /** Subscribers by event type: e.g., "pipeline.stage.completed" -> [listener1, ...] */
    listenersByType = new Map();
    constructor(config = {}) {
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
    publish(envelope) {
        // Notify subscribers
        const listeners = this.listenersByType.get(envelope.type);
        if (listeners) {
            for (const listener of listeners) {
                try {
                    listener(envelope);
                }
                catch (err) {
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
    subscribe(type, listener) {
        if (!this.listenersByType.has(type)) {
            this.listenersByType.set(type, new Set());
        }
        this.listenersByType.get(type).add(listener);
        // Return unsubscribe function
        return () => {
            this.listenersByType.get(type)?.delete(listener);
        };
    }
    /**
     * Subscribe to multiple types at once
     */
    subscribeMultiple(types, listener) {
        const unsubs = types.map((t) => this.subscribe(t, listener));
        return () => unsubs.forEach((u) => u());
    }
    /**
     * Get all cached envelopes for a traceId
     */
    getTraceEnvelopes(traceId) {
        return this.envsByTraceId.get(traceId) ?? [];
    }
    /**
     * Get the tail N envelopes for a traceId
     */
    getTraceEnvelopesTail(traceId, count) {
        const all = this.getTraceEnvelopes(traceId);
        return all.slice(Math.max(0, all.length - count));
    }
    /**
     * Get all active traceIds
     */
    getAllTraceIds() {
        return Array.from(this.envsByTraceId.keys());
    }
    /**
     * Clear cache for a specific traceId (e.g., after upload to DB)
     */
    clearTrace(traceId) {
        this.envsByTraceId.delete(traceId);
    }
    /**
     * Get bus stats
     */
    getStats() {
        let totalEnvelopes = 0;
        for (const envs of this.envsByTraceId.values()) {
            totalEnvelopes += envs.length;
        }
        const listenerCounts = {};
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
    cacheEnvelope(envelope) {
        const { traceId } = envelope;
        if (!this.envsByTraceId.has(traceId)) {
            this.envsByTraceId.set(traceId, []);
        }
        const envs = this.envsByTraceId.get(traceId);
        envs.push(envelope);
        // Trim if over limit
        if (envs.length > this.config.maxEnvelopesPerTrace) {
            envs.shift(); // Remove oldest
        }
        // Trim total traces if needed (FIFO)
        if (this.envsByTraceId.size > this.config.maxTraces) {
            const oldestTrace = this.envsByTraceId.keys().next().value;
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
