import { makeMemoryId } from "@world-engine/nucleus-contracts";
import type { EvidenceRef, IsoUtc, MemoryItem, MemoryKind } from "@world-engine/nucleus-contracts";

export type MemoryProposal = {
  proposed: MemoryItem;
  approval_required: true;
  reason: string;
};

export function proposeMemory(params: {
  statement: string;
  kind: MemoryKind;
  evidence_refs: EvidenceRef[];
  confidence: number;
  created_at_utc: IsoUtc;
}): MemoryProposal {
  const memory_id = makeMemoryId(params.statement, params.created_at_utc);

  const proposed: MemoryItem = {
    version: "nucleus.memory_item.v1",
    memory_id,
    kind: params.kind,
    statement: params.statement,
    evidence_refs: params.evidence_refs,
    confidence: Math.max(0, Math.min(1, params.confidence)),
    created_at_utc: params.created_at_utc,
    approved_by_user: false
  };

  return {
    proposed,
    approval_required: true,
    reason: "Memory writes are guarded. Approve to commit; reject to discard."
  };
}

export function approveMemory(item: MemoryItem, approved_at_utc: IsoUtc): MemoryItem {
  if (item.approved_by_user) return item;
  return {
    ...item,
    approved_by_user: true,
    approved_at_utc
  };
}
