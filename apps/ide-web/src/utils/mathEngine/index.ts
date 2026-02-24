// Math Engine - Complete mathematical utilities for World Engine
// Centralized export for all math systems

import type { Vec3 } from "@world-engine/lego-prefab";
import { Frustum, Matrix4, Quaternion, Ray, Sphere } from "three";
import type { CalculusState } from "./calculus";
import { CalculusEngine, TrajectorySimulation } from "./calculus";
import type { CameraState } from "./camera";
import { CameraSystem } from "./camera";
import MathEngine from "./core";
import type { AABB } from "./geometry3d";
import { Geometry3D } from "./geometry3d";
import type { Particle } from "./particles";
import { ParticleSystem } from "./particles";
import type { ForceComponents, PhysicsState } from "./physics";
import { PhysicsRenderer, PhysicsSimulation } from "./physics";
import type { MathEngineRequest, MathEngineResponse } from "./service";
import { executeMathOperation, MathEngineService, mathEngineService } from "./service";
import type { UnitCircleState } from "./unitCircle";
import { UnitCircleRenderer } from "./unitCircle";

type Plane = {} // placeholder type

// Core utilities
export { MathEngine } from "./core";

// Specialized systems
export { CalculusEngine, CameraSystem, Geometry3D, TrajectorySimulation };
export type { AABB, CalculusState, CameraState };

// Visualization systems
  export { ParticleSystem, PhysicsRenderer, PhysicsSimulation, UnitCircleRenderer };
  export type { ForceComponents, Particle, PhysicsState, UnitCircleState };

// Service layer
  export {
    executeMathOperation, MathEngineService,
    mathEngineService
  };
  export type {
    MathEngineRequest,
    MathEngineResponse
  };

// Re-export third-party types
  export { Frustum, Matrix4, Quaternion, Ray, Sphere };
  export type { Plane, Vec3 };

// Quick access helpers
export const math = {
  // Core operations
  trig: MathEngine.trig,
  vector: MathEngine.vector,
  random: MathEngine.random,
  lerp: MathEngine.lerp,
  physics: MathEngine.physics,

  // Advanced systems
  calculus: CalculusEngine,
  geometry3d: Geometry3D,
  camera: CameraSystem,

  // Factories
  createTrajectory: (x0?: number, y0?: number, vx0?: number, vy0?: number, gravity?: number) =>
    new TrajectorySimulation(x0, y0, vx0, vy0, gravity),
  createCamera: (position?: Vec3, yaw?: number, pitch?: number, roll?: number, fov?: number) =>
    CameraSystem.create(position, yaw, pitch, roll, fov),
  createMatrix4: (data?: number[]) => {
    if (data && data.length >= 16) {
      const [n11, n12, n13, n14, n21, n22, n23, n24, n31, n32, n33, n34, n41, n42, n43, n44] = [
        data[0]!, data[1]!, data[2]!, data[3]!, data[4]!, data[5]!, data[6]!, data[7]!,
        data[8]!, data[9]!, data[10]!, data[11]!, data[12]!, data[13]!, data[14]!, data[15]!
      ];
      return new Matrix4(n11, n12, n13, n14, n21, n22, n23, n24, n31, n32, n33, n34, n41, n42, n43, n44);
    }
    return new Matrix4();
  },
  createQuaternion: (x?: number, y?: number, z?: number, w?: number) => new Quaternion(x, y, z, w),
};
