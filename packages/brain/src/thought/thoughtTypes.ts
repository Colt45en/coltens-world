import { z } from "zod";

export const IsoDateTimeSchema = z.string().datetime();
export const StableIdSchema = z
    .string()
    .min(3)
    .max(128)
    .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);

export const ThoughtStageSchema = z.enum([
    "concept",
    "observe_perspective",
    "self_questioning",
    "reasoning",
    "decision",
    "optimize"
]);

export const ReasoningModeSchema = z.enum(["deductive", "inductive", "abductive", "mixed"]);

export const KnowledgeArtifactSchema = z
    .object({
        id: StableIdSchema,
        createdAt: IsoDateTimeSchema,

        // what happened
        userGoal: z.string().min(1),
        constraints: z.array(z.string().min(1)).default([]),
        tradeoffPriority: z.array(z.string().min(1)).default([]),

        // correctness & confidence
        facts: z.array(z.string().min(1)).default([]),
        assumptions: z.array(z.string().min(1)).default([]),
        uncertainties: z.array(z.string().min(1)).default([]),

        // what we did
        selectedReasoningMode: ReasoningModeSchema,
        decision: z.string().min(1),
        acceptanceTestsOrMetrics: z.array(z.string().min(1)).default([]),

        // output
        responseSummary: z.string().min(1),

        // lexicon traceability
        operatorsUsed: z.array(StableIdSchema).min(1),

        // what to store
        memory: z.object({
            persist: z.array(z.string().min(1)).default([]),   // stable long-term
            ephemeral: z.array(z.string().min(1)).default([]), // session-only
            doNotStore: z.array(z.string().min(1)).default([]) // safety/privacy
        })
    })
    .strict();

export type KnowledgeArtifact = z.infer<typeof KnowledgeArtifactSchema>;

export const ThoughtStateSchema = z
    .object({
        userMessage: z.string().min(1),
        stage: ThoughtStageSchema,

        // stage outputs (cumulative)
        concepts: z.array(z.string().min(1)).default([]),
        observations: z.array(z.string().min(1)).default([]),
        interpretations: z.array(z.string().min(1)).default([]),
        frames: z.array(z.string().min(1)).default([]),

        assumptions: z.array(z.string().min(1)).default([]),
        evidence: z.array(z.string().min(1)).default([]),
        alternatives: z.array(z.string().min(1)).default([]),
        discriminatingQuestions: z.array(z.string().min(1)).default([]),

        reasoningMode: ReasoningModeSchema.default("mixed"),
        draftPlan: z.string().default(""),
        constraints: z.array(z.string().min(1)).default([]),
        tradeoffPriority: z.array(z.string().min(1)).default([]),
        acceptanceTestsOrMetrics: z.array(z.string().min(1)).default([]),

        finalAnswer: z.string().default(""),
        operatorsUsed: z.array(StableIdSchema).default([])
    })
    .strict();

export type ThoughtState = z.infer<typeof ThoughtStateSchema>;
