import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as http from "node:http";
import * as path from "node:path";
import { WebSocketServer } from "ws";
import { IdleStateManager } from "./idle";


type BusEnvelopeV1 = {
  schema: { name: "bus.envelope"; version: "1.0.0" };
  id: string;
  type: string;
  ts: string;
  source: { system: string; module: string; instanceId?: string };
  trace?: { parentId?: string; sessionId?: string };
  payload: any;
};

const PORT = Number(process.env.BUS_WS_PORT ?? 8787);
const NOTES_DIR = process.env.BUS_NOTES_DIR ?? path.resolve(process.cwd(), "notes");
const EVENTS_PATH = process.env.BUS_EVENTS_PATH ?? path.join(NOTES_DIR, "events.jsonl");
const INTENTS_PATH = process.env.IDLE_INTENTS_PATH ?? path.join(NOTES_DIR, "idle_intents.json");
const HISTORY_MAX = Number(process.env.BUS_HISTORY_MAX ?? 500);

function utcNowIso(): string {
  // YYYY-MM-DDTHH:mm:ssZ
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function canonicalJson(obj: unknown): string {
  // stable stringify with sorted keys
  const sortKeys = (v: any): any => {
    if (Array.isArray(v)) return v.map(sortKeys);
    if (v && typeof v === "object") {
      const out: Record<string, any> = {};
      for (const k of Object.keys(v).sort()) out[k] = sortKeys(v[k]);
      return out;
    }
    return v;
  };
  return JSON.stringify(sortKeys(obj));
}

function sha256Hex(s: string): string {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

function safeJsonParse(line: string): BusEnvelopeV1 | null {
  try {
    const obj = JSON.parse(line);
    if (!obj || typeof obj !== "object") return null;
    if (!obj.id || !obj.type || !obj.schema) return null;
    return obj as BusEnvelopeV1;
  } catch {
    return null;
  }
}

function readLastNLines(filePath: string, n: number): string[] {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
  return lines.slice(Math.max(0, lines.length - n));
}

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function readJsonFile<T>(p: string, fallback: T): T {
  try {
    if (!fs.existsSync(p)) return fallback;
    const raw = fs.readFileSync(p, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJsonFile(p: string, obj: unknown) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

function appendJsonl(p: string, lineObj: unknown) {
  fs.appendFileSync(p, canonicalJson(lineObj) + "\n", "utf8");
}

function makeEnvelope(args: {
  type: string;
  payload: any;
  source_system: string;
  source_module: string;
  instance_id?: string;
  ts?: string;
  trace?: any;
}): BusEnvelopeV1 {
  const ts = args.ts ?? utcNowIso();
  const sourceBase = { system: args.source_system, module: args.source_module };
  const idMaterial = {
    type: args.type,
    source: sourceBase,
    payload: args.payload,
  };
  const id = sha256Hex(canonicalJson(idMaterial));

  const env: BusEnvelopeV1 = {
    schema: { name: "bus.envelope", version: "1.0.0" },
    id,
    type: args.type,
    ts,
    source: args.instance_id ? { ...sourceBase, instanceId: args.instance_id } : sourceBase,
    trace: args.trace ?? {},
    payload: args.payload,
  };
  return env;
}

function parseBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(new Error("invalid_json"));
      }
    });
  });
}

function json(res: http.ServerResponse, status: number, obj: any) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(obj, null, 2));
}

let broadcastFn: ((env: BusEnvelopeV1) => void) | null = null;

function makeServer() {
  ensureDir(NOTES_DIR);

  // Initialize idle state manager
  const idleManager = new IdleStateManager(NOTES_DIR);

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    // ---- Health / History ----
    if (req.method === "GET" && url.pathname === "/health") {
      return json(res, 200, { ok: true, eventsPath: EVENTS_PATH, intentsPath: INTENTS_PATH });
    }

    if (req.method === "GET" && url.pathname === "/history") {
      const n = Math.min(Number(url.searchParams.get("n") ?? "200"), HISTORY_MAX);
      const lines = readLastNLines(EVENTS_PATH, n);
      const envs = lines.map(safeJsonParse).filter(Boolean);
      return json(res, 200, { count: envs.length, events: envs });
    }

    // ---- Idle Intents (router output) ----
    if (req.method === "GET" && url.pathname === "/idle/intents") {
      const intents = readJsonFile<Record<string, any>>(INTENTS_PATH, {});
      return json(res, 200, { intents });
    }

    // ---- Idle State (per-mode state from Nucleus / Python) ----
    if (req.method === "GET" && url.pathname.startsWith("/idle/state")) {
      const mode = String(url.searchParams.get("mode") ?? "dream_idle").trim();
      const state = idleManager.getState(mode);
      return json(res, 200, { mode, state });
    }

    // ---- Idle Command Router endpoints ----
    // Emits COMMAND envelopes only: type = "idle.command.v1"
    // Effects (idle.effect.v1) are produced by Python guard, not Nucleus.
    // Body: { mode: "dream_idle", text?: "...", phrase?: "...", reason?: "...", ttlSeconds?: 3600 }
    if (
      req.method === "POST" &&
      (url.pathname === "/idle/prompt" || url.pathname === "/idle/approve" || url.pathname === "/idle/revoke")
    ) {
      let body: any;
      try {
        body = await parseBody(req);
      } catch {
        return json(res, 400, { error: "invalid_json" });
      }

      const mode = String(body?.mode ?? "dream_idle").trim();
      if (!mode) return json(res, 400, { error: "mode_required" });

      const instanceId = String(process.env.BUS_INSTANCE_ID ?? "nucleus").trim();

      let action: "prompt" | "approve" | "revoke";
      let args: any = {};

      if (url.pathname === "/idle/prompt") {
        action = "prompt";
        args = { text: String(body?.text ?? "").trim() };
      } else if (url.pathname === "/idle/approve") {
        action = "approve";
        args = {
          phrase: String(body?.phrase ?? "approve").trim(),
          ttlSeconds: Number(body?.ttlSeconds ?? 3600),
        };
      } else {
        action = "revoke";
        args = { reason: String(body?.reason ?? "revoked_by_user").trim() };
      }

      const payload = { mode, action, args };

      const env = makeEnvelope({
        type: "idle.command.v1",
        payload,
        source_system: "nucleus",
        source_module: "idle_command_router",
        instance_id: instanceId,
      });

      // Append to events.jsonl (unified bus stream)
      appendJsonl(EVENTS_PATH, env);

      // Broadcast live
      if (broadcastFn) broadcastFn(env);

      return json(res, 200, { ok: true, envelopeId: env.id, type: env.type, payload });
    }

    return json(res, 404, { error: "not_found" });
  });

  const wss = new WebSocketServer({ server, path: "/ws" });
  const clients = new Set<any>();
  const recentIds = new Set<string>();
  const recentIdQueue: string[] = [];

  function rememberId(id: string) {
    if (recentIds.has(id)) return;
    recentIds.add(id);
    recentIdQueue.push(id);
    while (recentIdQueue.length > HISTORY_MAX) {
      const old = recentIdQueue.shift();
      if (old) recentIds.delete(old);
    }
  }

  function broadcast(env: BusEnvelopeV1) {
    rememberId(env.id);
    const msg = JSON.stringify({ kind: "bus.envelope.v1", envelope: env });
    clients.forEach((ws) => {
      if (ws.readyState === ws.OPEN) ws.send(msg);
    });
  }

  broadcastFn = broadcast;

  wss.on("connection", (ws) => {
    clients.add(ws);

    ws.on("close", () => clients.delete(ws));
    ws.on("error", () => clients.delete(ws));

    // replay last 50
    const replayLines = readLastNLines(EVENTS_PATH, 50);
    const replay = replayLines.map(safeJsonParse).filter(Boolean) as BusEnvelopeV1[];
    for (const env of replay) {
      rememberId(env.id);
      ws.send(JSON.stringify({ kind: "bus.envelope.v1", envelope: env }));
    }

    ws.send(JSON.stringify({ kind: "bus.hello", eventsPath: EVENTS_PATH, intentsPath: INTENTS_PATH }));
  });

  // Tail follow: broadcast new appended lines from events.jsonl
  let lastSize = 0;
  function scanAppend() {
    try {
      if (!fs.existsSync(EVENTS_PATH)) return;
      const stat = fs.statSync(EVENTS_PATH);
      if (stat.size < lastSize) lastSize = 0;
      if (stat.size === lastSize) return;

      const fd = fs.openSync(EVENTS_PATH, "r");
      try {
        const bufSize = stat.size - lastSize;
        const buf = Buffer.allocUnsafe(bufSize);
        fs.readSync(fd, buf, 0, bufSize, lastSize);
        lastSize = stat.size;

        const chunk = buf.toString("utf8");
        const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);

        for (const line of lines) {
          const env = safeJsonParse(line);
          if (!env) continue;
          if (recentIds.has(env.id)) continue;

          // Apply idle effects to local state manager
          if (env.type === "idle.effect.v1" && env.payload) {
            const mode = env.payload.mode ?? "dream_idle";
            try {
              idleManager.applyEffect(mode, env.payload);
            } catch {
              // ignore effect application errors
            }
          }

          broadcast(env);
        }
      } finally {
        fs.closeSync(fd);
      }
    } catch {
      // keep alive
    }
  }

  setInterval(scanAppend, 250);

  server.listen(PORT, () => {
    console.log(`[bus] http://localhost:${PORT}`);
    console.log(`[bus] ws  ws://localhost:${PORT}/ws`);
    console.log(`[bus] events: ${EVENTS_PATH}`);
    console.log(`[bus] intents: ${INTENTS_PATH}`);
    console.log(`[bus] endpoints: POST /idle/prompt | /idle/approve | /idle/revoke`);
  });
}

makeServer();
