import { PNG } from "pngjs";
import { XorShift32 } from "./rng.js";

export type RGBA = { r: number; g: number; b: number; a: number };

function clamp255(n: number) {
  return Math.max(0, Math.min(255, n | 0));
}

// Very deterministic "noise texture" as a stand-in for skin/clothing.
// Replace with your Perlin/fabric later — the key is: CPU + seeded RNG.
export function generateNoiseTexturePNG(
  width: number,
  height: number,
  seed: number,
  base: RGBA,
  variance: number
): { name: string; pngBytes: Uint8Array } {
  const rng = new XorShift32(seed);
  const png = new PNG({ width, height, colorType: 6 });

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (width * y + x) << 2;
      const n = (rng.next01() * 2 - 1) * variance;

      png.data[i + 0] = clamp255(base.r + n);
      png.data[i + 1] = clamp255(base.g + n);
      png.data[i + 2] = clamp255(base.b + n);
      png.data[i + 3] = clamp255(base.a);
    }
  }

  const out = PNG.sync.write(png, { colorType: 6 });
  return { name: `noise_${width}x${height}_${seed}.png`, pngBytes: new Uint8Array(out) };
}
