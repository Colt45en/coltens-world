import fs from "node:fs/promises";
import path from "node:path";

import type { AvatarDNA } from "./avatarDNA.js";
import { normalizeAvatarDNA } from "./avatarDNA.js";
import { assertValidAvatarDNA } from "./validate.js";
import { makeCompileKey } from "./compileKey.js";
import { compileBatch } from "./compiler.js";
import { AVATAR_DNA_PRESET_JOBS } from "./presets.js";

type AvatarJobInput =
  | AvatarDNA
  | { avatar_id: string; dna: AvatarDNA }
  | ({ avatar_id: string } & AvatarDNA);

function arg(name: string, def?: string) {
  const i = process.argv.indexOf(name);
  if (i === -1) return def;
  return process.argv[i + 1] ?? def;
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function extractJob(item: unknown): { avatar_id?: string; dna: unknown } {
  if (!isObject(item)) return { dna: item };

  if ("dna" in item) {
    return {
      avatar_id: typeof item.avatar_id === "string" ? item.avatar_id : undefined,
      dna: item.dna,
    };
  }

  const maybeId = typeof item.avatar_id === "string" ? item.avatar_id : undefined;
  const { avatar_id: _ignored, ...rest } = item;
  return { avatar_id: maybeId, dna: rest };
}

type RegistryEntryV2 = {
  avatar_id: string;
  content_hash: string;
  dna_hash: string;
  compile_key_hash: string;
  file_size: number;
  poly_count: number;
  bounds: { min: [number, number, number]; max: [number, number, number] };
  textures: Array<{ slot: string; bytes_hash: string; bytes_len: number; source: string }>;
};

type AssetRegistryV2 = {
  version: 2;
  generated_at_unix_ms: number;
  by_content_hash: Record<string, RegistryEntryV2>;
};

async function main() {
  const input = arg("--input");
  const outDir = arg("--output", "./avatars_out")!;
  const assetsRoot = arg("--assets-root");
  const atlasSize = Number(arg("--atlas-size", "2048"));
  const lodLevels = Number(arg("--lod-levels", "4"));

  const requireTextures = hasFlag("--require-textures");
  const strict = hasFlag("--strict");
  const usePresets = hasFlag("--presets");

  if (!input && !usePresets) {
    console.error(
      "Usage: tsx src/cli.ts (--input avatars.json | --presets) --assets-root <dir> [--output ./avatars_out] [--atlas-size 2048] [--lod-levels 4] [--require-textures] [--strict]",
    );
    process.exit(1);
  }
  if (!assetsRoot) {
    console.error("Missing required: --assets-root <dir>  (point to public/ or assets/)");
    process.exit(1);
  }

  let arr: AvatarJobInput[];
  if (usePresets) {
    arr = AVATAR_DNA_PRESET_JOBS.map((job) => ({ avatar_id: job.avatar_id, dna: { ...job.dna } }));
  } else {
    const raw = await fs.readFile(input!, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error(`Input must be a JSON array. Got: ${typeof parsed}`);
    }
    arr = parsed as AvatarJobInput[];
  }

  const prepared: Array<{
    avatar_id: string;
    dna: AvatarDNA;
    dna_hash: string;
    compile_key_hash: string;
    compile_key_json: string;
    textures: RegistryEntryV2["textures"];
  }> = [];

  for (let i = 0; i < arr.length; i++) {
    const { avatar_id, dna } = extractJob(arr[i]);

    assertValidAvatarDNA(dna, { strict });

    const normalized = await normalizeAvatarDNA(dna as AvatarDNA, {
      assetsRoot,
      requireTextures,
    });

    const { key, key_json, key_hash } = makeCompileKey(normalized, {
      atlasSize,
      lodLevels,
      embedTextures: "atlas",
      meshCompression: "none",
    });

    const stableId = avatar_id ?? `dna_${normalized.dna_hash.slice(0, 12)}`;

    prepared.push({
      avatar_id: stableId,
      dna: { ...normalized.dna, avatar_id: stableId },
      dna_hash: normalized.dna_hash,
      compile_key_hash: key_hash,
      compile_key_json: key_json,
      textures: key.textures.map((t) => ({
        slot: t.slot,
        bytes_hash: t.bytes_hash,
        bytes_len: t.bytes_len,
        source: t.source,
      })),
    });
  }

  prepared.sort((a, b) => a.avatar_id.localeCompare(b.avatar_id));

  await fs.mkdir(outDir, { recursive: true });

  const compiled = await compileBatch(
    prepared.map((p) => ({ avatar_id: p.avatar_id, dna: p.dna })),
    { assetsRoot, atlasSize, lodLevels, requireTextures },
  );

  const registry: AssetRegistryV2 = {
    version: 2,
    generated_at_unix_ms: Date.now(),
    by_content_hash: {},
  };

  let ok = 0;
  for (let i = 0; i < compiled.length; i++) {
    const a = compiled[i];
    const prep = prepared.find((p) => p.avatar_id === a.avatar_id);
    if (!prep) throw new Error(`Internal: missing prepared entry for avatar_id=${a.avatar_id}`);

    const base = path.join(outDir, a.content_hash);
    await fs.writeFile(`${base}.bin`, a.bytes);
    await fs.writeFile(`${base}.json`, JSON.stringify(a.metadata, null, 2));
    await fs.writeFile(
      `${base}.key.json`,
      JSON.stringify(
        {
          avatar_id: a.avatar_id,
          dna_hash: prep.dna_hash,
          compile_key_hash: prep.compile_key_hash,
          compile_key: JSON.parse(prep.compile_key_json),
        },
        null,
        2,
      ),
    );

    registry.by_content_hash[a.content_hash] = {
      avatar_id: a.avatar_id,
      content_hash: a.content_hash,
      dna_hash: prep.dna_hash,
      compile_key_hash: prep.compile_key_hash,
      file_size: a.metadata.file_size,
      poly_count: a.metadata.poly_count,
      bounds: a.metadata.bounds,
      textures: prep.textures,
    };

    ok++;
    if (!hasFlag("--quiet")) {
      console.log(
        `[${i + 1}/${compiled.length}] ${a.avatar_id} -> ${a.content_hash.slice(0, 16)}... key=${prep.compile_key_hash.slice(0, 16)}...`,
      );
    }
  }

  await fs.writeFile(path.join(outDir, "registry.json"), JSON.stringify(registry, null, 2));
  console.log(`Compiled ${ok}/${compiled.length} avatars -> ${outDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
