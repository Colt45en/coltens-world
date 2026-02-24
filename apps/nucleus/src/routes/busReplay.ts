import { globalBus } from "../bus/busHub";

/**
 * Bus Replay HTTP Routes
 *
 * Handles HTTP requests for:
 * - GET /bus/trace/:traceId — fetch all envelopes for a trace
 * - GET /bus/trace/:traceId/tail — fetch last N envelopes
 * - GET /bus/traces — list all active traceIds
 * - GET /bus/stats — get bus statistics
 * - DELETE /bus/trace/:traceId — clear cache for trace
 */

export function handleBusReplayRequest(req: any, res: any): boolean {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    const method = req.method.toUpperCase();

    // GET /bus/trace/:traceId
    const traceMatch = pathname.match(/^\/bus\/trace\/([a-z0-9_]+)$/);
    if (method === "GET" && traceMatch && traceMatch[1]) {
        const traceId = traceMatch[1];
        const envelopes = globalBus.getTraceEnvelopes(traceId);
        sendJson(res, 200, {
            ok: true,
            traceId,
            count: envelopes.length,
            envelopes,
        });
        return true;
    }

    // GET /bus/trace/:traceId/tail?limit=10
    const tailMatch = pathname.match(/^\/bus\/trace\/([a-z0-9_]+)\/tail$/);
    if (method === "GET" && tailMatch && tailMatch[1]) {
        const traceId = tailMatch[1];
        const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50") || 50, 500);
        const envelopes = globalBus.getTraceEnvelopesTail(traceId, limit);
        sendJson(res, 200, {
            ok: true,
            traceId,
            limit,
            count: envelopes.length,
            envelopes,
        });
        return true;
    }

    // GET /bus/traces
    if (method === "GET" && pathname === "/bus/traces") {
        const traceIds = globalBus.getAllTraceIds();
        sendJson(res, 200, {
            ok: true,
            count: traceIds.length,
            traceIds,
        });
        return true;
    }

    // GET /bus/stats
    if (method === "GET" && pathname === "/bus/stats") {
        const stats = globalBus.getStats();
        sendJson(res, 200, {
            ok: true,
            ...stats,
        });
        return true;
    }

    // DELETE /bus/trace/:traceId
    const deleteMatch = pathname.match(/^\/bus\/trace\/([a-z0-9_]+)$/);
    if (method === "DELETE" && deleteMatch && deleteMatch[1]) {
        const traceId = deleteMatch[1];
        globalBus.clearTrace(traceId);
        sendJson(res, 200, {
            ok: true,
            message: `Cleared trace ${traceId}`,
        });
        return true;
    }

    return false; // not handled
}

function sendJson(res: any, statusCode: number, body: any): void {
    res.writeHead(statusCode, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
}
