import chokidar from "chokidar";
import path from "node:path";
import { EnvelopeSchema, nowMs, randomId, parseUEE } from "@world-engine/protocol";
import { VenoManager } from "./pty/venoManager";
import { getUEERouter } from "./router/uee.js";
import { SimRunner } from "./services/simRunner";
function safeJsonParse(s) {
    try {
        return JSON.parse(s);
    }
    catch {
        return null;
    }
}
function send(ws, env) {
    ws.send(JSON.stringify(env));
}
/**
 * ---- Security policy knobs ----
 */
const HUB_INSTANCE_ID = "nucleus_1";
const MAX_PAYLOAD_BYTES = 256 * 1024; // 256KB (raise later if needed)
const CLOCK_SKEW_MS = 60_000; // +/- 60s window
const NONCE_TTL_MS = 60_000; // keep seen nonces for 60s
// Simple token bucket: allow ~120 msgs / 10s burst, refill smoothly
const RL_BUCKET_MAX = 120;
const RL_REFILL_PER_SEC = 12;
function setHasAny(caps, required) {
    for (const r of required)
        if (caps.has(r))
            return true;
    return false;
}
function refillRateLimit(c, now) {
    const dtSec = Math.max(0, (now - c.rlLastRefillMs) / 1000);
    if (dtSec <= 0)
        return;
    c.rlTokens = Math.min(RL_BUCKET_MAX, c.rlTokens + dtSec * RL_REFILL_PER_SEC);
    c.rlLastRefillMs = now;
}
function consumeToken(c) {
    if (c.rlTokens < 1)
        return false;
    c.rlTokens -= 1;
    return true;
}
function pruneNonces(c, now) {
    // prevent unbounded growth
    if (c.nonceSeen.size <= 512)
        return;
    for (const [nonce, exp] of c.nonceSeen) {
        if (exp <= now)
            c.nonceSeen.delete(nonce);
        if (c.nonceSeen.size <= 384)
            break;
    }
}
function verifyNonce(c, nonce, now) {
    pruneNonces(c, now);
    const existingExp = c.nonceSeen.get(nonce);
    if (existingExp && existingExp > now)
        return false; // replay
    c.nonceSeen.set(nonce, now + NONCE_TTL_MS);
    return true;
}
function requireCapOrReject(c, ws, sessionId, required, reason) {
    if (setHasAny(c.caps, required))
        return true;
    // structured error back to caller
    const env = {
        v: 2,
        id: randomId("srv"),
        type: "system.error",
        ts: nowMs(),
        from: { role: "nucleus", instanceId: HUB_INSTANCE_ID },
        sessionId,
        payload: {
            code: "CAP_DENIED",
            message: reason,
            requiredCaps: required,
        },
    };
    try {
        ws.send(JSON.stringify(env));
    }
    catch { }
    return false;
}
function requiredCapsForMessageType(type) {
    // One canonical mapping.
    // NOTE: you can tune names later; the point is stable gating.
    switch (type) {
        case "uee":
            return ["cap:uee:invoke"];
        case "pty.open":
        case "pty.input":
        case "pty.resize":
            return ["cap:pty:write"];
        case "ops.sim.start":
        case "ops.sim.stop":
            return ["cap:sim:control"];
        case "ops.sim.status":
            return ["cap:sim:read"];
        case "preview.stats":
            return ["cap:preview:write"];
        case "preview.ping":
            return ["cap:preview:write"];
        default:
            // By default, require nothing for unknown types (or block them if you prefer).
            // Safer option is to block unknown types explicitly.
            return [];
    }
}
function requiredCapsForTaskType(taskType) {
    switch (taskType) {
        case "brain_control":
            return ["cap:brain:control"];
        case "brain_train":
            return ["cap:brain:train"];
        case "lexicon_op":
            return ["cap:lexicon:write"];
        case "hce_run":
            return ["cap:hce:run"];
        case "scene_gen":
            return ["cap:scene:gen"];
        case "analyze_sentence":
            return ["cap:analyze:run"];
        default:
            return ["cap:uee:invoke"];
    }
}
function grantCapsForRole(role) {
    // This is the real source of truth. Client "caps" are ignored.
    if (role === "ide") {
        return [
            "cap:uee:invoke",
            "cap:pty:write",
            "cap:sim:control",
            "cap:sim:read",
            "cap:preview:read", // IDE receives preview stats
            "cap:files:read", // later: files.list, etc.
            // OPTIONAL: allow IDE to train (maybe too strong; you decide)
            "cap:brain:control",
            "cap:brain:train",
            "cap:lexicon:write",
            "cap:analyze:run",
        ];
    }
    if (role === "preview") {
        return [
            "cap:preview:write", // can emit stats/ping/pong
            "cap:uee:invoke", // OPTIONAL: remove if preview should never call UEE
        ];
    }
    return [];
}
export function createHub(wss) {
    const veno = new VenoManager();
    const sim = new SimRunner();
    let nextSession = 1;
    const clients = new Set();
    function broadcastTo(role, env) {
        for (const c of clients) {
            if (c.role !== role)
                continue;
            try {
                c.ws.send(JSON.stringify(env));
            }
            catch { }
        }
    }
    // ---- Sim event handlers ----
    sim.on("log", (ev) => {
        const env = {
            v: 2,
            id: randomId("srv"),
            type: "sim.log",
            ts: nowMs(),
            from: { role: "nucleus", instanceId: HUB_INSTANCE_ID },
            sessionId: "broadcast",
            payload: { level: ev.level, line: ev.line, ts: ev.ts },
        };
        broadcastTo("ide", env);
    });
    sim.on("start", (ev) => {
        const env = {
            v: 2,
            id: randomId("srv"),
            type: "sim.start",
            ts: nowMs(),
            from: { role: "nucleus", instanceId: HUB_INSTANCE_ID },
            sessionId: "broadcast",
            payload: { simId: ev.simId, port: ev.port },
        };
        broadcastTo("ide", env);
    });
    sim.on("done", (ev) => {
        const env = {
            v: 2,
            id: randomId("srv"),
            type: "sim.done",
            ts: nowMs(),
            from: { role: "nucleus", instanceId: HUB_INSTANCE_ID },
            sessionId: "broadcast",
            payload: {
                ok: ev.ok,
                code: ev.code,
                durationMs: ev.ts - (sim.startTime ?? 0),
            },
        };
        broadcastTo("ide", env);
    });
    // --- File watcher (repo root) ---
    const repoRoot = path.resolve(process.cwd(), "../..");
    const watcher = chokidar.watch(repoRoot, {
        ignoreInitial: true,
        ignored: [
            "**/node_modules/**",
            "**/.git/**",
            "**/dist/**",
            "**/.next/**",
            "**/.turbo/**",
            "**/.vite/**",
            "**/.cache/**",
            "**/coverage/**",
            "**/tools/veno/**",
        ],
    });
    watcher.on("all", (event, changedPath) => {
        let kind;
        if (event === "add")
            kind = "add";
        else if (event === "unlink")
            kind = "unlink";
        else
            kind = "change";
        const env = {
            v: 2,
            id: randomId("srv"),
            type: "files.changed",
            ts: nowMs(),
            from: { role: "nucleus", instanceId: HUB_INSTANCE_ID },
            sessionId: "broadcast",
            payload: { path: changedPath, kind, ts: nowMs() },
        };
        broadcastTo("ide", env);
    });
    wss.on("connection", (ws) => {
        const sessionId = `sess_${nextSession++}`;
        const instanceId = randomId("client");
        const token = randomId("tok"); // session token (server-issued)
        const client = {
            ws,
            sessionId,
            instanceId,
            role: "unknown",
            token,
            caps: new Set(),
            nonceSeen: new Map(),
            rlTokens: RL_BUCKET_MAX,
            rlLastRefillMs: nowMs(),
        };
        clients.add(client);
        ws.on("message", async (buf) => {
            // --- size guard (raw) ---
            const raw = typeof buf === "string" ? buf : buf.toString("utf8");
            if (raw.length > MAX_PAYLOAD_BYTES)
                return;
            const parsed = safeJsonParse(raw);
            const checked = EnvelopeSchema.safeParse(parsed);
            if (!checked.success)
                return;
            const env = checked.data;
            const now = nowMs();
            // --- rate limit (per session) ---
            refillRateLimit(client, now);
            if (!consumeToken(client))
                return;
            // ---- handshake (ONLY message allowed without auth+nonce) ----
            if (env.type === "system.hello") {
                const requested = env.payload?.requestedRole;
                // DO NOT trust arbitrary roles
                const role = requested === "ide" || requested === "preview" ? requested : "unknown";
                client.role = role;
                const caps = grantCapsForRole(role);
                client.caps = new Set(caps);
                // Welcome includes the token the client must use on every subsequent message
                send(ws, {
                    v: 2,
                    id: randomId("srv"),
                    type: "system.welcome",
                    ts: now,
                    from: { role: "nucleus", instanceId: HUB_INSTANCE_ID },
                    sessionId,
                    auth: { kind: "session", token },
                    payload: {
                        assignedInstanceId: instanceId,
                        caps,
                        serverTimeMs: now,
                        policy: {
                            maxPayloadBytes: MAX_PAYLOAD_BYTES,
                            clockSkewMs: CLOCK_SKEW_MS,
                            nonceTtlMs: NONCE_TTL_MS,
                            rateLimit: {
                                bucketMax: RL_BUCKET_MAX,
                                refillPerSec: RL_REFILL_PER_SEC,
                            },
                        },
                    },
                });
                return;
            }
            // --- require session binding ---
            if (env.sessionId !== sessionId)
                return;
            // --- require auth ---
            const auth = env.auth;
            if (!auth || auth.kind !== "session" || auth.token !== client.token) {
                return;
            }
            // --- require nonce + replay protection ---
            const nonce = env.nonce;
            if (!nonce || typeof nonce !== "string")
                return;
            if (!verifyNonce(client, nonce, now))
                return;
            // --- clock skew guard ---
            const dt = Math.abs(now - env.ts);
            if (dt > CLOCK_SKEW_MS)
                return;
            // --- capability gating by message type ---
            const msgCaps = requiredCapsForMessageType(env.type);
            if (msgCaps.length > 0) {
                const ok = requireCapOrReject(client, ws, sessionId, msgCaps, `Denied message type "${env.type}".`);
                if (!ok)
                    return;
            }
            else {
                // Safer default: block unknown message types after handshake
                // (prevents "new type" from silently becoming an attack path)
                // If you want permissive mode, delete this block.
                const known = env.type === "uee" ||
                    env.type === "pty.open" ||
                    env.type === "pty.resize" ||
                    env.type === "pty.input" ||
                    env.type === "preview.ping" ||
                    env.type === "preview.stats" ||
                    env.type === "ops.sim.start" ||
                    env.type === "ops.sim.stop" ||
                    env.type === "ops.sim.status";
                if (!known)
                    return;
            }
            // ---- UEE task dispatch ----
            if (env.type === "uee") {
                // validate task envelope before routing (prevents weird inputs)
                const parsedUEE = parseUEE(env.payload);
                if (!parsedUEE.ok) {
                    send(ws, {
                        v: 2,
                        id: randomId("srv"),
                        type: "uee.error",
                        ts: nowMs(),
                        from: { role: "nucleus", instanceId: HUB_INSTANCE_ID },
                        sessionId,
                        auth: { kind: "session", token: client.token },
                        nonce: randomId("n"),
                        payload: { error: parsedUEE.message },
                    });
                    return;
                }
                const taskType = parsedUEE.envelope.task.type;
                const taskCaps = requiredCapsForTaskType(taskType);
                if (!requireCapOrReject(client, ws, sessionId, taskCaps, `Denied task "${taskType}".`)) {
                    return;
                }
                try {
                    const router = getUEERouter();
                    const response = await router.route(env.payload, sessionId);
                    send(ws, {
                        v: 2,
                        id: randomId("srv"),
                        type: "uee.response",
                        ts: nowMs(),
                        from: { role: "nucleus", instanceId: HUB_INSTANCE_ID },
                        sessionId,
                        auth: { kind: "session", token: client.token },
                        nonce: randomId("n"),
                        payload: response,
                    });
                }
                catch (err) {
                    send(ws, {
                        v: 2,
                        id: randomId("srv"),
                        type: "uee.error",
                        ts: nowMs(),
                        from: { role: "nucleus", instanceId: HUB_INSTANCE_ID },
                        sessionId,
                        auth: { kind: "session", token: client.token },
                        nonce: randomId("n"),
                        payload: { error: err instanceof Error ? err.message : String(err) },
                    });
                }
                return;
            }
            // ---- PTY open ----
            if (env.type === "pty.open") {
                const p = env.payload;
                if (p.program !== "veno")
                    return;
                const opened = await veno.openVeno(sessionId, {
                    cols: p.cols,
                    rows: p.rows,
                    onData: (ptyId, data) => {
                        send(ws, {
                            v: 2,
                            id: randomId("srv"),
                            type: "pty.output",
                            ts: nowMs(),
                            from: { role: "nucleus", instanceId: HUB_INSTANCE_ID },
                            sessionId,
                            auth: { kind: "session", token: client.token },
                            nonce: randomId("n"),
                            payload: { ptyId, data },
                        });
                    },
                });
                send(ws, {
                    v: 2,
                    id: randomId("srv"),
                    type: "pty.opened",
                    ts: nowMs(),
                    from: { role: "nucleus", instanceId: HUB_INSTANCE_ID },
                    sessionId,
                    auth: { kind: "session", token: client.token },
                    nonce: randomId("n"),
                    payload: { ptyId: opened },
                });
                return;
            }
            // ---- PTY resize ----
            if (env.type === "pty.resize") {
                const p = env.payload;
                veno.resize(p.ptyId, p.cols, p.rows);
                return;
            }
            // ---- PTY input ----
            if (env.type === "pty.input") {
                const p = env.payload;
                veno.write(p.ptyId, p.data);
                return;
            }
            // ---- preview ping/pong ----
            if (env.type === "preview.ping") {
                const p = env.payload;
                send(ws, {
                    v: 2,
                    id: randomId("srv"),
                    type: "preview.pong",
                    ts: nowMs(),
                    from: { role: "nucleus", instanceId: HUB_INSTANCE_ID },
                    sessionId,
                    auth: { kind: "session", token: client.token },
                    nonce: randomId("n"),
                    payload: { n: p.n },
                });
                return;
            }
            // ---- preview.stats: broadcast to IDE ----
            if (env.type === "preview.stats") {
                const p = env.payload;
                const broadcast = {
                    v: 2,
                    id: randomId("srv"),
                    type: "preview.stats",
                    ts: nowMs(),
                    from: { role: "nucleus", instanceId: HUB_INSTANCE_ID },
                    sessionId: "broadcast",
                    payload: p,
                };
                broadcastTo("ide", broadcast);
                return;
            }
            // ---- ops.sim.start ----
            if (env.type === "ops.sim.start") {
                const p = env.payload;
                sim.request({ mode: p.mode ?? "dev", port: p.port ?? 4010 });
                return;
            }
            // ---- ops.sim.stop ----
            if (env.type === "ops.sim.stop") {
                sim.stop();
                return;
            }
            // ---- ops.sim.status ----
            if (env.type === "ops.sim.status") {
                const status = sim.getStatus();
                send(ws, {
                    v: 2,
                    id: randomId("srv"),
                    type: "ops.sim.status.reply",
                    ts: nowMs(),
                    from: { role: "nucleus", instanceId: HUB_INSTANCE_ID },
                    sessionId,
                    auth: { kind: "session", token: client.token },
                    nonce: randomId("n"),
                    payload: status,
                });
                return;
            }
        });
        ws.on("close", () => {
            veno.closeAllForSession(sessionId);
            clients.delete(client);
        });
    });
}
