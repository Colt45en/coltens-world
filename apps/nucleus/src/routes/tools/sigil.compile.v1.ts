import {
    SigilCompileToolExecuteV1,
    ToolExecuteV1,
    handleToolExecuteSigilCompileV1,
    normalizeProgramV1,
    sha256Hex,
    stableStringify,
} from "@world-engine/engine";
import type { HashChainedLedger } from "@world-engine/ledger";
import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import {
    appendSigilCompileEvents,
    appendSigilCompileFailedEvent,
} from "../../services/ledger/appendSigilCompileEvents";

const JsonContentType = "application/json; charset=utf-8";

export async function routeToolSigilCompileV1(req: Request, ledger?: HashChainedLedger): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "POST required" } }),
      {
        status: 405,
        headers: { "content-type": JsonContentType },
      }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    if (ledger) {
      try {
        await appendSigilCompileFailedEvent(ledger, {
          stage: "parse",
          error_code: "SCHEMA_ERROR",
          error_message: "Invalid JSON body",
        });
      } catch {
      }
    }

    return new Response(
      JSON.stringify({ ok: false, error: { code: "BAD_JSON", message: "Invalid JSON body" } }),
      {
        status: 400,
        headers: { "content-type": JsonContentType },
      }
    );
  }

  const base = ToolExecuteV1.safeParse(body);
  if (!base.success) {
    if (ledger) {
      try {
        await appendSigilCompileFailedEvent(ledger, {
          request_id:
            typeof body === "object" && body !== null && "request_id" in body
              ? String((body as { request_id?: unknown }).request_id ?? "") || undefined
              : undefined,
          stage: "parse",
          error_code: "SCHEMA_ERROR",
          error_message: base.error.message,
        });
      } catch {
      }
    }

    return new Response(
      JSON.stringify({
        ok: false,
        error: { code: "SCHEMA_ERROR", message: base.error.message },
      }),
      { status: 400, headers: { "content-type": JsonContentType } }
    );
  }

  try {
    const result = await handleToolExecuteSigilCompileV1(body);

    if (ledger) {
      await appendSigilCompileEvents(ledger, {
        request_id: result.request_id,
        program_hash: result.output.program_hash,
        artifact_hash: result.output.artifact_hash,
        path_count: result.output.artifact.paths.length,
        symmetry: result.output.artifact.symmetry,
      });
    }

    return new Response(JSON.stringify(result), { status: 200, headers: { "content-type": JsonContentType } });
  } catch (err) {
    const msg = err instanceof z.ZodError ? err.message : err instanceof Error ? err.message : "Unknown error";

    if (ledger) {
      try {
        const maybeSigil = SigilCompileToolExecuteV1.safeParse(body);
        const program_hash = maybeSigil.success
          ? sha256Hex(stableStringify(normalizeProgramV1(maybeSigil.data.input.program)))
          : undefined;

        await appendSigilCompileFailedEvent(ledger, {
          request_id: base.data.request_id,
          program_hash,
          stage: "compile",
          error_code: "TOOL_FAILED",
          error_message: msg,
        });
      } catch {
      }
    }

    return new Response(
      JSON.stringify({
        kind: "tool.result",
        v: 1,
        tool: "sigil.compile.v1",
        ok: false,
        error: { code: "TOOL_FAILED", message: msg },
        request_id: base.data.request_id,
      }),
      { status: 400, headers: { "content-type": JsonContentType } }
    );
  }
}

async function readRawBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function isToolSigilCompilePath(pathname: string): boolean {
  return pathname === "/tools/sigil.compile.v1";
}

export async function handleToolSigilCompileV1(
  req: IncomingMessage,
  res: ServerResponse,
  ledger?: HashChainedLedger
): Promise<boolean> {
  const host = req.headers.host || "127.0.0.1";
  const url = new URL(req.url || "/", `http://${host}`);
  if (!isToolSigilCompilePath(url.pathname)) {
    return false;
  }

  const method = req.method || "GET";
  const body = method === "POST" ? await readRawBody(req) : undefined;
  const request = new Request(url.toString(), {
    method,
    headers: req.headers as HeadersInit,
    body,
  });

  const response = await routeToolSigilCompileV1(request, ledger);
  const responseBody = await response.text();

  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  res.writeHead(response.status, headers);
  res.end(responseBody);
  return true;
}
