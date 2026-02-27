# TSL Compute Pattern — Quick Reference

**For**: Developers extending or debugging NexusSwarmSystem GPU logic

---

## Core Pattern

```ts
import { Fn, If, Loop, vec3, int, uint, instanceIndex, atomicAdd, storage } from "three/tsl";

// 1. Define compute function
const myCompute = Fn(() => {
  const idx = instanceIndex; // thread index (0..count-1)

  // Load from storage buffer
  const data = myStorageBuffer.element(idx);

  // Compute
  const result = data.add(1);

  // Store back
  myStorageBuffer.element(idx).assign(result);
})
  .compute(
    count,        // dispatch this many threads
    [256]         // workgroup size = 256 threads
  );

// 2. Execute
renderer.compute(
  [myCompute],  // array of compute nodes
  null,         // target (usually null for storage)
  { dt: 0.016 } // uniforms dict
);
```

---

## Storage Buffers

### Allocate

```ts
const posAttr = new THREE.StorageBufferAttribute(count, 4, Float32Array);
//                                                 count  vec4 type
const posNode = storage(posAttr, "vec4", count);
```

### Access

```ts
// Load element i
const pos = posNode.element(i);       // TSL Node<vec4>
const x = pos.x;                      // TSL Node<float>

// Store element i
posNode.element(i).assign(newValue);  // assigns newValue → element i
```

### Types

```ts
// Numeric
storage(attr, "float", count);  // 1 float per element
storage(attr, "vec3", count);   // 3 floats per element
storage(attr, "vec4", count);   // 4 floats per element
storage(attr, "uint", count);   // 1 uint per element

// Struct (atomic example)
const AtomicCount = struct(
  { count: { type: "uint", atomic: true } },
  "AtomicCount"
);
storage(attr, AtomicCount, count);

// Access struct member
const cell = gridCounts.element(i);
const countPtr = cell.get("count");  // access .count field
```

---

## Compute Control Flow

### Instance Index

```ts
const idx = instanceIndex;  // 0 to dispatchCount-1
```

### Conditionals

```ts
If(condition, () => {
  // true branch
});

If(condition, () => {
  // true branch
}, () => {
  // false branch (optional else)
});
```

Example:
```ts
If(distance.lessThan(radius), () => {
  velocity.addAssign(repulsion);
});
```

### Loops

```ts
Loop(
  {
    start: int(0),
    end: int(100),
    type: "int",
    condition: "<",
    name: "i"  // variable name
  },
  ({ i }) => {
    // loop body (executed i from 0 to 99)
    const element = storage.element(i);
  }
);
```

Nested loops:
```ts
Loop({ start: int(-1), end: int(2), type: "int", condition: "<", name: "dx" }, ({ dx }) => {
  Loop({ start: int(-1), end: int(2), type: "int", condition: "<", name: "dy" }, ({ dy }) => {
    // nested
  });
});
```

---

## Math Operations

### Vector

```ts
const a = vec3(1, 2, 3);
const b = vec3(4, 5, 6);

a.add(b);        // element-wise add
a.sub(b);        // subtract
a.mul(b);        // multiply
a.div(b);        // divide

a.addAssign(b);  // a += b (modifies a)
a.mulAssign(2);  // a *= 2

length(a);       // ||a||
normalize(a);    // a / ||a||
a.dot(b);        // dot product
```

### Scalar

```ts
const x = float(3.14);
const y = float(2.0);

x.add(y);
x.lessThan(y);      // x < y (returns bool)
x.greaterThan(y);   // x > y
x.equal(y);         // x == y

clamp(x, min, max); // clamp(x, 0, 1)
min(x, y);          // min(x, y)
floor(x);           // floor(x)
```

### Boolean Logic

```ts
const a = condition1;
const b = condition2;

a.and(b);  // a && b
a.or(b);   // a || b
a.not();   // !a
```

---

## Atomic Operations

### Three TSL atomics

```ts
atomicAdd(ptr, value);       // old_value = atomic_add_and_return_old(ptr, value)
atomicStore(ptr, value);     // *ptr = value
atomicLoad(ptr);             // return *ptr
```

Example (grid counting):
```ts
const cell = gridCounts.element(cellIdx);
const countPtr = cell.get("count");

// Each thread gets unique slot
const slot = atomicAdd(countPtr, uint(1));  // old count before increment
// slot ranges 0..capacity-1 if no overflow
```

### Memory Barrier

```ts
storageBarrier();  // GPU barrier: wait for all storage writes to be visible
```

**Use after atomic operations** when next pass needs the updated data.

---

## Uniforms (Read-Only)

### Define

```ts
const uMaxSpeed = uniform(14.0);
const uWorldMin = uniform(new THREE.Vector3(-80, -80, -80));
```

### Update (from CPU)

```ts
// In step() method:
(this.uMaxSpeed as any).value = newMaxSpeed;
```

### Use in shader

```ts
If(speed.greaterThan(this.uMaxSpeed), () => {
  velocity.assign(normalize(velocity).mul(this.uMaxSpeed));
});
```

---

## Storage → Render Attribute

### Bind to PointsNodeMaterial

```ts
const posNode = storage(posAttr, "vec4", agentCount);

const mat = new THREE.PointsNodeMaterial();
mat.positionNode = posNode.toAttribute().xyz;  // .xyz extracts first 3 components
```

This makes the storage buffer directly render-readable (no copy).

---

## Common Patterns

### Pattern: Accumulate + Average

```ts
const sum = vec3(0);
const count = float(0);

Loop({ ... }, ({ i }) => {
  const val = storage.element(i).xyz;
  sum.addAssign(val);
  count.addAssign(1);
});

const average = sum.div(count);
```

### Pattern: Clamp Speed

```ts
const speed = length(velocity);

If(speed.greaterThan(maxSpeed), () => {
  velocity.assign(
    normalize(velocity).mul(maxSpeed)
  );
});
```

### Pattern: Boundary Wrap

```ts
If(position.x.lessThan(minX), () => {
  position.x.assign(maxX);
});

If(position.x.greaterThan(maxX), () => {
  position.x.assign(minX);
});
```

### Pattern: Neighbor Grid Query

```ts
const cellIdx = computeCellCoord(position);

// Iterate 3×3×3 neighbor cells
Loop({ start: int(-1), end: int(2), type: "int", condition: "<", name: "dx" }, ({ dx }) => {
  const nCellIdx = cellIdx.add(dx);

  const count = atomicLoad(gridCounts.element(nCellIdx).get("count"));

  Loop({ start: int(0), end: int(count), type: "int", condition: "<", name: "s" }, ({ s }) => {
    const otherIdx = gridAgents.element(nCellIdx.mul(capacity).add(s));
    // process otherIdx
  });
});
```

---

## Debugging

### Print to Console (Not Possible)

Compute shaders can't print during execution. Instead:

**Option 1: Read back to CPU**
```ts
const positions = posAttr.array as Float32Array;
console.log(`Agent 0: (${positions[0]}, ${positions[1]}, ${positions[2]})`);
```

**Option 2: Visual inspection**
```ts
// Render grid debug (see WEBGPU_NEXUS_INTEGRATION.md)
```

**Option 3: Performance profiling**
```ts
// Chrome DevTools → Performance tab
// Record frame, look for GPU task duration
```

---

## Performance Tips

| Tip | Rationale |
|-----|-----------|
| **Use `[256]` workgroup size** | Optimal for most GPUs |
| **Minimize branching** | GPU likes straight-line code |
| **Cache common calculations** | `length(v)` is expensive, compute once |
| **Use `int` for loop counters** | Not `float` |
| **Batch atomics** | Fewer atomic ops = faster convergence |
| **Call `storageBarrier()` only between passes** | Avoid excessive sync |

---

## Error Patterns

| Error | Cause | Fix |
|-------|-------|-----|
| `TypeError: idx.add is not a function` | Using JS number instead of TSL Node | Use `int(5)` not `5` |
| `WebGPUValidationError: Storage buffer out of bounds` | Element index ≥ buffer size | Clamp: `clamp(idx, 0, size-1)` |
| `no texture view from storage texture` | Atomic on non-atomic buffer | Use `struct({ count: { atomic: true } })` |
| Render shows old positions | Forget `.toAttribute()` assignment | `mat.positionNode = node.toAttribute().xyz` |
| Grid overflow (agents drop) | Allocate `<cellCapacity` agents per cell | Increase `cellCapacity` |

---

## References

- [TSL Docs](https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language-(TSL))
- [StorageBufferAttribute](https://threejs.org/docs/pages/StorageBufferAttribute.html)
- [NexusSwarmSystem.ts](packages/graphics/src/nexus/NexusSwarmSystem.ts) — Full working example

---

**Use this as copypaste reference when building GPU behaviors.**
