/**
 * Bake atlas: pure deterministic atlas packing from pixel buffers.
 * No DOM, no Canvas, no async image loading.
 * Caller provides pixel data; atlas core does the layout and UV remapping.
 */
import type * as THREE from "three";
import type { AtlasRect } from "../types";
import { packAtlas2x2, type AtlasSlot } from "./packer";
import { defaultSurfaceFactory, type ImageSurface } from "./surface";

export type BakeAtlasInput = {
  atlasSize: number;
  slots: AtlasSlot[];
  surfaceFactory?: typeof defaultSurfaceFactory;
};

export type BakeAtlasOutput = {
  surface: ImageSurface;
  rectByKey: Record<string, AtlasRect>;
};

/**
 * Bake pixels into an atlas surface (pure, deterministic).
 * Caller must provide pixel buffers; we do the layout and composition.
 *
 * @param input atlas size, slots with optional pixel data
 * @returns surface (pixel buffer) + rects
 */
export function bakeAtlas(input: BakeAtlasInput): BakeAtlasOutput {
  const { atlasSize, slots, surfaceFactory = defaultSurfaceFactory } = input;

  // Layout
  const packed = packAtlas2x2(slots);

  // Create surface
  const surface = surfaceFactory.create(atlasSize, atlasSize);

  // Composite pixels into surface
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (!slot || !slot.pixelBuffer) continue;

    const rect = packed.rectByKey[slot.key];
    if (!rect) continue;

    // Target region in atlas
    const dx = Math.floor(rect.x * atlasSize);
    const dy = Math.floor(rect.y * atlasSize);
    const dw = Math.floor(rect.w * atlasSize);
    const dh = Math.floor(rect.h * atlasSize);

    // Create temp surface for this slot's pixels
    const slotW = Math.sqrt(slot.pixelBuffer.length / 4);
    const slotH = slotW;
    const tmpSurface = surfaceFactory.create(slotW, slotH);
    tmpSurface.setPixels(slot.pixelBuffer);

    // Blit into atlas at target rect
    surface.blitScaled(tmpSurface, dx, dy, dw, dh);
  }

  return {
    surface,
    rectByKey: packed.rectByKey,
  };
}

/**
 * Remap geometry UVs to a specific atlas rectangle.
 * Updates UV attribute in-place.
 */
export function remapGeometryUVsToRect(
  geometry: THREE.BufferGeometry,
  rect: AtlasRect,
): void {
  const uv = geometry.getAttribute("uv") as THREE.BufferAttribute | undefined;
  if (!uv) return;

  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    uv.setXY(i, rect.x + u * rect.w, rect.y + v * rect.h);
  }

  uv.needsUpdate = true;
}
