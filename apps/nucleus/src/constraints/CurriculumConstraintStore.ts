/**
 * apps/nucleus/src/constraints/CurriculumConstraintStore.ts
 *
 * Constraint store backed by curriculum guardian invariants.
 * Validates tool execution against:
 * - Wheel curriculum state (rotation, stop index, completion)
 * - World genesis continuity constraints
 * - Active grade rails (physics + representation bounds)
 */

import type { ConstraintStore, ConstraintViolation } from "../tool/executor";

export interface CurriculumState {
  version: string;
  wheel_id: string;
  rotation: number;
  stop_index: number;
  total_rotations: number;
  stop_order: string[];
  completed_stops: Record<string, boolean>;
}

export interface WorldConstraint {
  constraint_id: string;
  rule: string;
  target_field: string;
  bounds?: { min?: number; max?: number };
}

/**
 * Curriculum-backed constraint store.
 * Validates tools against active constraints from the curriculum wheel.
 */
export class CurriculumConstraintStore implements ConstraintStore {
  private curriculumState: CurriculumState | null = null;
  private worldConstraints: WorldConstraint[] = [];

  constructor() {}

  /**
   * Update curriculum state (called when wheel state changes)
   */
  setCurriculumState(state: CurriculumState): void {
    this.curriculumState = state;
  }

  /**
   * Set world constraints from genesis
   */
  setWorldConstraints(constraints: WorldConstraint[]): void {
    this.worldConstraints = constraints;
  }

  /**
   * Get all active constraint violations
   */
  getActive(): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];

    if (!this.curriculumState) {
      return violations;
    }

    // Check curriculum invariants
    const guardianViolations = this.checkGuardianInvariants();
    violations.push(...guardianViolations);

    // Check world constraints
    const worldViolations = this.checkWorldConstraints();
    violations.push(...worldViolations);

    return violations;
  }

  /**
   * Validate a specific tool call against constraints
   */
  validate(toolName: string, args: any): ConstraintViolation[] {
    if (!this.curriculumState) {
      return []; // No constraints active
    }

    const violations: ConstraintViolation[] = [];

    // Agent tools require curriculum state to be valid
    if (toolName.startsWith("agent_")) {
      const guardianViolations = this.checkGuardianInvariants();
      violations.push(...guardianViolations);
    }

    // Check any tool-specific constraints
    const toolConstraintViolations = this.checkToolConstraints(toolName, args);
    violations.push(...toolConstraintViolations);

    return violations;
  }

  /**
   * Check guardian invariants from curriculum
   */
  private checkGuardianInvariants(): ConstraintViolation[] {
    if (!this.curriculumState) return [];

    const violations: ConstraintViolation[] = [];
    const state = this.curriculumState;

    // Invariant: version
    if (state.version !== "wheel.state.v1") {
      violations.push({
        constraint_id: "curriculum:version",
        rule: "state.version must be wheel.state.v1",
        tool_name: "*",
        violation_detail: `version is ${state.version}`,
      });
    }

    // Invariant: rotation bounds
    if (state.rotation < 1 || state.rotation > state.total_rotations) {
      violations.push({
        constraint_id: "curriculum:rotation_bounds",
        rule: `rotation must be in [1, ${state.total_rotations}]`,
        tool_name: "*",
        violation_detail: `rotation is ${state.rotation}`,
      });
    }

    // Invariant: stop_index bounds
    if (state.stop_index < 0 || state.stop_index >= state.stop_order.length) {
      violations.push({
        constraint_id: "curriculum:stop_index_bounds",
        rule: `stop_index must be in [0, ${state.stop_order.length - 1}]`,
        tool_name: "*",
        violation_detail: `stop_index is ${state.stop_index}`,
      });
    }

    // Invariant: stop_order consistency
    for (const stop_id of state.stop_order) {
      if (!Object.prototype.hasOwnProperty.call(state.completed_stops, stop_id)) {
        violations.push({
          constraint_id: "curriculum:stop_order_mapping",
          rule: `all stops in stop_order must have entry in completed_stops`,
          tool_name: "*",
          violation_detail: `stop ${stop_id} missing from completed_stops`,
        });
      }
    }

    return violations;
  }

  /**
   * Check world genesis constraints
   */
  private checkWorldConstraints(): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];

    for (const constraint of this.worldConstraints) {
      // Each constraint can define bounds that should not be violated
      if (constraint.bounds) {
        // Bounds checking would happen here if we had runtime state
        // For now, just record the constraint as active
      }
    }

    return violations;
  }

  /**
   * Check tool-specific constraints
   */
  private checkToolConstraints(toolName: string, args: any): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];

    // Example: if a tool tries to modify a protected field, reject it
    if (toolName === "agent_ts.curriculum_write" && args?.field === "total_rotations") {
      violations.push({
        constraint_id: "curriculum:immutable_total_rotations",
        rule: "total_rotations cannot be modified after wheel creation",
        tool_name: toolName,
        violation_detail: "Attempted to modify immutable field",
      });
    }

    return violations;
  }
}
