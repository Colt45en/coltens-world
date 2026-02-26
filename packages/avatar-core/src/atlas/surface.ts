/**
 * Atlas surface: DOM-free interface for deterministic texture packing
 *
 * This defines a contract for 2D image surfaces without any DOM dependencies.
 * Implementations can use Canvas, OffscreenCanvas, Image data, or pure buffers.
 */

export type RGBA = Uint8ClampedArray;

/**
 * Minimal 2D image surface interface (no DOM).
 * Implementations are responsible for actual storage and operations.
 */
export interface ImageSurface {
  width: number;
  height: number;

  /**
   * Get a copy of all pixels as RGBA (w*h*4).
   * Deterministic: same state → same bytes.
   */
  getPixels(): RGBA;

  /**
   * Set all pixels from RGBA buffer (w*h*4).
   */
  setPixels(pixels: RGBA): void;

  /**
   * Blit pixels from another surface at offset (dx, dy).
   * Scaled to fit dst rect if src dimensions differ.
   */
  blitScaled(src: ImageSurface, dx: number, dy: number, dw: number, dh: number): void;
}

/**
 * Factory for creating image surfaces.
 * Decouples core atlas logic from rendering backend.
 */
export interface SurfaceFactory {
  create(width: number, height: number): ImageSurface;
}

/**
 * No-op (in-memory) surface: purely JavaScript-based.
 * Good for testing and Node.js headless rendering.
 */
export class MemorySurface implements ImageSurface {
  width: number;
  height: number;
  private pixels: RGBA;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    const size = width * height * 4;
    this.pixels = new Uint8ClampedArray(size);
  }

  getPixels(): RGBA {
    return new Uint8ClampedArray(this.pixels);
  }

  setPixels(pixels: RGBA): void {
    if (pixels.length !== this.pixels.length) {
      throw new Error(`setPixels: expected ${this.pixels.length} bytes, got ${pixels.length}`);
    }
    this.pixels.set(pixels);
  }

  blitScaled(src: ImageSurface, dx: number, dy: number, dw: number, dh: number): void {
    const srcPixels = src.getPixels();
    const srcW = src.width;
    const srcH = src.height;

    // Simple nearest-neighbor scaling into dest region
    for (let y = 0; y < dh; y++) {
      for (let x = 0; x < dw; x++) {
        const srcX = Math.floor((x / dw) * srcW);
        const srcY = Math.floor((y / dh) * srcH);
        const srcIdx = (srcY * srcW + srcX) * 4;
        const dstIdx = ((dy + y) * this.width + (dx + x)) * 4;

        if (srcIdx + 3 < srcPixels.length && dstIdx + 3 < this.pixels.length) {
          this.pixels[dstIdx] = srcPixels[srcIdx] ?? 0;
          this.pixels[dstIdx + 1] = srcPixels[srcIdx + 1] ?? 0;
          this.pixels[dstIdx + 2] = srcPixels[srcIdx + 2] ?? 0;
          this.pixels[dstIdx + 3] = srcPixels[srcIdx + 3] ?? 255;
        }
      }
    }
  }
}

/**
 * Default in-memory factory.
 */
export const defaultSurfaceFactory: SurfaceFactory = {
  create: (w, h) => new MemorySurface(w, h),
};
