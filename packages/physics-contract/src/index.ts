 

/**
 * physics-contract
 * ----------------
 * Platform-agnostic contract between World Engine (ECS owner) and Physics Engine (solver owner).
 * - Deterministic-friendly: fixed timestep, stable ids, snapshot hooks.
 * - Backend-neutral: CPU/WebGPU/CUDA/Vulkan are selected via settings, not via API shape.
 * - ECS ↔ Physics adapter examples included at bottom (minimal + SoA writeback).
 */

/* ──────────────────────────────────────────────────────────────────────────────
 *  Core Types
 * ────────────────────────────────────────────────────────────────────────────── */

export type EntityId = number;
export type ConstraintId = number;

export type ComputeBackend = "CPU" | "WEBGPU" | "CUDA" | "VULKAN";

export type Result<T> = { ok: true; value: T } | { ok: false; error: PhysicsError };
export type PhysicsError = { code: string; message: string; meta?: unknown };

export type Vec3 = { x: number; y: number; z: number };
export type Quat = { x: number; y: number; z: number; w: number };

export type DebugFlags = {
  aabbs?: boolean;
  bvh?: boolean;
  contacts?: boolean;
  constraints?: boolean;
  islands?: boolean;
};

export type StepResult = {
  frameAdvanced: boolean;
  substeps: number;
  simTime: number;
  updatedBodies: number;
  frame?: number;
};

export type RayCastQuery = {
  start: Vec3;
  end: Vec3;
  mask?: number;
  group?: number;
  maxHits?: number;
};

export type RayCastHit = {
  hit: boolean;
  entityId?: EntityId;
  point?: Vec3;
  normal?: Vec3;
  distance?: number;
};

export type RayCastResult = RayCastHit | { hits: RayCastHit[] };

/* ──────────────────────────────────────────────────────────────────────────────
 *  Settings
 * ────────────────────────────────────────────────────────────────────────────── */

export type PhysicsSettings = {
  fixedTimestep: number;
  solverIterations: number;
  gravity: Vec3;
  backend: ComputeBackend;

  enableCCD?: boolean;
  enableSleep?: boolean;

  broadphase?: "SAP" | "BVH" | "GRID";
  maxBodies?: number;
  maxConstraints?: number;

  eventBufferCapacity?: number;

  determinism?: {
    strict: boolean;
    fpuMode?: "strict" | "fast";
  };
};

/* ──────────────────────────────────────────────────────────────────────────────
 *  Shapes + Materials
 * ────────────────────────────────────────────────────────────────────────────── */

export type MaterialProps = {
  friction: number;
  restitution: number;
};

export type ShapeType = "SPHERE" | "BOX" | "CAPSULE" | "CONVEX_HULL" | "MESH";

export type ColliderShape =
  | { type: "SPHERE"; radius: number }
  | { type: "BOX"; halfExtents: Vec3 }
  | { type: "CAPSULE"; radius: number; halfHeight: number }
  | { type: "CONVEX_HULL"; points: Vec3[] }
  | { type: "MESH"; meshAssetId: string };

/* ──────────────────────────────────────────────────────────────────────────────
 *  Bodies: Creation / Update
 * ────────────────────────────────────────────────────────────────────────────── */

export type BodyCreationData = {
  initialPosition: Vec3;
  initialRotation: Quat;
  initialLinearVelocity?: Vec3;
  initialAngularVelocity?: Vec3;

  mass: number;
  isKinematic: boolean;

  material: MaterialProps;
  shape: ColliderShape;

  collisionGroup?: number;
  collisionMask?: number;
  userFlags?: number;
};

export type BodyUpdateData = Partial<{
  mass: number;
  isKinematic: boolean;
  material: MaterialProps;
  shape: ColliderShape;
  collisionGroup: number;
  collisionMask: number;
  userFlags: number;

  position: Vec3;
  rotation: Quat;
  linearVelocity: Vec3;
  angularVelocity: Vec3;
}>;

/* ──────────────────────────────────────────────────────────────────────────────
 *  Constraints
 * ────────────────────────────────────────────────────────────────────────────── */

export type ConstraintType = "BALL_SOCKET" | "HINGE" | "DISTANCE" | "FIXED";

export type ConstraintLimits = Partial<{
  minAngle: number;
  maxAngle: number;
  minDistance: number;
  maxDistance: number;
}>;

export type ConstraintCreationData = {
  type: ConstraintType;
  bodyA: EntityId;
  bodyB: EntityId;

  localAnchorA: Vec3;
  localAnchorB: Vec3;

  limits?: ConstraintLimits;
  stiffness?: number;
  damping?: number;
  breakImpulse?: number;
};

export type ConstraintUpdateData = Partial<{
  limits: ConstraintLimits;
  stiffness: number;
  damping: number;
  breakImpulse: number;
}>;

/* ──────────────────────────────────────────────────────────────────────────────
 *  Outputs (writeback) + Events
 * ────────────────────────────────────────────────────────────────────────────── */

export type TransformUpdate = {
  entityId: EntityId;
  position: Vec3;
  rotation: Quat;
};

export type VelocityUpdate = {
  entityId: EntityId;
  linear: Vec3;
  angular: Vec3;
};

export type PhysicsWriteBack = {
  entityIds: Uint32Array;
  positions: Float32Array;
  rotations: Float32Array;
  linVels: Float32Array;
  angVels: Float32Array;
  count: number;
};

export type CollisionEvent = {
  type: "collision";
  entityA: EntityId;
  entityB: EntityId;
  contactPoint: Vec3;
  normal: Vec3;
  impulse: number;

  started?: boolean;
  ended?: boolean;

  frame?: number;
};

export type DebugLine = { a: Vec3; b: Vec3; color?: number };
export type DebugAabb = { min: Vec3; max: Vec3; color?: number };
export type DebugContact = { point: Vec3; normal: Vec3; depth?: number; color?: number };

export type DebugData = {
  lines?: DebugLine[];
  aabbs?: DebugAabb[];
  contacts?: DebugContact[];
  constraintErrors?: Array<{ constraintId: ConstraintId; error: number }>;
  meta?: Record<string, unknown>;
};

/* ──────────────────────────────────────────────────────────────────────────────
 *  IPhysicsWorld: Primary engine interface
 * ────────────────────────────────────────────────────────────────────────────── */

export interface IPhysicsWorld {
  Initialize(settings: PhysicsSettings): Result<void>;
  Shutdown(): void;

  AddBody(entityId: EntityId, data: BodyCreationData): Result<void>;
  RemoveBody(entityId: EntityId): Result<void>;
  UpdateBody(entityId: EntityId, data: BodyUpdateData): Result<void>;

  AddConstraint(constraintId: ConstraintId, data: ConstraintCreationData): Result<void>;
  RemoveConstraint(constraintId: ConstraintId): Result<void>;
  UpdateConstraint(constraintId: ConstraintId, data: ConstraintUpdateData): Result<void>;

  Step(dt: number): StepResult;

  SaveSnapshot(frame: number): Result<void>;
  RestoreSnapshot(frame: number): Result<void>;
  PruneSnapshots(keepFromFrame: number): void;

  RayCast(q: RayCastQuery): RayCastResult;
  CollectEvents(max?: number): CollisionEvent[];
  GetDebugData(flags?: DebugFlags): DebugData;

  GetWriteBackView?(): PhysicsWriteBack | null;
}

/* ──────────────────────────────────────────────────────────────────────────────
 *  Adapter Example: ECS ↔ Physics marshaling (minimal + SoA writeback)
 * ────────────────────────────────────────────────────────────────────────────── */

export type TransformComponent = {
  position: Vec3;
  rotation: Quat;
  prevPosition?: Vec3;
  prevRotation?: Quat;
};

export type PhysicsBodyComponent = {
  mass: number;
  isKinematic: boolean;
  material: MaterialProps;
  shape: ColliderShape;
  collisionGroup?: number;
  collisionMask?: number;
  userFlags?: number;

  linearVelocity?: Vec3;
  angularVelocity?: Vec3;

  _inPhysics?: boolean;
};

export type ECS = {
  transforms: Map<EntityId, TransformComponent>;
  bodies: Map<EntityId, PhysicsBodyComponent>;
};

export function vec3FromSoA(arr: Float32Array, i: number): Vec3 {
  const o = i * 3;
  return {
    x: arr[o + 0] ?? 0,
    y: arr[o + 1] ?? 0,
    z: arr[o + 2] ?? 0,
  };
}

export function quatFromSoA(arr: Float32Array, i: number): Quat {
  const o = i * 4;
  return {
    x: arr[o + 0] ?? 0,
    y: arr[o + 1] ?? 0,
    z: arr[o + 2] ?? 0,
    w: arr[o + 3] ?? 1,
  };
}

export function syncEcsToPhysics(ecs: ECS, physics: IPhysicsWorld): Result<void> {
  for (const [id, body] of ecs.bodies.entries()) {
    const tr = ecs.transforms.get(id);
    if (!tr) continue;

    if (!body._inPhysics) {
      const createData: BodyCreationData = {
        initialPosition: tr.position,
        initialRotation: tr.rotation,
        mass: body.mass,
        isKinematic: body.isKinematic,
        material: body.material,
        shape: body.shape,
      };
      if (body.linearVelocity) createData.initialLinearVelocity = body.linearVelocity;
      if (body.angularVelocity) createData.initialAngularVelocity = body.angularVelocity;
      if (typeof body.collisionGroup === "number") createData.collisionGroup = body.collisionGroup;
      if (typeof body.collisionMask === "number") createData.collisionMask = body.collisionMask;
      if (typeof body.userFlags === "number") createData.userFlags = body.userFlags;

      const res = physics.AddBody(id, createData);
      if (!res.ok) return res;
      body._inPhysics = true;
      continue;
    }

    const updateData: BodyUpdateData = {
      mass: body.mass,
      isKinematic: body.isKinematic,
      material: body.material,
      shape: body.shape,
    };
    if (typeof body.collisionGroup === "number") updateData.collisionGroup = body.collisionGroup;
    if (typeof body.collisionMask === "number") updateData.collisionMask = body.collisionMask;
    if (typeof body.userFlags === "number") updateData.userFlags = body.userFlags;

    const upd = physics.UpdateBody(id, updateData);
    if (!upd.ok) return upd;
  }

  return { ok: true, value: undefined };
}

export function applyPhysicsWriteBackToEcs(ecs: ECS, physics: IPhysicsWorld): void {
  const view = physics.GetWriteBackView ? physics.GetWriteBackView() : null;
  if (!view) return;

  const { entityIds, positions, rotations, linVels, angVels, count } = view;

  for (let i = 0; i < count; i++) {
    const id = entityIds[i] as EntityId;
    const tr = ecs.transforms.get(id);
    const body = ecs.bodies.get(id);

    if (!tr) continue;

    tr.prevPosition = tr.position;
    tr.prevRotation = tr.rotation;

    tr.position = vec3FromSoA(positions, i);
    tr.rotation = quatFromSoA(rotations, i);

    if (body) {
      body.linearVelocity = vec3FromSoA(linVels, i);
      body.angularVelocity = vec3FromSoA(angVels, i);
    }
  }
}

export function worldFixedStepTick(params: {
  ecs: ECS;
  physics: IPhysicsWorld;
  fixedDt: number;
  accumulator: number;
  frameDt: number;
  frameNumber: number;
  rollback?: { enabled: boolean; restoreFrame?: number };
  snapshots?: { enabled: boolean };
}): { accumulator: number; frameNumber: number; stepResult?: StepResult; error?: PhysicsError } {
  const { ecs, physics, fixedDt } = params;
  let { accumulator, frameDt, frameNumber } = params;

  accumulator += frameDt;

  let lastStepResult: StepResult | undefined;

  while (accumulator >= fixedDt) {
    if (params.rollback?.enabled && typeof params.rollback.restoreFrame === "number") {
      const rr = physics.RestoreSnapshot(params.rollback.restoreFrame);
      if (!rr.ok) return { accumulator, frameNumber, error: rr.error };
    }

    const s = syncEcsToPhysics(ecs, physics);
    if (!s.ok) return { accumulator, frameNumber, error: s.error };

    const step = physics.Step(fixedDt);

    applyPhysicsWriteBackToEcs(ecs, physics);

    physics.CollectEvents(1024);

    if (params.snapshots?.enabled) {
      const sr = physics.SaveSnapshot(frameNumber);
      if (!sr.ok) return { accumulator, frameNumber, error: sr.error };
    }

    accumulator -= fixedDt;
    frameNumber++;
    lastStepResult = step;
  }

  if (lastStepResult) {
    return { accumulator, frameNumber, stepResult: lastStepResult };
  }
  return { accumulator, frameNumber };
}
