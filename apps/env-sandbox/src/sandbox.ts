import { z } from "zod";
import { appendAudit } from "./audit";
import { type EnvCodex, EnvCodexSchema, parseTypedValue } from "./contracts";
import { enforceKeyPolicy } from "./policy";
import { readJsonFile, writeJsonFile } from "./storage";
import {
    type EnvMap,
    EnvMapSchema,
    KeySchema,
    type LayerName,
    LayerNameSchema,
    type RecursiveCreationCodex,
    RecursiveCreationCodexSchema,
    type SandboxState,
    SandboxStateSchema
} from "./types";

function nowIso(): string {
    return new Date().toISOString();
}

function deepClone<T>(v: T): T {
    return structuredClone(v);
}

type SandboxPersisted = SandboxState & {
    codex?: EnvCodex; // Env Codex Contract (governance)
};

const SandboxPersistedSchema = SandboxStateSchema.extend({
    codex: EnvCodexSchema.optional()
});

export class EnvSandbox {
    private state: SandboxState;
    private codex: EnvCodex;
    private readonly stateFile: string;

    constructor(stateFile: string) {
        this.stateFile = stateFile;
        const loaded = this.loadOrInit();
        this.state = loaded.state;
        this.codex = loaded.codex;
    }

    private loadOrInit(): { state: SandboxState; codex: EnvCodex } {
        const raw = readJsonFile<unknown>(this.stateFile);
        if (!raw) {
            const initState = SandboxStateSchema.parse({
                meta: { created_at: nowIso() },
                activeLayer: "material",
                layers: { prime: {}, subtle: {}, material: {}, "data-plane": {} },
                profiles: {},
                snapshots: {}
            });

            const initCodex = EnvCodexSchema.parse({
                meta: { title: "Env Codex", version: "1.0.0", created_at: nowIso() },
                gates: {
                    // sane defaults
                    production_lock: false,
                    resource_scarcity: false,
                    observer_effect: false
                },
                registry: [
                    {
                        key: "NODE_ENV",
                        kind: "string",
                        description: "Node environment mode.",
                        default: "development",
                        allowed_layers: ["material"]
                    },
                    {
                        key: "LOG_LEVEL",
                        kind: "string",
                        description: "Logging verbosity (debug/info/warn/error/trace).",
                        default: "info",
                        allowed_layers: ["subtle", "material"]
                    }
                ],
                policy: {
                    fail_on_unknown_key: true,
                    enforce_gates: true,
                    production_locked_prefixes: ["PROD_", "SECRET_", "TOKEN_", "KEY_"]
                }
            });

            writeJsonFile(this.stateFile, { ...initState, codex: initCodex });
            return { state: initState, codex: initCodex };
        }

        const parsed = SandboxPersistedSchema.parse(raw);
        return {
            state: parsed,
            codex: parsed.codex ?? EnvCodexSchema.parse({ meta: { created_at: nowIso() } })
        };
    }

    private persist(): void {
        writeJsonFile(this.stateFile, { ...this.state, codex: this.codex });
    }

    /** --- Codex (Contract) --- */

    getEnvCodex(): EnvCodex {
        return deepClone(this.codex);
    }

    setGate(name: string, value: boolean): void {
        const gate = z.string().min(1).max(64).parse(name);
        this.codex.gates[gate] = z.boolean().parse(value);
        this.persist();
    }

    /** --- Base sandbox --- */

    getActiveLayer(): LayerName {
        return this.state.activeLayer;
    }

    setActiveLayer(layer: LayerName): void {
        this.state.activeLayer = LayerNameSchema.parse(layer);
        this.persist();
    }

    listLayers(): LayerName[] {
        return ["prime", "subtle", "material", "data-plane"];
    }

    getLayerEnv(layer?: LayerName): EnvMap {
        const l = layer ?? this.state.activeLayer;
        const env = this.state.layers[l];
        if (!env) throw new Error(`Layer ${l} not found`);
        return deepClone(env);
    }

    getEffectiveEnv(): Record<string, string> {
        const merged: Record<string, string> = {};
        const order: LayerName[] = ["prime", "subtle", "material", "data-plane"];
        for (const layer of order) {
            const layerEnv = this.state.layers[layer];
            if (layerEnv) {
                for (const [k, v] of Object.entries(layerEnv)) {
                    merged[k] = String(v);
                }
            }
        }
        return merged;
    }

    /**
     * Typed + governed setter.
     * - If key exists in Env Codex registry: parse according to spec.kind
     * - Enforce key policy + required gates
     * - Optionally allow unknown keys if failOnUnknownOverride=false
     */
    setVarTyped(args: {
        key: string;
        raw: string;
        layer?: LayerName;
        actor?: string;
        note?: string;
        failOnUnknownOverride?: boolean;
    }): void {
        const key = KeySchema.parse(args.key);
        const layer = args.layer ?? this.state.activeLayer;

        const { spec } = enforceKeyPolicy({
            ctx: { codex: this.codex, activeGates: this.codex.gates },
            key,
            layer,
            ...(args.failOnUnknownOverride === undefined ? {} : { failOnUnknownOverride: Boolean(args.failOnUnknownOverride) })
        });

        // Determine kind and parse
        const value = spec
            ? parseTypedValue(spec.kind, args.raw)
            : z.string().parse(args.raw); // unknown keys become strings if allowed

        // Ensure layer exists
        this.state.layers[layer] ??= {};
        this.state.layers[layer][key] = value;
        this.persist();

        const layerData = this.state.layers[layer];
        if (layerData) {
            appendAudit(this.stateFile, {
                type: "SET",
                layer,
                key,
                value: String(value),
                ...(args.actor ? { actor: args.actor } : {}),
                ...(args.note ? { note: args.note } : {})
            } as any); // Cast to handle exactOptionalPropertyTypes
        }
    }

    unsetVar(args: { key: string; layer?: LayerName; actor?: string; note?: string }): void {
        const key = KeySchema.parse(args.key);
        const layer = args.layer ?? this.state.activeLayer;
        if (this.state.layers[layer]) {
            delete this.state.layers[layer][key];
            this.persist();

            appendAudit(this.stateFile, {
                type: "UNSET",
                layer,
                key,
                ...(args.actor ? { actor: args.actor } : {}),
                ...(args.note ? { note: args.note } : {})
            } as any); // Cast to handle exactOptionalPropertyTypes
        }
    }

    clearLayer(args?: { layer?: LayerName; actor?: string; note?: string }): void {
        const layer = args?.layer ?? this.state.activeLayer;
        this.state.layers[layer] = EnvMapSchema.parse({});
        this.persist();

        appendAudit(this.stateFile, {
            type: "CLEAR_LAYER",
            layer,
            ...(args?.actor ? { actor: args.actor } : {}),
            ...(args?.note ? { note: args.note } : {})
        });
    }

    /** Profiles */
    defineProfile(name: string, env: Record<string, string>, layer?: LayerName): void {
        const profileName = z.string().min(1).max(64).parse(name);
        const parsedEnv = EnvMapSchema.parse(env);
        const parsedLayer = layer ? LayerNameSchema.parse(layer) : undefined;

        this.state.profiles[profileName] = { layer: parsedLayer, env: parsedEnv };
        this.persist();
    }

    listProfiles(): string[] {
        return Object.keys(this.state.profiles).sort((a, b) => a.localeCompare(b));
    }

    applyProfile(args: { name: string; targetLayer?: LayerName; actor?: string; note?: string }): void {
        const profile = this.state.profiles[args.name];
        if (!profile) throw new Error(`Unknown profile: ${args.name}`);

        const layer = args.targetLayer ?? profile.layer ?? this.state.activeLayer;
        for (const [k, v] of Object.entries(profile.env)) {
            // Profile apply uses typed setter with unknowns governed by codex policy
            this.setVarTyped({ key: k, raw: String(v), layer, ...(args.actor ? { actor: args.actor } : {}), ...(args.note ? { note: args.note } : {}) });
        }

        appendAudit(this.stateFile, {
            type: "APPLY_PROFILE",
            layer,
            profile: args.name,
            ...(args.actor ? { actor: args.actor } : {}),
            ...(args.note ? { note: args.note } : {})
        } as any); // Cast to handle exactOptionalPropertyTypes
    }

    /** Snapshots */
    snapshot(name: string, note?: string): void {
        const snapName = z.string().min(1).max(64).parse(name);
        this.state.snapshots[snapName] = {
            created_at: nowIso(),
            note,
            state: deepClone({ ...this.state, codex: this.codex })
        };
        this.persist();
    }

    listSnapshots(): { name: string; created_at: string; note?: string }[] {
        return Object.entries(this.state.snapshots)
            .map(([name, s]) => ({ name, created_at: s.created_at, ...(s.note ? { note: s.note } : {}) }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    restore(name: string): void {
        const snap = this.state.snapshots[name];
        if (!snap) throw new Error(`Unknown snapshot: ${name}`);
        const restored = SandboxPersistedSchema.parse(snap.state);

        // Keep snapshots
        restored.snapshots = this.state.snapshots;

        this.state = restored;
        this.codex = restored.codex ?? this.codex;
        this.persist();
    }

    diffSnapshot(name: string): {
        added: Record<string, string>;
        removed: Record<string, string>;
        changed: Record<string, { from: string; to: string }>;
    } {
        const snap = this.state.snapshots[name];
        if (!snap) throw new Error(`Unknown snapshot: ${name}`);

        const snapState = SandboxPersistedSchema.parse(snap.state);
        const a = snapState.layers;
        const b = this.state.layers;

        const flatten = (layers: typeof a) => {
            const merged: Record<string, string> = {};
            (["prime", "subtle", "material", "data-plane"] as const).forEach((l) => Object.assign(merged, layers[l]));
            return merged;
        };

        const A = flatten(a);
        const B = flatten(b);

        const added: Record<string, string> = {};
        const removed: Record<string, string> = {};
        const changed: Record<string, { from: string; to: string }> = {};

        const keys = new Set([...Object.keys(A), ...Object.keys(B)]);
        for (const k of keys) {
            const av = A[k];
            const bv = B[k];
            if (av === undefined && bv !== undefined) added[k] = String(bv);
            else if (av !== undefined && bv === undefined) removed[k] = String(av);
            else if (av !== undefined && bv !== undefined && String(av) !== String(bv)) changed[k] = { from: String(av), to: String(bv) };
        }

        return { added, removed, changed };
    }

    /** Recursive Creation Codex binder (still supported) */
    bindRecursiveCreationCodex(args: {
        codexJson: unknown;
        layer?: LayerName;
        actor?: string;
        note?: string;
    }): { title: string; version: string; created: string; agents: number } {
        const codex: RecursiveCreationCodex = RecursiveCreationCodexSchema.parse(args.codexJson);
        const layer = args.layer ?? this.state.activeLayer;

        const agents = codex.orchestration?.agents ?? [];
        const layerEnv = this.state.layers[layer];
        if (layerEnv) {
            layerEnv["CODEX_TITLE"] = codex.meta.title;
            layerEnv["CODEX_VERSION"] = codex.meta.version;
            layerEnv["CODEX_CREATED"] = codex.meta.created_timestamp;
            layerEnv["CODEX_AGENT_COUNT"] = String(agents.length);
        }

        const roles = codex.philosophical_framework?.roles ?? [];
        if (roles.length && layerEnv) layerEnv["CODEX_ROLES"] = roles.join(",");

        const forces = codex.metaphysical_cosmology?.forces ?? [];
        if (forces?.length && layerEnv) layerEnv["CODEX_FORCES"] = forces.join(",");

        this.persist();

        appendAudit(this.stateFile, {
            type: "BIND_CODEX",
            layer,
            codex_title: codex.meta.title,
            codex_version: codex.meta.version,
            ...(args.actor ? { actor: args.actor } : {}),
            ...(args.note ? { note: args.note } : {})
        } as any); // Cast to handle type definition mismatch

        return {
            title: codex.meta.title,
            version: codex.meta.version,
            created: codex.meta.created_timestamp,
            agents: agents.length
        };
    }
}
function structuredClone<T>(v: T): T {
  throw new Error("Function not implemented.");
}
