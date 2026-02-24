/**
 * Pipeline Results HTTP Routes
 *
 * Serves pipeline_results/* JSON files over HTTP for IDE viewer consumption.
 * All file access is restricted to whitelisted filenames (no path traversal).
 *
 * Endpoints:
 * - GET /api/pipeline/results/index
 * - GET /api/pipeline/results/file/:name
 */
import fs from "node:fs";
import path from "node:path";
const DEFAULT_DIR = "pipeline_results";
const ALLOWED_FILES = new Set([
    "decision_record.json",
    "evidence_packet.json",
    "validated_plan.json",
    "merge_result.json",
    "lexicon_entries.json",
    "rune_rows.json",
    "weekly_ops_report.json",
    "pipeline.log",
    "artifact_manifest.json",
    "baseline_metadata.json",
    "run_record_signed.json",
]);
function safeJoin(root, sub) {
    const full = path.resolve(root, sub);
    const rr = path.resolve(root);
    if (!full.startsWith(rr)) {
        throw new Error("Path traversal blocked");
    }
    return full;
}
export function handlePipelineResultsIndex(_req, res, opts) {
    if (_req.url !== "/api/pipeline/results/index")
        return false;
    const rootDir = path.resolve(process.cwd(), opts?.rootDir ?? DEFAULT_DIR);
    try {
        const index = Array.from(ALLOWED_FILES)
            .map((name) => {
            const p = safeJoin(rootDir, name);
            const exists = fs.existsSync(p);
            return {
                name,
                exists,
                size: exists ? fs.statSync(p).size : 0,
                mtimeMs: exists ? fs.statSync(p).mtimeMs : 0,
            };
        })
            .filter((x) => x.exists);
        res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ rootDir, index }));
    }
    catch (e) {
        res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: String(e) }));
    }
    return true;
}
export function handlePipelineResultsFile(req, res, opts) {
    const url = new URL(req.url ?? "", `http://${req.headers.host}`);
    if (!url.pathname.startsWith("/api/pipeline/results/file/"))
        return false;
    const name = url.pathname.slice("/api/pipeline/results/file/".length);
    const rootDir = path.resolve(process.cwd(), opts?.rootDir ?? DEFAULT_DIR);
    try {
        if (!ALLOWED_FILES.has(name)) {
            res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ error: "file_not_allowed", name }));
            return true;
        }
        const p = safeJoin(rootDir, name);
        if (!fs.existsSync(p)) {
            res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ error: "not_found", name }));
            return true;
        }
        const content = fs.readFileSync(p, "utf8");
        if (name.endsWith(".log")) {
            res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
            res.end(content);
        }
        else {
            res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
            res.end(content);
        }
    }
    catch (e) {
        res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: String(e) }));
    }
    return true;
}
/**
 * Register both handlers into an HTTP server.
 * Usage:
 *   registerPipelineResultsRoutes(server, { rootDir: "pipeline_results" });
 */
export function registerPipelineResultsRoutes(server, // http.Server
opts) {
    const orig = server.on ? server.on.bind(server) : null;
    if (orig) {
        // For Node.js http.Server, hook into "request" event
        server.on("request", (req, res) => {
            if (handlePipelineResultsIndex(req, res, opts) ||
                handlePipelineResultsFile(req, res, opts)) {
                return; // handled
            }
        });
    }
}
