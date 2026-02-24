/**
 * Health Check Endpoint
 *
 * Responds to GET /health with JSON health status.
 * Used by launcher for readiness gating.
 *
 * Path: GET /health
 * Response: 200 with { ok: true, service: "nucleus", ts: <ISO8601> }
 */
export function handleHealthCheck(req, res) {
    if (req.method !== "GET" || req.url !== "/health")
        return false;
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({
        ok: true,
        service: "nucleus",
        ts: new Date().toISOString(),
    }));
    return true;
}
