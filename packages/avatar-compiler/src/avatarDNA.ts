import fs from "node:fs/promises";
import path from "node:path";
import { canonicalize, canonicalJSONStringify } from "./canonical.js";
import { sha256HexBytes, sha256HexString } from "./hash.js";
import type { AvatarDNA as CompilerAvatarDNA } from "./types.js";

export type AvatarDNA = Omit<CompilerAvatarDNA, "avatar_id"> & Partial<Pick<CompilerAvatarDNA, "avatar_id">>;

export type TextureSlot = "skinMap" | "clothingMap" | "maskMap";

export type TextureManifestEntry = {
  slot: TextureSlot;
  source: string;
  resolved_path: string;
  bytes_hash: string;
  bytes_len: number;
};

export type NormalizedAvatarDNA = {
  dna: CompilerAvatarDNA;
  dna_hash: string;
  compile: {
    textures: TextureManifestEntry[];
  };
};

export type NormalizeAvatarDNAOptions = {
  assetsRoot: string;
  requireTextures?: boolean;
  quantizeStep?: number;
};

const DEFAULTS: Omit<CompilerAvatarDNA, "avatar_id"> = {
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

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function clampMorph(x: number) {
  return Math.max(-1, Math.min(1, x));
}

function asRecord(v: unknown): Record<string, unknown> {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};
}

function asFinite(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function asBoolean(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

export function canonicalHexColor(input: unknown): string {
  if (typeof input !== "string") return "#000000";
  const raw = input.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${raw
      .split("")
      .map((c) => c + c)
      .join("")
      .toLowerCase()}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) {
    return `#${raw.toLowerCase()}`;
  }
  return "#000000";
}

function normalizeTextureSource(src: string): string {
  const s = src.trim().replace(/\\/g, "/");
  return s.startsWith("/") ? s : `/${s}`;
}

async function buildTextureManifest(
  textures: Partial<Record<TextureSlot, unknown>> | undefined,
  opts: NormalizeAvatarDNAOptions,
): Promise<TextureManifestEntry[]> {
  const slots: TextureSlot[] = ["skinMap", "clothingMap", "maskMap"];
  const out: TextureManifestEntry[] = [];

  for (const slot of slots) {
    const raw = textures?.[slot];
    if (typeof raw !== "string" || !raw.trim()) continue;

    const source = normalizeTextureSource(raw);
    const rel = source.replace(/^\//, "");
    const resolved = path.resolve(opts.assetsRoot, rel);

    let bytes: Uint8Array;
    try {
      bytes = await fs.readFile(resolved);
    } catch (error) {
      if (opts.requireTextures) {
        throw new Error(`Missing texture for ${slot}: ${source} (resolved: ${resolved})`);
      }
      continue;
    }

    out.push({
      slot,
      source,
      resolved_path: resolved,
      bytes_hash: sha256HexBytes(bytes),
      bytes_len: bytes.length,
    });
  }

  if (opts.requireTextures && out.length === 0) {
    throw new Error("No textures resolved under assetsRoot while --require-textures is enabled");
  }

  return out;
}

export async function normalizeAvatarDNA(
  dna: AvatarDNA,
  opts: NormalizeAvatarDNAOptions,
): Promise<NormalizedAvatarDNA> {
  const quantizeStep = opts.quantizeStep ?? 1e-6;

  const morphsIn = asRecord(dna.morphs);
  const materialsIn = asRecord(dna.materials);
  const texturesIn = dna.textures ? (asRecord(dna.textures) as Partial<Record<TextureSlot, unknown>>) : undefined;
  const postfxIn = asRecord(dna.postfx);
  const qualityIn = asRecord(dna.quality);

  const morphs: Record<string, number> = {};
  for (const key of Object.keys(morphsIn).sort()) {
    const v = morphsIn[key];
    if (typeof v === "number" && Number.isFinite(v)) {
      morphs[key] = clampMorph(v);
    }
  }

  const clean: CompilerAvatarDNA = {
    avatar_id: typeof dna.avatar_id === "string" && dna.avatar_id.trim() ? dna.avatar_id.trim() : "default",
    morphs,
    materials: {
      skinColor: canonicalHexColor(materialsIn.skinColor ?? DEFAULTS.materials.skinColor),
      hairColor: canonicalHexColor(materialsIn.hairColor ?? DEFAULTS.materials.hairColor),
      roughness: clamp01(asFinite(materialsIn.roughness, DEFAULTS.materials.roughness)),
      metalness: clamp01(asFinite(materialsIn.metalness, DEFAULTS.materials.metalness)),
    },
    textures: {
      skinMap:
        typeof texturesIn?.skinMap === "string" && texturesIn.skinMap.trim()
          ? normalizeTextureSource(texturesIn.skinMap)
          : DEFAULTS.textures?.skinMap,
      clothingMap:
        typeof texturesIn?.clothingMap === "string" && texturesIn.clothingMap.trim()
          ? normalizeTextureSource(texturesIn.clothingMap)
          : DEFAULTS.textures?.clothingMap,
      maskMap:
        typeof texturesIn?.maskMap === "string" && texturesIn.maskMap.trim()
          ? normalizeTextureSource(texturesIn.maskMap)
          : DEFAULTS.textures?.maskMap,
    },
    postfx: {
      bloom: clamp01(asFinite(postfxIn.bloom, DEFAULTS.postfx.bloom)),
      ao: clamp01(asFinite(postfxIn.ao, DEFAULTS.postfx.ao)),
      smaa: asBoolean(postfxIn.smaa, DEFAULTS.postfx.smaa),
    },
    quality: {
      shadows: asBoolean(qualityIn.shadows, DEFAULTS.quality.shadows),
      shadowMapSize:
        qualityIn.shadowMapSize === 2048 || qualityIn.shadowMapSize === 1024
          ? qualityIn.shadowMapSize
          : DEFAULTS.quality.shadowMapSize,
    },
  };

  // `avatar_id` is intentionally excluded from `dna_hash` so identity is based on visual input.
  const dnaBody = {
    morphs: clean.morphs,
    materials: clean.materials,
    textures: clean.textures,
    postfx: clean.postfx,
    quality: clean.quality,
  };
  const dnaCanonical = canonicalJSONStringify(canonicalize(dnaBody, quantizeStep));
  const dna_hash = sha256HexString(dnaCanonical);

  const textures = await buildTextureManifest(clean.textures, opts);

  return {
    dna: clean,
    dna_hash,
    compile: {
      textures,
    },
  };
}
