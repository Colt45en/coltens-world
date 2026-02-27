import fs from "node:fs";
import path from "node:path";
const SIDECAR_BASE_URL = (process.env.LEXIMORPH_ENDPOINT || process.env.SIDECAR_URL || "http://127.0.0.1:8001").replace(/\/$/, "");
const SIDECAR_TIMEOUT_MS = 20_000;
const BOOKFOLD_HTML_PATH = path.resolve(process.cwd(), "packages/lexicon/leximorph-bookfold.html");
async function readRequestBody(req) {
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
async function sidecarFetch(pathname, init) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SIDECAR_TIMEOUT_MS);
    try {
        return await fetch(`${SIDECAR_BASE_URL}${pathname}`, {
            ...init,
            signal: controller.signal,
        });
    }
    finally {
        clearTimeout(timeout);
    }
}
function writeJson(res, status, payload) {
    res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(payload));
}
function forwardResponse(res, upstream, body) {
    const contentType = upstream.headers.get("content-type") || "application/json; charset=utf-8";
    res.writeHead(upstream.status, { "content-type": contentType });
    res.end(body);
}
function buildBookfoldHtml(req) {
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
async function handleLeximorphQuery(req, res) {
    if (req.url !== "/leximorph/query")
        return false;
    if (req.method === "GET") {
        const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
        const contains = url.searchParams.get("contains") || "";
        const limit = url.searchParams.get("limit") || "50";
        const upstream = await sidecarFetch(`/leximorph/query?contains=${encodeURIComponent(contains)}&limit=${encodeURIComponent(limit)}`, {
            method: "GET",
        });
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
async function handleProxy(req, res) {
    const pathname = (req.url || "").split("?")[0];
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
        const upstream = await sidecarFetch("/leximorph/health", { method: "GET" });
        forwardResponse(res, upstream, await upstream.text());
        return true;
    }
    if (pathname === "/leximorph/init" && req.method === "POST") {
        const rawBody = await readRequestBody(req);
        const upstream = await sidecarFetch("/leximorph/init", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: rawBody || "{}",
        });
        forwardResponse(res, upstream, await upstream.text());
        return true;
    }
    if (pathname === "/leximorph/analyze" && req.method === "POST") {
        const rawBody = await readRequestBody(req);
        const upstream = await sidecarFetch("/leximorph/analyze", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: rawBody,
        });
        forwardResponse(res, upstream, await upstream.text());
        return true;
    }
    if (await handleLeximorphQuery(req, res)) {
        return true;
    }
    return false;
}
export function handleLeximorph(req, res) {
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
