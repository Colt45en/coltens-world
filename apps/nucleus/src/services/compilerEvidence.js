import { BuildEvidencePacketSchema, } from "@world-engine/protocol";
import { execFile as _execFile } from "node:child_process";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { promisify } from "node:util";
const execFile = promisify(_execFile);
function toPosix(p) {
    return p.split(path.sep).join("/");
}
function sha256(buf) {
    return createHash("sha256").update(buf).digest("hex");
}
/**
 * Canonical JSON (stable keys + stable ordering) so hashes are deterministic.
 */
function canonicalize(value) {
    const seen = new WeakSet();
    const norm = (v) => {
        if (v === null || typeof v !== "object")
            return v;
        if (seen.has(v))
            throw new Error("Cannot canonicalize circular structure");
        seen.add(v);
        if (Array.isArray(v))
            return v.map(norm);
        const keys = Object.keys(v).sort();
        const out = {};
        for (const k of keys)
            out[k] = norm(v[k]);
        return out;
    };
    return JSON.stringify(norm(value));
}
async function listFilesRecursive(dirAbs) {
    const out = [];
    const stack = [dirAbs];
    while (stack.length) {
        const cur = stack.pop();
        const entries = await fs.promises.readdir(cur, { withFileTypes: true });
        for (const e of entries) {
            const p = path.join(cur, e.name);
            if (e.isDirectory())
                stack.push(p);
            else if (e.isFile())
                out.push(p);
        }
    }
    out.sort(); // stable
    return out;
}
async function hashOutputs(outDirAbs, baseForRel) {
    const files = (await listFilesRecursive(outDirAbs)).filter((p) => {
        // ignore source maps if you want strictness; keep them by default
        return true;
    });
    const outputs = [];
    for (const fAbs of files) {
        const buf = await fs.promises.readFile(fAbs);
        const rel = toPosix(path.relative(baseForRel, fAbs));
        outputs.push({
            path: rel,
            bytes: buf.byteLength,
            sha256: sha256(buf),
        });
    }
    // stable list -> bundle_hash
    const bundle_hash = sha256(canonicalize(outputs));
    return { outputs, bundle_hash };
}
async function runTypecheck(buildRootAbs) {
    // Deterministic and standard: tsc --noEmit.
    // Uses local workspace tsc resolution via pnpm dlx? No: prefer project-local node_modules/.bin/tsc if present.
    const tscBin = process.platform === "win32"
        ? path.join(buildRootAbs, "node_modules", ".bin", "tsc.cmd")
        : path.join(buildRootAbs, "node_modules", ".bin", "tsc");
    const fallback = "tsc";
    const bin = fs.existsSync(tscBin) ? tscBin : fallback;
    try {
        const { stdout, stderr } = await execFile(bin, ["--noEmit"], { cwd: buildRootAbs });
        const out = `${stdout ?? ""}\n${stderr ?? ""}`.trim();
        return { ran: true, passed: true, errors: out ? [out] : [] };
    }
    catch (err) {
        const stdout = err?.stdout?.toString?.() ?? "";
        const stderr = err?.stderr?.toString?.() ?? "";
        const msg = `${stdout}\n${stderr}`.trim() || String(err?.message ?? err);
        return { ran: true, passed: false, errors: [msg] };
    }
}
async function tryReadJson(pAbs) {
    try {
        const txt = await fs.promises.readFile(pAbs, "utf8");
        return JSON.parse(txt);
    }
    catch {
        return null;
    }
}
function moduleGraphFromViteManifest(manifest) {
    // Vite manifest shape: key -> { file, imports?, dynamicImports?, isEntry? ... }
    const imports = {};
    const entrypoints = [];
    const keys = Object.keys(manifest ?? {}).sort();
    let edges = 0;
    for (const k of keys) {
        const m = manifest[k];
        const deps = [];
        for (const arrKey of ["imports", "dynamicImports"]) {
            const arr = m?.[arrKey];
            if (Array.isArray(arr))
                deps.push(...arr);
        }
        const dedup = Array.from(new Set(deps)).sort();
        imports[k] = dedup;
        edges += dedup.length;
        if (m?.isEntry)
            entrypoints.push(k);
    }
    return {
        kind: "vite-manifest",
        nodes: keys.length,
        edges,
        entrypoints: entrypoints.sort(),
        imports,
    };
}
function moduleGraphFromEsbuildMetafile(meta) {
    // esbuild metafile: { inputs: { ... }, outputs: { ... } }
    const inputs = meta?.inputs ?? {};
    const keys = Object.keys(inputs).sort();
    const imports = {};
    let edges = 0;
    for (const k of keys) {
        const imps = inputs[k]?.imports ?? [];
        const deps = imps.map((x) => x?.path).filter(Boolean);
        const dedup = Array.from(new Set(deps)).sort();
        imports[k] = dedup;
        edges += dedup.length;
    }
    const entrypoints = Object.values(meta?.outputs ?? {})
        .flatMap((o) => Array.isArray(o?.entryPoint) ? o.entryPoint : o?.entryPoint ? [o.entryPoint] : [])
        .filter(Boolean);
    return {
        kind: "esbuild-metafile",
        nodes: keys.length,
        edges,
        entrypoints: Array.from(new Set(entrypoints)).sort(),
        imports,
    };
}
async function runViteBuild(buildRootAbs, mode, outDirRel) {
    // Use CLI so we don't depend on Vite internals differing by version.
    const viteBin = process.platform === "win32"
        ? path.join(buildRootAbs, "node_modules", ".bin", "vite.cmd")
        : path.join(buildRootAbs, "node_modules", ".bin", "vite");
    const fallback = "vite";
    const bin = fs.existsSync(viteBin) ? viteBin : fallback;
    try {
        await execFile(bin, ["build", "--mode", mode, "--outDir", outDirRel], {
            cwd: buildRootAbs,
        });
        return { ok: true, errors: [] };
    }
    catch (err) {
        const stdout = err?.stdout?.toString?.() ?? "";
        const stderr = err?.stderr?.toString?.() ?? "";
        const msg = `${stdout}\n${stderr}`.trim() || String(err?.message ?? err);
        return { ok: false, errors: [msg] };
    }
}
async function runSingleFileEsbuild(buildRootAbs, mode, outDirAbs) {
    // Deterministic single-file: we expect a script under tooling/test-compilers.mjs to call this service,
    // but Nucleus can also run esbuild directly if installed at repo root.
    const esbuildBin = process.platform === "win32"
        ? path.join(buildRootAbs, "node_modules", ".bin", "esbuild.cmd")
        : path.join(buildRootAbs, "node_modules", ".bin", "esbuild");
    const fallback = "esbuild";
    const bin = fs.existsSync(esbuildBin) ? esbuildBin : fallback;
    // input: single entry html/ts is user-defined; we default to index.html if present, else src/main.ts
    const entryHtml = path.join(buildRootAbs, "index.html");
    const entryTs = path.join(buildRootAbs, "src", "main.ts");
    const entry = fs.existsSync(entryHtml) ? entryHtml : entryTs;
    await fs.promises.mkdir(outDirAbs, { recursive: true });
    const outFile = path.join(outDirAbs, "singlefile.js");
    const metaFile = path.join(outDirAbs, "esbuild.meta.json");
    try {
        // esbuild can bundle TS entry; for HTML entry, esbuild treats as loader=copy unless plugins.
        // So for reliability: if HTML exists, build the TS entry instead.
        const realEntry = fs.existsSync(entryHtml) ? entryTs : entry;
        await execFile(bin, [
            realEntry,
            "--bundle",
            "--platform=browser",
            "--format=esm",
            "--sourcemap=false",
            "--minify=false",
            "--log-level=warning",
            `--define:process.env.NODE_ENV="${mode}"`,
            `--outfile=${outFile}`,
            `--metafile=${metaFile}`,
        ], { cwd: buildRootAbs });
        return { ok: true, errors: [], metafilePath: metaFile };
    }
    catch (err) {
        const stdout = err?.stdout?.toString?.() ?? "";
        const stderr = err?.stderr?.toString?.() ?? "";
        const msg = `${stdout}\n${stderr}`.trim() || String(err?.message ?? err);
        return { ok: false, errors: [msg] };
    }
}
function stablePacketId(compiler, buildRootAbs, mode, bundleHash) {
    // Deterministic id; no timestamps. Keep it URL-safe.
    const base = `${compiler}:${toPosix(buildRootAbs)}:${mode}:${bundleHash}`;
    const h = sha256(base).slice(0, 16);
    return `be_${compiler}_${h}`;
}
async function buildOnce(compiler, opts) {
    const mode = opts.mode ?? "production";
    const outDirRel = opts.outDir ?? "dist";
    const repoRootAbs = opts.repoRoot;
    const buildRootAbs = opts.buildRoot;
    const outDirAbs = path.isAbsolute(outDirRel)
        ? outDirRel
        : path.join(buildRootAbs, outDirRel);
    // wipe outDir for determinism
    if (fs.existsSync(outDirAbs))
        await fs.promises.rm(outDirAbs, { recursive: true, force: true });
    await fs.promises.mkdir(outDirAbs, { recursive: true });
    const typecheck = opts.runTypecheck
        ? await runTypecheck(buildRootAbs)
        : { ran: false, passed: true, errors: [] };
    let ok = true;
    let buildErrors = [];
    let module_graph = {
        kind: "none",
        nodes: 0,
        edges: 0,
        entrypoints: [],
        imports: {},
    };
    if (compiler === "vite") {
        const r = await runViteBuild(buildRootAbs, mode, outDirRel);
        ok = r.ok;
        buildErrors = r.errors;
        // try manifest.json for module graph
        const manifestAbs = path.join(outDirAbs, ".vite", "manifest.json");
        const manifestAbsAlt = path.join(outDirAbs, "manifest.json");
        const manifest = (await tryReadJson(manifestAbs)) ?? (await tryReadJson(manifestAbsAlt));
        if (manifest)
            module_graph = moduleGraphFromViteManifest(manifest);
    }
    else {
        const r = await runSingleFileEsbuild(buildRootAbs, mode, outDirAbs);
        ok = r.ok;
        buildErrors = r.errors;
        if (r.metafilePath) {
            const meta = await tryReadJson(r.metafilePath);
            if (meta)
                module_graph = moduleGraphFromEsbuildMetafile(meta);
        }
    }
    const { outputs, bundle_hash } = await hashOutputs(outDirAbs, repoRootAbs);
    const status = ok && typecheck.passed ? "passed" : "failed";
    const packet = {
        schemaVersion: "1.0.0",
        id: stablePacketId(compiler, buildRootAbs, mode, bundle_hash),
        ts: new Date().toISOString(),
        compiler,
        status,
        repoRoot: toPosix(repoRootAbs),
        buildRoot: toPosix(buildRootAbs),
        outDir: toPosix(outDirAbs),
        mode,
        typecheck,
        outputs,
        bundle_hash,
        module_graph,
        buildErrors,
        determinism: { ranTwice: false, hashStable: false },
    };
    // validate (crash early if malformed)
    BuildEvidencePacketSchema.parse(packet);
    return packet;
}
export async function generateBuildEvidence(opts) {
    const first = await buildOnce(opts.compiler, opts);
    if (!opts.runTwice)
        return first;
    const second = await buildOnce(opts.compiler, opts);
    const hashStable = first.bundle_hash === second.bundle_hash;
    const merged = {
        ...first,
        determinism: {
            ranTwice: true,
            hashStable,
            first_hash: first.bundle_hash,
            second_hash: second.bundle_hash,
        },
        // if second build failed but first passed, keep first as primary but include error
        status: hashStable && first.status === "passed" && second.status === "passed"
            ? "passed"
            : "failed",
        buildErrors: Array.from(new Set([...(first.buildErrors ?? []), ...(second.buildErrors ?? [])])),
    };
    BuildEvidencePacketSchema.parse(merged);
    return merged;
}
/**
 * Write packet as canonical JSON to disk (stable).
 */
export async function writeBuildEvidencePacket(packet, outPathAbs) {
    const dir = path.dirname(outPathAbs);
    await fs.promises.mkdir(dir, { recursive: true });
    const txt = canonicalize(packet) + "\n";
    await fs.promises.writeFile(txt, txt, "utf8");
}
