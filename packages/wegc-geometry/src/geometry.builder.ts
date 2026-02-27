/**
 * Canonical Geometry Builder
 * Deterministic skeleton and capsule-based limb construction
 */

import type { JointDef, JointName, Quat, Vec3 } from "./contract.types.js";

/**
 * Canonical T-pose joint positions (meters)
 * Determined by WEGC v1.0 spec
 */
export const CANONICAL_JOINTS: Record<JointName, Vec3> = {
  // Spine
  Hips: { x: 0, y: 0.95, z: 0 },
  Spine: { x: 0, y: 1.1, z: 0 },
  Chest: { x: 0, y: 1.35, z: 0 },
  Neck: { x: 0, y: 1.55, z: 0 },
  Head: { x: 0, y: 1.75, z: 0 },
  Jaw: { x: 0, y: 1.65, z: 0 },

  // Eyes
  LeftEye: { x: 0.04, y: 1.78, z: 0.09 },
  RightEye: { x: -0.04, y: 1.78, z: 0.09 },

  // Left arm
  LeftClavicle: { x: 0.15, y: 1.45, z: 0 },
  LeftShoulder: { x: 0.18, y: 1.42, z: 0 },
  LeftElbow: { x: 0.45, y: 1.42, z: 0 },
  LeftWrist: { x: 0.72, y: 1.42, z: 0 },
  LeftPalm: { x: 0.795, y: 1.42, z: 0 },

  // Right arm
  RightClavicle: { x: -0.15, y: 1.45, z: 0 },
  RightShoulder: { x: -0.18, y: 1.42, z: 0 },
  RightElbow: { x: -0.45, y: 1.42, z: 0 },
  RightWrist: { x: -0.72, y: 1.42, z: 0 },
  RightPalm: { x: -0.795, y: 1.42, z: 0 },

  // Left hand fingers
  LeftThumb1: { x: 0.76, y: 1.39, z: -0.02 },
  LeftThumb2: { x: 0.78, y: 1.38, z: -0.025 },
  LeftThumb3: { x: 0.80, y: 1.37, z: -0.03 },
  LeftIndex1: { x: 0.82, y: 1.44, z: 0 },
  LeftIndex2: { x: 0.85, y: 1.44, z: 0 },
  LeftIndex3: { x: 0.88, y: 1.44, z: 0 },
  LeftMiddle1: { x: 0.82, y: 1.44, z: -0.01 },
  LeftMiddle2: { x: 0.85, y: 1.44, z: -0.01 },
  LeftMiddle3: { x: 0.88, y: 1.44, z: -0.01 },
  LeftRing1: { x: 0.82, y: 1.44, z: -0.02 },
  LeftRing2: { x: 0.85, y: 1.44, z: -0.02 },
  LeftRing3: { x: 0.88, y: 1.44, z: -0.02 },
  LeftLittle1: { x: 0.80, y: 1.43, z: -0.03 },
  LeftLittle2: { x: 0.83, y: 1.43, z: -0.03 },
  LeftLittle3: { x: 0.86, y: 1.43, z: -0.03 },

  // Right hand fingers (mirrored)
  RightThumb1: { x: -0.76, y: 1.39, z: -0.02 },
  RightThumb2: { x: -0.78, y: 1.38, z: -0.025 },
  RightThumb3: { x: -0.80, y: 1.37, z: -0.03 },
  RightIndex1: { x: -0.82, y: 1.44, z: 0 },
  RightIndex2: { x: -0.85, y: 1.44, z: 0 },
  RightIndex3: { x: -0.88, y: 1.44, z: 0 },
  RightMiddle1: { x: -0.82, y: 1.44, z: -0.01 },
  RightMiddle2: { x: -0.85, y: 1.44, z: -0.01 },
  RightMiddle3: { x: -0.88, y: 1.44, z: -0.01 },
  RightRing1: { x: -0.82, y: 1.44, z: -0.02 },
  RightRing2: { x: -0.85, y: 1.44, z: -0.02 },
  RightRing3: { x: -0.88, y: 1.44, z: -0.02 },
  RightLittle1: { x: -0.80, y: 1.43, z: -0.03 },
  RightLittle2: { x: -0.83, y: 1.43, z: -0.03 },
  RightLittle3: { x: -0.86, y: 1.43, z: -0.03 },

  // Left leg
  LeftHip: { x: 0.1, y: 0.9, z: 0 },
  LeftKnee: { x: 0.12, y: 0.5, z: 0 },
  LeftAnkle: { x: 0.12, y: 0.1, z: 0 },

  // Right leg (mirrored)
  RightHip: { x: -0.1, y: 0.9, z: 0 },
  RightKnee: { x: -0.12, y: 0.5, z: 0 },
  RightAnkle: { x: -0.12, y: 0.1, z: 0 },
} as const;

/**
 * Canonical skeleton hierarchy
 */
export const SKELETON_HIERARCHY: Array<[JointName, JointName | null]> = [
  // Spine
  ["Hips", null],
  ["Spine", "Hips"],
  ["Chest", "Spine"],
  ["Neck", "Chest"],
  ["Head", "Neck"],
  ["Jaw", "Head"],

  // Eyes
  ["LeftEye", "Head"],
  ["RightEye", "Head"],

  // Left arm
  ["LeftClavicle", "Chest"],
  ["LeftShoulder", "LeftClavicle"],
  ["LeftElbow", "LeftShoulder"],
  ["LeftWrist", "LeftElbow"],
  ["LeftPalm", "LeftWrist"],

  // Right arm
  ["RightClavicle", "Chest"],
  ["RightShoulder", "RightClavicle"],
  ["RightElbow", "RightShoulder"],
  ["RightWrist", "RightElbow"],
  ["RightPalm", "RightWrist"],

  // Left fingers
  ["LeftThumb1", "LeftPalm"],
  ["LeftThumb2", "LeftThumb1"],
  ["LeftThumb3", "LeftThumb2"],
  ["LeftIndex1", "LeftPalm"],
  ["LeftIndex2", "LeftIndex1"],
  ["LeftIndex3", "LeftIndex2"],
  ["LeftMiddle1", "LeftPalm"],
  ["LeftMiddle2", "LeftMiddle1"],
  ["LeftMiddle3", "LeftMiddle2"],
  ["LeftRing1", "LeftPalm"],
  ["LeftRing2", "LeftRing1"],
  ["LeftRing3", "LeftRing2"],
  ["LeftLittle1", "LeftPalm"],
  ["LeftLittle2", "LeftLittle1"],
  ["LeftLittle3", "LeftLittle2"],

  // Right fingers
  ["RightThumb1", "RightPalm"],
  ["RightThumb2", "RightThumb1"],
  ["RightThumb3", "RightThumb2"],
  ["RightIndex1", "RightPalm"],
  ["RightIndex2", "RightIndex1"],
  ["RightIndex3", "RightIndex2"],
  ["RightMiddle1", "RightPalm"],
  ["RightMiddle2", "RightMiddle1"],
  ["RightMiddle3", "RightMiddle2"],
  ["RightRing1", "RightPalm"],
  ["RightRing2", "RightRing1"],
  ["RightRing3", "RightRing2"],
  ["RightLittle1", "RightPalm"],
  ["RightLittle2", "RightLittle1"],
  ["RightLittle3", "RightLittle2"],

  // Left leg
  ["LeftHip", "Hips"],
  ["LeftKnee", "LeftHip"],
  ["LeftAnkle", "LeftKnee"],

  // Right leg
  ["RightHip", "Hips"],
  ["RightKnee", "RightHip"],
  ["RightAnkle", "RightKnee"],
];

/**
 * Canonical radius definitions (meters)
 */
const CANONICAL_RADII: Record<JointName, number> = {
  Hips: 0.08,
  Spine: 0.07,
  Chest: 0.09,
  Neck: 0.04,
  Head: 0.11,
  Jaw: 0.06,
  LeftEye: 0.012,
  RightEye: 0.012,
  LeftClavicle: 0.035,
  RightClavicle: 0.035,
  LeftShoulder: 0.055,
  RightShoulder: 0.055,
  LeftElbow: 0.04,
  RightElbow: 0.04,
  LeftWrist: 0.032,
  RightWrist: 0.032,
  LeftPalm: 0.038,
  RightPalm: 0.038,
  LeftHip: 0.07,
  RightHip: 0.07,
  LeftKnee: 0.052,
  RightKnee: 0.052,
  LeftAnkle: 0.035,
  RightAnkle: 0.035,
  LeftThumb1: 0.01,
  LeftThumb2: 0.008,
  LeftThumb3: 0.006,
  LeftIndex1: 0.01,
  LeftIndex2: 0.008,
  LeftIndex3: 0.006,
  LeftMiddle1: 0.01,
  LeftMiddle2: 0.008,
  LeftMiddle3: 0.006,
  LeftRing1: 0.01,
  LeftRing2: 0.008,
  LeftRing3: 0.006,
  LeftLittle1: 0.009,
  LeftLittle2: 0.007,
  LeftLittle3: 0.005,
  RightThumb1: 0.01,
  RightThumb2: 0.008,
  RightThumb3: 0.006,
  RightIndex1: 0.01,
  RightIndex2: 0.008,
  RightIndex3: 0.006,
  RightMiddle1: 0.01,
  RightMiddle2: 0.008,
  RightMiddle3: 0.006,
  RightRing1: 0.01,
  RightRing2: 0.008,
  RightRing3: 0.006,
  RightLittle1: 0.009,
  RightLittle2: 0.007,
  RightLittle3: 0.005,
};

/**
 * Build canonical joint definitions
 */
export function buildCanonicalSkeleton(): JointDef[] {
  const joints: JointDef[] = [];

  for (const [child, parent] of SKELETON_HIERARCHY) {
    const position = CANONICAL_JOINTS[child];
    const radius = CANONICAL_RADII[child] ?? 0.05;

    joints.push({
      name: child,
      position,
      parentName: parent,
      limb_type: getLimbType(child),
      radius,
    });
  }

  return joints;
}

/**
 * Determine limb type
 */
function getLimbType(
  joint: JointName
): "spine" | "limb" | "finger" | "eye" | "jaw" {
  if (joint.includes("Eye")) return "eye";
  if (joint === "Jaw") return "jaw";
  if (joint.match(/Thumb|Index|Middle|Ring|Little/)) return "finger";
  if (
    joint.match(
      /Spine|Chest|Neck|Head|Hip|Knee|Ankle|Shoulder|Elbow|Wrist|Clavicle/
    )
  ) {
    return joint.includes("Spine") || joint === "Chest" || joint === "Neck" || joint === "Head" ? "spine" : "limb";
  }
  return "limb";
}

/**
 * Distance between two joints
 */
export function jointDistance(from: JointName, to: JointName): number {
  const p1 = CANONICAL_JOINTS[from];
  const p2 = CANONICAL_JOINTS[to];
  if (!p1 || !p2) return 0;

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dz = p2.z - p1.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Find all descendants of a joint
 */
export function findDescendants(parentName: JointName): JointName[] {
  const descendants: JointName[] = [];
  const visited = new Set<JointName>();

  function traverse(name: JointName) {
    if (visited.has(name)) return;
    visited.add(name);

    for (const [child, parent] of SKELETON_HIERARCHY) {
      if (parent === name) {
        descendants.push(child);
        traverse(child);
      }
    }
  }

  traverse(parentName);
  return descendants;
}

/**
 * Identity quaternion
 */
export function quatIdentity(): Quat {
  return { x: 0, y: 0, z: 0, w: 1 };
}

/**
 * Clamp rotation to degrees
 */
export function clampDegrees(deg: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, deg));
}
