import { z } from "zod";

/**
 * System Codex: versioned, validated description of a living system.
 * Hardened:
 * - strict schemas (no unknown keys)
 * - unique-id enforcement
 * - cross-reference validation
 * - deterministic canonicalization + sha256 snapshot hash
 */

export const SemVerSchema = z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, "Expected semver like 1.2.3");

export const IsoDateTimeSchema = z.string().datetime();

export const StableIdSchema = z
    .string()
    .min(3)
    .max(128)
    .regex(/^[a-z0-9][a-z0-9._:-]*$/i, "StableId must be URL/filename-safe.");

export const SeveritySchema = z.enum(["low", "medium", "high", "critical"]);

/** ---- R3F / Spatial Protocol ---- */

export const Vector3Schema = z.tuple([z.number(), z.number(), z.number()]);

export const SpatialNodeSchema = z
    .object({
        position: Vector3Schema.default([0, 0, 0]),
        rotation: Vector3Schema.default([0, 0, 0]),
        scale: Vector3Schema.default([1, 1, 1]),
        color: z.string().regex(/^#/, "Expect hex color").default("#ffffff"),
        shape: z
            .enum(["sphere", "box", "tetrahedron", "octahedron", "torus", "cloud"])
            .default("sphere"),
        opacity: z.number().min(0).max(1).default(1),
        wireframe: z.boolean().default(false),
        connections: z.array(StableIdSchema).default([]),
    })
    .strict();

export const TruthPolicySchema = z
    .object({
        observed: z.array(z.string()).default([]),
        interpreted: z.array(z.string()).default([]),
        assumed: z.array(z.string()).default([]),
    })
    .strict();

export const SemanticStatesSchema = z
    .object({
        solid_state: z.array(z.string()).default([]),
        liquid_state: z.array(z.string()).default([]),
        gas_state: z.array(z.string()).default([]),
        unseen_infrastructure: z.array(z.string()).default([]),
        reverse_reflection: z.array(z.string()).default([]),
    })
    .strict();

/** ---- Data ingestion & signals ---- */

export const DataSourceSchema = z
    .object({
        id: StableIdSchema,
        kind: z.enum([
            "news",
            "social",
            "markets",
            "internal_events",
            "docs",
            "manual",
            "other",
        ]),
        description: z.string().min(1),
        update_cadence: z.enum(["realtime", "hourly", "daily", "weekly", "adhoc"]),
        reliability: z.enum(["unknown", "low", "medium", "high"]).default("unknown"),
        constraints: z.array(z.string()).default([]),
        spatial: SpatialNodeSchema.optional(),
    })
    .strict();

export const SignalSchema = z
    .object({
        id: StableIdSchema,
        name: z.string().min(1),
        definition: z.string().min(1),
        kind: z.enum(["topic", "sentiment", "anomaly", "volume", "price", "custom"]),
        compute: z
            .object({
                method: z.string().min(1),
                parameters: z
                    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
                    .default({}),
            })
            .strict(),
        thresholds: z
            .array(
                z
                    .object({
                        name: z.string().min(1),
                        severity: SeveritySchema,
                        condition: z.string().min(1),
                    })
                    .strict()
            )
            .default([]),
        spatial: SpatialNodeSchema.optional(),
    })
    .strict();

/** ---- Models: LLM, Forecast, RL ---- */

export const ModelRefSchema = z
    .object({
        id: StableIdSchema,
        kind: z.enum(["llm", "forecast", "rl", "embedding", "classifier", "other"]),
        name: z.string().min(1),
        implementation: z.string().min(1),
        version: z.string().min(1).optional(),
        inputs: z.array(z.string()).default([]),
        outputs: z.array(z.string()).default([]),
        constraints: z.array(z.string()).default([]),
        spatial: SpatialNodeSchema.optional(),
    })
    .strict();

/** ---- Drift & evaluation ---- */

export const DriftDetectorSchema = z
    .object({
        id: StableIdSchema,
        kind: z.enum(["data_drift", "concept_drift", "behavior_drift", "custom"]),
        description: z.string().min(1),
        method: z.string().min(1),
        cadence: z.enum(["hourly", "daily", "weekly", "adhoc"]).default("daily"),
        alert_on: z
            .array(
                z
                    .object({
                        severity: SeveritySchema,
                        condition: z.string().min(1),
                        action: z.string().min(1),
                    })
                    .strict()
            )
            .default([]),
        spatial: SpatialNodeSchema.optional(),
    })
    .strict();

export const MetricSchema = z
    .object({
        id: StableIdSchema,
        name: z.string().min(1),
        kind: z.enum([
            "accuracy",
            "precision",
            "recall",
            "f1",
            "mae",
            "rmse",
            "roi",
            "latency",
            "custom",
        ]),
        definition: z.string().min(1),
        target: z.union([z.number(), z.string()]).optional(),
        direction: z
            .enum(["higher_is_better", "lower_is_better", "neutral"])
            .default("higher_is_better"),
    })
    .strict();

export const EvaluationPlanSchema = z
    .object({
        cadence: z
            .enum(["realtime", "daily", "weekly", "monthly", "adhoc"])
            .default("weekly"),
        metrics: z.array(MetricSchema).default([]),
        baselines: z.array(z.string()).default([]),
        datasets: z.array(z.string()).default([]),
        notes: z.array(z.string()).default([]),
    })
    .strict();

/** ---- Agents & orchestration ---- */

export const ToolSchema = z
    .object({
        id: StableIdSchema,
        name: z.string().min(1),
        description: z.string().min(1),
        safety_level: SeveritySchema.default("medium"),
        constraints: z.array(z.string()).default([]),
        spatial: SpatialNodeSchema.optional(),
    })
    .strict();

export const AgentRoleSchema = z
    .object({
        id: StableIdSchema,
        name: z.string().min(1),
        specialization: z.array(z.string()).default([]),
        responsibilities: z.array(z.string()).default([]),
        inputs: z.array(z.string()).default([]),
        outputs: z.array(z.string()).default([]),
        tools_allowed: z.array(StableIdSchema).default([]),
        guardrails: z.array(z.string()).default([]),
        failure_modes: z.array(z.string()).default([]),
        success_criteria: z.array(z.string()).default([]),
        spatial: SpatialNodeSchema.optional(),
    })
    .strict();

export const OrchestrationSchema = z
    .object({
        mode: z.enum(["code_driven", "llm_driven", "hybrid"]).default("hybrid"),
        routing: z
            .object({
                strategy: z
                    .enum(["fixed_pipeline", "dynamic_router", "vote", "supervisor"])
                    .default("supervisor"),
                description: z.string().min(1),
            })
            .strict(),
        voting: z
            .object({
                enabled: z.boolean().default(false),
                method: z
                    .enum(["majority", "weighted_majority", "borda", "custom"])
                    .default("weighted_majority"),
                weights: z.record(z.string(), z.number()).default({}),
                tie_breaker: z
                    .enum(["supervisor", "highest_confidence", "random_seeded"])
                    .default("supervisor"),
            })
            .strict()
            .default({
                enabled: false,
                method: "weighted_majority",
                weights: {},
                tie_breaker: "supervisor",
            }),
        resilience: z
            .object({
                retries: z.number().int().min(0).max(10).default(2),
                fallback_agents: z.array(StableIdSchema).default([]),
                circuit_breaker: z.boolean().default(true),
                notes: z.array(z.string()).default([]),
            })
            .strict(),
    })
    .strict();

/** ---- RHLO: reinforcement / self-optimization loop ---- */

export const RewardSignalSchema = z
    .object({
        id: StableIdSchema,
        name: z.string().min(1),
        description: z.string().min(1),
        source: z.enum(["behavior", "manual", "ground_truth", "proxy", "custom"]),
        compute: z
            .object({
                method: z.string().min(1),
                parameters: z
                    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
                    .default({}),
            })
            .strict(),
        risks: z.array(z.string()).default([]),
    })
    .strict();

export const RHLORulesSchema = z
    .object({
        optimize_weights: z.boolean().default(true),
        weight_update_cadence: z
            .enum(["realtime", "daily", "weekly", "adhoc"])
            .default("daily"),
        constraints: z.array(z.string()).default([
            "avoid reward hacking",
            "prevent catastrophic forgetting",
            "keep diversity of strategies",
        ]),
        safety: z
            .object({
                human_override: z.boolean().default(true),
                high_stakes_gate: z.boolean().default(true),
                audit_log_required: z.boolean().default(true),
            })
            .strict(),
    })
    .strict();

export const SelfOptimizationLoopSchema = z
    .object({
        id: StableIdSchema,
        name: z.string().min(1),
        description: z.string().min(1),
        steps: z.array(z.string()).min(3),
        reward_signals: z.array(RewardSignalSchema).default([]),
        rules: RHLORulesSchema,
        evaluation: EvaluationPlanSchema,
        drift_detectors: z.array(DriftDetectorSchema).default([]),
        spatial: SpatialNodeSchema.optional(),
    })
    .strict();

/** ---- Determinism & provenance ---- */

export const DeterminismContractSchema = z
    .object({
        deterministic_core: z.boolean().default(true),
        fences: z
            .array(
                z.enum([
                    "seeded_rng",
                    "stable_ordering",
                    "fixed_timestep",
                    "canonical_serialization",
                    "replay_log",
                ])
            )
            .default([
                "seeded_rng",
                "stable_ordering",
                "fixed_timestep",
                "canonical_serialization",
                "replay_log",
            ]),
        snapshot_hash: z.boolean().default(true),
        replay_log: z.boolean().default(true),
        notes: z.array(z.string()).default([]),
    })
    .strict();

/** ---- Exports ---- */

export const ExportArtifactSchema = z
    .object({
        id: StableIdSchema,
        kind: z.enum([
            "weekly_summary",
            "forecast_heatmap",
            "insight_capsule",
            "report",
            "dashboard",
            "other",
        ]),
        description: z.string().min(1),
        format: z
            .enum(["md", "json", "csv", "png", "html", "pdf", "other"])
            .default("json"),
        schedule: z.enum(["weekly", "daily", "adhoc"]).default("weekly"),
        consumers: z.array(z.string()).default([]),
    })
    .strict();

/** ---- Scene Configuration (R3F Global) ---- */

export const SceneConfigSchema = z
    .object({
        background_color: z.string().default("#0a0a0a"),
        ambient_light_intensity: z.number().default(0.5),
        fog_density: z.number().default(0.0025),
        grid_visible: z.boolean().default(true),
        orbit_controls: z.boolean().default(true),
        camera_start: Vector3Schema.default([10, 10, 10]),
    })
    .strict();

/** ---- Helpers: uniqueness & canonicalization ---- */

function assertUniqueIds<T extends { id: string }>(
    items: T[],
    label: string,
    ctx: z.RefinementCtx
) {
    const seen = new Set<string>();
    for (let i = 0; i < items.length; i++) {
        const id = items[i]?.id;
        if (!id) continue;
        if (seen.has(id)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Duplicate id "${id}" in ${label}.`,
                path: [label, i, "id"],
            });
        }
        seen.add(id);
    }
}

function toIdSet(items: Array<{ id: string }>): Set<string> {
    return new Set(items.map((x) => x.id));
}

function stableSortById<T extends { id: string }>(arr: T[]): T[] {
    return [...arr].sort((a, b) => {
        if (a.id < b.id) return -1;
        if (a.id > b.id) return 1;
        return 0;
    });
}

function sortStringArray(arr: string[]): string[] {
    return [...arr].sort((a, b) => a.localeCompare(b));
}

/** Canonical JSON stringify: deterministic key ordering, deterministic arrays. */
export function canonicalJSONStringify(value: unknown): string {
    const seen = new WeakSet<object>();

    const normalize = (v: unknown): unknown => {
        if (v === null) return null;
        if (typeof v !== "object") return v;

        if (Array.isArray(v)) return v.map(normalize);

        const obj = v as Record<string, unknown>;
        if (seen.has(obj)) throw new Error("Cannot canonicalize cyclic structures.");
        seen.add(obj);

        const keys = Object.keys(obj).sort((a, b) => a.localeCompare(b));
        const out: Record<string, unknown> = {};
        for (const k of keys) {
            const val = obj[k];
            if (val === undefined) continue;
            out[k] = normalize(val);
        }
        return out;
    };

    return JSON.stringify(normalize(value));
}

function hexFromBytes(bytes: Uint8Array): string {
    let s = "";
    for (const b of bytes) {
        s += b.toString(16).padStart(2, "0");
    }
    return s;
}

/** sha256, works in browser or Node. */
export async function sha256Hex(input: string): Promise<string> {
    const g = globalThis as unknown as {
        crypto?: { subtle?: SubtleCrypto };
        TextEncoder?: typeof TextEncoder;
    };

    const encoder = g.TextEncoder ? new g.TextEncoder() : new TextEncoder();
    const data = encoder.encode(input);

    if (g.crypto?.subtle?.digest) {
        const digest = await g.crypto.subtle.digest("SHA-256", data);
        return hexFromBytes(new Uint8Array(digest));
    }

    const nodeCrypto = await import("node:crypto");
    const h = nodeCrypto.createHash("sha256");
    h.update(Buffer.from(data));
    return h.digest("hex");
}

/** ---- Top-level SystemCodexEntry ---- */

export const SystemCodexEntrySchemaBase = z
    .object({
        schema_version: SemVerSchema,
        id: StableIdSchema,
        name: z.string().min(1),
        created_at_utc: IsoDateTimeSchema,
        updated_at_utc: IsoDateTimeSchema,

        truth_policy: TruthPolicySchema.default({
            observed: [],
            interpreted: [],
            assumed: [],
        }),
        semantic_states: SemanticStatesSchema.default({
            solid_state: [],
            liquid_state: [],
            gas_state: [],
            unseen_infrastructure: [],
            reverse_reflection: [],
        }),

        visualization: SceneConfigSchema.optional(),

        north_star: z.string().min(1),
        objectives: z.array(z.string()).default([]),
        constraints: z.array(z.string()).default([]),

        data_sources: z.array(DataSourceSchema).default([]),
        signals: z.array(SignalSchema).default([]),

        tools: z.array(ToolSchema).default([]),
        agents: z.array(AgentRoleSchema).min(1),

        orchestration: OrchestrationSchema,

        models: z.array(ModelRefSchema).default([]),
        loops: z.array(SelfOptimizationLoopSchema).default([]),

        determinism: DeterminismContractSchema.default({}),

        exports: z.array(ExportArtifactSchema).default([]),

        failure_modes: z.array(z.string()).default([]),
        guardrails: z.array(z.string()).default([]),

        evolution_chains: z
            .array(
                z
                    .object({
                        id: StableIdSchema,
                        name: z.string().min(1),
                        chain: z.array(z.string()).min(2),
                        spatial: SpatialNodeSchema.optional(),
                    })
                    .strict()
            )
            .default([]),
    })
    .strict();

export const SystemCodexEntrySchema = SystemCodexEntrySchemaBase.superRefine(
    (v: any, ctx: z.RefinementCtx) => {
        assertUniqueIds(v.data_sources, "data_sources", ctx);
        assertUniqueIds(v.signals, "signals", ctx);
        assertUniqueIds(v.tools, "tools", ctx);
        assertUniqueIds(v.agents, "agents", ctx);
        assertUniqueIds(v.models, "models", ctx);
        assertUniqueIds(v.loops, "loops", ctx);
        assertUniqueIds(v.exports, "exports", ctx);
        assertUniqueIds(v.evolution_chains, "evolution_chains", ctx);

        const toolIds = toIdSet(v.tools);
        v.agents.forEach((a: any, ai: number) => {
            a.tools_allowed.forEach((tid: any, ti: number) => {
                if (!toolIds.has(tid)) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: `agents[${ai}].tools_allowed[${ti}] references unknown tool id "${tid}".`,
                        path: ["agents", ai, "tools_allowed", ti],
                    });
                }
            });
        });

        const registry = new Set<string>([
            ...v.data_sources.map((x: any) => x.id),
            ...v.signals.map((x: any) => x.id),
            ...v.tools.map((x: any) => x.id),
            ...v.agents.map((x: any) => x.id),
            ...v.models.map((x: any) => x.id),
            ...v.loops.map((x: any) => x.id),
            ...v.exports.map((x: any) => x.id),
            ...v.evolution_chains.map((x: any) => x.id),
            v.id,
        ]);

        const checkSpatial = (
            spatial: { connections: string[] } | undefined,
            path: (string | number)[]
        ) => {
            if (!spatial) return;
            spatial.connections.forEach((cid, i) => {
                if (!registry.has(cid)) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: `Spatial connection references unknown id "${cid}".`,
                        path: [...path, "connections", i],
                    });
                }
            });
        };

        v.data_sources.forEach((x: any, i: number) =>
            checkSpatial(x.spatial, ["data_sources", i, "spatial"])
        );
        v.signals.forEach((x: any, i: number) =>
            checkSpatial(x.spatial, ["signals", i, "spatial"])
        );
        v.tools.forEach((x: any, i: number) =>
            checkSpatial(x.spatial, ["tools", i, "spatial"])
        );
        v.agents.forEach((x: any, i: number) =>
            checkSpatial(x.spatial, ["agents", i, "spatial"])
        );
        v.models.forEach((x: any, i: number) =>
            checkSpatial(x.spatial, ["models", i, "spatial"])
        );
        v.loops.forEach((x: any, i: number) =>
            checkSpatial(x.spatial, ["loops", i, "spatial"])
        );
        v.evolution_chains.forEach((x: any, i: number) =>
            checkSpatial(x.spatial, ["evolution_chains", i, "spatial"])
        );
    }
);

export type SystemCodexEntry = z.infer<typeof SystemCodexEntrySchema>;

export function parseSystemCodexEntry(input: unknown): SystemCodexEntry {
    return SystemCodexEntrySchema.parse(input);
}

/** Deterministic normalization for serialization/diffing. */
export function canonicalizeSystemCodexEntry(
    entry: SystemCodexEntry
): SystemCodexEntry {
    const sortSpatial = (s: z.infer<typeof SpatialNodeSchema> | undefined) => {
        if (!s) return undefined;
        return { ...s, connections: sortStringArray(s.connections) };
    };

    return {
        ...entry,
        data_sources: stableSortById(entry.data_sources).map((x: any) => ({
            ...x,
            spatial: sortSpatial(x.spatial),
        })),
        signals: stableSortById(entry.signals).map((x: any) => ({
            ...x,
            spatial: sortSpatial(x.spatial),
            thresholds: [...x.thresholds].sort((a: any, b: any) => {
                if (a.severity < b.severity) return -1;
                if (a.severity > b.severity) return 1;
                return a.name.localeCompare(b.name);
            }),
        })),
        tools: stableSortById(entry.tools).map((x: any) => ({
            ...x,
            spatial: sortSpatial(x.spatial),
        })),
        agents: stableSortById(entry.agents).map((x: any) => ({
            ...x,
            tools_allowed: sortStringArray(x.tools_allowed),
            spatial: sortSpatial(x.spatial),
        })),
        models: stableSortById(entry.models).map((x) => ({
            ...x,
            spatial: sortSpatial(x.spatial),
        })),
        loops: stableSortById(entry.loops).map((x) => ({
            ...x,
            spatial: sortSpatial(x.spatial),
        })),
        exports: stableSortById(entry.exports),
        evolution_chains: stableSortById(entry.evolution_chains).map((x) => ({
            ...x,
            chain: [...x.chain],
            spatial: sortSpatial(x.spatial),
        })),
    };
}

/** Produce canonical JSON + sha256 snapshot hash. */
export async function snapshotSystemCodexEntry(
    entry: SystemCodexEntry
): Promise<{
    canonical: SystemCodexEntry;
    canonical_json: string;
    sha256: string;
}> {
    const canonical = canonicalizeSystemCodexEntry(entry);
    const canonical_json = canonicalJSONStringify(canonical);
    const sha256 = await sha256Hex(canonical_json);
    return { canonical, canonical_json, sha256 };
}

// Export registry, manifest, and event bus types/classes
export * from "./events";
export * from "./manifest";
export * from "./registry";
