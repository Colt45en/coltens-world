// Terrain: Particle Hydraulic Erosion (CPU demo)
export interface ErosionParams {
  iterations: number;
  inertia: number;
  capacity: number;
  evaporation: number;
  minSlope: number;
  gravity: number;
}

export function erode(height: Float32Array, size: number, p: ErosionParams) {
  const idx = (x: number, y: number) => y * size + x;
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

  for (let it = 0; it < p.iterations; it++) {
    let x = Math.random() * (size - 1);
    let y = Math.random() * (size - 1);
    let dirX = 0;
    let dirY = 0;
    let speed = 1;
    let water = 1;
    let sediment = 0;

    for (let step = 0; step < 40; step++) {
      const xi = Math.floor(x);
      const yi = Math.floor(y);
      const h = height[idx(xi, yi)] ?? 0;

      // gradient (central diff)
      const gx =
        ((height[idx(clamp(xi + 1, 0, size - 1), yi)] ?? 0) -
          (height[idx(clamp(xi - 1, 0, size - 1), yi)] ?? 0)) *
        0.5;
      const gy =
        ((height[idx(xi, clamp(yi + 1, 0, size - 1))] ?? 0) -
          (height[idx(xi, clamp(yi - 1, 0, size - 1))] ?? 0)) *
        0.5;

      dirX = dirX * p.inertia - gx * (1 - p.inertia);
      dirY = dirY * p.inertia - gy * (1 - p.inertia);
      const len = Math.hypot(dirX, dirY) || 1;
      x += dirX / len;
      y += dirY / len;

      if (x < 1 || x >= size - 1 || y < 1 || y >= size - 1) break;

      const h2 = height[idx(Math.floor(x), Math.floor(y))] ?? 0;
      const dh = h2 - h;
      const cap = Math.max(-dh, p.minSlope) * speed * water * p.capacity;

      if (sediment > cap) {
        // deposit
        const deposit = (sediment - cap) * 0.1;
        const currentHeight = height[idx(xi, yi)] ?? 0;
        height[idx(xi, yi)] = currentHeight + deposit;
        sediment -= deposit;
      } else {
        // erode
        const take = Math.min((cap - sediment) * 0.1, h);
        const currentHeight = height[idx(xi, yi)] ?? 0;
        height[idx(xi, yi)] = currentHeight - take;
        sediment += take;
      }

      speed = Math.sqrt(Math.max(0, speed * speed + dh * p.gravity));
      water *= 1 - p.evaporation;
    }
  }
}
