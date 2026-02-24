/**
 * Noise3D - 3D Simplex Noise for procedural generation
 *
 * Implements Ken Perlin's simplex noise algorithm for smooth, continuous 3D noise.
 * Used for terrain generation, cloud patterns, organic motion, and "chaos" factors.
 *
 * Features:
 * - Continuous and smooth across all scales
 * - No directional artifacts (unlike Perlin noise)
 * - Fast computation (simplex grid vs cubic grid)
 * - Deterministic output from seeded permutation table
 */

export class Noise3D {
  private perm: Uint8Array;
  private permMod12: Uint8Array;

  // Gradient vectors for 3D
  private static readonly GRAD3 = [
    [1, 1, 0],
    [-1, 1, 0],
    [1, -1, 0],
    [-1, -1, 0],
    [1, 0, 1],
    [-1, 0, 1],
    [1, 0, -1],
    [-1, 0, -1],
    [0, 1, 1],
    [0, -1, 1],
    [0, 1, -1],
    [0, -1, -1],
  ];

  constructor(seed?: number) {
    // Generate permutation table
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      p[i] = i;
    }

    // Shuffle using seed
    if (seed !== undefined) {
      const random = this.seededRandom(seed);
      for (let i = 255; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        const temp = p[i]!;
        p[i] = p[j]!;
        p[j] = temp;
      }
    } else {
      // Random shuffle
      for (let i = 255; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = p[i]!;
        p[i] = p[j]!;
        p[j] = temp;
      }
    }

    // Duplicate permutation table to avoid wrapping
    this.perm = new Uint8Array(512);
    this.permMod12 = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255]!;
      this.permMod12[i] = this.perm[i]! % 12;
    }
  }

  // Seeded random number generator (simple LCG)
  private seededRandom(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state * 1664525 + 1013904223) & 0xffffffff;
      return state / 0xffffffff;
    };
  }

  // Dot product for gradient calculation
  private dot(g: number[], x: number, y: number, z: number): number {
    return g[0]! * x + g[1]! * y + g[2]! * z;
  }

  /**
   * 3D Simplex Noise
   * @param xin - X coordinate
   * @param yin - Y coordinate
   * @param zin - Z coordinate
   * @returns Noise value in range [-1, 1]
   */
  simplex3(xin: number, yin: number, zin: number): number {
    // Skewing/Unskewing factors for 3D
    const F3 = 1.0 / 3.0;
    const G3 = 1.0 / 6.0;

    // Skew the input space to determine which simplex cell we're in
    const s = (xin + yin + zin) * F3;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const k = Math.floor(zin + s);

    const t = (i + j + k) * G3;
    const X0 = i - t;
    const Y0 = j - t;
    const Z0 = k - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;
    const z0 = zin - Z0;

    // Determine which simplex we're in
    let i1, j1, k1, i2, j2, k2;

    if (x0 >= y0) {
      if (y0 >= z0) {
        i1 = 1;
        j1 = 0;
        k1 = 0;
        i2 = 1;
        j2 = 1;
        k2 = 0;
      } else if (x0 >= z0) {
        i1 = 1;
        j1 = 0;
        k1 = 0;
        i2 = 1;
        j2 = 0;
        k2 = 1;
      } else {
        i1 = 0;
        j1 = 0;
        k1 = 1;
        i2 = 1;
        j2 = 0;
        k2 = 1;
      }
    } else {
      if (y0 < z0) {
        i1 = 0;
        j1 = 0;
        k1 = 1;
        i2 = 0;
        j2 = 1;
        k2 = 1;
      } else if (x0 < z0) {
        i1 = 0;
        j1 = 1;
        k1 = 0;
        i2 = 0;
        j2 = 1;
        k2 = 1;
      } else {
        i1 = 0;
        j1 = 1;
        k1 = 0;
        i2 = 1;
        j2 = 1;
        k2 = 0;
      }
    }

    // Offsets for corners
    const x1 = x0 - i1 + G3;
    const y1 = y0 - j1 + G3;
    const z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2.0 * G3;
    const y2 = y0 - j2 + 2.0 * G3;
    const z2 = z0 - k2 + 2.0 * G3;
    const x3 = x0 - 1.0 + 3.0 * G3;
    const y3 = y0 - 1.0 + 3.0 * G3;
    const z3 = z0 - 1.0 + 3.0 * G3;

    // Hash coordinates
    const ii = i & 255;
    const jj = j & 255;
    const kk = k & 255;

    const gi0 = this.permMod12[ii + this.perm[jj + this.perm[kk]!]!]!;
    const gi1 = this.permMod12[ii + i1 + this.perm[jj + j1 + this.perm[kk + k1]!]!]!;
    const gi2 = this.permMod12[ii + i2 + this.perm[jj + j2 + this.perm[kk + k2]!]!]!;
    const gi3 = this.permMod12[ii + 1 + this.perm[jj + 1 + this.perm[kk + 1]!]!]!;

    // Calculate contributions from each corner
    let n0, n1, n2, n3;

    let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
    if (t0 < 0) {
      n0 = 0.0;
    } else {
      t0 *= t0;
      n0 = t0 * t0 * this.dot(Noise3D.GRAD3[gi0]!, x0, y0, z0);
    }

    let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
    if (t1 < 0) {
      n1 = 0.0;
    } else {
      t1 *= t1;
      n1 = t1 * t1 * this.dot(Noise3D.GRAD3[gi1]!, x1, y1, z1);
    }

    let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
    if (t2 < 0) {
      n2 = 0.0;
    } else {
      t2 *= t2;
      n2 = t2 * t2 * this.dot(Noise3D.GRAD3[gi2]!, x2, y2, z2);
    }

    let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
    if (t3 < 0) {
      n3 = 0.0;
    } else {
      t3 *= t3;
      n3 = t3 * t3 * this.dot(Noise3D.GRAD3[gi3]!, x3, y3, z3);
    }

    // Sum and scale to [-1, 1]
    return 32.0 * (n0 + n1 + n2 + n3);
  }

  /**
   * Fractal Brownian Motion - Layered noise for natural patterns
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param z - Z coordinate
   * @param octaves - Number of noise layers (default: 4)
   * @param lacunarity - Frequency multiplier per octave (default: 2.0)
   * @param persistence - Amplitude multiplier per octave (default: 0.5)
   */
  fbm(
    x: number,
    y: number,
    z: number,
    octaves = 4,
    lacunarity = 2.0,
    persistence = 0.5
  ): number {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      total += this.simplex3(x * frequency, y * frequency, z * frequency) * amplitude;

      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return total / maxValue;
  }

  /**
   * Turbulence - Absolute value of noise for cloud/marble effects
   */
  turbulence(
    x: number,
    y: number,
    z: number,
    octaves = 4,
    lacunarity = 2.0,
    persistence = 0.5
  ): number {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      total +=
        Math.abs(this.simplex3(x * frequency, y * frequency, z * frequency)) *
        amplitude;

      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return total / maxValue;
  }

  /**
   * Ridged noise - Inverted turbulence for mountain ridges
   */
  ridged(
    x: number,
    y: number,
    z: number,
    octaves = 4,
    lacunarity = 2.0,
    persistence = 0.5
  ): number {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      const noise = this.simplex3(x * frequency, y * frequency, z * frequency);
      const ridged = 1.0 - Math.abs(noise);

      total += ridged * ridged * amplitude;

      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return total / maxValue;
  }
}

// Export singleton instance with random seed
export const noise3D = new Noise3D();
