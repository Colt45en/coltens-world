/**
 * App State Store — localStorage-backed, deterministic boot logic
 *
 * Tracks:
 * - Last visited path (for boot redirect)
 * - Last app context (for deep links)
 * - Boot count (for telemetry)
 * - Last boot timestamp
 */

export interface AppState {
    lastPath: string;
    lastAppId?: string | undefined;
    bootCount: number;
    lastBootAt: number; // epoch ms
}

const KEY = "worldengine.ide.state.v1";

const DEFAULT_STATE: AppState = {
    lastPath: "/",
    bootCount: 0,
    lastBootAt: Date.now(),
};

export function loadAppState(): AppState {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return { ...DEFAULT_STATE };
        const parsed = JSON.parse(raw) as Partial<AppState>;
        return {
            ...DEFAULT_STATE,
            ...parsed,
            lastPath: typeof parsed.lastPath === "string" ? parsed.lastPath : "/",
            bootCount: typeof parsed.bootCount === "number" ? parsed.bootCount : 0,
            lastBootAt: typeof parsed.lastBootAt === "number" ? parsed.lastBootAt : Date.now(),
        };
    } catch {
        return { ...DEFAULT_STATE };
    }
}

export function saveAppState(next: AppState): void {
    localStorage.setItem(KEY, JSON.stringify(next));
}

export function bumpBoot(): AppState {
    const s = loadAppState();
    const next: AppState = {
        ...s,
        bootCount: s.bootCount + 1,
        lastBootAt: Date.now(),
    };
    saveAppState(next);
    return next;
}

export function setLastPath(path: string, appId?: string): AppState {
    const s = loadAppState();
    const next: AppState = {
        ...s,
        lastPath: path,
        lastAppId: appId ?? s.lastAppId,
    };
    saveAppState(next);
    return next;
}

export function clearAppState(): void {
    localStorage.removeItem(KEY);
}
