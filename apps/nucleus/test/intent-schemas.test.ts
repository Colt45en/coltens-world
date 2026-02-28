import { RendererStateSchema } from "@world-engine/engine/browser";
import { describe, expect, it } from "vitest";

describe("Intent State Schemas", () => {
  describe("RendererStateSchema", () => {
    it("accepts valid renderer state", () => {
      const state = {
        is_initialized: true,
        canvas_element: null,
        frame_count: 0,
        fps: 60,
      };
      const parsed = RendererStateSchema.safeParse(state);
      expect(parsed.success).toBe(true);
    });

    it("validates is_initialized as boolean", () => {
      const state = {
        is_initialized: "yes", // Invalid: should be boolean
        canvas_element: null,
        frame_count: 0,
        fps: 60,
      };
      const parsed = RendererStateSchema.safeParse(state);
      expect(parsed.success).toBe(false);
    });

    it("requires frame_count and fps", () => {
      const state = {
        is_initialized: true,
        canvas_element: null,
      };
      const parsed = RendererStateSchema.safeParse(state);
      expect(parsed.success).toBe(false);
    });

    it("allows optional canvas_element", () => {
      const state = {
        is_initialized: true,
        frame_count: 0,
        fps: 30,
      };
      const parsed = RendererStateSchema.safeParse(state);
      expect(parsed.success).toBe(true);
    });

    it("validates fps as finite positive number", () => {
      const state = {
        is_initialized: true,
        frame_count: 0,
        fps: -1, // Invalid: should be positive
      };
      const parsed = RendererStateSchema.safeParse(state);
      expect(parsed.success).toBe(false);
    });
  });
});
