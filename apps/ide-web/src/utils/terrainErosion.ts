/**
 * terrainErosion.ts - Particle Hydraulic Erosion (CPU demo)
 *
 * Simulates water droplet erosion on terrain heightmaps using
 * particle-based hydraulic erosion with sediment transport.
 */

export interface ErosionParams {
  iterations: number;
  inertia: number;
  capacity: number;
  evaporation: number;
  minSlope: number;
  gravity: number;
}

export const DEFAULT_EROSION_PARAMS: ErosionParams = {
  iterations: 50000,
  inertia: 0.05,
  capacity: 4,
  evaporation: 0.02,
  minSlope: 0.01,
  gravity: 4,
};

/**
 * Apply particle hydraulic erosion to a heightmap
 * @param height - Float32Array heightmap (size x size)
 * @param size - Width/height of the heightmap
 * @param p - Erosion parameters
 */
export function erode(height: Float32Array, size: number, p: ErosionParams): void {
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

      // Gradient (central difference)
      const gx = ((height[idx(clamp(xi + 1, 0, size - 1), yi)] ?? 0) - (height[idx(clamp(xi - 1, 0, size - 1), yi)] ?? 0)) * 0.5;
      const gy = ((height[idx(xi, clamp(yi + 1, 0, size - 1))] ?? 0) - (height[idx(xi, clamp(yi - 1, 0, size - 1))] ?? 0)) * 0.5;

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
        // Deposit sediment
        const deposit = (sediment - cap) * 0.1;
        const currentHeight = height[idx(xi, yi)] ?? 0;
        height[idx(xi, yi)] = currentHeight + deposit;
        sediment -= deposit;
      } else {
        // Erode terrain
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

/**
 * Generate a random heightmap with noise
 */
export function generateHeightmap(size: number, scale = 0.1): Float32Array {
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / size - 0.5;
      const ny = y / size - 0.5;
      const dist = Math.sqrt(nx * nx + ny * ny);

      // Simple noise approximation
      const noise = Math.sin(x * scale) * Math.cos(y * scale) * 0.5 +
                    Math.sin(x * scale * 2.3) * Math.cos(y * scale * 1.7) * 0.25 +
                    Math.sin(x * scale * 4.1) * Math.cos(y * scale * 3.9) * 0.125;

      // Create bowl shape with noise
      height[y * size + x] = Math.max(0, (0.5 - dist) * 2 + noise * 0.3);
    }
  }
  return height;
}

/**
 * Render heightmap to ImageData for canvas display
 */
export function renderHeightmap(
  height: Float32Array,
  size: number,
  imageData: ImageData
): void {
  // Find min/max for normalization
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < height.length; i++) {
    const val = height[i] ?? 0;
    min = Math.min(min, val);
    max = Math.max(max, val);
  }

  const range = max - min || 1;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = y * size + x;
      const normalized = ((height[idx] ?? 0) - min) / range;

      // Color gradient: blue (low) -> green -> brown -> white (high)
      let r = 0, g = 0, b = 0;

      if (normalized < 0.3) {
        // Blue to cyan
        const t = normalized / 0.3;
        r = Math.floor(0 + t * 100);
        g = Math.floor(100 + t * 155);
        b = Math.floor(180 + t * 75);
      } else if (normalized < 0.5) {
        // Cyan to green
        const t = (normalized - 0.3) / 0.2;
        r = Math.floor(100 - t * 50);
        g = Math.floor(255 - t * 75);
        b = Math.floor(255 - t * 155);
      } else if (normalized < 0.7) {
        // Green to brown
        const t = (normalized - 0.5) / 0.2;
        r = Math.floor(50 + t * 100);
        g = Math.floor(180 - t * 60);
        b = Math.floor(100 - t * 50);
      } else {
        // Brown to white
        const t = (normalized - 0.7) / 0.3;
        r = Math.floor(150 + t * 105);
        g = Math.floor(120 + t * 135);
        b = Math.floor(50 + t * 205);
      }

      const pixelIdx = (y * size + x) * 4;
      imageData.data[pixelIdx] = r;
      imageData.data[pixelIdx + 1] = g;
      imageData.data[pixelIdx + 2] = b;
      imageData.data[pixelIdx + 3] = 255;
    }
  }
}
