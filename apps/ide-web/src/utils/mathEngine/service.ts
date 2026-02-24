// Math Engine Service - Environmental math utilities accessible via bus
// Makes all math operations available to the World Engine ecosystem

import { CalculusEngine, TrajectorySimulation } from "./calculus";
import { CameraSystem } from "./camera";
import { MathEngine } from "./core";
import { Geometry3D } from "./geometry3d";
import { ParticleSystem } from "./particles";
import { PhysicsSimulation } from "./physics";

export interface MathEngineRequest {
  operation:
    | "trig"
    | "vector"
    | "random"
    | "lerp"
    | "physics"
    | "calculus"
    | "geometry3d"
    | "camera"
    | "particles"
    | "unitCircle"
    | "trajectory"
    | "frustumCull";
  params: Record<string, unknown>;
}

export interface MathEngineResponse {
  success: boolean;
  result?: unknown;
  error?: string;
}

// Math Engine Service - singleton that handles mathematical operations for the entire system
export class MathEngineService {
  private static instance: MathEngineService | null = null;
  private particleSystems: Map<string, ParticleSystem> = new Map();
  private physicsSims: Map<string, PhysicsSimulation> = new Map();
  private trajectorySims: Map<string, TrajectorySimulation> = new Map();

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): MathEngineService {
    if (!this.instance) {
      this.instance = new MathEngineService();
    }
    return this.instance;
  }

  // Process math operation request
  async execute(request: MathEngineRequest): Promise<MathEngineResponse> {
    try {
      const { operation, params } = request;

      switch (operation) {
        case "trig":
          return this.handleTrig(params);
        case "vector":
          return this.handleVector(params);
        case "random":
          return this.handleRandom(params);
        case "lerp":
          return this.handleLerp(params);
        case "physics":
          return this.handlePhysics(params);
        case "calculus":
          return this.handleCalculus(params);
        case "geometry3d":
          return this.handleGeometry3D(params);
        case "camera":
          return this.handleCamera(params);
        case "particles":
          return this.handleParticles(params);
        case "unitCircle":
          return this.handleUnitCircle(params);
        case "trajectory":
          return this.handleTrajectory(params);
        case "frustumCull":
          return this.handleFrustumCull(params);
        default:
          return {
            success: false,
            error: `Unknown operation: ${operation}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private handleTrig(params: Record<string, unknown>): MathEngineResponse {
    const { method, angle } = params;

    if (typeof angle !== "number") {
      return { success: false, error: "angle must be a number" };
    }

    let result;
    switch (method) {
      case "degToRad":
        result = MathEngine.trig.degToRad(angle);
        break;
      case "radToDeg":
        result = MathEngine.trig.radToDeg(angle);
        break;
      case "unitCirclePoint":
        result = MathEngine.trig.unitCirclePoint(angle);
        break;
      case "allValues":
        result = MathEngine.trig.allValues(angle);
        break;
      case "quadrant":
        result = MathEngine.trig.quadrant(angle);
        break;
      default:
        return { success: false, error: `Unknown trig method: ${method}` };
    }

    return { success: true, result };
  }

  private handleVector(params: Record<string, unknown>): MathEngineResponse {
    const { method, a, b, scalar } = params;

    let result;
    switch (method) {
      case "add":
        if (!Array.isArray(a) || !Array.isArray(b)) {
          return { success: false, error: "a and b must be arrays" };
        }
        result = MathEngine.vector.add(a as [number, number], b as [number, number]);
        break;
      case "sub":
        if (!Array.isArray(a) || !Array.isArray(b)) {
          return { success: false, error: "a and b must be arrays" };
        }
        result = MathEngine.vector.sub(a as [number, number], b as [number, number]);
        break;
      case "scale":
        if (!Array.isArray(a) || typeof scalar !== "number") {
          return { success: false, error: "a must be array, scalar must be number" };
        }
        result = MathEngine.vector.scale(a as [number, number], scalar);
        break;
      case "magnitude":
        if (!Array.isArray(a)) {
          return { success: false, error: "a must be an array" };
        }
        result = MathEngine.vector.magnitude(a as [number, number]);
        break;
      case "normalize":
        if (!Array.isArray(a)) {
          return { success: false, error: "a must be an array" };
        }
        result = MathEngine.vector.normalize(a as [number, number]);
        break;
      case "dot":
        if (!Array.isArray(a) || !Array.isArray(b)) {
          return { success: false, error: "a and b must be arrays" };
        }
        result = MathEngine.vector.dot(a as [number, number], b as [number, number]);
        break;
      case "angle":
        if (!Array.isArray(a)) {
          return { success: false, error: "a must be an array" };
        }
        result = MathEngine.vector.angle(a as [number, number]);
        break;
      default:
        return { success: false, error: `Unknown vector method: ${method}` };
    }

    return { success: true, result };
  }

  private handleRandom(params: Record<string, unknown>): MathEngineResponse {
    const { method, min, max, probability } = params;

    let result;
    switch (method) {
      case "range":
        if (typeof min !== "number" || typeof max !== "number") {
          return { success: false, error: "min and max must be numbers" };
        }
        result = MathEngine.random.range(min, max);
        break;
      case "int":
        if (typeof min !== "number" || typeof max !== "number") {
          return { success: false, error: "min and max must be numbers" };
        }
        result = MathEngine.random.int(min, max);
        break;
      case "color":
        result = MathEngine.random.color();
        break;
      case "bool":
        if (typeof probability !== "number") {
          return { success: false, error: "probability must be a number" };
        }
        result = MathEngine.random.bool(probability);
        break;
      default:
        return { success: false, error: `Unknown random method: ${method}` };
    }

    return { success: true, result };
  }

  private handleLerp(params: Record<string, unknown>): MathEngineResponse {
    const { method, a, b, t } = params;

    if (typeof a !== "number" || typeof b !== "number" || typeof t !== "number") {
      return { success: false, error: "a, b, and t must be numbers" };
    }

    let result;
    switch (method) {
      case "linear":
        result = MathEngine.lerp.linear(a, b, t);
        break;
      case "clamp":
        result = MathEngine.lerp.clamp(a, b as number, t);
        break;
      case "smoothstep":
        if (typeof t !== "number") {
          return { success: false, error: "t must be a number" };
        }
        result = MathEngine.lerp.smoothstep(t);
        break;
      default:
        return { success: false, error: `Unknown lerp method: ${method}` };
    }

    return { success: true, result };
  }

  private handlePhysics(params: Record<string, unknown>): MathEngineResponse {
    const { method, normal, coefficient, mass, gravity, angle, velocity, drag } = params;

    let result;
    switch (method) {
      case "friction":
        if (typeof normal !== "number" || typeof coefficient !== "number") {
          return { success: false, error: "normal and coefficient must be numbers" };
        }
        result = MathEngine.physics.friction(normal, coefficient);
        break;
      case "gravityComponent":
        if (typeof mass !== "number" || typeof gravity !== "number" || typeof angle !== "number") {
          return { success: false, error: "mass, gravity, and angle must be numbers" };
        }
        result = MathEngine.physics.gravityComponent(mass, gravity, angle);
        break;
      case "normalForce":
        if (typeof mass !== "number" || typeof gravity !== "number" || typeof angle !== "number") {
          return { success: false, error: "mass, gravity, and angle must be numbers" };
        }
        result = MathEngine.physics.normalForce(mass, gravity, angle);
        break;
      case "dragForce":
        if (typeof velocity !== "number" || typeof drag !== "number") {
          return { success: false, error: "velocity and drag must be numbers" };
        }
        result = MathEngine.physics.dragForce(velocity, drag);
        break;
      default:
        return { success: false, error: `Unknown physics method: ${method}` };
    }

    return { success: true, result };
  }

  private handleCalculus(params: Record<string, unknown>): MathEngineResponse {
    const { method, x, v0, a, t, coeffs } = params;

    let result;
    switch (method) {
      case "position":
        if (typeof x !== "number" || typeof v0 !== "number" || typeof a !== "number" || typeof t !== "number") {
          return { success: false, error: "x, v0, a, and t must be numbers" };
        }
        result = CalculusEngine.kinematics.position(x, v0, a, t);
        break;
      case "velocity":
        if (typeof v0 !== "number" || typeof a !== "number" || typeof t !== "number") {
          return { success: false, error: "v0, a, and t must be numbers" };
        }
        result = CalculusEngine.kinematics.velocity(v0, a, t);
        break;
      case "polynomialDerivative":
        if (!Array.isArray(coeffs)) {
          return { success: false, error: "coeffs must be an array" };
        }
        result = CalculusEngine.polynomialDerivative(coeffs as number[]);
        break;
      default:
        return { success: false, error: `Unknown calculus method: ${method}` };
    }

    return { success: true, result };
  }

  private handleGeometry3D(params: Record<string, unknown>): MathEngineResponse {
    const { method, a, b, point, box, sphere } = params;

    let result;
    switch (method) {
      case "vec3Add":
        result = Geometry3D.vec3.add(a as any, b as any);
        break;
      case "vec3Sub":
        result = Geometry3D.vec3.sub(a as any, b as any);
        break;
      case "vec3Dot":
        result = Geometry3D.vec3.dot(a as any, b as any);
        break;
      case "vec3Cross":
        result = Geometry3D.vec3.cross(a as any, b as any);
        break;
      case "vec3Magnitude":
        result = Geometry3D.vec3.magnitude(a as any);
        break;
      case "vec3Normalize":
        result = Geometry3D.vec3.normalize(a as any);
        break;
      case "aabbContains":
        result = Geometry3D.aabb.contains(box as any, point as any);
        break;
      case "aabbIntersects":
        result = Geometry3D.aabb.intersects(a as any, b as any);
        break;
      case "sphereContains":
        result = Geometry3D.sphere.contains(sphere as any, point as any);
        break;
      case "sphereIntersects":
        result = Geometry3D.sphere.intersects(a as any, b as any);
        break;
      default:
        return { success: false, error: `Unknown geometry3d method: ${method}` };
    }

    return { success: true, result };
  }

  private handleCamera(params: Record<string, unknown>): MathEngineResponse {
    const { method, camera, target, distance, yaw, pitch } = params;

    let result;
    switch (method) {
      case "getForward":
        result = CameraSystem.getForward(camera as any);
        break;
      case "getRight":
        result = CameraSystem.getRight(camera as any);
        break;
      case "getUp":
        result = CameraSystem.getUp(camera as any);
        break;
      case "lookAt":
        result = CameraSystem.lookAt(camera as any, target as any);
        break;
      case "orbit":
        if (typeof distance !== "number" || typeof yaw !== "number" || typeof pitch !== "number") {
          return { success: false, error: "distance, yaw, and pitch must be numbers" };
        }
        result = CameraSystem.orbit(target as any, distance, yaw, pitch);
        break;
      default:
        return { success: false, error: `Unknown camera method: ${method}` };
    }

    return { success: true, result };
  }

  private handleParticles(params: Record<string, unknown>): MathEngineResponse {
    const { action, id, count } = params;

    // Simple particle system management (stateless for now)
    // Real implementation would maintain particle systems per session
    return {
      success: true,
      result: {
        action,
        id,
        message: "Particle system operation completed (demo mode)",
      },
    };
  }

  private handleUnitCircle(params: Record<string, unknown>): MathEngineResponse {
    const { angle } = params;

    if (typeof angle !== "number") {
      return { success: false, error: "angle must be a number" };
    }

    const values = MathEngine.trig.allValues(angle);
    const point = MathEngine.trig.unitCirclePoint(angle);
    const quadrant = MathEngine.trig.quadrant(angle);

    return {
      success: true,
      result: {
        angle,
        point,
        values,
        quadrant,
      },
    };
  }

  private handleTrajectory(params: Record<string, unknown>): MathEngineResponse {
    const { id, action, x0, y0, vx0, vy0, gravity, t, numPoints } = params;

    if (action === "create") {
      const traj = new TrajectorySimulation(
        (x0 as number) ?? 0,
        (y0 as number) ?? 0,
        (vx0 as number) ?? 10,
        (vy0 as number) ?? 15,
        (gravity as number) ?? 9.8
      );

      this.trajectorySims.set(id as string, traj);

      return {
        success: true,
        result: {
          id,
          flightTime: traj.flightTime(),
          maxHeight: traj.maxHeight(),
          range: traj.range(),
        },
      };
    }

    if (action === "position") {
      const traj = this.trajectorySims.get(id as string);
      if (!traj) {
        return { success: false, error: `Trajectory ${id} not found` };
      }

      return {
        success: true,
        result: traj.position(t as number),
      };
    }

    if (action === "path") {
      const traj = this.trajectorySims.get(id as string);
      if (!traj) {
        return { success: false, error: `Trajectory ${id} not found` };
      }

      return {
        success: true,
        result: traj.generatePath((numPoints as number) ?? 50),
      };
    }

    return { success: false, error: `Unknown trajectory action: ${action}` };
  }

  private handleFrustumCull(params: Record<string, unknown>): MathEngineResponse {
    const { fov, aspect, near, far, position, forward, up, objects } = params;

    if (
      typeof fov !== "number" ||
      typeof aspect !== "number" ||
      typeof near !== "number" ||
      typeof far !== "number"
    ) {
      return { success: false, error: "fov, aspect, near, and far must be numbers" };
    }

    const frustum = Geometry3D.frustum.create(
      fov,
      aspect,
      near,
      far,
      position as any,
      forward as any,
      up as any
    );

    // Test each object for visibility
    const visibleObjects = (objects as any[]).filter((obj) => {
      if (obj.type === "aabb") {
        return Geometry3D.frustum.containsAABB(frustum, obj.bounds);
      } else if (obj.type === "sphere") {
        return Geometry3D.frustum.containsSphere(frustum, obj.bounds);
      }
      return false;
    });

    return {
      success: true,
      result: {
        totalObjects: (objects as any[]).length,
        visibleObjects: visibleObjects.length,
        culledObjects: (objects as any[]).length - visibleObjects.length,
        visible: visibleObjects,
      },
    };
  }

  // Cleanup method to clear stateful simulations
  cleanup(id: string) {
    this.particleSystems.delete(id);
    this.physicsSims.delete(id);
    this.trajectorySims.delete(id);
  }
}

// Export singleton instance
export const mathEngineService = MathEngineService.getInstance();

// Helper function for quick access
export async function executeMathOperation(request: MathEngineRequest): Promise<MathEngineResponse> {
  return mathEngineService.execute(request);
}
