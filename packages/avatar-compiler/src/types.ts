/**
 * Type definitions for deterministic avatar compilation.
 * Adapted to actual avatar-lab DNA schema.
 * NO TIMESTAMPS inside content hashes.
 */

// Mirror of avatar-lab's actual DNA schema
export type MorphMap = Record<string, number>;

export type AvatarDNA = {
  avatar_id: string;
  morphs: MorphMap;
  materials: {
    skinColor: string;
    hairColor: string;
    roughness: number;
    metalness: number;
  };
  textures?: {
    skinMap?: string;
    clothingMap?: string;
    maskMap?: string;
  };
  postfx: {
    bloom: number;
    ao: number;
    smaa: boolean;
  };
  quality: {
    shadows: boolean;
    shadowMapSize: 1024 | 2048;
  };
};

export type CompileOptions = {
  atlasSize?: number;
  lodLevels?: number;
  quantizeStep?: number;
  assetsRoot?: string;
  requireTextures?: boolean;
};

export type CompiledAsset = {
  avatar_id: string;
  dna_hash: string;
  content_hash: string;
  bytes: Uint8Array;

  metadata: {
    poly_count: number;
    bounds: { min: [number, number, number]; max: [number, number, number] };
    atlas: { width: number; height: number; entries: AtlasEntry[] };
    lod: Array<{ level: number; poly_percent: number; poly_count: number }>;
    file_size: number;
  };
};

export type AtlasEntry = {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type RegistryEntry = {
  avatar_id: string;
  content_hash: string;
  dna_hash: string;
  file_size: number;
  poly_count: number;
  bounds: { min: [number, number, number]; max: [number, number, number] };
};

export type AssetRegistry = {
  version: 1;
  generated_at_unix_ms: number; // NOT part of content hash
  by_content_hash: Record<string, RegistryEntry>;
};

export const DEFAULT_DNA: AvatarDNA = {
  avatar_id: "default",
  morphs: {},
  materials: {
    skinColor: "#d8b59a",
    hairColor: "#2b1d14",
    roughness: 0.85,
    metalness: 0,
  },
  textures: {
    skinMap: "/skin.jpg",
    clothingMap: "/clothing.jpg",
    maskMap: "/mask.png",
  },
  postfx: {
    bloom: 0.25,
    ao: 0.45,
    smaa: true,
  },
  quality: {
    shadows: true,
    shadowMapSize: 1024,
  },
};
