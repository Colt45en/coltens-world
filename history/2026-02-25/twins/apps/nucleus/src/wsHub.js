import chokidar from "chokidar";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { EnvelopeSchema, nowMs, parseUEE, randomId } from "@world-engine/protocol";
import { chatHandler } from "./chat-handler.js";
import { createBusLikeAdapter, createHubPresenceAdapter } from "./health/adapter.js";
import { startHealthPoller } from "./health/poller.js";
import { VenoManager } from "./pty/venoManager";
import { getUEERouter } from "./router/uee.js";
import { handleChatRequestStreaming } from "./routes/chat.js";
import { SimRunner } from "./services/simRunner";
// Global tracking of active tool executors by sessionId
// Used to route tool.effect.v1 responses from IDE back to the executor
const toolExecutorsBySession = new Map();
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
function stableId(input) {
    let hash = 2166136261;
    for (let index = 0; index < input.length; index++) {
        hash ^= input.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
}
function createDefaultWorldGraphState() {
    return {
        time: 0,
        events_processed: 0,
        entities: [
            { id: stableId("entity:Player"), name: "Player", components: { transform: { x: 0, y: 0 } } },
            { id: stableId("entity:NPC"), name: "NPC", components: { transform: { x: 4, y: 2 } } },
        ],
        systems: [
            { name: "movement", every: 1 },
            { name: "collision", every: 1 },
        ],
    };
}
function decodeWorldGraphDescription(description) {
    const lines = description
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    const entities = [];
    const systems = [];
    for (const line of lines) {
        const entityMatch = /^entity\s+([A-Za-z0-9_-]+)/i.exec(line);
        if (entityMatch?.[1]) {
            const name = entityMatch[1];
            entities.push({
                id: stableId(`entity:${name}`),
                name,
                components: { generated: { dsl: true } },
            });
            continue;
        }
        const systemMatch = /^system\s+([A-Za-z0-9_-]+)(?:\s+every\s+(\d+))?/i.exec(line);
        if (systemMatch?.[1]) {
            const name = systemMatch[1];
            const everyRaw = systemMatch[2] ? Number.parseInt(systemMatch[2], 10) : 1;
            systems.push({ name, every: Number.isFinite(everyRaw) && everyRaw > 0 ? everyRaw : 1 });
        }
    }
    if (entities.length === 0 && systems.length === 0) {
        const words = description
            .split(/\W+/)
            .map((word) => word.trim())
            .filter((word) => word.length > 2)
            .slice(0, 5);
        for (const [index, word] of words.entries()) {
            entities.push({
                id: stableId(`entity:${word}:${index}`),
                name: word,
                components: { generated: { rank: index + 1 } },
            });
        }
        systems.push({ name: "analysis", every: 1 });
    }
    return {
        time: 0,
        events_processed: 0,
        entities,
        systems,
    };
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
        case "chat.request.v1":
            return ["cap:chat:send"];
        case "chat.request":
        case "brain.chat":
            return ["cap:chat:send"];
        case "world.graph.get_world_state":
            return ["cap:world-graph:read"];
        case "world.graph.start_simulation":
        case "world.graph.pause_simulation":
        case "world.graph.reset_world":
        case "world.graph.set_speed":
        case "world.graph.generate_world":
            return ["cap:world-graph:control"];
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
            "cap:chat:send", // Brain-driven chat system
            "cap:world-graph:read",
            "cap:world-graph:control",
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
            catch (err) {
                console.warn(`[wsHub] Broadcast to ${role} failed:`, err instanceof Error ? err.message : String(err));
                // Socket likely closed; client will reconnect on next attempt
            }
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
        let worldGraphSpeed = 1;
        let worldGraphRunning = false;
        let worldGraphStep = 0;
        let worldGraphState = createDefaultWorldGraphState();
        let worldGraphTickTimer = null;
        const clearWorldGraphTimer = () => {
            if (worldGraphTickTimer) {
                clearTimeout(worldGraphTickTimer);
                worldGraphTickTimer = null;
            }
        };
        const sendWorldGraph = (type, payload) => {
            send(ws, {
                v: 2,
                id: randomId("srv"),
                type,
                ts: nowMs(),
                from: { role: "nucleus", instanceId: HUB_INSTANCE_ID },
                sessionId,
                auth: { kind: "session", token: client.token },
                nonce: randomId("n"),
                payload,
            });
        };
        const tickWorldGraph = () => {
            if (!worldGraphRunning)
                return;
            worldGraphStep += 1;
            worldGraphState = {
                ...worldGraphState,
                time: worldGraphState.time + (1 / 60) * worldGraphSpeed,
                events_processed: worldGraphState.events_processed + 1,
            };
            sendWorldGraph("world.graph.simulation_step", {
                step: {
                    step: worldGraphStep,
                    timestamp: nowMs(),
                },
                world_state: worldGraphState,
            });
            const delay = Math.max(16, Math.floor(1000 / (60 * worldGraphSpeed)));
            worldGraphTickTimer = setTimeout(tickWorldGraph, delay);
        };
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
                    env.type === "chat.request.v1" ||
                    env.type === "chat.request" ||
                    env.type === "brain.chat" ||
                    env.type === "tool.effect.v1" ||
                    env.type === "ops.sim.status" ||
                    env.type === "world.graph.get_world_state" ||
                    env.type === "world.graph.start_simulation" ||
                    env.type === "world.graph.pause_simulation" ||
                    env.type === "world.graph.reset_world" ||
                    env.type === "world.graph.set_speed" ||
                    env.type === "world.graph.generate_world";
                if (!known)
                    return;
            }
            if (env.type === "world.graph.get_world_state") {
                sendWorldGraph("world.graph.world_state", { state: worldGraphState });
                return;
            }
            if (env.type === "world.graph.set_speed") {
                const payload = env.payload;
                worldGraphSpeed = payload.speed;
                sendWorldGraph("world.graph.success", { message: `World graph speed set to ${worldGraphSpeed}` });
                return;
            }
            if (env.type === "world.graph.start_simulation") {
                const payload = env.payload;
                if (payload.speed)
                    worldGraphSpeed = payload.speed;
                worldGraphRunning = true;
                clearWorldGraphTimer();
                sendWorldGraph("world.graph.success", { message: "World graph simulation started" });
                tickWorldGraph();
                return;
            }
            if (env.type === "world.graph.pause_simulation") {
                worldGraphRunning = false;
                clearWorldGraphTimer();
                sendWorldGraph("world.graph.success", { message: "World graph simulation paused" });
                return;
            }
            if (env.type === "world.graph.reset_world") {
                worldGraphRunning = false;
                clearWorldGraphTimer();
                worldGraphStep = 0;
                worldGraphState = createDefaultWorldGraphState();
                sendWorldGraph("world.graph.world_state", { state: worldGraphState });
                sendWorldGraph("world.graph.success", { message: "World graph reset" });
                return;
            }
            if (env.type === "world.graph.generate_world") {
                const payload = env.payload;
                try {
                    worldGraphState = decodeWorldGraphDescription(payload.description);
                    worldGraphStep = 0;
                    sendWorldGraph("world.graph.world_state", { state: worldGraphState });
                    sendWorldGraph("world.graph.simulation_event", {
                        event: {
                            timestamp: nowMs(),
                            level: "success",
                            message: `Generated world: ${worldGraphState.entities.length} entities, ${worldGraphState.systems.length} systems`,
                        },
                    });
                    sendWorldGraph("world.graph.success", { message: "World generated from description" });
                }
                catch (error) {
                    sendWorldGraph("world.graph.error", {
                        message: error instanceof Error ? error.message : "Failed to generate world",
                    });
                }
                return;
            }
            // ---- UEE task dispatch ----
            if (env.type === "uee") {
                // validate task envelope before routing (prevents weird inputs)
                const parsedUEE = parseUEE(env.payload);
                if (!parsedUEE.ok) {
                    const errorMsg = {
                        v: 2,
                        id: randomId("srv"),
                        type: "uee.error",
                        ts: nowMs(),
                        from: { role: "nucleus", instanceId: HUB_INSTANCE_ID },
                        sessionId,
                        auth: { kind: "session", token: client.token },
                        nonce: randomId("n"),
                        payload: { error: parsedUEE.message },
                    };
                    send(ws, errorMsg);
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
                    const successMsg = {
                        v: 2,
                        id: randomId("srv"),
                        type: "uee.response",
                        ts: nowMs(),
                        from: { role: "nucleus", instanceId: HUB_INSTANCE_ID },
                        sessionId,
                        auth: { kind: "session", token: client.token },
                        nonce: randomId("n"),
                        payload: response,
                    };
                    send(ws, successMsg);
                }
                catch (err) {
                    const errMsg = {
                        v: 2,
                        id: randomId("srv"),
                        type: "uee.error",
                        ts: nowMs(),
                        from: { role: "nucleus", instanceId: HUB_INSTANCE_ID },
                        sessionId,
                        auth: { kind: "session", token: client.token },
                        nonce: randomId("n"),
                        payload: { error: err instanceof Error ? err.message : String(err) },
                    };
                    send(ws, errMsg);
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
            // ---- chat request (streaming NDJSON) ----
            if (env.type === "chat.request.v1") {
                await handleChatRequestStreaming(ws, env, sessionId, client.token, HUB_INSTANCE_ID, toolExecutorsBySession);
                return;
            }
            // ---- chat request ----
            if (env.type === "chat.request") {
                await chatHandler.handleChatRequest(env, ws);
                return;
            }
            // ---- brain chat (streamed mode) ----
            if (env.type === "brain.chat") {
                await chatHandler.handleBrainChat(env, ws);
                return;
            }
            // ---- tool effect (IDE response to tool.command.v1) ----
            if (env.type === "tool.effect.v1") {
                const executor = toolExecutorsBySession.get(sessionId);
                if (executor) {
                    executor.handleToolEffectFromIde(env);
                }
                return;
            }
            // ---- ide.cli.run.request ----
            if (env.type === "ide.cli.run.request") {
                const p = env.payload;
                let exitCode = 0;
                let stdout = "";
                let stderr = "";
                let ok = true;
                try {
                    const cwd = p.cwd ? path.resolve(p.cwd) : process.cwd();
                    // Execute command synchronously with timeout
                    const result = execSync(p.command, {
                        cwd,
                        encoding: "utf8",
                        timeout: p.timeoutMs,
                        stdio: ["pipe", "pipe", "pipe"],
                    });
                    stdout = result;
                }
                catch (err) {
                    ok = false;
                    exitCode = err.status ?? 1;
                    stdout = err.stdout?.toString() ?? "";
                    stderr = err.stderr?.toString() ?? err.message ?? "Unknown error";
                }
                send(ws, {
                    v: 2,
                    id: randomId("srv"),
                    type: "ide.cli.run.response",
                    ts: nowMs(),
                    from: { role: "nucleus", instanceId: HUB_INSTANCE_ID },
                    sessionId,
                    auth: { kind: "session", token: client.token },
                    nonce: randomId("n"),
                    payload: { ok, exitCode, stdout, stderr },
                });
                return;
            }
            // ---- ide.fs.read.request ----
            if (env.type === "ide.fs.read.request") {
                const p = env.payload;
                let ok = true;
                let content;
                let error;
                try {
                    const filePath = path.resolve(p.path);
                    // Read file with size limit
                    const stats = fs.statSync(filePath);
                    if (stats.size > p.maxBytes) {
                        throw new Error(`File size (${stats.size} bytes) exceeds limit (${p.maxBytes} bytes)`);
                    }
                    content = fs.readFileSync(filePath, p.encoding);
                }
                catch (err) {
                    ok = false;
                    error = err.message ?? "Unknown error";
                }
                send(ws, {
                    v: 2,
                    id: randomId("srv"),
                    type: "ide.fs.read.response",
                    ts: nowMs(),
                    from: { role: "nucleus", instanceId: HUB_INSTANCE_ID },
                    sessionId,
                    auth: { kind: "session", token: client.token },
                    nonce: randomId("n"),
                    payload: { ok, path: p.path, content, error },
                });
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
            worldGraphRunning = false;
            clearWorldGraphTimer();
            veno.closeAllForSession(sessionId);
            clients.delete(client);
        });
    });
    // ---- Health Poller ----
    // Start polling system health and broadcast to IDE clients
    const hubPresence = createHubPresenceAdapter(clients);
    const busLike = createBusLikeAdapter(broadcastTo);
    const sessionId = `nucleus.${HUB_INSTANCE_ID}`;
    startHealthPoller({
        bus: busLike,
        hubPresence,
        sessionId,
        sidecarBaseUrl: process.env.SIDECAR_URL ?? "http://127.0.0.1:8001",
        intervalMs: 1000,
        nucleusVersion: process.env.npm_package_version
    });
}
