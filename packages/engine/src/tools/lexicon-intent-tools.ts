import {
    LexiconGetRequestV1,
    LexiconGetResponseV1,
    LexiconLedgerEventV1,
    LexiconQueryResponseV1,
    LexiconQueryV1,
    LexiconSnapshotV1,
    LexiconStatsRequestV1,
    LexiconStatsResponseV1,
    LexiconStoreRequestV1,
    LexiconStoreResponseV1,
    LexiconToolResultV1,
} from "../contracts/lexicon-intent.v1";
import { ContentAddressingService } from "../lexicon/content-addressing";
import { LexiconQueryEngine } from "../lexicon/query-engine";
import { LexiconSnapshotStore } from "../lexicon/snapshot-store";

/**
 * LexiconIntentToolkit: Unified interface for Lexicon operations
 *
 * Combines:
 * - Content addressing (hash computation)
 * - Snapshot storage (CRUD)
 * - Query engine (deterministic search)
 *
 * All operations are deterministic and ledger-aware.
 */
export class LexiconIntentToolkit {
  private snapshotStore: LexiconSnapshotStore;
  private queryEngine: LexiconQueryEngine;
  private contentAddressing: ContentAddressingService;

  constructor() {
    this.snapshotStore = new LexiconSnapshotStore();
    this.queryEngine = new LexiconQueryEngine();
    this.contentAddressing = new ContentAddressingService();
  }

  /**
   * Store a snapshot (or deduplicate)
   * Returns ToolResult with response + ledger event
   */
  store(request: LexiconStoreRequestV1): LexiconToolResultV1 {
    try {
      // Compute content-addressed hash
      const snapshot_id = this.contentAddressing.hashCanonicalJson(request.canonical_json);

      // Store in lexicon
      const { snapshot, stored_new, dedup_bytes_saved } = this.snapshotStore.store(
        snapshot_id,
        request.actor_id,
        request.snapshot_kind,
        request.canonical_json,
        request.created_at_utc,
      );

      // Build response
      const response: LexiconStoreResponseV1 = {
        success: true,
        snapshot_id,
        stored_new,
        action: "store",
      };

      // Build ledger event
      const ledger_event: LexiconLedgerEventV1 = stored_new
        ? {
            kind: "stored",
            actor_id: request.actor_id,
            snapshot_kind: request.snapshot_kind,
            snapshot_id,
            size_bytes: request.canonical_json.length,
            stored_new: true,
            timestamp_utc: Math.floor(Date.now() / 1000),
          }
        : {
            kind: "deduplicated",
            actor_id: request.actor_id,
            snapshot_id,
            existing_size_bytes: request.canonical_json.length,
            bytes_saved: dedup_bytes_saved,
            timestamp_utc: Math.floor(Date.now() / 1000),
          };

      return {
        success: true,
        data: response,
        ledger_event,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return {
        success: false,
        message,
      };
    }
  }

  /**
   * Query snapshots for an actor
   * Returns ToolResult with response + ledger event
   */
  query(request: LexiconQueryV1): LexiconToolResultV1 {
    try {
      const start_time = Date.now();

      // Get snapshots for actor
      let snapshots = this.snapshotStore.getSnapshotsByActor(request.actor_id);
      const snapshot_objects = snapshots.map((id: string) => this.snapshotStore.get(id)!);

      // Filter by kind (if specified)
      let filtered_snapshots = snapshot_objects;
      if (request.snapshot_kind) {
        filtered_snapshots = snapshot_objects.filter((snap: LexiconSnapshotV1) => snap.snapshot_kind === request.snapshot_kind);
      }

      // Execute deterministic query
      const { results, total_count } = this.queryEngine.query(
        filtered_snapshots,
        request.created_at_utc_min,
        request.created_at_utc_max,
        request.limit,
        request.order_by,
      );

      const query_time_ms = Date.now() - start_time;

      // Build response
      const response: LexiconQueryResponseV1 = {
        success: true,
        snapshots: results,
        total_count,
        query_time_ms,
      };

      // Build ledger event
      const ledger_event: LexiconLedgerEventV1 = {
        kind: "queried",
        actor_id: request.actor_id,
        snapshot_kind: request.snapshot_kind,
        result_count: results.length,
        query_time_ms,
        timestamp_utc: Math.floor(Date.now() / 1000),
      };

      return {
        success: true,
        data: response,
        ledger_event,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return {
        success: false,
        message,
      };
    }
  }

  /**
   * Get a single snapshot by ID
   * Returns ToolResult with response
   */
  get(request: LexiconGetRequestV1): LexiconToolResultV1 {
    try {
      const snapshot = this.snapshotStore.get(request.snapshot_id);

      const response: LexiconGetResponseV1 = {
        success: snapshot !== null,
        snapshot: snapshot || undefined,
      };

      return {
        success: true,
        data: response,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return {
        success: false,
        message,
      };
    }
  }

  /**
   * Get storage statistics
   * Returns ToolResult with response
   */
  stats(request: LexiconStatsRequestV1): LexiconToolResultV1 {
    try {
      const stats = this.snapshotStore.getStats();

      const response: LexiconStatsResponseV1 = {
        success: true,
        total_snapshots: stats.total_snapshots,
        total_stored_bytes: stats.total_stored_bytes,
        total_deduplicated_count: stats.total_deduplicated_count,
        total_deduplicated_bytes: stats.total_deduplicated_bytes,
      };

      return {
        success: true,
        data: response,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return {
        success: false,
        message,
      };
    }
  }

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.snapshotStore.clear();
  }

  /**
   * Check if snapshot exists
   */
  exists(snapshot_id: string): boolean {
    return this.snapshotStore.exists(snapshot_id);
  }
}
