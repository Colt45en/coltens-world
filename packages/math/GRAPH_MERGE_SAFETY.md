# Graph Module Merge Safety Analysis

TypeScript ↔ Python graph utilities: **SAFE vs DANGER** semantic merging guide.

---

## Executive Summary

✅ **Most functions are SAFE to merge** (pure geometry, statistics)

⚠️ **Two critical hotspots MUST be called out:**

1. **Radial graph semantics** — Python vs TS have different hub definitions
2. **Adjacency API contract** — Map vs Array is a breaking change

---

## ✅ SAFE MERGES (with strict conditions)

### 1) **Pure Geometry Utilities** — SAFE ✅

Functions:
- `distance(p1, p2)` → float
- `geometric_sequence(a, r, n)` → array
- `fibonacci_spiral(n, scale)` → radial points

**Safe merge condition:** All parties must agree on:

```typescript
// Coordinate system
- x-axis: left-to-right ✓
- y-axis: top-to-bottom (TS) vs bottom-to-top (math convention)  ⚠️
- units: consistent (e.g., all "degrees", not mixed deg/rad)

// Distance metric
- Euclidean: √(Δx² + Δy²)  ✓ (default, safe)
- Manhattan: |Δx| + |Δy|   (acceptable if explicit)
- Other: MUST be explicitly named and documented
```

**If Python uses math convention (y-up) and TS uses screen convention (y-down):**
→ Invert y-coordinates at boundary, or standardize to one convention.

---

### 2) **Edge Canonicalization + Deduplication** — SAFE ✅

Functions:
- `edge_key(u, v)` → canonical string key
- `build_edges_from_pairs(vertices, connectivity)` → deduplicated edges
- `ensure_undirected(edges)` → enforce (u < v) invariant

**Safe merge condition:** All parties must agree on:

```typescript
✓ Edges are UNDIRECTED
  → (u, v, w) and (v, u, w) are the SAME edge, store only once

✓ Canonical form: u = min(u, v), v = max(u, v)
  → Every edge is stored in exactly one direction

✓ Weight symmetry: w(u, v) == w(v, u)
  → Distance is symmetric (Euclidean, Manhattan, etc.)
  → No "direction cost" (e.g., climbing vs descending)
```

**DANGER if:**
- Python uses directed edges (u → v) but TS treats undirected
- Weights are asymmetric (e.g., uphill vs downhill cost)
- Both (u,v) and (v,u) are stored separately (wastes memory, breaks dedup)

**Minimal check:**
```python
# Python side
for u, v, w in edges:
    assert u < v, f"Edge not canonical: {u}, {v}"
    assert isinstance(w, (int, float)), f"Weight must be numeric"
```

---

### 3) **Graph Statistics** — SAFE ✅

Functions:
- `analyze_graph(edges, n_nodes)` → degree_table, connected components, etc.
- `degree_table(edges)` → {node: degree}
- `graph_density(edges, n_nodes)` → float

**Safe merge condition:** Graph is treated as **undirected with unique edges**:

```typescript
// Correct stats formulas (undirected unique edges)
m = edges.length              // number of unique edges
density = 2 * m / (n * (n-1)) // for undirected

degree[u] = # edges incident to u
sum(degree) = 2 * m           // each edge counted twice
```

**DANGER if:**
- Python counts directed edges → `m = edges.length` (no ÷2)
- TS counts undirected edges → stats differ by 2x
- One module stores both (u,v) and (v,u), other stores once

**Test before merge:**
```python
# Both should produce same result:
python_density = analyzer.graph_density(edges, n)
ts_density = TsGraphAnalyzer.graphDensity(edges, n)
assert abs(python_density - ts_density) < 1e-9
```

---

### 4) **Grid Graph Builder** — SAFE ✅ (usually)

Function:
- `build_grid_graph(rows, cols, diagonal=false)` → edges on rectangular grid

**Safe merge condition:** Both agree on:

```typescript
// Indexing order (must be consistent)
Row-major:  node = row * cols + col     ✓ (standard)
Col-major:  node = col * rows + row     ⚠️ (rare, must be explicit)

// Neighbor connectivity
4-neighborhood: up, down, left, right      ✓ (default)
8-neighborhood: add diagonals              ⚠️ (if enabled, both must enable)

// Edge weights (for grids, usually uniform = 1.0)
Uniform:    w = 1.0  ✓
Diagonal:   w = √2   (if 8-neighborhood)
```

**DANGER if:**
- Python uses row-major, TS uses col-major → node indices mismatch
- One calculates 4-neighborhood, other does 8-neighborhood → different connectivity

**Test:**
```python
py_edges = build_grid_graph_python(3, 3)
ts_edges = BuildGridGraph.buildGridGraph(3, 3)

# Same edges? (order doesn't matter, but connectivity must match)
assert set(normalize_edges(py_edges)) == set(normalize_edges(ts_edges))
```

---

## ⚠️ TWO CRITICAL HOTSPOTS (DANGER if not aligned)

### Hotspot A: **Radial Graph Hub Semantics** 🚨

Your modules use **different hub definitions**:

#### Python Version
```python
# Ring 0: single node at center (true hub)
ring_0 = [(cx, cy)]  # 1 node

# Ring k: `base * k` nodes on circle, connected to:
#   - Hub (ring 0)
#   - Previous ring (ring k-1)

# Example: base=3, rings=3
Ring 0: [center]                    # 1 node → node 0
Ring 1: 3 nodes on circle           # nodes 1,2,3
Ring 2: 6 nodes on circle           # nodes 4,5,6,7,8,9
Ring 3: 9 nodes on circle           # nodes 10..18

Edges: hub(0) ↔ each ring, ring k ↔ ring k+1
```

#### TypeScript Version (Original)
```typescript
// Ring 0: `base * (0+1) = base` nodes on circle (NOT a single hub)
ring_0 = base * (0 + 1) nodes       // `base` nodes, not 1!

// "Hub": pick an arbitrary node on ring 0 as a reference
// Problem: this is NOT a structural hub, just a label

// Example: base=3, rings=3
Ring 0: 3 nodes on circle              # nodes 0,1,2
Ring 1: 3 nodes on circle              # nodes 3,4,5
Ring 2: 6 nodes on circle              # nodes 6,7,8,9,10,11
Ring 3: 9 nodes on circle              # nodes 12..20

// "Hub" selected as node 0, but structurally it's just a ring node
```

#### 🚨 **This is a SEMANTIC MISMATCH, not a style issue:**

| Property | Python | TypeScript | Status |
|----------|--------|-----------|--------|
| Ring 0 node count | 1 | `base` | ❌ DIFFERENT |
| Hub degree | connects to all rings | equal to other ring-0 nodes | ❌ DIFFERENT |
| Total nodes | `1 + sum(base*k)` | `sum(base*k)` | ❌ DIFFERENT |
| Graph structure | Star-like | Concentric circles | ❌ DIFFERENT |

#### ✅ To make them **structurally isomorphic**, choose one:

**Option A: Make TS match Python (true hub)**
```typescript
function buildRadialGraph(base: number, rings: number): GraphEdges {
  const edges: GraphEdges = [];
  const nodes: V2[] = [];

  // Ring 0: single node at center (true hub)
  const hubIndex = 0;
  nodes.push([0, 0]);  // (cx, cy)

  // Ring k: base * k nodes on circle
  let nodeIndex = 1;
  for (let ring = 1; ring <= rings; ring++) {
    const numNodesInRing = base * ring;
    const radius = ring;

    for (let i = 0; i < numNodesInRing; i++) {
      const angle = (i / numNodesInRing) * 2 * Math.PI;
      nodes.push([
        radius * Math.cos(angle),
        radius * Math.sin(angle),
      ]);

      // Connect to hub
      edges.push([hubIndex, nodeIndex, distance(nodes[hubIndex], nodes[nodeIndex])]);

      // Connect to previous ring (if ring > 1)
      if (ring > 1) {
        const prevRingStart = 1 + sum(base * (1..ring-1));  // start node of ring k-1
        const prevNodeInRing = i % (base * (ring - 1));
        edges.push([prevRingStart + prevNodeInRing, nodeIndex, ...]);
      }

      nodeIndex++;
    }
  }

  return edges;
}
```

**Option B: Rename TS, don't claim it's "radial"**
```typescript
// Call it "concentric_circles_graph" instead of "radial_graph"
// and document: "Ring 0 is the first circle, not a central hub"
// This avoids confusion and lets both versions coexist
```

---

### Hotspot B: **Adjacency Data Structure API Contract** 🚨

Switching representation **breaks the API contract** for callers:

#### Legacy TS (Map-based)
```typescript
type Adjacency = Map<number, Array<[number, number]>>;  // node → [(neighbor, weight), ...]

function buildAdjacency(edges: GraphEdges): Adjacency {
  const adj = new Map<number, Array<[number, number]>>();
  for (const [u, v, w] of edges) {
    if (!adj.has(u)) adj.set(u, []);
    adj.get(u)!.push([v, w]);
  }
  return adj;
}

// Caller code (common pattern):
const neighbors = adj.get(u) ?? [];  // clients expect this API
```

#### Hardened TS (Array-based, immutable)
```typescript
type AdjacencyArray = readonly (readonly [v: number, w: number][])[];
// adj[u] = [(neighbor, weight), ...]

function buildAdjacencyArray(edges: GraphEdges): AdjacencyArray {
  const adj: Array<Array<[number, number]>> = [];
  // ...
  return adj as AdjacencyArray;
}

// Caller code BREAKS:
const neighbors = adj.get(u);  // ❌ adj is array, not Map!
// Should be:
const neighbors = adj[u] ?? [];  // ✓ array access
```

#### ✅ To make this a **SAFE MERGE**, keep both:

```typescript
// Legacy (keep for backward compatibility)
export function buildAdjacency(edges: GraphEdges): Map<number, Array<[number, number]>> {
  const adj = new Map();
  for (const [u, v, w] of edges) {
    if (!adj.has(u)) adj.set(u, []);
    adj.get(u)!.push([v, w]);
  }
  return adj;
}

// Hardened (new, immutable)
export function buildAdjacencyArray(edges: GraphEdges): AdjacencyArray {
  const maxNode = Math.max(...edges.flatMap(([u, v]) => [u, v]));
  const adj: Array<Array<[number, number]>> = Array(maxNode + 1)
    .fill(null)
    .map(() => []);

  for (const [u, v, w] of edges) {
    adj[u].push([v, w]);
  }

  return adj as AdjacencyArray;
}

// Usage: clients can choose
const adjMap = buildAdjacency(edges);        // Old: Map-based
const adjArray = buildAdjacencyArray(edges); // New: Array-based
```

**Version internally by function signature, not by breaking the old one:**

```typescript
// Shortest path can optionally use the new array version internally
// but keep the old signature
function shortestPath(
  adj: Adjacency,  // still Map
  start: number,
  end: number
): number[] {
  // Internally convert if needed, or use the Map API
  // Don't break callers
}
```

---

## ✅ Safe Merge Checklist

Before claiming a function is **SAFE MERGE**, verify:

### Edge Invariants
- [ ] **Canonical form:** For all edges (u, v, w): `u < v`
- [ ] **No self-loops:** For all edges: `u ≠ v`
- [ ] **Non-negative weights:** For all edges: `w ≥ 0` and `isFinite(w)`
- [ ] **No duplicates:** Only one (u, v) pair per unique pair

### Weight Symmetry (if undirected)
- [ ] **Metric is symmetric:** `distance(u, v) == distance(v, u)`
- [ ] **No directed cost:** cost doesn't change by traversal direction (e.g., no "uphill" cost)
- [ ] **Python and TS use same metric:** both Euclidean, or both Manhattan, etc.

### Graph Indexing
- [ ] **Deterministic node order:** node indices are stable and reproducible
- [ ] **No gaps:** nodes are 0..n-1 (or 1..n, but consistent)
- [ ] **Row/col order matches:** if using 2D indexing (grid), both use same convention

### Radial Graph (if applicable)
- [ ] **Hub semantics agree:** Python has 1-node center vs TS has circle is explicit
- [ ] **Ring size formula matches:** both use `base * ring_number` (or both use alternative)
- [ ] **Node count is same:** total node count matches between Python and TS

### Adjacency Contract
- [ ] **API is not swapped:** if changing Map → Array, provide BOTH exports
- [ ] **Callers can upgrade incrementally:** old API still works during transition
- [ ] **Default behavior unchanged:** existing code runs without modification

### Test Coverage
- [ ] **Cross-language round-trip:** Python graph → JSON → TS → JSON → Python ✓ identical
- [ ] **Statistical properties:** density, degree distribution, connected components match
- [ ] **Performance:** Array version is actually faster (verify benchmarks)

---

## Minimal Patch Strategy

### For Radial Hub
**If you want Python-compatible:**
```diff
- const numNodesInRing0 = base * (0 + 1);  // base nodes on circle
+ const ring0 = [[0, 0]];                   // 1 node at center (true hub)
```

### For Adjacency Contract
**If you want to harden without breaking:**
```diff
+ export function buildAdjacencyArray(edges) { ... }  // NEW, parallel export
  export function buildAdjacency(edges) { ... }        // KEEP, let it be

  export function shortestPath(adj, start, end) {
-   // Changed to use only Array API (breaks callers)
+   // Still uses Map API (backward compatible)
  }
```

---

## Questions Before Merge

Before you finalize the merge, confirm:

1. **Radial graph:** Do you want Python-compatible (1-node hub) or keep TS as-is (circle ring-0)?
   - If Python-compatible: need to update TS ring-0 logic
   - If keeping TS: rename to avoid confusion with "radial"

2. **Adjacency:** Do you need a hardened array version?
   - If yes: export both (`buildAdjacency` + `buildAdjacencyArray`)
   - If no: keep Map, don't force breaking changes

3. **Coordinate system:** Python uses math convention (y-up) or screen convention (y-down)?
   - If different: standardize at module boundary or document clearly

4. **Edge test:** Can you run round-trip tests to verify Python ↔ TS equivalence?

---

**Once you confirm the radial semantics and adjacency strategy, I can provide the exact minimal patch that makes TS and Python fully isomorphic.** ✅
