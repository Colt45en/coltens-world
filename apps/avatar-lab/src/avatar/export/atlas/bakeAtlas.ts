import * as THREE from "three";

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

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = (error) => reject(error);
    image.src = url;
  });
}

function createEmptyCanvas(size: number): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D canvas context unavailable");

  context.fillStyle = "rgba(0,0,0,0)";
  context.fillRect(0, 0, size, size);
  return { canvas, context };
}

export async function bakeFixedAtlas2x2(opts: {
  atlasSize: number;
  slots: Array<{ key: string; url?: string }>;
}): Promise<AtlasResult> {
  const { atlasSize, slots } = opts;

  const rectByKey: Record<string, AtlasSlot["rect"]> = {};
  const getRect = (index: number): AtlasSlot["rect"] => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    return { x: col * 0.5, y: row * 0.5, w: 0.5, h: 0.5 };
  };

  const { canvas, context } = createEmptyCanvas(atlasSize);

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (!slot) continue;

    const rect = getRect(i);
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
      // keep slot empty when image fails to load
    }
  }

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

export function remapGeometryUVsToRect(
  geometry: THREE.BufferGeometry,
  rect: { x: number; y: number; w: number; h: number }
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
