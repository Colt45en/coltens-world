import fs from "node:fs";
import path from "node:path";
import { build, version as esbuildVersion } from "esbuild";
import type { CompileCacheContext, CompileManifest } from "./types";
import { ensureParentDir, readJsonFile, sha256File, sha256Hex, stableStringify, writeJsonFile } from "./helpers";

export type JsCompileFormat = "esm" | "cjs";

export interface JsCompileOptions extends CompileCacheContext {
  entry: string;
  outFile: string;
  platform: "browser" | "node";
  format: JsCompileFormat;
  sourcemap?: boolean;
  minify?: boolean;
  define?: Record<string, string>;
  external?: string[];
}

function cacheFilePath(cacheDir: string, cacheKey: string): string {
  return path.join(cacheDir, `${cacheKey}.manifest.json`);
}

function isCacheHit(manifest: CompileManifest): boolean {
  if (!manifest.outputs.every((output) => fs.existsSync(output))) return false;
  const [output] = manifest.outputs;
  if (!output) return false;
  return sha256File(output) === manifest.hash;
}

export async function compileJs(opts: JsCompileOptions): Promise<CompileManifest> {
  const absEntry = path.resolve(opts.entry);
  const absOut = path.resolve(opts.outFile);
  if (!fs.existsSync(absEntry)) throw new Error(`JS compile: entry not found: ${absEntry}`);

  const inputHash = sha256File(absEntry);
  const normalizedDefine = opts.define ?? {};
  const normalizedExternal = (opts.external ?? []).slice().sort();
  const keyPayload = {
    tool: "compiler.js",
    compiler: `esbuild@${esbuildVersion}`,
    entry: absEntry,
    outFile: absOut,
    platform: opts.platform,
    format: opts.format,
    sourcemap: Boolean(opts.sourcemap),
    minify: Boolean(opts.minify),
    define: normalizedDefine,
    external: normalizedExternal,
    inputHash,
  };

  const cacheKey = sha256Hex(stableStringify(keyPayload));
  const cacheDir = path.resolve(opts.cacheDir ?? ".cache/world-engine/compile/js");
  const cachePath = cacheFilePath(cacheDir, cacheKey);
  const cached = readJsonFile<CompileManifest>(cachePath);
  if (cached && isCacheHit(cached)) {
    return { ...cached, cacheHit: true, cacheKey };
  }

  ensureParentDir(absOut);
  await build({
    entryPoints: [absEntry],
    outfile: absOut,
    bundle: true,
    platform: opts.platform,
    format: opts.format,
    sourcemap: opts.sourcemap ?? false,
    minify: opts.minify ?? false,
    define: normalizedDefine,
    external: normalizedExternal,
    legalComments: "none",
    charset: "utf8",
    logLevel: "silent",
  });

  const outHash = sha256File(absOut);
  const manifest: CompileManifest = {
    tool: "compiler.js",
    inputs: [absEntry],
    outputs: [absOut],
    deterministic: true,
    hash: outHash,
    timestamp: new Date(0).toISOString(),
    cacheKey,
    cacheHit: false,
  };

  writeJsonFile(cachePath, manifest);
  return manifest;
}
