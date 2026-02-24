# 🔧 Calculus Engine v2 - Production Usage Examples

Comprehensive examples for terrain analysis, physics simulation, optimization, and more.

---

## 🌍 Terrain Analysis Pipeline

### Basic Heightmap Analysis

```python
from terrain_field_calculus import TerrainFieldCalculus
import json

# Load heightmap from Noise3D export
heightmap = [[...]]  # Your 2D height data
field = TerrainFieldCalculus.from_heightmap(
    heightmap,
    cell_size=1.0,
    compute_curvature=True,
    ridge_threshold=0.1,
    valley_threshold=-0.1
)

# Query specific point
point = field.get(128, 128)
print(f"Slope: {point.slope_magnitude:.2f} ({math.degrees(point.slope_angle):.1f}°)")
print(f"Curvature: mean={point.curvature_mean:.3f}, gaussian={point.curvature_gaussian:.3f}")
print(f"Ridge: {point.is_ridge}, Valley: {point.is_valley}")
```

### Ridge Line Extraction (for procedural roads/paths)

```python
# Extract ridge lines
ridges = TerrainFieldCalculus.extract_ridges(field)

# Convert to path waypoints for AI/pathfinding
for ridge_line in ridges:
    if len(ridge_line) > 10:  # Only substantial ridges
        waypoints = [(p.x, p.y) for p in ridge_line]
        # Use waypoints for procedural road placement
        print(f"Ridge path with {len(waypoints)} waypoints")
```

### Watershed/Drainage Analysis (for erosion simulation)

```python
# Compute flow accumulation
flow_accum = TerrainFieldCalculus.compute_flow_accumulation(field)

# Find river channels (high flow accumulation)
river_points = []
for y in range(field.height):
    for x in range(field.width):
        if flow_accum[y][x] > 100:  # Threshold for "river"
            river_points.append((x, y))

print(f"Found {len(river_points)} river cells")
```

---

## 🎯 Optimization & Root Finding

### Newton's Method with Adaptive Step

```python
from calculus_engine import Calculus

# Find local minimum of energy function
def energy(x):
    return x**4 - 3*x**2 + 2*x

# Find where derivative = 0 (critical point)
def energy_derivative(x):
    return 4*x**3 - 6*x + 2

# Hybrid root finding (safe + fast)
critical_point = Calculus.find_root_hybrid(
    energy_derivative,
    x0=1.0,
    bracket=(0.0, 2.0),
    tol=1e-12
)

print(f"Critical point at x={critical_point:.6f}")
print(f"Energy at critical point: {energy(critical_point):.6f}")
```

### Gradient Descent for Multi-Variable Optimization

```python
# Optimize 2D function
def f(x):
    # Rosenbrock function: minimum at (1, 1)
    return (1 - x[0])**2 + 100 * (x[1] - x[0]**2)**2

# Gradient descent with adaptive step
x = [0.0, 0.0]
learning_rate = 0.001
for i in range(1000):
    grad = Calculus.gradient(f, x)
    x = [x[j] - learning_rate * grad[j] for j in range(2)]
    
    if i % 100 == 0:
        print(f"Step {i}: x={x}, f(x)={f(x):.6f}, |grad|={sum(g**2 for g in grad)**0.5:.6f}")

print(f"Converged to: x={x} (true minimum: [1, 1])")
```

---

## ⚙️ Physics Simulation with RK45

### Projectile with Air Resistance

```python
from calculus_engine import Calculus
import math

# ODE: v' = -g - k*v^2*sign(v), x' = v
def projectile_ode(t, state):
    x, y, vx, vy = state
    g = 9.81
    k = 0.01  # drag coefficient
    
    v_mag = math.sqrt(vx**2 + vy**2)
    drag_x = -k * v_mag * vx if v_mag > 0 else 0
    drag_y = -k * v_mag * vy if v_mag > 0 else 0
    
    return [vx, vy, drag_x, drag_y - g]

# Initial: 45° launch at 50 m/s
angle = math.pi / 4
v0 = 50.0
state0 = [0.0, 0.0, v0 * math.cos(angle), v0 * math.sin(angle)]

# Simulate until y < 0 (hits ground)
sol = Calculus.solve_ode_rk45(
    projectile_ode,
    state0,
    (0.0, 10.0),
    tol=1e-6
)

# Find landing time
for i, (t, state) in enumerate(zip(sol.t, sol.y)):
    if state[1] < 0 and i > 0:  # y < 0
        print(f"Landed at t={t:.2f}s, range={state[0]:.2f}m")
        break

print(f"Simulation used {sol.n_steps} adaptive steps")
```

### Mass-Spring-Damper System

```python
# ODE: mx'' + cx' + kx = 0
# State: [x, v] where v = x'
def spring_ode(t, state):
    x, v = state
    m, c, k = 1.0, 0.5, 10.0  # mass, damping, stiffness
    a = -(c * v + k * x) / m
    return [v, a]

# Initial displacement, zero velocity
state0 = [1.0, 0.0]

sol = Calculus.solve_ode_rk45(
    spring_ode,
    state0,
    (0.0, 5.0),
    tol=1e-8
)

# Plot oscillation (or export to JSON)
for t, (x, v) in zip(sol.t, sol.y):
    print(f"t={t:.2f}: x={x:.4f}, v={v:.4f}")
```

### N-Body Orbital Mechanics

```python
# Simulate 3-body problem
def nbody_ode(t, state):
    # state = [x1, y1, vx1, vy1, x2, y2, vx2, vy2, x3, y3, vx3, vy3]
    G = 1.0  # gravitational constant
    masses = [1.0, 0.5, 0.3]
    n = 3
    
    positions = [(state[i*4], state[i*4+1]) for i in range(n)]
    velocities = [(state[i*4+2], state[i*4+3]) for i in range(n)]
    
    accelerations = []
    for i in range(n):
        ax, ay = 0.0, 0.0
        for j in range(n):
            if i != j:
                dx = positions[j][0] - positions[i][0]
                dy = positions[j][1] - positions[i][1]
                r = math.sqrt(dx**2 + dy**2) + 1e-6  # softening
                force = G * masses[j] / (r**3)
                ax += force * dx
                ay += force * dy
        accelerations.append((ax, ay))
    
    # Build derivative
    deriv = []
    for i in range(n):
        deriv.extend([velocities[i][0], velocities[i][1], accelerations[i][0], accelerations[i][1]])
    
    return deriv

# Initial conditions (figure-8 orbit or custom)
state0 = [1.0, 0.0, 0.0, 0.5, -1.0, 0.0, 0.0, -0.5, 0.0, 1.0, -0.5, 0.0]

sol = Calculus.solve_ode_rk45(nbody_ode, state0, (0.0, 20.0), tol=1e-8, h_max=0.1)
print(f"N-body simulation: {sol.n_steps} steps over {sol.t[-1]:.1f} time units")
```

---

## 📊 Signal Processing & Analysis

### Smooth Function Reconstruction from Samples

```python
# Given noisy samples, compute smooth derivative
def smooth_derivative(samples, dt=1.0):
    """Compute derivatives using five-point stencil for best accuracy"""
    derivatives = []
    n = len(samples)
    
    for i in range(2, n - 2):
        # Create local function
        def local_f(x):
            idx = int(x)
            if idx < 0 or idx >= n:
                return samples[max(0, min(n-1, idx))]
            return samples[idx]
        
        # High-accuracy derivative
        result = Calculus.derivative(local_f, float(i), h=1.0, method="five_point")
        derivatives.append(result.value / dt)
    
    return derivatives
```

### Integral of Measured Data (Area Under Curve)

```python
def integrate_samples(samples, dt=1.0):
    """Adaptive integration of sampled signal"""
    # Create interpolated function
    def f(x):
        i = int(x)
        if i < 0 or i >= len(samples) - 1:
            return 0.0
        t = x - i
        return samples[i] * (1 - t) + samples[i + 1] * t
    
    result = Calculus.integrate_adaptive_simpson(
        f,
        0.0,
        float(len(samples) - 1),
        tol=1e-8
    )
    
    return result.value * dt

# Example: integrate sine wave samples
import math
samples = [math.sin(i * 0.1) for i in range(100)]
area = integrate_samples(samples, dt=0.1)
print(f"Integral: {area:.6f}")
```

---

## 🧠 AI/ML Feature Engineering

### Terrain Feature Vectors for ML

```python
def extract_terrain_features(field, x, y, radius=5):
    """Extract ML-ready feature vector from terrain point"""
    center = field.get(x, y)
    if not center:
        return None
    
    # Local statistics
    heights = []
    slopes = []
    for dx in range(-radius, radius + 1):
        for dy in range(-radius, radius + 1):
            p = field.get(x + dx, y + dy)
            if p:
                heights.append(p.height)
                slopes.append(p.slope_magnitude)
    
    features = {
        "height": center.height,
        "slope": center.slope_magnitude,
        "slope_angle": center.slope_angle,
        "curvature_mean": center.curvature_mean,
        "curvature_gaussian": center.curvature_gaussian,
        "is_ridge": float(center.is_ridge),
        "is_valley": float(center.is_valley),
        "is_saddle": float(center.is_saddle),
        "local_height_mean": sum(heights) / len(heights),
        "local_height_std": (sum((h - sum(heights)/len(heights))**2 for h in heights) / len(heights))**0.5,
        "local_slope_mean": sum(slopes) / len(slopes),
        "flow_dir_x": center.flow_direction.x,
        "flow_dir_y": center.flow_direction.y,
    }
    
    return list(features.values())

# Extract features for all terrain points
feature_vectors = []
for y in range(5, field.height - 5):
    for x in range(5, field.width - 5):
        features = extract_terrain_features(field, x, y)
        if features:
            feature_vectors.append(features)

print(f"Extracted {len(feature_vectors)} feature vectors")
# Feed to sklearn, PyTorch, etc.
```

---

## 🚀 Performance Monitoring & Error Analysis

### Adaptive Integration with Error Control

```python
# Compare different tolerance levels
test_func = lambda x: math.exp(-x**2) * math.sin(10*x)

for tol in [1e-4, 1e-8, 1e-12]:
    result = Calculus.integrate_adaptive_simpson(test_func, 0.0, 5.0, tol=tol)
    print(f"tol={tol:.0e}: value={result.value:.10f}, error_est={result.error_est:.2e}, evals={result.evals}")

# Output shows accuracy vs. computational cost tradeoff
```

### Derivative Method Comparison

```python
import math

x = 1.5
f = math.sin

methods = ["forward", "backward", "central", "five_point"]
true_value = math.cos(x)

print("Method Comparison:")
for method in methods:
    result = Calculus.derivative(f, x, method=method)
    error = abs(result.value - true_value)
    print(f"{method:12} : value={result.value:.12f}, error={error:.2e}, h={result.h_used:.2e}")

# Shows five_point is most accurate for smooth functions
```

---

## 🔗 Integration with TypeScript/Three.js

### Export Terrain Analysis to JSON

```python
from terrain_field_calculus import TerrainFieldCalculus

# Analyze terrain
field = TerrainFieldCalculus.from_heightmap(heightmap)

# Export for Three.js visualization
TerrainFieldCalculus.export_to_json(field, "terrain_analysis.json")

# In TypeScript/Three.js:
# const analysis = await fetch('terrain_analysis.json').then(r => r.json());
# // Visualize ridges, valleys, flow directions, etc.
```

### Real-Time WebSocket Bridge

```python
import asyncio
import websockets
import json

async def terrain_analysis_server(websocket, path):
    """Real-time terrain analysis service"""
    async for message in websocket:
        data = json.loads(message)
        
        # Receive heightmap from Noise3D.ts
        heightmap = data["heightmap"]
        
        # Analyze
        field = TerrainFieldCalculus.from_heightmap(heightmap)
        
        # Extract features
        ridges = TerrainFieldCalculus.extract_ridges(field)
        valleys = TerrainFieldCalculus.extract_valleys(field)
        
        # Send back
        response = {
            "ridges": [[{"x": p.x, "y": p.y} for p in ridge] for ridge in ridges],
            "valleys": [[{"x": p.x, "y": p.y} for p in valley] for valley in valleys]
        }
        
        await websocket.send(json.dumps(response))

# Start server
# asyncio.run(websocket.serve(terrain_analysis_server, "localhost", 8765))
```

---

## ⚡ Production Tips

### 1. **Step Size Selection**

```python
# Let calculus engine auto-select h (recommended)
result = Calculus.derivative(f, x)  # h=None uses adaptive

# Manual override only if you know the scale
result = Calculus.derivative(f, x, h=1e-5)  # for specific problems
```

### 2. **Curvature Computation Toggle**

```python
# Curvature is expensive (Hessian = 2x2 matrix per point)
# Disable if you only need gradients
field_fast = TerrainFieldCalculus.from_heightmap(heightmap, compute_curvature=False)

# Enable for ridge/valley detection
field_full = TerrainFieldCalculus.from_heightmap(heightmap, compute_curvature=True)
```

### 3. **ODE Step Control**

```python
# For stiff problems, tighten tolerance and reduce h_max
sol = Calculus.solve_ode_rk45(
    stiff_ode,
    y0,
    (0, 10),
    tol=1e-9,      # tighter error control
    h_max=0.01     # smaller max step
)

# For smooth problems, use defaults (much faster)
sol = Calculus.solve_ode_rk45(smooth_ode, y0, (0, 10))
```

### 4. **Complex-Step Derivative (Ultimate Accuracy)**

```python
# If your function supports complex input, use this
def f_complex(z):
    return z**3 + 2*z  # Works with complex numbers

# No cancellation error!
result = Calculus.derivative(f_complex, 1.5, method="complex_step")
print(f"Error: {abs(result.value - (3*1.5**2 + 2))}")  # Near machine precision
```

---

## 📚 Further Reading

- **Fornberg (1988)**: Generation of Finite Difference Formulas
- **Dormand-Prince RK45**: Embedded Runge-Kutta methods
- **Richardson Extrapolation**: Eliminating leading error terms
- **Hessian Eigenvalues**: Principal curvatures for surface analysis

---

**Ready to integrate?** Tell me:
1. Is your terrain in **TypeScript/Three.js** or **Python renderer**?
2. Do you want **WebSocket bridge** or **file export pipeline**?
3. Need help with **specific use case** (erosion, pathfinding, physics)?

I'll wire it directly into your World Engine 🌍🔧
