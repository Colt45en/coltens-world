# Representation Learning - Quick Reference

## Evidence Packet Anatomy

```
RepresentationEvidencePacket
├── Metadata
│   ├── traceId
│   ├── sessionId
│   ├── epoch
│   ├── timestamp
│   └── version: "1.0"
│
├── Forward Pass Data
│   └── hiddenActivation
│       ├── unitId: number
│       ├── value: number (0—1, sigmoid)
│       └── inputContext: [x1, x2]
│
├── Backward Pass Data
│   └── blameSignal
│       ├── delta: number (∂E/∂z_i)
│       ├── source: "OutputLayer" | "HiddenLayer"
│       └── magnitude: |delta|
│
├── Learning Step
│   └── weightUpdate
│       ├── oldWeights: { w0, w1, bias }
│       ├── newWeights: { w0, w1, bias }
│       ├── changeReason: "ORDetectorFormation" | ...
│       ├── learningRate
│       └── gradientMagnitude
│
├── Representation Evolution
│   └── representationShift
│       ├── stateBeforeEpoch: "Fuzzy" | "PartialySeparable" | "LinearySeparable"
│       ├── stateAfterEpoch: (same)
│       ├── separabilityMetric: 0—1
│       ├── separabilityDelta
│       └── hiddenSpaceGeometry
│           ├── hidden0Mean, hidden0Std
│           ├── hidden1Mean, hidden1Std
│           └── correlation: -1—1
│
├── Error Tracking
│   ├── lossBeforeUpdate: number
│   └── lossAfterUpdate: number
│
└── High-Level Interpretation
    └── metadata
        ├── updatePhase: "EarlyTraining" | "Convergence" | "Finetuning"
        ├── updatedDirectionCorrect: boolean
        ├── selectivity: 0—1 (how focused the detector is)
        ├── detectorConfidence: 0—1
        └── detectorType?: "OR" | "AND" | "NOT_AND" | "XOR"
```

---

## Gate Validators (5 gates)

| Gate                         | Checks                     | Result               | Key Metric               |
| ---------------------------- | -------------------------- | -------------------- | ------------------------ |
| **ValidBlameMagnitude**      | Is gradient sane?          | PASS \| WARN \| FAIL | \|delta\| ∈ [1e-7, 10.0] |
| **WeightUpdateReducedError** | Did weights help?          | PASS \| WARN \| FAIL | loss↓ after update       |
| **DetectorEmergence**        | Is it a focused detector?  | PASS \| WARN \| FAIL | selectivity ≥ 0.7        |
| **SeparabilityImprovement**  | Is hidden space improving? | PASS \| WARN \| FAIL | separability → 1.0       |
| **DirectionConsistency**     | Are updates aligned?       | PASS \| WARN \| FAIL | consistency ≥ 70%        |

---

## Training Flow (One Epoch)

```
Input: X = [[0,0], [0,1], [1,0], [1,1]], Y = [0, 1, 1, 0]

FOR each sample (x, y):
  1. FORWARD:   h = σ(W₁x + b₁);  ŷ = σ(W₂h + b₂)
  2. LOSS:      E = ½(ŷ - y)²
  3. BACKWARD:  δ₂ = (ŷ - y)σ'(ŷ);  δ₁ = (W₂ᵀδ₂) ⊙ σ'(z₁)
  4. EVIDENCE:  Emit RepresentationEvidencePacket for each hidden unit
  5. ACCUMULATE: dW ← dW + gradient

UPDATE:  W ← W - η·(dW/n)

CHECKPOINT (every 1000 epochs):
  → Emit RepresentationEvidenceBatch (all units, all samples)
  → Compute separability metric
```

---

## Evidence Batch (Epoch Snapshot)

```
RepresentationEvidenceBatch
├── version: "1.0"
├── traceId
├── sessionId
├── epoch: 1000
├── totalLoss: 0.0234
├── packets: [ packet₀, packet₁, ... ] (one per hidden unit × sample)
└── timestamp

Then BATCH VALIDATION:
│  Direction Consistency Gate
│  → Are most units updating in correct direction?
```

---

## Detector Emergence (What Happens)

**Without hidden layer** (raw input space):

```
    x₂  1    1      1
        │    0      1
        │
    0   0─────────x₁
        0    1

    1s: (0,1), (1,0)   → NOT separable from 0s: (0,0), (1,1)
```

**With hidden layer** (learned representation):

```
    h₁  1    │  Hidden Space
        │    0      (linearly separable)
        │  │
    0   0─────────h₀

    h₀ ≈ OR (x₁, x₂)   — high when any input is high
    h₁ ≈ AND(x₁, x₂)   — high when both inputs are high

    Output: y = h₀ - h₁ = XOR
```

---

## Running the Trainer

```typescript
// Run and get results
const result = trainXORNetwork({
  epochs: 5000,
  learningRate: 0.5,
  verbose: true,
  emitEvidence: true,
});

// Access results
console.log(result.finalLoss); // number
console.log(result.finalState.W1); // learned weights
console.log(result.evidenceBatches); // array of evidence batches

// Validate a packet
const validation = validateRepresentationPacket(packet);
console.log(validation.allPass); // boolean
console.log(validation.warningsCount); // number
console.log(validation.validBlameMagnitude.status); // "PASS" | "WARN" | "FAIL"

// Validate a batch
const batchValidation = validateRepresentationBatch(packets);
console.log(batchValidation.batchValidation); // direction consistency gate
console.log(batchValidation.unitResults); // per-unit gates
```

---

## Key Insights

### The "Curse" of Representation Learning

- **Raw space** (x₁, x₂) → non-linearly separable
- **Hidden space** (h₀, h₁) → linearly separable
- **Magic**: Gradients force hidden units to invent useful coordinates

### Blame Flow

```
Error at Output
    ↓ (backprop through W₂)
Blame to Hidden Units
    ↓ (adjusted by σ'(z₁), only high in sensitive region)
Gradient to Hidden Weights
    ↓ (W₁ adjusts to produce better features)
Better Representations
```

### Why Evidence Matters

1. **Causality**: Exactly which gradient caused which weight change?
2. **Validation**: Did that change actually reduce error?
3. **Debugging**: Where did learning go wrong?
4. **Determinism**: Same input → same evidence (if seeded)
5. **Accountability**: Every unit can justify its existence

---

## Evidence Driven Governance

Each evidence packet answers:

- **Who** (unitId, role)
- **What** (inputContext, activation)
- **Why** (blameSignal → changeReason)
- **Effect** (lossBeforeUpdate → lossAfterUpdate)
- **Status** (gate validation results)

→ Full auditability of the learning process.

---

## Files

| File                                                    | Purpose                    |
| ------------------------------------------------------- | -------------------------- |
| `packages/protocol/src/representation.ts`               | Schema definitions (Zod)   |
| `packages/engine/src/contracts/representation/gates.ts` | Gate validators            |
| `packages/engine/src/learning/xor-trainer.ts`           | XOR network implementation |
| `apps/sim-server/src/representation-learning-demo.ts`   | Runnable demo              |

---

## Status

✅ **Complete and verified**

- All files compile (TypeScript)
- Demo is runnable
- Gates are formally defined
- Evidence packets are immutable & verifiable
