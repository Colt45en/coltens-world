/**
 * Physics Module v1
 * Fixed timestep deterministic simulation with Euler integration
 *
 * Exports:
 * - stepPhysics: single timestep
 * - stepPhysicsBatch: multiple timesteps
 * - Determinism utils: cross-platform math
 * - Verification: prove determinism
 */

export {
    extractPhysicsState,
    stepPhysics,
    stepPhysicsBatch,
    verifyDeterminism
} from './stepper';

export {
    addVec3, applyDamping, clampValue,
    clampVec3, crossVec3, deterministicCos, deterministicSin, distanceVec3, dotVec3, lerpVec3, magnitudeVec3,
    normalizeVec3, quantizeAngle, quantizeScalar,
    quantizeVec3, scaleVec3
} from './determinism';
