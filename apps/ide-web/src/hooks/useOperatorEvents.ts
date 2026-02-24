/**
 * useOperatorEvents Hook
 *
 * Subscribe to operator execution events from the WS bus.
 * Handles automatic polling, caching, and cleanup.
 *
 * Usage:
 *   const events = useOperatorEvents(busClient);
 *   -> events: OperatorExecution[]
 */

import { useEffect, useState } from "react";
import { WsBusClient } from "../bus/wsBusClient";

export interface OperatorExecution {
    operator_id: string;
    operator_name: string;
    trace_id: string;
    status: "success" | "validation_error" | "timeout" | "execution_error";
    result?: Record<string, any>;
    error?: { code: string; message: string };
    memory_writes?: Array<{ key: string; value: string; ttl_seconds?: number }>;
    execution_time_ms: number;
    deterministic_hash?: string;
    created_at: string;
    updated_at: string;
}

interface UseOperatorEventsOptions {
    maxResults?: number;
    pollInterval?: number; // ms, 0 = WS only, undefined = 1000ms
    enabled?: boolean;
}

/**
 * Hook to subscribe to operator execution events.
 *
 * Subscribes via WS bus (real-time updates) and optionally polls
 * the /operator/events endpoint for missed events.
 */
export const useOperatorEvents = (
    busClient: WsBusClient | undefined,
    options: UseOperatorEventsOptions = {}
) => {
    const { maxResults = 100, pollInterval = 1000, enabled = true } = options;

    const [events, setEvents] = useState<OperatorExecution[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Subscribe to WS events
    useEffect(() => {
        if (!busClient || !enabled) return;

        const unsubscribe = busClient.subscribe("operator.executed", (envelope: any) => {
            const execution = envelope.payload || envelope.data || envelope;

            setEvents((prev) => {
                const newEvents = [execution, ...prev].slice(0, maxResults);
                return newEvents;
            });
        });

        return () => unsubscribe?.();
    }, [busClient, enabled, maxResults]);

    // Poll for missed events
    useEffect(() => {
        if (!enabled || pollInterval === 0) return;

        const interval = setInterval(async () => {
            try {
                setIsLoading(true);
                const resp = await fetch("http://localhost:3000/operator/events");
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

                const data = await resp.json();
                setEvents(data.events.slice(0, maxResults));
                setError(null);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Unknown error");
            } finally {
                setIsLoading(false);
            }
        }, pollInterval ?? 1000);

        return () => clearInterval(interval);
    }, [enabled, pollInterval, maxResults]);

    return { events, isLoading, error };
};

/**
 * useOperatorEventById Hook
 *
 * Subscribe to a single operator event by trace_id.
 */
export const useOperatorEventById = (
    busClient: WsBusClient | undefined,
    traceId: string | null,
    options: UseOperatorEventsOptions = {}
) => {
    const { enabled = !!traceId } = options;
    const [event, setEvent] = useState<OperatorExecution | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load specific event
    useEffect(() => {
        if (!traceId || !enabled) return;

        (async () => {
            try {
                setIsLoading(true);
                const resp = await fetch(`http://localhost:3000/operator/events/${traceId}`);
                if (!resp.ok) {
                    if (resp.status === 404) {
                        setEvent(null);
                        return;
                    }
                    throw new Error(`HTTP ${resp.status}`);
                }

                const data = await resp.json();
                setEvent(data.event || null);
                setError(null);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Unknown error");
            } finally {
                setIsLoading(false);
            }
        })();
    }, [traceId, enabled]);

    // Subscribe to updates
    useEffect(() => {
        if (!busClient || !traceId || !enabled) return;

        const unsubscribe = busClient.subscribe("operator.executed", (envelope: any) => {
            const execution = envelope.payload || envelope.data || envelope;

            if (execution.trace_id === traceId) {
                setEvent(execution);
            }
        });

        return () => unsubscribe?.();
    }, [busClient, traceId, enabled]);

    return { event, isLoading, error };
};
