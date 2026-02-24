/**
 * Render Extraction: ECS → GPU-ready typed arrays
 * Converts archetype SoA to render packets (instances for WebGPU/Three.js)
 * Zero allocations during extraction (pre-allocated buffers)
 */

type ArchetypeLike = Record<string, unknown>;

/**
 * Render packet: GPU-ready buffers for one draw call
 * All buffers are typed arrays (SoA layout)
 */
export type RenderPacket = {
    meshId: Uint32Array; // per-instance mesh ID
    materialId: Uint32Array; // per-instance material ID
    positions: Float32Array; // vec3 per instance (stride=3)
    rotations: Float32Array; // quat per instance (stride=4)
    scales: Float32Array; // vec3 per instance (stride=3)
    // Optional: custom attributes
    colors?: Uint8Array; // RGBA per instance
    metallic?: Float32Array;
    roughness?: Float32Array;
    custom?: Map<string, TypedArray>;

    visibleCount: number; // how many instances actually drawn
};

type TypedArray = Int8Array | Uint8Array | Int16Array | Uint16Array | Int32Array | Uint32Array | Float32Array | Float64Array;

/** Extraction context: pre-allocated buffers for reuse */
export class ExtractionContext {
    private packets = new Map<string, RenderPacket>();
    private readonly maxInstances: number;

    constructor(maxInstances: number = 100000) {
        this.maxInstances = maxInstances;
    }

    /** Get or create packet for a mesh+material combo */
    getPacket(key: string): RenderPacket {
        if (this.packets.has(key)) return this.packets.get(key)!;

        const packet: RenderPacket = {
            meshId: new Uint32Array(this.maxInstances),
            materialId: new Uint32Array(this.maxInstances),
            positions: new Float32Array(this.maxInstances * 3),
            rotations: new Float32Array(this.maxInstances * 4),
            scales: new Float32Array(this.maxInstances * 3),
            colors: new Uint8Array(this.maxInstances * 4),
            metallic: new Float32Array(this.maxInstances),
            roughness: new Float32Array(this.maxInstances),
            custom: new Map(),
            visibleCount: 0,
        };

        this.packets.set(key, packet);
        return packet;
    }

    /** Extract visible entities from archetype into packets */
    extractArchetype(
        arch: ArchetypeLike,
        entityIds: number[],
        getMeshId: (e: number) => number,
        getMaterialId: (e: number) => number,
        getTransform: (e: number) => { pos: [number, number, number]; rot: [number, number, number, number]; scale: [number, number, number] }
    ) {
        // Group instances by mesh+material
        const byMaterial = new Map<string, number[]>();
        for (const e of entityIds) {
            const meshId = getMeshId(e);
            const matId = getMaterialId(e);
            const key = `${meshId}:${matId}`;
            if (!byMaterial.has(key)) byMaterial.set(key, []);
            byMaterial.get(key)!.push(e);
        }

        // Write to packets (one per mesh+material)
        for (const [key, instances] of byMaterial) {
            const packet = this.getPacket(key);
            const [meshIdRaw, matIdRaw] = key.split(":");
            const meshId = Number(meshIdRaw ?? 0);
            const matId = Number(matIdRaw ?? 0);

            for (let i = 0; i < instances.length; i++) {
                const e = instances[i];
                if (e === undefined) continue;
                const { pos, rot, scale } = getTransform(e);

                // Write instance data
                packet.meshId[i] = meshId;
                packet.materialId[i] = matId;

                // Position (vec3)
                packet.positions[i * 3] = pos[0];
                packet.positions[i * 3 + 1] = pos[1];
                packet.positions[i * 3 + 2] = pos[2];

                // Rotation (quat)
                packet.rotations[i * 4] = rot[0];
                packet.rotations[i * 4 + 1] = rot[1];
                packet.rotations[i * 4 + 2] = rot[2];
                packet.rotations[i * 4 + 3] = rot[3];

                // Scale (vec3)
                packet.scales[i * 3] = scale[0];
                packet.scales[i * 3 + 1] = scale[1];
                packet.scales[i * 3 + 2] = scale[2];
            }

            packet.visibleCount = instances.length;
        }
    }

    getPackets(): RenderPacket[] {
        return [...this.packets.values()];
    }

    clear() {
        for (const packet of this.packets.values()) {
            packet.visibleCount = 0;
        }
    }
}

/**
 * High-level extraction pipeline:
 * ECS → SpatialGrid (frustum cull) → RenderPackets
 */
export function extractFrame(
    culledEntities: number[],
    getMeshId: (e: number) => number,
    getMaterial: (e: number) => number,
    getTransform: (e: number) => { pos: [number, number, number]; rot: [number, number, number, number]; scale: [number, number, number] },
    ctx: ExtractionContext
): RenderPacket[] {
    ctx.clear();

    // For demo: assume all entities same archetype
    // In practice, group by archetype then extract per arch

    const byMaterial = new Map<string, number[]>();
    for (const e of culledEntities) {
        const key = `${getMeshId(e)}:${getMaterial(e)}`;
        if (!byMaterial.has(key)) byMaterial.set(key, []);
        byMaterial.get(key)!.push(e);
    }

    for (const [key, instances] of byMaterial) {
        const packet = ctx.getPacket(key);
        const [meshIdRaw, matIdRaw] = key.split(":");
        const meshId = Number(meshIdRaw ?? 0);
        const matId = Number(matIdRaw ?? 0);

        for (let i = 0; i < instances.length; i++) {
            const e = instances[i];
            if (e === undefined) continue;
            const { pos, rot, scale } = getTransform(e);

            packet.meshId[i] = meshId;
            packet.materialId[i] = matId;
            packet.positions[i * 3] = pos[0];
            packet.positions[i * 3 + 1] = pos[1];
            packet.positions[i * 3 + 2] = pos[2];
            packet.rotations[i * 4] = rot[0];
            packet.rotations[i * 4 + 1] = rot[1];
            packet.rotations[i * 4 + 2] = rot[2];
            packet.rotations[i * 4 + 3] = rot[3];
            packet.scales[i * 3] = scale[0];
            packet.scales[i * 3 + 1] = scale[1];
            packet.scales[i * 3 + 2] = scale[2];
        }

        packet.visibleCount = instances.length;
    }

    return ctx.getPackets();
}
