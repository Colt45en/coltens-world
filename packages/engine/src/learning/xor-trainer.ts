/**
 * Trainable XOR Network with Evidence Emission
 *
 * A 2-2-1 neural network trained on XOR that emits RepresentationEvidencePackets
 * during backpropagation, formalizing the "blame" signal into auditable contracts.
 */

/**
 * Trainable XOR Network with Evidence Emission
 *
 * A 2-2-1 neural network trained on XOR that emits RepresentationEvidencePackets
 * during backpropagation, formalizing the "blame" signal into auditable contracts.
 */
import type {
  RepresentationEvidenceBatch,
  RepresentationEvidencePacket,
} from "@world-engine/protocol";

function makeUuid(): string {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return cryptoObj.randomUUID();
  }
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// ============================================================================
// ACTIVATION FUNCTIONS & DERIVATIVES
// ============================================================================

function sigmoid(x: number): number {
  if (x > 500) return 1; // Prevent overflow
  if (x < -500) return 0;
  return 1 / (1 + Math.exp(-x));
}

function dsigmoid(y: number): number {
  return y * (1 - y);
}

// ============================================================================
// TYPE DEFINITIONS: compile-time non-null shapes
// ============================================================================

type Vec1 = readonly [number];
type Vec2 = readonly [number, number];

type Mat2x1 = readonly [readonly [number], readonly [number]];
type Mat2x2 = readonly [readonly [number, number], readonly [number, number]];

// Mutable versions for training
type MVec1 = [number];
type MVec2 = [number, number];

type MMat2x1 = [[number], [number]];
type MMat2x2 = [[number, number], [number, number]];

// ============================================================================
// TRAINING STATE
// ============================================================================

interface TrainState {
  epoch: number;
  W1: MMat2x2; // 2x2: input -> hidden (mutable)
  b1: MVec2; // 2: hidden bias (mutable)
  W2: MMat2x1; // 2x1: hidden -> output (mutable)
  b2: MVec1; // 1: output bias (mutable)
  learningRate: number;
  loss: number;
  sessionId: string;
  traceId: string;
}

// ============================================================================
// FORWARD PASS
// ============================================================================

interface ForwardOutput {
  z1: MVec2;
  h: MVec2;
  z2: MVec1;
  yhat: MVec1;
}

function forward(state: TrainState, x: Vec2): ForwardOutput {
  const { W1, b1, W2, b2 } = state;
  const [x0, x1] = x;

  // Hidden layer: z1 = W1 @ x + b1
  const z1: MVec2 = [
    x0 * W1[0][0] + x1 * W1[1][0] + b1[0],
    x0 * W1[0][1] + x1 * W1[1][1] + b1[1],
  ];

  // Hidden activation: h = sigmoid(z1)
  const h: MVec2 = [sigmoid(z1[0]), sigmoid(z1[1])];

  // Output layer: z2 = W2 @ h + b2
  const z2: MVec1 = [h[0] * W2[0][0] + h[1] * W2[1][0] + b2[0]];

  // Output activation: yhat = sigmoid(z2)
  const yhat: MVec1 = [sigmoid(z2[0])];

  return { z1, h, z2, yhat };
}

// ============================================================================
// EVIDENCE EMISSION
// ============================================================================

/**
 * Compute hidden space geometry statistics
 */
function computeGeometryStats(hiddenBatch: readonly (readonly [number, number])[]): {
  hidden0Mean: number;
  hidden0Std: number;
  hidden1Mean: number;
  hidden1Std: number;
  correlation: number;
} {
  const n = hiddenBatch.length;
  if (n === 0) {
    return {
      hidden0Mean: 0,
      hidden0Std: 0,
      hidden1Mean: 0,
      hidden1Std: 0,
      correlation: 0,
    };
  }

  let sum0 = 0;
  let sum1 = 0;
  for (const h of hiddenBatch) {
    sum0 += h[0];
    sum1 += h[1];
  }
  const mean0 = sum0 / n;
  const mean1 = sum1 / n;

  let var0 = 0;
  let var1 = 0;
  let cov = 0;

  for (const h of hiddenBatch) {
    const d0 = h[0] - mean0;
    const d1 = h[1] - mean1;
    var0 += d0 * d0;
    var1 += d1 * d1;
    cov += d0 * d1;
  }

  var0 /= n;
  var1 /= n;
  cov /= n;

  const std0 = Math.sqrt(var0);
  const std1 = Math.sqrt(var1);
  const correlation = std0 > 0 && std1 > 0 ? cov / (std0 * std1) : 0;

  return {
    hidden0Mean: mean0,
    hidden0Std: std0,
    hidden1Mean: mean1,
    hidden1Std: std1,
    correlation,
  };
}

/**
 * Classify a hidden unit as a detector (OR, AND, NOT_AND, etc.)
 */
function classifyDetector(
  h: Vec2,
  inputs: Vec2
): {
  type?: "OR" | "AND" | "NOT_AND" | "XOR";
  confidence: number;
} {
  const [x1, x2] = inputs;
  const [h0, h1] = h;

  // OR: high when x1 OR x2 is true
  if (
    (x1 === 0 && x2 === 0 && h0 < 0.5) ||
    ((x1 === 1 || x2 === 1) && h0 > 0.5)
  ) {
    return { type: "OR", confidence: 0.8 };
  }

  // AND: high when both x1 AND x2 are true
  if (
    (x1 + x2 < 2 && h1 < 0.5) ||
    (x1 === 1 && x2 === 1 && h1 > 0.5)
  ) {
    return { type: "AND", confidence: 0.8 };
  }

  // NOT_AND: high when NOT (x1 AND x2)
  if (
    (x1 + x2 < 2 && h1 > 0.5) ||
    (x1 === 1 && x2 === 1 && h1 < 0.5)
  ) {
    return { type: "NOT_AND", confidence: 0.8 };
  }

  return { confidence: 0.3 };
}

/**
 * Compute separability metric: can a line in hidden space separate XOR?
 * Use a simple linear separability heuristic.
 */
function computeSeparability(hiddenBatch: readonly (readonly [number, number])[], yBatch: readonly number[]): number {
  if (hiddenBatch.length === 0 || yBatch.length === 0) return 0;

  // Simple heuristic: measure how far apart classes are in hidden space.
  // Compute class means then distance between means normalized by within-class spread.
  let c0 = 0, c1 = 0;
  let sum0x = 0, sum0y = 0;
  let sum1x = 0, sum1y = 0;

  // Use for-of with explicit length check in parallel arrays
  const minLen = Math.min(hiddenBatch.length, yBatch.length);
  for (let i = 0; i < minLen; i++) {
    const h = hiddenBatch[i]!; // Safe: i < minLen which is min of both lengths
    const y = yBatch[i]!;       // Safe: same reason
    if (y === 0) {
      c0++;
      sum0x += h[0];
      sum0y += h[1];
    } else {
      c1++;
      sum1x += h[0];
      sum1y += h[1];
    }
  }

  if (c0 === 0 || c1 === 0) return 0;

  const m0x = sum0x / c0;
  const m0y = sum0y / c0;
  const m1x = sum1x / c1;
  const m1y = sum1y / c1;

  const between = Math.hypot(m1x - m0x, m1y - m0y);

  // within-class spread
  let w0 = 0, w1 = 0;
  for (let i = 0; i < minLen; i++) {
    const h = hiddenBatch[i]!; // Same bounds guarantee
    const y = yBatch[i]!;
    if (y === 0) w0 += Math.hypot(h[0] - m0x, h[1] - m0y);
    else w1 += Math.hypot(h[0] - m1x, h[1] - m1y);
  }

  const within = (w0 / c0) + (w1 / c1);
  if (within <= 0) return between > 0 ? 1 : 0;

  // squashed to [0,1]
  const score = between / (between + within);
  return Math.max(0, Math.min(1, score));
}

type DetectorType = "OR" | "AND" | "NOT_AND" | "XOR";

type EvidenceWeights = { w0: number; w1: number; bias: number };

type EmitEvidenceInput = {
  state: TrainState;
  unitId: number;
  inputContext: Vec2;
  hiddenValue: number;
  delta: number;
  oldWeights: EvidenceWeights;
  newWeights: EvidenceWeights;
  lossBeforeUpdate: number;
  lossAfterUpdate: number;
  hiddenBatch: readonly (readonly [number, number])[];
  yBatch: readonly number[];
  batchIndex: number;
};

function classifyUpdatePhase(epoch: number, learningRate: number): "EarlyTraining" | "Convergence" | "Finetuning" {
  if (epoch < learningRate * 100) return "EarlyTraining";
  if (epoch < 0.8 * 20000) return "Convergence";
  return "Finetuning";
}

function getChangeReason(
  detectorType?: DetectorType,
): "ORDetectorFormation" | "ANDDetectorFormation" | "NOT_ANDDetectorFormation" | "SelectivityRefinement" | "NoiseReduction" {
  if (detectorType === "OR") return "ORDetectorFormation";
  if (detectorType === "AND") return "ANDDetectorFormation";
  if (detectorType === "NOT_AND") return "NOT_ANDDetectorFormation";
  return "SelectivityRefinement";
}

function getSeparabilityState(separability: number): "Fuzzy" | "PartialyySeparable" | "LinearySeparable" {
  if (separability < 0.4) return "Fuzzy";
  if (separability < 0.7) return "PartialyySeparable";
  return "LinearySeparable";
}

/**
 * Emit representation evidence packet for a hidden unit
 */
function emitEvidencePacket(input: EmitEvidenceInput): RepresentationEvidencePacket {
  const {
    state,
    unitId,
    inputContext,
    hiddenValue,
    delta,
    oldWeights,
    newWeights,
    lossBeforeUpdate,
    lossAfterUpdate,
    hiddenBatch,
    yBatch,
    batchIndex,
  } = input;
  const geom = computeGeometryStats(hiddenBatch);
  const separability = computeSeparability(hiddenBatch, yBatch);
  const batchItem = batchIndex < hiddenBatch.length ? hiddenBatch[batchIndex] : undefined;
  const detector = batchItem ? classifyDetector(batchItem, inputContext) : { confidence: 0.3 };

  // Compute selectivity: how responsive is this unit to specific inputs?
  const selectivity = Math.abs(hiddenValue - 0.5) * 2; // 0 (indifferent) to 1 (extreme)

  // Update phase classification
  const updatePhase = classifyUpdatePhase(state.epoch, state.learningRate);

  // Determine if direction was correct
  const updatedDirectionCorrect =
    lossAfterUpdate <= lossBeforeUpdate;

  const packet: RepresentationEvidencePacket = {
    version: "1.0",
    traceId: state.traceId,
    sessionId: state.sessionId,
    epoch: state.epoch,
    batchIndex,
    timestamp: Date.now(),

    hiddenActivation: {
      unitId,
      value: hiddenValue,
      inputContext: [...inputContext] as [number, number], // Convert readonly to mutable
    },

    blameSignal: {
      delta,
      source: "OutputLayer",
      magnitude: Math.abs(delta),
    },

    weightUpdate: {
      oldWeights,
      newWeights,
      changeReason: getChangeReason(detector.type),
      learningRate: state.learningRate,
      gradientMagnitude: Math.abs(delta),
    },

    representationShift: {
      stateBeforeEpoch: getSeparabilityState(separability),
      stateAfterEpoch: getSeparabilityState(separability),
      separabilityMetric: separability,
      separabilityDelta: 0, // Will be computed across epochs
      hiddenSpaceGeometry: geom,
    },

    lossBeforeUpdate,
    lossAfterUpdate,

    metadata: {
      updatePhase,
      updatedDirectionCorrect,
      selectivity,
      detectorConfidence: detector.confidence,
      detectorType: detector.type,
    },
  };

  return packet;
}

// ============================================================================
// TRAINING LOOP
// ============================================================================

export interface XORTrainerConfig {
  epochs: number;
  learningRate: number;
  verbose: boolean;
  emitEvidence: boolean;
}

export interface XORTrainerResult {
  finalLoss: number;
  finalState: TrainState;
  evidenceBatches: RepresentationEvidenceBatch[];
}

export interface XORBoundaryLine {
  unit: 0 | 1;
  equation: string;
  normal: [number, number];
  bias: number;
  threshold: number;
  slope?: number;
  intercept?: number;
  verticalAt?: number;
}

export interface XORBoundaryPoint {
  input: [number, number];
  target: 0 | 1;
  hidden: [number, number];
  hiddenCode: [0 | 1, 0 | 1];
  output: number;
}

export interface XORBoundaryAnalysis {
  lines: [XORBoundaryLine, XORBoundaryLine];
  points: XORBoundaryPoint[];
  note: string;
}

type EpochTrainingResult = {
  averageLoss: number;
  evidencePackets: RepresentationEvidencePacket[];
};

type EvidencePacketInput = {
  state: TrainState;
  sampleIdx: number;
  x: Vec2;
  h: MVec2;
  delta1: MVec2;
  totalLoss: number;
  hiddenBatch: readonly (readonly [number, number])[];
  yhatBatch: readonly number[];
};

function createTrainingEvidencePacket(input: EvidencePacketInput): RepresentationEvidencePacket {
  const { state, sampleIdx, x, h, delta1, totalLoss, hiddenBatch, yhatBatch } = input;
  const unitIdx = sampleIdx % 2;
  const [w0_0, w0_1] = state.W1[0];
  const [w1_0, w1_1] = state.W1[1];
  const [b0, b1] = state.b1;

  const w0 = unitIdx === 0 ? w0_0 : w0_1;
  const w1 = unitIdx === 0 ? w1_0 : w1_1;
  const bias = unitIdx === 0 ? b0 : b1;
  const oldWeights = { w0, w1, bias };

  const lossBeforeUpdate = totalLoss / (sampleIdx + 1);
  const lossAfterUpdate = totalLoss / (sampleIdx + 1);
  const h_readonly: Vec2 = [h[0], h[1]];
  const delta1_readonly: Vec2 = [delta1[0], delta1[1]];
  const h_value = unitIdx === 0 ? h_readonly[0] : h_readonly[1];
  const delta_value = unitIdx === 0 ? delta1_readonly[0] : delta1_readonly[1];

  return emitEvidencePacket({
    state,
    unitId: unitIdx,
    inputContext: x,
    hiddenValue: h_value,
    delta: delta_value,
    oldWeights,
    newWeights: oldWeights,
    lossBeforeUpdate,
    lossAfterUpdate,
    hiddenBatch,
    yBatch: yhatBatch,
    batchIndex: sampleIdx,
  });
}

function runTrainingEpoch(
  state: TrainState,
  X: readonly Vec2[],
  Y: readonly number[],
  emitEvidence: boolean,
): EpochTrainingResult {
  const dW1: MMat2x2 = [[0, 0], [0, 0]];
  const db1: MVec2 = [0, 0];
  const dW2: MMat2x1 = [[0], [0]];
  const db2: MVec1 = [0];

  let totalLoss = 0;
  const hiddenBatch: (readonly [number, number])[] = [];
  const yhatBatch: number[] = [];
  const evidencePackets: RepresentationEvidencePacket[] = [];

  for (let sampleIdx = 0; sampleIdx < X.length; sampleIdx++) {
    const x = X[sampleIdx];
    if (!x) continue;
    const y = Y[sampleIdx] ?? 0;

    const fwd = forward(state, x);
    const yhat = fwd.yhat[0];
    const h = fwd.h;

    const hCopy = [...h] as const;
    hiddenBatch.push(hCopy);
    yhatBatch.push(yhat);

    const err = yhat - y;
    totalLoss += 0.5 * err * err;

    const delta2 = err * dsigmoid(yhat);

    const [h0, h1] = h;
    dW2[0][0] += h0 * delta2;
    dW2[1][0] += h1 * delta2;
    db2[0] += delta2;

    const w2_0_val = state.W2[0][0];
    const w2_1_val = state.W2[1][0];
    const delta1: MVec2 = [
      w2_0_val * delta2 * dsigmoid(h0),
      w2_1_val * delta2 * dsigmoid(h1),
    ];

    const [x0, x1] = x;
    dW1[0][0] += x0 * delta1[0];
    dW1[0][1] += x0 * delta1[1];
    dW1[1][0] += x1 * delta1[0];
    dW1[1][1] += x1 * delta1[1];
    db1[0] += delta1[0];
    db1[1] += delta1[1];

    if (emitEvidence) {
      evidencePackets.push(
        createTrainingEvidencePacket({
          state,
          sampleIdx,
          x,
          h,
          delta1,
          totalLoss,
          hiddenBatch,
          yhatBatch,
        }),
      );
    }
  }

  const batchSize = X.length;
  const learningFactor = state.learningRate / batchSize;

  state.W2[0][0] -= learningFactor * dW2[0][0];
  state.W2[1][0] -= learningFactor * dW2[1][0];
  state.b2[0] -= learningFactor * db2[0];

  state.W1[0][0] -= learningFactor * dW1[0][0];
  state.W1[0][1] -= learningFactor * dW1[0][1];
  state.W1[1][0] -= learningFactor * dW1[1][0];
  state.W1[1][1] -= learningFactor * dW1[1][1];
  state.b1[0] -= learningFactor * db1[0];
  state.b1[1] -= learningFactor * db1[1];

  return {
    averageLoss: totalLoss / batchSize,
    evidencePackets,
  };
}

function logEpochProgress(state: TrainState, X: readonly Vec2[], epoch: number): void {
  const predictions: number[] = [];
  for (const xSample of X) {
    const hVal = forward(state, xSample).yhat[0];
    predictions.push(hVal);
  }

  console.log(
    `epoch=${epoch} loss=${state.loss.toFixed(6)} preds=[${predictions.map((p) => p.toFixed(3)).join(", ")}]`,
  );
}

function logFinalEvaluation(state: TrainState, X: readonly Vec2[], Y: readonly number[]): void {
  console.log("\n=== Final XOR Network ===");
  for (let i = 0; i < X.length; i++) {
    const xSample = X[i];
    if (!xSample) continue;
    const fwd = forward(state, xSample);
    const h = fwd.h;
    const yVal = Y[i] ?? 0;

    console.log(
      `x=${JSON.stringify(xSample)} y=${yVal} yhat=${fwd.yhat[0].toFixed(3)} hidden=[${h.map((v) => v.toFixed(3)).join(", ")}]`,
    );
  }
}

function formatBoundaryEquation(wX: number, wY: number, bias: number): {
  equation: string;
  slope?: number;
  intercept?: number;
  verticalAt?: number;
} {
  // Boundary at z=0 for hidden unit: wX*x1 + wY*x2 + b = 0
  // If wY != 0 => x2 = -(wX/wY)x1 - b/wY
  const eps = 1e-10;
  if (Math.abs(wY) > eps) {
    const slope = -(wX / wY);
    const intercept = -(bias / wY);
    return {
      equation: `x2 = ${slope.toFixed(6)}*x1 + ${intercept.toFixed(6)}`,
      slope,
      intercept,
    };
  }

  if (Math.abs(wX) > eps) {
    const verticalAt = -(bias / wX);
    return {
      equation: `x1 = ${verticalAt.toFixed(6)}`,
      verticalAt,
    };
  }

  return {
    equation: "degenerate boundary (all-zero normal)",
  };
}

/**
 * Analyze the hidden-layer representation as decision boundaries.
 *
 * This gives a concrete "representation view":
 * - each hidden neuron boundary in input space
 * - hidden binary code per XOR point
 * - output prediction per XOR point
 */
export function analyzeXORBoundaries(
  state: XORTrainerResult["finalState"],
): XORBoundaryAnalysis {
  const w1 = state.W1;
  const b1 = state.b1;

  const line0Fmt = formatBoundaryEquation(w1[0][0], w1[1][0], b1[0]);
  const line1Fmt = formatBoundaryEquation(w1[0][1], w1[1][1], b1[1]);

  const toLine = (
    unit: 0 | 1,
    normal: [number, number],
    bias: number,
    formatted: ReturnType<typeof formatBoundaryEquation>,
  ): XORBoundaryLine => {
    const base: XORBoundaryLine = {
      unit,
      equation: formatted.equation,
      normal,
      bias,
      threshold: 0,
    };

    if (formatted.slope !== undefined) {
      base.slope = formatted.slope;
    }
    if (formatted.intercept !== undefined) {
      base.intercept = formatted.intercept;
    }
    if (formatted.verticalAt !== undefined) {
      base.verticalAt = formatted.verticalAt;
    }

    return base;
  };

  const lines: [XORBoundaryLine, XORBoundaryLine] = [
    toLine(0, [w1[0][0], w1[1][0]], b1[0], line0Fmt),
    toLine(1, [w1[0][1], w1[1][1]], b1[1], line1Fmt),
  ];

  const xorPoints: readonly [Vec2, 0 | 1][] = [
    [[0, 0], 0],
    [[0, 1], 1],
    [[1, 0], 1],
    [[1, 1], 0],
  ];

  const points: XORBoundaryPoint[] = xorPoints.map(([input, target]) => {
    const f = forward(state, input);
    const h0: 0 | 1 = f.h[0] >= 0.5 ? 1 : 0;
    const h1b: 0 | 1 = f.h[1] >= 0.5 ? 1 : 0;
    return {
      input: [input[0], input[1]],
      target,
      hidden: [f.h[0], f.h[1]],
      hiddenCode: [h0, h1b],
      output: f.yhat[0],
    };
  });

  return {
    lines,
    points,
    note:
      "Hidden units define two soft linear boundaries. Their binary activation code (>=0.5) re-encodes XOR points into a space the output neuron can separate.",
  };
}

const DEFAULT_XOR_TRAINER_CONFIG: XORTrainerConfig = {
  epochs: 20000,
  learningRate: 0.5,
  verbose: true,
  emitEvidence: true,
};

/**
 * Train the XOR network and emit evidence packets
 */
export function trainXORNetwork(
  config?: XORTrainerConfig,
): XORTrainerResult {
  const resolvedConfig = config ?? DEFAULT_XOR_TRAINER_CONFIG;
  const sessionId = makeUuid();
  const traceId = makeUuid();

  // XOR dataset - type-safe fixed tuples
  const X: Vec2[] = [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
  ];
  const Y: readonly number[] = [0, 1, 1, 0];

  // Initialize network (2-2-1)
  const state: TrainState = {
    epoch: 0,
    W1: [
      [Math.random() * 0.5 - 0.25, Math.random() * 0.5 - 0.25],
      [Math.random() * 0.5 - 0.25, Math.random() * 0.5 - 0.25],
    ],
    b1: [0, 0],
    W2: [
      [Math.random() * 0.5 - 0.25],
      [Math.random() * 0.5 - 0.25],
    ],
    b2: [0],
    learningRate: resolvedConfig.learningRate,
    loss: 0,
    sessionId,
    traceId,
  };

  const evidenceBatches: RepresentationEvidenceBatch[] = [];

  // Training loop
  for (let epoch = 1; epoch <= resolvedConfig.epochs; epoch++) {
    state.epoch = epoch;
    const epochResult = runTrainingEpoch(state, X, Y, resolvedConfig.emitEvidence);
    state.loss = epochResult.averageLoss;

    // Emit evidence batch at checkpoints
    if (resolvedConfig.emitEvidence && epoch % 1000 === 0) {
      const batch: RepresentationEvidenceBatch = {
        version: "1.0",
        traceId,
        sessionId,
        epoch,
        totalLoss: state.loss,
        packets: epochResult.evidencePackets,
        timestamp: Date.now(),
      };
      evidenceBatches.push(batch);
    }

    // Log progress
    if (resolvedConfig.verbose && epoch % 2000 === 0) {
      logEpochProgress(state, X, epoch);
    }
  }

  // Final evaluation
  if (resolvedConfig.verbose) {
    logFinalEvaluation(state, X, Y);
  }

  return {
    finalLoss: state.loss,
    finalState: state,
    evidenceBatches,
  };
}

// ============================================================================
// EXPORT FOR REPL/DEBUG
// ============================================================================

export const XORTrainer = {
  train: trainXORNetwork,
  forward,
  analyzeBoundaries: analyzeXORBoundaries,
};
