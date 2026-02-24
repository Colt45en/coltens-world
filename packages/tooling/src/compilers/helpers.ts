import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function ensureParentDir(filePath: string): void {
  ensureDir(path.dirname(filePath));
}

export function sha256Hex(content: string | Buffer): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

export function sha256File(filePath: string): string {
  return `sha256:${sha256Hex(fs.readFileSync(filePath))}`;
}

export function stableJsonValue<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((v) => stableJsonValue(v)) as T;
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = stableJsonValue((value as Record<string, unknown>)[key]);
    }
    return out as T;
  }
  return value;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(stableJsonValue(value));
}

export function readJsonFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

export function writeJsonFile(filePath: string, data: unknown): void {
  ensureParentDir(filePath);
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}
