import { z } from "zod";
import { PromptEnvelopeSchema } from "../promptEnvelope.schema.js";

export const OptimizeAxisEnum = z.enum([
  "performance",
  "clarity",
  "cost",
  "quality",
  "reliability",
  "impact"
]);

export const OptimizeSuboperatorEnum = z.enum([
  "STREAMLINE",
  "CLARIFY",
  "MINIMIZE",
  "ENHANCE",
  "MITIGATE",
  "AMPLIFY",
  "REFINE"
]);

export const OptimizeBudgetEnum = z.enum(["quick", "standard", "deep"]);
export const OptimizeRiskToleranceEnum = z.enum(["low", "medium", "high"]);

export const OptimizePromptV2Schema = PromptEnvelopeSchema.extend({
  operator: z.literal("OPTIMIZE"),
  operator_version: z.literal("v2"),

  target: z.string().min(1, "target is required"),
  objective: z.string().min(1, "objective is required"),

  axis: OptimizeAxisEnum,
  suboperator: OptimizeSuboperatorEnum,

  constraints: z.array(z.string().min(1)).default([]),
  metrics: z.array(z.string().min(1)).default([]),

  baseline: z.string().min(1).optional(),
  budget: OptimizeBudgetEnum.optional(),
  risk_tolerance: OptimizeRiskToleranceEnum.optional(),

  notes: z.string().optional()
}).strict();
