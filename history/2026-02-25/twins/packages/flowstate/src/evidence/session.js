/**
 * Session ID - Stable identifier via localStorage
 */
const SESSION_KEY = "world_engine_flowstate_session_id";
export function getOrCreateSessionId() {
    if (typeof window === "undefined") {
        return "node_" + Date.now();
    }
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
        id = "fs_" + Math.random().toString(36).slice(2, 11) + "_" + Date.now();
        try {
            localStorage.setItem(SESSION_KEY, id);
        }
        catch {
            // localStorage unavailable, use temp ID
        }
    }
    return id;
}
export function clearSessionId() {
    if (typeof window !== "undefined") {
        try {
            localStorage.removeItem(SESSION_KEY);
        }
        catch {
            // ignore
        }
    }
}
