// apps/nucleus/src/routes/ledger-artifact-routes.ts
// Ledger endpoints for artifact system: status, range, stream, verify, append

import {
    LedgerEventInputSchema,
    LedgerRangeQuerySchema,
    LedgerStreamQuerySchema,
} from "@world-engine/engine/contracts/ledger";
import { HashChainedLedger } from "@world-engine/ledger";
import { URL } from "node:url";

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

export async function initializeArtifactLedger(params: { worldRoot: string }): Promise<HashChainedLedger> {
  const ledgerPath = `${params.worldRoot}/ledger/ledger.ndjson`;
  const ledger = new HashChainedLedger(ledgerPath);
  await ledger.init();
  return ledger;
}

export function createArtifactLedgerRoutes(ledger: HashChainedLedger) {
  return async (req: any, res: any): Promise<boolean> => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    const method = req.method;

    // GET /ledger/status
    if (method === "GET" && pathname === "/ledger/status") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, ...ledger.status() }));
      return true;
    }

    // GET /ledger/range?start=1&end=10
    if (method === "GET" && pathname === "/ledger/range") {
      try {
        const searchParams = new URL(req.url, `http://${req.headers.host}`).searchParams;
        const query = {
          start: searchParams.get("start"),
          end: searchParams.get("end"),
        };
        const parsed = LedgerRangeQuerySchema.safeParse(query);
        if (!parsed.success) {
          res.writeHead(400, { "content-type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: parsed.error.flatten() }));
          return true;
        }
        const { start, end } = parsed.data;
        const events = await ledger.range(start, end);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true, start, end, events }));
        return true;
      } catch (e: any) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: e?.message ?? String(e) }));
        return true;
      }
    }

    // GET /ledger/stream?after_seq=0&limit=200
    if (method === "GET" && pathname === "/ledger/stream") {
      try {
        const searchParams = new URL(req.url, `http://${req.headers.host}`).searchParams;
        const query = {
          after_seq: searchParams.get("after_seq"),
          limit: searchParams.get("limit"),
        };
        const parsed = LedgerStreamQuerySchema.safeParse(query);
        if (!parsed.success) {
          res.writeHead(400, { "content-type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: parsed.error.flatten() }));
          return true;
        }
        const { after_seq, limit } = parsed.data;
        const events = await ledger.stream(after_seq, limit);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true, after_seq, limit, events }));
        return true;
      } catch (e: any) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: e?.message ?? String(e) }));
        return true;
      }
    }

    // GET /ledger/verify
    if (method === "GET" && pathname === "/ledger/verify") {
      try {
        const out = await ledger.verify();
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(out));
        return true;
      } catch (e: any) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: e?.message ?? String(e) }));
        return true;
      }
    }

    // POST /ledger/append
    if (method === "POST" && pathname === "/ledger/append") {
      try {
        const body = await parseJson(req);
        const parsed = LedgerEventInputSchema.safeParse(body);
        if (!parsed.success) {
          res.writeHead(400, { "content-type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: parsed.error.flatten() }));
          return true;
        }
        const entry = await ledger.append(parsed.data);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true, entry }));
        return true;
      } catch (e: any) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: e?.message ?? String(e) }));
        return true;
      }
    }

    // Not handled by this router
    return false;
  };
}
