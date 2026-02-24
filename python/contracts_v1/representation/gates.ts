/**
 * Representation Learning Gates (hardened)
 *
 * Validators that check if representation learning is proceeding healthily.
 * Each gate returns PASS/FAIL/WARN with confidence and metrics.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface RepresentationEvidencePacket {
  blameSignal: { delta: number };
  lossBeforeUpdate: number;
  lossAfterUpdate: number;
  metadata: {
    selectivity: number;
    detectorConfidence: number;
    detectorType?: string;
    updatedDirectionCorrect: boolean;
  };
  representationShift: {
    separabilityMetric: number;
    separabilityDelta: number;
  };
}

// ============================================================================
// TYPES
// ============================================================================

export interface GateResult {
  status: "PASS" | "FAIL" | "WARN";
  confidence: number; // 0..1
  reason: string;
  metrics?: Record<string, number | string | boolean>;
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function isFiniteNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

function failInvalidNumber(field: string, value: unknown): GateResult {
  return {
    status: "FAIL",
    confidence: 0.98,
    reason: `Invalid numeric field: ${field}=${String(value)} (expected finite number)`,
    metrics: { field, value: String(value) },
  };
}

// ============================================================================
// GATE 1: Valid Blame Magnitude
// ============================================================================

export function gateValidBlameMagnitude(
  packet: RepresentationEvidencePacket,
  config?: { maxGradient?: number; minGradient?: number }
): GateResult {
  const maxGradient = config?.maxGradient ?? 10.0;
  const minGradient = config?.minGradient ?? 1e-7;

  const delta = (packet as any)?.blameSignal?.delta;
  if (!isFiniteNumber(delta)) return failInvalidNumber("blameSignal.delta", delta);

  const magnitude = Math.abs(delta);

  if (!Number.isFinite(maxGradient) || maxGradient <= 0) {
    return failInvalidNumber("config.maxGradient", maxGradient);
  }
  if (!Number.isFinite(minGradient) || minGradient < 0) {
    return failInvalidNumber("config.minGradient", minGradient);
  }

  // Explosion
  if (magnitude > maxGradient) {
    return {
      status: "FAIL",
      confidence: 1.0,
      reason: `Blame signal exploded: |delta|=${magnitude.toFixed(6)} > max=${maxGradient}`,
      metrics: { magnitude, maxGradient, minGradient, delta },
    };
  }

  // Dead / zero
  if (magnitude === 0) {
    return {
      status: "WARN",
      confidence: 0.9,
      reason: `Hidden unit received zero blame (may be dead)`,
      metrics: { magnitude, maxGradient, minGradient, delta },
    };
  }

  // Vanishing
  if (magnitude < minGradient) {
    return {
      status: "WARN",
      confidence: 0.75,
      reason: `Blame signal vanishing: |delta|=${magnitude.toExponential(
        2
      )} < min=${minGradient.toExponential(2)}`,
      metrics: { magnitude, maxGradient, minGradient, delta },
    };
  }

  return {
    status: "PASS",
    confidence: 0.9,
    reason: `Blame signal within healthy range`,
    metrics: { magnitude, maxGradient, minGradient, delta },
  };
}

// ============================================================================
// GATE 2: Weight Update Reduced Error
// ============================================================================

export function gateWeightUpdateReducedError(
  packet: RepresentationEvidencePacket,
  config?: {
    toleranceAbs?: number; // absolute tolerance on loss delta
    toleranceRel?: number; // relative tolerance vs lossBeforeUpdate
  }
): GateResult {
  const toleranceAbs = config?.toleranceAbs ?? 1e-6;
  const toleranceRel = config?.toleranceRel ?? 1e-6;

  const before = (packet as any)?.lossBeforeUpdate;
  const after = (packet as any)?.lossAfterUpdate;

  if (!isFiniteNumber(before)) return failInvalidNumber("lossBeforeUpdate", before);
  if (!isFiniteNumber(after)) return failInvalidNumber("lossAfterUpdate", after);

  const lossDelta = after - before;
  const denom = Math.max(Math.abs(before), 1e-12);
  const relDelta = lossDelta / denom;

  const absTol = Math.max(toleranceAbs, 0);
  const relTol = Math.max(toleranceRel, 0);

  // Improved
  if (lossDelta < -absTol && relDelta < -relTol) {
    return {
      status: "PASS",
      confidence: 0.95,
      reason: `Weight update reduced loss by ${Math.abs(lossDelta).toFixed(6)} (${(-relDelta * 100).toFixed(4)}%)`,
      metrics: { lossDelta, relDelta, before, after, toleranceAbs: absTol, toleranceRel: relTol },
    };
  }

  // Essentially unchanged
  if (Math.abs(lossDelta) <= absTol || Math.abs(relDelta) <= relTol) {
    return {
      status: "WARN",
      confidence: 0.6,
      reason: `Loss unchanged (within tolerance). Possible saturation / tiny gradients.`,
      metrics: { lossDelta, relDelta, before, after, toleranceAbs: absTol, toleranceRel: relTol },
    };
  }

  // Worse
  return {
    status: "FAIL",
    confidence: 0.95,
    reason: `Weight update increased loss by ${lossDelta.toFixed(6)} (${(relDelta * 100).toFixed(4)}%). LR or gradient direction may be wrong.`,
    metrics: { lossDelta, relDelta, before, after, toleranceAbs: absTol, toleranceRel: relTol },
  };
}

// ============================================================================
// GATE 3: Detector Emergence
// ============================================================================

export function gateDetectorEmergence(
  packet: RepresentationEvidencePacket,
  config?: { selectivityThreshold?: number; confidenceThreshold?: number }
): GateResult {
  const selectivityThreshold = config?.selectivityThreshold ?? 0.7;
  const confidenceThreshold = config?.confidenceThreshold ?? 0.6;

  const meta = (packet as any)?.metadata ?? {};
  const selectivity = meta.selectivity;
  const detectorConfidence = meta.detectorConfidence;
  const detectorType = meta.detectorType;

  if (!isFiniteNumber(selectivity)) return failInvalidNumber("metadata.selectivity", selectivity);
  if (!isFiniteNumber(detectorConfidence)) return failInvalidNumber("metadata.detectorConfidence", detectorConfidence);

  if (selectivity < selectivityThreshold) {
    return {
      status: "WARN",
      confidence: 0.8,
      reason: `Hidden unit selectivity low (${selectivity.toFixed(3)}). Not yet a focused detector.`,
      metrics: { selectivity, selectivityThreshold, detectorConfidence, confidenceThreshold, detectorType: detectorType ?? "Unknown" },
    };
  }

  if (detectorConfidence < confidenceThreshold) {
    return {
      status: "WARN",
      confidence: 0.7,
      reason: `Detector confidence low (${detectorConfidence.toFixed(3)}). Pattern unclear.`,
      metrics: { detectorConfidence, confidenceThreshold, selectivity, selectivityThreshold, detectorType: detectorType ?? "Unknown" },
    };
  }

  return {
    status: "PASS",
    confidence: clamp01(detectorConfidence),
    reason: `Strong ${detectorType ?? "Unknown"} detector emerging. Selectivity=${selectivity.toFixed(
      3
    )}, Confidence=${detectorConfidence.toFixed(3)}`,
    metrics: { selectivity, detectorConfidence, detectorType: detectorType ?? "Unknown" },
  };
}

// ============================================================================
// GATE 4: Representation Separability Improvement
// ============================================================================

export function gateRepresentationSeparabilityImprovement(
  packet: RepresentationEvidencePacket,
  config?: { minSeparabilityDelta?: number; targetSeparability?: number; maxRegression?: number }
): GateResult {
  const minSeparabilityDelta = config?.minSeparabilityDelta ?? 1e-4;
  const targetSeparability = config?.targetSeparability ?? 0.95;
  const maxRegression = config?.maxRegression ?? -1e-4; // fail if delta regresses beyond this

  const shift = (packet as any)?.representationShift ?? {};
  const separabilityMetric = shift.separabilityMetric;
  const separabilityDelta = shift.separabilityDelta;

  if (!isFiniteNumber(separabilityMetric)) return failInvalidNumber("representationShift.separabilityMetric", separabilityMetric);
  if (!isFiniteNumber(separabilityDelta)) return failInvalidNumber("representationShift.separabilityDelta", separabilityDelta);

  // Regression (getting worse)
  if (separabilityDelta < maxRegression) {
    return {
      status: "FAIL",
      confidence: 0.92,
      reason: `Separability regressed (delta=${separabilityDelta.toFixed(6)}). Current=${separabilityMetric.toFixed(6)}.`,
      metrics: { separabilityMetric, separabilityDelta, maxRegression },
    };
  }

  // Achieved target
  if (separabilityMetric >= targetSeparability) {
    return {
      status: "PASS",
      confidence: 0.98,
      reason: `Representation is linearly separable! Separability=${separabilityMetric.toFixed(6)}.`,
      metrics: { separabilityMetric, separabilityDelta, targetSeparability },
    };
  }

  // Stalled improvement
  if (separabilityDelta < minSeparabilityDelta) {
    return {
      status: "WARN",
      confidence: 0.7,
      reason: `Separability improvement stalled (delta=${separabilityDelta.toFixed(6)}). Current=${separabilityMetric.toFixed(6)}.`,
      metrics: { separabilityMetric, separabilityDelta, minSeparabilityDelta, targetSeparability },
    };
  }

  // Improving
  return {
    status: "PASS",
    confidence: 0.85,
    reason: `Separability improving. Current=${separabilityMetric.toFixed(6)}, Delta=${separabilityDelta.toFixed(6)}.`,
    metrics: { separabilityMetric, separabilityDelta, minSeparabilityDelta, targetSeparability },
  };
}

// ============================================================================
// GATE 5: Direction Consistency (fixed)
// ============================================================================

export function gateDirectionConsistency(
  packets: RepresentationEvidencePacket[],
  config?: { minCorrectRate?: number; maxFlipRate?: number; minSamples?: number }
): GateResult {
  const minSamples = config?.minSamples ?? 4;
  const minCorrectRate = config?.minCorrectRate ?? 0.7; // % of updates that are "correct"
  const maxFlipRate = config?.maxFlipRate ?? 0.35; // % of adjacent pairs that flip (oscillation)

  if (packets.length < minSamples) {
    return {
      status: "WARN",
      confidence: 0.55,
      reason: `Not enough packets to assess consistency. Need >= ${minSamples}.`,
      metrics: { count: packets.length, minSamples },
    };
  }

  const bools: boolean[] = [];
  for (let i = 0; i < packets.length; i++) {
    const v = (packets[i] as any)?.metadata?.updatedDirectionCorrect;
    if (typeof v !== "boolean") {
      return {
        status: "FAIL",
        confidence: 0.95,
        reason: `Invalid metadata.updatedDirectionCorrect at index ${i}: ${String(v)}`,
        metrics: { index: i, value: String(v) },
      };
    }
    bools.push(v);
  }

  const trueCount = bools.reduce((acc, b) => acc + (b ? 1 : 0), 0);
  const correctRate = trueCount / bools.length;

  let flips = 0;
  for (let i = 1; i < bools.length; i++) {
    if (bools[i] !== bools[i - 1]) flips++;
  }
  const flipRate = flips / Math.max(1, bools.length - 1);

  // Strong oscillation or poor correctness = warn (or fail if severe)
  if (correctRate < minCorrectRate && flipRate > maxFlipRate) {
    return {
      status: "WARN",
      confidence: 0.85,
      reason: `Unstable learning: correctRate=${(correctRate * 100).toFixed(1)}%, flipRate=${(flipRate * 100).toFixed(1)}%.`,
      metrics: { correctRate, flipRate, trueCount, total: bools.length, minCorrectRate, maxFlipRate },
    };
  }

  if (correctRate < minCorrectRate) {
    return {
      status: "WARN",
      confidence: 0.8,
      reason: `Low correctness stability: ${(correctRate * 100).toFixed(1)}% updates marked correct.`,
      metrics: { correctRate, flipRate, trueCount, total: bools.length, minCorrectRate },
    };
  }

  if (flipRate > maxFlipRate) {
    return {
      status: "WARN",
      confidence: 0.8,
      reason: `Oscillation detected: flipRate=${(flipRate * 100).toFixed(1)}% (threshold ${(maxFlipRate * 100).toFixed(1)}%).`,
      metrics: { correctRate, flipRate, flips, totalPairs: bools.length - 1, maxFlipRate },
    };
  }

  return {
    status: "PASS",
    confidence: clamp01(correctRate * (1 - flipRate)),
    reason: `Stable learning: correctRate=${(correctRate * 100).toFixed(1)}%, flipRate=${(flipRate * 100).toFixed(1)}%.`,
    metrics: { correctRate, flipRate, trueCount, total: bools.length },
  };
}

// ============================================================================
// META: Run gates
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

export function validateRepresentationPacket(packet: RepresentationEvidencePacket): GateResults {
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

  results.allPass = !results.anyFail && results.warningsCount === 0;

  return results as GateResults;
}

export function validateRepresentationBatch(
  packets: RepresentationEvidencePacket[]
): { batchValidation: GateResult; unitResults: GateResults[] } {
  const unitResults = packets.map(validateRepresentationPacket);
  const batchValidation = gateDirectionConsistency(packets);

  return { batchValidation, unitResults };
}
