import { LexiconSnapshotV1 } from "../contracts/lexicon-intent.v1";

/**
 * LexiconSnapshotStore: In-memory content-addressed snapshot storage
 *
 * Stores snapshots indexed by:
 * - snapshot_id (SHA-256 hash, primary key)
 * - actor_id (for filtering by entity)
 * - snapshot_kind (for filtering by type)
 *
 * No mutation after creation; all ops are append-only.
 */
export class LexiconSnapshotStore {
  // Primary index: snapshot_id → snapshot
  private snapshots = new Map<string, LexiconSnapshotV1>();

  // Secondary index: actor_id → actor-snapshots
  private byActorId = new Map<string, string[]>();

  // Tertiary index: (actor_id, snapshot_kind) → snapshots
  private byActorAndKind = new Map<string, string[]>();

  // Statistics
  private deduplicationCount = 0;
  private deduplicationBytes = 0;

  constructor() {
    // Initialize empty store
  }

  /**
   * Store a snapshot (or deduplicate if already exists)
   * Returns { snapshot, stored_new, dedup_bytes_saved }
   */
  store(
    snapshot_id: string,
    actor_id: string,
    snapshot_kind: LexiconSnapshotV1["snapshot_kind"],
    canonical_json: string,
    created_at_utc: number,
  ): {
    snapshot: LexiconSnapshotV1;
    stored_new: boolean;
    dedup_bytes_saved: number;
  } {
    const size_bytes = canonical_json.length;
    const stored_at_utc = Math.floor(Date.now() / 1000); // Current time in seconds

    // Check if snapshot already exists
    if (this.snapshots.has(snapshot_id)) {
      const existing = this.snapshots.get(snapshot_id)!;
      this.deduplicationCount++;
      this.deduplicationBytes += size_bytes;
      return {
        snapshot: existing,
        stored_new: false,
        dedup_bytes_saved: size_bytes,
      };
    }

    // Create new snapshot
    const snapshot: LexiconSnapshotV1 = {
      snapshot_id,
      actor_id,
      snapshot_kind,
      canonical_json,
      created_at_utc,
      stored_at_utc,
      size_bytes,
    };

    // Store in primary index
    this.snapshots.set(snapshot_id, snapshot);

    // Update actor index
    if (!this.byActorId.has(actor_id)) {
      this.byActorId.set(actor_id, []);
    }
    this.byActorId.get(actor_id)!.push(snapshot_id);

    // Update (actor, kind) index
    const composite_key = `${actor_id}|${snapshot_kind}`;
    if (!this.byActorAndKind.has(composite_key)) {
      this.byActorAndKind.set(composite_key, []);
    }
    this.byActorAndKind.get(composite_key)!.push(snapshot_id);

    return {
      snapshot,
      stored_new: true,
      dedup_bytes_saved: 0,
    };
  }

  /**
   * Retrieve a snapshot by ID
   */
  get(snapshot_id: string): LexiconSnapshotV1 | null {
    return this.snapshots.get(snapshot_id) || null;
  }

  /**
   * Check if snapshot exists
   */
  exists(snapshot_id: string): boolean {
    return this.snapshots.has(snapshot_id);
  }

  /**
   * Get all snapshots for an actor
   * Returns snapshot_ids (caller is responsible for ordering)
   */
  getSnapshotsByActor(actor_id: string): string[] {
    return this.byActorId.get(actor_id) || [];
  }

  /**
   * Get all snapshots for (actor_id, snapshot_kind)
   * Returns snapshot_ids (caller is responsible for ordering)
   */
  getSnapshotsByActorAndKind(actor_id: string, snapshot_kind: LexiconSnapshotV1["snapshot_kind"]): string[] {
    const composite_key = `${actor_id}|${snapshot_kind}`;
    return this.byActorAndKind.get(composite_key) || [];
  }

  /**
   * Get all snapshots (for bulk operations)
   */
  getAllSnapshots(): LexiconSnapshotV1[] {
    return Array.from(this.snapshots.values());
  }

  /**
   * Get statistics
   */
  getStats(): {
    total_snapshots: number;
    total_stored_bytes: number;
    total_deduplicated_count: number;
    total_deduplicated_bytes: number;
  } {
    const total_stored_bytes = Array.from(this.snapshots.values()).reduce((sum, s) => sum + s.size_bytes, 0);

    return {
      total_snapshots: this.snapshots.size,
      total_stored_bytes,
      total_deduplicated_count: this.deduplicationCount,
      total_deduplicated_bytes: this.deduplicationBytes,
    };
  }

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.snapshots.clear();
    this.byActorId.clear();
    this.byActorAndKind.clear();
    this.deduplicationCount = 0;
    this.deduplicationBytes = 0;
  }
}
