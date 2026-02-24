import fs from "node:fs";
import path from "node:path";

export function resolveStoragePaths(cwd: string): { rootDir: string; stateFile: string } {
    const rootDir = path.join(cwd, ".sandbox");
    const stateFile = path.join(rootDir, "env.json");
    return { rootDir, stateFile };
}

export function ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

export function readJsonFile<T = unknown>(filePath: string): T | null {
    try {
        if (!fs.existsSync(filePath)) return null;
        const raw = fs.readFileSync(filePath, "utf-8");
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
}

export function writeJsonFile<T = unknown>(filePath: string, data: T): void {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}
