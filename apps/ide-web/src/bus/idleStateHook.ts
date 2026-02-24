/**
 * apps/ide-web/src/bus/idleStateHook.ts
 *
 * Hook for managing idle autonomy state in the IDE
 * Polls /idle/state endpoint and provides state + convenience functions
 */

import type { IdleGuardState } from "@world-engine/protocol";
import { useCallback, useEffect, useState } from "react";

const BUS_URL = "http://localhost:3000";

export interface IdleState {
    mode: string;
    state: IdleGuardState;
    isLoading: boolean;
    error: string | null;
    lastUpdated: number;
}

const defaultState: IdleGuardState = {
    mode: "dream_idle",
    prompted: false,
    prompt_text: "",
    approved: false,
    approval_token: "",
    approval_expires_ts: 0,
    last_activation_ts: 0,
    last_block_reason: "never_checked",
};

/**
 * Hook to manage idle state
 * Polls /idle/state endpoint every 1s
 */
export function useIdleState(mode: string = "dream_idle") {
    const [idleState, setIdleState] = useState<IdleState>({
        mode,
        state: defaultState,
        isLoading: true,
        error: null,
        lastUpdated: 0,
    });

    const fetchState = useCallback(async () => {
        try {
            const res = await fetch(`${BUS_URL}/idle/state?mode=${encodeURIComponent(mode)}`, {
                method: "GET",
            });
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            const data = await res.json();
            setIdleState({
                mode,
                state: data.state || defaultState,
                isLoading: false,
                error: null,
                lastUpdated: Date.now(),
            });
        } catch (err) {
            setIdleState((prev) => ({
                ...prev,
                isLoading: false,
                error: err instanceof Error ? err.message : String(err),
            }));
        }
    }, [mode]);

    // Poll every 1s
    useEffect(() => {
        fetchState();
        const interval = setInterval(fetchState, 1000);
        return () => clearInterval(interval);
    }, [fetchState]);

    const prompt = useCallback(
        async (text: string) => {
            try {
                const res = await fetch(`${BUS_URL}/idle/prompt`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ mode, text }),
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return await res.json();
            } catch (err) {
                console.error("[useIdleState.prompt] error:", err);
                throw err;
            }
        },
        [mode]
    );

    const approve = useCallback(
        async (phrase: string = "approve", ttlSeconds?: number) => {
            try {
                const res = await fetch(`${BUS_URL}/idle/approve`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        mode,
                        phrase,
                        ...(ttlSeconds && { ttlSeconds }),
                    }),
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return await res.json();
            } catch (err) {
                console.error("[useIdleState.approve] error:", err);
                throw err;
            }
        },
        [mode]
    );

    const revoke = useCallback(
        async (reason?: string) => {
            try {
                const res = await fetch(`${BUS_URL}/idle/revoke`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        mode,
                        reason: reason || "revoked_by_user",
                    }),
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return await res.json();
            } catch (err) {
                console.error("[useIdleState.revoke] error:", err);
                throw err;
            }
        },
        [mode]
    );

    return {
        ...idleState,
        refetch: fetchState,
        prompt,
        approve,
        revoke,
    };
}
