/**
 * FlowState Analysis HTTP Route
 *
 * Endpoint: POST /api/flowstate/analyze
 * Request body: { code: string, topN?: number, sessionId?: string }
 * Response: { metrics: FlowstateMetricsOutput, enrichment?: EnrichedLexicon, ok: boolean }
 *
 * Integration:
 * 1. Compute local flowstate metrics
 * 2. Forward to sidecar for enrichment (lexicon extraction)
 * 3. Return combined metrics + enrichment
 */

import type { IncomingMessage, ServerResponse } from "node:http";
// TODO: Import from @world-engine/flowstate when available
// import { computeFlowMetrics } from "@world-engine/flowstate";

const computeFlowMetrics = (code: string) => ({});

const SIDECAR_URL = process.env.SIDECAR_URL || "http://127.0.0.1:8011";
const SIDECAR_TIMEOUT = 30000; // 30 seconds

export async function callSidecarEnrich(
  code: string,
  metrics: any,
  sessionId?: string,
  topN: number = 32
): Promise<any> {
  /**
   * Call sidecar /flowstate/enrich endpoint for lexicon enrichment
   */
  try {
    const enrichmentUrl = `${SIDECAR_URL}/flowstate/enrich`;
    const payload = {
      code,
      metrics: {
        energy: metrics.energy,
        tempo: metrics.tempo,
        tension: metrics.tension,
        remainingBraces: metrics.remainingBraces,
        mismatchBraces: metrics.mismatchBraces,
        keywordCount: metrics.keywordCount,
        tokenCount: metrics.tokenCount,
        density: metrics.density,
      },
      language: "TypeScript",
      topN,
      sessionId: sessionId || undefined,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SIDECAR_TIMEOUT);

    const response = await fetch(enrichmentUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal as any,
    } as any);

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[flowstate/enrich] sidecar returned ${response.status}`);
      return null; // Graceful degradation
    }

    const enrichment = await response.json();
    return enrichment;
  } catch (err) {
    console.warn("[flowstate/enrich] sidecar call failed", err instanceof Error ? err.message : String(err));
    return null; // Graceful degradation if sidecar unavailable
  }
}

export function handleFlowstateAnalyze(
  req: IncomingMessage,
  res: ServerResponse
): boolean {
  if (req.url !== "/api/flowstate/analyze" || req.method !== "POST") {
    return false;
  }

  let body = "";

  req.on("data", (chunk) => {
    body += chunk.toString();
    if (body.length > 1_000_000) {
      res.writeHead(413, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Payload too large" }));
    }
  });

  req.on("end", () => {
    try {
      const input = JSON.parse(body);
      const { code, topN = 32, sessionId } = input;

      if (typeof code !== "string") {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "code must be string" }));
        return;
      }

      // Compute local metrics
      const metrics = computeFlowMetrics(code);

      // Try to enrich from sidecar (async, non-blocking)
      callSidecarEnrich(code, metrics, sessionId, topN)
        .then((enrichment) => {
          const response = {
            ok: true,
            metrics,
            enrichment: enrichment || null,
            sessionId: sessionId || null,
          };
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify(response));
        })
        .catch((err) => {
          console.error("[flowstate/analyze] enrichment error", err);
          // Return metrics even if enrichment fails
          const response = {
            ok: true,
            metrics,
            enrichment: null,
            sessionId: sessionId || null,
            warning: "Enrichment unavailable",
          };
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify(response));
        });
    } catch (err) {
      console.error("[flowstate/analyze]", err);
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: String(err) }));
    }
  });

  req.on("error", (err) => {
    console.error("[flowstate/analyze] request error", err);
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "Request error" }));
  });

  return true;
}
