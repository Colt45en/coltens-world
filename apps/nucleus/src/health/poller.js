import { SYSTEM_CHANNEL, SYSTEM_HEALTH_EVENT_TYPE } from "@world-engine/protocol";
import { randomUUID } from "node:crypto";
function nowIso() {
    return new Date().toISOString();
}
function computeSummary(services) {
    if (services.some((s) => s.state === "down"))
        return "down";
    if (services.some((s) => s.state === "degraded"))
        return "degraded";
    if (services.every((s) => s.state === "up"))
        return "up";
    return "unknown";
}
async function checkSidecarHealth(target) {
    const started = Date.now();
    try {
        // Node 18+ has global fetch. If you're older, add undici.
        const res = await fetch(target, { method: "GET" });
        const latencyMs = Date.now() - started;
        if (!res.ok) {
            return {
                service: "sidecar",
                state: "down",
                reason: `HTTP ${res.status}`,
                target,
                latencyMs
            };
        }
        const json = (await res.json());
        // Accept flexible sidecar health shape, but enforce signal:
        // - must indicate ok/up and may include version.
        const ok = json?.ok === true ||
            json?.status === "ok" ||
            json?.state === "up" ||
            json?.up === true;
        if (!ok) {
            return {
                service: "sidecar",
                state: "degraded",
                reason: "Sidecar responded but did not report healthy",
                target,
                latencyMs,
                version: typeof json?.version === "string" ? json.version : undefined
            };
        }
        return {
            service: "sidecar",
            state: "up",
            target,
            latencyMs,
            version: typeof json?.version === "string" ? json.version : undefined
        };
    }
    catch (err) {
        const latencyMs = Date.now() - started;
        return {
            service: "sidecar",
            state: "down",
            reason: String(err?.message ?? err),
            target,
            latencyMs
        };
    }
}
function checkPreviewPresence(hub) {
    const connected = hub.isRoleConnected("preview");
    const count = hub.roleCount?.("preview");
    return {
        service: "preview",
        state: connected ? "up" : "down",
        reason: connected ? (typeof count === "number" ? `connected(${count})` : "connected") : "not connected",
        target: "ws://localhost:3000"
    };
}
function checkIdePresence(hub) {
    const connected = hub.isRoleConnected("ide");
    const count = hub.roleCount?.("ide");
    return {
        service: "ide",
        state: connected ? "up" : "down",
        reason: connected ? (typeof count === "number" ? `connected(${count})` : "connected") : "not connected",
        target: "ws://localhost:3000"
    };
}
function nucleusSelfHealth(version) {
    return {
        service: "nucleus",
        state: "up",
        reason: "running",
        target: "ws://localhost:3000",
        version
    };
}
export function startHealthPoller(cfg) {
    const intervalMs = cfg.intervalMs ?? 1000;
    const sidecarUrl = (cfg.sidecarBaseUrl ?? "http://127.0.0.1:8001").replace(/\/+$/, "");
    const sidecarHealthUrl = `${sidecarUrl}/health`;
    let seq = 0;
    let timer = null;
    let stopped = false;
    const tick = async () => {
        if (stopped)
            return;
        // Deterministic ordering of checks
        const services = [];
        services.push(nucleusSelfHealth(cfg.nucleusVersion));
        services.push(checkIdePresence(cfg.hubPresence));
        services.push(checkPreviewPresence(cfg.hubPresence));
        services.push(await checkSidecarHealth(sidecarHealthUrl));
        const snapshot = {
            schema: { name: "system.health.snapshot", version: "1.0.0" },
            id: `health.${randomUUID()}`,
            ts: nowIso(),
            sessionId: cfg.sessionId,
            seq: seq++,
            services,
            summary: computeSummary(services)
        };
        cfg.bus.publish({
            channel: SYSTEM_CHANNEL,
            type: SYSTEM_HEALTH_EVENT_TYPE,
            payload: snapshot,
            sessionId: cfg.sessionId,
            traceId: `trace.health.${snapshot.seq}`
        });
    };
    // fire immediately then interval
    void tick();
    timer = setInterval(() => void tick(), intervalMs);
    return {
        stop: () => {
            stopped = true;
            if (timer)
                clearInterval(timer);
            timer = null;
        }
    };
}
