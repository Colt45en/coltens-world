import type { AvatarDNA } from "./types.js";

/**
 * Toy deterministic geometry: a simple box/capsule mesh.
 *
 * THIS IS THE SWAP POINT:
 * Replace this function with real Avatar-Lab mesh assembly logic
 * (parts merge + morph application + final vertex positions).
 *
 * The rest of the pipeline (norming, hashing, textures, atlas, registry, CLI, determinism tests)
 * stays unchanged.
 */
export type Geometry = {
  positions: Float32Array;
  indices: Uint32Array;
};

export function buildAvatarGeometry(dna: AvatarDNA): Geometry {
  // Toy: deterministic "capsule" from dna properties
  // Replace with real geometry builder

  const morphInfluence = Object.values(dna.morphs).reduce((a, b) => a + b, 0) / Math.max(1, Object.keys(dna.morphs).length);
  const h = 1.4 + morphInfluence * 0.6; // 1.4..2.0
  const r = 0.25 + morphInfluence * 0.20; // 0.25..0.45

  const x0 = -r, x1 = r;
  const z0 = -r, z1 = r;
  const y0 = 0;
  const y1 = h;

  const positions = new Float32Array([
    x0, y0, z0,  x1, y0, z0,  x1, y1, z0,  x0, y1, z0, // front
    x0, y0, z1,  x1, y0, z1,  x1, y1, z1,  x0, y1, z1, // back
  ]);

  // 6 faces × 2 triangles = 12 triangles
  const idx = new Uint32Array([
    // front (0,1,2,3)
    0,1,2,  0,2,3,
    // back (4,5,6,7)
    4,6,5,  4,7,6,
    // left (0,3,7,4)
    0,3,7,  0,7,4,
    // right (1,5,6,2)
    1,6,5,  1,2,6,
    // bottom (0,4,5,1)
    0,5,4,  0,1,5,
    // top (3,2,6,7)
    3,6,2,  3,7,6
  ]);

  return { positions, indices: idx };
}

export function computeBounds(pos: Float32Array): { min: [number, number, number]; max: [number, number, number] } {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i], y = pos[i+1], z = pos[i+2];
    if (x < minX) minX = x; if (y < minY) minY = y; if (z < minZ) minZ = z;
    if (x > maxX) maxX = x; if (y > maxY) maxY = y; if (z > maxZ) maxZ = z;
  }

  return { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] };
}

export function triangleCount(indices: Uint32Array): number {
  return Math.floor(indices.length / 3);
}
