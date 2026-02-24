/**
 * IDE Lexicon Client
 *
 * Connects to Nucleus lexicon API to provide code navigation,
 * hover tooltips, and symbol lookup for the IDE.
 * Implements local caching with TTL.
 */

import type { LexiconEntry, RuneDecoderRow } from "@world-engine/lexicon";

// ============================================================================
// Types
// ============================================================================

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

interface LexiconQueryParams {
    term?: string;
    language?: string;
    namespace?: string;
    minConfidence?: number;
    limit?: number;
}

interface GovernanceInfo {
    batch_id?: string;
    approved: boolean;
    review_required: boolean;
}

interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    governance: GovernanceInfo;
}

// ============================================================================
// Lexicon Client Implementation
// ============================================================================

export class IDELexiconClient {
    private nucleusUrl: string;
    private cache: Map<string, CacheEntry<any>> = new Map();
    private cacheTTL: number = 30000; // 30 seconds
    private requestTimeout: number = 5000; // 5 seconds

    constructor(nucleusUrl: string = "http://127.0.0.1:3000") {
        this.nucleusUrl = nucleusUrl.replace(/\/$/, "");
    }

    /**
     * Cache key generator
     */
    private getCacheKey(endpoint: string, params: Record<string, any>): string {
        const sorted = Object.keys(params)
            .sort()
            .map((k) => `${k}=${params[k]}`)
            .join("&");
        return `${endpoint}:${sorted}`;
    }

    /**
     * Check if cache entry is valid
     */
    private isCacheValid<T>(entry: CacheEntry<T> | undefined): entry is CacheEntry<T> {
        if (!entry) return false;
        return Date.now() - entry.timestamp < this.cacheTTL;
    }

    /**
     * Fetch with timeout
     */
    private async fetchWithTimeout(
        url: string,
        timeout: number = this.requestTimeout,
    ): Promise<Response> {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, { signal: controller.signal });
            return response;
        } finally {
            clearTimeout(id);
        }
    }

    /**
     * Query lexicon entries (terms, meanings, linguistic features)
     */
    async queryEntries(params: LexiconQueryParams): Promise<LexiconEntry[]> {
        const cacheKey = this.getCacheKey("entries", params);
        const cached = this.cache.get(cacheKey);

        if (this.isCacheValid(cached)) {
            return cached.data as LexiconEntry[];
        }

        try {
            const searchParams = new URLSearchParams();
            Object.entries(params).forEach(([k, v]) => {
                if (v !== undefined) searchParams.set(k, String(v));
            });

            const url = `${this.nucleusUrl}/lexicon/entries?${searchParams}`;
            const response = await this.fetchWithTimeout(url);

            if (!response.ok) {
                console.error(`Lexicon query failed: ${response.statusText}`);
                return [];
            }

            const data: ApiResponse<LexiconEntry[]> = await response.json();

            if (data.success && data.data) {
                this.cache.set(cacheKey, {
                    data: data.data,
                    timestamp: Date.now(),
                });

                return data.data;
            }

            return [];
        } catch (err) {
            console.error("Failed to query lexicon entries:", err);
            return [];
        }
    }

    /**
     * Query rune decoder rows (process tags, semantic meanings)
     */
    async queryRunes(params: LexiconQueryParams): Promise<RuneDecoderRow[]> {
        const cacheKey = this.getCacheKey("runes", params);
        const cached = this.cache.get(cacheKey);

        if (this.isCacheValid(cached)) {
            return cached.data as RuneDecoderRow[];
        }

        try {
            const searchParams = new URLSearchParams();
            Object.entries(params).forEach(([k, v]) => {
                if (v !== undefined) searchParams.set(k, String(v));
            });

            const url = `${this.nucleusUrl}/lexicon/runes?${searchParams}`;
            const response = await this.fetchWithTimeout(url);

            if (!response.ok) {
                console.error(`Rune query failed: ${response.statusText}`);
                return [];
            }

            const data: ApiResponse<RuneDecoderRow[]> = await response.json();

            if (data.success && data.data) {
                this.cache.set(cacheKey, {
                    data: data.data,
                    timestamp: Date.now(),
                });

                return data.data;
            }

            return [];
        } catch (err) {
            console.error("Failed to query runes:", err);
            return [];
        }
    }

    /**
     * Look up a single symbol (term or rune) with context
     */
    async lookupSymbol(
        symbol: string,
        language: string = "TypeScript",
    ): Promise<{ entries: LexiconEntry[]; runes: RuneDecoderRow[] }> {
        const [entries, runes] = await Promise.all([
            this.queryEntries({
                term: symbol,
                language,
                minConfidence: 0.65,
                limit: 5,
            }),
            this.queryRunes({
                term: symbol,
                language,
                minConfidence: 0.65,
                limit: 5,
            }),
        ]);

        return { entries, runes };
    }

    /**
     * Get items pending human review
     */
    async getReviewQueue(): Promise<any[]> {
        const cacheKey = "review-queue";
        const cached = this.cache.get(cacheKey);

        if (this.isCacheValid(cached)) {
            return cached.data as any[];
        }

        try {
            const url = `${this.nucleusUrl}/lexicon/review-queue`;
            const response = await this.fetchWithTimeout(url);

            if (!response.ok) {
                console.error(`Review queue fetch failed: ${response.statusText}`);
                return [];
            }

            const data: ApiResponse<any[]> = await response.json();

            if (data.success && data.data) {
                this.cache.set(cacheKey, {
                    data: data.data,
                    timestamp: Date.now(),
                });

                return data.data;
            }

            return [];
        } catch (err) {
            console.error("Failed to fetch review queue:", err);
            return [];
        }
    }

    /**
     * Get overall lexicon health status
     */
    async getStatus(): Promise<any> {
        const cacheKey = "status";
        const cached = this.cache.get(cacheKey);

        if (this.isCacheValid(cached)) {
            return cached.data;
        }

        try {
            const url = `${this.nucleusUrl}/lexicon/status`;
            const response = await this.fetchWithTimeout(url);

            if (!response.ok) {
                console.error(`Status fetch failed: ${response.statusText}`);
                return null;
            }

            const data = await response.json();

            if (data.success) {
                this.cache.set(cacheKey, {
                    data,
                    timestamp: Date.now(),
                });

                return data;
            }

            return null;
        } catch (err) {
            console.error("Failed to fetch status:", err);
            return null;
        }
    }

    /**
     * Clear cache
     */
    clearCache(): void {
        this.cache.clear();
    }

    /**
     * Clear single cache entry
     */
    clearCacheEntry(endpoint: string, params: Record<string, any>): void {
        const cacheKey = this.getCacheKey(endpoint, params);
        this.cache.delete(cacheKey);
    }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const lexiconClient = new IDELexiconClient();
