/**
 * apps/nucleus/src/constraints/__tests__/CurriculumConstraintStore.test.ts
 *
 * Integration tests for constraint enforcement in tool execution.
 */

import { describe, expect, it } from "vitest";
import { ToolExecutor } from "../../tool/executor";
import type { ToolCall } from "../../tool/types";
import { CurriculumConstraintStore } from "../CurriculumConstraintStore";

describe("CurriculumConstraintStore", () => {
  it("should detect rotation bounds violations", () => {
    const store = new CurriculumConstraintStore();

    store.setCurriculumState({
      version: "wheel.state.v1",
      wheel_id: "wheel_1",
      rotation: 5, // Out of bounds
      stop_index: 0,
      total_rotations: 3, // Only 3 rotations allowed
      stop_order: ["stop_a", "stop_b"],
      completed_stops: { stop_a: true, stop_b: false },
    });

    const violations = store.getActive();
    expect(violations).toHaveLength(1);
    expect(violations[0].constraint_id).toBe("curriculum:rotation_bounds");
  });

  it("should detect stop_index out of bounds", () => {
    const store = new CurriculumConstraintStore();

    store.setCurriculumState({
      version: "wheel.state.v1",
      wheel_id: "wheel_1",
      rotation: 1,
      stop_index: 5, // Out of bounds
      total_rotations: 3,
      stop_order: ["stop_a", "stop_b"],
      completed_stops: { stop_a: true, stop_b: false },
    });

    const violations = store.getActive();
    expect(violations).toHaveLength(1);
    expect(violations[0].constraint_id).toBe("curriculum:stop_index_bounds");
  });

  it("should pass validation with valid curriculum state", () => {
    const store = new CurriculumConstraintStore();

    store.setCurriculumState({
      version: "wheel.state.v1",
      wheel_id: "wheel_1",
      rotation: 1,
      stop_index: 0,
      total_rotations: 3,
      stop_order: ["stop_a", "stop_b"],
      completed_stops: { stop_a: true, stop_b: false },
    });

    const violations = store.getActive();
    expect(violations).toHaveLength(0);
  });

  it("should validate specific tool calls", () => {
    const store = new CurriculumConstraintStore();

    store.setCurriculumState({
      version: "wheel.state.v1",
      wheel_id: "wheel_1",
      rotation: 1,
      stop_index: 0,
      total_rotations: 3,
      stop_order: ["stop_a", "stop_b"],
      completed_stops: { stop_a: true, stop_b: false },
    });

    // Valid tool call should pass
    const toolViolations = store.validate("agent_py.curriculum_read", {});
    expect(toolViolations).toHaveLength(0);

    // Protected field modification should be caught
    const protectedViolations = store.validate("agent_ts.curriculum_write", {
      field: "total_rotations",
    });
    expect(protectedViolations.length).toBeGreaterThan(0);
  });
});

describe("ToolExecutor with constraints", () => {
  it("should reject tool execution when constraints violated", async () => {
    const store = new CurriculumConstraintStore();

    // Set up invalid state
    store.setCurriculumState({
      version: "wheel.state.v1",
      wheel_id: "wheel_1",
      rotation: 10, // Out of bounds
      stop_index: 0,
      total_rotations: 3,
      stop_order: ["stop_a"],
      completed_stops: { stop_a: false },
    });

    const executor = new ToolExecutor(
      () => {}, // sendToIde
      () => {}, // emitToIde
      "test_nucleus",
      store // constraint store
    );

    const call: ToolCall = {
      toolCallId: "call_1",
      name: "agent_py.some_tool",
      args: {},
    };

    const result = await executor.execute("trace_1", "session_1", call);

    expect(result.payload.status).toBe("error");
    expect(result.payload.error?.message).toContain("constraint violation");
  });

  it("should allow tool execution when constraints valid", async () => {
    const store = new CurriculumConstraintStore();

    // Set up valid state
    store.setCurriculumState({
      version: "wheel.state.v1",
      wheel_id: "wheel_1",
      rotation: 1,
      stop_index: 0,
      total_rotations: 3,
      stop_order: ["stop_a"],
      completed_stops: { stop_a: false },
    });

    const executor = new ToolExecutor(
      () => {}, // sendToIde
      () => {}, // emitToIde
      "test_nucleus",
      store
    );

    const call: ToolCall = {
      toolCallId: "call_1",
      name: "agent_py.some_tool",
      args: {},
    };

    // With valid state, should proceed to agent execution
    // (Will fail at agent endpoint, not at constraint check)
    const result = await executor.execute("trace_1", "session_1", call);

    // Should NOT be rejected at constraint layer
    // (may fail at agent endpoint, but that's different)
    if (result.payload.status === "error") {
      expect(result.payload.error?.message).not.toContain("constraint");
    }
  });
});
