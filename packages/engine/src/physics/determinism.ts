/**
 * Physics Determinism Utilities
 * Provides cross-platform deterministic math operations
 *
 * Key issue: Math.sin/Math.cos are not guaranteed cross-platform deterministic
 * Solution: Use precomputed lookup tables + quantized angles
 */

/**
 * Precomputed sin/cos lookup table
 * 360 entries (1° resolution) for sufficient precision
 * Values normalized to full float precision
 */
const TRIG_TABLE_SIZE = 360;
const trigTable = (() => {
  const table: { sin: number[]; cos: number[] } = { sin: [], cos: [] };
  for (let i = 0; i < TRIG_TABLE_SIZE; i++) {
    const radians = (i * Math.PI * 2) / TRIG_TABLE_SIZE;
    table.sin[i] = Math.sin(radians);
    table.cos[i] = Math.cos(radians);
  }
  return table;
})();

/**
 * Quantize angle (radians) to nearest degree for lookup
 * Returns index 0–359 for trig table lookup
 */
export function quantizeAngle(radians: number): number {
  // Convert to degrees, normalize to 0–359 range
  const degrees = (radians * 180) / Math.PI;
  const normalized = degrees % 360;
  const index = Math.round(normalized) % TRIG_TABLE_SIZE;
  return Math.abs(index); // Ensure positive index
}

/**
 * Deterministic sin using lookup table
 */
export function deterministicSin(radians: number): number {
  const index = quantizeAngle(radians);
  return trigTable.sin[index]!;
}

/**
 * Deterministic cos using lookup table
 */
export function deterministicCos(radians: number): number {
  const index = quantizeAngle(radians);
  return trigTable.cos[index]!;
}

/**
 * Quantize a vector component to fixed precision
 * Useful for normalizing forces/velocities to deterministic values
 *
 * @param value - Number to quantize
 * @param decimals - Number of decimal places to keep (default 6)
 * @returns Quantized value
 */
export function quantizeScalar(value: number, decimals: number = 6): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Quantize a 3D vector to fixed precision
 */
export function quantizeVec3(
  vec: [number, number, number],
  decimals: number = 6
): [number, number, number] {
  return [
    quantizeScalar(vec[0], decimals),
    quantizeScalar(vec[1], decimals),
    quantizeScalar(vec[2], decimals),
  ];
}

/**
 * Clamp a value to ensure stability
 * Physics simulations can produce NaN/Infinity in edge cases
 *
 * @param value - Value to clamp
 * @param min - Minimum value (default -1e6)
 * @param max - Maximum value (default 1e6)
 * @returns Clamped value
 */
export function clampValue(value: number, min: number = -1e6, max: number = 1e6): number {
  if (!isFinite(value)) return 0;
  return Math.max(min, Math.min(max, value));
}

/**
 * Clamp a 3D vector component-wise
 */
export function clampVec3(
  vec: [number, number, number],
  min: number = -1e6,
  max: number = 1e6
): [number, number, number] {
  return [clampValue(vec[0], min, max), clampValue(vec[1], min, max), clampValue(vec[2], min, max)];
}

/**
 * Add two 3D vectors
 */
export function addVec3(
  a: [number, number, number],
  b: [number, number, number]
): [number, number, number] {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

/**
 * Multiply a 3D vector by a scalar
 */
export function scaleVec3(
  vec: [number, number, number],
  scalar: number
): [number, number, number] {
  return [vec[0] * scalar, vec[1] * scalar, vec[2] * scalar];
}

/**
 * Compute magnitude of 3D vector
 */
export function magnitudeVec3(vec: [number, number, number]): number {
  return Math.sqrt(vec[0] * vec[0] + vec[1] * vec[1] + vec[2] * vec[2]);
}

/**
 * Normalize a 3D vector (returns unit vector)
 */
export function normalizeVec3(vec: [number, number, number]): [number, number, number] {
  const mag = magnitudeVec3(vec);
  if (mag === 0) return [0, 0, 0];
  return [vec[0] / mag, vec[1] / mag, vec[2] / mag];
}

/**
 * Dot product of two 3D vectors
 */
export function dotVec3(
  a: [number, number, number],
  b: [number, number, number]
): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/**
 * Cross product of two 3D vectors
 */
export function crossVec3(
  a: [number, number, number],
  b: [number, number, number]
): [number, number, number] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/**
 * Compute distance between two points
 */
export function distanceVec3(
  a: [number, number, number],
  b: [number, number, number]
): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Lerp (linear interpolation) between two 3D vectors
 */
export function lerpVec3(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/**
 * Apply damping to a vector (velocity reduction)
 *
 * @param vec - Vector (e.g., velocity)
 * @param dampingFactor - Damping factor (0–1; 0.01 = 1% per frame)
 * @returns Damped vector
 */
export function applyDamping(
  vec: [number, number, number],
  dampingFactor: number
): [number, number, number] {
  const factor = Math.max(0, Math.min(1, 1 - dampingFactor));
  return scaleVec3(vec, factor);
}
