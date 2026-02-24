/**
 * Optimize Operator
 *
 * Lexicon entry for the "Optimize" action operator: a systematic approach
 * to improving systems by adjusting variables to maximize objectives under constraints.
 *
 * Primary use: code refinement, writing clarity, performance tuning, UX/narrative improvement.
 */

import { z } from "zod";

// ============================================================================
// Enums (single source of truth)
// ============================================================================

export const OptimizationDimensionEnum = z.enum([
  "performance",
  "efficiency",
  "reliability",
  "clarity",
  "ux_conversion",
  "narrative_quality",
  "safety",
  "sustainability",
]);
export type OptimizationDimension = z.infer<typeof OptimizationDimensionEnum>;

export const RequiredPromptFieldEnum = z.enum([
  "objective",
  "constraints",
  "tradeoff_priority",
  "acceptance_tests_or_metrics",
]);
export type RequiredPromptField = z.infer<typeof RequiredPromptFieldEnum>;

export const OptimizeIntentEnum = z.enum([
  "efficiency",
  "precision",
  "impact",
  "measurement",
  "reliability",
]);
export type OptimizeIntent = z.infer<typeof OptimizeIntentEnum>;

export const OptimizeScenarioEnum = z.enum([
  "code_performance",
  "writing_clarity",
  "ui_ux",
  "system_resource",
]);
export type OptimizeScenario = z.infer<typeof OptimizeScenarioEnum>;

// ============================================================================
// Helpers
// ============================================================================

function unique<T>(arr: readonly T[]): boolean {
  return new Set(arr as readonly unknown[]).size === arr.length;
}

function ensureUnique<T>(label: string) {
  return (val: readonly T[], ctx: z.RefinementCtx) => {
    if (!unique(val)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${label} must not contain duplicates.`,
      });
    }
  };
}

/**
 * Render a template with {placeholders}. Fails fast if a placeholder is missing.
 * (No silent partial renders.)
 */
export function renderTemplate(
  template: string,
  vars: Record<string, string | number | boolean>
): string {
  const missing = new Set<string>();

  const rendered = template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_m, key: string) => {
    if (!(key in vars)) {
      missing.add(key);
      return `{${key}}`;
    }
    return String(vars[key]);
  });

  if (missing.size > 0) {
    const keys = [...missing].sort().join(", ");
    throw new Error(`Missing template variables: ${keys}`);
  }

  return rendered;
}

// ============================================================================
// Optimize Operator Schema (STRICT + EXACT KEYS)
// ============================================================================

const RootEtymologySchema = z
  .object({
    language: z.literal("Latin"),
    root: z.literal("optimus"),
    gloss: z.string().min(1),
  })
  .strict();

const PromptTemplateSchema = z
  .object({
    template: z.string().min(1),
    example_input: z.string().min(1).optional(),
    example_output: z.string().min(1).optional(),
  })
  .strict();

export const OptimizeOperatorSchema = z
  .object({
    // Optional but strongly recommended for stability in registries:
    version: z.literal("lexicon.operator.v1"),

    term: z.literal("Optimize"),
    process_tag: z.literal("prompt.operator.optimize"),
    type: z.literal("action_operator"),

    root_etymology: RootEtymologySchema,

    core_definition: z.string().min(1),

    optimization_dimensions: z
      .array(OptimizationDimensionEnum)
      .min(1)
      .superRefine(ensureUnique<OptimizationDimension>("optimization_dimensions")),

    required_prompt_fields: z
      .array(RequiredPromptFieldEnum)
      .min(1)
      .superRefine(ensureUnique<RequiredPromptField>("required_prompt_fields"))
      .superRefine((fields, ctx) => {
        // Enforce that the canonical 4 are present (allows more later if you extend the enum)
        const required: RequiredPromptField[] = [
          "objective",
          "constraints",
          "tradeoff_priority",
          "acceptance_tests_or_metrics",
        ];
        for (const f of required) {
          if (!fields.includes(f)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `required_prompt_fields must include "${f}".`,
            });
          }
        }
      }),

    methodology: z.array(z.string().min(1)).min(1),

    anti_patterns: z.array(z.string().min(1)).min(1),

    // Exact intent keys (no missing, no extras)
    synonyms_by_intent: z
      .object({
        efficiency: z.array(z.string().min(1)).min(1),
        precision: z.array(z.string().min(1)).min(1),
        impact: z.array(z.string().min(1)).min(1),
        measurement: z.array(z.string().min(1)).min(1),
        reliability: z.array(z.string().min(1)).min(1),
      })
      .strict(),

    // Exact scenario keys (no missing, no extras)
    prompt_templates: z
      .object({
        code_performance: PromptTemplateSchema,
        writing_clarity: PromptTemplateSchema,
        ui_ux: PromptTemplateSchema,
        system_resource: PromptTemplateSchema,
      })
      .strict(),
  })
  .strict();

export type OptimizeOperator = z.infer<typeof OptimizeOperatorSchema>;

// ============================================================================
// Canonical Entry (validated at module load)
// ============================================================================

export const OPTIMIZE_OPERATOR = {
  version: "lexicon.operator.v1",

  term: "Optimize",
  process_tag: "prompt.operator.optimize",
  type: "action_operator",

  root_etymology: {
    language: "Latin",
    root: "optimus",
    gloss: "best",
  },

  core_definition:
    "Improve a system by adjusting variables to maximize a stated objective under constraints.",

  optimization_dimensions: [
    "performance",
    "efficiency",
    "reliability",
    "clarity",
    "ux_conversion",
    "narrative_quality",
    "safety",
    "sustainability",
  ],

  required_prompt_fields: [
    "objective",
    "constraints",
    "tradeoff_priority",
    "acceptance_tests_or_metrics",
  ],

  methodology: [
    "1. Define objective and constraints (explicit)",
    "2. Identify bottlenecks/weak points (root cause)",
    "3. Apply highest-impact improvements first (pareto)",
    "4. Validate against acceptance criteria (gates)",
    "5. Document tradeoffs and assumptions (audit trail)",
  ],

  anti_patterns: [
    "vague objective (unclear goal)",
    "no constraints (unbounded scope)",
    "conflicting goals without priority (paralysis)",
    "no measurement/acceptance criteria (no validation)",
    "premature optimization (speed before correctness)",
  ],

  synonyms_by_intent: {
    efficiency: ["streamline", "simplify", "reduce friction", "accelerate"],
    precision: ["refine", "clarify", "distill", "sharpen"],
    impact: ["amplify", "elevate", "captivate", "humanize", "resonate"],
    measurement: ["benchmark", "quantify", "scope", "meter"],
    reliability: ["stabilize", "harden", "fortify", "safeguard"],
  },

  prompt_templates: {
    code_performance: {
      template:
        "Optimize this {language} code for {metric}. Constraints: identical outputs, public API unchanged, no new dependencies. Provide: (1) bottleneck analysis, (2) revised code, (3) benchmark plan, (4) edge-case tests.",
      example_input:
        "Python code: nested loop over 10M items, O(n²) complexity",
      example_output:
        "Refactored to use set lookup (O(n)), 100x speedup, same API",
    },
    writing_clarity: {
      template:
        "Optimize this text for clarity + persuasive impact. Constraints: keep meaning, under {N} words, tone={tone}. Provide: (1) revised version, (2) rationale for changes, (3) reading-difficulty score.",
      example_input: "Long technical explanation with jargon",
      example_output:
        "Concise version with analogies, same information, 40% fewer words",
    },
    ui_ux: {
      template:
        "Optimize this UX flow for {metric} (conversion, clarity, delight, accessibility). Constraints: {constraints}. Provide: (1) current state analysis, (2) proposed changes, (3) user testing plan, (4) metrics to track.",
    },
    system_resource: {
      template:
        "Optimize this system for {resource} (memory, cpu, disk, latency). Constraints: {constraints}. Provide: (1) profiling results, (2) bottleneck analysis, (3) optimization strategy, (4) acceptance tests.",
    },
  },
} as const satisfies OptimizeOperator;

// Validate canonical at module-load time (crash fast if invalid)
export const OPTIMIZE_OPERATOR_VALIDATED: OptimizeOperator =
  OptimizeOperatorSchema.parse(OPTIMIZE_OPERATOR);

/**
 * Export for lexicon registration
 */
export function registerOptimizeOperator() {
  return {
    term: OPTIMIZE_OPERATOR_VALIDATED.term,
    process_tag: OPTIMIZE_OPERATOR_VALIDATED.process_tag,
    schema: OptimizeOperatorSchema,
    entry: OPTIMIZE_OPERATOR_VALIDATED,
  };
}
