import fs from "node:fs/promises";
import path from "node:path";
import { bakeAtlasDeterministic } from "./atlas.js";
import { canonicalDNA } from "./canonical.js";
import { buildDeterministicContainer } from "./container.js";
import { buildAvatarGeometry, computeBounds, triangleCount } from "./geometry.js";
import { sha256HexBytes, sha256HexString } from "./hash.js";
import { generateNoiseTexturePNG } from "./textures.js";
import type { AvatarDNA, CompileOptions, CompiledAsset } from "./types.js";

function clamp01(x: number) { return Math.max(0, Math.min(1, x)); }
type CompileBatchJob = (Partial<AvatarDNA> & { avatar_id: string }) | { avatar_id: string; dna: Partial<AvatarDNA> };

type ExternalTextureBlob = {
  slot: "skinMap" | "clothingMap" | "maskMap";
  source: string;
  blobName: string;
  bytes: Uint8Array;
  bytes_hash: string;
  bytes_len: number;
};

function isSafeTextureSource(src: string): boolean {
  const s = src.trim().replace(/\\/g, "/");
  if (!s) return false;
  if (s.startsWith("http://") || s.startsWith("https://")) return false;
  const noLead = s.startsWith("/") ? s.slice(1) : s;
  if (!noLead) return false;
  if (path.isAbsolute(noLead)) return false;
  if (noLead.includes("..")) return false;
  return true;
}

function normalizeTextureSource(src: string): string {
  const s = src.trim().replace(/\\/g, "/");
  return s.startsWith("/") ? s : `/${s}`;
}

async function loadExternalTextureBlobs(
  textures: AvatarDNA["textures"] | undefined,
  opts: CompileOptions,
): Promise<ExternalTextureBlob[]> {
  const assetsRoot = opts.assetsRoot;
  const requireTextures = Boolean(opts.requireTextures);
  if (!assetsRoot) {
    if (requireTextures) {
      throw new Error("compileAvatar: requireTextures=true but no assetsRoot was provided");
    }
    return [];
  }

  const slots: Array<ExternalTextureBlob["slot"]> = ["skinMap", "clothingMap", "maskMap"];
  const out: ExternalTextureBlob[] = [];

  for (const slot of slots) {
    const raw = textures?.[slot];
    if (!raw) continue;
    if (!isSafeTextureSource(raw)) {
      throw new Error(`Unsafe texture path for ${slot}: ${raw}`);
    }

    const source = normalizeTextureSource(raw);
    const rel = source.replace(/^\//, "");
    const resolved = path.resolve(assetsRoot, rel);

    let bytes: Uint8Array;
    try {
      bytes = await fs.readFile(resolved);
    } catch {
      if (requireTextures) {
        throw new Error(`Missing texture for ${slot}: ${source} (resolved: ${resolved})`);
      }
      continue;
    }

    const ext = path.posix.extname(source.toLowerCase()) || ".bin";
    out.push({
      slot,
      source,
      blobName: `textures/${slot}${ext}`,
      bytes,
      bytes_hash: sha256HexBytes(bytes),
      bytes_len: bytes.length,
    });
  }

  if (requireTextures && out.length === 0) {
    throw new Error("requireTextures=true but no texture files were resolved from assetsRoot");
  }

  return out;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

export async function compileAvatar(dna: Partial<AvatarDNA>, opts: CompileOptions = {}): Promise<CompiledAsset> {
  const atlasSize = opts.atlasSize ?? 512;
  const lodLevels = Math.max(1, Math.min(4, opts.lodLevels ?? 4));
  const quantizeStep = opts.quantizeStep ?? 1e-6;

  // Get avatar_id from dna or use default
  const avatar_id = (dna as any).avatar_id || "default";

  // Normalize DNA ranges deterministically
  const clean: Partial<AvatarDNA> = {
    morphs: dna.morphs || {},
    materials: {
      skinColor: dna.materials?.skinColor || "#d8b59a",
      hairColor: dna.materials?.hairColor || "#2b1d14",
      roughness: clamp01(dna.materials?.roughness ?? 0.85),
      metalness: clamp01(dna.materials?.metalness ?? 0),
    },
    textures: dna.textures,
    postfx: {
      bloom: clamp01(dna.postfx?.bloom ?? 0.25),
      ao: clamp01(dna.postfx?.ao ?? 0.45),
      smaa: dna.postfx?.smaa ?? true,
    },
    quality: {
      shadows: dna.quality?.shadows ?? true,
      shadowMapSize: dna.quality?.shadowMapSize ?? 1024,
    },
  };

  const dnaCanon = canonicalDNA(clean as AvatarDNA, quantizeStep);
  const dna_hash = sha256HexString(dnaCanon);
  const externalTextureBlobs = await loadExternalTextureBlobs(clean.textures, opts);

  // Geometry (toy for now - replace with real Avatar-Lab logic)
  const geom = buildAvatarGeometry(clean as AvatarDNA);
  const bounds = computeBounds(geom.positions);
  const poly_count = triangleCount(geom.indices);

  // Deterministic textures (stand-ins - replace with real fabric/Perlin)
  const skinRgb = hexToRgb(clean.materials!.skinColor);
  const hairRgb = hexToRgb(clean.materials!.hairColor);

  const skin = generateNoiseTexturePNG(128, 128, avatar_id.charCodeAt(0) ^ 0xA53C, { ...skinRgb, a: 255 }, 18);
  const hair = generateNoiseTexturePNG(128, 128, avatar_id.charCodeAt(0) ^ 0x19F1, { ...hairRgb, a: 255 }, 35);

  const atlas = bakeAtlasDeterministic(
    [
      { name: "skin.png", pngBytes: skin.pngBytes },
      { name: "hair.png", pngBytes: hair.pngBytes },
    ],
    atlasSize
  );

  // Deterministic LOD metadata
  const lod = Array.from({ length: lodLevels }, (_, i) => {
    const level = i;
    const poly_percent = i === 0 ? 1.0 : Math.max(0.05, 1.0 - i * 0.25);
    const lodPoly = Math.max(1, Math.floor(poly_count * poly_percent));
    return { level, poly_percent, poly_count: lodPoly };
  });

  // Deterministic payload JSON (NO timestamps inside!)
  const payload = {
    version: 1,
    avatar_id,
    dna_hash,
    geometry: {
      positions: Array.from(geom.positions),
      indices: Array.from(geom.indices),
    },
    atlas: {
      width: atlas.width,
      height: atlas.height,
      entries: atlas.entries,
    },
    lod,
    bounds,
    poly_count,
    external_textures: externalTextureBlobs.map((t) => ({
      slot: t.slot,
      source: t.source,
      blob_name: t.blobName,
      bytes_hash: t.bytes_hash,
      bytes_len: t.bytes_len,
    })),
  };

  const json = JSON.stringify(payload);
  const bytes = buildDeterministicContainer(
    json,
    [
      { name: "atlas.png", bytes: atlas.atlasPng },
      ...externalTextureBlobs
        .slice()
        .sort((a, b) => a.blobName.localeCompare(b.blobName))
        .map((t) => ({ name: t.blobName, bytes: t.bytes })),
    ],
  );

  const content_hash = sha256HexBytes(bytes);

  return {
    avatar_id,
    dna_hash,
    content_hash,
    bytes,
    metadata: {
      poly_count,
      bounds,
      atlas: { width: atlas.width, height: atlas.height, entries: atlas.entries },
      lod,
      file_size: bytes.length,
    },
  };
}

export async function compileBatch(dnas: CompileBatchJob[], opts: CompileOptions = {}): Promise<CompiledAsset[]> {
  // Stable order by avatar_id to ensure repeatable batch results
  const sorted = [...dnas].sort((a, b) => a.avatar_id.localeCompare(b.avatar_id));
  const out: CompiledAsset[] = [];
  for (const job of sorted) {
    const dna = "dna" in job && job.dna ? ({ ...job.dna, avatar_id: job.avatar_id } as Partial<AvatarDNA>) : job;
    out.push(await compileAvatar(dna, opts));
  }
  return out;
}
