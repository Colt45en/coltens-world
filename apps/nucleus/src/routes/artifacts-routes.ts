// apps/nucleus/src/routes/artifacts-routes.ts
// Artifact storage endpoints: save, latest, read

import { ArtifactStore } from "@world-engine/artifacts";
import {
    ArtifactLatestSchema,
    ArtifactReadResponseSchema,
    ArtifactSaveRequestSchema,
} from "@world-engine/engine/contracts/artifacts";
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

export function createArtifactsRoutes(params: { artifactStore: ArtifactStore; ledger: HashChainedLedger }) {
  const store = params.artifactStore;

  return async (req: any, res: any): Promise<boolean> => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    const method = req.method;

    // POST /artifacts/save
    if (method === "POST" && pathname === "/artifacts/save") {
      try {
        const body = await parseJson(req);
        const parsed = ArtifactSaveRequestSchema.safeParse(body);
        if (!parsed.success) {
          res.writeHead(400, { "content-type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: parsed.error.flatten() }));
          return true;
        }
        const out = await store.save(parsed.data as any);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(out));
        return true;
      } catch (e: any) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: e?.message ?? String(e) }));
        return true;
      }
    }

    // GET /artifacts/latest/:docId
    if (method === "GET" && pathname.startsWith("/artifacts/latest/")) {
      try {
        const docId = pathname.slice("/artifacts/latest/".length);
        if (!docId) {
          res.writeHead(400, { "content-type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: "docId is required" }));
          return true;
        }
        const latest = await store.readLatest(docId);
        if (!latest) {
          res.writeHead(404, { "content-type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: "not found" }));
          return true;
        }
        const validated = ArtifactLatestSchema.safeParse(latest);
        if (!validated.success) {
          res.writeHead(500, { "content-type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: validated.error.flatten() }));
          return true;
        }
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(validated.data));
        return true;
      } catch (e: any) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: e?.message ?? String(e) }));
        return true;
      }
    }

    // GET /artifacts/read/:docId/:artifactId
    if (method === "GET" && pathname.startsWith("/artifacts/read/")) {
      try {
        const parts = pathname.slice("/artifacts/read/".length).split("/");
        const docId = parts[0];
        const artifactId = parts[1];
        if (!docId || !artifactId) {
          res.writeHead(400, { "content-type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: "docId and artifactId are required" }));
          return true;
        }
        const out = await store.readArtifact(docId, artifactId);
        if (!out) {
          res.writeHead(404, { "content-type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: "not found" }));
          return true;
        }
        const validated = ArtifactReadResponseSchema.safeParse(out);
        if (!validated.success) {
          res.writeHead(500, { "content-type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: validated.error.flatten() }));
          return true;
        }
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(validated.data));
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
