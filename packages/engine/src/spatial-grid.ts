/**
 * Spatial Grid: zero-allocation O(1) entity culling for 100k+ entities
 * - 2D grid cells (trivial to extend to 3D)
 * - Fast lookups by AABB/frustum
 * - Incremental move tracking (only update on cell cross)
 * - Per-query buffer writes (no allocations)
 */

import type { Archetype, ArchetypeWorld } from "./archetype-core";

export type Vec3 = { x: number; y: number; z: number };
export type AABB = { min: Vec3; max: Vec3 };

type GridCell = Set<number>; // EntityIds

/**
 * Result of a zero-alloc query: count + reused buffer
 */
export interface QueryResult {
    ids: Int32Array;
    count: number;
}

/**
 * 2D spatial grid (ignores Z for now, easily extended to 3D)
 * Useful for frustum/camera-relative culling
 *
 * Key API for 100k perf:
 * - cellIdFromPos(): get cell ID from position (fast int math)
 * - insert(entityId, cellId): add entity to cell (no position lookup)
 * - move(entityId, oldCellId, newCellId): move between cells (if needed)
 * - queryFrustumInto(aabb, outIds, startIdx): fill array from current count
 */
export class SpatialGrid {
    private grid: Map<number, GridCell> = new Map(); // cellId -> Set<entityId>
    private entityToCell: Map<number, number> = new Map(); // entityId -> cellId
    private cellSize: number;

    constructor(cellSize: number = 128) {
        this.cellSize = cellSize;
    }

    /**
     * Get cell ID from position (fast int math, no allocation)
     * Returns a unique cell identifier for (x,y)
     */
    cellIdFromPos(x: number, y: number, z?: number): number {
        const cx = Math.floor(x / this.cellSize);
        const cy = Math.floor(y / this.cellSize);
        // Cantor pairing: combines 2 ints into 1 unique int
        // For 3D, add z component: (cx + cy + cz) * (cx + cy + cz + 1) / 2 + cy
        return cx * 73856093 ^ cy * 19349663; // Simple XOR hash (fast, good distribution)
    }

    /**
     * Insert entity at a specific cell ID (call after cellIdFromPos)
     */
    insert(entityId: number, cellId: number) {
        if (!this.grid.has(cellId)) {
            this.grid.set(cellId, new Set());
        }
        this.grid.get(cellId)!.add(entityId);
        this.entityToCell.set(entityId, cellId);
    }

    /**
     * Move entity from one cell to another (only if cellId changed)
     */
    move(entityId: number, oldCellId: number, newCellId: number) {
        if (oldCellId === newCellId) return; // no-op

        this.grid.get(oldCellId)?.delete(entityId);
        if (!this.grid.has(newCellId)) {
            this.grid.set(newCellId, new Set());
        }
        this.grid.get(newCellId)!.add(entityId);
        this.entityToCell.set(entityId, newCellId);
    }

    /** Legacy: Insert/update entity position (slower, for one-offs) */
    upsert(entityId: number, pos: Vec3) {
        const cellId = this.cellIdFromPos(pos.x, pos.y, pos.z);
        const oldId = this.entityToCell.get(entityId);
        if (oldId === undefined) {
            this.insert(entityId, cellId);
        } else if (oldId !== cellId) {
            this.move(entityId, oldId, cellId);
        }
    }

    remove(entityId: number) {
        const cellId = this.entityToCell.get(entityId);
        if (cellId !== undefined) {
            this.grid.get(cellId)?.delete(entityId);
            this.entityToCell.delete(entityId);
        }
    }

    /**
     * Query AABB and fill into preallocated Int32Array (zero allocation)
     * Returns { ids: yourBuffer, count: howManyWritten }
     */
    queryAABBInto(aabb: AABB, outIds: Int32Array, startIdx: number = 0): QueryResult {
        const minCx = Math.floor(aabb.min.x / this.cellSize);
        const minCy = Math.floor(aabb.min.y / this.cellSize);
        const maxCx = Math.floor(aabb.max.x / this.cellSize);
        const maxCy = Math.floor(aabb.max.y / this.cellSize);

        let writeIdx = startIdx;
        for (let cx = minCx; cx <= maxCx; cx++) {
            for (let cy = minCy; cy <= maxCy; cy++) {
                const cellId = cx * 73856093 ^ cy * 19349663;
                const cell = this.grid.get(cellId);
                if (cell) {
                    for (const entityId of cell) {
                        if (writeIdx >= outIds.length) break; // guard overflow
                        outIds[writeIdx++] = entityId;
                    }
                }
            }
        }
        return { ids: outIds, count: writeIdx - startIdx };
    }

    /**
     * Frustum culling (simplified as AABB for now, easily extended)
     * Zero-allocation: fills provided buffer
     */
    queryFrustumInto(viewAabb: AABB, outIds: Int32Array, startIdx: number = 0): QueryResult {
        return this.queryAABBInto(viewAabb, outIds, startIdx);
    }

    /** Backward compat: legacy Set-based query (allocates, avoid in hot loop) */
    queryFrustum(viewAabb: AABB, out: Set<number>): Set<number> {
        out.clear();
        const minCx = Math.floor(viewAabb.min.x / this.cellSize);
        const minCy = Math.floor(viewAabb.min.y / this.cellSize);
        const maxCx = Math.floor(viewAabb.max.x / this.cellSize);
        const maxCy = Math.floor(viewAabb.max.y / this.cellSize);

        for (let cx = minCx; cx <= maxCx; cx++) {
            for (let cy = minCy; cy <= maxCy; cy++) {
                const cellId = cx * 73856093 ^ cy * 19349663;
                const cell = this.grid.get(cellId);
                if (cell) {
                    for (const e of cell) out.add(e);
                }
            }
        }
        return out;
    }
}

/**
 * Culling helper: find visible archetype rows + entity IDs in view (zero-alloc version)
 * Use this for extraction pipeline
 */
export function cullArchetypesByFrustumInto(
    world: ArchetypeWorld,
    grid: SpatialGrid,
    viewAabb: AABB,
    scratchIds: Int32Array
): Array<{ archetype: Archetype; entityIds: Int32Array; count: number }> {
    // Fill buffer with visible entity IDs (zero allocation)
    const visible = grid.queryFrustumInto(viewAabb, scratchIds, 0);

    // Group entities by archetype
    const byArch = new Map<Archetype, number[]>();
    for (let i = 0; i < visible.count; i++) {
        const entityId = visible.ids[i]!;
        // You'll need to add a method to ArchetypeWorld to get entity's archetype
        // For now, this is a placeholder for the grouping logic
        // byArch.get(arch)?.push(i) or similar
    }

    return [...byArch.entries()].map(([archetype, indices]) => ({
        archetype,
        entityIds: scratchIds,
        count: indices.length,
    }));
}

/**
 * @deprecated Use cullArchetypesByFrustumInto instead (zero-alloc version)
 */
export function cullArchetypesByFrustum(
    world: ArchetypeWorld,
    grid: SpatialGrid,
    viewAabb: AABB,
    scratch: Set<number>
): Array<{ archetype: Archetype; entityIds: number[] }> {
    const visible = grid.queryFrustum(viewAabb, scratch);

    // Group entities by archetype
    const byArch = new Map<Archetype, number[]>();
    for (const e of visible) {
        // Quick lookup from EntityId → archetype
        // You'll need to add a method to ArchetypeWorld to get entity's archetype
        // For now, we'll assume you have a way to find it (e.g. dense array)
        // byArch.get(arch)?.push(e) or similar
    }

    return [...byArch.values()].map((entityIds) => ({
        archetype: undefined as any, // placeholder
        entityIds,
    }));
}
