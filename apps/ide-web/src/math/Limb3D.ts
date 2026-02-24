/**
 * Limb3D - Articulated kinematics system for 3D limbs
 *
 * Features:
 * - Spherical coordinate rotation (yaw/pitch)
 * - Parent-child limb chains (inverse kinematics ready)
 * - Oscillation patterns for procedural animation
 * - Endpoint tracking for collision/attachment
 */

import { Vector3 } from "./Vector3";

export class Limb3D {
  start: Vector3;
  end: Vector3;
  length: number;
  angleY: number; // Yaw (left/right rotation around Y-axis)
  angleZ: number; // Pitch (up/down rotation)
  parent: Limb3D | null;

  constructor(length: number, angleY = 0, angleZ = 0) {
    this.start = Vector3.zero;
    this.end = Vector3.zero;
    this.length = length;
    this.angleY = angleY;
    this.angleZ = angleZ;
    this.parent = null;
  }

  // ============================================================================
  // KINEMATIC CHAIN
  // ============================================================================

  /**
   * Attach this limb to a parent (makes this the child)
   * Child's start point becomes parent's end point
   */
  attachTo(parent: Limb3D): void {
    this.parent = parent;
    this.start = parent.end.clone();
  }

  /**
   * Update endpoint based on current angles and parent position
   * Uses spherical to Cartesian conversion:
   * - x = r * cos(pitch) * cos(yaw)
   * - y = r * sin(pitch)
   * - z = r * cos(pitch) * sin(yaw)
   */
  update(): void {
    // Sync start with parent's end
    if (this.parent) {
      this.start = this.parent.end.clone();
    }

    // Spherical to Cartesian
    const cosPitch = Math.cos(this.angleZ);
    const dx = this.length * cosPitch * Math.cos(this.angleY);
    const dy = this.length * Math.sin(this.angleZ);
    const dz = this.length * cosPitch * Math.sin(this.angleY);

    this.end = new Vector3(this.start.x + dx, this.start.y + dy, this.start.z + dz);
  }

  // ============================================================================
  // PROCEDURAL ANIMATION
  // ============================================================================

  /**
   * Create snake-like oscillation using sine waves
   * @param time - Animation time (seconds)
   * @param offset - Phase offset (makes segments move independently)
   */
  oscillate(time: number, offset: number): void {
    // Left-right wave (slower)
    this.angleY = Math.sin(time + offset) * 0.5;

    // Up-down wave (faster, phase shifted)
    this.angleZ = Math.cos(time * 1.3 + offset) * 0.5;
  }

  /**
   * Spiral oscillation pattern
   */
  oscillateSpiral(time: number, offset: number, radius = 0.5): void {
    this.angleY = Math.sin(time + offset) * radius;
    this.angleZ = Math.sin(time + offset + Math.PI / 2) * radius;
  }

  /**
   * Pendulum swing (single axis)
   */
  oscillatePendulum(time: number, offset: number, maxSwing = 0.5): void {
    this.angleY = 0;
    this.angleZ = Math.sin(time + offset) * maxSwing;
  }

  // ============================================================================
  // QUERIES
  // ============================================================================

  getDirection(): Vector3 {
    return this.end.subtract(this.start).normalize();
  }

  getMidpoint(): Vector3 {
    return this.start.lerp(this.end, 0.5);
  }

  /**
   * Get point along limb at parameter t ∈ [0, 1]
   */
  pointAt(t: number): Vector3 {
    return this.start.lerp(this.end, t);
  }

  // ============================================================================
  // STATIC UTILITIES
  // ============================================================================

  /**
   * Create a chain of limbs (e.g., tentacle, arm, snake)
   * @param segmentCount - Number of segments
   * @param segmentLength - Length of each segment
   * @param startPos - World position of root
   */
  static createChain(
    segmentCount: number,
    segmentLength: number,
    startPos: Vector3
  ): Limb3D[] {
    const chain: Limb3D[] = [];

    for (let i = 0; i < segmentCount; i++) {
      const limb = new Limb3D(segmentLength, 0, 0);

      if (i === 0) {
        limb.start = startPos.clone();
      } else {
        limb.attachTo(chain[i - 1]!);
      }

      chain.push(limb);
    }

    return chain;
  }

  /**
   * Update entire chain (call this once per frame on the array)
   */
  static updateChain(chain: Limb3D[]): void {
    for (const limb of chain) {
      limb.update();
    }
  }

  /**
   * Apply oscillation to entire chain with staggered phase
   */
  static oscillateChain(chain: Limb3D[], time: number, phaseStep = 0.5): void {
    chain.forEach((limb, i) => {
      limb.oscillate(time, i * phaseStep);
    });
  }
}
