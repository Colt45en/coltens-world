/**
 * IDE Leximorph Client
 *
 * Talks to Nucleus `/leximorph/*` proxy endpoints for morphological/code analysis.
 * Kept separate from `lexiconClient` on purpose.
 */

type JsonObject = Record<string, unknown>;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export interface LeximorphAnalyzeInput {
  text: string;
  language?: string;
  kind?: string;
  store?: boolean;
  provenance?: {
    source_path?: string;
    source_kind?: "file" | "text" | "http";
    workspace_root?: string;
    line_start?: number;
    line_end?: number;
    col_start?: number;
    col_end?: number;
    snippet?: string;
  };
  tags?: string[];
  force_review?: boolean;
  source_type?: "manual" | "batch" | "ide" | "api";
}

export interface LeximorphSearchParams {
  q: string;
  limit?: number;
  language?: string;
  kind?: string;
  status?: string;
  part_type?: string;
  include_provenance?: boolean;
  include_parts?: boolean;
}

export interface LeximorphReviewQueueParams {
  limit?: number;
  language?: string;
  kind?: string;
  min_confidence?: number;
  status?: string;
}

export interface LeximorphReviewAction {
  action: "approve" | "reject" | "note";
  actor?: string;
  reason?: string;
  notes?: string;
}

export interface LeximorphIngestConfig {
  root_path: string;
  include_globs?: string[];
  exclude_globs?: string[];
  languages?: string[];
  max_files?: number;
  max_file_bytes?: number;
  store?: boolean;
  extract_words?: boolean;
  extract_identifiers?: boolean;
  extract_html?: boolean;
  record_provenance?: boolean;
  dry_run?: boolean;
  requested_by?: string;
}

export class IDELeximorphClient {
  private readonly nucleusUrl: string;
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private readonly cacheTtlMs = 15_000;
  private readonly requestTimeoutMs = 8_000;

  constructor(nucleusUrl = "http://127.0.0.1:3000") {
    this.nucleusUrl = nucleusUrl.replace(/\/$/, "");
  }

  private cacheKey(path: string, params?: Record<string, unknown>): string {
    if (!params) return path;
    const serialized = Object.keys(params)
      .sort()
      .map((k) => `${k}=${String(params[k])}`)
      .join("&");
    return `${path}?${serialized}`;
  }

  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.cacheTtlMs) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  private setCached<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  private async fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Leximorph request failed: ${response.status} ${response.statusText}`);
      }
      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  async analyze(input: LeximorphAnalyzeInput): Promise<JsonObject> {
    return await this.fetchJson<JsonObject>(`${this.nucleusUrl}/leximorph/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source_type: "ide",
        store: true,
        ...input,
      }),
    });
  }

  async search(params: LeximorphSearchParams): Promise<JsonObject> {
    const key = this.cacheKey("/leximorph/search", params as unknown as Record<string, unknown>);
    const cached = this.getCached<JsonObject>(key);
    if (cached) return cached;

    const query = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) query.set(k, String(v));
    }
    const data = await this.fetchJson<JsonObject>(`${this.nucleusUrl}/leximorph/search?${query.toString()}`);
    this.setCached(key, data);
    return data;
  }

  async queryContains(contains: string, limit = 50): Promise<JsonObject> {
    const key = this.cacheKey("/leximorph/query", { contains, limit });
    const cached = this.getCached<JsonObject>(key);
    if (cached) return cached;
    const data = await this.fetchJson<JsonObject>(
      `${this.nucleusUrl}/leximorph/query?contains=${encodeURIComponent(contains)}&limit=${encodeURIComponent(String(limit))}`
    );
    this.setCached(key, data);
    return data;
  }

  async getEntry(id: number): Promise<JsonObject> {
    return await this.fetchJson<JsonObject>(`${this.nucleusUrl}/leximorph/entry/${id}`);
  }

  async getReviewQueue(params: LeximorphReviewQueueParams = {}): Promise<JsonObject> {
    const query = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) query.set(k, String(v));
    }
    return await this.fetchJson<JsonObject>(`${this.nucleusUrl}/leximorph/review-queue?${query.toString()}`);
  }

  async reviewEntry(id: number, action: LeximorphReviewAction): Promise<JsonObject> {
    const result = await this.fetchJson<JsonObject>(`${this.nucleusUrl}/leximorph/review/${id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(action),
    });
    this.cache.clear();
    return result;
  }

  async startIngest(config: LeximorphIngestConfig): Promise<JsonObject> {
    const result = await this.fetchJson<JsonObject>(`${this.nucleusUrl}/leximorph/ingest/files`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        requested_by: "ide",
        ...config,
      }),
    });
    this.cache.clear();
    return result;
  }

  async getIngestRun(runId: string): Promise<JsonObject> {
    return await this.fetchJson<JsonObject>(`${this.nucleusUrl}/leximorph/ingest/runs/${encodeURIComponent(runId)}`);
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const leximorphClient = new IDELeximorphClient();
