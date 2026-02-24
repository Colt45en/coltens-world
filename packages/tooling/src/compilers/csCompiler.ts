import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import type { CompileCacheContext, CompileManifest } from "./types";
import { readJsonFile, sha256File, sha256Hex, stableStringify, writeJsonFile } from "./helpers";

export interface CsCompileOptions extends CompileCacheContext {
  csproj: string;
  configuration?: "Debug" | "Release";
  framework?: string;
}

interface ProcessResult {
  code: number;
  stdout: string;
  stderr: string;
}

function run(command: string, args: string[], cwd?: string): Promise<ProcessResult> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });
    proc.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });
    proc.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

function tryReadFrameworkFromProject(csprojAbs: string): string | undefined {
  try {
    const xml = fs.readFileSync(csprojAbs, "utf8");
    const tfMatch = xml.match(/<TargetFramework>\s*([^<\s]+)\s*<\/TargetFramework>/i);
    if (tfMatch?.[1]) return tfMatch[1];
    const tfsMatch = xml.match(/<TargetFrameworks>\s*([^<]+)\s*<\/TargetFrameworks>/i);
    if (tfsMatch?.[1]) {
      const first = tfsMatch[1].split(";").map((item) => item.trim()).find(Boolean);
      if (first) return first;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function findDllOut(csprojAbs: string, configuration: string, framework?: string): string {
  const projDir = path.dirname(csprojAbs);
  const projName = path.basename(csprojAbs, ".csproj");
  const base = path.join(projDir, "bin", configuration);
  const resolvedFramework = framework ?? tryReadFrameworkFromProject(csprojAbs);
  if (resolvedFramework) {
    return path.join(base, resolvedFramework, `${projName}.dll`);
  }
  if (!fs.existsSync(base)) {
    throw new Error(`C# compile: missing output folder: ${base}`);
  }
  const subdirs = fs.readdirSync(base, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  const [firstSubdir] = subdirs;
  if (!firstSubdir) {
    throw new Error(`C# compile: could not find framework folder under ${base}`);
  }
  return path.join(base, firstSubdir.name, `${projName}.dll`);
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

export async function compileCs(opts: CsCompileOptions): Promise<CompileManifest> {
  const csprojAbs = path.resolve(opts.csproj);
  if (!fs.existsSync(csprojAbs)) {
    throw new Error(`C# compile: csproj not found: ${csprojAbs}`);
  }

  const configuration = opts.configuration ?? "Release";
  const inputHash = sha256File(csprojAbs);
  const keyPayload = {
    tool: "compiler.cs",
    compiler: "dotnet",
    csproj: csprojAbs,
    configuration,
    framework: opts.framework ?? null,
    inputHash,
  };
  const cacheKey = sha256Hex(stableStringify(keyPayload));
  const cacheDir = path.resolve(opts.cacheDir ?? ".cache/world-engine/compile/cs");
  const cachePath = cacheFilePath(cacheDir, cacheKey);
  const cached = readJsonFile<CompileManifest>(cachePath);
  if (cached && isCacheHit(cached)) {
    return { ...cached, cacheHit: true, cacheKey };
  }

  const args = [
    "build",
    csprojAbs,
    "-c",
    configuration,
    "-p:Deterministic=true",
    "-p:ContinuousIntegrationBuild=true",
    "-nologo",
    "-v",
    "minimal",
  ];
  if (opts.framework) {
    args.push("-f", opts.framework);
  }

  const result = await run("dotnet", args, path.dirname(csprojAbs));
  if (result.code !== 0) {
    throw new Error(`dotnet build failed (${result.code})\n${result.stdout}\n${result.stderr}`);
  }

  const dllPath = findDllOut(csprojAbs, configuration, opts.framework);
  if (!fs.existsSync(dllPath)) {
    throw new Error(`C# compile: output dll not found: ${dllPath}`);
  }

  const outHash = sha256File(dllPath);
  const manifest: CompileManifest = {
    tool: "compiler.cs",
    inputs: [csprojAbs],
    outputs: [dllPath],
    deterministic: true,
    hash: outHash,
    timestamp: new Date(0).toISOString(),
    cacheKey,
    cacheHit: false,
  };

  writeJsonFile(cachePath, manifest);
  return manifest;
}
