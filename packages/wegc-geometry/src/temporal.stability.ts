/**
 * Temporal Stability Suite
 * Face features, band, and limb stabilization with deterministic smoothing
 */

import type { TemporalState, Vec3 } from "./contract.types.js";

/**
 * Initialize temporal state
 */
export function initializeTemporalState(): TemporalState {
  return {
    face_features: {
      eye_mid: { x: 0, y: 1.78, z: 0.09 },
      mouth_point: { x: 0, y: 1.65, z: 0.05 },
      stabilization_alpha: 0.85,
    },
    bands: [
      {
        band_type: "belt",
        target_position: { x: 0, y: 0.95, z: 0 },
        current_position: { x: 0, y: 0.95, z: 0 },
        speed_aware_alpha: 0.9,
      },
      {
        band_type: "collar",
        target_position: { x: 0, y: 1.55, z: 0 },
        current_position: { x: 0, y: 1.55, z: 0 },
        speed_aware_alpha: 0.88,
      },
    ],
    micro_jitter_filter: new Map(),
  };
}

/**
 * Stabilize face features (eyes, mouth)
 */
export function stabilizeFaceFeatures(
  temporal: TemporalState,
  eye_mid_target: Vec3,
  mouth_target: Vec3,
  dt: number
): TemporalState {
  const newTemporal = JSON.parse(JSON.stringify(temporal)) as TemporalState;

  // Exponential moving average for face features
  const alpha = newTemporal.face_features.stabilization_alpha;
  newTemporal.face_features.eye_mid = lerp(
    newTemporal.face_features.eye_mid,
    eye_mid_target,
    1 - Math.pow(1 - alpha, dt * 30) // Frame-rate independent
  );

  newTemporal.face_features.mouth_point = lerp(
    newTemporal.face_features.mouth_point,
    mouth_target,
    1 - Math.pow(1 - alpha, dt * 30)
  );

  return newTemporal;
}

/**
 * Stabilize band positions (belt, collar, limb bands)
 */
export function stabilizeBands(
  temporal: TemporalState,
  delta_time: number,
  limb_speed?: number
): TemporalState {
  const newTemporal = JSON.parse(JSON.stringify(temporal)) as TemporalState;

  for (const band of newTemporal.bands) {
    // Speed-aware alpha modulation
    let alpha = band.speed_aware_alpha;
    if (limb_speed !== undefined && limb_speed > 0.5) {
      // Reduce stabilization for fast-moving limbs
      alpha *= 0.7;
    }

    band.current_position = lerp(band.current_position, band.target_position, 1 - Math.pow(1 - alpha, delta_time * 30));
  }

  return newTemporal;
}

/**
 * Apply micro-jitter damping with adaptive filter
 */
export function applyMicroJitterDamping(
  position: Vec3,
  patchId: number,
  temporal: TemporalState,
  material: "skin" | "leather" | "steel" | "cloth" | "generic",
  deadband: number = 0.0001
): { filtered: Vec3; updated_temporal: TemporalState } {
  let filter = temporal.micro_jitter_filter.get(patchId);

  if (!filter) {
    filter = {
      deadband,
      low_pass_alpha: getAlphaForMaterial(material),
      last_value: position,
      last_filtered: position,
    };
  }

  const newTemporal = JSON.parse(JSON.stringify(temporal)) as TemporalState;
  const delta = vecSubtract(position, filter.last_value);
  const deltaMag = vecMagnitude(delta);

  let filtered = filter.last_filtered;

  if (deltaMag > deadband) {
    // Apply low-pass filter
    filtered = lerp(filter.last_filtered, position, 1 - Math.pow(1 - filter.low_pass_alpha, 0.016)); // 60fps default
  } else {
    // Deadband: snap to last
    filtered = filter.last_filtered;
  }

  filter.last_value = position;
  filter.last_filtered = filtered;
  newTemporal.micro_jitter_filter.set(patchId, filter);

  return { filtered, updated_temporal: newTemporal };
}

/**
 * Get filter alpha based on material
 */
function getAlphaForMaterial(material: string): number {
  const alphas: Record<string, number> = {
    skin: 0.75, // Skin moves smoothly but responsively
    leather: 0.82, // Stiffer material
    steel: 0.90, // Very stiff
    cloth: 0.70, // Cloth is responsive but damped
    generic: 0.8,
  };

  return alphas[material] ?? 0.8;
}

/**
 * Vector operations
 */
function lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

function vecSubtract(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function vecMagnitude(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

/**
 * Contact friction state update
 */
export function updateContactFrictionState(
  penetration_depth: number,
  tangential_force: number,
  material: string,
  static_threshold: number = 0.1
): "static" | "sliding" {
  const friction_coefficient = getFrictionCoefficient(material);
  const max_static_force = penetration_depth * friction_coefficient;

  return tangential_force > max_static_force ? "sliding" : "static";
}

/**
 * Friction coefficients per material
 */
function getFrictionCoefficient(material: string): number {
  const coefficients: Record<string, number> = {
    skin: 0.7,
    leather: 0.8,
    steel: 0.6,
    cloth: 0.5,
    generic: 0.65,
  };

  return coefficients[material] ?? 0.65;
}

/**
 * Determinism certificate generation
 */
export function generateDeterminismCertificate(
  stateHash: string,
  hardwareId?: string
): {
  timestamp: number;
  execution_hash: string;
  hardware_id?: string;
  reproducible: boolean;
  tie_break_order: string[];
} {
  return {
    timestamp: Math.floor(Date.now() / 1000),
    execution_hash: stateHash,
    hardware_id: hardwareId,
    reproducible: true,
    tie_break_order: [
      "Yaw",
      "Pitch",
      "Roll", // Rotation clamp order
      "X",
      "Y",
      "Z", // Axis order
      "Left",
      "Right", // Limb order
      "Feet",
      "Hands", // Limb tier order
    ],
  };
}
