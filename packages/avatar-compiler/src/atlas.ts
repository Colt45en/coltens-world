import { PNG } from "pngjs";

export type AtlasEntry = { name: string; x: number; y: number; w: number; h: number };

type InputTex = { name: string; pngBytes: Uint8Array };

function area(w: number, h: number) { return w * h; }

export function bakeAtlasDeterministic(
  textures: InputTex[],
  atlasSize: number
): { atlasPng: Uint8Array; entries: AtlasEntry[]; width: number; height: number } {
  // Parse inputs, sort deterministically by area desc, then name asc
  const parsed = textures.map(t => {
    const p = PNG.sync.read(Buffer.from(t.pngBytes));
    return { name: t.name, png: p, w: p.width, h: p.height };
  }).sort((a, b) => {
    const da = area(b.w, b.h) - area(a.w, a.h);
    if (da !== 0) return da;
    return a.name.localeCompare(b.name);
  });

  const atlas = new PNG({ width: atlasSize, height: atlasSize, colorType: 6 });
  atlas.data.fill(0);

  // Simple deterministic "shelf" packer
  let x = 0, y = 0, rowH = 0;
  const entries: AtlasEntry[] = [];

  for (const t of parsed) {
    if (t.w > atlasSize || t.h > atlasSize) {
      throw new Error(`Texture too large for atlas: ${t.name} (${t.w}x${t.h}) > ${atlasSize}`);
    }
    if (x + t.w > atlasSize) {
      x = 0;
      y += rowH;
      rowH = 0;
    }
    if (y + t.h > atlasSize) {
      throw new Error(`Atlas overflow at ${t.name}. Increase atlasSize.`);
    }

    // Copy pixels
    for (let yy = 0; yy < t.h; yy++) {
      for (let xx = 0; xx < t.w; xx++) {
        const srcI = (t.w * yy + xx) << 2;
        const dstI = (atlasSize * (y + yy) + (x + xx)) << 2;

        atlas.data[dstI + 0] = t.png.data[srcI + 0];
        atlas.data[dstI + 1] = t.png.data[srcI + 1];
        atlas.data[dstI + 2] = t.png.data[srcI + 2];
        atlas.data[dstI + 3] = t.png.data[srcI + 3];
      }
    }

    entries.push({ name: t.name, x, y, w: t.w, h: t.h });
    x += t.w;
    rowH = Math.max(rowH, t.h);
  }

  const out = PNG.sync.write(atlas, { colorType: 6 });
  return { atlasPng: new Uint8Array(out), entries, width: atlasSize, height: atlasSize };
}
