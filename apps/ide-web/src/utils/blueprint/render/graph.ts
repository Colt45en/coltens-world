// Rendering: Render Dependency Graph (passes + resources)
export type Resource = string;
export type PassId = string;
type Edge = { from: PassId; to: PassId; reason: string };

export class RenderGraph {
  private passes = new Map<PassId, RenderPass>();
  private edges: Edge[] = [];
  private writes = new Map<Resource, PassId>();
  private reads = new Map<Resource, PassId[]>();

  addPass(id: PassId, fn: (ctx: PassContext) => void) {
    if (this.passes.has(id)) throw new Error(`Pass ${id} exists`);
    const p = new RenderPass(id);
    this.passes.set(id, p);
    fn(new PassContext(p, this));
  }

  link(from: PassId, to: PassId, reason = "dep") {
    this.edges.push({ from, to, reason });
  }

  compile(): PassId[] {
    // build implicit deps from read/write sets (simple aliasing model)
    for (const [res, writer] of this.writes) {
      const consumers = this.reads.get(res) || [];
      for (const c of consumers) {
        this.link(writer, c, `produce(${res})→consume`);
      }
    }
    // topo sort
    const indeg = new Map<PassId, number>();
    for (const id of this.passes.keys()) {
      indeg.set(id, 0);
    }
    for (const e of this.edges) {
      indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
    }
    const queue: PassId[] = [];
    for (const [id, d] of indeg) {
      if (d === 0) queue.push(id);
    }
    const order: PassId[] = [];
    while (queue.length) {
      const n = queue.shift()!;
      order.push(n);
      for (const e of this.edges.filter((x) => x.from === n)) {
        const d = (indeg.get(e.to) ?? 0) - 1;
        indeg.set(e.to, d);
        if (d === 0) queue.push(e.to);
      }
    }
    if (order.length !== this.passes.size) {
      throw new Error("Cycle in render graph");
    }
    return order;
  }

  getEdges() {
    return [...this.edges];
  }

  getPasses() {
    return Array.from(this.passes.values());
  }

  // internal
  _write(p: RenderPass, r: Resource) {
    this.writes.set(r, p.id);
  }

  _read(p: RenderPass, r: Resource) {
    this.reads.set(r, [...(this.reads.get(r) ?? []), p.id]);
  }
}

export class RenderPass {
  resources = { reads: new Set<Resource>(), writes: new Set<Resource>() };

  constructor(public id: PassId) {}

  read(res: Resource) {
    this.resources.reads.add(res);
  }

  write(res: Resource) {
    this.resources.writes.add(res);
  }
}

export class PassContext {
  constructor(
    private p: RenderPass,
    private g: RenderGraph
  ) {}

  read = (r: Resource) => {
    this.p.read(r);
    this.g._read(this.p, r);
  };

  write = (r: Resource) => {
    this.p.write(r);
    this.g._write(this.p, r);
  };

  depend = (other: PassId) => this.g.link(other, this.p.id);
}
