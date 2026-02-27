import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
export function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}
export function ensureParentDir(filePath) {
    ensureDir(path.dirname(filePath));
}
export function sha256Hex(content) {
    return crypto.createHash("sha256").update(content).digest("hex");
}
export function sha256File(filePath) {
    return `sha256:${sha256Hex(fs.readFileSync(filePath))}`;
}
export function stableJsonValue(value) {
    if (value === null || value === undefined)
        return value;
    if (Array.isArray(value))
        return value.map((v) => stableJsonValue(v));
    if (typeof value === "object") {
        const out = {};
        for (const key of Object.keys(value).sort()) {
            out[key] = stableJsonValue(value[key]);
        }
        return out;
    }
    return value;
}
export function stableStringify(value) {
    return JSON.stringify(stableJsonValue(value));
}
export function readJsonFile(filePath) {
    if (!fs.existsSync(filePath))
        return null;
    try {
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
    catch {
        return null;
    }
}
export function writeJsonFile(filePath, data) {
    ensureParentDir(filePath);
    fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}
