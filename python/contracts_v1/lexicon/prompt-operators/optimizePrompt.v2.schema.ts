import { z } from "zod";
import { PromptEnvelopeSchema } from "../promptEnvelope.schema";

export const OptimizeAxisEnum = z.enum([
  "performance",
  "clarity",
  "cost",
  "quality",
  "reliability",
  "impact"
]);

export const OptimizeSuboperatorEnum = z.enum([
  "STREAMLINE", // performance
  "CLARIFY",    // clarity
  "MINIMIZE",   // cost
  "ENHANCE",    // quality
  "MITIGATE",   // reliability
  "AMPLIFY",    // impact
  "REFINE"      // safe fallback axis-neutral
]);

export const OptimizeBudgetEnum = z.enum(["quick", "standard", "deep"]);
export const OptimizeRiskToleranceEnum = z.enum(["low", "medium", "high"]);

export const OptimizePromptV2Schema = PromptEnvelopeSchema.extend({
  operator: z.literal("OPTIMIZE"),
  operator_version: z.literal("v2"),

  // Core slots (required)
  target: z.string().min(1, "target is required"),
  objective: z.string().min(1, "objective is required"),

  // Deterministic inference outputs
  axis: OptimizeAxisEnum,
  suboperator: OptimizeSuboperatorEnum,

  // Optional structured detail
  constraints: z.array(z.string().min(1)).default([]),
  metrics: z.array(z.string().min(1)).default([]),

  baseline: z.string().min(1).optional(),
  budget: OptimizeBudgetEnum.optional(),
  risk_tolerance: OptimizeRiskToleranceEnum.optional(),

  // Freeform notes that still stay contract-safe
  notes: z.string().optional()
}).strict();

export type OptimizePromptV2 = z.infer<typeof OptimizePromptV2Schema>;
