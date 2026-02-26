/**
 * SHIM: bakeAtlas re-exported from @world-engine/avatar-core
 * Original: apps/avatar-lab/src/avatar/export/atlas/bakeAtlas.ts
 * 
 * Browser-specific wrapper: adds Canvas support on top of DOM-free core.
 * Provides canvas textures for THREE.js rendering.
 */

import * as THREE from "three";
import { remapGeometryUVsToRect, type AtlasRect } from "@world-engine/avatar-core/atlas";

// Re-export pure functions
export { remapGeometryUVsToRect };

export type AtlasSlot = {
  key: string;
  url?: string;
  rect: { x: number; y: number; w: number; h: number };
};

export type AtlasResult = {
  atlasTexture: THREE.Texture | null;
  atlasCanvas: HTMLCanvasElement | null;
  rectByKey: Record<string, AtlasSlot["rect"]>;
};

/**
 * Load image from URL (browser-specific).
 */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = (error) => reject(error);
    image.src = url;
  });
}

/**
 * Browser-specific canvas-based atlas baking.
 * Converts image URLs to canvas texture + rectangles.
 */
export async function bakeFixedAtlas2x2(opts: {
  atlasSize: number;
  slots: Array<{ key: string; url?: string }>;
}): Promise<AtlasResult> {
  const { atlasSize, slots } = opts;

  // Create canvas
  const canvas = document.createElement("canvas");
  canvas.width = atlasSize;
  canvas.height = atlasSize;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D canvas context unavailable");

  context.fillStyle = "rgba(0,0,0,0)";
  context.fillRect(0, 0, atlasSize, atlasSize);

  // Load images and composite into canvas
  const rectByKey: Record<string, AtlasRect> = {};
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (!slot) continue;

    const col = i % 2;
    const row = Math.floor(i / 2);
    const rect = { x: col * 0.5, y: row * 0.5, w: 0.5, h: 0.5 };
    rectByKey[slot.key] = rect;

    if (!slot.url) continue;

    try {
      const image = await loadImage(slot.url);
      const dx = rect.x * atlasSize;
      const dy = rect.y * atlasSize;
      const dw = rect.w * atlasSize;
      const dh = rect.h * atlasSize;
      context.drawImage(image, dx, dy, dw, dh);
    } catch {
      // Keep slot empty on load failure
    }
  }

  // Convert canvas to THREE texture
  const atlasTexture = new THREE.CanvasTexture(canvas);
  atlasTexture.colorSpace = THREE.SRGBColorSpace;
  atlasTexture.wrapS = THREE.ClampToEdgeWrapping;
  atlasTexture.wrapT = THREE.ClampToEdgeWrapping;
  atlasTexture.needsUpdate = true;

  return {
    atlasTexture,
    atlasCanvas: canvas,
    rectByKey,
  };
}
