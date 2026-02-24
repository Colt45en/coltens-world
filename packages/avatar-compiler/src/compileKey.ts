import type { NormalizedAvatarDNA, TextureManifestEntry } from "./avatarDNA.js";
import { sha256HexString } from "./hash.js";

export const AVATAR_COMPILER_VERSION = "avatar-compiler@0.1.0";

export type CompileKeySettings = {
  atlasSize: number;
  lodLevels: number;
  embedTextures: "blobs" | "atlas";
  meshCompression: "none" | "meshopt";
};

export type CompileKey = {
  schema: 1;
  compiler_version: string;
  dna_hash: string;
  textures: Array<Pick<TextureManifestEntry, "slot" | "bytes_hash" | "bytes_len" | "source">>;
  settings: CompileKeySettings;
};

export type CompileKeyResult = {
  key: CompileKey;
  key_json: string;
  key_hash: string;
};

export function makeCompileKey(
  normalized: NormalizedAvatarDNA,
  settings: Partial<CompileKeySettings> = {},
  compilerVersion: string = AVATAR_COMPILER_VERSION,
): CompileKeyResult {
  const s: CompileKeySettings = {
    atlasSize: settings.atlasSize ?? 2048,
    lodLevels: settings.lodLevels ?? 4,
    embedTextures: settings.embedTextures ?? "atlas",
    meshCompression: settings.meshCompression ?? "none",
  };

  const textures = normalized.compile.textures.map((t) => ({
    slot: t.slot,
    source: t.source,
    bytes_hash: t.bytes_hash,
    bytes_len: t.bytes_len,
  }));

  const key: CompileKey = {
    schema: 1,
    compiler_version: compilerVersion,
    dna_hash: normalized.dna_hash,
    textures,
    settings: s,
  };

  const key_json = JSON.stringify(key);
  const key_hash = sha256HexString(key_json);

  return { key, key_json, key_hash };
}

