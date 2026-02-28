#!/usr/bin/env node
//
// tooling/boundary/check-imports.mjs
//
// Boundary enforcement: prevents cross-boundary imports
// - No app → app imports
// - No deep imports into another package's src/dist
// - Only @world-engine/<pkg> public entrypoints allowed
// - No importing generated outputs directly
//
// Usage: pnpm run boundary:check (or node tooling/boundary/check-imports.mjs)

import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const FAIL = [];

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function norm(p) {
  return p.replace(/\\/g, "/");
}

function isInside(rel, prefix) {
  return rel === prefix || rel.startsWith(prefix + "/");
}

function loadTsConfig(tsconfigPath) {
  const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  if (configFile.error) {
    throw new Error(
      ts.formatDiagnosticsWithColorAndContext([configFile.error], diagHost())
    );
  }
  const parsed = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(tsconfigPath)
  );
  return parsed;
}

function diagHost() {
  return {
    getCanonicalFileName: (f) => f,
    getCurrentDirectory: () => ROOT,
    getNewLine: () => "\n",
  };
}

function listTsFiles(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(d, e.name);
      const rel = norm(path.relative(ROOT, full));
      if (rel.startsWith("node_modules/")) continue;
      if (rel.includes("/dist/") || rel.includes("/build/")) continue;
      if (rel.startsWith("runtime/") || rel.startsWith("artifacts/")) continue;

      if (e.isDirectory()) stack.push(full);
      else if (
        e.isFile() &&
        (rel.endsWith(".ts") ||
          rel.endsWith(".tsx") ||
          rel.endsWith(".mts") ||
          rel.endsWith(".cts"))
      ) {
        out.push(full);
      }
    }
  }
  out.sort((a, b) =>
    norm(path.relative(ROOT, a)).localeCompare(norm(path.relative(ROOT, b)))
  );
  return out;
}

function classifyOwner(fileRel) {
  // owner: { kind: "app"|"pkg"|"other", name?: string }
  const parts = fileRel.split("/");
  if (parts[0] === "apps" && parts.length >= 2)
    return { kind: "app", name: parts[1] };
  if (parts[0] === "packages" && parts.length >= 2)
    return { kind: "pkg", name: parts[1] };
  return { kind: "other" };
}

function isPublicWorkspaceImport(spec) {
  // Allowed cross-boundary import form
  // @world-engine/<pkg> or @world-engine/<pkg>/types
  return /^@world-engine\/[a-z0-9-]+(\/types)?$/i.test(spec);
}

function isForbiddenDeepWorkspaceImport(spec) {
  // Explicitly block deep imports across packages
  return (
    /^@world-engine\/[a-z0-9-]+\/(src|dist|test|tests|internal)\//i.test(spec) ||
    spec.startsWith("packages/") ||
    spec.startsWith("apps/")
  );
}

function main() {
  const tsconfigPath = path.join(ROOT, "tsconfig.json");
  if (!fs.existsSync(tsconfigPath)) {
    console.warn(
      "⚠️  tsconfig.json not found at repo root; trying tsconfig.base.json"
    );
    if (!fs.existsSync(path.join(ROOT, "tsconfig.base.json"))) {
      console.warn(
        "⚠️  Neither tsconfig.json nor tsconfig.base.json found; skipping boundary check"
      );
      return;
    }
  }

  const tsconfigToUse = fs.existsSync(tsconfigPath)
    ? tsconfigPath
    : path.join(ROOT, "tsconfig.base.json");

  const parsed = loadTsConfig(tsconfigToUse);
  const compilerOptions = parsed.options;

  const host = ts.createCompilerHost(compilerOptions, true);
  const files = [
    ...listTsFiles(path.join(ROOT, "apps")),
    ...listTsFiles(path.join(ROOT, "packages")),
  ];

  const program = ts.createProgram(files, compilerOptions, host);

  for (const sf of program.getSourceFiles()) {
    const fileName = sf.fileName;
    if (!norm(fileName).startsWith(norm(ROOT))) continue;

    const fileRel = norm(path.relative(ROOT, fileName));
    const owner = classifyOwner(fileRel);
    if (owner.kind === "other") continue;

    sf.forEachChild((node) => {
      if (
        !ts.isImportDeclaration(node) &&
        !ts.isExportDeclaration(node)
      )
        return;

      const specNode = node.moduleSpecifier;
      if (!specNode || !ts.isStringLiteral(specNode)) return;

      const spec = specNode.text;

      // allow node builtins and external deps
      if (
        !spec.startsWith(".") &&
        !spec.startsWith("@world-engine/") &&
        !spec.startsWith("apps/") &&
        !spec.startsWith("packages/")
      ) {
        return;
      }

      // block deep workspace imports
      if (isForbiddenDeepWorkspaceImport(spec)) {
        const line = sf.getLineAndCharacterOfPosition(specNode.getStart()).line + 1;
        FAIL.push(
          `${fileRel}:${line} forbidden deep import: "${spec}"`
        );
        return;
      }

      // if cross-workspace import, must be public entrypoint
      if (spec.startsWith("@world-engine/") && !isPublicWorkspaceImport(spec)) {
        const line = sf.getLineAndCharacterOfPosition(specNode.getStart()).line + 1;
        FAIL.push(
          `${fileRel}:${line} non-public workspace import: "${spec}"`
        );
        return;
      }

      // resolve relative imports and ensure they stay within the same owner boundary
      if (spec.startsWith(".")) {
        const resolved = ts.resolveModuleName(
          spec,
          fileName,
          compilerOptions,
          host
        ).resolvedModule;
        if (!resolved) return;

        const targetRel = norm(
          path.relative(ROOT, resolved.resolvedFileName)
        );
        const targetOwner = classifyOwner(targetRel);

        const line = sf.getLineAndCharacterOfPosition(specNode.getStart()).line + 1;

        if (owner.kind === "app") {
          // app relative import must stay within same app
          if (targetOwner.kind === "app" && targetOwner.name !== owner.name) {
            FAIL.push(
              `${fileRel}:${line} app→app import not allowed: "${spec}" -> ${targetRel}`
            );
          }
          if (targetOwner.kind === "pkg") {
            FAIL.push(
              `${fileRel}:${line} app must import packages via @world-engine/*, not relative: "${spec}" -> ${targetRel}`
            );
          }
        }

        if (owner.kind === "pkg") {
          // package relative import must stay within same package
          if (targetOwner.kind === "pkg" && targetOwner.name !== owner.name) {
            FAIL.push(
              `${fileRel}:${line} pkg→pkg import not allowed via relative path: "${spec}" -> ${targetRel}`
            );
          }
          if (targetOwner.kind === "app") {
            FAIL.push(
              `${fileRel}:${line} package importing app is not allowed: "${spec}" -> ${targetRel}`
            );
          }
        }

        // ban dist/build direct imports regardless
        if (targetRel.includes("/dist/") || targetRel.includes("/build/")) {
          FAIL.push(
            `${fileRel}:${line} must not import dist/build outputs: "${spec}" -> ${targetRel}`
          );
        }
      }
    });
  }

  if (FAIL.length) {
    console.error("❌ Boundary Check FAILED:");
    for (const f of FAIL) console.error("   - " + f);
    process.exit(1);
  }

  console.log("✅ Boundary Check OK");
}

main();
