import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const cwd = process.cwd();

function resolvePython() {
  if (process.env.SPINE_PYTHON && process.env.SPINE_PYTHON.trim()) {
    return process.env.SPINE_PYTHON;
  }
  const venvPython = path.join(cwd, "world-engine-chat", "brain", ".venv", "Scripts", "python.exe");
  if (fs.existsSync(venvPython)) {
    return venvPython;
  }
  return "python";
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: false,
    ...options,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function parseFlags(argv) {
  const flags = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      flags.set(token, "true");
      continue;
    }
    flags.set(token, next);
    i += 1;
  }
  return flags;
}

function ensureRuntimeDir() {
  const runtimeDir = path.join(cwd, "runtime");
  fs.mkdirSync(runtimeDir, { recursive: true });
}

function commandUp(flags) {
  ensureRuntimeDir();
  const python = resolvePython();
  const ticks = flags.get("--ticks");
  if (ticks) {
    process.stdout.write(`[spine] note: --ticks=${ticks} is accepted for compatibility; unified_nexus.full_build currently controls its own runtime window.\n`);
  }
  run(python, ["-m", "unified_nexus.full_build"]);
}

function commandAudit() {
  ensureRuntimeDir();
  run("node", [path.join("tooling", "audit-runner", "index.mjs")]);
}

function commandReplay(flags) {
  ensureRuntimeDir();
  const python = resolvePython();
  const logPath = flags.get("--log") ?? path.join("runtime", "events.v1.ndjson");
  const outDb = flags.get("--out-db") ?? path.join("runtime", "replay", "nexus.db");
  run(python, ["-m", "unified_nexus.replay_v1", "--log", logPath, "--out-db", outDb]);
}

function commandDoctor() {
  const python = resolvePython();
  process.stdout.write(`[spine] cwd=${cwd}\n`);
  process.stdout.write(`[spine] python=${python}\n`);
  process.stdout.write(`[spine] has runtime/events.v1.ndjson=${String(fs.existsSync(path.join(cwd, "runtime", "events.v1.ndjson")))}\n`);
  process.stdout.write(`[spine] has runtime/nexus.db=${String(fs.existsSync(path.join(cwd, "runtime", "nexus.db")))}\n`);
  process.stdout.write(`[spine] has tooling/audit-runner/index.mjs=${String(fs.existsSync(path.join(cwd, "tooling", "audit-runner", "index.mjs")))}\n`);
}

function main() {
  const [, , command, ...rest] = process.argv;
  const flags = parseFlags(rest);

  switch (command) {
    case "up":
      commandUp(flags);
      return;
    case "audit":
      commandAudit();
      return;
    case "replay":
      commandReplay(flags);
      return;
    case "doctor":
      commandDoctor();
      return;
    default:
      process.stdout.write("Usage: node tools/spine.mjs <up|audit|replay|doctor> [--flags]\n");
      process.exit(command ? 1 : 0);
  }
}

main();
