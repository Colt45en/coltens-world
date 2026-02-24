import fs from "node:fs";
import path from "node:path";
import { ensureDir } from "./storage.js";
function nowIso() {
    return new Date().toISOString();
}
export function resolveAuditPath(stateFile) {
    const root = path.dirname(stateFile);
    return path.join(root, "audit.ndjson");
}
export function appendAudit(stateFile, evt) {
    const file = resolveAuditPath(stateFile);
    ensureDir(path.dirname(file));
    const line = JSON.stringify({ ...evt, ts: nowIso() }) + "\n";
    fs.appendFileSync(file, line, "utf-8");
}
export function readAuditSince(stateFile, sinceIso) {
    const file = resolveAuditPath(stateFile);
    if (!fs.existsSync(file))
        return [];
    const raw = fs.readFileSync(file, "utf-8").trim();
    if (!raw)
        return [];
    const lines = raw.split("\n");
    const since = sinceIso ? Date.parse(sinceIso) : null;
    if (sinceIso && Number.isNaN(since ?? NaN))
        throw new Error(`Invalid --since ISO: ${sinceIso}`);
    const out = [];
    for (const line of lines) {
        const evt = JSON.parse(line);
        if (!since)
            out.push(evt);
        else {
            const t = Date.parse(evt.ts);
            if (!Number.isFinite(t))
                continue;
            if (t >= since)
                out.push(evt);
        }
    }
    return out;
}
