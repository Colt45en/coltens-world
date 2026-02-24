#!/usr/bin/env node
/**
 * World Engine Master Launcher (Engine-Grade)
 *
 * - Prefixes every line with [SERVICE]
 * - Waits for each service to become READY (port + optional HTTP health)
 * - Cross-platform shutdown of full process trees
 *
 * Usage:
 *   node scripts/launch-all.mjs
 *   node scripts/launch-all.mjs --parallel
 *   node scripts/launch-all.mjs --no-preview
 *   node scripts/launch-all.mjs --no-python
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import net from "node:net";
import http from "node:http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = dirname(__dirname);

const isWin = process.platform === "win32";

// ----------------------------
// ANSI colors (simple + stable)
// ----------------------------
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m",
  red: "\x1b[31m",
};

function nowIso() {
  return new Date().toISOString();
}

function padRight(str, n) {
  return (str + " ".repeat(n)).slice(0, n);
}

// ---------------------------------
// CLI flags (minimal, deterministic)
// ---------------------------------
const argv = new Set(process.argv.slice(2));
const FLAG_PARALLEL = argv.has("--parallel");
const FLAG_NO_PREVIEW = argv.has("--no-preview");
const FLAG_NO_PYTHON = argv.has("--no-python");

// ----------------------------
// Python executable resolution
// ----------------------------
function resolvePython() {
  // Prefer venv under apps/py-sidecar
  const venvPythonWin = join(
    rootDir,
    "apps",
    "py-sidecar",
    ".venv",
    "Scripts",
    "python.exe"
  );
  const venvPythonUnix = join(
    rootDir,
    "apps",
    "py-sidecar",
    ".venv",
    "bin",
    "python"
  );

  if (existsSync(venvPythonWin)) {
    return { cmd: venvPythonWin, argsPrefix: [] };
  }
  if (existsSync(venvPythonUnix)) {
    return { cmd: venvPythonUnix, argsPrefix: [] };
  }

  // Fallback to py -3.12 on Windows; otherwise plain python3/python
  if (isWin) {
    return { cmd: "py", argsPrefix: ["-3.12"] };
  }

  // On unix, try python3 first then python
  return { cmd: "python3", argsPrefix: [] };
}

// ----------------------------
// Readiness checks
// ----------------------------
function waitForTcpPort({ host, port, timeoutMs }) {
  const started = Date.now();

  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const socket = new net.Socket();
      socket.setTimeout(1000);

      socket.once("connect", () => {
        socket.destroy();
        resolve();
      });

      const onFail = () => {
        socket.destroy();
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`Timeout waiting for TCP ${host}:${port}`));
          return;
        }
        setTimeout(tryOnce, 250);
      };

      socket.once("error", onFail);
      socket.once("timeout", onFail);
      socket.connect(port, host);
    };

    tryOnce();
  });
}

function httpGet({ url, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      const { statusCode } = res;
      // drain response
      res.resume();
      resolve({ statusCode: statusCode ?? 0 });
    });
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error("HTTP timeout"));
    });
    req.on("error", reject);
  });
}

async function waitForHttpOk({ url, timeoutMs, acceptStatus = [200, 204] }) {
  const started = Date.now();
  while (true) {
    try {
      const { statusCode } = await httpGet({ url, timeoutMs: 1500 });
      if (acceptStatus.includes(statusCode)) return;
    } catch {
      // ignore and retry
    }
    if (Date.now() - started > timeoutMs) {
      throw new Error(`Timeout waiting for HTTP OK: ${url}`);
    }
    await new Promise((r) => setTimeout(r, 300));
  }
}

async function waitForHttpOkOrFallback({
  url,
  healthTimeoutMs,
  acceptStatus = [200, 204],
  onFallback,
}) {
  const started = Date.now();
  while (true) {
    try {
      const { statusCode } = await httpGet({ url, timeoutMs: 1500 });
      if (acceptStatus.includes(statusCode)) return { ok: true, statusCode };
    } catch {
      // ignore and retry
    }

    if (Date.now() - started > healthTimeoutMs) {
      onFallback?.();
      return { ok: false };
    }

    await new Promise((r) => setTimeout(r, 300));
  }
}

// ---------------------------------
// Service definition (engine style)
// ---------------------------------
function makeServices() {
  const py = resolvePython();

  /** @type {Array<{
   *  name: string,
   *  color: string,
   *  cmd: string,
   *  args: string[],
   *  cwd: string,
   *  port: number,
   *  ready: { kind: "tcp" } | { kind: "http", url: string, acceptStatus?: number[] },
   *  env?: Record<string,string>,
   * }>} */
  const list = [
    {
      name: "NUCLEUS",
      color: colors.cyan,
      cmd: "pnpm",
      args: ["--filter", "./apps/nucleus", "run", "dev"],
      cwd: rootDir,
      port: 3000,
      ready: {
        kind: "http_fallback",
        url: "http://127.0.0.1:3000/health",
        acceptStatus: [200],
        healthTimeoutMs: 10_000,
      },
      env: { FORCE_COLOR: "1" },
    },
    {
      name: "IDE-WEB",
      color: colors.green,
      cmd: "pnpm",
      args: ["--filter", "./apps/ide-web", "run", "dev", "--", "--port", "5173"],
      cwd: rootDir,
      port: 5173,
      ready: { kind: "http", url: "http://127.0.0.1:5173/", acceptStatus: [200, 304] },
      env: { FORCE_COLOR: "1" },
    },
  ];

  if (!FLAG_NO_PREVIEW) {
    list.push({
      name: "PREVIEW",
      color: colors.magenta,
      cmd: "pnpm",
      args: ["--filter", "./apps/preview-runtime", "run", "dev", "--", "--port", "5174"],
      cwd: rootDir,
      port: 5174,
      ready: { kind: "http", url: "http://127.0.0.1:5174/", acceptStatus: [200, 304] },
      env: { FORCE_COLOR: "1" },
    });
  }

  if (!FLAG_NO_PYTHON) {
    list.push({
      name: "PYTHON",
      color: colors.yellow,
      cmd: py.cmd,
      args: [
        ...py.argsPrefix,
        "-m",
        "uvicorn",
        "app.main:app",
        "--host",
        "127.0.0.1",
        "--port",
        "8001",
        "--reload",
      ],
      cwd: join(rootDir, "apps/py-sidecar"),
      port: 8001,
      // If you add a health route, switch to HTTP health
      ready: { kind: "tcp" },
      env: { FORCE_COLOR: "1" },
    });
  }

  return list;
}

const services = makeServices();

// ----------------------------
// Logging with prefixes (real)
// ----------------------------
const NAME_COL_WIDTH = 9;

function prefix(service) {
  const tag = padRight(service.name, NAME_COL_WIDTH);
  return `${service.color}[${tag}]${colors.reset}`;
}

function log(service, msg) {
  process.stdout.write(`${prefix(service)} ${msg}\n`);
}

function logSys(msg) {
  process.stdout.write(`${colors.blue}[SYSTEM]${colors.reset} ${msg}\n`);
}

function logErr(service, msg) {
  process.stderr.write(`${prefix(service)} ${colors.red}${msg}${colors.reset}\n`);
}

// ----------------------------
// Process management
// ----------------------------
/** @type {Array<{service:any, child: import("node:child_process").ChildProcess}>} */
const children = [];
let shuttingDown = false;

function spawnService(service) {
  log(service, `${colors.dim}${nowIso()}${colors.reset} starting…`);

  // NOTE:
  // - shell:false so we can capture stdout/stderr and prefix
  // - On Windows, pnpm.cmd is required sometimes when shell=false
  const cmd = isWin && service.cmd === "pnpm" ? "pnpm.cmd" : service.cmd;

  // Debug: log the exact command being spawned
  const cmdStr = `${cmd} ${service.args.join(" ")}`;
  log(service, `${colors.dim}spawn: ${cmdStr}${colors.reset}`);
  log(service, `${colors.dim}cwd: ${service.cwd}${colors.reset}`);

  const child = spawn(cmd, service.args, {
    cwd: service.cwd,
    env: {
      ...process.env,
      ...(service.env ?? {}),
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    shell: true, // Use shell on all platforms to avoid spawn EINVAL on Windows
  });

  children.push({ service, child });

  child.on("error", (err) => {
    logErr(service, `spawn error: ${err.message}`);
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    logErr(service, `exited (code=${code ?? "?"} signal=${signal ?? "?"})`);
  });

  // Prefix stdout/stderr lines
  child.stdout?.setEncoding("utf8");
  child.stderr?.setEncoding("utf8");

  let outBuf = "";
  let errBuf = "";

  child.stdout?.on("data", (chunk) => {
    outBuf += chunk;
    let idx;
    while ((idx = outBuf.indexOf("\n")) >= 0) {
      const line = outBuf.slice(0, idx).replace(/\r$/, "");
      outBuf = outBuf.slice(idx + 1);
      if (line.length) log(service, line);
    }
  });

  child.stderr?.on("data", (chunk) => {
    errBuf += chunk;
    let idx;
    while ((idx = errBuf.indexOf("\n")) >= 0) {
      const line = errBuf.slice(0, idx).replace(/\r$/, "");
      errBuf = errBuf.slice(idx + 1);
      if (line.length) logErr(service, line);
    }
  });

  return child;
}

async function waitReady(service) {
  const host = "127.0.0.1";
  const timeoutMs = 60_000;

  log(service, `${colors.dim}${nowIso()}${colors.reset} waiting for readiness…`);

  // Always wait for port open first (fast + reliable)
  await waitForTcpPort({ host, port: service.port, timeoutMs });

  if (service.ready.kind === "http") {
    await waitForHttpOk({
      url: service.ready.url,
      timeoutMs,
      acceptStatus: service.ready.acceptStatus ?? [200, 204],
    });
  }

  if (service.ready.kind === "http_fallback") {
    const url = service.ready.url;
    const acceptStatus = service.ready.acceptStatus ?? [200, 204];
    const healthTimeoutMs = service.ready.healthTimeoutMs ?? 10_000;

    const res = await waitForHttpOkOrFallback({
      url,
      acceptStatus,
      healthTimeoutMs,
      onFallback: () => {
        log(
          service,
          `${colors.yellow}WARN${colors.reset} health not ready after ${Math.floor(
            healthTimeoutMs / 1000
          )}s → continuing with TCP readiness only (${url})`
        );
      },
    });

    if (res.ok) {
      log(service, `${colors.green}HEALTH${colors.reset} OK (${url})`);
    }
  }

  log(service, `${colors.green}READY${colors.reset} on port ${service.port}`);
}

// Cross-platform tree kill
function killTree(child) {
  if (!child || child.killed) return;

  if (isWin) {
    // taskkill /T kills child tree; /F forces
    const pid = child.pid;
    if (!pid) return;
    spawn("taskkill", ["/PID", String(pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }

  // On unix: kill the process group if detached
  try {
    if (child.pid) process.kill(-child.pid, "SIGTERM");
  } catch {
    // fallback to direct
    try {
      child.kill("SIGTERM");
    } catch {}
  }
}

// ----------------------------
// Launch + Shutdown
// ----------------------------
async function launchAll() {
  process.stdout.write(`
${colors.bright}${colors.cyan}╔════════════════════════════════════════╗${colors.reset}
${colors.bright}${colors.cyan}║   WORLD ENGINE - MASTER LAUNCHER       ║${colors.reset}
${colors.bright}${colors.cyan}╚════════════════════════════════════════╝${colors.reset}

${colors.dim}Order:${colors.reset}
  1) Nucleus → ws://127.0.0.1:3000
  2) IDE Web → http://127.0.0.1:5173
  3) Preview → http://127.0.0.1:5174 ${FLAG_NO_PREVIEW ? "(disabled)" : ""}
  4) Python → http://127.0.0.1:8001 ${FLAG_NO_PYTHON ? "(disabled)" : ""}

${colors.dim}Mode:${colors.reset} ${FLAG_PARALLEL ? "parallel (starts together, still waits readiness in background)" : "sequential (waits readiness before starting next)"}
${colors.dim}Press Ctrl+C to stop all services${colors.reset}
${colors.dim}─────────────────────────────────────────────${colors.reset}
`);

  if (FLAG_PARALLEL) {
    // Start all immediately
    for (const s of services) spawnService(s);

    // Then await readiness for all (fail fast)
    await Promise.all(services.map((s) => waitReady(s)));
  } else {
    for (const s of services) {
      spawnService(s);
      await waitReady(s); // gate next start on readiness
    }
  }

  process.stdout.write(`
${colors.bright}${colors.green}╔════════════════════════════════════════╗${colors.reset}
${colors.bright}${colors.green}║         ALL SERVICES READY ✅          ║${colors.reset}
${colors.bright}${colors.green}╚════════════════════════════════════════╝${colors.reset}

${colors.cyan}🌐 IDE:${colors.reset}      http://127.0.0.1:5173
${colors.cyan}🔌 WS Hub:${colors.reset}  ws://127.0.0.1:3000
${colors.cyan}🎮 Preview:${colors.reset}  http://127.0.0.1:5174
${colors.cyan}🐍 Python:${colors.reset}   http://127.0.0.1:8001

${colors.dim}Logs streaming below…${colors.reset}
${colors.dim}─────────────────────────────────────────────${colors.reset}
`);
}

async function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  process.stdout.write(`
${colors.yellow}╔════════════════════════════════════════╗${colors.reset}
${colors.yellow}║      SHUTTING DOWN (TREE KILL)…        ║${colors.reset}
${colors.yellow}╚════════════════════════════════════════╝${colors.reset}
`);

  for (const { service, child } of children) {
    log(service, "stopping…");
    killTree(child);
  }

  // Give some time to die cleanly
  await new Promise((r) => setTimeout(r, 2000));

  process.stdout.write(`${colors.green}✓ stopped${colors.reset}\n`);
  process.exit(exitCode);
}

// signals
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

// If parent crashes, try to stop children
process.on("uncaughtException", (err) => {
  logSys(`${colors.red}uncaughtException:${colors.reset} ${err?.stack ?? err?.message ?? String(err)}`);
  shutdown(2);
});
process.on("unhandledRejection", (err) => {
  logSys(`${colors.red}unhandledRejection:${colors.reset} ${err?.stack ?? err?.message ?? String(err)}`);
  shutdown(2);
});

// start
launchAll().catch((err) => {
  logSys(`${colors.red}launch failed:${colors.reset} ${err?.message ?? String(err)}`);
  shutdown(1);
});
