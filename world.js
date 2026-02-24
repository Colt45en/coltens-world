#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const net = require("node:net");
const crypto = require("node:crypto");
const childProcess = require("node:child_process");
const { ArgumentParser } = require("argparse");

const EXIT = {
  OK: 0,
  RUNTIME_FAIL: 1,
  USAGE: 2,
  CONFIG: 78,
  IO: 74,
  INTERNAL: 70,
};

const DEFAULTS = Object.freeze({
  env_prefix: "WORLD_",
  config: null,
  server_cmd: null,
  verbose: false,
  json: false,
  no_color: false,
  debug: false,
  dry_run: false,
  timeout_ms: 0,
  host: "127.0.0.1",
  tickrate: 30,
  port: 7777,
  state_dir: path.join(os.homedir(), ".world"),
  pid_dir: path.join(os.homedir(), ".world", "pids"),
  snapshot_dir: path.join(os.homedir(), ".world", "snapshots"),
});

function nowIso() {
  return new Date().toISOString();
}

function isTty() {
  return Boolean(process.stderr.isTTY);
}

function ansi(enabled, code, text) {
  if (!enabled) return text;
  return `\u001B[${code}m${text}\u001B[0m`;
}

function stableJsonValue(v) {
  if (v === null || v === undefined) return v;
  if (Array.isArray(v)) return v.map(stableJsonValue);
  if (typeof v === "object") {
    const out = {};
    for (const key of Object.keys(v).sort()) {
      out[key] = stableJsonValue(v[key]);
    }
    return out;
  }
  return v;
}

function stableStringify(v) {
  return JSON.stringify(stableJsonValue(v));
}

function sha256Hex(s) {
  return crypto.createHash("sha256").update(String(s)).digest("hex");
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function fileWritable(dir) {
  try {
    ensureDir(dir);
    const p = path.join(dir, `.write-test-${process.pid}-${Date.now()}.tmp`);
    fs.writeFileSync(p, "ok");
    fs.unlinkSync(p);
    return true;
  } catch {
    return false;
  }
}

function readJsonFileMaybe(p) {
  if (!p) return null;
  const full = path.resolve(String(p));
  if (!fs.existsSync(full)) return { __error: `Config file not found: ${full}` };
  try {
    const raw = fs.readFileSync(full, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { __error: `Config must be a JSON object: ${full}` };
    }
    return parsed;
  } catch (e) {
    return { __error: `Config parse failed (${full}): ${e.message}` };
  }
}

function parseEnv(prefix) {
  const out = {};
  const pre = String(prefix || "").toUpperCase();
  for (const [k, v] of Object.entries(process.env)) {
    if (!k.startsWith(pre)) continue;
    const key = k.slice(pre.length).toLowerCase();
    out[key] = v;
  }
  return out;
}

function coerceTypes(schema, obj) {
  const out = Object.assign({}, obj || {});
  for (const [key, type] of Object.entries(schema || {})) {
    if (!(key in out)) continue;
    const value = out[key];
    if (value === null || value === undefined) continue;

    if (type === "int") {
      const n = Number(value);
      if (Number.isFinite(n) && Number.isInteger(n)) out[key] = n;
      continue;
    }
    if (type === "float") {
      const n = Number(value);
      if (Number.isFinite(n)) out[key] = n;
      continue;
    }
    if (type === "bool") {
      if (typeof value === "boolean") continue;
      const s = String(value).trim().toLowerCase();
      out[key] = s === "1" || s === "true" || s === "yes" || s === "on";
      continue;
    }
    if (type === "string") {
      out[key] = String(value);
    }
  }
  return out;
}

function merge3(defaults, configObj, envObj) {
  return Object.assign({}, defaults || {}, configObj || {}, envObj || {});
}

function supportedConfigEnvKeys() {
  return new Set([
    "env_prefix",
    "config",
    "server_cmd",
    "verbose",
    "json",
    "no_color",
    "debug",
    "dry_run",
    "timeout_ms",
    "trace_id",
    "state_dir",
    "pid_dir",
    "snapshot_dir",
    "host",
    "cmd",
    "shard",
    "shard_base",
    "replicas",
    "map",
    "tickrate",
    "headless",
    "port",
    "port_base",
    "force_restart",
    "out",
    "in",
    "events",
    "speed",
    "ticks",
    "target",
    "input",
    "output",
    "to",
    "mode",
    "manifest_dir",
    "cache_dir",
    "entry",
    "out_file",
    "platform",
    "format",
    "sourcemap",
    "minify",
    "external",
    "csproj",
    "configuration",
    "framework"
  ]);
}

function redactArgs(args) {
  const out = Object.assign({}, args || {});
  const SENSITIVE = /(token|secret|password|passwd|key|api[_-]?key|auth|credential|cookie)/i;
  for (const k of Object.keys(out)) {
    if (SENSITIVE.test(k)) out[k] = "[REDACTED]";
  }
  if (out.server_cmd) out.server_cmd = "[REDACTED]";
  return out;
}

function logLine(args, level, msg, extra) {
  if (args && args.json) {
    const payload = {
      ts: nowIso(),
      level,
      prog: "world",
      cmd: args.cmd || null,
      msg,
      ...(extra || {}),
    };
    process.stdout.write(`${stableStringify(payload)}\n`);
    return;
  }

  const enabledColor = isTty() && !(args && args.no_color);
  const levelColorMap = {
    error: ansi(enabledColor, "31", "[error]"),
    warn: ansi(enabledColor, "33", "[warn]"),
  };
  const head = levelColorMap[level] || ansi(enabledColor, "36", "[info]");
  process.stdout.write(`${head} ${msg}\n`);
  if (extra && Object.keys(extra).length > 0) {
    process.stdout.write(`${JSON.stringify(extra, null, 2)}\n`);
  }
}

function makeCliError(message, code = EXIT.RUNTIME_FAIL, meta) {
  const err = new Error(message);
  err.code = code;
  if (meta !== undefined) err.meta = meta;
  return err;
}

function die(parser, args, err) {
  if (args && args.debug) throw err;

  const message = err instanceof Error ? err.message : String(err);
  const code = err && err.code ? err.code : EXIT.RUNTIME_FAIL;

  if (code === EXIT.USAGE) {
    try {
      parser.print_help();
    } catch {
      // ignore
    }
  }
  logLine(args, "error", message, err && err.meta ? { meta: err.meta } : undefined);
  process.exit(code);
}

function pidFileForShard(args, shard) {
  ensureDir(args.pid_dir);
  return path.join(args.pid_dir, `world-${String(shard)}.pid.json`);
}

function readPidRecord(pidFile) {
  if (!fs.existsSync(pidFile)) return null;
  try {
    return JSON.parse(fs.readFileSync(pidFile, "utf8"));
  } catch {
    return null;
  }
}

function writePidRecord(pidFile, record) {
  ensureDir(path.dirname(pidFile));
  fs.writeFileSync(pidFile, JSON.stringify(record, null, 2));
}

function removePidRecord(pidFile) {
  if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);
}

function processAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function stopProcessGraceful(pid, timeoutMs) {
  return new Promise((resolve) => {
    if (!pid || !processAlive(pid)) {
      resolve({ ok: true, note: "not running" });
      return;
    }

    try {
      process.kill(pid, "SIGTERM");
    } catch {
      resolve({ ok: false, note: "failed to SIGTERM" });
      return;
    }

    const started = Date.now();
    const timer = setInterval(() => {
      if (!processAlive(pid)) {
        clearInterval(timer);
        resolve({ ok: true, note: "stopped" });
        return;
      }

      if (timeoutMs > 0 && Date.now() - started > timeoutMs) {
        clearInterval(timer);
        try {
          process.kill(pid, "SIGKILL");
        } catch {
          // ignore
        }
        resolve({ ok: false, note: "killed after timeout" });
      }
    }, 100);
  });
}

function spawnServer(args) {
  const serverCmd = args.server_cmd || process.env.WORLD_SERVER_CMD || null;

  let child;
  let mode = "demo";
  if (serverCmd) {
    mode = "external";
    child = childProcess.spawn(serverCmd, {
      shell: true,
      stdio: "ignore",
      detached: true,
      env: { ...process.env, WORLD_SHARD: String(args.shard),
        WORLD_MAP: String(args.map),
        WORLD_TICKRATE: String(args.tickrate),
        WORLD_HOST: String(args.host),
        WORLD_PORT: String(args.port),
        WORLD_HEADLESS: args.headless ? "1" : "0",},
    });
  } else {
    ensureDir(args.state_dir);
    const logPath = path.join(args.state_dir, `server-${args.shard}.log`);
    const demoCode = String.raw`
      const fs = require("node:fs");
      const shard = process.env.WORLD_SHARD || "unknown";
      const map = process.env.WORLD_MAP || "unknown";
      const tick = process.env.WORLD_TICKRATE || "30";
      const host = process.env.WORLD_HOST || "127.0.0.1";
      const port = process.env.WORLD_PORT || "7777";
      const headless = process.env.WORLD_HEADLESS || "0";
      const logPath = ${JSON.stringify(logPath)};
      const line = (s) => fs.appendFileSync(logPath, s + "\n");
      line("[boot] shard=" + shard + " map=" + map + " tick=" + tick + " host=" + host + " port=" + port + " headless=" + headless + " ts=" + new Date().toISOString());
      setInterval(() => line("[tick] shard=" + shard + " ts=" + new Date().toISOString()), 1000);
      process.on("SIGTERM", () => { line("[stop] SIGTERM ts=" + new Date().toISOString()); process.exit(0); });
      process.on("SIGINT", () => { line("[stop] SIGINT ts=" + new Date().toISOString()); process.exit(0); });
    `;
    child = childProcess.spawn(process.execPath, ["-e", demoCode], {
      stdio: "ignore",
      detached: true,
      env: { ...process.env, WORLD_SHARD: String(args.shard),
        WORLD_MAP: String(args.map),
        WORLD_TICKRATE: String(args.tickrate),
        WORLD_HOST: String(args.host),
        WORLD_PORT: String(args.port),
        WORLD_HEADLESS: args.headless ? "1" : "0",},
    });
  }

  child.unref();
  return { pid: child.pid, mode };
}

function checkPortAvailable(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen({ port, host });
  });
}

async function runDoctor(args) {
  const results = [];

  const nodeVersion = process.versions.node;
  const major = Number(String(nodeVersion).split(".")[0] || 0);
  results.push(
    { name: "node_version", ok: major >= 18, detail: `node=${nodeVersion} (need >= 18)` },
    { name: "state_dir_writable", ok: fileWritable(args.state_dir), detail: args.state_dir },
    { name: "pid_dir_writable", ok: fileWritable(args.pid_dir), detail: args.pid_dir },
    { name: "snapshot_dir_writable", ok: fileWritable(args.snapshot_dir), detail: args.snapshot_dir }
  );

  if (args.port) {
    const ok = await checkPortAvailable(args.port, args.host);
    results.push({ name: "port_available", ok, detail: `host=${args.host} port=${args.port}` });
  }

  const allOk = results.every((r) => r.ok);
  logLine(args, allOk ? "info" : "warn", `doctor: ${allOk ? "OK" : "ISSUES"}`, { checks: results });
  if (!allOk) {
    throw makeCliError("doctor failed: one or more checks not OK", EXIT.RUNTIME_FAIL, { checks: results });
  }
}

async function cmdServe(args) {
  const pidFile = pidFileForShard(args, args.shard);
  const rec = readPidRecord(pidFile);

  if (rec && rec.pid && processAlive(rec.pid)) {
    if (!args.force_restart) {
      throw makeCliError(`shard ${args.shard} already running (pid ${rec.pid}). Use --force-restart to replace.`, EXIT.RUNTIME_FAIL, { pid: rec.pid });
    }
    logLine(args, "warn", `Stopping existing shard ${args.shard} pid=${rec.pid}`);
    await stopProcessGraceful(rec.pid, args.timeout_ms || 10000);
    removePidRecord(pidFile);
  } else if (rec) {
    removePidRecord(pidFile);
  }

  if (args.dry_run) {
    logLine(args, "info", `dry-run: would start server shard=${args.shard} map=${args.map} tickrate=${args.tickrate} host=${args.host} port=${args.port} headless=${Boolean(args.headless)}`);
    return;
  }

  const available = await checkPortAvailable(args.port, args.host);
  if (!available) {
    throw makeCliError(`port ${args.port} is not available on host ${args.host}`, EXIT.RUNTIME_FAIL, { host: args.host, port: args.port });
  }

  const { pid, mode } = spawnServer(args);
  const record = {
    shard: String(args.shard),
    pid,
    mode,
    started_at: nowIso(),
    map: String(args.map),
    tickrate: Number(args.tickrate),
    host: String(args.host),
    port: Number(args.port),
    headless: Boolean(args.headless),
    trace_id: args.trace_id || null,
  };
  writePidRecord(pidFile, record);
  logLine(args, "info", `serve: started shard=${args.shard} pid=${pid} mode=${mode}`);
}

async function cmdScale(args) {
  if (args.replicas < 1 || args.replicas > 64) {
    throw makeCliError("replicas must be between 1 and 64", EXIT.USAGE);
  }

  const base = args.shard_base || args.shard;
  if (!base) throw makeCliError("--shard or --shard-base is required", EXIT.USAGE);

  const actions = [];
  for (let i = 1; i <= args.replicas; i++) {
    actions.push({ shard: `${base}-${i}` });
  }

  if (args.dry_run) {
    logLine(args, "info", `dry-run: would scale base=${base} replicas=${args.replicas}`, { actions });
    return;
  }

  for (const action of actions) {
    const pidFile = pidFileForShard(args, action.shard);
    const rec = readPidRecord(pidFile);
    if (rec && rec.pid && processAlive(rec.pid)) {
      logLine(args, "info", `scale: shard=${action.shard} already running pid=${rec.pid}`);
      continue;
    }

    if (!args.map) {
      throw makeCliError("scale requires --map (choices: tundra/desert/forest)", EXIT.USAGE);
    }

    const inferredIndex = Number(String(action.shard).split("-").pop()) || 1;
    const port = (Number(args.port_base) || DEFAULTS.port) + inferredIndex - 1;

    const serveArgs = { ...args, cmd: "serve",
      shard: action.shard,
      host: args.host,
      port,
      tickrate: args.tickrate,
      headless: args.headless,
      trace_id: args.trace_id,};

    logLine(args, "info", `scale: starting shard=${action.shard} port=${port}`);
    await cmdServe(serveArgs);
  }

  logLine(args, "info", `scale: done base=${base} replicas=${args.replicas}`);
}

async function cmdDrain(args) {
  const pidFile = pidFileForShard(args, args.shard);
  const rec = readPidRecord(pidFile);
  if (!rec || !rec.pid) {
    logLine(args, "warn", `drain: shard=${args.shard} not running (no pid record)`);
    return;
  }
  if (!processAlive(rec.pid)) {
    logLine(args, "warn", `drain: shard=${args.shard} pid=${rec.pid} not alive; cleaning record`);
    removePidRecord(pidFile);
    return;
  }

  if (args.dry_run) {
    logLine(args, "info", `dry-run: would drain shard=${args.shard} pid=${rec.pid} timeout_ms=${args.timeout_ms}`);
    return;
  }

  logLine(args, "info", `drain: stopping shard=${args.shard} pid=${rec.pid}`);
  const res = await stopProcessGraceful(rec.pid, args.timeout_ms || 10000);
  rec.drained_at = nowIso();
  rec.drain_result = res;
  writePidRecord(pidFile, rec);

  if (res.ok) {
    removePidRecord(pidFile);
    logLine(args, "info", `drain: stopped shard=${args.shard} (${res.note})`);
  } else {
    logLine(args, "warn", `drain: shard=${args.shard} stop not clean (${res.note})`);
  }
}

async function cmdSnapshot(args) {
  const pidFile = pidFileForShard(args, args.shard);
  const rec = readPidRecord(pidFile);
  const snap = {
    schema: { name: "world.snapshot", version: "1.0.0" },
    captured_at: nowIso(),
    shard: String(args.shard),
    trace_id: args.trace_id || null,
    server: rec || null,
    inputs: {
      map: args.map || (rec && rec.map) || null,
      tickrate: args.tickrate || (rec && rec.tickrate) || null,
      host: args.host || (rec && rec.host) || null,
      port: args.port || (rec && rec.port) || null,
    },
  };

  const idBasis = stableStringify({
    shard: snap.shard,
    inputs: snap.inputs,
    trace_id: snap.trace_id,
  });
  snap.snapshot_id = sha256Hex(idBasis).slice(0, 24);

  const outPath = args.out
    ? path.resolve(String(args.out))
    : path.join(args.snapshot_dir, `${snap.shard}-${snap.snapshot_id}.json`);

  if (args.dry_run) {
    logLine(args, "info", `dry-run: would write snapshot to ${outPath}`, { snapshot_id: snap.snapshot_id });
    return;
  }

  ensureDir(path.dirname(outPath));
  fs.writeFileSync(outPath, JSON.stringify(snap, null, 2));
  logLine(args, "info", `snapshot: wrote ${outPath}`, { snapshot_id: snap.snapshot_id });
}

async function cmdReplay(args) {
  const inPath = path.resolve(String(args.in));
  if (!fs.existsSync(inPath)) {
    throw makeCliError(`replay input not found: ${inPath}`, EXIT.IO);
  }

  let snap;
  try {
    snap = JSON.parse(fs.readFileSync(inPath, "utf8"));
  } catch (e) {
    throw makeCliError(`replay input parse failed: ${e.message}`, EXIT.CONFIG);
  }

  const plan = {
    schema: { name: "world.replay_plan", version: "1.0.0" },
    created_at: nowIso(),
    from_snapshot: snap.snapshot_id || null,
    shard: snap.shard || null,
    speed: Number(args.speed),
    steps: [
      { op: "load_snapshot", snapshot_id: snap.snapshot_id || null },
      { op: "apply_events", source: args.events || null },
      { op: "run", ticks: Number(args.ticks) },
    ],
  };

  const outPath = args.out ? path.resolve(String(args.out)) : null;
  if (args.dry_run) {
    logLine(args, "info", "dry-run: would generate replay plan", { plan });
    return;
  }

  if (outPath) {
    ensureDir(path.dirname(outPath));
    fs.writeFileSync(outPath, JSON.stringify(plan, null, 2));
    logLine(args, "info", `replay: wrote plan ${outPath}`);
  } else {
    process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
  }
}

async function cmdBake(args) {
  const input = path.resolve(String(args.input));
  const output = path.resolve(String(args.output));
  if (!fs.existsSync(input)) {
    throw makeCliError(`bake input not found: ${input}`, EXIT.IO);
  }

  if (args.dry_run) {
    logLine(args, "info", `dry-run: would bake target=${args.target} input=${input} output=${output}`);
    return;
  }

  ensureDir(path.dirname(output));
  const header = `# baked:${args.target}\n# ts:${nowIso()}\n# src:${input}\n`;
  const data = fs.readFileSync(input);
  fs.writeFileSync(output, Buffer.concat([Buffer.from(header, "utf8"), data]));
  logLine(args, "info", `bake: wrote ${output}`, { target: args.target });
}

async function cmdMigrateDb(args) {
  ensureDir(args.state_dir);
  const to = args.to || "latest";
  const marker = {
    schema: { name: "world.db_migration", version: "1.0.0" },
    applied_at: nowIso(),
    to,
    trace_id: args.trace_id || null,
  };
  const outPath = path.join(args.state_dir, `db-migrate-${sha256Hex(to).slice(0, 12)}.json`);

  if (args.dry_run) {
    logLine(args, "info", `dry-run: would write migration marker ${outPath}`, { to });
    return;
  }

  fs.writeFileSync(outPath, JSON.stringify(marker, null, 2));
  logLine(args, "info", `migrate-db: recorded ${outPath}`, { to });
}

function runCommand(command, argv, cwd) {
  return new Promise((resolve) => {
    let child;
    try {
      child = childProcess.spawn(command, argv, {
        cwd,
        stdio: ["ignore", "pipe", "pipe"],
        shell: process.platform === "win32",
        env: process.env,
      });
    } catch (error) {
      resolve({
        code: 1,
        stdout: "",
        stderr: error instanceof Error ? error.message : String(error),
      });
      return;
    }
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    child.on("error", (error) => {
      stderr += error instanceof Error ? error.message : String(error);
    });
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

async function cmdCompile(args) {
  const mode = args.mode;
  const pnpmCmd = "pnpm";
  const manifestDirAbs = path.resolve(String(args.manifest_dir));
  const compileArgs = [
    "--filter",
    "@world-engine/tooling",
    "run",
    "compile",
    "--",
    mode,
    "--manifest-dir",
    manifestDirAbs,
  ];

  if (args.cache_dir) {
    compileArgs.push("--cache-dir", path.resolve(String(args.cache_dir)));
  }

  if (mode === "js" || mode === "both") {
    if (!args.entry || !args.out_file) {
      throw makeCliError("compile js/both requires --entry and --out-file", EXIT.USAGE);
    }
    compileArgs.push("--entry", path.resolve(String(args.entry)));
    compileArgs.push("--out-file", path.resolve(String(args.out_file)));
    compileArgs.push("--platform", String(args.platform || "browser"));
    compileArgs.push("--format", String(args.format || "esm"));
    if (args.sourcemap) compileArgs.push("--sourcemap", "true");
    if (args.minify) compileArgs.push("--minify", "true");
    if (Array.isArray(args.external)) {
      for (const ext of args.external) {
        compileArgs.push("--external", String(ext));
      }
    }
  }

  if (mode === "cs" || mode === "both") {
    if (!args.csproj) {
      throw makeCliError("compile cs/both requires --csproj", EXIT.USAGE);
    }
    compileArgs.push("--csproj", path.resolve(String(args.csproj)));
    compileArgs.push("--configuration", String(args.configuration || "Release"));
    if (args.framework) compileArgs.push("--framework", String(args.framework));
  }

  if (args.dry_run) {
    logLine(args, "info", "dry-run: would run deterministic compile pipeline", {
      command: "pnpm",
      args: compileArgs,
    });
    return;
  }

  const result = await runCommand(pnpmCmd, compileArgs, process.cwd());
  if (result.code !== 0) {
    throw makeCliError(`compile failed (${result.code})\n${result.stderr || result.stdout}`, EXIT.RUNTIME_FAIL, {
      stdout: result.stdout,
      stderr: result.stderr,
    });
  }

  const lines = result.stdout
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean);
  const manifests = [];
  for (const line of lines) {
    try {
      manifests.push(JSON.parse(line));
    } catch {
      // ignore non-json output lines
    }
  }

  logLine(args, "info", `compile: completed mode=${mode}`, {
    manifest_dir: manifestDirAbs,
    manifests,
  });
}

function patchParserForDeterminism(parser, runtime) {
  runtime._parserOrigError = parser.error ? parser.error.bind(parser) : null;
  runtime._parserOrigExit = parser.exit ? parser.exit.bind(parser) : null;

  parser.error = function patchedError(message) {
    let msg;
    if (typeof message === "string") {
      msg = message;
    } else {
      const msgProp = message && message.message ? message.message : message;
      msg = String(msgProp);
    }
    throw makeCliError(`${parser.prog}: error: ${msg}`, EXIT.USAGE);
  };

  parser.exit = function patchedExit(status, message) {
    const statusCode = Number(status) || 0;
    const msg = message ? String(message).trim() : "";
    let code;
    if (statusCode === 0) {
      code = EXIT.OK;
    } else if (statusCode === 2) {
      code = EXIT.USAGE;
    } else {
      code = statusCode;
    }
    throw makeCliError(msg || `exit ${code}`, code);
  };
}

function setRequiredSubcommand(subparsers) {
  if (!subparsers || typeof subparsers !== "object") return;
  try {
    subparsers.required = true;
  } catch {
    // no-op for argparse variants without writable required field
  }
}

function addCommandParser(subparsers, name, aliases, parserOptions, configure) {
  const aliasList = Array.isArray(aliases) ? aliases.filter(Boolean) : [];
  const allNames = [name, ...aliasList];
  for (const commandName of allNames) {
    const commandParser = subparsers.add_parser(commandName, parserOptions);
    configure(commandParser);
  }
}

function normalizeCommandName(cmd) {
  const aliasMap = {
    server: "serve",
    migrate: "migrate-db",
  };
  return aliasMap[cmd] || cmd;
}

function buildParser(defaults, runtime) {
  const parser = new ArgumentParser({
    prog: "world",
    description: "Tier-4 world engine control plane CLI",
    add_help: true,
    fromfile_prefix_chars: "@",
  });
  patchParserForDeterminism(parser, runtime);

  parser.add_argument("-v", "--verbose", { action: "store_true", help: "Verbose logging" });
  parser.add_argument("--json", { action: "store_true", help: "Emit logs as JSON (CI-friendly)" });
  parser.add_argument("--no-color", { dest: "no_color", action: "store_true", help: "Disable ANSI color" });
  parser.add_argument("--debug", { action: "store_true", help: "Debug mode (throw errors instead of exiting)" });
  parser.add_argument("--dry-run", { dest: "dry_run", action: "store_true", help: "Validate + show actions without executing" });
  parser.add_argument("--timeout-ms", { dest: "timeout_ms", type: "int", default: defaults.timeout_ms, help: "Global timeout (0 = none)" });
  parser.add_argument("--trace-id", { dest: "trace_id", default: null, help: "Correlation ID (printed in logs/snapshots)" });

  parser.add_argument("-c", "--config", { default: defaults.config, help: "Path to config JSON" });
  parser.add_argument("--env-prefix", { dest: "env_prefix", default: defaults.env_prefix, help: "Env var prefix (default WORLD_)" });

  parser.add_argument("--state-dir", { dest: "state_dir", default: defaults.state_dir, help: "State directory (~/.world)" });
  parser.add_argument("--pid-dir", { dest: "pid_dir", default: defaults.pid_dir, help: "PID directory (~/.world/pids)" });
  parser.add_argument("--snapshot-dir", { dest: "snapshot_dir", default: defaults.snapshot_dir, help: "Snapshot directory (~/.world/snapshots)" });
  parser.add_argument("--server-cmd", { dest: "server_cmd", default: defaults.server_cmd || null, help: "External server command to spawn (optional)" });
  parser.add_argument("--host", { dest: "host", default: defaults.host, help: "Host interface for local bind checks (default 127.0.0.1)" });

  const sub = parser.add_subparsers({ title: "subcommands", dest: "cmd" });
  setRequiredSubcommand(sub);

  addCommandParser(
    sub,
    "serve",
    ["server"],
    { help: "Run dedicated world server (spawns + pidfile)" },
    (serve) => {
      serve.add_argument("--shard", { required: true, help: "Shard ID (e.g., us-1)" });
      serve.add_argument("--map", { required: true, choices: ["tundra", "desert", "forest"], help: "Map name" });
      serve.add_argument("--tickrate", { type: "int", default: defaults.tickrate, help: "Tickrate (Hz)" });
      serve.add_argument("--headless", { action: "store_true", help: "Headless mode" });
      serve.add_argument("--port", { type: "int", default: defaults.port, help: "Port" });
      serve.add_argument("--force-restart", { dest: "force_restart", action: "store_true", help: "Stop existing process for shard and restart" });
    }
  );

  const scale = sub.add_parser("scale", { help: "Scale shard group (starts missing replicas locally)" });
  scale.add_argument("--shard", { help: "Single shard name (used if shard-base omitted)" });
  scale.add_argument("--shard-base", { dest: "shard_base", help: "Base shard name (e.g., us-1 -> us-1-1..N)" });
  scale.add_argument("--replicas", { type: "int", required: true, help: "Replica count (1..64)" });
  scale.add_argument("--map", { choices: ["tundra", "desert", "forest"], help: "Map for new replicas" });
  scale.add_argument("--tickrate", { type: "int", default: defaults.tickrate, help: "Tickrate for new replicas" });
  scale.add_argument("--headless", { action: "store_true", help: "Headless mode" });
  scale.add_argument("--port-base", { dest: "port_base", type: "int", default: defaults.port, help: "Base port for replica assignment" });

  const drain = sub.add_parser("drain", { help: "Drain/stop a shard gracefully" });
  drain.add_argument("--shard", { required: true, help: "Shard ID" });

  const snapshot = sub.add_parser("snapshot", { help: "Capture a control-plane snapshot" });
  snapshot.add_argument("--shard", { required: true, help: "Shard ID" });
  snapshot.add_argument("--out", { help: "Output snapshot file (defaults to snapshot-dir)" });
  snapshot.add_argument("--map", { choices: ["tundra", "desert", "forest"], help: "Map override (optional)" });
  snapshot.add_argument("--tickrate", { type: "int", help: "Tickrate override (optional)" });
  snapshot.add_argument("--port", { type: "int", help: "Port override (optional)" });

  const replay = sub.add_parser("replay", { help: "Generate a replay plan from a snapshot" });
  replay.add_argument("--in", { required: true, help: "Input snapshot JSON" });
  replay.add_argument("--out", { help: "Write replay plan JSON to file (default stdout)" });
  replay.add_argument("--events", { help: "Optional events file (ndjson)" });
  replay.add_argument("--speed", { type: "float", default: 1, help: "Replay speed multiplier" });
  replay.add_argument("--ticks", { type: "int", default: 600, help: "Ticks to run in plan" });

  const bake = sub.add_parser("bake", { help: "Run offline bakes (navmesh, lighting, AO)" });
  bake.add_argument("--target", { choices: ["navmesh", "lighting", "ao"], required: true, help: "Bake target" });
  bake.add_argument("--input", { required: true, help: "Input asset file" });
  bake.add_argument("--output", { required: true, help: "Output bake file" });

  addCommandParser(
    sub,
    "migrate-db",
    ["migrate"],
    { help: "Apply database migrations (marker file runner)" },
    (migrate) => {
      migrate.add_argument("--to", { help: "Target version (default latest)" });
    }
  );

  const doctor = sub.add_parser("doctor", { help: "Run environment and config checks" });
  doctor.add_argument("--shard", { help: "Shard ID (optional)" });
  doctor.add_argument("--port", { type: "int", help: "Port to check (optional; defaults to resolved port)" });

  const compile = sub.add_parser("compile", { help: "Run deterministic JS/C# compile pipeline and emit manifests" });
  compile.add_argument("--mode", { choices: ["js", "cs", "both"], required: true, help: "Compilation mode" });
  compile.add_argument("--manifest-dir", { dest: "manifest_dir", default: "tooling-dist/compile", help: "Manifest output directory" });
  compile.add_argument("--cache-dir", { dest: "cache_dir", help: "Optional cache directory root" });
  compile.add_argument("--entry", { help: "JS/TS entrypoint (required for js/both)" });
  compile.add_argument("--out-file", { dest: "out_file", help: "JS output bundle file (required for js/both)" });
  compile.add_argument("--platform", { choices: ["browser", "node"], default: "browser", help: "JS bundle target platform" });
  compile.add_argument("--format", { choices: ["esm", "cjs"], default: "esm", help: "JS output format" });
  compile.add_argument("--sourcemap", { action: "store_true", help: "Enable sourcemap output for JS" });
  compile.add_argument("--minify", { action: "store_true", help: "Enable minify for JS" });
  compile.add_argument("--external", { action: "append", help: "Mark package as external for JS bundling (repeatable)" });
  compile.add_argument("--csproj", { help: "C# project file path (required for cs/both)" });
  compile.add_argument("--configuration", { choices: ["Debug", "Release"], default: "Release", help: "C# build configuration" });
  compile.add_argument("--framework", { help: "C# target framework (for example net8.0)" });

  return parser;
}

function parseArgs(argv) {
  const runtime = {};
  let pass1Parser;
  let pass1;
  try {
    pass1Parser = buildParser(DEFAULTS, runtime);
    pass1 = pass1Parser.parse_args(argv);
  } catch (e) {
    const quickArgs = {
      debug: argv.includes("--debug"),
      json: argv.includes("--json"),
      no_color: argv.includes("--no-color"),
    };
    die(pass1Parser || { prog: "world", print_help() {} }, quickArgs, e);
    return null;
  }

  const cfg = readJsonFileMaybe(pass1.config);
  if (cfg && cfg.__error) {
    die(pass1Parser, pass1, makeCliError(cfg.__error, EXIT.CONFIG));
    return null;
  }

  return { pass1Parser, pass1 };
}

function mergeConfig(pass1) {
  const envRaw = parseEnv(pass1.env_prefix || DEFAULTS.env_prefix);
  const supportedKeys = supportedConfigEnvKeys();
  const typeSchema = {
    verbose: "bool",
    json: "bool",
    no_color: "bool",
    debug: "bool",
    dry_run: "bool",
    timeout_ms: "int",
    host: "string",
    tickrate: "int",
    port: "int",
    port_base: "int",
    speed: "float",
    ticks: "int",
    replicas: "int",
  };

  const cfg = readJsonFileMaybe(pass1.config) || {};
  const unknownConfigKeys = Object.keys(cfg).filter((key) => !supportedKeys.has(key)).sort();
  const unknownEnvKeys = Object.keys(envRaw).filter((key) => !supportedKeys.has(key)).sort();
  const cfgTyped = coerceTypes(typeSchema, cfg);
  const envTyped = coerceTypes(typeSchema, envRaw);
  return {
    values: merge3(DEFAULTS, cfgTyped, envTyped),
    unknown: {
      config: unknownConfigKeys,
      env: unknownEnvKeys,
    },
  };
}

function buildFinalArgs(argv, pass1Parser, pass1, merged) {
  let parser;
  let args;
  try {
    const runtime = {};
    parser = buildParser(merged, runtime);
    args = parser.parse_args(argv);
  } catch (e) {
    die(parser || pass1Parser, pass1, e);
    return null;
  }

  args.state_dir = args.state_dir || merged.state_dir;
  args.pid_dir = args.pid_dir || merged.pid_dir;
  args.snapshot_dir = args.snapshot_dir || merged.snapshot_dir;
  args.cmd = normalizeCommandName(args.cmd);

  if (!args.cmd) {
    die(parser, args, makeCliError("no subcommand provided", EXIT.USAGE));
    return null;
  }

  return { parser, args };
}

async function executeCommand(args, merged) {
  if (args.verbose) {
    logLine(args, "info", "resolved args", {
      args: redactArgs(args),
      sources: { config: args.config || null, env_prefix: args.env_prefix },
    });

    if (merged && merged.unknown) {
      if (merged.unknown.config && merged.unknown.config.length > 0) {
        logLine(args, "warn", "unknown config keys detected", { keys: merged.unknown.config });
      }
      if (merged.unknown.env && merged.unknown.env.length > 0) {
        logLine(args, "warn", "unknown env keys detected", {
          prefix: args.env_prefix,
          keys: merged.unknown.env,
        });
      }
    }
  }

  try {
    switch (args.cmd) {
      case "serve":
        await cmdServe(args);
        break;
      case "scale":
        await cmdScale(args);
        break;
      case "drain":
        await cmdDrain(args);
        break;
      case "snapshot":
        await cmdSnapshot(args);
        break;
      case "replay":
        await cmdReplay(args);
        break;
      case "bake":
        await cmdBake(args);
        break;
      case "migrate-db":
        await cmdMigrateDb(args);
        break;
      case "doctor":
        if (!args.port && merged.values.port) args.port = merged.values.port;
        if (!args.host && merged.values.host) args.host = merged.values.host;
        await runDoctor(args);
        break;
      case "compile":
        await cmdCompile(args);
        break;
      default:
        throw makeCliError(`unknown command: ${args.cmd}`, EXIT.USAGE);
    }
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    if (args.debug) throw err;
    const rawCode = err && typeof err === "object" ? err.code : undefined;
    const code = typeof rawCode === "number" ? rawCode : EXIT.RUNTIME_FAIL;
    logLine(args, "error", err.message, args.verbose && err.stack ? { stack: err.stack } : undefined);
    process.exit(code);
  }
}

async function main(argv) {
  const parsed = parseArgs(argv);
  if (!parsed) return;

  const merged = mergeConfig(parsed.pass1);
  const final = buildFinalArgs(argv, parsed.pass1Parser, parsed.pass1, merged.values);
  if (!final) return;

  await executeCommand(final.args, merged);
  process.exit(EXIT.OK);
}

(async () => {
  await main(process.argv.slice(2));
})();
