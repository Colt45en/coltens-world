#!/usr/bin/env node
import { nodeIO } from "./node-io.js";
import {
  loadLatestSnapshotIndexAndCursor,
  loadLatestSnapshotIndexFromNdjson,
  ingestNdjsonIncremental,
  type MutableGraphIndex,
  executeQueryCached,
  createDefaultQueryCaches,
  DSL_HELP,
  writeSnapshotToNdjson,
  appendSnapshotToNdjson,
} from "../index.js";
import { SignalError } from "@world-engine/signal-spine-contract";

const caches = createDefaultQueryCaches({ planMax: 512, resultMax: 256 });

function usage(): never {
  console.log(`
we-rg (Resonant Graph CLI)

Commands:
  we-rg help
  we-rg query --db <path.ndjson> --q "<DSL query>"
  we-rg watch --db <path.ndjson> --q "<DSL query>" [--every <ms>]
  we-rg ingest --db <path.ndjson> --snapshot <path.json> [--append]
  we-rg export --db <path.ndjson> --out <path.json>

Examples:
  we-rg query --db ./rg.ndjson --q "FIND domain:shape WHERE metrics.shape.symmetry_score >= 0.7 RETURN node.id,metrics.shape.symmetry_score ORDER BY metrics.shape.symmetry_score DESC LIMIT 20"
  we-rg watch --db ./rg.ndjson --q "FIND domain:text RETURN node.id,node.label LIMIT 20" --every 250
  we-rg ingest --db ./rg.ndjson --snapshot ./snapshot.json --append
  we-rg export --db ./rg.ndjson --out ./latest.snapshot.json
`.trim());
  process.exit(1);
}

function argValue(args: string[], name: string): string | null {
  const idx = args.indexOf(name);
  if (idx === -1) return null;
  return args[idx + 1] ?? null;
}

function parseEveryMs(args: string[]): number {
  const raw = argValue(args, "--every");
  if (!raw) return 250;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 50 || n > 60_000) {
    throw new SignalError("E_RANGE", "--every must be an integer in [50, 60000] milliseconds");
  }
  return n;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0]?.toLowerCase();

  if (!cmd || cmd === "help") {
    console.log(DSL_HELP);
    return;
  }

  if (cmd === "query") {
    const db = argValue(args, "--db");
    const q = argValue(args, "--q");
    if (!db || !q) usage();

    const index = await loadLatestSnapshotIndexFromNdjson(nodeIO, db);
    const rows = executeQueryCached(index, q, caches);

    console.log(JSON.stringify({ graph_id: index.graph_id, rows }, null, 2));
    return;
  }

  if (cmd === "watch") {
    const db = argValue(args, "--db");
    const q = argValue(args, "--q");
    if (!db || !q) usage();

    const everyMs = parseEveryMs(args);

    const boot = await loadLatestSnapshotIndexAndCursor(nodeIO, db);
    const mutable = boot.index as MutableGraphIndex;
    const cursor = boot.cursor;

    let first = true;
    while (true) {
      const ingest = await ingestNdjsonIncremental(nodeIO, db, mutable, cursor, {
        maxBytesPerRead: 1 << 20,
        maxReads: 8,
      });

      if (ingest.appliedRecords > 0 || ingest.sawReset) {
        caches.resultCache.clear();
      }

      if (first || ingest.appliedRecords > 0 || ingest.sawReset) {
        first = false;
        const rows = executeQueryCached(mutable, q, caches);
        console.log(JSON.stringify({
          graph_id: mutable.graph_id,
          rows,
          changes: {
            appliedRecords: ingest.appliedRecords,
            sawReset: ingest.sawReset,
            eof: ingest.eof,
          },
        }, null, 2));
      }

      await sleep(everyMs);
    }
  }

  if (cmd === "ingest") {
    const db = argValue(args, "--db");
    const snapPath = argValue(args, "--snapshot");
    const append = args.includes("--append");
    if (!db || !snapPath) usage();

    const text = await nodeIO.readText(snapPath);
    const snapshot = JSON.parse(text);

    if (append) await appendSnapshotToNdjson(nodeIO, db, snapshot);
    else await writeSnapshotToNdjson(nodeIO, db, snapshot);

    console.log(JSON.stringify({ ok: true, db, graph_id: snapshot.graph_id, mode: append ? "append" : "write" }, null, 2));
    return;
  }

  if (cmd === "export") {
    const db = argValue(args, "--db");
    const outPath = argValue(args, "--out");
    if (!db || !outPath) usage();

    const index = await loadLatestSnapshotIndexFromNdjson(nodeIO, db);
    const nodes = Array.from(index.nodesById.values()).sort((a, b) => (a.id < b.id ? -1 : 1));
    const edges = Array.from(index.edgesById.values()).sort((a, b) => (a.id < b.id ? -1 : 1));
    const snapshot = {
      schema_version: "1.0.0",
      graph_id: index.graph_id,
      created_at_utc: index.created_at_utc,
      nodes,
      edges,
    };

    await nodeIO.writeText(outPath, JSON.stringify(snapshot, null, 2));
    console.log(JSON.stringify({ ok: true, out: outPath, graph_id: index.graph_id }, null, 2));
    return;
  }

  usage();
}

main().catch((e) => {
  if (e instanceof SignalError) {
    console.error(`[${e.code}] ${e.message}`);
    process.exit(2);
  }
  console.error(String((e as { stack?: string; message?: string } | undefined)?.stack ?? (e as { message?: string } | undefined)?.message ?? e));
  process.exit(3);
});
