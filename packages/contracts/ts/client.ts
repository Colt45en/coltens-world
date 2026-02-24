/**
 * Autonomy Loop HTTP Client (typed, generated from OpenAPI).
 *
 * This client is hand-written to work with the generated types from OpenAPI
 * and provides a strongly-typed interface for TS applications.
 *
 * Usage:
 *   const client = new AutonomyLoopClient("http://localhost:8001");
 *   const result = await client.runBatch({
 *     source_id: "file:src/math.ts",
 *     kind: "code",
 *     language_hint: "TypeScript",
 *     text: "function optimize(x) { return x * 2; }",
 *   });
 */

export interface AutonomyLoopConfig {
    baseUrl: string;
    timeout?: number;
}

export class AutonomyLoopClient {
    private baseUrl: string;
    private timeout: number;

    constructor(config: AutonomyLoopConfig | string) {
        if (typeof config === "string") {
            this.baseUrl = config;
            this.timeout = 30000;
        } else {
            this.baseUrl = config.baseUrl;
            this.timeout = config.timeout ?? 30000;
        }
    }

    /**
     * Ingest: Extract EvidencePacket from raw text/code.
     */
    async ingest(params: {
        source_id: string;
        kind: "text" | "code" | "mixed";
        language_hint?: string;
        text: string;
    }): Promise<Record<string, any>> {
        return this._post("/autonomy/v1/ingest", params);
    }

    /**
     * Run full batch: Detective → Alchemist → Analyst → Specialist → PM.
     */
    async runBatch(params: {
        source_id: string;
        kind?: "text" | "code" | "mixed";
        language_hint?: string;
        text: string;
        fail_on_unknown_tag?: boolean;
    }): Promise<{
        EvidencePacket: Record<string, any>;
        LexiconEntry: Record<string, any>[];
        RuneDecoderRow: Record<string, any>[];
        ValidatedPlan: Record<string, any>;
        DecisionRecord: Record<string, any>;
    }> {
        return this._post("/autonomy/v1/run-batch", params);
    }

    /**
     * Query the controlled vocabulary (process tags).
     */
    async taxonomyList(params?: {
        active_only?: boolean;
    }): Promise<{
        tags: Array<{
            tag: string;
            description: string;
            active: boolean;
            created_at: string;
        }>;
        total: number;
    }> {
        return this._post("/autonomy/v1/taxonomy-list", params ?? { active_only: true });
    }

    /**
     * Regression harness: replay batches and check determinism.
     */
    async replayLast(params?: {
        n?: number;
        since?: string;
        days?: number;
        fail_on_unknown_tag?: boolean;
    }): Promise<{
        ok: boolean;
        checked: number;
        drift_count?: number;
        drift?: Array<{
            batch_id: string;
            drift_type: string;
            details?: Record<string, any>;
        }>;
    }> {
        return this._post("/autonomy/v1/replay-last", params ?? { n: 25 });
    }

    private async _post(path: string, body: any): Promise<any> {
        const url = new URL(path, this.baseUrl);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const res = await fetch(url.toString(), {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify(body),
                signal: controller.signal,
            });

            if (!res.ok) {
                const error = await res.json().catch(() => ({ message: res.statusText })) as { error?: string; message?: string };
                const msg = error.error ?? error.message ?? `HTTP ${res.status}`;
                throw new Error(msg);
            }

            return (await res.json()) as any;
        } finally {
            clearTimeout(timeoutId);
        }
    }
}

/**
 * Convenience factory.
 */
export function createAutonomyLoopClient(baseUrl: string): AutonomyLoopClient {
    return new AutonomyLoopClient(baseUrl);
}
