/**
 * Representation Learning Gates
 *
 * Validators that check if representation learning is proceeding healthily.
 * Each gate returns PASS/FAIL and optional confidence metrics.
 */

import {
    type RepresentationEvidencePacket
} from "@world-engine/protocol";

// ============================================================================
// GATE RESULTS
// ============================================================================

export interface GateResult {
    status: "PASS" | "FAIL" | "WARN";
    confidence: number; // 0 to 1
    reason: string;
    metrics?: Record<string, number | string>;
}

// ============================================================================
// GATE 1: Valid Blame Magnitude
// ============================================================================

/**
 * Gate: ValidBlameMagnitude
 *
 * Checks if the blame signal is reasonable and not saturated.
 * Prevents vanishing/exploding gradients.
 */
export function gateValidBlameMagnitude(
    packet: RepresentationEvidencePacket,
    config?: {
        maxGradient?: number;
        minGradient?: number;
    }
): GateResult {
    const maxGradient = config?.maxGradient ?? 10.0;
    const minGradient = config?.minGradient ?? 1e-7;

    const magnitude = Math.abs(packet.blameSignal.delta);

    // Check for explosion
    if (magnitude > maxGradient) {
        return {
            status: "FAIL",
            confidence: 1.0,
            reason: `Blame signal exploded: |delta|=${magnitude.toFixed(4)} > max=${maxGradient}`,
            metrics: { magnitude, maxGradient },
        };
    }

    // Check for vanishing
    if (magnitude < minGradient && magnitude > 0) {
        return {
            status: "WARN",
            confidence: 0.7,
            reason: `Blame signal vanishing: |delta|=${magnitude.toExponential(2)} < min=${minGradient.toExponential(2)}`,
            metrics: { magnitude, minGradient },
        };
    }

    // Check for zero (dead unit)
    if (magnitude === 0) {
        return {
            status: "WARN",
            confidence: 0.9,
            reason: `Hidden unit received zero blame (may be dead)`,
            metrics: { magnitude },
        };
    }

    return {
        status: "PASS",
        confidence: 0.9,
        reason: `Blame signal within healthy range`,
        metrics: { magnitude, maxGradient },
    };
}

// ============================================================================
// GATE 2: Weight Update Reduced Error
// ============================================================================

/**
 * Gate: WeightUpdateReducedError
 *
 * Checks if the weight update actually reduced the loss.
 * Validates that the learning direction is correct.
 */
export function gateWeightUpdateReducedError(
    packet: RepresentationEvidencePacket,
    config?: {
        tolerance?: number;
    }
): GateResult {
    const tolerance = config?.tolerance ?? 1e-6;

    const lossDelta = packet.lossAfterUpdate - packet.lossBeforeUpdate;

    // Check if loss improved
    if (lossDelta < -tolerance) {
        return {
            status: "PASS",
            confidence: 0.95,
            reason: `Weight update reduced loss by ${Math.abs(lossDelta).toFixed(6)}`,
            metrics: { lossDelta, tolerance },
        };
    }

    // Loss unchanged (within tolerance, maybe due to small gradients)
    if (Math.abs(lossDelta) <= tolerance) {
        return {
            status: "WARN",
            confidence: 0.6,
            reason: `Loss unchanged (within tolerance). May indicate saturation or very small gradients.`,
            metrics: { lossDelta, tolerance },
        };
    }

    // Loss increased (weight update went wrong direction)
    return {
        status: "FAIL",
        confidence: 0.95,
        reason: `Weight update increased loss by ${lossDelta.toFixed(6)}. Learning rate or gradient direction incorrect.`,
        metrics: {
            lossDelta,
            lossBeforeUpdate: packet.lossBeforeUpdate,
            lossAfterUpdate: packet.lossAfterUpdate,
        },
    };
}

// ============================================================================
// GATE 3: Detector Emergence
// ============================================================================

/**
 * Gate: DetectorEmergence
 *
 * Checks if the hidden unit is becoming a feature detector (AND, OR, NOT_AND).
 * Validates that selectivity and confidence are increasing.
 */
export function gateDetectorEmergence(
    packet: RepresentationEvidencePacket,
    config?: {
        selectivityThreshold?: number;
        confidenceThreshold?: number;
    }
): GateResult {
    const selectivityThreshold = config?.selectivityThreshold ?? 0.7;
    const confidenceThreshold = config?.confidenceThreshold ?? 0.6;

    const { selectivity, detectorConfidence, detectorType } = packet.metadata;

    // Check selectivity
    if (selectivity < selectivityThreshold) {
        return {
            status: "WARN",
            confidence: 0.8,
            reason: `Hidden unit selectivity low (${selectivity.toFixed(2)}). Not yet a focused detector.`,
            metrics: { selectivity, threshold: selectivityThreshold },
        };
    }

    // Check detector confidence
    if (detectorConfidence < confidenceThreshold) {
        return {
            status: "WARN",
            confidence: 0.7,
            reason: `Detector confidence low (${detectorConfidence.toFixed(2)}). Pattern unclear.`,
            metrics: { detectorConfidence, threshold: confidenceThreshold },
        };
    }

    // All good: we have a strong detector
    return {
        status: "PASS",
        confidence: detectorConfidence,
        reason: `Strong ${detectorType || "Unknown"} detector emerging. Selectivity=${selectivity.toFixed(2)}, Confidence=${detectorConfidence.toFixed(2)}`,
        metrics: {
            selectivity,
            detectorConfidence,
            detectorType: detectorType ?? "Unknown",
        },
    };
}

// ============================================================================
// GATE 4: Representation Separability Improvement
// ============================================================================

/**
 * Gate: RepresentationSeparabilityImprovement
 *
 * Checks if the hidden space is becoming linearly separable.
 * Validates that representation learning is making progress.
 */
export function gateRepresentationSeparabilityImprovement(
    packet: RepresentationEvidencePacket,
    config?: {
        minSeparabilityDelta?: number;
        targetSeparability?: number;
    }
): GateResult {
    const minSeparabilityDelta = config?.minSeparabilityDelta ?? 1e-4;
    const targetSeparability = config?.targetSeparability ?? 0.95;

    const { separabilityMetric, separabilityDelta } = packet.representationShift;

    // Check if separability is improving
    if (separabilityDelta < minSeparabilityDelta && separabilityMetric < 0.9) {
        return {
            status: "WARN",
            confidence: 0.7,
            reason: `Separability improvement stalled (delta=${separabilityDelta.toFixed(6)}). Current=${separabilityMetric.toFixed(3)}.`,
            metrics: {
                separabilityDelta,
                separabilityMetric,
                minSeparabilityDelta,
            },
        };
    }

    // Check if we're approaching full separability
    if (separabilityMetric >= targetSeparability) {
        return {
            status: "PASS",
            confidence: 0.98,
            reason: `Representation is linearly separable! Separability=${separabilityMetric.toFixed(3)}.`,
            metrics: { separabilityMetric, targetSeparability, separabilityDelta },
        };
    }

    // Still improving
    return {
        status: "PASS",
        confidence: 0.85,
        reason: `Separability improving. Current=${separabilityMetric.toFixed(3)}, Delta=${separabilityDelta.toFixed(6)}.`,
        metrics: { separabilityMetric, separabilityDelta },
    };
}

// ============================================================================
// GATE 5: Direction Consistency
// ============================================================================

/**
 * Gate: DirectionConsistency
 *
 * Checks if weight updates are consistently moving in the same direction
 * across units, indicating stable learning.
 */
export function gateDirectionConsistency(
    packets: RepresentationEvidencePacket[],
    config?: {
        minConsistency?: number;
    }
): GateResult {
    const minConsistency = config?.minConsistency ?? 0.7;

    if (packets.length < 2) {
        return {
            status: "WARN",
            confidence: 0.5,
            reason: `Not enough packets to assess direction consistency. Need >= 2.`,
            metrics: { count: packets.length },
        };
    }

    // Count how many updates moved in a consistent direction
    let prevDirectionWasCorrect: boolean | null = null;
    let consistentCount = 0;

    for (const packet of packets) {
        const isCorrect = packet.metadata.updatedDirectionCorrect;

        if (prevDirectionWasCorrect === null) {
            prevDirectionWasCorrect = isCorrect;
            consistentCount = 1;
        } else if (isCorrect === prevDirectionWasCorrect) {
            consistentCount++;
        }
    }

    const consistency = consistentCount / packets.length;

    if (consistency < minConsistency) {
        return {
            status: "WARN",
            confidence: 0.8,
            reason: `Direction inconsistency detected (${(consistency * 100).toFixed(1)}%). Weight updates may be oscillating.`,
            metrics: { consistency, minConsistency, consistentCount, total: packets.length },
        };
    }

    return {
        status: "PASS",
        confidence: consistency,
        reason: `Weight updates are consistent (${(consistency * 100).toFixed(1)}% moving in correct direction).`,
        metrics: { consistency, consistentCount, total: packets.length },
    };
}

// ============================================================================
// META: Run all gates
// ============================================================================

export interface GateResults {
    validBlameMagnitude: GateResult;
    weightUpdateReducedError: GateResult;
    detectorEmergence: GateResult;
    separabilityImprovement: GateResult;
    allPass: boolean;
    anyFail: boolean;
    warningsCount: number;
}

/**
 * Run all gates on a single packet
 */
export function validateRepresentationPacket(
    packet: RepresentationEvidencePacket
): GateResults {
    const results = {
        validBlameMagnitude: gateValidBlameMagnitude(packet),
        weightUpdateReducedError: gateWeightUpdateReducedError(packet),
        detectorEmergence: gateDetectorEmergence(packet),
        separabilityImprovement: gateRepresentationSeparabilityImprovement(packet),
        allPass: false,
        anyFail: false,
        warningsCount: 0,
    };

    results.anyFail =
        results.validBlameMagnitude.status === "FAIL" ||
        results.weightUpdateReducedError.status === "FAIL" ||
        results.detectorEmergence.status === "FAIL" ||
        results.separabilityImprovement.status === "FAIL";

    results.warningsCount = [
        results.validBlameMagnitude,
        results.weightUpdateReducedError,
        results.detectorEmergence,
        results.separabilityImprovement,
    ].filter((r) => r.status === "WARN").length;

    results.allPass =
        !results.anyFail && results.warningsCount === 0;

    return results as GateResults;
}

/**
 * Run direction consistency gate on a batch
 */
export function validateRepresentationBatch(
    packets: RepresentationEvidencePacket[]
): { batchValidation: GateResult; unitResults: GateResults[] } {
    const unitResults = packets.map(validateRepresentationPacket);
    const batchValidation = gateDirectionConsistency(packets);

    return {
        batchValidation,
        unitResults,
    };
}
