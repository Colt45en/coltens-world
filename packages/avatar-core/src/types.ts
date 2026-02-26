/**
 * Avatar core shared types (DOM-free)
 */
import type * as THREE from "three";

export type BakeMorphOptions = {
  bakeNormals?: boolean;
  clampWeights?: boolean;
};

export type AtlasRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type BakeAtlasSlot = {
  key: string;
  pixelBuffer?: Uint8ClampedArray; // w*h*4 RGBA
};

export type BakeAtlasResult = {
  pixelBuffer: Uint8ClampedArray;
  rectByKey: Record<string, AtlasRect>;
};

export type PartKey = "skin" | "clothing" | "hair" | "eyes" | "other";

export type LODConfig = {
  distances?: number[];
  ratios?: number[];
};

export type MergeGeometriesOptions = {
  materialByPart?: Record<PartKey, THREE.Material>;
};
