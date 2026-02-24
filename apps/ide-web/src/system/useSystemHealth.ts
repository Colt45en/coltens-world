import {
    parseSystemHealthSnapshot,
    SYSTEM_HEALTH_EVENT_TYPE,
    type SystemHealthSnapshot
} from "@world-engine/protocol";
import { useEffect, useMemo, useState } from "react";

/**
 * This hook assumes you already have a WS connection to the Nucleus hub.
 * It only cares about messages of type "system.health".
 *
 * Adapt `getWs()` to your existing WS singleton/hook.
 */

type WsLike = WebSocket;

function getWs(): WsLike | null {
    // Common patterns in your repo:
    // - window.__NUCLEUS_WS__
    // - a ws singleton module
    // - a React context hook
    //
    // Replace this with your actual WS accessor if needed.
    // If you already have an exported ws instance, import it instead.
    return (window as any).__NUCLEUS_WS__ ?? null;
}

export type SystemHealthState = {
    last?: SystemHealthSnapshot;
    lastReceivedAtMs?: number;
    error?: string;
};

export function useSystemHealth(): SystemHealthState {
    const [state, setState] = useState<SystemHealthState>({});

    const ws = useMemo(() => getWs(), []);

    useEffect(() => {
        if (!ws) {
            setState({ error: "No WebSocket instance available for health subscription" });
            return;
        }

        const onMessage = (ev: MessageEvent) => {
            try {
                const data = JSON.parse(String(ev.data));

                // Your bus envelope likely wraps payloads; support both:
                // 1) { type, payload }
                // 2) the payload itself (direct)
                const msgType = data?.type ?? data?.payload?.type;
                const payload = data?.payload ?? data;

                if (data?.type === SYSTEM_HEALTH_EVENT_TYPE || msgType === SYSTEM_HEALTH_EVENT_TYPE) {
                    const parsed = parseSystemHealthSnapshot(payload);
                    setState({
                        last: parsed,
                        lastReceivedAtMs: Date.now()
                    });
                }
            } catch {
                // ignore non-health messages or malformed content
            }
        };

        ws.addEventListener("message", onMessage);
        return () => ws.removeEventListener("message", onMessage);
    }, [ws]);

    return state;
}
