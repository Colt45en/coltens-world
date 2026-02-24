import chokidar, { type FSWatcher } from "chokidar";
import fg from "fast-glob";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { CodexEventBus, type CodexLoadIssue, type CodexLoadResult } from "./events";
import {
    SystemCodexEntrySchema,
    canonicalJSONStringify,
    canonicalizeSystemCodexEntry,
    sha256Hex,
    type SystemCodexEntry,
} from "./index";
import { CodexManifestSchema, type CodexManifest, type CodexManifestEntry } from "./manifest";

export interface CodexRegistryOptions {
    rootDir: string;
    patterns?: string[] | undefined;
    ignore?: string[] | undefined;
    writeBackCanonical?: boolean | undefined;
    manifestPath?: string | undefined;
    strictReady?: boolean | undefined;
    watchDebounceMs?: number | undefined;
}

export type { CodexLoadIssue, CodexLoadResult };

/**
 * CodexRegistry: discover, validate, canonicalize, hash, and query system codex files
 *
 * Features:
 * - Watch mode: Auto-reload on file changes (debounced)
 * - Event bus: CODEX_READY, CODEX_INVALID, CODEX_MANIFEST_UPDATED, CODEX_FS_EVENT
 * - Strict mode: Blocks "ready" if any validation issues exist
 * - Deterministic: SHA256 hashing, sorted IDs, canonical JSON
 *
 * Usage (basic):
 *   const reg = new CodexRegistry({ rootDir: "codex", manifestPath: "codex.manifest.json" });
 *   await reg.load("boot");
 *   const swarm = reg.getOrThrow("swarm.core");
 *
 * Usage (with events):
 *   const reg = new CodexRegistry({ rootDir: "codex", strictReady: true });
 *   reg.events.on('CODEX_READY', ({ manifest }) => {
 *     console.log(`Ready with ${manifest.count} codexes`);
 *   });
 *   await reg.load("boot");
 *   await reg.watch();
 */
export class CodexRegistry {
    private byId = new Map<string, SystemCodexEntry>();
    private bySha = new Map<string, string>(); // sha -> id
    private fileById = new Map<string, string>(); // id -> file
    private manifest: CodexManifest | null = null;

    private watcher: FSWatcher | null = null;
    private reloadTimer: NodeJS.Timeout | null = null;
    private disposed = false;

    public readonly events: CodexEventBus;

    constructor(opts: CodexRegistryOptions, bus?: CodexEventBus) {
        this._opts = opts;
        this.events = bus ?? new CodexEventBus();
    }

    private readonly _opts: CodexRegistryOptions;

    /** Read-only snapshot of manifest (if loaded) */
    public getManifest(): CodexManifest | null {
        return this.manifest;
    }

    public has(id: string): boolean {
        return this.byId.has(id);
    }

    public get(id: string): SystemCodexEntry | undefined {
        return this.byId.get(id);
    }

    public getOrThrow(id: string): SystemCodexEntry {
        const v = this.byId.get(id);
        if (!v) throw new Error(`CodexRegistry: missing id "${id}".`);
        return v;
    }

    public listIds(): string[] {
        return [...this.byId.keys()].sort((a, b) => a.localeCompare(b));
    }

    public list(): SystemCodexEntry[] {
        return [...this.byId.values()].sort((a, b) => {
            if (a.id < b.id) return -1;
            if (a.id > b.id) return 1;
            return 0;
        });
    }

    public findByAgent(agentId: string): SystemCodexEntry[] {
        return this.list().filter((e) => e.agents.some((a) => a.id === agentId));
    }

    public findByTool(toolId: string): SystemCodexEntry[] {
        return this.list().filter((e) => e.tools.some((t) => t.id === toolId));
    }

    public findBySignal(signalId: string): SystemCodexEntry[] {
        return this.list().filter((e) => e.signals.some((s) => s.id === signalId));
    }

    public findByDataSource(sourceId: string): SystemCodexEntry[] {
        return this.list().filter((e) => e.data_sources.some((s) => s.id === sourceId));
    }

    public findByModel(modelId: string): SystemCodexEntry[] {
        return this.list().filter((e) => e.models.some((m) => m.id === modelId));
    }

    public findByLoop(loopId: string): SystemCodexEntry[] {
        return this.list().filter((e) => e.loops.some((l) => l.id === loopId));
    }

    public resolveFileForId(id: string): string | undefined {
        return this.fileById.get(id);
    }

    /**
     * Main entry: discover + validate + canonicalize + hash + build manifest
     * Returns CodexLoadResult with detailed issue tracking
     */
    public async load(reason: "boot" | "manual" | "fs_watch" = "manual"): Promise<CodexLoadResult> {
        if (this.disposed) throw new Error("CodexRegistry.load() called after dispose().");

        this.events.emit("CODEX_LOAD_START", { reason });

        this.byId.clear();
        this.bySha.clear();
        this.fileById.clear();
        this.manifest = null;

        const rootAbs = path.isAbsolute(this._opts.rootDir)
            ? this._opts.rootDir
            : path.resolve(process.cwd(), this._opts.rootDir);

        const patterns = this._opts.patterns?.length ? this._opts.patterns : ["**/*.codex.json"];
        const ignore = this._opts.ignore ?? ["**/node_modules/**", "**/.git/**"];

        // fast-glob discovers files efficiently
        const files = await fg(patterns, {
            cwd: rootAbs,
            ignore,
            dot: false,
            onlyFiles: true,
            unique: true,
            absolute: true,
            followSymbolicLinks: true,
        });

        const issues: CodexLoadIssue[] = [];
        const manifestEntries: CodexManifestEntry[] = [];

        // Load deterministically: sort paths before reading
        files.sort((a, b) => a.localeCompare(b));

        for (const fileAbs of files) {
            try {
                // Read + parse JSON using fs/promises (ESM friendly)
                const raw = await readFile(fileAbs, "utf8");
                const json = JSON.parse(raw) as unknown;

                const parsed = SystemCodexEntrySchema.parse(json);
                const canonical = canonicalizeSystemCodexEntry(parsed);
                const canonicalJson = canonicalJSONStringify(canonical);
                const sha256 = await sha256Hex(canonicalJson);

                // Prevent duplicate IDs across files
                if (this.byId.has(canonical.id)) {
                    throw new Error(
                        `Duplicate codex id "${canonical.id}" found.\nFirst: ${this.fileById.get(
                            canonical.id
                        )}\nSecond: ${fileAbs}`
                    );
                }

                // Prevent duplicate content hashes pointing to different IDs (helpful for detecting copies)
                const priorId = this.bySha.get(sha256);
                if (priorId && priorId !== canonical.id) {
                    throw new Error(
                        `Content hash collision: sha256 ${sha256} already used by id "${priorId}", cannot also assign to "${canonical.id}".`
                    );
                }

                this.byId.set(canonical.id, canonical);
                this.bySha.set(sha256, canonical.id);
                this.fileById.set(canonical.id, fileAbs);

                if (this._opts.writeBackCanonical) {
                    // Format: stable JSON string, newline at end
                    await writeFile(fileAbs, canonicalJson + "\n", "utf8");
                }

                manifestEntries.push({
                    id: canonical.id,
                    schema_version: canonical.schema_version,
                    name: canonical.name,
                    sha256,
                    source_path: path.relative(process.cwd(), fileAbs).replaceAll("\\", "/"),
                    updated_at_utc: canonical.updated_at_utc,
                });
            } catch (err) {
                issues.push({
                    file: path.relative(process.cwd(), fileAbs).replaceAll("\\", "/"),
                    error: err instanceof Error ? err.message : String(err),
                });
            }
        }

        // Build manifest deterministically (sorted by id)
        manifestEntries.sort((a, b) => {
            if (a.id < b.id) return -1;
            if (a.id > b.id) return 1;
            return 0;
        });

        const now = new Date().toISOString();
        const manifest: CodexManifest = {
            manifest_version: "1.0.0",
            generated_at_utc: now,
            root_dir: path.relative(process.cwd(), rootAbs).replaceAll("\\", "/"),
            count: manifestEntries.length,
            entries: manifestEntries,
        };

        // Validate manifest too (keeps it contract-safe)
        const validatedManifest = CodexManifestSchema.parse(manifest);
        this.manifest = validatedManifest;

        if (this._opts.manifestPath) {
            const outAbs = path.isAbsolute(this._opts.manifestPath)
                ? this._opts.manifestPath
                : path.resolve(process.cwd(), this._opts.manifestPath);
            const outJson = JSON.stringify(validatedManifest, null, 2) + "\n";
            await writeFile(outAbs, outJson, "utf8");
            this.events.emit("CODEX_MANIFEST_UPDATED", { manifest: validatedManifest });
        }

        const result: CodexLoadResult = {
            ok: issues.length === 0,
            issues,
            countLoaded: manifestEntries.length,
            manifest: validatedManifest,
        };

        this.events.emit("CODEX_LOAD_RESULT", { result });

        // Readiness policy:
        // - strictReady=true (default): only READY when ok
        // - strictReady=false: READY if we loaded anything, but still emit INVALID if issues exist
        const strictReady = this._opts.strictReady ?? true;

        if (issues.length > 0) {
            this.events.emit("CODEX_INVALID", { issues });
            if (strictReady) return result;
        }

        if (validatedManifest.entries.length > 0) {
            this.events.emit("CODEX_READY", { manifest: validatedManifest });
        } else if (!strictReady) {
            // In non-strict mode, "ready" with empty set is allowed (useful during initial boot)
            this.events.emit("CODEX_READY", { manifest: validatedManifest });
        }

        return result;
    }

    /**
     * Start file watching. Debounced reload on changes.
     * Emits CODEX_WATCH_STARTED, CODEX_FS_EVENT, CODEX_LOAD_RESULT events.
     */
    public async watch(): Promise<void> {
        if (this.disposed) throw new Error("CodexRegistry.watch() called after dispose().");
        if (this.watcher) return;

        const rootAbs = path.isAbsolute(this._opts.rootDir)
            ? this._opts.rootDir
            : path.resolve(process.cwd(), this._opts.rootDir);

        const patterns = this._opts.patterns?.length ? this._opts.patterns : ["**/*.codex.json"];
        const ignore = this._opts.ignore ?? ["**/node_modules/**", "**/.git/**"];
        const debounceMs = this._opts.watchDebounceMs ?? 150;

        // chokidar watches filesystem; we filter events ourselves
        this.watcher = chokidar.watch(rootAbs, {
            ignored: ignore.map((g) => path.join(rootAbs, g)),
            ignoreInitial: true,
            persistent: true,
        });

        const shouldReact = (fileAbs: string): boolean => {
            const rel = path.relative(rootAbs, fileAbs).replaceAll("\\", "/");
            // Accept if pattern is default or matches .codex.json
            if (patterns.some((p) => p.includes("*.codex.json") || p.includes("**/*.codex.json"))) {
                return rel.endsWith(".codex.json");
            }
            // fallback: accept if any pattern's tail matches (best effort)
            return patterns.some((p) => rel.endsWith(p.replaceAll("**/", "").replaceAll("*", "")));
        };

        const scheduleReload = () => {
            if (this.reloadTimer) clearTimeout(this.reloadTimer);
            this.reloadTimer = setTimeout(() => {
                this.reloadTimer = null;
                void this.load("fs_watch");
            }, debounceMs);
        };

        const onFs = (event: "add" | "change" | "unlink", fileAbs: string) => {
            if (!shouldReact(fileAbs)) return;
            const rel = path.relative(process.cwd(), fileAbs).replaceAll("\\", "/");
            this.events.emit("CODEX_FS_EVENT", { event, file: rel });
            scheduleReload();
        };

        this.watcher
            .on("add", (f) => onFs("add", f))
            .on("change", (f) => onFs("change", f))
            .on("unlink", (f) => onFs("unlink", f));

        this.events.emit("CODEX_WATCH_STARTED", { rootDir: rootAbs });
    }

    /**
     * Stop file watching
     */
    public async unwatch(): Promise<void> {
        if (!this.watcher) return;
        const rootAbs = path.isAbsolute(this._opts.rootDir)
            ? this._opts.rootDir
            : path.resolve(process.cwd(), this._opts.rootDir);

        await this.watcher.close();
        this.watcher = null;

        if (this.reloadTimer) {
            clearTimeout(this.reloadTimer);
            this.reloadTimer = null;
        }

        this.events.emit("CODEX_WATCH_STOPPED", { rootDir: rootAbs });
    }

    /**
     * Full cleanup: unwatch and clear all state
     */
    public async dispose(): Promise<void> {
        this.disposed = true;
        await this.unwatch();
        this.byId.clear();
        this.bySha.clear();
        this.fileById.clear();
        this.manifest = null;
        // do NOT clear event bus automatically; caller may keep it
    }
}
