import { LexiconSnapshotV1 } from "../contracts/lexicon-intent.v1";

/**
 * LexiconQueryEngine: Deterministic query execution
 *
 * Provides stable, reproducible query results:
 * - Deterministic sorting (stable sort on created_at_utc + snapshot_id)
 * - Optional time-range filtering
 * - Optional limit + offset
 */
export class LexiconQueryEngine {
  constructor() {}

  /**
   * Execute a deterministic query on snapshots
   *
   * Parameters:
   * - snapshots: List of snapshots to query
   * - created_at_utc_min: Minimum creation timestamp (inclusive, optional)
   * - created_at_utc_max: Maximum creation timestamp (inclusive, optional)
   * - limit: Max results to return
   * - order_by: "created_at_asc" or "created_at_desc"
   *
   * Returns: Sorted, filtered snapshots (deterministic order guaranteed)
   */
  query(
    snapshots: LexiconSnapshotV1[],
    created_at_utc_min?: number,
    created_at_utc_max?: number,
    limit: number = 100,
    order_by: "created_at_asc" | "created_at_desc" = "created_at_desc",
  ): {
    results: LexiconSnapshotV1[];
    total_count: number;
  } {
    // Step 1: Filter by time range
    let filtered = snapshots;

    if (created_at_utc_min !== undefined || created_at_utc_max !== undefined) {
      filtered = snapshots.filter((snap) => {
        const time_ok =
          (created_at_utc_min === undefined || snap.created_at_utc >= created_at_utc_min) &&
          (created_at_utc_max === undefined || snap.created_at_utc <= created_at_utc_max);
        return time_ok;
      });
    }

    const total_count = filtered.length;

    // Step 2: Stable sort (deterministic order guaranteed)
    // Sort by (created_at, snapshot_id) to ensure reproducibility
    const sorted = this.stableSort(filtered, order_by);

    // Step 3: Apply limit
    const results = sorted.slice(0, limit);

    return { results, total_count };
  }

  /**
   * Stable sort with deterministic tie-breaking
   * If created_at timestamps are identical, use snapshot_id as secondary sort key
   */
  private stableSort(snapshots: LexiconSnapshotV1[], order_by: "created_at_asc" | "created_at_desc"): LexiconSnapshotV1[] {
    const direction = order_by === "created_at_asc" ? 1 : -1;

    return snapshots.sort((a, b) => {
      // Primary sort: created_at_utc
      if (a.created_at_utc !== b.created_at_utc) {
        return direction * (a.created_at_utc - b.created_at_utc);
      }

      // Tie-breaker: snapshot_id (lexicographic for determinism)
      return a.snapshot_id.localeCompare(b.snapshot_id);
    });
  }

  /**
   * Filter snapshots by time range
   * Used for pre-filtering before main query
   */
  filterByTimeRange(
    snapshots: LexiconSnapshotV1[],
    created_at_utc_min?: number,
    created_at_utc_max?: number,
  ): LexiconSnapshotV1[] {
    return snapshots.filter((snap) => {
      const time_ok =
        (created_at_utc_min === undefined || snap.created_at_utc >= created_at_utc_min) &&
        (created_at_utc_max === undefined || snap.created_at_utc <= created_at_utc_max);
      return time_ok;
    });
  }

  /**
   * Apply deterministic sort to snapshots
   */
  orderSnapshots(snapshots: LexiconSnapshotV1[], order_by: "created_at_asc" | "created_at_desc"): LexiconSnapshotV1[] {
    return this.stableSort(snapshots, order_by);
  }

  /**
   * Apply limit + offset
   */
  applyLimitAndOffset(snapshots: LexiconSnapshotV1[], limit: number, offset: number = 0): LexiconSnapshotV1[] {
    return snapshots.slice(offset, offset + limit);
  }
}
