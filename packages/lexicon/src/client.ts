/**
 * Leximorph HTTP Client
 * Typed client for calling the FastAPI leximorph service
 *
 * Usage:
 * ```ts
 * const client = new LexiMorphClient('http://127.0.0.1:8001');
 * const result = await client.analyze('getUserName', 'js', 'identifier', { store: true });
 * const results = await client.query('User', { limit: 10 });
 * ```
 */

export interface AnalyzeRequest {
    text: string;
    language: string;
    kind: string;
    store?: boolean;
    db_path?: string;
}

export interface AnalyzeResponse {
    id?: number;
    entry: string;
    kind: string;
    language: string;
    parts: Record<string, unknown>;
    meta: Record<string, unknown>;
    created_at_utc: string;
}

export interface QueryResponse {
    id: number;
    entry: string;
    kind: string;
    language: string;
    parts: Record<string, unknown>;
    meta: Record<string, unknown>;
    created_at_utc: string;
}

export interface HealthResponse {
    ok: boolean;
    db_path: string;
}

export class LexiMorphClient {
    constructor(private baseUrl: string = 'http://127.0.0.1:8001') {
        // Normalize base URL (remove trailing slash)
        this.baseUrl = this.baseUrl.replace(/\/$/, '');
    }

    async analyze(
        text: string,
        language: string,
        kind: string,
        options?: { store?: boolean; db_path?: string }
    ): Promise<AnalyzeResponse> {
        const req: AnalyzeRequest = {
            text,
            language,
            kind,
        };
        if (options?.store !== undefined) req.store = options.store;
        if (options?.db_path !== undefined) req.db_path = options.db_path;

        const resp = await fetch(`${this.baseUrl}/leximorph/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req),
        });

        if (!resp.ok) {
            throw new Error(`Leximorph analyze failed: ${resp.statusText}`);
        }

        return resp.json();
    }

    async query(contains: string, options?: { limit?: number; db_path?: string }): Promise<QueryResponse[]> {
        const params = new URLSearchParams({
            contains,
            limit: String(options?.limit ?? 50),
        });

        if (options?.db_path) {
            params.append('db_path', options.db_path);
        }

        const resp = await fetch(`${this.baseUrl}/leximorph/query?${params}`);

        if (!resp.ok) {
            throw new Error(`Leximorph query failed: ${resp.statusText}`);
        }

        return resp.json();
    }

    async init(db_path?: string): Promise<{ ok: boolean; db_path: string }> {
        const req = db_path ? { db_path } : {};

        const resp = await fetch(`${this.baseUrl}/leximorph/init`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req),
        });

        if (!resp.ok) {
            throw new Error(`Leximorph init failed: ${resp.statusText}`);
        }

        return resp.json();
    }

    async health(): Promise<HealthResponse> {
        const resp = await fetch(`${this.baseUrl}/leximorph/health`);

        if (!resp.ok) {
            throw new Error(`Leximorph health check failed: ${resp.statusText}`);
        }

        return resp.json();
    }

    async export(db_path?: string): Promise<{ ok: boolean; db_path: string; export_path: string; rows: number }> {
        const params = new URLSearchParams();
        if (db_path) params.append('db_path', db_path);

        const resp = await fetch(`${this.baseUrl}/leximorph/export?${params}`);

        if (!resp.ok) {
            throw new Error(`Leximorph export failed: ${resp.statusText}`);
        }

        return resp.json();
    }
}

/**
 * Quick test function to verify connectivity
 */
export async function quickTest() {
    const client = new LexiMorphClient('http://127.0.0.1:8001');

    try {
        console.log('🧪 Testing Leximorph API...\n');

        // Health check
        const health = await client.health();
        console.log('✓ Health:', health);

        // Analyze word
        const word = await client.analyze('unbelievable', 'en', 'word', { store: true });
        console.log('✓ Analyze (word):', word.id, word.parts);

        // Analyze identifier
        const id = await client.analyze('getUserName', 'js', 'identifier', { store: true });
        console.log('✓ Analyze (identifier):', id.id, id.parts);

        // Query
        const results = await client.query('User', { limit: 5 });
        console.log('✓ Query "User":', results.length, 'results');

        console.log('\n✅ All tests passed!');
    } catch (err) {
        console.error('❌ Test failed:', err);
        throw err;
    }
}
