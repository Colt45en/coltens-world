/**
 * Nucleus World Engine Routes
 *
 * HTTP endpoints for deterministic world simulation:
 * - POST /world/ingest_events - add events to process
 * - POST /world/produce_snapshot - generate snapshot from events
 * - POST /world/seal_snapshot - create checkpoint with ledger head
 * - GET /world/render_state/:snapshotId - fetch rendered state
 */

import type {
    Seal,
    Snapshot
} from "@world-engine/contracts";
import {
    EventSchema,
    IsoUtcSchema,
} from "@world-engine/contracts";
import { WorldEngineRuntime } from "@world-engine/engine";
import { URL } from "node:url";
import { z } from "zod";

async function parseJson(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk: any) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

export function createWorldEngineRoutes(engine: WorldEngineRuntime) {
  // Storage for snapshots in memory (for simplicity; could be ledger-backed)
  const snapshots = new Map<string, Snapshot>();
  const seals = new Map<string, Seal>();

  return async (req: any, res: any): Promise<boolean> => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    const method = req.method;

    // POST /world/ingest_events
    if (method === "POST" && pathname === "/world/ingest_events") {
      try {
        const body = await parseJson(req);
        const eventsInput = z.array(z.any()).parse(body);
        const events = eventsInput.map((e) => EventSchema.parse(e));

        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({
          ok: true,
          count: events.length,
          event_ids: events.map((e) => e.id),
        }));
        return true;
      } catch (e) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: String(e) }));
        return true;
      }
    }

    // POST /world/produce_snapshot
    if (method === "POST" && pathname === "/world/produce_snapshot") {
      try {
        const body = await parseJson(req);

        // Validate inputs
        const events = z.array(z.any()).parse(body.events ?? []);
        const prior_id = z.string().optional().parse(body.prior_snapshot_id);
        const now_utc = IsoUtcSchema.parse(body.now_utc ?? new Date().toISOString());

        // Fetch prior snapshot if provided
        const prior = prior_id ? snapshots.get(prior_id) ?? null : null;

        // Validate and parse events
        const validatedEvents = events.map((e) => EventSchema.parse(e));

        // Generate snapshot
        const snapshot = engine.produceSnapshot({
          events: validatedEvents,
          prior,
          now_utc,
        });

        // Store snapshot
        snapshots.set(snapshot.id, snapshot);

        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({
          ok: true,
          snapshot: {
            id: snapshot.id,
            ts_utc: snapshot.ts_utc,
            hash: snapshot.hash,
            events_applied_count: snapshot.events_applied.length,
            observations_count: snapshot.observations.length,
            beliefs_count: snapshot.beliefs.length,
            entropy: snapshot.entropy,
          },
        }));
        return true;
      } catch (e) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: String(e) }));
        return true;
      }
    }

    // POST /world/seal_snapshot
    if (method === "POST" && pathname === "/world/seal_snapshot") {
      try {
        const body = await parseJson(req);

        const snapshot_id = z.string().parse(body.snapshot_id);
        const now_utc = IsoUtcSchema.parse(body.now_utc ?? new Date().toISOString());
        const ledger_head_event_id = z.string().parse(body.ledger_head_event_id);
        const ledger_hash = z.string().parse(body.ledger_hash);
        const contracts_hash = z.string().parse(body.contracts_hash);

        // Retrieve snapshot
        const snapshot = snapshots.get(snapshot_id);
        if (!snapshot) {
          res.writeHead(404, { "content-type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: `Snapshot not found: ${snapshot_id}` }));
          return true;
        }

        // Generate seal
        const seal = engine.sealSnapshot({
          snapshot,
          now_utc,
          ledger: { head_event_id: ledger_head_event_id, ledger_hash },
          contracts: { contracts_hash },
        });

        // Store seal
        seals.set(seal.id, seal);

        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({
          ok: true,
          seal: {
            id: seal.id,
            ts_utc: seal.ts_utc,
            snapshot_hash: seal.snapshot_hash,
            ledger_hash: seal.ledger_hash,
            contracts_hash: seal.contracts_hash,
          },
        }));
        return true;
      } catch (e) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: String(e) }));
        return true;
      }
    }

    // GET /world/render_state/:snapshotId
    if (method === "GET" && pathname.startsWith("/world/render_state/")) {
      try {
        const snapshotId = pathname.replace("/world/render_state/", "");
        if (!snapshotId) {
          res.writeHead(400, { "content-type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: "Missing snapshot ID" }));
          return true;
        }

        const snapshot = snapshots.get(snapshotId);
        if (!snapshot) {
          res.writeHead(404, { "content-type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: `Snapshot not found: ${snapshotId}` }));
          return true;
        }

        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({
          ok: true,
          render_state: snapshot.render_state,
        }));
        return true;
      } catch (e) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: String(e) }));
        return true;
      }
    }

    // GET /world/seal/:sealId
    if (method === "GET" && pathname.startsWith("/world/seal/")) {
      try {
        const sealId = pathname.replace("/world/seal/", "");
        if (!sealId) {
          res.writeHead(400, { "content-type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: "Missing seal ID" }));
          return true;
        }

        const seal = seals.get(sealId);
        if (!seal) {
          res.writeHead(404, { "content-type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: `Seal not found: ${sealId}` }));
          return true;
        }

        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true, seal }));
        return true;
      } catch (e) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: String(e) }));
        return true;
      }
    }

    return false; // not handled
  };
}
