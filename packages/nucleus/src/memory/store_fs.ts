import fs from "node:fs";
import path from "node:path";

import type { MemoryId, MemoryItem } from "@world-engine/nucleus-contracts";
import type { MemoryStore } from "./memory.js";
import { stableStringify } from "../util/stable_json.js";

export class FsMemoryStore implements MemoryStore {
  private byId = new Map<string, MemoryItem>();
  private filePath: string;

  constructor(opts: { rootDir: string; filename?: string }) {
    const filename = opts.filename ?? "memory.ndjson";
    this.filePath = path.join(opts.rootDir, filename);
    this.load();
  }

  put(item: MemoryItem): void {
    this.byId.set(item.memory_id, item);
    this.flushAppend(item);
  }

  get(id: MemoryId): MemoryItem | undefined {
    return this.byId.get(id as unknown as string);
  }

  list(limit: number): MemoryItem[] {
    const all = Array.from(this.byId.values());
    all.sort((a, b) => a.created_at_utc.localeCompare(b.created_at_utc));
    return all.slice(Math.max(0, all.length - limit));
  }

  private load(): void {
    if (!fs.existsSync(this.filePath)) return;
    const raw = fs.readFileSync(this.filePath, "utf8");
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      const obj = JSON.parse(line) as MemoryItem;
      this.byId.set(obj.memory_id, obj);
    }
  }

  private flushAppend(item: MemoryItem): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.appendFileSync(this.filePath, `${stableStringify(item)}\n`, "utf8");
  }
}
