# 🎨 Graphics Lab Documentation

## Overview

**Graphics Lab** is a unified workbench for 3D asset creation, geometry processing, and real-time visualization.

Built with:
- **Frontend**: React + THREE.js (TypeScript)
- **Backend**: Python (`geometry_engine.py`, `graphics_generator.py`)
- **Export**: GLB/GLTF, PNG, JSON, ZIP

---

## 📂 File Structure

```
apps/ide-web/src/
├── pages/
│   ├── GraphicsMenu.tsx              # Main navigation hub
│   ├── LabGraphicsLabPage.tsx         # Unified workbench (tabbed)
│   ├── LabGraphicsGeneratorPage.tsx   # Lattice animation viewer
│   └── graphics-index.ts              # Module exports
├── ui/
│   ├── HeightfieldCodexButton.tsx     # Terrain processor component
│   └── SpinCaptureCodexButton.tsx     # 360° spin capture component
└── routes/
    └── graphics-routes.tsx             # Route configuration

python/
├── geometry_engine.py                 # Core geometry API (Vector3, Ray, Triangle, Plane)
└── graphics_generator.py              # Real-time lattice animation
```

---

## 🚀 Quick Start

### 1. **Navigate to Graphics Platform**

Go to `/graphics` to see the main menu with quick-access cards:

```
⛰️ Heightfield Processor  →  Convert terrain images to GLB
🔄 Spin Capture           →  Generate 360° spin frames
🎨 Graphics Lab           →  Full workbench
```

### 2. **Open Graphics Lab**

Visit `/lab/graphics-lab` for the tabbed workbench:

- **Heightfield** — DEM/terrain → GLB with normals
- **Spin Capture** — Models → 360° frames + SVG outline
- **Mesh Viewer** — Inspect loaded meshes
- **Raycast Tool** — Query geometry (ray-triangle, collision)
- **Metrics** — Performance stats

### 3. **Use Backend APIs**

```python
# python/geometry_engine.py
from geometry_engine import GeometryEngine, Vector3, Ray

eng = GeometryEngine()
tri = eng.add_triangle(Vector3(0,0,0), Vector3(5,0,0), Vector3(0,0,5))
ray = eng.create_ray(Vector3(1,10,1), Vector3(0,-1,0))
hits = eng.raycast(ray)  # Returns sorted [RayHit, ...]
```

---

## 🧰 Component Reference

### **HeightfieldCodexButton**

Converts heightmaps (PNG/JPG/EXR) → terrain GLB meshes.

**Props:**
```tsx
interface HeightfieldCodexButtonProps {
  onMeshCreated?: (mesh: THREE.Mesh) => void;
}
```

**UI Controls:**
- Grid Size: 64–2048px (geometry resolution)
- Height Scale: 0.1–10 (vertical exaggeration)
- Smooth (Taubin): 0–20 iterations
- Thumbnail px: 256–1024
- Toggles: Flip Y, Invert, Auto-Normalize, Vertex Colors

**Export Output:**
```
{name}-hf-{timestamp}.zip
├── {name}.glb
├── {name}.png (thumbnail)
└── {name}.manifest.json
```

**Features:**
- ✅ 16-bit EXR support (native precision)
- ✅ Central-difference normals (crisp lighting)
- ✅ Taubin λ/μ smoothing (no shrinkage)
- ✅ Per-vertex colors (elevation gradient)
- ✅ ACES tone mapping (thumbnail)

---

### **SpinCaptureCodexButton**

Generates 360° spin frames + SVG outline from GLB/GLTF models.

**Props:**
```tsx
interface SpinCaptureCodexButtonProps {
  onMeshCreated?: (mesh: THREE.Mesh) => void;
}
```

**UI Controls:**
- Edge Angle: 5–60° (outline crease detection)
- SVG Size: 256–1024px (outline resolution)
- PNG Size: 256–2048px (frame resolution)
- Spin Speed: 10–180 deg/sec
- Step: 1–10° (frame interval; auto-computes total frames)
- Toggles: Transparency, Preserve Rig/Materials

**Export Output:**
```
model-spin-{timestamp}.zip
├── frames/
│   ├── model_frame_001.png
│   ├── model_frame_002.png
│   └── ...
├── model.png (thumbnail)
├── model_outline.svg
└── model.manifest.json
```

**Features:**
- ✅ Camera framing (pure function, no window hacks)
- ✅ Occlusion-aware outline (back-face culling)
- ✅ Deterministic frame naming (frame_001, frame_002)
- ✅ Transparent background option
- ✅ Preserve rig/materials toggle
- ✅ GPU disposal (no VRAM leaks on batch runs)

---

### **geometry_engine.py**

Core 3D geometry library with deterministic, robust operations.

**Key Classes:**
- `Vector3` — Immutable 3D vectors (dot, cross, normalize)
- `Ray` — Ray with unit direction (point_at, intersect_*)
- `Triangle` — Triangle mesh primitives (normal, area, centroid)
- `Plane` — Plane with unit normal (distance_to_point, project_point)
- `GeometryEngine` — Registry for triangles/planes/rays

**Key Methods:**
```python
# Ray intersections (Möller–Trumbore for triangles)
ray.intersect_plane(plane) → (point, t) or None
ray.intersect_triangle(tri) → (point, t) or None
ray.intersect_ground() → (point, t) or None

# Collision detection
eng.sphere_sphere_collision(c1, r1, c2, r2) → bool
eng.resolve_sphere_collision(pos1, r1, pos2, r2) → Vector3
eng.resolve_sphere_sphere(pos1, r1, pos2, r2, split=0.5) → (Vector3, Vector3)

# Geometry queries
eng.raycast(ray, include_ground=True, ...) → [RayHit, ...]  # sorted by t
eng.point_in_triangle_2d(point, tri) → bool
eng.calculate_surface_area() → float

# Metrics
eng.update(dt) → frame_metrics (resets frame counters)
eng.get_geometry_stats() → stats_dict
```

**Hotspot Fixes:**
- ✅ Degenerate triangle guards (XZ projection, ray-tri)
- ✅ Centralized epsilon (EPS = 1e-9)
- ✅ Normalized rays/planes (direction_unit, normal_unit cached)
- ✅ Ray-triangle intersection (Möller–Trumbore)
- ✅ Dual collision resolution (single-body or split)
- ✅ Sane frame/total metrics (reset each update())

---

### **graphics_generator.py**

Real-time graphics engine for lattice animation + dual camera projection.

**Key Classes:**
- `Vector3` — 3D vectors
- `QuaternionCamera` — 3D perspective camera (position, rotation, FOV)
- `Viewport` — 2D + 3D projection methods
- `GraphicsScene` — Stateful registry (nodes, edges, limbs)

**Dual Projection Output:**

Each snapshot includes both legacy and new 3D fields:
```python
{
  "nodes": [{
    "screen": (sx_2d, sy_2d),           # Legacy 2D
    "screen_cam3d": (sx_3d, sy_3d),     # New 3D
    "depth_cam3d": depth_ndc             # New depth
  }, ...],
  "camera": {
    "fov_y_degrees": 60.0,
    "z_near": 0.1,
    "z_far": 5000.0
  }
}
```

**Correctness Fixes:**
- ✅ Fixed matrix composition order (T_screen * S * R * T_center)
- ✅ Real perspective projection matrix
- ✅ NDC → pixel mapping (y-flip, aspect ratio)
- ✅ Perspective divide guards (anti divide-by-zero)

---

## 🎯 Usage Patterns

### Pattern 1: Generate Terrain from DEM

```tsx
// In LabGraphicsLabPage
<HeightfieldCodexButton onMeshCreated={(mesh) => {
  // mesh is ready for export or inspection
  setMeshes(prev => [...prev, { name: mesh.name, mesh, timestamp: Date.now() }]);
}} />
```

### Pattern 2: Capture Avatar Spins

```tsx
// In LabGraphicsLabPage
<SpinCaptureCodexButton onMeshCreated={(mesh) => {
  // mesh.name contains the model name
  // ZIP was already downloaded
}} />
```

### Pattern 3: Raycast Terrain

```python
# Backend: python/geometry_engine.py
eng = GeometryEngine()

# Load terrain mesh
for tri_data in terrain_triangles:
    eng.add_triangle(*tri_data)

# Cast ray downward
ray = eng.create_ray(Vector3(100, 500, 100), Vector3(0, -1, 0))
hits = eng.raycast(ray)  # Returns nearest hit first (sorted)

if hits:
    hit = hits[0]
    print(f"Hit at {hit.point} distance {hit.t}")
```

### Pattern 4: Collision Resolution

```python
# Check if two spheres collide
if eng.sphere_sphere_collision(pos1, r1, pos2, r2):
    # Split correction 50/50
    pos1_new, pos2_new = eng.resolve_sphere_sphere(pos1, r1, pos2, r2, split=0.5)
```

---

## 📊 Metrics & Performance

### Frame Metrics (reset each update())

```python
frame_metrics = eng.update(dt=0.016)
print(frame_metrics)
# {
#   "triangles_added": 0,
#   "planes_added": 0,
#   "rays_created": 1,
#   "intersections": 2,
#   "transforms_applied": 0,
#   "dt": 0.016,
#   "total_triangles": 1024,
#   "total_planes": 1,
#   "total_rays": 1,
#   "surface_area": 250.5
# }
```

### Total Stats (cumulative)

```python
stats = eng.get_geometry_stats()
print(stats)
# {
#   "triangles": 1024,
#   "planes": 1,
#   "rays": 1,
#   "total_surface_area": 250.5,
#   "total_metrics": { "triangles_added": 1024, ... }
# }
```

---

## 🔌 Integration Guide

### Step 1: Add Routes

```tsx
// apps/ide-web/src/App.tsx
import { graphicsRoutes } from "@/routes/graphics-routes";

function App() {
  const router = createBrowserRouter([
    { path: "/", element: <Home /> },
    { path: "/dashboard", element: <Dashboard /> },
    ...graphicsRoutes,  // ← Add here
  ]);
  return <RouterProvider router={router} />;
}
```

### Step 2: Add Navigation

```tsx
// apps/ide-web/src/components/Sidebar.tsx
import { graphicsNavigation } from "@/routes/graphics-routes";

export function Sidebar() {
  return (
    <nav>
      {graphicsNavigation.map(item => (
        <Link key={item.path} to={item.path}>
          {item.icon} {item.label}
        </Link>
      ))}
    </nav>
  );
}
```

### Step 3: Backend Connection (WebSocket)

```python
# Backend (e.g., FastAPI or Flask)
from python.graphics_generator import GraphicsScene, SceneConfig

scene = GraphicsScene(SceneConfig())

@app.websocket("/ws/graphics")
async def websocket_graphics(websocket):
    while True:
        scene.step()
        snap = scene.snapshot()
        await websocket.send_json(snap)
        await asyncio.sleep(1/60)  # 60 FPS
```

---

## 🧪 Testing

### Run geometry_engine.py in standalone mode

```bash
cd python
python geometry_engine.py
```

**Output:**
```
=== Geometry Engine Demo ===
Triangle: area=12.50, normal=Vector3(...)
Plane added at Vector3(2.0, 0.0, 0.0)...

--- Raycast Test ---
Ray from Vector3(1.0, 10.0, 1.0) in direction Vector3(0.0, -1.0, 0.0)
Hits (2 total, sorted by t):
  ('ground', (1.0, 0.0, 1.0), 10.0)
  ('plane_0', (2.0, 0.0, 1.0), 8.0)
...
```

---

## 📚 API Reference

See [python/geometry_engine.py](../python/geometry_engine.py) for full docstrings.

Key invariants:
- ✅ **Immutable**: Vector3, Triangle, Plane, Ray are frozen dataclasses
- ✅ **Deterministic**: All queries sorted by (t, kind); no randomness
- ✅ **Robust**: All edge cases guarded (divide-by-zero, degeneracies, NaN)
- ✅ **Efficient**: Cached normalized vectors; O(1) sphere tests; O(n) raycasts

---

## 🎓 Next Steps

1. **Terrain Rendering** — Add heightfield BVH for O(log n) raycast
2. **Physics Integration** — Wire sphere resolution into game loop
3. **Batch Processing** — Generate terrain tiles + atlas textures
4. **Advanced Picking** — Screen-space ray from mouse to 3D coordinates
5. **VR Support** — Dual-camera frustum for stereo rendering

---

## 📝 License

Part of the **Coltens World** project.

---

## 🤝 Contributing

File structure:
```
graphics/
├── UI Components (React + THREE.js)
├── Backend (Python geometry + graphics)
└── Routing (react-router-dom)
```

When adding new features:
- Add UI component to `apps/ide-web/src/ui/`
- Add backend logic to `python/`
- Update routes in `apps/ide-web/src/routes/graphics-routes.tsx`
- Document in this README
