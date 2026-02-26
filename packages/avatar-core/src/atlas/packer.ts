/**
 * Atlas packing: 2x2 fixed-grid layout
 * Returns pixel rectangles for each slot.
 */
import type { AtlasRect } from "../types.js";

export type AtlasSlot = {
  key: string;
  pixelBuffer?: Uint8ClampedArray;
};

export type PackedAtlas = {
  rectByKey: Record<string, AtlasRect>;
};

/**
 * Pack slots into 2x2 grid (fixed layout, no bin-packing logic).
 * Assumes all slots have same size.
 */
export function packAtlas2x2(slots: AtlasSlot[]): PackedAtlas {
  const rectByKey: Record<string, AtlasRect> = {};

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (!slot) continue;

    const col = i % 2;
    const row = Math.floor(i / 2);

    rectByKey[slot.key] = {
      x: col * 0.5,
      y: row * 0.5,
      w: 0.5,
      h: 0.5,
    };
  }

  return { rectByKey };
}
