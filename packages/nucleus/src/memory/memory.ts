import type { MemoryId, MemoryItem } from "@world-engine/nucleus-contracts";

export interface MemoryStore {
  put(item: MemoryItem): void;
  get(id: MemoryId): MemoryItem | undefined;
  list(limit: number): MemoryItem[];
}

export function assertApproved(item: MemoryItem): void {
  if (!item.approved_by_user) {
    throw new Error(`Refusing to commit unapproved memory: ${item.memory_id}`);
  }
}
