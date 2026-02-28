import type { SnapshotEnvelopeV1, SnapshotKindV1 } from "../contracts/graphics-intent.v1";

export class GraphicsIntentStore {
  private byId = new Map<string, SnapshotEnvelopeV1>();
  private seqByKind = new Map<SnapshotKindV1, number>();

  ingest(snapshot: SnapshotEnvelopeV1): { sequence: number } {
    const existing = this.byId.get(snapshot.id);
    if (existing) {
      if (
        existing.hash_sha256 !== snapshot.hash_sha256 ||
        existing.canonical_json !== snapshot.canonical_json
      ) {
        throw new Error(`Snapshot collision for id=${snapshot.id}`);
      }
      return { sequence: this.getSequence(snapshot.kind) };
    }

    this.byId.set(snapshot.id, snapshot);
    const nextSeq = (this.seqByKind.get(snapshot.kind) ?? -1) + 1;
    this.seqByKind.set(snapshot.kind, nextSeq);
    return { sequence: nextSeq };
  }

  get(id: string): SnapshotEnvelopeV1 {
    const s = this.byId.get(id);
    if (!s) throw new Error(`Snapshot not found: ${id}`);
    return s;
  }

  private getSequence(kind: SnapshotKindV1): number {
    return this.seqByKind.get(kind) ?? -1;
  }
}
