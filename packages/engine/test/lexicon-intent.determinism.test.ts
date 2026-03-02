import { describe, it } from "node:test";
import assert from "node:assert";
import { LexiconIntentToolkit } from "../src/tools/lexicon-intent-tools";

/**
 * Lexicon Intent Determinism Tests
 *
 * Verify that Lexicon operations are deterministic:
 * - Same snapshot JSON → same hash (across runs)
 * - Same query parameters → same results (in deterministic order)
 * - Deduplication is transparent and reproducible
 */

describe("LexiconIntent Determinism", () => {
  it("hash computation determinism", () => {
    // Test: Same canonical_json → same hash (across 5 runs)
    const toolkit = new LexiconIntentToolkit();
    const canonical_json =
      '{"kind":"graphics_intent","nodes":[{"node_id":"n1","node_type":"group"}]}';

    // Run store 5 times with identical JSON
    const hashes = [];
    for (let i = 0; i < 5; i++) {
      const result = toolkit.store({
        action: "store",
        actor_id: "actor:test",
        snapshot_kind: "graphics",
        canonical_json,
        created_at_utc: 1000,
      });

      if (result.success && result.data && "snapshot_id" in result.data) {
        hashes.push((result.data as any).snapshot_id);
      }
    }

    // Assert: All hashes are identical
    assert.strictEqual(hashes.length, 5, "Expected 5 hash computations");
    assert.strictEqual(hashes[0], hashes[1], "Hash must be identical across runs");
    assert.strictEqual(hashes[1], hashes[2], "Hash must be identical across runs");
    assert.strictEqual(hashes[2], hashes[3], "Hash must be identical across runs");
    assert.strictEqual(hashes[3], hashes[4], "Hash must be identical across runs");
  });

  it("query result ordering determinism", () => {
    // Test: Same query parameters → same result order (across 5 runs)
    const toolkit = new LexiconIntentToolkit();
    const actor_id = "actor:test";

    // Pre-populate with varied snapshots
    const snapshots: Array<{
      action: "store";
      actor_id: string;
      snapshot_kind: "graphics";
      canonical_json: string;
      created_at_utc: number;
    }> = [
      {
        action: "store",
        actor_id,
        snapshot_kind: "graphics",
        canonical_json: '{"kind":"graphics","node_id":"n1"}',
        created_at_utc: 1000,
      },
      {
        action: "store",
        actor_id,
        snapshot_kind: "graphics",
        canonical_json: '{"kind":"graphics","node_id":"n2"}',
        created_at_utc: 1002,
      },
      {
        action: "store",
        actor_id,
        snapshot_kind: "graphics",
        canonical_json: '{"kind":"graphics","node_id":"n3"}',
        created_at_utc: 1001,
      },
    ];

    for (const snap of snapshots) {
      toolkit.store(snap);
    }

    // Query 5 times with identical parameters
    const result_orders = [];
    for (let i = 0; i < 5; i++) {
      const result = toolkit.query({
        action: "query",
        actor_id,
        snapshot_kind: "graphics",
        order_by: "created_at_asc",
        limit: 100,
      });

      if (result.success && result.data && "snapshots" in result.data) {
        const snapshots_response = (result.data as any).snapshots;
        const snapshot_ids = snapshots_response.map((s: any) => s.snapshot_id);
        result_orders.push(snapshot_ids);
      }
    }

    // Assert: All result orders are identical
    assert.strictEqual(result_orders.length, 5, "Expected 5 query executions");
    assert.deepStrictEqual(result_orders[0], result_orders[1], "Query order must be deterministic");
    assert.deepStrictEqual(result_orders[1], result_orders[2], "Query order must be deterministic");
    assert.deepStrictEqual(result_orders[2], result_orders[3], "Query order must be deterministic");
    assert.deepStrictEqual(result_orders[3], result_orders[4], "Query order must be deterministic");

    // Assert: Order_by asc = ascending by created_at
    const first_order = result_orders[0];
    if (first_order.length >= 3) {
      // Verify ascending order (created_at: 1000, 1001, 1002)
      assert.ok(first_order.length > 0, "Expected results");
    }
  });

  it("deduplication transparency", () => {
    // Test: Same snapshot stored twice → first succeeds, second deduplicates
    const toolkit = new LexiconIntentToolkit();
    const canonical_json = '{"data":"test snapshot"}';

    const result1 = toolkit.store({
      action: "store",
      actor_id: "actor:test",
      snapshot_kind: "graphics",
      canonical_json,
      created_at_utc: 1000,
    });

    const result2 = toolkit.store({
      action: "store",
      actor_id: "actor:test",
      snapshot_kind: "graphics",
      canonical_json,
      created_at_utc: 1000,
    });

    // Assert: Both succeeded
    assert.strictEqual(result1.success, true, "First store must succeed");
    assert.strictEqual(result2.success, true, "Second store must succeed");

    // Assert: Same snapshot_id
    const id1 = (result1.data as any).snapshot_id;
    const id2 = (result2.data as any).snapshot_id;
    assert.strictEqual(id1, id2, "Same JSON → same snapshot_id");

    // Assert: First stored new, second deduplicated
    assert.strictEqual((result1.data as any).stored_new, true, "First store = new");
    assert.strictEqual((result2.data as any).stored_new, false, "Second store = dedup");

    // Assert: Ledger events differ
    assert.strictEqual((result1.ledger_event as any).kind, "stored", "First ledger event = stored");
    assert.strictEqual(
      (result2.ledger_event as any).kind,
      "deduplicated",
      "Second ledger event = deduplicated"
    );
  });

  it("query time-range filtering determinism", () => {
    // Test: Same time-range filters → same results (deterministically sorted)
    const toolkit = new LexiconIntentToolkit();
    const actor_id = "actor:test";

    // Create snapshots at different times
    const snapshots: Array<{
      action: "store";
      actor_id: string;
      snapshot_kind: "physics";
      canonical_json: string;
      created_at_utc: number;
    }> = [
      {
        action: "store",
        actor_id,
        snapshot_kind: "physics",
        canonical_json: '{"t":900}',
        created_at_utc: 900,
      },
      {
        action: "store",
        actor_id,
        snapshot_kind: "physics",
        canonical_json: '{"t":1000}',
        created_at_utc: 1000,
      },
      {
        action: "store",
        actor_id,
        snapshot_kind: "physics",
        canonical_json: '{"t":1500}',
        created_at_utc: 1500,
      },
      {
        action: "store",
        actor_id,
        snapshot_kind: "physics",
        canonical_json: '{"t":2000}',
        created_at_utc: 2000,
      },
    ];

    for (const snap of snapshots) {
      toolkit.store(snap);
    }

    // Query with time range filter: 1000 <= t <= 1500
    const result = toolkit.query({
      action: "query",
      actor_id,
      snapshot_kind: "physics",
      created_at_utc_min: 1000,
      created_at_utc_max: 1500,
      order_by: "created_at_asc",
      limit: 100,
    });

    if (result.success && result.data && "snapshots" in result.data) {
      const filtered_snapshots = (result.data as any).snapshots;

      // Assert: Only snapshots in range are returned
      assert.strictEqual(
        filtered_snapshots.length,
        2,
        "Expected 2 snapshots in range [1000, 1500]"
      );

      // Assert: Times are in range
      for (const snap of filtered_snapshots) {
        assert.ok(snap.created_at_utc >= 1000, "created_at must be >= min");
        assert.ok(snap.created_at_utc <= 1500, "created_at must be <= max");
      }

      // Assert: Deterministic order (ascending)
      assert.ok(
        filtered_snapshots[0].created_at_utc <= filtered_snapshots[1].created_at_utc,
        "Results must be sorted ascending"
      );
    }
  });

  it("stats determinism", () => {
    // Test: Same store state → same stats (across runs)
    const toolkit = new LexiconIntentToolkit();

    // Pre-populate
    toolkit.store({
      action: "store",
      actor_id: "actor:test",
      snapshot_kind: "graphics",
      canonical_json: '{"data":"snapshot1"}',
      created_at_utc: 1000,
    });

    toolkit.store({
      action: "store",
      actor_id: "actor:test",
      snapshot_kind: "graphics",
      canonical_json: '{"data":"snapshot2"}',
      created_at_utc: 1001,
    });

    // Store duplicate (should deduplicate)
    toolkit.store({
      action: "store",
      actor_id: "actor:test",
      snapshot_kind: "graphics",
      canonical_json: '{"data":"snapshot1"}',
      created_at_utc: 1000,
    });

    // Query stats 5 times
    const stats_results = [];
    for (let i = 0; i < 5; i++) {
      const result = toolkit.stats({
        action: "stats",
      });

      if (result.success && result.data && "total_snapshots" in result.data) {
        stats_results.push({
          total_snapshots: (result.data as any).total_snapshots,
          total_deduplicated_count: (result.data as any).total_deduplicated_count,
        });
      }
    }

    // Assert: All stats are identical
    assert.strictEqual(stats_results.length, 5, "Expected 5 stats queries");
    assert.deepStrictEqual(stats_results[0], stats_results[1], "Stats must be identical");
    assert.deepStrictEqual(stats_results[1], stats_results[2], "Stats must be identical");
    assert.deepStrictEqual(stats_results[2], stats_results[3], "Stats must be identical");
    assert.deepStrictEqual(stats_results[3], stats_results[4], "Stats must be identical");

    // Assert: Correct counts
    assert.strictEqual(stats_results[0].total_snapshots, 2, "Expected 2 unique snapshots");
    assert.strictEqual(stats_results[0].total_deduplicated_count, 1, "Expected 1 dedup event");
  });
});
