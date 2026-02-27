# World Engine Geometry Contract (WEGC) v1.0
## Master Contract Specification & Implementation Guide

**Effective Date**: 2026-02-25
**Status**: Active
**Scope**: Character Geometry, IK, Contact, Temporal Stability
**Language Reference**: TypeScript

---

## Table of Contents

1. [Scope & Principles](#scope--principles)
2. [Character Geometry Core](#character-geometry-core)
3. [Joint Rotation Limits](#joint-rotation-limits)
4. [Pose Energy Scoring](#pose-energy-scoring)
5. [Gear Envelope System](#gear-envelope-system)
6. [Gear-Aware IK Weighting](#gear-aware-ik-weighting)
7. [Goal Redirection](#goal-redirection)
8. [Contact Caching & Multi-Contact](#contact-caching--multi-contact)
9. [Contact Stacking](#contact-stacking)
10. [Stacked Contact Friction](#stacked-contact-friction)
11. [Contact Compliance](#contact-compliance)
12. [Micro-Jitter Damping](#micro-jitter-damping)
13. [Temporal Consistency Suite](#temporal-consistency-suite)
14. [Determinism Guarantees](#determinism-guarantees)

---

## Scope & Principles

WEGC defines the canonical character geometry and behavioral contract for World Engine avatars. All avatars conforming to WEGC are:

- **Deterministic**: Given identical inputs, produce identical outputs across all hardware
- **Contract-First**: Geometry and behavioral contracts are source-of-truth
- **Hierarchically Well-Defined**: Each layer (geometry → pose → contact → temporal) has clear responsibilities
- **Reproducible**: State can be hashed, verified, and replayed

### Core Commitments

1. **No Randomness**: Core systems use no RNG
2. **Fixed Thresholds**: All constraints and limits are hardcoded
3. **Quantized Space**: Contact patches and surfaces use discrete IDs (hash-based)
4. **Canonical Order**: All decision-making follows deterministic tie-break order

---

## Character Geometry Core

### 1.1 Joint Map

WEGC defines **55 canonical joints** covering the complete humanoid skeleton:

#### Spine Chain (6 joints)
```
Hips (root)
  └─ Spine
       └─ Chest
            └─ Neck
                 └─ Head
                      └─ Jaw
```

#### Head Features (2 joints)
```
Head
  ├─ LeftEye
  └─ RightEye
```

#### Left Arm (20 joints)
```
Chest
  └─ LeftClavicle
       └─ LeftShoulder
            └─ LeftElbow
                 └─ LeftWrist
                      └─ LeftPalm
                           ├─ LeftThumb1 → LeftThumb2 → LeftThumb3
                           ├─ LeftIndex1 → LeftIndex2 → LeftIndex3
                           ├─ LeftMiddle1 → LeftMiddle2 → LeftMiddle3
                           ├─ LeftRing1 → LeftRing2 → LeftRing3
                           └─ LeftLittle1 → LeftLittle2 → LeftLittle3
```

#### Right Arm (20 joints)
```
Chest
  └─ RightClavicle
       └─ RightShoulder
            └─ RightElbow
                 └─ RightWrist
                      └─ RightPalm
                           ├─ RightThumb1 → RightThumb2 → RightThumb3
                           ├─ RightIndex1 → RightIndex2 → RightIndex3
                           ├─ RightMiddle1 → RightMiddle2 → RightMiddle3
                           ├─ RightRing1 → RightRing2 → RightRing3
                           └─ RightLittle1 → RightLittle2 → RightLittle3
```

#### Left Leg (3 joints)
```
Hips
  └─ LeftHip
       └─ LeftKnee
            └─ LeftAnkle
```

#### Right Leg (3 joints)
```
Hips
  └─ RightHip
       └─ RightKnee
            └─ RightAnkle
```

**Total: 55 joints**

### 1.2 Canonical T-Pose Positions

All joints have fixed world-space positions (meters) in T-pose:

```typescript
interface JointDef {
  name: JointName;
  position: Vec3;      // [x, y, z] in T-pose
  parentName: JointName | null;
  limb_type: "spine" | "limb" | "finger" | "eye" | "jaw";
  radius: number;      // Capsule/sphere radius (m)
}
```

**Key positions** (relative to ground at y=0):
- **Hips**: (0, 0.95, 0) — pelvis center
- **Head**: (0, 1.75, 0) — top of skull
- **LeftAnkle**: (0.12, 0.1, 0) — left foot
- **RightAnkle**: (-0.12, 0.1, 0) — right foot

All positions are deterministically computed from body proportions and never change.

### 1.3 Capsule-Based Limb Model

Each limb segment (joint→joint) is modeled as a **capsule**:

```typescript
interface CapsuleLimb {
  from_joint: JointName;
  to_joint: JointName;
  radius: number;  // Per-segment radius
}
```

**Radii** vary:
- Spine segments: ~0.07–0.09m
- Limbs (arms/legs): ~0.04–0.08m
- Fingers: ~0.006–0.01m
- Eyes: ~0.012m

Capsule geometry enables:
- Realistic joint deformation
- Contact surface caching
- IK goal projection
- Gear collision detection

### 1.4 Mirrored Panoramic Projection

The skeleton supports **left-right mirroring**:

```
Left Limb    →    Right Limb
position.x   →    -position.x
```

All right-side joints are exact mirrors of left-side counterparts.

### 1.5 Band System

WEGC defines **stabilization bands** for clothing/gear attachment:

- **Belt**: Waist band (LeftHip/RightHip level)
- **Collar**: Neck band (Neck/Chest level)
- **Limb Bands**: Per-limb costume straps

Bands are procedurally stabilized (see [Section 13](#temporal-consistency-suite)).

---

## Joint Rotation Limits

### 2.1 Soft and Hard Limits

Each joint has **per-axis** rotation constraints:

```typescript
interface RotationLimit {
  axis: "x" | "y" | "z";
  soft_min_deg: number;  // Warning threshold
  soft_max_deg: number;
  hard_min_deg: number;  // Absolute clamp
  hard_max_deg: number;
  exponent: number;      // Barrier curve steepness
}
```

**Soft vs Hard**:
- **Soft**: Smooth penalty curve (exponent-based barrier)
- **Hard**: Strict clamp ( physically impossible rotation)

### 2.2 Barrier Blending Using Exponent Curve

When a rotation **exceeds soft limits**, apply penalty using:

$$\text{penalty} = \left(\frac{\Delta\theta}{\theta_{\text{max}} - \theta_{\text{soft}}}\right)^{\text{exponent}}$$

Where:
- $\Delta\theta$ = overshoot amount
- $\text{exponent}$ ∈ [1.0, 3.0] controls curve steepness
  - **1.0** = linear penalty
  - **2.0** = quadratic (most common)
  - **3.0** = cubic (very stiff)

Example: Head rotation limits
```
Soft: [-40°, +40°]
Hard: [-60°, +60°]
Exponent: 2 (quadratic)

If head.y = 50° (10° beyond soft):
  penalty = (10 / 20)^2 = 0.25  → 25% energy
```

### 2.3 Mode Scaling

Joint limits adapt based on **constraint mode**:

```
DEFAULT      → Standard human ROM
ARMOR_SAFE   → Reduced by 20% (gear restrictions)
ACROBATIC    → Expanded by 30% (flexibility)
```

### 2.4 Deterministic Clamp Order

**All joints must clamp in fixed order**:

$$\text{Yaw (Y)} \rightarrow \text{Pitch (X)} \rightarrow \text{Roll (Z)}$$

This order is independent of joint, constraint mode, or hardware. The order prevents order-dependent artifacts.

---

## Pose Energy Scoring

### 3.1 Normalized Penetration Metric

**Pose Energy** is a normalized [0, 1] score representing constraint violations:

```typescript
interface PoseEnergy {
  global: number;        // [0, 1] aggregate
  per_joint: Record<JointName, number>;
  violations: Array<{
    joint: JointName;
    axis: "x" | "y" | "z";
    normalized_error: number;
  }>;
}
```

**Interpretation**:
- **0.0** = Perfect pose (all constraints satisfied)
- **0.5** = Moderate violations (~50% penalty)
- **1.0** = Severe violations (all joints clamped)

### 3.2 Joint Energy Aggregation with Weights

Compute gross energy from all joints:

$$E_{\text{global}} = \min\left(1,\,\frac{1}{N} \sum_{i=0}^{N-1} E_i\right)$$

Where:
- $N$ = constraint count
- $E_i$ = per-joint energy from [Section 2.2])

### 3.3 Real-Time Updates

Energy must be **re-computed** whenever:
- Joint rotation changes
- Constraint mode transitions
- Skeleton hierarchy modifies

---

## Gear Envelope System

### 4.1 OBB and Capsule Envelopes

Gear (equipment) blocks avatar limbs via **collision envelopes**:

```typescript
interface GearEnvelope {
  id: string;              // Unique ID
  type: "OBB" | "Capsule"; // Envelope shape
  attachment_joint: JointName;
  local_from: Vec3;        // For capsule: start
  local_to: Vec3;          // For capsule: end
  half_extents: Vec3;      // For OBB: half-size
  rotation: Quat;
  risk_threshold: number;  // Signed distance warning (m)
  max_surface_patches: number;
}
```

**OBB (Oriented Bounding Box)**
- Rigid shapes (armor chest plate, shield)
- AABB in local space, rotated to world

**Capsule**
- Flexible equipment (rope, wrapped cloth)
- Line segment + radius

### 4.2 Signed Distance Risk Model

Compute **signed distance** from IK goal to envelope:

$$d = \begin{cases}
  \text{outside_dist} & \text{if outside} \\
  -\text{inside_dist} & \text{if inside}
\end{cases}$$

- **Negative** = goal is **inside** gear (collision)
- **Positive** = goal is **outside** gear (safe)
- **Risk** aggregates penetration depth

### 4.3 Clearance Zones and Risk Normalization

Define **clearance zone** as:

$$\text{clearance} = \text{risk\_threshold} - d$$

Normalize to [0, 1]:

$$\text{normalized\_risk} = \max(0,\, \min(1,\, \text{clearance} / \text{risk\_threshold}))$$

---

## Gear-Aware IK Weighting

### 5.1 Goal Risk Aggregation from Probe Points

For each IK goal, aggregate risk from **all envelopes**:

$$\text{goal\_risk} = \min(1,\, \sum_{\text{envelope}} \text{normalized\_risk})$$

### 5.2 Weight Modulation Using Risk Exponent

Modulate IK weight based on risk:

$$w' = w \cdot (1 - \text{goal\_risk})^{\text{riskExp}}$$

Where:
- $w$ = base weight
- $\text{riskExp}$ ∈ [1.0, 3.0] (typically 2.0)
- Result: Risky goals have **lower weight**

### 5.3 Tier-Based Minimum Weights

Enforce **minimum weights per goal tier**:

- **Feet**: $w_{\min} = 0.8$ (critical for ground contact)
- **Hands**: $w_{\min} = 0.6$ (essential for interaction)
- **Style Points**: $w_{\min} = 0.4$ (secondary aesthetics)

Final weight: $$w_{\text{final}} = \max(w_{\min},\, w')$$

---

## Goal Redirection

### 6.1 Nearest Surface Projection When Blocked

If IK goal is **inside envelope**:

1. Find **nearest point on envelope surface** to goal
2. Project goal to that surface
3. Apply **safe offset** (envelope normal × offset_distance)

### 6.2 Safe Offset Using Envelope Normal

Safe offset moves goal **outward** by:

$$\text{goal}_{\text{new}} = \text{surface}_{\text{proj}} + \vec{n} \cdot \text{offset\_dist}$$

Where $\vec{n}$ is surface normal, offset distance depends on equipment type.

### 6.3 Max Redirect Distance Per Goal Type

**Hard clamp** per goal type:

- **Foot**: max 0.3m redirect
- **Hand**: max 0.25m redirect
- **Style**: max 0.15m redirect

If redirect exceeds max, goal is **unreachable** (weight → 0).

---

## Contact Caching & Multi-Contact

### 7.1 Local Parameterization

Contacts are cached in **local coordinates** of envelope:

```typescript
interface ContactSurface {
  patch_id: number;              // Quantized surface ID
  contact_point: Vec3;           // World-space
  normal: Vec3;                  // Surface normal
  penetration_depth: number;     // (m)
  material: string;              // "skin", "steel", etc.
  compliance_coefficient: number;
}
```

**Local param** enables fast re-projection on envelope motion.

### 7.2 Hysteresis Engage/Release Thresholds

Contact **state machine**:

```
released
   ↓ (penetration < engage_threshold)
engaged
   ↓ (penetration > release_threshold)
released
```

Thresholds prevent jitter:
- **release_threshold** = 1.5 × **engage_threshold**

### 7.3 Stick and Slide States

```typescript
stick_state: "engaged" | "sliding" | "released"
```

- **engaged**: Contact is active, not moving
- **sliding**: Contact moving tangentially
- **released**: No contact

---

## Multi-Contact Support

### 8.1 Channel System

Contacts organize by **limb region**:

```typescript
type ContactChannel = "Palm" | "Fingertips" | "Wrist" | "Elbow"
```

Each channel can have multiple simultaneous contacts.

### 8.2 Weighted Multi-Objective Solve

Blend multiple contact objectives:

$$F_{\text{result}} = \sum_{\text{channel}} w_{\text{channel}} \cdot F_{\text{channel}}$$

Where weights sum to contact's **weight_budget** (normalized to [0, 1]).

### 8.3 Conflict Resolution via Priority

If channels conflict:

1. **Tier-based priority**: feet > hands > style
2. **Age-based**: Older contacts have priority
3. **Error magnitude**: Larger errors suppress weaker ones

---

## Contact Stacking

### 9.1 Quantized Surface Patch Identity

Each physical surface has **unique patch ID**:

$$\text{patch\_id} = \text{hash}(\text{type}, \text{subtype}, \text{offset})$$

Examples:
- $16843009$ = ChestPlate_Main
- $33686018$ = LeftForearm_Leather
- $50529027$ = GroundPlane_Grass

These IDs are **deterministic and stable** across runs.

### 9.2 Stack Leadership Model

When multiple contacts touch same patch, one is **leader**:

- Leader contact determines surface normal
- Other contacts are **followers** (apply friction only)
- Leadership determined by:
  1. Contact time (older = leader)
  2. Penetration depth (deeper = leader)

### 9.3 Weight Budget Normalization

Total contact weight per limb $$\leq w_{\text{budget}}$$:

$$\sum_{\text{contact}} w_i \leq 1.0$$

If overfull, normalize:

$$w_i' = w_i \cdot \frac{1}{\sum w_i}$$

---

## Stacked Contact Friction

### 10.1 Tangential Force Proxy Model

Estimate **friction force** from contact penetration:

$$F_{\text{friction}} = F_{\text{normal}} \cdot \mu_{\text{material}}$$

Where $\mu$ is **material coefficient**:
- Skin: 0.7
- Leather: 0.8
- Steel: 0.6
- Cloth: 0.5

### 10.2 Static vs. Sliding Threshold

Determine contact state:

$$\text{state} = \begin{cases}
  \text{"static"} & \text{if } F_{\text{tangent}} \leq F_{\text{friction}} \\
  \text{"sliding"} & \text{otherwise}
\end{cases}$$

### 10.3 Stack Member Multiplier

Each **follower contact** reduces leader's multiplier:

$$M_{\text{leader}} = 1 - 0.1 \times (\text{follower\_count} - 1)$$

This models load sharing (heavier = more support).

---

## Contact Compliance

### 11.1 Material-Based Compliance Coefficient

Soft materials compress under load:

$$\text{compliance} = \begin{cases}
  0.1 & \text{skin} \\
  0.05 & \text{leather} \\
  0.01 & \text{steel} \\
  0.08 & \text{cloth}
\end{cases}$$

Stored in each `ContactSurface`.

### 11.2 Load-Driven Safe Distance Reduction

Under load, safe distance **shrinks**:

$$\text{safe\_dist}_{\text{loaded}} = \text{safe\_dist}_{\text{nominal}} \cdot (1 - \text{load\_factor})$$

Where load factor depends on contact stack multiplier.

### 11.3 Ramp-In Smoothing

When contact becomes active, smoothly ramp compliance over **0.2 seconds**:

$$\text{compliance}_t = \text{lerp}(\text{compliance}_{\text{nominal}}, \text{compliance}_{\text{loaded}}, \, t / 0.2)$$

Prevents sudden jerks.

---

## Micro-Jitter Damping

### 12.1 Adaptive Low-Pass Filter Per Contact

Each contact_patch has **independent filter state**:

```typescript
interface JitterFilter {
  deadband: number;
  low_pass_alpha: number;      // [0, 1]
  last_value: Vec3;
  last_filtered: Vec3;
}
```

### 12.2 Deadband Snapping

Small motions **snap** to prevent chatter:

$$\text{position}_{\text{output}} = \begin{cases}
  \text{last} & \text{if } |\Delta p| < \text{deadband} \\
  \text{filtered} & \text{otherwise}
\end{cases}$$

Deadband typically **0.0001m** (0.1mm).

### 12.3 Material-Aware Smoothing

Filter alpha depends on material:

$$\alpha = \begin{cases}
  0.75 & \text{skin} \\
  0.82 & \text{leather} \\
  0.90 & \text{steel} \\
  0.70 & \text{cloth}
\end{cases}$$

Stiffer materials = higher alpha (less filtering).

---

## Temporal Consistency Suite

### 13.1 Face Features Stabilization

Stabilize **eye midpoint** and **mouth point** with EMA:

$$\text{pos}_t = \text{lerp}(\text{pos}_{t-1}, \text{target}_t, 1 - \alpha^{\Delta t})$$

Where $\alpha \approx 0.85$ (very smooth, ~0.3s to converge).

### 13.2 Belt and Collar Band Stabilization

Procedurally smooth **band positions**:

$$\text{band}_t = \text{lerp}(\text{band}_{t-1}, \text{target}_t, 1 - \alpha_{\text{band}}^{\Delta t})$$

Where $\alpha_{\text{band}} \approx 0.9$ (stiffer than face).

### 13.3 Limb Band Stabilization with Speed-Aware Alpha

Modulate smoothing based on **limb velocity**:

$$\alpha_{\text{adjusted}} = \begin{cases}
  \alpha_{\text{nominal}} & \text{if } v < 0.5 \text{ m/s} \\
  \alpha_{\text{nominal}} \times 0.7 & \text{if } v \geq 0.5 \text{ m/s}
\end{cases}$$

Fast motion = **less smoothing** (more responsive).

---

## Determinism Guarantees

### 14.1 Fixed Thresholds and Constants

**All** numerical thresholds are **hardcoded constants**:

```typescript
const ENGAGE_THRESHOLD = 0.05;        // meters
const FRICTION_STATIC_THRESHOLD = 0.1; // newtons
const JITTER_DEADBAND = 0.0001;       // meters
// ... etc
```

No computed thresholds, no configuration lookups.

### 14.2 Quantized Surface Patches

Surface IDs are **hash-based and deterministic**:

$$\text{patch\_id} = \text{SHA256}(\text{"type=ChestPlate,subtype=Main,x=0.5"})$$

→ Same ID every run, no float drift.

### 14.3 Tie-Break Order

All ambiguous decisions use **canonical order**:

1. **Rotation clamp order**: Y (yaw) → X (pitch) → Z (roll)
2. **Limb tier**: Feet → Hands → Style
3. **Limb side**: Left → Right
4. **Contact age**: Older contacts have priority

### 14.4 No Randomness or Frame-Order Dependency

- ✓ No RNG in core systems
- ✓ No `Math.random()` calls
- ✓ No frame-dependent computations
- ✓ Sorted keys in all dictionaries
- ✓ Canonical JSON stringify for hashing

### 14.5 Reproducible Across Hardware

Identical execution on:
- Different CPUs (Intel/ARM, desktop/mobile)
- Different OS (Windows/macOS/Linux)
- Different browsers (Chrome/Firefox/Safari)
- Different build configurations

**Verified via SHA256 comparison** of execution state.

---

## Summary Table

| System | Key Constant | Output | Update Freq |
|--------|-------------|--------|------------|
| Geometry | 55 canonic joints | `AvatarGeometryState` | Once (init) |
| Constraints | `DEFAULT_ROTATION_LIMITS` | `PoseEnergy` | Per-frame |
| IK Weighting | Tier minimums (0.4–0.8) | Modulated weights | Per-frame |
| Contact | `ENGAGE_THRESHOLD=0.05m` | Multi-contact state | Per-contact |
| Friction | Material μ (0.5–0.8) | Friction force | Per-frame |
| Jitter Damping | `DEADBAND=0.0001m` | Filtered position | Per-frame |
| Temporal Stability | EMA α (0.7–0.9) | Stabilized position | Per-frame |

---

## Compliance Checklist

To conform to WEGC v1.0:

- [ ] Use exactly **55 canonical joints** from Section 1.1
- [ ] Implement **soft + hard rotation limits** (Section 2)
- [ ] Compute **pose energy** per Section 3
- [ ] Apply **gear envelopes** for IK (Section 4–7)
- [ ] Support **multi-contact** with all channels (Section 8–10)
- [ ] Implement **friction** per Section 10.2
- [ ] Apply **jitter damping** per Section 12
- [ ] Stabilize **face/band features** (Section 13)
- [ ] Ensure **determinism** (Section 14)
- [ ] **Hash state** with SHA256 for verification
- [ ] Generate **DeterminismCertificate** at export

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-25 | Initial release |

---

## Glossary

- **Deterministic**: Produces identical output for identical input, regardless of hardware/OS
- **Capsule**: Cylinder capped with hemispheres (smooth limb collision)
- **OBB**: Oriented Bounding Box (arbitrary rotation + position)
- **Signed Distance**: Negative inside volume, positive outside
- **Patch ID**: Hash-based unique identifier for a surface
- **EMA**: Exponential Moving Average (time-series smoothing)
- **Deadband**: Small threshold below which values snap to last state
- **Hysteresis**: State machine with separate engage/release thresholds

---

**WEGC v1.0 Master Contract**
World Engine © 2026
All systems deterministic and reproducible by design.
