/**
 * High-performance ECS core (100k+ entities)
 * - BigInt masks (unlimited components)
 * - SoA storage with typed arrays + strides
 * - O(1) entity moves + query caching
 * - Ready for WebGPU extraction
 *
 * Usage: drop-in replacement for index.ts, or use alongside for perf-critical systems
 */

export type EntityId = number;
export type ComponentId = string;
export type Mask = bigint;

type TypedArray =
    | Float32Array
    | Float64Array
    | Int8Array
    | Uint8Array
    | Int16Array
    | Uint16Array
    | Int32Array
    | Uint32Array
    | BigInt64Array
    | BigUint64Array;

type TypedArrayCtor<T extends TypedArray = TypedArray> = {
    new(length: number): T;
};

export type ComponentDef = {
    id: ComponentId;
    stride: number; // e.g. vec3 => 3, scalar => 1
    ctor: TypedArrayCtor; // e.g. Float32Array
};

type ComponentValue = number | bigint | ArrayLike<number> | ArrayLike<bigint>;

type EntityRecord = {
    archetype: Archetype;
    row: number;
};

/** SoA storage for one archetype */
class SoAStorage {
    private buffers = new Map<ComponentId, TypedArray>();
    private capacityRows = 0;

    constructor(private readonly schema: Map<ComponentId, ComponentDef>) { }

    get(id: ComponentId): TypedArray {
        const buf = this.buffers.get(id);
        if (!buf) throw new Error(`Missing buffer for component ${id}`);
        return buf;
    }

    ensureCapacity(rows: number) {
        if (rows <= this.capacityRows) return;
        const next = Math.max(64, this.capacityRows === 0 ? 64 : this.capacityRows * 2);
        const targetRows = Math.max(next, rows);
        this.capacityRows = targetRows;

        for (const [id, def] of this.schema) {
            const neededLen = targetRows * def.stride;
            const cur = this.buffers.get(id);
            if (!cur) {
                this.buffers.set(id, new def.ctor(neededLen));
            } else if (neededLen > cur.length) {
                const nxt = new def.ctor(neededLen);
                if (cur.constructor === nxt.constructor) {
                    (nxt as any).set(cur as any);
                } else {
                    for (let i = 0; i < cur.length; i++) (nxt as any)[i] = (cur as any)[i];
                }
                this.buffers.set(id, nxt);
            }
        }
    }

    swapPopRow(row: number, lastRow: number) {
        if (row === lastRow) return;
        for (const [id, def] of this.schema) {
            const buf = this.get(id);
            const stride = def.stride;
            const a = row * stride;
            const b = lastRow * stride;
            for (let i = 0; i < stride; i++) (buf as any)[a + i] = (buf as any)[b + i];
        }
    }

    copyBlock(src: SoAStorage, srcRow: number, dstRow: number, schema: Map<ComponentId, ComponentDef>) {
        for (const [id, def] of schema) {
            if (!this.buffers.has(id)) continue;
            const stride = def.stride;
            const srcBuf = src.get(id);
            const dstBuf = this.get(id);
            for (let i = 0; i < stride; i++) {
                (dstBuf as any)[dstRow * stride + i] = (srcBuf as any)[srcRow * stride + i];
            }
        }
    }

    writeValues(row: number, values: Record<ComponentId, ComponentValue | undefined>) {
        for (const [id, def] of this.schema) {
            const buf = this.get(id);
            const stride = def.stride;
            const offset = row * stride;
            const val = values[id];

            if (typeof val === "number" || typeof val === "bigint") {
                (buf as any)[offset] = val as any;
                for (let i = 1; i < stride; i++) (buf as any)[offset + i] = 0;
            } else if (val && typeof val === "object" && "length" in val) {
                const n = Math.min(stride, val.length);
                for (let i = 0; i < n; i++) (buf as any)[offset + i] = (val as any)[i];
                for (let i = n; i < stride; i++) (buf as any)[offset + i] = 0;
            } else {
                for (let i = 0; i < stride; i++) (buf as any)[offset + i] = 0;
            }
        }
    }
}

export class Archetype {
    readonly entities: EntityId[] = [];
    readonly schema: Map<ComponentId, ComponentDef>;
    readonly storage: SoAStorage;

    constructor(public readonly mask: Mask, compSchema: Map<ComponentId, ComponentDef>) {
        this.schema = compSchema;
        this.storage = new SoAStorage(compSchema);
    }

    get size() {
        return this.entities.length;
    }

    insert(e: EntityId, values: Record<ComponentId, ComponentValue | undefined>): number {
        const row = this.entities.length;
        this.entities.push(e);
        this.storage.ensureCapacity(this.entities.length);
        this.storage.writeValues(row, values);
        return row;
    }

    moveEntityTo(e: EntityId, row: number, to: Archetype, overrides: Record<string, ComponentValue | undefined>, index: Map<EntityId, EntityRecord>) {
        const toRow = to.entities.length;
        to.entities.push(e);
        to.storage.ensureCapacity(to.entities.length);

        // Copy shared components
        for (const [id, def] of to.schema) {
            if (this.schema.has(id)) {
                to.storage.copyBlock(this.storage, row, toRow, new Map([[id, def]]));
            } else {
                const buf = to.storage.get(id);
                for (let i = 0; i < def.stride; i++) (buf as any)[toRow * def.stride + i] = 0;
            }
        }

        // Apply overrides
        to.storage.writeValues(toRow, overrides);
        index.set(e, { archetype: to, row: toRow });

        // Swap&pop from source
        const lastRow = this.entities.length - 1;
        if (row !== lastRow) {
            const movedEntity = this.entities[lastRow];
            if (movedEntity === undefined) {
                this.entities.pop();
                return;
            }
            this.entities[row] = movedEntity;
            this.storage.swapPopRow(row, lastRow);
            const movedRec = index.get(movedEntity);
            if (movedRec) movedRec.row = row;
        }
        this.entities.pop();
    }

    destroyAtRow(row: number, index: Map<EntityId, EntityRecord>) {
        const lastRow = this.entities.length - 1;
        const dead = this.entities[row];
        if (dead === undefined) {
            return;
        }

        if (row !== lastRow) {
            const movedEntity = this.entities[lastRow];
            if (movedEntity === undefined) {
                this.entities.pop();
                index.delete(dead);
                return;
            }
            this.entities[row] = movedEntity;
            this.storage.swapPopRow(row, lastRow);
            const movedRec = index.get(movedEntity);
            if (movedRec) movedRec.row = row;
        }

        this.entities.pop();
        index.delete(dead);
    }
}

/** High-performance World (100k+ entities) */
export class ArchetypeWorld {
    private nextEntity: EntityId = 1;
    private bitByComp = new Map<ComponentId, Mask>();
    private defByComp = new Map<ComponentId, ComponentDef>();
    private nextBit = 0n;

    private archetypes = new Map<Mask, Archetype>();
    private entityIndex = new Map<EntityId, EntityRecord>();

    // Query cache
    private archetypeVersion = 0;
    private queryCache = new Map<Mask, { version: number; list: Archetype[] }>();

    defineComponent(def: ComponentDef) {
        if (this.defByComp.has(def.id)) return;
        const bit = 1n << this.nextBit++;
        this.bitByComp.set(def.id, bit);
        this.defByComp.set(def.id, def);
    }

    maskOf(ids: ComponentId[]): Mask {
        let mask = 0n;
        for (const id of ids) {
            const bit = this.bitByComp.get(id);
            if (bit) mask |= bit;
        }
        return mask;
    }

    createEntity(values: Record<ComponentId, ComponentValue | undefined> = {}): EntityId {
        const e = this.nextEntity++;
        let mask = 0n;
        for (const id of Object.keys(values)) {
            const bit = this.bitByComp.get(id);
            if (bit) mask |= bit;
        }

        const arch = this.getArchetype(mask);
        const row = arch.insert(e, values);
        this.entityIndex.set(e, { archetype: arch, row });
        return e;
    }

    destroyEntity(e: EntityId) {
        const rec = this.entityIndex.get(e);
        if (!rec) return;
        rec.archetype.destroyAtRow(rec.row, this.entityIndex);
    }

    addComponent(e: EntityId, id: ComponentId, value: ComponentValue = 0) {
        const rec = this.entityIndex.get(e);
        if (!rec) return;

        const bit = this.bitByComp.get(id);
        if (!bit) return;

        const from = rec.archetype;
        const newMask = from.mask | bit;
        if (newMask === from.mask) {
            // Already has it
            const def = from.schema.get(id);
            if (def) {
                const buf = from.storage.get(id);
                if (typeof value === "number" || typeof value === "bigint") {
                    (buf as any)[rec.row * def.stride] = value as any;
                }
            }
            return;
        }

        const to = this.getArchetype(newMask);
        from.moveEntityTo(e, rec.row, to, { [id]: value }, this.entityIndex);
    }

    removeComponent(e: EntityId, id: ComponentId) {
        const rec = this.entityIndex.get(e);
        if (!rec) return;

        const bit = this.bitByComp.get(id);
        if (!bit) return;

        const from = rec.archetype;
        const newMask = from.mask & ~bit;
        if (newMask === from.mask) return; // didn't have it

        const to = this.getArchetype(newMask);
        from.moveEntityTo(e, rec.row, to, {}, this.entityIndex);
    }

    getArchetypes(): Archetype[] {
        return [...this.archetypes.values()];
    }

    queryByMask(required: Mask): Archetype[] {
        // CACHED: reuse unless archetypes changed
        const cached = this.queryCache.get(required);
        if (cached && cached.version === this.archetypeVersion) return cached.list;

        const list: Archetype[] = [];
        for (const [mask, arch] of this.archetypes) {
            if ((mask & required) === required) list.push(arch);
        }

        this.queryCache.set(required, { version: this.archetypeVersion, list });
        return list;
    }

    private getArchetype(mask: Mask): Archetype {
        let a = this.archetypes.get(mask);
        if (a) return a;

        const schema = new Map<ComponentId, ComponentDef>();
        for (const [id, bit] of this.bitByComp) {
            if ((mask & bit) !== 0n) schema.set(id, this.defByComp.get(id)!);
        }

        a = new Archetype(mask, schema);
        this.archetypes.set(mask, a);
        this.archetypeVersion++;
        return a;
    }
}

/** Command buffer for safe mutations during iteration */
export class CommandBuffer {
    private queue: Array<() => void> = [];

    constructor(private readonly world: ArchetypeWorld) { }

    destroyEntity(e: EntityId) {
        this.queue.push(() => this.world.destroyEntity(e));
    }

    addComponent(e: EntityId, id: ComponentId, value: ComponentValue) {
        this.queue.push(() => this.world.addComponent(e, id, value));
    }

    removeComponent(e: EntityId, id: ComponentId) {
        this.queue.push(() => this.world.removeComponent(e, id));
    }

    playback() {
        for (const cmd of this.queue) cmd();
        this.queue.length = 0;
    }
}
