/**
 * World Engine Geometry Contract (WEGC) v1.0
 * Complete character geometry, IK, contact, and temporal stability system
 */

// Contract Types
export * from "./contract.types";

// Geometry Builder
export * from "./geometry.builder";

// Pose Energy & Constraints
export * from "./pose.energy";

// GLB Export & Manifest
export * from "./export.glb";

// IK & Contact Systems
export * from "./ik.contact";

// Temporal Stability
export * from "./temporal.stability";

// Helpers & Utilities
export {
    Quat,
    Time, Vec3, assertDeterministic, canonicalStringify, clamp, generateAvatarId, hashCanonicalState, isValidAvatarId, lerp
} from "./helpers";

// Version
export const WEGC_VERSION = "1.0.0";
export const WEGC_SPEC_DATE = "2026-02-25";

// Re-export canonical joints and hierarchy for convenience
export {
    CANONICAL_JOINTS,
    SKELETON_HIERARCHY,
    buildCanonicalSkeleton, quatIdentity as canonicalQuatIdentity,
    clampDegrees, findDescendants, jointDistance
} from "./geometry.builder";

// Re-export default constraints
export {
    DEFAULT_ROTATION_LIMITS,
    calculateConstraintPenalty,
    calculatePoseEnergy
} from "./pose.energy";
