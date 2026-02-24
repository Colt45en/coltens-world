/**
 * Codex Event Bus: typed event subscription system
 * Emitted by CodexRegistry on load/watch/validation state changes
 */

import type { CodexManifest } from "./manifest";

export type CodexLoadIssue = {
    file: string;
    error: string;
};

export type CodexLoadResult = {
    ok: boolean;
    issues: CodexLoadIssue[];
    countLoaded: number;
    manifest?: CodexManifest;
};

export type CodexEventMap = {
    /** Emitted before a load/reload begins */
    CODEX_LOAD_START: { reason: "boot" | "manual" | "fs_watch" };

    /** Emitted after a load finishes (even if issues exist) */
    CODEX_LOAD_RESULT: { result: CodexLoadResult };

    /** Emitted when registry becomes healthy (no issues) */
    CODEX_READY: { manifest: CodexManifest };

    /** Emitted when registry has issues (some files invalid/unreadable) */
    CODEX_INVALID: { issues: CodexLoadIssue[] };

    /** Emitted when manifest is written/updated (if manifestPath enabled) */
    CODEX_MANIFEST_UPDATED: { manifest: CodexManifest };

    /** Emitted when file watcher is started/stopped */
    CODEX_WATCH_STARTED: { rootDir: string };
    CODEX_WATCH_STOPPED: { rootDir: string };

    /** Emitted when watcher sees file activity (before debounce reload triggers) */
    CODEX_FS_EVENT: { event: "add" | "change" | "unlink"; file: string };
};

export type CodexEventName = keyof CodexEventMap;

export type CodexListener<T extends CodexEventName> = (payload: CodexEventMap[T]) => void;

/**
 * Typed event bus for CodexRegistry state transitions
 *
 * Usage:
 *   const bus = new CodexEventBus();
 *   const unsubscribe = bus.on('CODEX_READY', ({manifest}) => {
 *     console.log(`Registry ready with ${manifest.count} codexes`);
 *   });
 */
export class CodexEventBus {
    private listeners = new Map<CodexEventName, Set<(payload: any) => void>>();

    /**
     * Subscribe to an event. Returns unsubscribe function.
     */
    on<T extends CodexEventName>(event: T, listener: CodexListener<T>): () => void {
        const set = this.listeners.get(event) ?? new Set();
        set.add(listener as any);
        this.listeners.set(event, set);

        // Return unsubscribe function
        return () => this.off(event, listener);
    }

    /**
     * Unsubscribe from an event
     */
    off<T extends CodexEventName>(event: T, listener: CodexListener<T>): void {
        const set = this.listeners.get(event);
        if (!set) return;
        set.delete(listener as any);
        if (set.size === 0) this.listeners.delete(event);
    }

    /**
     * Emit an event to all subscribed listeners
     */
    emit<T extends CodexEventName>(event: T, payload: CodexEventMap[T]): void {
        const set = this.listeners.get(event);
        if (!set) return;
        for (const fn of set) fn(payload);
    }

    /**
     * Clear all listeners
     */
    clear(): void {
        this.listeners.clear();
    }

    /**
     * Get listener count for an event (useful for testing/debugging)
     */
    listenerCount(event: CodexEventName): number {
        return this.listeners.get(event)?.size ?? 0;
    }
}
