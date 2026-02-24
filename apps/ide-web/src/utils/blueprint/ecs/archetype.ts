// Runtime Data: ECS (Archetype) → cache-coherent SoA
export type ComponentSchema = Record<string, number>; // name -> size (floats) for SoA packing
export type Entity = number;
type CompId = string;
type Mask = number; // simple bitmask for demo

export class World {
  private nextEntity: Entity = 1;
  private compBits = new Map<CompId, number>();
  private nextBit = 0;
  private archetypes = new Map<Mask, Archetype>();

  defineComponent(id: CompId) {
    if (this.compBits.has(id)) return;
    this.compBits.set(id, 1 << this.nextBit++);
  }

  createEntity(components: Record<CompId, unknown> = {}): Entity {
    const e = this.nextEntity++;
    let mask = 0;
    for (const k of Object.keys(components)) {
      const bit = this.compBits.get(k);
      if (bit) mask |= bit;
    }
    const arch = this.getArchetype(mask);
    arch.insert(e, components);
    return e;
  }

  query(has: CompId[]) {
    let mask = 0;
    for (const k of has) mask |= this.compBits.get(k) ?? 0;
    const matches: Archetype[] = [];
    for (const [m, a] of this.archetypes) {
      if ((m & mask) === mask) matches.push(a);
    }
    return matches;
  }

  moveTo(e: Entity, from: Archetype, toMask: Mask, initial?: Record<CompId, unknown>) {
    const to = this.getArchetype(toMask);
    from.moveEntityTo(e, to, initial);
  }

  maskOf(keys: CompId[]) {
    return keys.reduce((m, k) => m | (this.compBits.get(k) ?? 0), 0);
  }

  private getArchetype(mask: Mask) {
    let a = this.archetypes.get(mask);
    if (!a) {
      a = new Archetype(mask);
      this.archetypes.set(mask, a);
    }
    return a;
  }

  getArchetypes() {
    return Array.from(this.archetypes.values());
  }

  getEntityCount() {
    return this.nextEntity - 1;
  }
}

class SoA<T = unknown> {
  map = new Map<string, Float64Array>();

  addField(name: string, initialSize = 64) {
    if (!this.map.has(name)) {
      this.map.set(name, new Float64Array(initialSize));
    }
  }

  ensureCapacity(n: number) {
    for (const [k, arr] of this.map) {
      if (n > arr.length) {
        const next = new Float64Array(Math.max(arr.length * 2, n));
        next.set(arr);
        this.map.set(k, next);
      }
    }
  }
}

export class Archetype {
  readonly entities: Entity[] = [];
  readonly comps = new Map<string, any[]>();

  constructor(public readonly mask: Mask) {}

  insert(e: Entity, values: Record<string, any>) {
    const i = this.entities.length;
    this.entities.push(e);
    for (const [k, v] of Object.entries(values)) {
      let store = this.comps.get(k);
      if (!store) {
        store = [];
        this.comps.set(k, store);
      }
      store[i] = v;
    }
  }

  moveEntityTo(e: Entity, to: Archetype, initial?: Record<string, any>) {
    const i = this.entities.indexOf(e);
    if (i < 0) return;
    const vals: Record<string, any> = initial ? { ...initial } : {};
    for (const [k, store] of this.comps) {
      vals[k] = store[i];
    }
    to.insert(e, vals);
    // remove compact
    const last = this.entities.length - 1;
    const lastE = this.entities[last];
    if (lastE === undefined) return;
    this.entities[i] = lastE;
    this.entities.pop();
    for (const [k, store] of this.comps) {
      store[i] = store[last];
      store.length = last;
    }
  }

  getComponentNames() {
    return Array.from(this.comps.keys());
  }
}
