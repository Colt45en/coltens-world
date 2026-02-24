/\*\*

- WebGPU + Three Shading Language (TSL) Integration for World Engine
- Compute shader example: Nexus AI agent swarm with pathfinding + flocking
-
- This integrates the archetype-core + spatial-grid + render-extraction
- into a high-performance GPU pipeline for 100k+ agents
  \*/

/\*\*

- ============================================================================
- PHASE 1: R3F Canvas Setup with WebGPU
- ============================================================================
-
- In your apps/preview-runtime/src/main.tsx:
  \*/

// import { Canvas } from '@react-three/fiber'
// import { WebGPURenderer } from 'three/webgpu'
// import type THREE from 'three/webgpu'
//
// function PreviewRuntime() {
// return (
// <Canvas
// gl={(canvas) => {
// const renderer = new WebGPURenderer({
// canvas,
// antialias: true,
// })
// // renderer.init() is async, returns Promise<Renderer>
// return renderer.init() as any
// }}
// >
// <GameScene />
// </Canvas>
// )
// }

/\*\*

- ============================================================================
- PHASE 2: Compute Shader (TSL) - Nexus AI Updates
- ============================================================================
-
- File: packages/graphics/src/nexus-compute-shader.ts
-
- This shader runs per frame on GPU:
- - Read: agent positions, velocities, goals
- - Read: spatial grid cells (precomputed on CPU)
- - Write: new velocities, updated positions
- - Side effect: friendly fire avoidance
    \*/

export const nexusComputeShaderCode = `
/_WGSL Compute Shader - Nexus AI Agent Update_/

struct Agent {
position: vec3f,
velocity: vec3f,
target: vec3f,
speed: f32,
neighborhood: vec3f, // encoded: separationRadius | cohesionRadius | alignmentWeight
}

@group(0) @binding(0) var<storage, read_write> agents: array<Agent>;
@group(0) @binding(1) var<storage, read> gridOffsets: array<u32>; // per-cell: offset into gridAgents
@group(0) @binding(2) var<storage, read> gridAgents: array<u32>; // flattened cell entities
@group(0) @binding(3) var<uniform> params: vec4f; // dt, sep_radius, cohesion_radius, max_speed

@compute @workgroup_size(256)
fn updateAgents(@builtin(global_invocation_id) gid: vec3u) {
let idx = gid.x;
if (idx >= arrayLength(&agents)) { return; }

var agent = agents[idx];
let dt = params.x;
let sep_radius = params.y;
let cohesion_radius = params.z;
let max_speed = params.w;

var sep_force = vec3f(0);
var cohesion_force = vec3f(0);
var alignment_vel = vec3f(0);
var neighbor_count = 0u;

// Simplified: check nearby agents (in real engine, use spatial hash)
for (var i = 0u; i < arrayLength(&agents); i++) {
if (i == idx) { continue; }
let other = agents[i];
let delta = other.position - agent.position;
let dist = length(delta);

    if (dist < sep_radius && dist > 0.01) {
      sep_force -= normalize(delta) * (1.0 - dist / sep_radius);
    }

    if (dist < cohesion_radius) {
      cohesion_force += other.position;
      alignment_vel += other.velocity;
      neighbor_count++;
    }

}

// Steering
var steer = agent.velocity;

// Seek goal
let goal_delta = agent.target - agent.position;
steer += normalize(goal_delta) \* 0.5;

// Separation
steer += sep_force \* 0.5;

// Cohesion
if (neighbor*count > 0u) {
cohesion_force /= f32(neighbor_count);
steer += (cohesion_force - agent.position) * 0.3;
alignment*vel /= f32(neighbor_count);
steer += (alignment_vel - agent.velocity) * 0.1;
}

// Clamp speed
let speed = length(steer);
if (speed > max_speed) {
steer = (steer / speed) \* max_speed;
}

// Update
agents[idx].velocity = steer;
agents[idx].position += steer \* dt;
}
`;

/\*\*

- ============================================================================
- PHASE 3: TSL Shader Builder (for shader generation)
- ============================================================================
-
- If using Three.js TSL, you'd write shaders like:
  \*/

// import { Fn, S, float, vec3, vec4, storage } from 'three/nodes/index.mjs'
//
// export function createNexusCompute() {
// const agents = storage(AgentStruct, null, { access: 'read_write' })
//
// return Fn([
// // Input: threadIdx
// float('idx'),
// ])(({ idx }) => {
// const agent = agents.element(idx)
//
// // Read neighbors
// let sepForce = vec3(0)
// for (let i = 0; i < agents.length; i++) {
// if (i === idx) continue
// const other = agents.element(i)
// const delta = other.position.sub(agent.position)
// const dist = delta.length()
//
// if (dist.lessThan(float(0.5)).and(dist.greaterThan(float(0.01)))) {
// sepForce = sepForce.sub(delta.normalize().mul(float(1).sub(dist.div(float(0.5)))))
// }
// }
//
// // Update velocity
// agent.velocity = agent.velocity.add(sepForce.mul(float(0.5)))
// agent.position = agent.position.add(agent.velocity.mul(float(0.016))) // 60 FPS
// })
// }

/\*\*

- ============================================================================
- PHASE 4: GPU Buffer Management
- ============================================================================
-
- File: packages/graphics/src/nexus-gpu-buffers.ts
  \*/

export class NexusGPUBuffers {
agentBuffer: GPUBuffer; // WGSL: storage<read_write>
gridOffsetBuffer: GPUBuffer; // CPU → GPU each frame
gridAgentBuffer: GPUBuffer; // CPU → GPU each frame
paramsBuffer: GPUBuffer; // dt, radii
bindings: GPUBindGroup;

constructor(
device: GPUDevice,
maxAgents: number,
maxGridCells: number,
maxGridAgents: number
) {
// Agent SoA
this.agentBuffer = device.createBuffer({
size: maxAgents \* 32, // ~2 vec3 + 2 f32 per agent
usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
mappedAtCreation: false,
})

    // Grid spatial structure (CPU pre-computed, uploaded each frame)
    this.gridOffsetBuffer = device.createBuffer({
      size: maxGridCells * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    })

    this.gridAgentBuffer = device.createBuffer({
      size: maxGridAgents * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    })

    // Params (dt, sep_radius, cohesion_radius, max_speed)
    this.paramsBuffer = device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    // Bind them for compute shader
    const layout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
      ],
    })

    this.bindings = device.createBindGroup({
      layout,
      entries: [
        { binding: 0, resource: { buffer: this.agentBuffer } },
        { binding: 1, resource: { buffer: this.gridOffsetBuffer } },
        { binding: 2, resource: { buffer: this.gridAgentBuffer } },
        { binding: 3, resource: { buffer: this.paramsBuffer } },
      ],
    })

}

uploadParams(device: GPUDevice, dt: number, separationRadius: number, cohesionRadius: number, maxSpeed: number) {
device.queue.writeBuffer(
this.paramsBuffer,
0,
new Float32Array([dt, separationRadius, cohesionRadius, maxSpeed])
)
}

uploadGridData(device: GPUDevice, gridOffsets: Uint32Array, gridAgents: Uint32Array) {
device.queue.writeBuffer(this.gridOffsetBuffer, 0, gridOffsets)
device.queue.writeBuffer(this.gridAgentBuffer, 0, gridAgents)
}
}

/\*\*

- ============================================================================
- PHASE 5: Render Graph Integration
- ============================================================================
-
- After compute shader runs, render packets flow through render graph:
-
- 1. ECS World + ArchetypeWorld holds agent data
- 1. SpatialGrid computes frustum culling on CPU
- 1. Extract visible agents → RenderPackets (buffers)
- 1. RenderGraph compiles passes:
- - Compute pass: update agents (GPU)
- - Shadow pass: render agent shadows
- - Main pass: render agents + environment
- - Tonemap pass: LDR
- - Present
- 1. Execute graph
      \*/

export class NexusRenderFrame {
constructor(
private world: any, // ArchetypeWorld
private spatialGrid: any, // SpatialGrid
private gpuBuffers: NexusGPUBuffers,
private device: GPUDevice,
private extractionCtx: any // ExtractionContext
) {}

run(deltaMs: number) {
// 1. Cull on CPU
const frustum = this.getFrameFrustum() // from camera
const culledEntities = this.spatialGrid.queryFrustum(frustum, new Set())

    // 2. Upload grid data
    const { offsets, agents: gridAgents } = this.buildGridBuffer(culledEntities)
    this.gpuBuffers.uploadGridData(this.device, offsets, gridAgents)
    this.gpuBuffers.uploadParams(this.device, deltaMs / 1000, 0.5, 2.0, 5.0)

    // 3. Run compute shader
    const commandEncoder = this.device.createCommandEncoder()
    const computePass = commandEncoder.beginComputePass()
    // computePass.setPipeline(this.computePipeline)
    // computePass.setBindGroup(0, this.gpuBuffers.bindings)
    // computePass.dispatchWorkgroups(Math.ceil(culledEntities.size / 256))
    // computePass.end()

    // 4. Extract to render packets
    const packets = this.extractionCtx.extractArchetype(
      culledEntities,
      (e) => this.getComponentData(e, "meshId"),
      (e) => this.getComponentData(e, "materialId"),
      (e) => this.getTransform(e)
    )

    // 5. Submit render graph
    // this.renderGraph.execute(commandEncoder, packets)
    // this.device.queue.submit([commandEncoder.finish()])

}

private getFrameFrustum(): any {
// Extract camera frustum AABB (simplified)
return {
min: { x: -50, y: -50, z: -50 },
max: { x: 50, y: 50, z: 50 },
}
}

private buildGridBuffer(entities: Set<number>): { offsets: Uint32Array; agents: Uint32Array } {
// CPU-side spatial grid → GPU buffers
// Simplified: just flatten
const offsets = new Uint32Array(1)
const agents = new Uint32Array([...entities])
offsets[0] = 0
return { offsets, agents }
}

private getComponentData(e: number, comp: string): number {
// Dummy: get from ECS
return 0
}

private getTransform(
e: number
): { pos: [number, number, number]; rot: [number, number, number, number]; scale: [number, number, number] } {
return {
pos: [0, 0, 0],
rot: [0, 0, 0, 1],
scale: [1, 1, 1],
}
}
}

/\*\*

- ============================================================================
- PHASE 6: Integration Checklist
- ============================================================================
-
- [ ] Update apps/preview-runtime/src/main.tsx: add WebGPU canvas init
- [ ] Create packages/graphics/src/nexus-compute-shader.ts (compute logic)
- [ ] Create packages/graphics/src/nexus-gpu-buffers.ts (GPU resource mgmt)
- [ ] Update packages/graphics/src/index.ts: export GPU buffer + shader builders
- [ ] Hook NexusRenderFrame into main loop (apps/preview-runtime/src/GameScene.tsx)
- [ ] Test: spawn 100k agents, verify 60fps + stable memory
- [ ] Profile: GPU utilization, compute vs render time split
-
- Performance targets:
- - 100k agents @ 60fps (GPU-bound, not CPU)
- - Compute shader: ~2-3ms (on modern GPU)
- - Extraction: ~1-2ms (CPU, should be negligible)
- - Render: ~10-12ms (depends on shading complexity)
    \*/

/\*\*

- ============================================================================
- Future: Multi-Agent Communication
- ============================================================================
-
- Nexus AI can:
- - Share local pheromone maps (texture-based)
- - Vote on group decisions (atomic operations)
- - Learn emergent behavior (compute shader + neural net eval)
-
- For true emergent swarms, add:
- 1. Shared learning state (small NN weights)
- 1. Per-agent replay buffer (small, circular)
- 1. Gradient accumulation in compute shader
- 1. Periodic upload of improved weights (CPU → GPU)
      \*/
