/**
 * Pose Energy & Rotation Constraint System
 * Deterministic joint limit evaluation and energy aggregation
 */

import type {
  AvatarGeometryState,
  JointName,
  PoseEnergy,
  Quat,
  RotationLimit
} from "./contract.types.js";

/**
 * Default rotation limits per joint (ARMOR_SAFE mode)
 */
export const DEFAULT_ROTATION_LIMITS = Object.fromEntries(
  Object.entries({
    Hips: [
      { axis: "x", soft_min_deg: -45, soft_max_deg: 45, hard_min_deg: -60, hard_max_deg: 60, exponent: 2 },
      { axis: "y", soft_min_deg: -90, soft_max_deg: 90, hard_min_deg: -120, hard_max_deg: 120, exponent: 2 },
      { axis: "z", soft_min_deg: -30, soft_max_deg: 30, hard_min_deg: -45, hard_max_deg: 45, exponent: 2 },
    ],
    Spine: [
      { axis: "x", soft_min_deg: -30, soft_max_deg: 30, hard_min_deg: -45, hard_max_deg: 45, exponent: 2 },
      { axis: "y", soft_min_deg: -45, soft_max_deg: 45, hard_min_deg: -60, hard_max_deg: 60, exponent: 2 },
      { axis: "z", soft_min_deg: -20, soft_max_deg: 20, hard_min_deg: -30, hard_max_deg: 30, exponent: 2 },
    ],
    Chest: [
      { axis: "x", soft_min_deg: -25, soft_max_deg: 25, hard_min_deg: -40, hard_max_deg: 40, exponent: 2 },
      { axis: "y", soft_min_deg: -35, soft_max_deg: 35, hard_min_deg: -50, hard_max_deg: 50, exponent: 2 },
      { axis: "z", soft_min_deg: -15, soft_max_deg: 15, hard_min_deg: -25, hard_max_deg: 25, exponent: 2 },
    ],
    Neck: [
      { axis: "x", soft_min_deg: -40, soft_max_deg: 40, hard_min_deg: -60, hard_max_deg: 60, exponent: 2 },
      { axis: "y", soft_min_deg: -80, soft_max_deg: 80, hard_min_deg: -90, hard_max_deg: 90, exponent: 1.5 },
      { axis: "z", soft_min_deg: -30, soft_max_deg: 30, hard_min_deg: -45, hard_max_deg: 45, exponent: 2 },
    ],
    Head: [
      { axis: "x", soft_min_deg: -30, soft_max_deg: 30, hard_min_deg: -45, hard_max_deg: 45, exponent: 2 },
      { axis: "y", soft_min_deg: -60, soft_max_deg: 60, hard_min_deg: -90, hard_max_deg: 90, exponent: 2 },
      { axis: "z", soft_min_deg: -25, soft_max_deg: 25, hard_min_deg: -40, hard_max_deg: 40, exponent: 2 },
    ],
    LeftShoulder: [
      { axis: "x", soft_min_deg: -45, soft_max_deg: 90, hard_min_deg: -60, hard_max_deg: 120, exponent: 1.8 },
      { axis: "y", soft_min_deg: -40, soft_max_deg: 130, hard_min_deg: -50, hard_max_deg: 150, exponent: 1.8 },
      { axis: "z", soft_min_deg: -60, soft_max_deg: 30, hard_min_deg: -90, hard_max_deg: 45, exponent: 2 },
    ],
    RightShoulder: [
      { axis: "x", soft_min_deg: -45, soft_max_deg: 90, hard_min_deg: -60, hard_max_deg: 120, exponent: 1.8 },
      { axis: "y", soft_min_deg: -130, soft_max_deg: 40, hard_min_deg: -150, hard_max_deg: 50, exponent: 1.8 },
      { axis: "z", soft_min_deg: -30, soft_max_deg: 60, hard_min_deg: -45, hard_max_deg: 90, exponent: 2 },
    ],
    LeftElbow: [
      { axis: "x", soft_min_deg: -0, soft_max_deg: 0, hard_min_deg: -5, hard_max_deg: 5, exponent: 3 },
      { axis: "y", soft_min_deg: 0, soft_max_deg: 150, hard_min_deg: -10, hard_max_deg: 170, exponent: 2 },
      { axis: "z", soft_min_deg: -100, soft_max_deg: 10, hard_min_deg: -120, hard_max_deg: 20, exponent: 2 },
    ],
    RightElbow: [
      { axis: "x", soft_min_deg: -0, soft_max_deg: 0, hard_min_deg: -5, hard_max_deg: 5, exponent: 3 },
      { axis: "y", soft_min_deg: -150, soft_max_deg: 0, hard_min_deg: -170, hard_max_deg: 10, exponent: 2 },
      { axis: "z", soft_min_deg: -10, soft_max_deg: 100, hard_min_deg: -20, hard_max_deg: 120, exponent: 2 },
    ],
    LeftWrist: [
      { axis: "x", soft_min_deg: -80, soft_max_deg: 80, hard_min_deg: -90, hard_max_deg: 90, exponent: 1.5 },
      { axis: "y", soft_min_deg: -45, soft_max_deg: 45, hard_min_deg: -60, hard_max_deg: 60, exponent: 1.8 },
      { axis: "z", soft_min_deg: -45, soft_max_deg: 45, hard_min_deg: -70, hard_max_deg: 70, exponent: 1.8 },
    ],
    RightWrist: [
      { axis: "x", soft_min_deg: -80, soft_max_deg: 80, hard_min_deg: -90, hard_max_deg: 90, exponent: 1.5 },
      { axis: "y", soft_min_deg: -45, soft_max_deg: 45, hard_min_deg: -60, hard_max_deg: 60, exponent: 1.8 },
      { axis: "z", soft_min_deg: -45, soft_max_deg: 45, hard_min_deg: -70, hard_max_deg: 70, exponent: 1.8 },
    ],
    LeftHip: [
      { axis: "x", soft_min_deg: -45, soft_max_deg: 45, hard_min_deg: -70, hard_max_deg: 70, exponent: 1.8 },
      { axis: "y", soft_min_deg: -45, soft_max_deg: 45, hard_min_deg: -70, hard_max_deg: 70, exponent: 1.8 },
      { axis: "z", soft_min_deg: -30, soft_max_deg: 30, hard_min_deg: -50, hard_max_deg: 50, exponent: 2 },
    ],
    RightHip: [
      { axis: "x", soft_min_deg: -45, soft_max_deg: 45, hard_min_deg: -70, hard_max_deg: 70, exponent: 1.8 },
      { axis: "y", soft_min_deg: -45, soft_max_deg: 45, hard_min_deg: -70, hard_max_deg: 70, exponent: 1.8 },
      { axis: "z", soft_min_deg: -30, soft_max_deg: 30, hard_min_deg: -50, hard_max_deg: 50, exponent: 2 },
    ],
    LeftKnee: [
      { axis: "x", soft_min_deg: -0, soft_max_deg: 0, hard_min_deg: -10, hard_max_deg: 10, exponent: 3 },
      { axis: "y", soft_min_deg: -5, soft_max_deg: 140, hard_min_deg: -15, hard_max_deg: 160, exponent: 2 },
      { axis: "z", soft_min_deg: -15, soft_max_deg: 15, hard_min_deg: -30, hard_max_deg: 30, exponent: 2 },
    ],
    RightKnee: [
      { axis: "x", soft_min_deg: -0, soft_max_deg: 0, hard_min_deg: -10, hard_max_deg: 10, exponent: 3 },
      { axis: "y", soft_min_deg: -5, soft_max_deg: 140, hard_min_deg: -15, hard_max_deg: 160, exponent: 2 },
      { axis: "z", soft_min_deg: -15, soft_max_deg: 15, hard_min_deg: -30, hard_max_deg: 30, exponent: 2 },
    ],
    LeftAnkle: [
      { axis: "x", soft_min_deg: -20, soft_max_deg: 30, hard_min_deg: -30, hard_max_deg: 45, exponent: 2 },
      { axis: "y", soft_min_deg: -20, soft_max_deg: 20, hard_min_deg: -35, hard_max_deg: 35, exponent: 2 },
      { axis: "z", soft_min_deg: -25, soft_max_deg: 25, hard_min_deg: -40, hard_max_deg: 40, exponent: 2 },
    ],
    RightAnkle: [
      { axis: "x", soft_min_deg: -20, soft_max_deg: 30, hard_min_deg: -30, hard_max_deg: 45, exponent: 2 },
      { axis: "y", soft_min_deg: -20, soft_max_deg: 20, hard_min_deg: -35, hard_max_deg: 35, exponent: 2 },
      { axis: "z", soft_min_deg: -25, soft_max_deg: 25, hard_min_deg: -40, hard_max_deg: 40, exponent: 2 },
    ],
  } as Record<string, RotationLimit[]>).concat(
    (["Jaw", "LeftPalm", "RightPalm", "LeftClavicle", "RightClavicle", "LeftEye", "RightEye",
      "LeftThumb1", "LeftThumb2", "LeftThumb3", "LeftIndex1", "LeftIndex2", "LeftIndex3",
      "LeftMiddle1", "LeftMiddle2", "LeftMiddle3", "LeftRing1", "LeftRing2", "LeftRing3",
      "LeftLittle1", "LeftLittle2", "LeftLittle3", "RightThumb1", "RightThumb2", "RightThumb3",
      "RightIndex1", "RightIndex2", "RightIndex3", "RightMiddle1", "RightMiddle2", "RightMiddle3",
      "RightRing1", "RightRing2", "RightRing3", "RightLittle1", "RightLittle2", "RightLittle3"
    ] as const).map(j => [j, [
      { axis: "x", soft_min_deg: -90, soft_max_deg: 90, hard_min_deg: -120, hard_max_deg: 120, exponent: 1.5 },
      { axis: "y", soft_min_deg: -90, soft_max_deg: 90, hard_min_deg: -120, hard_max_deg: 120, exponent: 1.5 },
      { axis: "z", soft_min_deg: -90, soft_max_deg: 90, hard_min_deg: -120, hard_max_deg: 120, exponent: 1.5 },
    ]])
  )
) as Record<JointName, RotationLimit[]>;

/**
 * Convert Euler angles (radians) to degrees
 */
function radToDeg(rad: number): number {
  return rad * (180 / Math.PI);
}

/**
 * Soft clamp with exponent-based barrier
 */function softClamp(value: number, min: number, max: number, exponent: number): { clamped: number; penalty: number } {
  if (value >= min && value <= max) {
    return { clamped: value, penalty: 0 };
  }

  let penalty = 0;
  let clamped = value;

  if (value < min) {
    const delta = min - value;
    penalty = Math.pow(delta / (min - (min - 90)), exponent);
    clamped = min;
  } else if (value > max) {
    const delta = value - max;
    penalty = Math.pow(delta / (max + 90 - max), exponent);
    clamped = max;
  }

  return { clamped: Math.max(0, Math.min(1, penalty)), penalty };
}

/**
 * Calculate rotation constraint penalties (Yaw -> Pitch -> Roll order)
 */
export function calculateConstraintPenalty(
  quat: Quat,
  limits: RotationLimit[]
): PoseEnergy {
  const euler = quatToEuler(quat);
  const x_deg = radToDeg(euler.x);
  const y_deg = radToDeg(euler.y);
  const z_deg = radToDeg(euler.z);

  const order = ["y", "x", "z"] as const; // Deterministic clamp order: Yaw -> Pitch -> Roll
  const violations: PoseEnergy["violations"] = [];

  let accumEnergy = 0;

  for (const axis of order) {
    const limit = limits.find((l) => l.axis === axis);
    if (!limit) continue;

    const value = axis === "x" ? x_deg : axis === "y" ? y_deg : z_deg;
    const { penalty } = softClamp(value, limit.soft_min_deg, limit.soft_max_deg, limit.exponent);

    if (penalty > 0) {
      violations.push({
        joint: "" as JointName, // Filled by caller
        axis,
        normalized_error: penalty,
      });
    }

    accumEnergy += penalty;
  }

  return {
    global: Math.min(1, accumEnergy / 3),
    per_joint: {} as Record<JointName, number>,
    violations,
  };
}

/**
 * Convert quaternion to Euler angles (XYZ extrinsic)
 */
function quatToEuler(q: Quat): { x: number; y: number; z: number } {
  const { x, y, z, w } = q;

  // Roll (x-axis rotation)
  const sinr_cosp = 2 * (w * x + y * z);
  const cosr_cosp = 1 - 2 * (x * x + y * y);
  const roll = Math.atan2(sinr_cosp, cosr_cosp);

  // Pitch (y-axis rotation)
  const sinp = 2 * (w * y - z * x);
  const pitch = Math.abs(sinp) >= 1 ? Math.sign(sinp) * (Math.PI / 2) : Math.asin(sinp);

  // Yaw (z-axis rotation)
  const siny_cosp = 2 * (w * z + x * y);
  const cosy_cosp = 1 - 2 * (y * y + z * z);
  const yaw = Math.atan2(siny_cosp, cosy_cosp);

  return { x: roll, y: pitch, z: yaw };
}

/**
 * Calculate aggregated pose energy for entire state
 */
export function calculatePoseEnergy(state: AvatarGeometryState): PoseEnergy {
  let globalEnergy = 0;
  const perJoint: Record<JointName | string, number> = {};
  const violations: PoseEnergy["violations"] = [];

  for (const constraint of state.skeleton.constraints) {
    const quat = state.pose.joint_rotations[constraint.joint];
    if (!quat) continue;

    const energy = calculateConstraintPenalty(quat, constraint.limits);
    perJoint[constraint.joint] = energy.global;
    globalEnergy += energy.global;
    violations.push(...energy.violations);
  }

  const jointCount = state.skeleton.constraints.length || 1;
  return {
    global: Math.min(1, globalEnergy / jointCount),
    per_joint: perJoint as Record<JointName, number>,
    violations,
  };
}
