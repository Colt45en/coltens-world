// Math Engine Bus Integration Hook
// Provides easy access to Math Engine service throughout the application

import { useCallback, useMemo } from "react";
import { mathEngineService, type MathEngineRequest, type MathEngineResponse } from "../utils/mathEngine/service";

export function useMathEngine() {
  // Execute math operation
  const execute = useCallback(async (request: MathEngineRequest): Promise<MathEngineResponse> => {
    return mathEngineService.execute(request);
  }, []);

  // Convenience methods for common operations
  const trig = useMemo(
    () => ({
      degToRad: async (angle: number) =>
        execute({ operation: "trig", params: { method: "degToRad", angle } }),
      radToDeg: async (angle: number) =>
        execute({ operation: "trig", params: { method: "radToDeg", angle } }),
      unitCirclePoint: async (angle: number) =>
        execute({ operation: "trig", params: { method: "unitCirclePoint", angle } }),
      allValues: async (angle: number) =>
        execute({ operation: "trig", params: { method: "allValues", angle } }),
      quadrant: async (angle: number) =>
        execute({ operation: "trig", params: { method: "quadrant", angle } }),
    }),
    [execute]
  );

  const vector = useMemo(
    () => ({
      add: async (a: [number, number], b: [number, number]) =>
        execute({ operation: "vector", params: { method: "add", a, b } }),
      sub: async (a: [number, number], b: [number, number]) =>
        execute({ operation: "vector", params: { method: "sub", a, b } }),
      scale: async (a: [number, number], scalar: number) =>
        execute({ operation: "vector", params: { method: "scale", a, scalar } }),
      magnitude: async (a: [number, number]) =>
        execute({ operation: "vector", params: { method: "magnitude", a } }),
      normalize: async (a: [number, number]) =>
        execute({ operation: "vector", params: { method: "normalize", a } }),
      dot: async (a: [number, number], b: [number, number]) =>
        execute({ operation: "vector", params: { method: "dot", a, b } }),
      angle: async (a: [number, number], b: [number, number]) =>
        execute({ operation: "vector", params: { method: "angle", a, b } }),
    }),
    [execute]
  );

  const calculus = useMemo(
    () => ({
      position: async (x: number, v0: number, a: number, t: number) =>
        execute({ operation: "calculus", params: { method: "position", x, v0, a, t } }),
      velocity: async (v0: number, a: number, t: number) =>
        execute({ operation: "calculus", params: { method: "velocity", v0, a, t } }),
      polynomialDerivative: async (coeffs: number[]) =>
        execute({ operation: "calculus", params: { method: "polynomialDerivative", coeffs } }),
    }),
    [execute]
  );

  const trajectory = useMemo(
    () => ({
      create: async (id: string, x0: number, y0: number, vx0: number, vy0: number, gravity: number) =>
        execute({
          operation: "trajectory",
          params: { action: "create", id, x0, y0, vx0, vy0, gravity },
        }),
      position: async (id: string, t: number) =>
        execute({ operation: "trajectory", params: { action: "position", id, t } }),
      path: async (id: string, numPoints: number) =>
        execute({ operation: "trajectory", params: { action: "path", id, numPoints } }),
    }),
    [execute]
  );

  const camera = useMemo(
    () => ({
      getForward: async (camera: unknown) =>
        execute({ operation: "camera", params: { method: "getForward", camera } }),
      getRight: async (camera: unknown) =>
        execute({ operation: "camera", params: { method: "getRight", camera } }),
      getUp: async (camera: unknown) =>
        execute({ operation: "camera", params: { method: "getUp", camera } }),
      lookAt: async (camera: unknown, target: unknown) =>
        execute({ operation: "camera", params: { method: "lookAt", camera, target } }),
      orbit: async (target: unknown, distance: number, yaw: number, pitch: number) =>
        execute({ operation: "camera", params: { method: "orbit", target, distance, yaw, pitch } }),
    }),
    [execute]
  );

  const geometry3d = useMemo(
    () => ({
      vec3Add: async (a: unknown, b: unknown) =>
        execute({ operation: "geometry3d", params: { method: "vec3Add", a, b } }),
      vec3Sub: async (a: unknown, b: unknown) =>
        execute({ operation: "geometry3d", params: { method: "vec3Sub", a, b } }),
      vec3Dot: async (a: unknown, b: unknown) =>
        execute({ operation: "geometry3d", params: { method: "vec3Dot", a, b } }),
      vec3Cross: async (a: unknown, b: unknown) =>
        execute({ operation: "geometry3d", params: { method: "vec3Cross", a, b } }),
      vec3Magnitude: async (a: unknown) =>
        execute({ operation: "geometry3d", params: { method: "vec3Magnitude", a } }),
      vec3Normalize: async (a: unknown) =>
        execute({ operation: "geometry3d", params: { method: "vec3Normalize", a } }),
      aabbContains: async (box: unknown, point: unknown) =>
        execute({ operation: "geometry3d", params: { method: "aabbContains", box, point } }),
      aabbIntersects: async (a: unknown, b: unknown) =>
        execute({ operation: "geometry3d", params: { method: "aabbIntersects", a, b } }),
      sphereContains: async (sphere: unknown, point: unknown) =>
        execute({ operation: "geometry3d", params: { method: "sphereContains", sphere, point } }),
      sphereIntersects: async (a: unknown, b: unknown) =>
        execute({ operation: "geometry3d", params: { method: "sphereIntersects", a, b } }),
    }),
    [execute]
  );

  return {
    // Direct execution
    execute,

    // Convenience methods
    trig,
    vector,
    calculus,
    trajectory,
    camera,
    geometry3d,
  };
}
