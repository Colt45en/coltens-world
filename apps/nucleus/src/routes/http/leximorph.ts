import fs from "node:fs";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

const SIDECAR_BASE_URL = (process.env.LEXIMORPH_ENDPOINT || process.env.SIDECAR_URL || "http://127.0.0.1:8011").replace(/\/$/, "");
const SIDECAR_TIMEOUT_MS = 20_000;

const BOOKFOLD_HTML_PATH = path.resolve(process.cwd(), "packages/lexicon/leximorph-bookfold.html");

async function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
      if (body.length > 2_000_000) {
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function sidecarFetch(pathname: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SIDECAR_TIMEOUT_MS);
  try {
    return await fetch(`${SIDECAR_BASE_URL}${pathname}`, {
      ...init,
      signal: controller.signal as any,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function writeJson(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function forwardResponse(res: ServerResponse, upstream: Response, body: string): void {
  const contentType = upstream.headers.get("content-type") || "application/json; charset=utf-8";
  res.writeHead(upstream.status, { "content-type": contentType });
  res.end(body);
}

async function proxyJsonPost(req: IncomingMessage, res: ServerResponse, upstreamPath: string): Promise<boolean> {
  const rawBody = await readRequestBody(req);
  const upstream = await sidecarFetch(upstreamPath, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: rawBody || "{}",
  });
  forwardResponse(res, upstream, await upstream.text());
  return true;
}

async function proxyGet(req: IncomingMessage, res: ServerResponse, upstreamPath: string): Promise<boolean> {
  const upstream = await sidecarFetch(upstreamPath, { method: "GET" });
  forwardResponse(res, upstream, await upstream.text());
  return true;
}

function buildBookfoldHtml(req: IncomingMessage): string {
  const html = fs.readFileSync(BOOKFOLD_HTML_PATH, "utf8");
  const host = req.headers.host || "127.0.0.1:3000";
  const baseUrl = process.env.NUCLEUS_PUBLIC_URL || `http://${host}`;
  const injected = `${baseUrl.replace(/\/$/, "")}/leximorph`;

  const bootScript = [
    "<script>",
    "try {",
    `  const resolvedBase = ${JSON.stringify(injected)};`,
    "  localStorage.setItem('leximorph_backend_base_v1', resolvedBase);",
    "} catch {}",
    "</script>",
  ].join("\n");

  if (html.includes("</head>")) {
    return html.replace("</head>", `${bootScript}\n</head>`);
  }
  return `${bootScript}\n${html}`;
}

async function handleLeximorphQuery(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const urlValue = req.url || "";
  const pathname = urlValue.split("?")[0] ?? "";
  if (pathname !== "/leximorph/query") return false;

  if (req.method === "GET") {
    const url = new URL(urlValue, `http://${req.headers.host || "127.0.0.1"}`);
    const contains = url.searchParams.get("contains") || "";
    const limit = url.searchParams.get("limit") || "50";
    const language = url.searchParams.get("language");
    const kind = url.searchParams.get("kind");
    const status = url.searchParams.get("status");
    const partType = url.searchParams.get("part_type");
    const search = new URLSearchParams({ contains, limit });
    if (language) search.set("language", language);
    if (kind) search.set("kind", kind);
    if (status) search.set("status", status);
    if (partType) search.set("part_type", partType);
    const upstream = await sidecarFetch(`/leximorph/query?${search.toString()}`, { method: "GET" });
    const body = await upstream.text();
    forwardResponse(res, upstream, body);
    return true;
  }

  if (req.method === "POST") {
    const raw = await readRequestBody(req);
    const payload = raw ? JSON.parse(raw) : {};
    const term = String(payload?.term ?? payload?.contains ?? "");
    const limit = String(payload?.k ?? payload?.limit ?? 5);
    const upstream = await sidecarFetch(`/leximorph/query?contains=${encodeURIComponent(term)}&limit=${encodeURIComponent(limit)}`, {
      method: "GET",
    });
    const body = await upstream.text();
    forwardResponse(res, upstream, body);
    return true;
  }

  writeJson(res, 405, { error: "method_not_allowed" });
  return true;
}

async function handleProxy(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const urlValue = req.url || "";
  const pathname = urlValue.split("?")[0] ?? "";

  if (pathname === "/leximorph/bookfold" && req.method === "GET") {
    if (!fs.existsSync(BOOKFOLD_HTML_PATH)) {
      writeJson(res, 404, { error: "bookfold_not_found", path: BOOKFOLD_HTML_PATH });
      return true;
    }
    const html = buildBookfoldHtml(req);
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
    return true;
  }

  if (pathname === "/leximorph/health" && req.method === "GET") {
    return await proxyGet(req, res, "/leximorph/health");
  }

  if (pathname === "/leximorph/init" && req.method === "POST") {
    return await proxyJsonPost(req, res, "/leximorph/init");
  }

  if (pathname === "/leximorph/analyze" && req.method === "POST") {
    return await proxyJsonPost(req, res, "/leximorph/analyze");
  }

  if (pathname === "/leximorph/search" && req.method === "GET") {
    const rawQuery = urlValue.includes("?") ? urlValue.slice(urlValue.indexOf("?")) : "";
    return await proxyGet(req, res, `/leximorph/search${rawQuery}`);
  }

  if (pathname === "/leximorph/review-queue" && req.method === "GET") {
    const rawQuery = urlValue.includes("?") ? urlValue.slice(urlValue.indexOf("?")) : "";
    return await proxyGet(req, res, `/leximorph/review-queue${rawQuery}`);
  }

  if (pathname === "/leximorph/ingest/files" && req.method === "POST") {
    return await proxyJsonPost(req, res, "/leximorph/ingest/files");
  }

  if (pathname.startsWith("/leximorph/entry/") && req.method === "GET") {
    const id = pathname.slice("/leximorph/entry/".length);
    if (!id) {
      writeJson(res, 400, { error: "entry_id_required" });
      return true;
    }
    return await proxyGet(req, res, `/leximorph/entry/${encodeURIComponent(id)}`);
  }

  if (pathname.startsWith("/leximorph/review/") && req.method === "POST") {
    const id = pathname.slice("/leximorph/review/".length);
    if (!id) {
      writeJson(res, 400, { error: "entry_id_required" });
      return true;
    }
    return await proxyJsonPost(req, res, `/leximorph/review/${encodeURIComponent(id)}`);
  }

  if (pathname.startsWith("/leximorph/ingest/runs/") && req.method === "GET") {
    const runId = pathname.slice("/leximorph/ingest/runs/".length);
    if (!runId) {
      writeJson(res, 400, { error: "run_id_required" });
      return true;
    }
    return await proxyGet(req, res, `/leximorph/ingest/runs/${encodeURIComponent(runId)}`);
  }

  if (await handleLeximorphQuery(req, res)) {
    return true;
  }

  return false;
}

export function handleLeximorph(req: IncomingMessage, res: ServerResponse): boolean {
  const pathname = String((req.url || "").split("?")[0] || "");
  if (!pathname.startsWith("/leximorph")) {
    return false;
  }

  handleProxy(req, res).catch((error) => {
    writeJson(res, 502, {
      error: "leximorph_proxy_failed",
      message: error instanceof Error ? error.message : String(error),
    });
  });

  return true;
}
