#!/usr/bin/env node
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { readAuditSince } from "./audit.js";
import { EnvCodexSchema } from "./contracts.js";
import { EnvSandbox } from "./sandbox.js";
import { resolveStoragePaths } from "./storage.js";
import { LayerNameSchema } from "./types.js";
function die(msg, code = 1) {
    console.error(msg);
    process.exit(code);
}
function usage() {
    console.log(`
env-sandbox-tools (next tier)

Core:
  init
  layer get
  layer set <prime|subtle|material|data-plane>
  get [--effective] [--layer <layer>]
  set <KEY> <VALUE> [--layer <layer>] [--fail-on-unknown] [--actor <name>] [--note <text>]
  unset <KEY> [--layer <layer>] [--actor <name>] [--note <text>]
  clear [--layer <layer>] [--actor <name>] [--note <text>]

Governance:
  codex get
  codex export <file>
  codex import <file>
  validate
  gates
  gate-set <gateName> <true|false>

Audit:
  history [--since <ISO>]

Profiles:
  profiles
  profile-define <name> <jsonFile> [--layer <layer>]
  profile-apply <name> [--layer <layer>] [--actor <name>] [--note <text>]

Snapshots:
  snapshot <name> [--note "text"]
  snapshots
  restore <name>
  diff <snapshotName>

Run:
  run -- <command> [...args]

Codex binder:
  bind-codex <codexJsonFile> [--layer <layer>] [--actor <name>] [--note <text>]

Examples:
  node dist/index.js set LOG_LEVEL trace --layer subtle --actor Colten
  node dist/index.js gate-set production_lock true
  node dist/index.js set SECRET_TOKEN abc --fail-on-unknown
  node dist/index.js history --since 2026-02-01T00:00:00.000Z
`.trim());
}
function parseArgs(argv) {
    const [, , maybeCmd, ...rest] = argv;
    const cmd = (maybeCmd ?? "help");
    return { cmd, rest };
}
function takeFlag(rest, flag) {
    const idx = rest.indexOf(flag);
    if (idx === -1) {
        return { rest };
    }
    const value = rest[idx + 1];
    const next = rest.slice(0, idx).concat(rest.slice(idx + 2));
    if (!value) {
        return { rest: next };
    }
    return { value, rest: next };
}
function hasFlag(rest, flag) {
    const idx = rest.indexOf(flag);
    if (idx === -1)
        return { has: false, rest };
    const next = rest.slice(0, idx).concat(rest.slice(idx + 1));
    return { has: true, rest: next };
}
function main() {
    const { cmd, rest } = parseArgs(process.argv);
    const paths = resolveStoragePaths(process.cwd());
    if (cmd === "help") {
        usage();
        return;
    }
    if (cmd === "init") {
        const sb = new EnvSandbox(paths.stateFile);
        console.log(`✅ Initialized sandbox at ${paths.stateFile}`);
        console.log(`Active layer: ${sb.getActiveLayer()}`);
        return;
    }
    const sb = new EnvSandbox(paths.stateFile);
    try {
        switch (cmd) {
            case "layer": {
                if (rest[0] === "get") {
                    console.log(sb.getActiveLayer());
                    return;
                }
                if (rest[0] === "set") {
                    const layer = rest[1];
                    if (!layer)
                        die("Missing layer. Example: layer set material");
                    sb.setActiveLayer(LayerNameSchema.parse(layer));
                    console.log(`✅ Active layer set to ${sb.getActiveLayer()}`);
                    return;
                }
                die("Usage: layer get | layer set <layer>");
            }
            case "get": {
                const eff = hasFlag(rest, "--effective");
                const layerFlag = takeFlag(eff.rest, "--layer");
                const layer = layerFlag.value ? LayerNameSchema.parse(layerFlag.value) : undefined;
                const env = eff.has ? sb.getEffectiveEnv() : sb.getLayerEnv(layer);
                console.log(JSON.stringify(env, null, 2));
                return;
            }
            case "set": {
                const failUnknown = hasFlag(rest, "--fail-on-unknown");
                const actorFlag = takeFlag(failUnknown.rest, "--actor");
                const noteFlag = takeFlag(actorFlag.rest, "--note");
                const layerFlag = takeFlag(noteFlag.rest, "--layer");
                const layer = layerFlag.value ? LayerNameSchema.parse(layerFlag.value) : undefined;
                const key = layerFlag.rest[0];
                const value = layerFlag.rest[1];
                if (!key || value === undefined)
                    die("Usage: set <KEY> <VALUE> [--layer <layer>] [--fail-on-unknown]");
                sb.setVarTyped({
                    key,
                    raw: value,
                    ...(layer ? { layer } : {}),
                    ...(actorFlag.value ? { actor: actorFlag.value } : {}),
                    ...(noteFlag.value ? { note: noteFlag.value } : {}),
                    failOnUnknownOverride: failUnknown.has
                });
                console.log(`✅ Set ${key} on ${layer ?? sb.getActiveLayer()}`);
                return;
            }
            case "unset": {
                const actorFlag = takeFlag(rest, "--actor");
                const noteFlag = takeFlag(actorFlag.rest, "--note");
                const layerFlag = takeFlag(noteFlag.rest, "--layer");
                const layer = layerFlag.value ? LayerNameSchema.parse(layerFlag.value) : undefined;
                const key = layerFlag.rest[0];
                if (!key)
                    die("Usage: unset <KEY> [--layer <layer>]");
                sb.unsetVar({
                    key,
                    ...(layer ? { layer } : {}),
                    ...(actorFlag.value ? { actor: actorFlag.value } : {}),
                    ...(noteFlag.value ? { note: noteFlag.value } : {})
                });
                console.log(`✅ Unset ${key} on ${layer ?? sb.getActiveLayer()}`);
                return;
            }
            case "clear": {
                const actorFlag = takeFlag(rest, "--actor");
                const noteFlag = takeFlag(actorFlag.rest, "--note");
                const layerFlag = takeFlag(noteFlag.rest, "--layer");
                const layer = layerFlag.value ? LayerNameSchema.parse(layerFlag.value) : undefined;
                sb.clearLayer({
                    ...(layer ? { layer } : {}),
                    ...(actorFlag.value ? { actor: actorFlag.value } : {}),
                    ...(noteFlag.value ? { note: noteFlag.value } : {})
                });
                console.log(`✅ Cleared ${layer ?? sb.getActiveLayer()}`);
                return;
            }
            case "profiles": {
                console.log(JSON.stringify(sb.listProfiles(), null, 2));
                return;
            }
            case "profile-define": {
                const layerFlag = takeFlag(rest, "--layer");
                const layer = layerFlag.value ? LayerNameSchema.parse(layerFlag.value) : undefined;
                const name = layerFlag.rest[0];
                const jsonFile = layerFlag.rest[1];
                if (!name || !jsonFile)
                    die("Usage: profile-define <name> <jsonFile> [--layer <layer>]");
                const filePath = path.resolve(process.cwd(), jsonFile);
                if (!fs.existsSync(filePath))
                    die(`File not found: ${filePath}`);
                const envObj = JSON.parse(fs.readFileSync(filePath, "utf-8"));
                sb.defineProfile(name, envObj, layer);
                console.log(`✅ Defined profile "${name}"`);
                return;
            }
            case "profile-apply": {
                const actorFlag = takeFlag(rest, "--actor");
                const noteFlag = takeFlag(actorFlag.rest, "--note");
                const layerFlag = takeFlag(noteFlag.rest, "--layer");
                const layer = layerFlag.value ? LayerNameSchema.parse(layerFlag.value) : undefined;
                const name = layerFlag.rest[0];
                if (!name)
                    die("Usage: profile-apply <name> [--layer <layer>]");
                sb.applyProfile({
                    name,
                    ...(layer ? { targetLayer: layer } : {}),
                    ...(actorFlag.value ? { actor: actorFlag.value } : {}),
                    ...(noteFlag.value ? { note: noteFlag.value } : {})
                });
                console.log(`✅ Applied profile "${name}" -> ${layer ?? sb.getActiveLayer()}`);
                return;
            }
            case "snapshot": {
                const noteFlag = takeFlag(rest, "--note");
                const name = noteFlag.rest[0];
                if (!name)
                    die("Usage: snapshot <name> [--note \"...\"]");
                sb.snapshot(name, noteFlag.value);
                console.log(`✅ Snapshot saved: ${name}`);
                return;
            }
            case "snapshots": {
                console.log(JSON.stringify(sb.listSnapshots(), null, 2));
                return;
            }
            case "restore": {
                const name = rest[0];
                if (!name)
                    die("Usage: restore <snapshotName>");
                sb.restore(name);
                console.log(`✅ Restored snapshot: ${name}`);
                return;
            }
            case "diff": {
                const name = rest[0];
                if (!name)
                    die("Usage: diff <snapshotName>");
                console.log(JSON.stringify(sb.diffSnapshot(name), null, 2));
                return;
            }
            case "run": {
                const sep = rest.indexOf("--");
                if (sep === -1)
                    die("Usage: run -- <command> [...args]");
                const c = rest[sep + 1];
                const args = rest.slice(sep + 2);
                if (!c)
                    die("Usage: run -- <command> [...args]");
                const injected = sb.getEffectiveEnv();
                const childEnv = { ...process.env, ...injected };
                const res = spawnSync(c, args, {
                    stdio: "inherit",
                    env: childEnv,
                    shell: process.platform === "win32"
                });
                process.exit(res.status ?? 0);
            }
            case "bind-codex": {
                const actorFlag = takeFlag(rest, "--actor");
                const noteFlag = takeFlag(actorFlag.rest, "--note");
                const layerFlag = takeFlag(noteFlag.rest, "--layer");
                const layer = layerFlag.value ? LayerNameSchema.parse(layerFlag.value) : undefined;
                const codexFile = layerFlag.rest[0];
                if (!codexFile)
                    die("Usage: bind-codex <codexJsonFile> [--layer <layer>]");
                const filePath = path.resolve(process.cwd(), codexFile);
                if (!fs.existsSync(filePath))
                    die(`File not found: ${filePath}`);
                const codexObj = JSON.parse(fs.readFileSync(filePath, "utf-8"));
                const info = sb.bindRecursiveCreationCodex({
                    codexJson: codexObj,
                    ...(layer ? { layer } : {}),
                    ...(actorFlag.value ? { actor: actorFlag.value } : {}),
                    ...(noteFlag.value ? { note: noteFlag.value } : {})
                });
                console.log(`✅ Bound Recursive Creation Codex into env (${layer ?? sb.getActiveLayer()})`);
                console.log(JSON.stringify(info, null, 2));
                return;
            }
            case "gates": {
                console.log(JSON.stringify(sb.getEnvCodex().gates, null, 2));
                return;
            }
            case "gate-set": {
                const gate = rest[0];
                const raw = rest[1];
                if (!gate || raw === undefined)
                    die("Usage: gate-set <gateName> <true|false>");
                const v = raw.trim().toLowerCase();
                if (v !== "true" && v !== "false")
                    die(`Invalid boolean: ${raw}`);
                sb.setGate(gate, v === "true");
                console.log(`✅ Gate ${gate} = ${v}`);
                return;
            }
            case "codex": {
                const sub = rest[0];
                if (!sub || sub === "get") {
                    console.log(JSON.stringify(sb.getEnvCodex(), null, 2));
                    return;
                }
                if (sub === "export") {
                    const file = rest[1];
                    if (!file)
                        die("Usage: codex export <file>");
                    fs.writeFileSync(path.resolve(process.cwd(), file), JSON.stringify(sb.getEnvCodex(), null, 2) + "\n", "utf-8");
                    console.log(`✅ Exported codex -> ${file}`);
                    return;
                }
                if (sub === "import") {
                    const file = rest[1];
                    if (!file)
                        die("Usage: codex import <file>");
                    const fp = path.resolve(process.cwd(), file);
                    if (!fs.existsSync(fp))
                        die(`File not found: ${fp}`);
                    const obj = JSON.parse(fs.readFileSync(fp, "utf-8"));
                    // Hard validate; importing means you accept governance.
                    const validated = EnvCodexSchema.parse(obj);
                    const stateFile = paths.stateFile;
                    const rawState = JSON.parse(fs.readFileSync(stateFile, "utf-8"));
                    rawState.codex = validated;
                    fs.writeFileSync(stateFile, JSON.stringify(rawState, null, 2) + "\n", "utf-8");
                    console.log(`✅ Imported codex from ${file}`);
                    return;
                }
                die("Usage: codex get | codex export <file> | codex import <file>");
            }
            case "validate": {
                const codex = sb.getEnvCodex();
                // Validate codex itself
                EnvCodexSchema.parse(codex);
                // Validate current env keys against codex allowlist if codex says so
                const failUnknown = codex.policy.fail_on_unknown_key;
                if (failUnknown) {
                    const allowed = new Set(codex.registry.map((r) => r.key));
                    const env = sb.getEffectiveEnv();
                    const unknown = Object.keys(env).filter((k) => !allowed.has(k) && !k.startsWith("CODEX_"));
                    if (unknown.length) {
                        die(`❌ Validation failed. Unknown keys:\n- ${unknown.join("\n- ")}`);
                    }
                }
                console.log("✅ Validation OK");
                return;
            }
            case "history": {
                const sinceFlag = takeFlag(rest, "--since");
                const events = readAuditSince(paths.stateFile, sinceFlag.value);
                console.log(JSON.stringify(events, null, 2));
                return;
            }
            default:
                usage();
                process.exit(0);
        }
    }
    catch (err) {
        die(`❌ ${err instanceof Error ? err.message : String(err)}`);
    }
}
main();
