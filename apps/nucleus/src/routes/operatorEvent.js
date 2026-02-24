/**
 * Operator Event Routes
 *
 * Handles operator execution results from sidecar.
 * Emits to globalBus for IDE/memory/routing.
 *
 * Routes:
 * - POST /operator/event/{event_type}
 * - GET /operator/events
 */
import { EVT_OPERATOR_EXECUTED, OperatorExecutionSchema } from "@world-engine/protocol";
import { globalBus } from "../bus/busHub";
const events = [];
const maxEvents = 500; // Keep last N events
export function handleOperatorEvent(req, res) {
    if (!req.url?.startsWith("/operator/"))
        return false;
    if (req.method === "GET" && req.url === "/operator/events") {
        handleGetOperatorEvents(req, res);
        return true;
    }
    if (req.method === "POST" && req.url?.startsWith("/operator/event/")) {
        handlePostOperatorEvent(req, res);
        return true;
    }
    return false;
}
/**
 * POST /operator/event/{event_type}
 *
 * Event body:
 * {
 *   "operator_id": "op_xxx",
 *   "operator_name": "prompt.operator.patch",
 *   "trace_id": "uuid",
 *   "timestamp": "2025-02-13T...",
 *   "payload": {...}
 * }
 */
function handlePostOperatorEvent(req, res) {
    let body = "";
    req.on("data", (chunk) => {
        body += chunk.toString();
    });
    req.on("end", () => {
        try {
            const data = JSON.parse(body);
            const match = req.url?.match(/^\/operator\/event\/([a-z.]+)$/);
            const eventType = match?.[1] || "operator.unknown";
            // Log event
            const event = {
                type: eventType,
                operator_id: data.operator_id || "unknown",
                operator_name: data.operator_name || "unknown",
                trace_id: data.trace_id || "",
                timestamp: data.timestamp || new Date().toISOString(),
                payload: data.payload || {},
            };
            events.push(event);
            if (events.length > maxEvents) {
                events.shift();
            }
            // Emit to globalBus (Phase 5 integration)
            if (eventType === "operator.executed") {
                try {
                    // Validate against schema
                    const validated = OperatorExecutionSchema.parse(event.payload);
                    // Emit as BusEnvelopeV1
                    globalBus.publish({
                        v: 1,
                        id: `operator_${event.operator_id}`,
                        type: EVT_OPERATOR_EXECUTED,
                        ts: new Date().toISOString(),
                        source: "sidecar",
                        traceId: event.trace_id,
                        spanId: `span_${event.operator_id}`,
                        severity: validated.status === "success" ? "info" : "warn",
                        data: validated,
                        parentSpanId: undefined,
                    });
                }
                catch (e) {
                    console.warn(`⚠️ Operator event validation failed:`, e);
                }
            }
            res.writeHead(202, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: true, event_type: eventType }));
        }
        catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: false, error: String(e) }));
        }
    });
}
/**
 * GET /operator/events
 *
 * Returns recent operator events.
 */
function handleGetOperatorEvents(req, res) {
    const limit = parseInt(new URL(req.url || "", "http://localhost").searchParams.get("limit") || "50");
    const recent = events.slice(-limit);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
        ok: true,
        total: events.length,
        returned: recent.length,
        events: recent,
    }));
}
/**
 * Get recent operator events (for in-memory access).
 */
export function getRecentOperatorEvents(limit = 20) {
    return events.slice(-limit);
}
/**
 * Get operator event by trace_id.
 */
export function getOperatorEventByTrace(traceId) {
    return events.find((e) => e.trace_id === traceId);
}
/**
 * Clear all operator events (for testing).
 */
export function clearOperatorEvents() {
    events.length = 0;
}
