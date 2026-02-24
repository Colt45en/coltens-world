/**
 * Unified Engine Envelope (UEE-1) Schema
 *
 * Domain-specific task contract that lives inside BusEnvelope payload.
 * Validated structurally by this schema; semantic validation lives in @we/codex.
 *
 * Architecture:
 * - Transport: BusEnvelope (routing, correlation, auth, retry)
 * - Domain: UEE-1 (task contract, inputs, outputs, audit)
 *
 * Forward compatibility: task.type allows known enum OR custom string (^[a-z][a-z0-9_]*$)
 * This lets adding new task types without breaking transport.
 */

import { z } from "zod";

// ============================================================================
// Base Types
// ============================================================================

/** Standard semantic versioning */
export const SemanticVersionSchema = z.string().regex(/^\d+\.\d+\.\d+$/);

/** Task type: known enum + escape hatch for forward compat */
const KnownTaskType = z.enum(["lexicon_op", "hce_run", "scene", "analyze_sentence", "brain_control", "brain_train"]);
const CustomTaskType = z.string().regex(/^[a-z][a-z0-9_]*$/).refine(
    (v) => !["lexicon_op", "hce_run", "scene", "analyze_sentence", "brain_control", "brain_train"].includes(v),
    { message: "Use enum for known task types" }
);

export const TaskTypeSchema = z.union([KnownTaskType, CustomTaskType]);
export type TaskType = z.infer<typeof TaskTypeSchema>;

/** Execution mode */
export const TaskModeSchema = z.enum(["generate", "apply", "analyze"]);
export type TaskMode = z.infer<typeof TaskModeSchema>;

/** Execution status */
export const TaskStatusSchema = z.enum(["ok", "error"]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

/** Detail level */
export const DetailLevelSchema = z.enum(["low", "medium", "high"]);
export type DetailLevel = z.infer<typeof DetailLevelSchema>;

/** Semantic layers */
export const LayerSchema = z.enum(["mind", "system", "reality"]);
export type Layer = z.infer<typeof LayerSchema>;

// ============================================================================
// Contract & Task
// ============================================================================

/**
 * Contract: identifies this as UEE-1.0.0 (or later versioned variant)
 */
export const ContractSchema = z.object({
    name: z.literal("UnifiedEngineEnvelope"),
    version: SemanticVersionSchema,
});
export type Contract = z.infer<typeof ContractSchema>;

/**
 * Task: routing + execution metadata
 */
export const TaskSchema = z.object({
    type: TaskTypeSchema,
    mode: TaskModeSchema,
    id: z.string().min(1),
    status: TaskStatusSchema.optional(),
});
export type Task = z.infer<typeof TaskSchema>;

// ============================================================================
// Context (Optional Reference Data)
// ============================================================================

export const ContextSchema = z.object({
    pov: z.string().nullable().optional(),
    world: z.record(z.unknown()).nullable().optional(),
    story_state: z.record(z.unknown()).nullable().optional(),
    lexicon_entry: z.record(z.unknown()).nullable().optional(),
});
export type Context = z.infer<typeof ContextSchema>;

// ============================================================================
// Inputs
// ============================================================================

const StringArraySchema = z.array(z.string()).default([]);

/**
 * Lexicon Operation Input
 * - term: the lexicon concept being operated on
 * - artifact: code, definition, constraint, etc.
 * - objective: what we want to achieve
 */
export const LexiconOpInputSchema = z.object({
    term: z.string().min(1),
    artifact: z.union([z.string(), z.record(z.unknown()), z.array(z.unknown())]),
    objective: z.string().min(1),
    constraints: StringArraySchema,
    metric: z.string().nullable().default(null),
    baseline: z.string().nullable().default(null),
    acceptance_threshold: z.string().nullable().default(null),
    tradeoffs: StringArraySchema,
    invariants: StringArraySchema,
    format: z.string().default("bullets+diff"),
    bottlenecks: StringArraySchema,
    steps_count: z.number().int().min(1).max(200).nullable().default(null),
});
export type LexiconOpInput = z.infer<typeof LexiconOpInputSchema>;

/**
 * HCE (Hierarchical-Contextual Expansion) Run Input
 * - topic: subject to expand
 * - observations/assumptions: constraints on expansion
 * - roles_enabled: which analytical personas participate
 */
export const HceRunInputSchema = z.object({
    topic: z.string().min(1),
    observations: StringArraySchema,
    assumptions: StringArraySchema,
    constraints: StringArraySchema,
    metrics: StringArraySchema,
    roles_enabled: z
        .array(z.enum(["inner_orchestrator", "avangelry_analyst", "fractal_analyst"]))
        .default(["inner_orchestrator", "avangelry_analyst", "fractal_analyst"]),
});
export type HceRunInput = z.infer<typeof HceRunInputSchema>;

/**
 * Scene Generation Input
 * - scene_brief: narrative + staging constraints
 * - controls: localized control overrides
 */
export const SceneBriefSchema = z
    .object({
        pov: z.string(),
        goal: z.string(),
        stakes: z.string(),
        setting: z.string(),
        constraints: StringArraySchema,
        style_notes: StringArraySchema,
    })
    .partial();

export const SceneInputSchema = z.object({
    scene_brief: SceneBriefSchema.nullable().optional(),
    controls: z.record(z.unknown()).nullable().optional(),
});
export type SceneInput = z.infer<typeof SceneInputSchema>;

/**
 * Sentence Analysis Input
 */
export const AnalyzeSentenceInputSchema = z.object({
    sentence: z.string().min(1).nullable().optional(),
});
export type AnalyzeSentenceInput = z.infer<typeof AnalyzeSentenceInputSchema>;

/**
 * Brain Control Input
 * - agentId: which agent to control
 * - sensors: current game state observations
 * - goals: optimization targets
 */
export const BrainControlInputSchema = z.object({
    agentId: z.string().min(1),
    sensors: z.object({
        position: z.object({ x: z.number(), y: z.number(), z: z.number() }),
        velocity: z.object({ x: z.number(), y: z.number(), z: z.number() }),
        health: z.number().min(0).max(1),
        energy: z.number().min(0).max(1),
        nearbyEntitiesDistance: z.array(z.number()).max(10),
        nearbyEntitiesHealth: z.array(z.number()).max(10),
    }).partial(),
    goals: z.array(z.object({
        type: z.enum(["avoid", "chase", "collect", "survive", "explore", "custom"]),
        weight: z.number().positive(),
    })).optional(),
});
export type BrainControlInput = z.infer<typeof BrainControlInputSchema>;

/**
 * Brain Training Input
 * - population_size: agents to evolve
 * - generations: training iterations
 * - fitness_fn: task to optimize (e.g., "survive", "navigate")
 * - mutation_config: genetic algorithm parameters
 */
export const BrainTrainInputSchema = z.object({
    populationSize: z.number().int().min(10).max(1000),
    generations: z.number().int().min(1).max(10000),
    fitnessFunction: z.enum(["survive", "collect", "navigate", "explore", "custom"]),
    mutationRate: z.number().min(0).max(1),
    mutationStrength: z.number().positive(),
    elitism: z.number().int().min(0).max(100),
});
export type BrainTrainInput = z.infer<typeof BrainTrainInputSchema>;

/**
 * Combined Inputs: all task types, but only relevant one is populated
 * (conditional validation in UEE level)
 */
export const InputsSchema = z
    .object({
        lexicon_op: LexiconOpInputSchema.optional(),
        hce_run: HceRunInputSchema.optional(),
        scene: SceneInputSchema.optional(),
        analyze_sentence: AnalyzeSentenceInputSchema.optional(),
        brain_control: BrainControlInputSchema.optional(),
        brain_train: BrainTrainInputSchema.optional(),
    })
    .strict();
export type Inputs = z.infer<typeof InputsSchema>;

// ============================================================================
// Controls
// ============================================================================

export const ReturnConfigSchema = z.object({
    include_prose: z.boolean(),
    include_json: z.boolean(),
    include_audit: z.boolean(),
    include_state_delta: z.boolean(),
});
export type ReturnConfig = z.infer<typeof ReturnConfigSchema>;

export const ControlsSchema = z
    .object({
        use_connectors: z.boolean(),
        max_words: z.number().int().min(1).max(10000),
        detail_level: DetailLevelSchema,
        layers: z.array(LayerSchema).optional(),
        return: ReturnConfigSchema,
    })
    .strict();
export type Controls = z.infer<typeof ControlsSchema>;

// ============================================================================
// Outputs (keyed by task type, all optional)
// ============================================================================

export const LexiconOpActionSchema = z.object({
    step: z.number().int().min(1),
    do: z.string(),
    why: z.string(),
    risk: z.string(),
    speculative: z.boolean(),
});

export const LexiconOpPlanSchema = z.object({
    objective: z.string(),
    metric: z.string().nullable().optional(),
    baseline: z.string().nullable().optional(),
    acceptance_threshold: z.string().nullable().optional(),
    constraints: StringArraySchema,
    invariants: StringArraySchema,
    tradeoffs: StringArraySchema,
    guard_metrics: StringArraySchema,
});

export const LexiconOpOutputSchema = z.object({
    term: z.string(),
    operation: z.string(),
    plan: LexiconOpPlanSchema,
    actions: z.array(LexiconOpActionSchema),
    result_preview: z.object({
        before: z.unknown(),
        after: z.unknown(),
    }),
});
export type LexiconOpOutput = z.infer<typeof LexiconOpOutputSchema>;

/** HCE output: flexible, task-specific */
export const HceRunOutputSchema = z.record(z.unknown());
export type HceRunOutput = z.infer<typeof HceRunOutputSchema>;

/** Scene output: flexible, task-specific */
export const SceneOutputSchema = z.record(z.unknown());
export type SceneOutput = z.infer<typeof SceneOutputSchema>;

/** Sentence analysis output: flexible, task-specific */
export const AnalyzeSentenceOutputSchema = z.record(z.unknown());
export type AnalyzeSentenceOutput = z.infer<typeof AnalyzeSentenceOutputSchema>;

/**
 * Combined Outputs: optional, all fields optional
 */
export const OutputsSchema = z
    .object({
        lexicon_op: LexiconOpOutputSchema.optional(),
        hce_run: HceRunOutputSchema.optional(),
        scene: SceneOutputSchema.optional(),
        analyze_sentence: AnalyzeSentenceOutputSchema.optional(),
    })
    .strict()
    .nullable()
    .optional();
export type Outputs = z.infer<typeof OutputsSchema>;

// ============================================================================
// Audit
// ============================================================================

export const ForeshadowEntrySchema = z.object({
    id: z.string().min(1),
    detail: z.string(),
    payoff_hypothesis: z.string(),
    due_by: z.string(),
    speculative: z.boolean(),
});

export const PovComplianceSchema = z.object({
    passed: z.boolean(),
    notes: StringArraySchema,
});

export const ConnectorUsageSchema = z.object({
    enabled: z.boolean(),
    connectors_used: StringArraySchema,
});

export const AuditSchema = z
    .object({
        speculative_items: z.array(z.record(z.unknown())).optional(),
        foreshadow_ledger: z.array(ForeshadowEntrySchema).optional(),
        constraints_checked: StringArraySchema,
        tradeoffs_noted: StringArraySchema,
        pov_compliance: PovComplianceSchema.optional(),
        connector_usage: ConnectorUsageSchema.optional(),
    })
    .strict()
    .nullable()
    .optional();
export type Audit = z.infer<typeof AuditSchema>;

// ============================================================================
// State Delta
// ============================================================================

export const StateDeltaSchema = z
    .object({
        story_state: z.record(z.unknown()).nullable().optional(),
        lexicon_state: z.record(z.unknown()).nullable().optional(),
    })
    .strict()
    .nullable()
    .optional();
export type StateDelta = z.infer<typeof StateDeltaSchema>;

// ============================================================================
// Core UEE Envelope
// ============================================================================

/**
 * Base envelope: contract + task + inputs + controls required
 * context/outputs/audit/state_delta optional
 */
const UeeEnvelopeBaseSchema = z.object({
    contract: ContractSchema,
    task: TaskSchema,
    context: ContextSchema.optional(),
    inputs: InputsSchema,
    controls: ControlsSchema,
    outputs: OutputsSchema,
    audit: AuditSchema,
    state_delta: StateDeltaSchema,
});

/**
 * Full UEE schema with conditional validation:
 * If task.type is "lexicon_op", then inputs.lexicon_op must have ["term", "artifact", "objective"]
 */
export const UnifiedEngineEnvelopeSchema = UeeEnvelopeBaseSchema
    // Validate lexicon_op task has required inputs
    .superRefine((data, ctx) => {
        if (data.task.type === "lexicon_op") {
            if (!data.inputs.lexicon_op) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["inputs", "lexicon_op"],
                    message: 'task.type "lexicon_op" requires inputs.lexicon_op',
                });
            } else {
                const { term, artifact, objective } = data.inputs.lexicon_op;
                if (!term || !artifact || !objective) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ["inputs", "lexicon_op"],
                        message: 'lexicon_op requires: term, artifact, objective',
                    });
                }
            }
        }
    })
    // Validate hce_run task has required inputs
    .superRefine((data, ctx) => {
        if (data.task.type === "hce_run") {
            if (!data.inputs.hce_run) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["inputs", "hce_run"],
                    message: 'task.type "hce_run" requires inputs.hce_run',
                });
            } else {
                const { topic } = data.inputs.hce_run;
                if (!topic) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ["inputs", "hce_run"],
                        message: 'hce_run requires: topic',
                    });
                }
            }
        }
    })
    // Validate scene task has required inputs
    .superRefine((data, ctx) => {
        if (data.task.type === "scene") {
            if (!data.inputs.scene) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["inputs", "scene"],
                    message: 'task.type "scene" requires inputs.scene',
                });
            } else {
                const { scene_brief } = data.inputs.scene;
                if (!scene_brief) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ["inputs", "scene"],
                        message: 'scene requires: scene_brief',
                    });
                }
            }
        }
    })
    // Validate analyze_sentence task has required inputs
    .superRefine((data, ctx) => {
        if (data.task.type === "analyze_sentence") {
            if (!data.inputs.analyze_sentence) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["inputs", "analyze_sentence"],
                    message: 'task.type "analyze_sentence" requires inputs.analyze_sentence',
                });
            } else {
                const { sentence } = data.inputs.analyze_sentence;
                if (!sentence) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ["inputs", "analyze_sentence"],
                        message: 'analyze_sentence requires: sentence',
                    });
                }
            }
        }
    });

export type UnifiedEngineEnvelope = z.infer<typeof UnifiedEngineEnvelopeSchema>;

// ============================================================================
// Exports for convenience
// ============================================================================

export const UEESchemas = {
    // Atomic types
    SemanticVersion: SemanticVersionSchema,
    TaskType: TaskTypeSchema,
    TaskMode: TaskModeSchema,
    TaskStatus: TaskStatusSchema,
    DetailLevel: DetailLevelSchema,
    Layer: LayerSchema,

    // Structured types
    Contract: ContractSchema,
    Task: TaskSchema,
    Context: ContextSchema,
    Controls: ControlsSchema,
    ReturnConfig: ReturnConfigSchema,
    Audit: AuditSchema,
    StateDelta: StateDeltaSchema,

    // Inputs (by task type)
    LexiconOpInput: LexiconOpInputSchema,
    HceRunInput: HceRunInputSchema,
    SceneInput: SceneInputSchema,
    AnalyzeSentenceInput: AnalyzeSentenceInputSchema,
    Inputs: InputsSchema,

    // Outputs (by task type)
    LexiconOpOutput: LexiconOpOutputSchema,
    HceRunOutput: HceRunOutputSchema,
    SceneOutput: SceneOutputSchema,
    AnalyzeSentenceOutput: AnalyzeSentenceOutputSchema,
    Outputs: OutputsSchema,

    // Full envelope
    UnifiedEngineEnvelope: UnifiedEngineEnvelopeSchema,
};

export default UEESchemas;
