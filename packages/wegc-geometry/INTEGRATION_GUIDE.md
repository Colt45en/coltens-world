# WEGC Integration Guide
## How to Use World Engine Geometry Contract in Your Apps

This guide shows how to integrate WEGC into your World Engine applications.

## Installation

WEGC is available as a workspace package:

```bash
pnpm add @world-engine/wegc-geometry
```

## Basic Usage

### 1. Initialize Avatar Geometry

```typescript
import {
  buildCanonicalSkeleton,
  initializeGeometryState,
  type AvatarGeometryState,
} from "@world-engine/wegc-geometry";

// Create a blank avatar
const skeleton = buildCanonicalSkeleton();
console.log(`Loaded ${skeleton.length} joints`);

// Create full geometry state
const state: AvatarGeometryState = {
  version: "1.0",
  skeleton: {
    joints: skeleton,
    constraints: skeleton.map((joint) => ({
      joint: joint.name,
      mode: "ARMOR_SAFE",
      limits: DEFAULT_ROTATION_LIMITS[joint.name] || [],
      damping: 0.1,
    })),
  },
  // ... rest of state
};
```

### 2. Query Joints

```typescript
import { CANONICAL_JOINTS } from "@world-engine/wegc-geometry";

// Get position of any joint in T-pose
const headPos = CANONICAL_JOINTS["Head"];
console.log(`Head at:`, headPos); // { x: 0, y: 1.75, z: 0 }

// Get distance between joints
import { jointDistance } from "@world-engine/wegc-geometry";
const armLen = jointDistance("LeftShoulder", "LeftWrist");
console.log(`Arm span: ${armLen}m`);
```

### 3. Evaluate Pose Energy

```typescript
import { calculatePoseEnergy } from "@world-engine/wegc-geometry";

// After updating joint rotations in state...
const energy = calculatePoseEnergy(state);

if (energy.global > 0.5) {
  console.warn("Pose has significant constraint violations:");
  for (const violation of energy.violations) {
    console.log(`  ${violation.joint} on ${violation.axis}: ${violation.normalized_error.toFixed(2)}`);
  }
}
```

### 4. Set Rotation Constraints

```typescript
import { DEFAULT_ROTATION_LIMITS } from "@world-engine/wegc-geometry";

// Get constraints for a joint
const headLimits = DEFAULT_ROTATION_LIMITS["Head"];
console.log(`Head can rotate X: [${headLimits[0].hard_min_deg}°, ${headLimits[0].hard_max_deg}°]`);

// Switch constraint mode
state.skeleton.constraints.forEach((constraint) => {
  const newMode = "ACROBATIC"; // More flexible
  constraint.mode = newMode;
});
```

### 5. Handle IK Goals

```typescript
import {
  calculateGoalRisk,
  modulateIKWeight,
  redirectGoal,
} from "@world-engine/wegc-geometry";

const ikGoal = {
  id: "hand-grab-001",
  type: "hand" as const,
  target_position: { x: 0.5, y: 1.0, z: 0.5 },
  target_rotation: quatIdentity(),
  weight: 0.8,
};

// Check if goal is blocked by gear
const risk = calculateGoalRisk(ikGoal, state.geometry.gear_envelopes);
const modulatedWeight = modulateIKWeight(ikGoal.weight, risk, 2);

// Redirect if necessary
const redirectResult = redirectGoal(ikGoal, state.geometry.gear_envelopes, state);
if (redirectResult.redirected) {
  console.log("Goal redirected by", redirectResult.redirect_distance, "meters");
  ikGoal.target_position = redirectResult.new_target;
}
```

### 6. Multi-Contact Management

```typescript
import {
  initializeMultiContact,
  updateMultiContactState,
} from "@world-engine/wegc-geometry";

// Create new contact
let contact = initializeMultiContact("LeftPalm", 0.05);

// Update state with penetration info
const penetration = 0.03; // 3cm into surface
contact = updateMultiContactState(contact, penetration);
console.log(`Contact state: ${contact.stick_state}`);
```

### 7. Apply Temporal Stabilization

```typescript
import {
  stabilizeFaceFeatures,
  stabilizeBands,
  applyMicroJitterDamping,
} from "@world-engine/wegc-geometry";

// Smooth eye and mouth movement
let temporal = state.temporal;
temporal = stabilizeFaceFeatures(
  temporal,
  { x: 0, y: 1.78, z: 0.15 }, // Look forward
  { x: 0, y: 1.65, z: 0.08 }, // Mouth point
  0.016 // Delta time
);

// Smooth band positions
temporal = stabilizeBands(temporal, 0.016, limbSpeed);

// Filter jitter on contact point
const surfacePatchId = 16843009; // ChestPlate_Main
const { filtered, updated_temporal } = applyMicroJitterDamping(
  contactPoint,
  surfacePatchId,
  temporal,
  "leather", // material
  0.0001
);
temporal = updated_temporal;

state.temporal = temporal;
```

### 8. Export to GLB

```typescript
import { exportAvatarToGLB, type AvatarManifest } from "@world-engine/wegc-geometry";

const manifest: AvatarManifest = {
  version: "1.0",
  avatar_id: "char-001-abc123",
  created_at: Math.floor(Date.now() / 1000),
  modified_at: Math.floor(Date.now() / 1000),
  geometry_hash: hashCanonicalState(canonicalStringify(state.skeleton)),
  format: "glb",
  bone_count: state.skeleton.joints.length,
  material_slots: ["skin", "clothing"],
  metadata: {
    name: "My Avatar",
    description: "WEGC-compliant character",
    author: "game-dev",
    tags: ["player", "humanoid"],
  },
};

// Generate GLB buffer
const glbBuffer = await exportAvatarToGLB(state, manifest);

// Save to file (Node.js)
import { writeFile } from "fs/promises";
await writeFile("avatar.glb", Buffer.from(glbBuffer));

// Or download in browser
const blob = new Blob([glbBuffer], { type: "model/gltf-binary" });
const url = URL.createObjectURL(blob);
const link = document.createElement("a");
link.href = url;
link.download = "avatar.glb";
link.click();
```

### 9. Verify Determinism

```typescript
import { canonicalStringify, hashCanonicalState } from "@world-engine/wegc-geometry";

// Compute state hash
const stateString = canonicalStringify(state);
const stateHash = hashCanonicalState(stateString);

// Verify reproducibility
const stateString2 = canonicalStringify(state);
const stateHash2 = hashCanonicalState(stateString2);

console.assert(stateHash === stateHash2, "State hash mismatch!");

// Save certificate
import { generateDeterminismCertificate } from "@world-engine/wegc-geometry";
const cert = generateDeterminismCertificate(stateHash);
console.log("✓ Determinism verified:", cert);
```

## Common Patterns

### Pattern: Constrain a Bone

```typescript
function constrainBone(
  state: AvatarGeometryState,
  jointName: JointName,
  constraintMode: "DEFAULT" | "ARMOR_SAFE" | "ACROBATIC"
): void {
  state.skeleton.constraints.forEach((c) => {
    if (c.joint === jointName) {
      c.mode = constraintMode;
    }
  });
}

constrainBone(state, "Head", "ARMOR_SAFE");
```

### Pattern: Check if Pose is Valid

```typescript
function isPoseValid(
  state: AvatarGeometryState,
  maxEnergyThreshold: number = 0.3
): boolean {
  const energy = calculatePoseEnergy(state);
  return energy.global <= maxEnergyThreshold;
}

if (!isPoseValid(state, 0.2)) {
  console.warn("Pose exceeds 20% violation threshold");
}
```

### Pattern: Traverse Skeleton

```typescript
import { findDescendants } from "@world-engine/wegc-geometry";

function getAllLimbJoints(state: AvatarGeometryState): string[] {
  const limbJoints = state.skeleton.joints
    .filter((j) => j.limb_type === "limb")
    .map((j) => j.name);
  return limbJoints;
}

const limbs = getAllLimbJoints(state);
console.log("Limbs:", limbs);
```

### Pattern: Apply Pose from Quaternions

```typescript
function applyPose(
  state: AvatarGeometryState,
  rotations: Record<string, Quat>
): void {
  for (const [jointName, quat] of Object.entries(rotations)) {
    if (jointName in state.pose.joint_rotations) {
      state.pose.joint_rotations[jointName as JointName] = quat;
    }
  }

  // Re-compute energy
  state.pose.energy = calculatePoseEnergy(state);
}
```

## Integration with Other World Engine Systems

### With Nucleus (Sim Server)

```typescript
// In nucleus/src/handlers/avatar.handler.ts
import { calculatePoseEnergy } from "@world-engine/wegc-geometry";

export async function handleAvatarPoseUpdate(
  avatarId: string,
  newRotations: Record<string, Quat>,
  state: AvatarGeometryState
): Promise<void> {
  // Apply new pose
  for (const [joint, quat] of Object.entries(newRotations)) {
    state.pose.joint_rotations[joint as JointName] = quat;
  }

  // Validate
  const energy = calculatePoseEnergy(state);
  if (energy.global > 0.5) {
    throw new Error(`Pose too constrained: energy=${energy.global}`);
  }

  // Persist
  await saveState(avatarId, state);
}
```

### With IDE-Web (Frontend)

```typescript
// In ide-web/src/components/AvatarEditor.tsx
import { calculatePoseEnergy } from "@world-engine/wegc-geometry";

export function AvatarEditor({ state, onStateChange }: Props) {
  const [energy, setEnergy] = useState(0);

  useEffect(() => {
    const e = calculatePoseEnergy(state);
 setEnergy(e.global);
  }, [state]);

  return (
    <div>
      <PoseCanvas state={state} onChange={onStateChange} />
      <EnergyGauge value={energy} max={1} />
      {energy > 0.5 && <Alert>Pose has violations</Alert>}
    </div>
  );
}
```

### With Avatar Compiler

```typescript
// In avatar-compiler/src/compiler.ts
import { exportAvatarToGLB } from "@world-engine/wegc-geometry";

export async function compileAvatarDNA(dna: AvatarDNA): Promise<Buffer> {
  // Build geometry state from DNA
  const state = buildStateFromDNA(dna);

  // Create manifest
  const manifest = {
    version: "1.0",
    avatar_id: dna.avatar_id,
    // ...
  };

  // Export GLB
  const glbBuffer = await exportAvatarToGLB(state, manifest);
  return Buffer.from(glbBuffer);
}
```

## Testing WEGC Implementations

### Unit Test Example

```typescript
import { describe, it, expect } from "vitest";
import { calculatePoseEnergy } from "@world-engine/wegc-geometry";

describe("WEGC Pose Energy", () => {
  it("should compute zero energy for identity quaternions", () => {
    const identityState = initializeGeometryState();
    const energy = calculatePoseEnergy(identityState);

    expect(energy.global).toBe(0);
    expect(energy.violations).toHaveLength(0);
  });

  it("should detect constraint violations", () => {
    const state = initializeGeometryState();
    // Set head to extreme rotation
    state.pose.joint_rotations["Head"] = { x: 0.7, y: 0.7, z: 0, w: 0 };

    const energy = calculatePoseEnergy(state);
    expect(energy.global).toBeGreaterThan(0);
    expect(energy.violations.length).toBeGreaterThan(0);
  });
});
```

### Determinism Test Example

```typescript
import { assertDeterministic, canonicalStringify } from "@world-engine/wegc-geometry";

describe("WEGC Determinism", () => {
  it("should be reproducible across runs", () => {
    const runs = [
      createAvatarState(),
      createAvatarState(),
      createAvatarState(),
      createAvatarState(),
      createAvatarState(),
    ];

    const serialized = runs.map((r) => canonicalStringify(r));
    const allSame = serialized.every((s) => s === serialized[0]);

    expect(allSame).toBe(true);
    expect(assertDeterministic(runs, "avatar_state")).toBe(true);
  });
});
```

## Debugging

### Enable Debug Logging

```typescript
function logAvatarState(state: AvatarGeometryState): void {
  console.group("Avatar State Debug");
  console.log("Joints:", state.skeleton.joints.length);
  console.log("Constraints:", state.skeleton.constraints.length);

  const energy = calculatePoseEnergy(state);
  console.log("Pose Energy:", energy.global.toFixed(3));

  if (energy.violations.length > 0) {
    console.group("Violations");
    for (const v of energy.violations) {
      console.log(`  ${v.joint} (${v.axis}): ${v.normalized_error.toFixed(3)}`);
    }
    console.groupEnd();
  }

  console.log("Gear Envelopes:", state.geometry.gear_envelopes.length);
  console.log("IK Goals:", state.ik.goals.length);
  console.groupEnd();
}
```

### Inspect Joint Data

```typescript
function inspectJoint(state: AvatarGeometryState, jointName: string): void {
  const joint = state.skeleton.joints.find((j) => j.name === jointName);
  const quat = state.pose.joint_rotations[jointName as JointName];
  const energy = state.pose.energy.per_joint[jointName as JointName] ?? 0;

  console.log({
    name: joint?.name,
    position: joint?.position,
    rotation: quat,
    energy,
    limb_type: joint?.limb_type,
  });
}
```

## Performance Tips

1. **Cache skeleton builds**: Don't re-build canonical skeleton every frame
2. **Lazy evaluate energy**: Only compute when pose changes
3. **Batch contact updates**: Group contact changes together
4. **Use spatial hashing**: For gear envelope queries

```typescript
// Good: Build once
const skeleton = buildCanonicalSkeleton();

// Bad: Rebuilds every frame
function update() {
  const skeleton = buildCanonicalSkeleton(); // DON'T DO THIS
}
```

## FAQ

**Q: Can I add custom joints beyond the 55 canonical ones?**
A: WEGC defines a strict contract with exactly 55 joints. You can extend state structures for app-specific data, but core geometry must remain canonical.

**Q: How do I port a non-WEGC avatar to WEGC?**
A: Map your skeleton joints to the 55 canonical ones, then retarget animations. Some joints may not map 1:1.

**Q: What happens if I violate determinism?**
A: Use `assertDeterministic()` to catch violations during testing. Ensure no RNG, floating-point inconsistencies, or frame-order dependencies.

**Q: Can I use WEGC with procedural animation?**
A: Yes! WEGC only defines the static geometry. IK solvers, animation blending, etc., are separate systems.

---

**WEGC Integration Guide v1.0**
Part of World Engine Monorepo
Last Updated: 2026-02-25
