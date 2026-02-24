import fs from "node:fs";
import path from "node:path";
import { ensureDir } from "./storage";

export type AuditEvent =
    | {
        type: "SET";
        ts: string;
        layer: string;
        key: string;
        value: string;
        actor?: string;
        note?: string;
    }
    | {
        type: "UNSET";
        ts: string;
        layer: string;
        key: string;
        actor?: string;
        note?: string;
    }
    | {
        type: "CLEAR_LAYER";
        ts: string;
        layer: string;
        actor?: string;
        note?: string;
    }
    | {
        type: "APPLY_PROFILE";
        ts: string;
        layer: string;
        profile: string;
        actor?: string;
        note?: string;
    }
    | {
        type: "BIND_CODEX";
        ts: string;
        layer: string;
        codex_title: string;
        codex_version: string;
        actor?: string;
        note?: string;
    };

function nowIso(): string {
    return new Date().toISOString();
}

export function resolveAuditPath(stateFile: string): string {
    const root = path.dirname(stateFile);
    return path.join(root, "audit.ndjson");
}

export function appendAudit(stateFile: string, evt: Omit<AuditEvent, "ts">): void {
    const file = resolveAuditPath(stateFile);
    ensureDir(path.dirname(file));
    const line = JSON.stringify({ ...evt, ts: nowIso() }) + "\n";
    fs.appendFileSync(file, line, "utf-8");
}

export function readAuditSince(stateFile: string, sinceIso?: string): AuditEvent[] {
    const file = resolveAuditPath(stateFile);
    if (!fs.existsSync(file)) return [];
    const raw = fs.readFileSync(file, "utf-8").trim();
    if (!raw) return [];
    const lines = raw.split("\n");

    const since = sinceIso ? Date.parse(sinceIso) : null;
    if (sinceIso && Number.isNaN(since ?? NaN)) throw new Error(`Invalid --since ISO: ${sinceIso}`);

    const out: AuditEvent[] = [];
    for (const line of lines) {
        const evt = JSON.parse(line) as AuditEvent;
        if (!since) out.push(evt);
        else {
            const t = Date.parse(evt.ts);
            if (!Number.isFinite(t)) continue;
            if (t >= since) out.push(evt);
        }
    }
    return out;
}
