import { z } from "zod";
/** ---------- Primitives ---------- */
export const SemVerSchema = z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, "Expected semver like 1.2.3");
export const StableIdSchema = z
    .string()
    .min(3)
    .max(128)
    .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/, "StableId must be URL/filename-safe.");
export const NonEmptyStringSchema = z.string().min(1);
export const StringArrayNonEmptySchema = z.array(z.string().min(1)).min(1);
/** ---------- Schema Header ---------- */
export const LexiconFileHeaderSchema = z.object({
    name: z.literal("ai_prompt_lexicon.entry"),
    version: SemVerSchema
});
/** ---------- Entry Components ---------- */
export const RootMeaningSchema = z.object({
    language: NonEmptyStringSchema,
    root: NonEmptyStringSchema,
    gloss: NonEmptyStringSchema,
    truth_from_root: NonEmptyStringSchema
});
export const MathFormalizationSchema = z.object({
    kind: z.literal("constrained_optimization"),
    objective_form: NonEmptyStringSchema,
    constraints_form: NonEmptyStringSchema,
    mapping: z.object({
        "f(x)": NonEmptyStringSchema,
        "g_i(x)": NonEmptyStringSchema,
        "x": NonEmptyStringSchema
    })
});
export const HiddenContractSchema = z.object({
    why_it_matters: NonEmptyStringSchema,
    required_fields: z
        .array(z.enum([
        "objective",
        "constraints",
        "tradeoff_priority",
        "acceptance_tests_or_metrics"
    ]))
        .min(4)
        .refine((arr) => new Set(arr).size === arr.length, "required_fields must be unique.")
});
export const WhatItDoesSchema = z.object({
    intent: NonEmptyStringSchema,
    actions: StringArrayNonEmptySchema,
    hidden_contract: HiddenContractSchema
});
export const SubtypeSchema = z.object({
    id: StableIdSchema,
    label: NonEmptyStringSchema,
    goal: NonEmptyStringSchema,
    signals: StringArrayNonEmptySchema,
    expected_output: StringArrayNonEmptySchema
});
export const DimensionsSchema = z.object({
    principle: NonEmptyStringSchema,
    subtypes: z.array(SubtypeSchema).min(1)
});
export const PipelineStepSchema = z
    .object({
    step: z.number().int().min(0),
    name: NonEmptyStringSchema,
    purpose: z.string().optional(),
    pattern: z.string().optional(),
    examples: z.array(z.string()).optional(),
    targets: z.array(z.string()).optional(),
    rules: z.array(z.string()).optional(),
    methods: z.array(z.string()).optional(),
    document: z.array(z.string()).optional(),
    actions: StringArrayNonEmptySchema
})
    .strict();
export const MethodologySchema = z.object({
    best_practice_pipeline: z.array(PipelineStepSchema).min(1)
});
export const SynonymMapSchema = z
    .object({
    rule: NonEmptyStringSchema,
    by_intent: z
        .object({
        mechanical_efficiency: StringArrayNonEmptySchema,
        precision_tightening: StringArrayNonEmptySchema,
        measurement: StringArrayNonEmptySchema,
        scaling: StringArrayNonEmptySchema,
        single_metric_push: StringArrayNonEmptySchema,
        psychological_impact: StringArrayNonEmptySchema
    })
        .strict(),
    not_equivalents_note: NonEmptyStringSchema
})
    .strict();
export const AntiPatternSchema = z.object({
    id: StableIdSchema,
    example: NonEmptyStringSchema,
    why_fails: NonEmptyStringSchema
});
export const PromptTemplateSchema = z.object({
    id: StableIdSchema,
    title: NonEmptyStringSchema,
    template: NonEmptyStringSchema
});
export const QualityGatesSchema = z
    .object({
    definition_gate: NonEmptyStringSchema,
    behavior_gate: NonEmptyStringSchema,
    measurement_gate: NonEmptyStringSchema
})
    .strict();
export const OptionalAdvancedPipelineSchema = z
    .object({
    name: StableIdSchema,
    stages: StringArrayNonEmptySchema,
    note: NonEmptyStringSchema
})
    .strict();
export const OptionalQuantumThoughtSchema = z
    .object({
    concepts: StringArrayNonEmptySchema,
    note: NonEmptyStringSchema
})
    .strict();
export const OptionalMeaningAnalysisSuiteSchema = z
    .object({
    count: z.number().int().min(1),
    types: StringArrayNonEmptySchema,
    note: NonEmptyStringSchema
})
    .strict();
export const AnalysisExtensionsSchema = z
    .object({
    optional_advanced_pipeline: OptionalAdvancedPipelineSchema,
    optional_quantum_thought_processing: OptionalQuantumThoughtSchema,
    optional_meaning_analysis_suite: OptionalMeaningAnalysisSuiteSchema
})
    .strict();
/** ---------- Main Entry ---------- */
export const LexiconEntrySchema = z
    .object({
    term: NonEmptyStringSchema,
    canonical_term: NonEmptyStringSchema,
    process_tag: StableIdSchema,
    type: z.literal("action_operator"),
    operator_class: StableIdSchema,
    scope: z
        .object({
        applies_to: StringArrayNonEmptySchema,
        mode: StableIdSchema
    })
        .strict(),
    root_meaning: RootMeaningSchema,
    core_definition: NonEmptyStringSchema,
    math_formalization: MathFormalizationSchema,
    what_it_does_in_prompting: WhatItDoesSchema,
    dimensions: DimensionsSchema,
    methodology: MethodologySchema,
    synonym_map: SynonymMapSchema,
    anti_patterns: z.array(AntiPatternSchema).min(1),
    prompt_templates: z.array(PromptTemplateSchema).min(1),
    analysis_extensions: AnalysisExtensionsSchema,
    quality_gates: QualityGatesSchema
})
    .strict();
/** ---------- File Wrapper ---------- */
export const LexiconEntryFileSchema = z
    .object({
    schema: LexiconFileHeaderSchema,
    entry: LexiconEntrySchema
})
    .strict();
/** ---------- Helper ---------- */
export function parseLexiconEntryFile(input) {
    return LexiconEntryFileSchema.parse(input);
}
