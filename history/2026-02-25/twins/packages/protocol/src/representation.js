import { z } from "zod";
/**
 * Representation Evidence Packet
 *
 * Formalizes the "blame" signal in backpropagation as a first-class contract.
 * Enables auditing, gate validation, and deterministic representation learning.
 */
// ============================================================================
// SCHEMAS (Zod)
// ============================================================================
/**
 * Hidden unit activation during forward pass
 */
export const HiddenActivationSchema = z.object({
    unitId: z.number().int().min(0),
    value: z.number().min(0).max(1), // sigmoid output
    inputContext: z.tuple([z.number(), z.number()]), // [x1, x2] for XOR
});
/**
 * Blame signal from backward pass (gradient flowing into this unit)
 */
export const BlameSignalSchema = z.object({
    // ∂E/∂z_i: how much error this unit caused
    delta: z.number(),
    // Who sent the blame?
    source: z.enum(["OutputLayer", "HiddenLayer"]),
    // Magnitude of change pressure
    magnitude: z.number().nonnegative(),
});
/**
 * Weight update from credit assignment
 */
export const WeightUpdateSchema = z.object({
    // Before gradient descent
    oldWeights: z.object({
        w0: z.number(), // W1[0, i]
        w1: z.number(), // W1[1, i]
        bias: z.number(), // b1[i]
    }),
    // After gradient descent
    newWeights: z.object({
        w0: z.number(),
        w1: z.number(),
        bias: z.number(),
    }),
    // Why did it change?
    changeReason: z.enum([
        "ORDetectorFormation",
        "ANDDetectorFormation",
        "NOT_ANDDetectorFormation",
        "SelectivityRefinement",
        "NoiseReduction",
    ]),
    // Learning rate applied
    learningRate: z.number().positive(),
    // Average gradient magnitude (for stability analysis)
    gradientMagnitude: z.number().nonnegative(),
});
/**
 * How much the hidden space improved (representation shift)
 */
export const RepresentationShiftSchema = z.object({
    // Descriptive state before
    stateBeforeEpoch: z.enum(["Fuzzy", "PartialyySeparable", "LinearySeparable"]),
    // Descriptive state after
    stateAfterEpoch: z.enum(["Fuzzy", "PartialyySeparable", "LinearySeparable"]),
    // Quantitative metric: distance to linear separability
    // 0 = not separable, 1 = perfectly separable
    separabilityMetric: z.number().min(0).max(1),
    // How much the separability improved this epoch
    separabilityDelta: z.number(),
    // Hidden space geometry snapshot
    hiddenSpaceGeometry: z.object({
        hidden0Mean: z.number(),
        hidden0Std: z.number(),
        hidden1Mean: z.number(),
        hidden1Std: z.number(),
        correlation: z.number().min(-1).max(1), // between h0 and h1
    }),
});
/**
 * Full evidence packet for one hidden unit during one training iteration
 */
export const RepresentationEvidencePacketSchema = z.object({
    // Trace and versioning
    version: z.literal("1.0"),
    traceId: z.string().min(1).max(256),
    sessionId: z.string().min(1).max(256),
    epoch: z.number().int().nonnegative(),
    batchIndex: z.number().int().nonnegative(),
    timestamp: z.number().int().nonnegative(),
    // Forward pass: what the hidden unit computed
    hiddenActivation: HiddenActivationSchema,
    // Backward pass: how much error it caused
    blameSignal: BlameSignalSchema,
    // Credit assignment: what weight changes result
    weightUpdate: WeightUpdateSchema,
    // Representation evolution
    representationShift: RepresentationShiftSchema,
    // Loss before and after this update
    lossBeforeUpdate: z.number().nonnegative(),
    lossAfterUpdate: z.number().nonnegative(),
    // Metadata for debugging and analysis
    metadata: z.object({
        // What category of update is this in the cycle?
        updatePhase: z.enum(["EarlyTraining", "Convergence", "Finetuning"]),
        // Is the weight update moving the right direction?
        updatedDirectionCorrect: z.boolean(),
        // Selectivity of this unit (how specific to patterns it is)
        selectivity: z.number().min(0).max(1),
        // Confidence that a detector has emerged
        detectorConfidence: z.number().min(0).max(1),
        detectorType: z
            .enum(["OR", "AND", "NOT_AND", "XOR", "Unknown"])
            .optional(),
    }),
});
/**
 * Batch of evidence packets for all hidden units in one epoch
 */
export const RepresentationEvidenceBatchSchema = z.object({
    version: z.literal("1.0"),
    traceId: z.string().min(1).max(256),
    sessionId: z.string().min(1).max(256),
    epoch: z.number().int().nonnegative(),
    totalLoss: z.number().nonnegative(),
    packets: z.array(RepresentationEvidencePacketSchema),
    timestamp: z.number().int().nonnegative(),
});
