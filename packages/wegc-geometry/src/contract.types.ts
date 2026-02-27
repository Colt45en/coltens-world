/**
 * World Engine Geometry Contract (WEGC) v1.0
 * Canonical types and interfaces for deterministic character geometry
 */

export type JointName =
  | "Hips"
  | "Spine"
  | "Chest"
  | "Neck"
  | "Head"
  | "LeftEye"
  | "RightEye"
  | "LeftClavicle"
  | "RightClavicle"
  | "LeftShoulder"
  | "RightShoulder"
  | "LeftElbow"
  | "RightElbow"
  | "LeftWrist"
  | "RightWrist"
  | "LeftPalm"
  | "RightPalm"
  | "LeftHip"
  | "RightHip"
  | "LeftKnee"
  | "RightKnee"
  | "LeftAnkle"
  | "RightAnkle"
  // Left Fingers (Thumb, Index, Middle, Ring, Little)
  | "LeftThumb1"
  | "LeftThumb2"
  | "LeftThumb3"
  | "LeftIndex1"
  | "LeftIndex2"
  | "LeftIndex3"
  | "LeftMiddle1"
  | "LeftMiddle2"
  | "LeftMiddle3"
  | "LeftRing1"
  | "LeftRing2"
  | "LeftRing3"
  | "LeftLittle1"
  | "LeftLittle2"
  | "LeftLittle3"
  // Right Fingers (Thumb, Index, Middle, Ring, Little)
  | "RightThumb1"
  | "RightThumb2"
  | "RightThumb3"
  | "RightIndex1"
  | "RightIndex2"
  | "RightIndex3"
  | "RightMiddle1"
  | "RightMiddle2"
  | "RightMiddle3"
  | "RightRing1"
  | "RightRing2"
  | "RightRing3"
  | "RightLittle1"
  | "RightLittle2"
  | "RightLittle3"
  | "Jaw";

/** Vector3 representation */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Quaternion representation */
export interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}

/**
 * Joint Definition: Position, parent, and metadata
 */
export interface JointDef {
  name: JointName;
  position: Vec3; // World-space canonical position (T-pose)
  parentName: JointName | null; // null for root (Hips)
  limb_type: "spine" | "limb" | "finger" | "eye" | "jaw";
  radius: number; // Capsule/sphere radius (m)
}

/**
 * Rotation Limit: Soft/hard constraints per axis (X, Y, Z)
 */
export interface RotationLimit {
  axis: "x" | "y" | "z";
  soft_min_deg: number;
  soft_max_deg: number;
  hard_min_deg: number;
  hard_max_deg: number;
  exponent: number; // Barrier curve steepness
}

/**
 * Joint Constraint Set
 */
export interface JointConstraint {
  joint: JointName;
  mode: "DEFAULT" | "ARMOR_SAFE" | "ACROBATIC";
  limits: RotationLimit[];
  damping: number; // Velocity damping
}

/**
 * Discrete quantized surface patch for deterministic contact
 */
export interface SurfacePatch {
  id: number; // Hash of (type, subtype, offset)
  type: "OBB" | "Capsule"; // Envelope type
  subtype: string; // e.g., "chest_main", "left_forearm"
  local_offset: Vec3; // Relative to attachment frame
}

/**
 * Gear Envelope: OBB or Capsule
 */
export interface GearEnvelope {
  id: string;
  type: "OBB" | "Capsule";
  attachment_joint: JointName;
  local_from: Vec3;
  local_to: Vec3; // For capsule
  half_extents: Vec3; // For OBB
  rotation: Quat;
  risk_threshold: number; // Signed distance warning
  max_surface_patches: number;
}

/**
 * Pose Energy: Normalized 0–1 penetration score
 */
export interface PoseEnergy {
  global: number; // [0, 1] aggregate
  per_joint: Record<JointName, number>;
  violations: Array<{
    joint: JointName;
    axis: "x" | "y" | "z";
    normalized_error: number;
  }>;
}

/**
 * IK Goal
 */
export interface IKGoal {
  id: string;
  type: "foot" | "hand" | "style_point";
  target_position: Vec3;
  target_rotation?: Quat;
  weight: number; // [0, 1]
  goal_risk?: number; // Aggregated risk from gear
  redirected?: {
    original_target: Vec3;
    redirect_distance: number;
  };
}

/**
 * Contact Surface (geometry-specific)
 */
export interface ContactSurface {
  patch_id: number;
  contact_point: Vec3;
  normal: Vec3;
  penetration_depth: number;
  material: "skin" | "leather" | "steel" | "cloth" | "generic";
  compliance_coefficient: number; // Material-based
}

/**
 * Contact Channel (per-limb contact type)
 */
export type ContactChannel = "Palm" | "Fingertips" | "Wrist" | "Elbow";

/**
 * Multi-Contact: Aggregated contact state
 */
export interface MultiContact {
  limb: JointName;
  channels: Map<ContactChannel, ContactSurface[]>;
  stick_state: "engaged" | "sliding" | "released";
  engage_threshold: number;
  release_threshold: number;
  surface_patch_stack: number[]; // Quantized surface IDs
  leader_patch_id?: number; // Stack leadership
  weight_budget: number; // Normalized to [0, 1]
}

/**
 * Contact Stack Member
 */
export interface StackMember {
  surface_patch_id: number;
  weight: number;
  friction_state: "static" | "sliding";
  tangential_force_magnitude: number;
  member_multiplier: number; // Load-based
}

/**
 * Temporal Stability State
 */
export interface TemporalState {
  face_features: {
    eye_mid: Vec3;
    mouth_point: Vec3;
    stabilization_alpha: number;
  };
  bands: Array<{
    band_type: "belt" | "collar" | "limb";
    target_position: Vec3;
    current_position: Vec3;
    speed_aware_alpha: number;
  }>;
  micro_jitter_filter: Map<number, JitterFilter>; // patch_id -> filter state
}

/**
 * Adaptive jitter filter state
 */
export interface JitterFilter {
  deadband: number;
  low_pass_alpha: number;
  last_value: Vec3;
  last_filtered: Vec3;
}

/**
 * Complete Avatar Geometry State
 */
export interface AvatarGeometryState {
  version: "1.0";
  skeleton: {
    joints: JointDef[];
    constraints: JointConstraint[];
  };
  geometry: {
    capsule_limbs: Array<{
      from_joint: JointName;
      to_joint: JointName;
      radius: number;
    }>;
    gear_envelopes: GearEnvelope[];
  };
  pose: {
    joint_rotations: Record<JointName, Quat>;
    energy: PoseEnergy;
  };
  ik: {
    goals: IKGoal[];
    weights_per_goal: Map<string, number>;
  };
  contact: {
    multi_contacts: Map<JointName, MultiContact>;
    surface_patches: SurfacePatch[];
    active_stacks: Map<number, StackMember[]>;
  };
  temporal: TemporalState;
}

/**
 * Determinism Certificate
 */
export interface DeterminismCertificate {
  timestamp: number; // Unix seconds
  execution_hash: string; // SHA256 of final state
  hardware_id?: string; // Optional hardware signature
  reproducible: boolean;
  tie_break_order: string[]; // Fixed order for deterministic choices
}
