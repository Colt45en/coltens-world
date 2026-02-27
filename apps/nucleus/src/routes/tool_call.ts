// apps/nucleus/src/routes/tool_call.ts
// Tool call recording endpoints (AI execution audit trail)

import { ToolCallRecordSchema } from "@world-engine/engine/contracts/tool_call";
import { HashChainedLedger, sha256Hex, stableStringify } from "@world-engine/ledger";
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

export function createToolCallRoutes(ledger: HashChainedLedger) {
  return async (req: any, res: any): Promise<boolean> => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    const method = req.method;

    // POST /tool_call/record
    if (method === "POST" && pathname === "/tool_call/record") {
      try {
        const body = await parseJson(req);
        const parsed = ToolCallRecordSchema.safeParse(body);
        if (!parsed.success) {
          res.writeHead(400, { "content-type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: parsed.error.flatten() }));
          return true;
        }

        const rec = parsed.data;

        // Optionally: derive hashes if caller didn't provide them
        // This lets callers either store full payloads or just hashes
        const input_hash = rec.input_hash ?? (rec.input ? sha256Hex(stableStringify(rec.input as any)) : undefined);
        const output_hash = rec.output_hash ?? (rec.output ? sha256Hex(stableStringify(rec.output as any)) : undefined);

        // Append to ledger with tool_call event type
        const entry = await ledger.append({
          type: "tool_call.record",
          doc_id: rec.doc_id ?? "global",
          artifact_id: rec.artifact_id,
          payload: {
            call_id: rec.call_id,
            tool_name: rec.tool_name,
            started_at_utc: rec.started_at_utc,
            ended_at_utc: rec.ended_at_utc,
            status: rec.status,
            input_hash,
            output_hash,
            error: rec.error ?? null,
          },
        });

        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true, ledger_seq: entry.seq, ledger_entry_hash: entry.entry_hash }));
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
