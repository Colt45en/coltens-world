export type MorphMap = Record<string, number>;

export type AvatarDNA = {
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

export const DEFAULT_DNA: AvatarDNA = {
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

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function clampMorph(value: number): number {
  return Math.max(-1, Math.min(1, value));
}
