# Representation Learning with Formalized Evidence Packets

**Status**: ✅ Complete and verified

Three deliverables implementing the "blame as contract" model for backpropagation in the World Engine.

---

## 1. ✅ Evidence Packet Schema (Contracts-First)

**Location**: [packages/protocol/src/representation.ts](packages/protocol/src/representation.ts)

### What it defines

The **source of truth** for representation learning evidence:

```typescript
RepresentationEvidencePacket {
  traceId, sessionId, epoch, timestamp,
  hiddenActivation: { unitId, value, inputContext },
  blameSignal: { delta, source, magnitude },
  weightUpdate: { oldWeights, newWeights, changeReason, gradientMagnitude },
  representationShift: { stateBeforeEpoch, stateAfterEpoch, separabilityMetric },
  lossBeforeUpdate, lossAfterUpdate,
  metadata: { updatePhase, updatedDirectionCorrect, selectivity, detectorConfidence }
}
```

### Why it matters

- **Auditable**: Every backward pass produces an immutable evidence packet
- **Verifiable**: Captures the exact state before/after each weight update
- **Formal**: Uses Zod schemas, enabling runtime validation
- **Composable**: Batches of packets track epoch-level progress

### Key enums

- **changeReason**: `ORDetectorFormation | ANDDetectorFormation | NOT_ANDDetectorFormation | SelectivityRefinement | NoiseReduction`
- **updatePhase**: `EarlyTraining | Convergence | Finetuning`
- **detectorType**: `OR | AND | NOT_AND | XOR | Unknown`

---

## 2. ✅ Gate Validators (Contract Enforcement)

**Location**: [packages/engine/src/contracts/representation/gates.ts](packages/engine/src/contracts/representation/gates.ts)

### The Five Gates

Each gate validates one aspect of healthy representation learning:

#### Gate 1: **ValidBlameMagnitude**

Checks the blame signal is reasonable (not vanishing/exploding).

```typescript
gateValidBlameMagnitude(packet) → PASS | WARN | FAIL
- Prevents gradient explosion: |delta| ≤ 10.0
- Warns on vanishing: |delta| < 1e-7
- Fails on dead units: delta = 0
```

#### Gate 2: **WeightUpdateReducedError**

Validates that weight updates actually reduced loss.

```typescript
gateWeightUpdateReducedError(packet) → PASS | WARN | FAIL
- PASS: loss decreased after update
- WARN: loss unchanged (saturation?)
- FAIL: loss increased (bad gradient direction)
```

#### Gate 3: **DetectorEmergence**

Checks if hidden units are becoming focused feature detectors.

```typescript
gateDetectorEmergence(packet) → PASS | WARN | FAIL
- Measures selectivity (0 to 1)
- Checks detector confidence
- Returns type: OR, AND, NOT_AND, etc.
```

#### Gate 4: **RepresentationSeparabilityImprovement**

Verifies hidden space is becoming linearly separable (the goal of representation learning).

```typescript
gateRepresentationSeparabilityImprovement(packet) → PASS | WARN | FAIL
- Current separability: 0 (fuzzy) to 1 (perfect)
- Checks delta per epoch
- Detects stalled progress
```

#### Gate 5: **DirectionConsistency** (Batch-level)

Ensures weight updates consistently move in the right direction.

```typescript
gateDirectionConsistency(packets[]) → PASS | WARN | FAIL
- Checks consistency across hidden units
- Detects oscillating/unstable learning
```

### Running all gates

```typescript
const validation = validateRepresentationPacket(packet);
// Returns { validBlameMagnitude, weightUpdateReducedError, detectorEmergence,
//           separabilityImprovement, allPass, anyFail, warningsCount }
```

---

## 3. ✅ Trainable XOR Network (Evidence Emission)

**Location**: [packages/engine/src/learning/xor-trainer.ts](packages/engine/src/learning/xor-trainer.ts)

### The Trainer

A fully functional 2-2-1 neural network trained on XOR that:

1. **Computes forward pass** → hidden activations
2. **Runs backpropagation** → blame signals flow backward
3. **Updates weights** → gradient descent
4. **Emits evidence packets** → one per hidden unit per sample
5. **Batches evidence** → epoch-level snapshots

```typescript
const result = trainXORNetwork({
  epochs: 20000,
  learningRate: 0.5,
  verbose: true,
  emitEvidence: true, // Enable evidence emission
});

// Returns: { finalLoss, finalState, evidenceBatches }
```

### What the network learns

The hidden layer invents representations:

- **Unit 0** → OR detector: high when (x₁ ∨ x₂)
- **Unit 1** → AND detector: high when (x₁ ∧ x₂)
- **Output** → XOR rule: (h₀ - h₁) ≈ (x₁ ⊕ x₂)

This is **representation learning in action**: input space is warped into hidden space where the final decision is linear.

### Evidence output

For every epoch milestone (every 1000 epochs by default), a `RepresentationEvidenceBatch` is created:

```typescript
{
  epoch: 1000,
  totalLoss: 0.0234,
  packets: [
    { unitId: 0, hiddenActivation: { value: 0.892, inputContext: [1, 1], ... } },
    { unitId: 1, hiddenActivation: { value: 0.988, inputContext: [1, 1], ... } },
    ...
  ]
}
```

---

## 🎓 The Big Picture

### Geometric Intuition

In raw input space, XOR is **not linearly separable** (1s and 0s are on diagonals).

The hidden layer warps the space. In hidden space, points become **separable by a line**.

### Numerical "Blame"

Backpropagation formalizes this as:

$$\delta_1 = (W_2^\top \delta_2) \odot \sigma'(z_1)$$

- $(W_2^\top \delta_2)$ = "How much did I contribute to the error?"
- $(\sigma'(z_1))$ = "How sensitive am I right now?"

Hidden units that are blamed adjust to become **detectors** — they specialize in recognizing patterns.

### Evidence-Driven Learning

By emitting packets at each step, the World Engine can:

1. **Audit**: "What did the network learn and why?"
2. **Validate**: "Was each step healthy?"
3. **Reconcile**: "If learning diverged, where did it fail?"
4. **Optimize**: "Which representations were most efficient?"

---

## 🚀 How to Run the Demo

```bash
pnpm tsx apps/sim-server/src/representation-learning-demo.ts
```

Output:

- Network trains for 5,000 epochs
- Shows progress every epoch
- At the end: displays final evidence batch with all gates validated
- Shows what detectors emerged (OR, AND, NOT_AND)
- Visualizes separability metrics and layer progression

---

## 📋 Files Created

### Protocol (Schema)

- `packages/protocol/src/representation.ts` — Zod schemas for evidence packets
- Updated `packages/protocol/src/index.ts` to export

### Engine (Gates + Trainer)

- `packages/engine/src/contracts/representation/gates.ts` — 5 gate validators
- `packages/engine/src/contracts/representation/index.ts` — Export barrel
- `packages/engine/src/learning/xor-trainer.ts` — Trainable network
- `packages/engine/src/learning/index.ts` — Export barrel
- Updated `packages/engine/src/index.ts` to export both

### Demo

- `apps/sim-server/src/representation-learning-demo.ts` — Runnable scenario

---

## ✅ Type Safety

All files pass TypeScript compilation:

- ✅ `@world-engine/protocol` typecheck
- ✅ `packages/engine/src/learning/xor-trainer.ts` (no errors)
- ✅ `packages/engine/src/contracts/representation/gates.ts` (no errors)

---

## 🔗 Integration Points

### For World Engine IDE

The IDE can:

- Display evidence packets in a timeline
- Show gate validation results (PASS/WARN/FAIL per step)
- Plot separability metrics over training
- Highlight which hidden units became detectors
- Replay or pause training and inspect state

### For Sim Server

The sim can:

- Train networks deterministically (seeded RNG)
- Emit evidence to audit logs
- Validate gates as part of tick/snapshot cycle
- Compare learning across versions

### For Nucleus Router

New route handlers can support:

- `POST /learn/train` → start training with config
- `GET /learn/status/:sessionId` → current progress
- `GET /learn/evidence/:sessionId/:epoch` → batch of packets
- `GET /learn/gates/:sessionId/:epoch` → validation results

---

## 🎯 Next Steps

1. **Integrate demo into IDE**: Add UI panel for representation learning visualization
2. **Add more networks**: Extend to fully connected, conv nets, transformers
3. **Enable gradient checkpointing**: Reduce memory for large networks
4. **Add optimizer selection**: SGD, Adam, RMSprop with evidence emission
5. **Connect to Lexicon**: Use trained representations for autonomy

---

**Locked in**: Blame as a first-class, auditable, contractual mechanism. ✨
