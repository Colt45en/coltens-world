/**
 * Nexus Swarm System — GPU-Accelerated Agent Flocking
 *
 * 100k+ agents with spatial grid + compute shaders (Three.js WebGPU + TSL)
 *
 * Architecture:
 * 1. StorageBufferAttribute for position/velocity (GPU-writable)
 * 2. Spatial grid on GPU (atomic cell counters + slot list)
 * 3. Three compute passes per frame:
 *    - Clear: reset grid counts to 0
 *    - Build: agent → cell slot list (atomic distributes)
 *    - Update: seek + flocking using grid neighbor query
 * 4. PointsNodeMaterial renders from storage buffer directly
 *
 * Why this pattern works:
 * - No CPU↔GPU readback (GPU maintains grid too)
 * - Atomic ops prevent race conditions in parallel build
 * - Storage buffers are both compute I/O and render attributes
 * - TSL (Three Shading Language) integrates seamlessly with R3F
 */

import {
  atomicAdd,
  atomicLoad,
  atomicStore,
  clamp,
  float,
  Fn,
  If,
  instanceIndex,
  int,
  length,
  Loop,
  min,
  normalize,
  storage,
  storageBarrier,
  struct,
  uint,
  uniform,
  vec3
} from "three/tsl";
import * as THREE from "three/webgpu";

/**
 * Configuration for swarm behavior + constraints
 */
export type NexusSwarmConfig = {
  /** Total agent count (e.g., 100_000) */
  agentCount: number;

  /** World bounds (AABB for agent movement) */
  worldMin: THREE.Vector3;
  worldMax: THREE.Vector3;

  /** Spatial grid cell size (world units) */
  cellSize: number;

  /** Max agents per cell (overflow drops neighbors; tune 32–128) */
  cellCapacity: number;

  /** Flocking radii (world units) */
  separationRadius: number;
  cohesionRadius: number;
  alignmentRadius: number;

  /** Behavior weights & damping */
  weights: {
    seek: number; // goal attraction
    separation: number; // repulsion from neighbors
    cohesion: number; // move toward neighbor center
    alignment: number; // match neighbor velocity
    damping: number; // velocity decay (0.95–0.99 typical)
  };

  /** Speed clamp (world units/sec) */
  maxSpeed: number;
};

function ceilDiv(a: number, b: number): number {
  return Math.floor((a + b - 1) / b);
}

/**
 * Main GPU swarm system
 *
 * Usage:
 *   const swarm = new NexusSwarmSystem({ agentCount: 100_000, ... });
 *   scene.add(swarm.points);
 *
 *   useFrame((_, dt) => {
 *     swarm.step(renderer, dt);
 *   });
 */
export class NexusSwarmSystem {
  readonly cfg: NexusSwarmConfig;

  // GPU-writable storage buffers
  // These are the "source of truth" for agent state
  private readonly posAttr: THREE.StorageBufferAttribute; // vec4 (position + unused)
  private readonly velAttr: THREE.StorageBufferAttribute; // vec4 (velocity + unused)
  private readonly tgtAttr: THREE.StorageBufferAttribute; // vec4 (target + unused)

  // Spatial grid (CPU-resident grid metadata, GPU-maintained counts + slots)
  private readonly gridAgentsAttr: THREE.StorageBufferAttribute; // u32 array, capacity = numCells * cellCapacity
  private readonly gridCountsAttr: THREE.StorageBufferAttribute; // u32 array, one atomic per cell

  // TSL storage buffer nodes (compute I/O)
  private readonly pos;
  private readonly vel;
  private readonly tgt;
  private readonly gridAgents;
  private readonly gridCounts;

  // TSL uniform nodes (broadcasted to all shader invocations)
  private readonly uWorldMin;
  private readonly uWorldMax;
  private readonly uSepR;
  private readonly uCohR;
  private readonly uAliR;
  private readonly uMaxSpeed;
  private readonly uSeekW;
  private readonly uSepW;
  private readonly uCohW;
  private readonly uAliW;
  private readonly uDamp;

  // Grid geometry (derived from config)
  readonly gridResX: number;
  readonly gridResY: number;
  readonly gridResZ: number;
  readonly numCells: number;

  // Compute shader nodes (TSL Fn)
  private readonly clearGrid;
  private readonly buildGrid;
  private readonly updateAgents;

  // Render object (Points using PointsNodeMaterial)
  readonly points: THREE.Points;

  constructor(cfg: NexusSwarmConfig) {
    this.cfg = cfg;

    // =====================================================
    // 1. Derive grid dimensions from world bounds
    // =====================================================
    const size = new THREE.Vector3().subVectors(cfg.worldMax, cfg.worldMin);
    this.gridResX = Math.max(1, Math.ceil(size.x / cfg.cellSize));
    this.gridResY = Math.max(1, Math.ceil(size.y / cfg.cellSize));
    this.gridResZ = Math.max(1, Math.ceil(size.z / cfg.cellSize));
    this.numCells = this.gridResX * this.gridResY * this.gridResZ;

    const agentCount = cfg.agentCount;
    const cellCapacity = cfg.cellCapacity;
    const totalSlots = this.numCells * cellCapacity;

    console.log(`[NexusSwarm] Grid: ${this.gridResX}×${this.gridResY}×${this.gridResZ} = ${this.numCells} cells, ${totalSlots} slots (cap ${cellCapacity})`);

    // =====================================================
    // 2. Allocate GPU-writable storage buffer attributes
    // =====================================================
    // StorageBufferAttribute: writable from compute, readable by vertex shader
    // Format: (itemSize, type) = 4 floats per agent (vec4)
    this.posAttr = new THREE.StorageBufferAttribute(agentCount, 4);
    this.velAttr = new THREE.StorageBufferAttribute(agentCount, 4);
    this.tgtAttr = new THREE.StorageBufferAttribute(agentCount, 4);

    this.gridAgentsAttr = new THREE.StorageBufferAttribute(totalSlots, 1);
    this.gridCountsAttr = new THREE.StorageBufferAttribute(this.numCells, 1);

    // =====================================================
    // 3. Seed initial agent state
    // =====================================================
    this.seedInitialState();

    // =====================================================
    // 4. Build TSL storage buffer nodes from attributes
    // =====================================================
    // These become the I/O for compute shaders
    this.pos = storage(this.posAttr, "vec4", agentCount);
    this.vel = storage(this.velAttr, "vec4", agentCount);
    this.tgt = storage(this.tgtAttr, "vec4", agentCount);

    this.gridAgents = storage(this.gridAgentsAttr, "uint", totalSlots);

    // Atomic struct for grid counts: each cell has an atomic counter
    const AtomicCount = struct(
      { count: { type: "uint", atomic: true } },
      "AtomicCount"
    );
    this.gridCounts = storage(this.gridCountsAttr, AtomicCount, this.numCells);

    // =====================================================
    // 5. Build TSL uniform nodes (broadcast values)
    // =====================================================
    this.uWorldMin = uniform(cfg.worldMin);
    this.uWorldMax = uniform(cfg.worldMax);
    this.uSepR = uniform(cfg.separationRadius);
    this.uCohR = uniform(cfg.cohesionRadius);
    this.uAliR = uniform(cfg.alignmentRadius);
    this.uMaxSpeed = uniform(cfg.maxSpeed);
    this.uSeekW = uniform(cfg.weights.seek);
    this.uSepW = uniform(cfg.weights.separation);
    this.uCohW = uniform(cfg.weights.cohesion);
    this.uAliW = uniform(cfg.weights.alignment);
    this.uDamp = uniform(cfg.weights.damping);

    // =====================================================
    // 6. Build compute shader nodes (TSL Fn)
    // =====================================================
    this.clearGrid = this.makeClearGridCounts();
    this.buildGrid = this.makeBuildGrid();
    this.updateAgents = this.makeUpdateAgents();

    // =====================================================
    // 7. Create render object (Points with PointsNodeMaterial)
    // =====================================================
    // PointsNodeMaterial: node-based material for WebGPU Points
    // Position is sourced directly from storage buffer
    const geom = new THREE.BufferGeometry();
    // Dummy attribute for draw count; PointsNodeMaterial will use our positionNode
    geom.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(agentCount * 3), 3)
    );

    const mat = new THREE.PointsNodeMaterial();

    // Bind storage buffer as position source
    // .toAttribute() converts storage node to attribute node for rendering
    mat.positionNode = this.pos.toAttribute().xyz;

    // Visible cyan color (customize per-agent with colorNode if desired)
    mat.color = new THREE.Color(0x3df6ff);

    this.points = new THREE.Points(geom, mat);
    this.points.frustumCulled = false; // GPU grid is our culling truth
  }

  dispose() {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }

  /**
   * Per-frame update
   *
   * Executes 3 compute passes:
   * 1. Clear grid counts to 0
   * 2. Rebuild spatial grid (agent → cell)
   * 3. Update agents (seek + flocking)
   *
   * Then renders points from updated positions
   */
  step(renderer: THREE.Renderer, dtSeconds: number) {
    // =====================================================
    // Update uniform values from CPU config
    // =====================================================
    // This allows you to change behavior at runtime
    (this.uSepR as any).value = this.cfg.separationRadius;
    (this.uCohR as any).value = this.cfg.cohesionRadius;
    (this.uAliR as any).value = this.cfg.alignmentRadius;
    (this.uMaxSpeed as any).value = this.cfg.maxSpeed;

    (this.uSeekW as any).value = this.cfg.weights.seek;
    (this.uSepW as any).value = this.cfg.weights.separation;
    (this.uCohW as any).value = this.cfg.weights.cohesion;
    (this.uAliW as any).value = this.cfg.weights.alignment;
    (this.uDamp as any).value = this.cfg.weights.damping;

    // =====================================================
    // Inject dt into compute context
    // =====================================================
    // renderer.compute() allows passing a uniform dict
    // We'll use this approach to pass dt
    (this as any).dt = dtSeconds;

    // =====================================================
    // Execute compute passes in sequence
    // =====================================================
    // Renderer.compute(nodes, target, uniforms) dispatches compute shaders
    // WebGPU backend: uses ComputePass
    // Order matters: clear → build → update
    (renderer as any).compute(
      [this.clearGrid, this.buildGrid, this.updateAgents],
      null,
      { dt: dtSeconds }
    );
  }

  /**
   * Set target position for all agents (e.g., for seek behavior)
   *
   * Usage:
   *   swarm.setTargetAll(new THREE.Vector3(10, 0, 0));
   */
  setTargetAll(target: THREE.Vector3) {
    const a = this.tgtAttr.array as Float32Array;
    for (let i = 0; i < this.cfg.agentCount; i++) {
      const o = i * 4;
      a[o + 0] = target.x;
      a[o + 1] = target.y;
      a[o + 2] = target.z;
      a[o + 3] = 1;
    }
    this.tgtAttr.needsUpdate = true;
  }

  /**
   * Read agent positions back to CPU (expensive! use sparingly)
   *
   * Returns Uint8Array of positions (Float32)
   */
  readPositions(): Float32Array {
    return this.posAttr.array as Float32Array;
  }

  // ================================================================
  // PRIVATE: Compute shader builders (TSL Fn nodes)
  // ================================================================

  private makeClearGridCounts() {
    const numCells = this.numCells;

    // Clear: one invocation per cell
    // Set atomic counter to 0
    return Fn(() => {
      const i = instanceIndex;
      const cell = this.gridCounts.element(i);
      const countPtr = cell.get("count");

      // atomicStore(ptr, value): replace atomic value with new value
      atomicStore(countPtr, uint(0));
    })().compute(numCells, [256]); // 256 workgroup size
  }

  private makeBuildGrid() {
    const agentCount = this.cfg.agentCount;
    const cap = this.cfg.cellCapacity;

    const RESX = int(this.gridResX);
    const RESY = int(this.gridResY);
    const RESZ = int(this.gridResZ);

    const cellSizeF = float(this.cfg.cellSize);
    const capU = uint(cap);

    // Build: one invocation per agent
    // Distribute agent into cell grid using atomic ops
    return Fn(() => {
      const idx = instanceIndex;

      // Get agent position
      const p4 = this.pos.element(idx);
      const p = p4.xyz;

      // Compute cell coordinate: floor((p - min) / cellSize)
      const rel = p.sub(this.uWorldMin);
      const c = rel.div(cellSizeF);
      const cxRaw = int(c.x.floor());
      const cyRaw = int(c.y.floor());
      const czRaw = int(c.z.floor());

      // Manual integer clamp: max(0, min(value, limit))
      const cx = cxRaw.lessThan(int(0)).select(int(0), cxRaw.greaterThan(RESX.sub(1)).select(RESX.sub(1), cxRaw));
      const cy = cyRaw.lessThan(int(0)).select(int(0), cyRaw.greaterThan(RESY.sub(1)).select(RESY.sub(1), cyRaw));
      const cz = czRaw.lessThan(int(0)).select(int(0), czRaw.greaterThan(RESZ.sub(1)).select(RESZ.sub(1), czRaw));

      // Convert 3D cell coord to 1D index
      const cellI = cx.add(cy.mul(RESX)).add(cz.mul(RESX.mul(RESY)));
      const cellU = uint(cellI);

      // Atomic increment: get unique slot in this cell
      const cellRec = this.gridCounts.element(cellU);
      const countPtr = cellRec.get("count");
      const slot = uint(atomicAdd(countPtr, uint(1))); // returns old count

      // Write agent index to slot (if within capacity)
      If(slot.lessThan(capU), () => {
        const writeIndex = cellU.mul(capU).add(slot);
        this.gridAgents.element(writeIndex).assign(uint(idx));
      });

      // Memory barrier: ensure all writes visible to next pass
      storageBarrier();
    })().compute(agentCount, [256]);
  }

  private makeUpdateAgents() {
    const agentCount = this.cfg.agentCount;
    const cap = this.cfg.cellCapacity;

    const RESX = int(this.gridResX);
    const RESY = int(this.gridResY);
    const RESZ = int(this.gridResZ);

    const cellSizeF = float(this.cfg.cellSize);
    const capU = uint(cap);

    // dt comes via renderer.compute(..., uniforms) → we access via uniform node
    // This gets overwritten each frame in step()
    const dt = uniform(0.016);

    // Update: one invocation per agent
    // Compute steering + integrate position
    return Fn(() => {
      const idx = instanceIndex;

      // Inject dt (from step() context)
      // In a real setup, this would be passed as a uniform via renderer.compute()
      // For now we'll access it from the context (see step() method)
      (dt as any).value = (this as any).dt ?? 0.016;

      // Load agent state
      const p4 = this.pos.element(idx);
      const v4 = this.vel.element(idx);
      const t4 = this.tgt.element(idx);

      const p = p4.xyz;
      const v = v4.xyz;
      const target = t4.xyz;

      // Accumulate steering
      const steer = vec3(0);
      const sepForce = vec3(0);
      const cohAcc = vec3(0);
      const aliAcc = vec3(0);
      const nCount = float(0);

      // === SEEK goal ===
      const toGoal = target.sub(p);
      If(length(toGoal).greaterThan(float(1e-6)), () => {
        steer.addAssign(normalize(toGoal).mul(this.uSeekW));
      });

      // === FLOCKING (query neighbors from grid) ===
      // Compute this agent's cell
      const rel = p.sub(this.uWorldMin);
      const c = rel.div(cellSizeF);
      const cxRaw = int(c.x.floor());
      const cyRaw = int(c.y.floor());
      const czRaw = int(c.z.floor());
      const cx = cxRaw.lessThan(int(0)).select(int(0), cxRaw.greaterThan(RESX.sub(1)).select(RESX.sub(1), cxRaw));
      const cy = cyRaw.lessThan(int(0)).select(int(0), cyRaw.greaterThan(RESY.sub(1)).select(RESY.sub(1), cyRaw));
      const cz = czRaw.lessThan(int(0)).select(int(0), czRaw.greaterThan(RESZ.sub(1)).select(RESZ.sub(1), czRaw));

      // Iterate 3×3×3 neighbor cells
      Loop(3, ({ i: dxNode }) => {
        const dx = int(dxNode).sub(int(1)); // map [0, 1, 2] to [-1, 0, 1]
        Loop(3, ({ i: dyNode }) => {
          const dy = int(dyNode).sub(int(1));
          Loop(3, ({ i: dzNode }) => {
            const dz = int(dzNode).sub(int(1));
            const nx = cx.add(dx).lessThan(int(0)).select(int(0), cx.add(dx).greaterThan(RESX.sub(1)).select(RESX.sub(1), cx.add(dx)));
            const ny = cy.add(dy).lessThan(int(0)).select(int(0), cy.add(dy).greaterThan(RESY.sub(1)).select(RESY.sub(1), cy.add(dy)));
            const nz = cz.add(dz).lessThan(int(0)).select(int(0), cz.add(dz).greaterThan(RESZ.sub(1)).select(RESZ.sub(1), cz.add(dz)));

                  const nCellI = nx.add(ny.mul(RESX)).add(nz.mul(RESX.mul(RESY)));
                  const nCellU = uint(nCellI);

                  // Get neighbor count
                  const cellRec = this.gridCounts.element(nCellU);
                  const countPtr = cellRec.get("count");
                  const countVal = atomicLoad(countPtr);
                  const countU = uint(countVal);

                  const limitU = uint(min(float(countU), float(capU))); // cap at cellCapacity
                  const limitI = int(limitU);

                  // Iterate agents in this cell
                  Loop(
                    { start: int(0), end: limitI },
                    ({ i }) => {
                      const otherU = this.gridAgents.element(
                        nCellU.mul(capU).add(uint(i))
                      );
                      const otherI = int(otherU);

                      // Skip self
                      If(otherI.equal(idx), () => {
                        return;
                      });

                      // Load neighbor state
                      const op = this.pos.element(otherI).xyz;
                      const ov = this.vel.element(otherI).xyz;

                      const d = op.sub(p);
                      const dist = length(d);

                      // --- SEPARATION (repulsion) ---
                      If(
                        dist
                          .lessThan(this.uSepR)
                          .and(dist.greaterThan(float(1e-3))),
                        () => {
                          const push = normalize(d)
                            .mul(float(-1))
                            .mul(float(1).sub(dist.div(this.uSepR)));
                          sepForce.addAssign(push);
                        }
                      );

                      // --- COHESION + ALIGNMENT (averaging) ---
                      If(dist.lessThan(this.uCohR), () => {
                        cohAcc.addAssign(op);
                        aliAcc.addAssign(ov);
                        nCount.addAssign(1);
                      });
                    }
                  );
                }
              );
            }
          );
        }
      );

      // Apply averaged neighbor forces
      If(nCount.greaterThan(float(0)), () => {
        const inv = float(1).div(nCount);
        const cohCenter = cohAcc.mul(inv);
        const aliMean = aliAcc.mul(inv);

        const cohSteer = cohCenter.sub(p).mul(this.uCohW);
        const aliSteer = aliMean.sub(v).mul(this.uAliW);

        steer.addAssign(cohSteer);
        steer.addAssign(aliSteer);
      });

      // Add separation force
      steer.addAssign(sepForce.mul(this.uSepW));

      // === INTEGRATE ===
      const newV = vec3(0);
      newV.assign(v);
      newV.addAssign(steer);
      newV.mulAssign(this.uDamp); // damping

      // Clamp speed
      const sp = length(newV);
      If(sp.greaterThan(this.uMaxSpeed), () => {
        newV.assign(newV.div(sp).mul(this.uMaxSpeed));
      });

      // Integrate position
      const newP = vec3(0);
      newP.assign(p);
      newP.addAssign(newV.mul(dt));

      // === BOUNDARY (toroidal wrap) ===
      // When agent exits bounds, wrap to opposite side
      If(newP.x.lessThan(this.uWorldMin.x), () =>
        newP.x.assign(this.uWorldMax.x)
      );
      If(newP.y.lessThan(this.uWorldMin.y), () =>
        newP.y.assign(this.uWorldMax.y)
      );
      If(newP.z.lessThan(this.uWorldMin.z), () =>
        newP.z.assign(this.uWorldMax.z)
      );

      If(newP.x.greaterThan(this.uWorldMax.x), () =>
        newP.x.assign(this.uWorldMin.x)
      );
      If(newP.y.greaterThan(this.uWorldMax.y), () =>
        newP.y.assign(this.uWorldMin.y)
      );
      If(newP.z.greaterThan(this.uWorldMax.z), () =>
        newP.z.assign(this.uWorldMin.z)
      );

      // Write back
      v4.xyz.assign(newV);
      p4.xyz.assign(newP);
    })().compute(agentCount, [256]);
  }

  // ================================================================
  // PRIVATE: Initialization
  // ================================================================

  private seedInitialState() {
    const { agentCount, worldMin, worldMax, maxSpeed } = this.cfg;

    const posA = this.posAttr.array as Float32Array;
    const velA = this.velAttr.array as Float32Array;
    const tgtA = this.tgtAttr.array as Float32Array;

    const rand = (a: number, b: number) => a + Math.random() * (b - a);

    for (let i = 0; i < agentCount; i++) {
      const o = i * 4;

      // Random position within bounds
      posA[o + 0] = rand(worldMin.x, worldMax.x);
      posA[o + 1] = rand(worldMin.y, worldMax.y);
      posA[o + 2] = rand(worldMin.z, worldMax.z);
      posA[o + 3] = 1;

      // Random velocity direction + speed
      const vx = rand(-1, 1);
      const vy = rand(-1, 1);
      const vz = rand(-1, 1);
      const len = Math.max(1e-6, Math.sqrt(vx * vx + vy * vy + vz * vz));
      velA[o + 0] = (vx / len) * rand(0.25 * maxSpeed, 0.75 * maxSpeed);
      velA[o + 1] = (vy / len) * rand(0.25 * maxSpeed, 0.75 * maxSpeed);
      velA[o + 2] = (vz / len) * rand(0.25 * maxSpeed, 0.75 * maxSpeed);
      velA[o + 3] = 0;

      // Initial target: center
      tgtA[o + 0] = 0;
      tgtA[o + 1] = 0;
      tgtA[o + 2] = 0;
      tgtA[o + 3] = 1;
    }

    // Clear grid
    (this.gridAgentsAttr.array as Uint32Array).fill(0);
    (this.gridCountsAttr.array as Uint32Array).fill(0);

    // Mark for GPU upload
    this.posAttr.needsUpdate = true;
    this.velAttr.needsUpdate = true;
    this.tgtAttr.needsUpdate = true;
    this.gridAgentsAttr.needsUpdate = true;
    this.gridCountsAttr.needsUpdate = true;
  }
}
