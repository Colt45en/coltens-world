import path from "node:path";
import { compileJs } from "./compilers/jsCompiler";
import { compileCs } from "./compilers/csCompiler";
import type { CompileManifest } from "./compilers/types";
import { ensureDir, writeJsonFile } from "./compilers/helpers";

type Mode = "js" | "cs" | "both";

interface ParsedArgs {
  mode: Mode;
  entry?: string;
  outFile?: string;
  platform: "browser" | "node";
  format: "esm" | "cjs";
  sourcemap: boolean;
  minify: boolean;
  external: string[];
  csproj?: string;
  configuration: "Debug" | "Release";
  framework?: string;
  manifestDir: string;
  cacheDir?: string;
}

function parseBooleanFlag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function usage(): string {
  return [
    "Usage:",
    "  pnpm --filter @world-engine/tooling run compile -- js --entry <path> --out-file <path> [--platform browser|node] [--format esm|cjs]",
    "  pnpm --filter @world-engine/tooling run compile -- cs --csproj <path> [--configuration Debug|Release] [--framework <tfm>]",
    "  pnpm --filter @world-engine/tooling run compile -- both --entry <path> --out-file <path> --csproj <path> [options]",
  ].join("\n");
}

function parseArgs(argv: string[]): ParsedArgs {
  const normalizedArgv = argv[0] === "--" ? argv.slice(1) : argv;
  const [modeRaw, ...rest] = normalizedArgv;
  if (!modeRaw || !["js", "cs", "both"].includes(modeRaw)) {
    throw new Error(usage());
  }

  const parsed: ParsedArgs = {
    mode: modeRaw as Mode,
    platform: "browser",
    format: "esm",
    sourcemap: false,
    minify: false,
    configuration: "Release",
    external: [],
    manifestDir: "tooling-dist/compile",
  };

  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    const value = rest[i + 1];
    switch (token) {
      case "--entry":
        if (value !== undefined) parsed.entry = value;
        i += 1;
        break;
      case "--out-file":
        if (value !== undefined) parsed.outFile = value;
        i += 1;
        break;
      case "--platform":
        if (value === "browser" || value === "node") parsed.platform = value;
        i += 1;
        break;
      case "--format":
        if (value === "esm" || value === "cjs") parsed.format = value;
        i += 1;
        break;
      case "--sourcemap":
        parsed.sourcemap = parseBooleanFlag(value, true);
        if (value && !value.startsWith("--")) i += 1;
        break;
      case "--minify":
        parsed.minify = parseBooleanFlag(value, true);
        if (value && !value.startsWith("--")) i += 1;
        break;
      case "--external":
        if (value) parsed.external?.push(value);
        i += 1;
        break;
      case "--csproj":
        if (value !== undefined) parsed.csproj = value;
        i += 1;
        break;
      case "--configuration":
        if (value === "Debug" || value === "Release") parsed.configuration = value;
        i += 1;
        break;
      case "--framework":
        if (value !== undefined) parsed.framework = value;
        i += 1;
        break;
      case "--manifest-dir":
        if (value !== undefined) parsed.manifestDir = value;
        i += 1;
        break;
      case "--cache-dir":
        if (value !== undefined) parsed.cacheDir = value;
        i += 1;
        break;
      default:
        throw new Error(`Unknown option: ${token}\n${usage()}`);
    }
  }

  if ((parsed.mode === "js" || parsed.mode === "both") && (!parsed.entry || !parsed.outFile)) {
    throw new Error(`JS compile requires --entry and --out-file\n${usage()}`);
  }
  if ((parsed.mode === "cs" || parsed.mode === "both") && !parsed.csproj) {
    throw new Error(`C# compile requires --csproj\n${usage()}`);
  }

  return parsed;
}

function manifestPath(dirPath: string, fileName: string): string {
  const resolved = path.resolve(dirPath);
  ensureDir(resolved);
  return path.join(resolved, fileName);
}

function emitManifest(manifest: CompileManifest): void {
  process.stdout.write(`${JSON.stringify(manifest)}\n`);
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  const manifests: CompileManifest[] = [];
  const manifestDir = path.resolve(parsed.manifestDir);

  if (parsed.mode === "js" || parsed.mode === "both") {
    const jsOpts = {
      entry: parsed.entry as string,
      outFile: parsed.outFile as string,
      platform: parsed.platform as "browser" | "node",
      format: parsed.format as "esm" | "cjs",
      sourcemap: parsed.sourcemap,
      minify: parsed.minify,
      external: parsed.external,
    };
    if (parsed.cacheDir) {
      Object.assign(jsOpts, { cacheDir: path.join(parsed.cacheDir, "js") });
    }
    const jsManifest = await compileJs(jsOpts);
    writeJsonFile(manifestPath(manifestDir, "js.manifest.json"), jsManifest);
    manifests.push(jsManifest);
  }

  if (parsed.mode === "cs" || parsed.mode === "both") {
    const csOpts = {
      csproj: parsed.csproj as string,
      configuration: parsed.configuration,
    };
    if (parsed.framework) {
      Object.assign(csOpts, { framework: parsed.framework });
    }
    if (parsed.cacheDir) {
      Object.assign(csOpts, { cacheDir: path.join(parsed.cacheDir, "cs") });
    }
    const csManifest = await compileCs(csOpts);
    writeJsonFile(manifestPath(manifestDir, "cs.manifest.json"), csManifest);
    manifests.push(csManifest);
  }

  for (const manifest of manifests) {
    emitManifest(manifest);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
