// nucleusResponse.normalize.ts
// Fully runnable TypeScript (Node 18+ / modern bundlers). Requires: npm i zod

import { z } from "zod";

/* ============================================================================
 * Zod schema for NucleusResponse v1.1 (matches the hardened JSON schema)
 * ========================================================================== */

export const CitationLocatorSchema = z
  .object({
    page: z.number().int().min(0).optional(),
    line_start: z.number().int().min(0).optional(),
    line_end: z.number().int().min(0).optional(),
    char_start: z.number().int().min(0).optional(),
    char_end: z.number().int().min(0).optional(),
    url: z.string().max(2048).optional(),
  })
  .strict();

export const CitationMetaSchema = z
  .object({
    title: z.string().max(300).optional(),
    published_at: z.string().datetime().optional(),
  })
  .passthrough(); // meta can be extended safely

export const CitationSchema = z
  .object({
    doc_id: z.string().min(1).max(256),
    source: z.enum(["file", "web", "memory", "tool", "user"]),
    confidence: z.number().min(0).max(1),
    quote: z.string().max(500).optional(),
    locator: CitationLocatorSchema.optional(),
    meta: CitationMetaSchema.optional(),
  })
  .strict();

export const ToolArtifactSchema = z
  .object({
    kind: z.enum(["file", "image", "json", "log", "url"]),
    ref: z.string().max(2048),
    sha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  })
  .strict();

export const ToolCallSchema = z
  .object({
    tool_id: z.string().min(1).max(120),
    status: z.enum(["ok", "error", "skipped"]),
    duration_ms: z.number().int().min(0).optional(),
    args_redacted: z
      .record(
        z.string(),
        z.union([
          z.string().max(500),
          z.number(),
          z.boolean(),
          z.array(z.string().max(200)).max(50),
        ])
      )
      .optional(),
    stdout_trunc: z.string().max(8000).optional(),
    stderr_trunc: z.string().max(8000).optional(),
    exit_code: z.number().int().optional(),
    artifacts: z.array(ToolArtifactSchema).max(20).optional(),
    error: z
      .object({
        code: z.string().max(80),
        message: z.string().max(2000),
      })
      .strict()
      .optional(),
  })
  .strict();

export const ClarifySchema = z
  .object({
    question: z.string().max(2000),
    choices: z.array(z.string().max(200)).max(20).optional(),
  })
  .strict();

export const NucleusResponseV11Schema = z
  .object({
    version: z.literal("nucleus.response.v1.1"),
    query_id: z.string().min(8).max(128),
    timestamp_utc: z.string().datetime().regex(/Z$/, "timestamp_utc must end with Z (UTC)"),
    intent: z.enum(["retrieve", "tool", "memory", "clarify"]),
    status: z.enum(["ok", "partial", "error"]),
    confidence: z.number().min(0).max(1),
    answer_text: z.string().min(1).max(20000),
    citations: z.array(CitationSchema).max(50).optional(),
    tool_calls: z.array(ToolCallSchema).max(20).optional(),
    clarify: ClarifySchema.optional(),
    extensions: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.intent === "tool" && !v.tool_calls) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "tool_calls is required when intent=tool",
        path: ["tool_calls"],
      });
    }
    if (v.intent === "clarify" && !v.clarify) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "clarify is required when intent=clarify",
        path: ["clarify"],
      });
    }
  });

export type NucleusResponseV11 = z.infer<typeof NucleusResponseV11Schema>;

/* ============================================================================
 * Back-compat parser for v1 (your original)
 * ========================================================================== */

export const NucleusResponseV1LooseSchema = z
  .object({
    version: z.literal("nucleus.response.v1"),
    query_id: z.string(),
    timestamp_utc: z.string(),
    intent: z.enum(["retrieve", "tool", "memory", "clarify"]),
    answer_text: z.string(),
    citations: z
      .array(
        z
          .object({
            doc_id: z.string(),
            quote: z.string().optional(),
            confidence: z.number(),
          })
          .passthrough()
      )
      .optional(),
  })
  .passthrough();

/* ============================================================================
 * Normalization helpers
 * ========================================================================== */

export interface NormalizeOptions {
  // If true, unknown top-level fields are moved into `extensions`
  preserveExtensions?: boolean;

  // Default citation source when inference is impossible
  defaultCitationSource?: "file" | "web" | "memory" | "tool" | "user";

  // Max lengths (defaults match schema)
  maxAnswerChars?: number;
  maxStdoutChars?: number;
  maxStderrChars?: number;

  // Aggressive secret redaction toggle
  redactSecrets?: boolean;

  // If intent=tool but tool_calls missing, choose behavior:
  // - "error": set status=error and tool_calls=[]
  // - "partial": set status=partial and tool_calls=[]
  missingToolCallsBehavior?: "error" | "partial";
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function trunc(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max);
}

function safeIsoUtc(ts: unknown): string {
  // Accepts: ISO strings, ms epoch numbers, Date-like strings
  // Output: UTC ISO string ending with Z
  if (typeof ts === "number" && Number.isFinite(ts)) return new Date(ts).toISOString();
  if (typeof ts === "string") {
    const d = new Date(ts);
    if (!Number.isNaN(d.valueOf())) return d.toISOString();
  }
  return new Date(0).toISOString(); // deterministic fallback
}

function inferCitationSource(docId: string, def: NormalizeOptions["defaultCitationSource"]): "file" | "web" | "memory" | "tool" | "user" {
  const lower = docId.toLowerCase();
  if (lower.startsWith("http://") || lower.startsWith("https://")) return "web";
  if (lower.startsWith("mem:") || lower.startsWith("memory:")) return "memory";
  if (lower.startsWith("tool:")) return "tool";
  if (lower.startsWith("user:")) return "user";
  return def ?? "file";
}

function stableLocatorKey(locator?: z.infer<typeof CitationLocatorSchema>): string {
  if (!locator) return "";
  const page = locator.page ?? -1;
  const ls = locator.line_start ?? -1;
  const cs = locator.char_start ?? -1;
  const url = locator.url ?? "";
  return `${page}|${ls}|${cs}|${url}`;
}

function redactSensitive(text: string): string {
  // Deterministic, conservative redaction patterns.
  // This won't catch everything, but it blocks the common high-risk leaks.
  const patterns: Array<[RegExp, string]> = [
    // Bearer tokens
    [/\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b/gi, "Bearer [REDACTED]"],
    // OpenAI-like keys (generic)
    [/\b(sk-[A-Za-z0-9]{20,})\b/g, "[REDACTED]"],
    // AWS Access Key ID
    [/\bAKIA[0-9A-Z]{16}\b/g, "[REDACTED]"],
    // JWT (very common)
    [/\beyJ[A-Za-z0-9_-]+?\.[A-Za-z0-9_-]+?\.[A-Za-z0-9_-]+\b/g, "[REDACTED]"],
    // "apiKey=...", "api_key: ...", "token: ..."
    [/\b(api[_-]?key|token|secret|password)\b\s*[:=]\s*["']?[A-Za-z0-9\-._~+/]{6,}["']?/gi, "$1=[REDACTED]"],
    // Basic auth style user:pass@host
    [/\/\/([^:/\s]+):([^@\s]+)@/g, "//[REDACTED]:[REDACTED]@"],
  ];

  let out = text;
  for (const [re, repl] of patterns) out = out.replace(re, repl);
  return out;
}

function computeDefaultConfidence(args: { intent: NucleusResponseV11["intent"]; status: NucleusResponseV11["status"]; citations?: Array<{ confidence: number }> }): number {
  const { intent, status, citations } = args;

  if (status === "error") return 0.2;

  const hasCites = (citations?.length ?? 0) > 0;
  const maxCite = hasCites ? Math.max(...(citations!.map((c) => clamp01(c.confidence)))) : 0;

  if (intent === "clarify") return 0.4;
  if (intent === "tool") return hasCites ? Math.max(0.65, maxCite) : 0.65;
  if (intent === "memory") return hasCites ? Math.max(0.6, maxCite) : 0.6;
  // retrieve
  return hasCites ? Math.max(0.55, maxCite) : 0.55;
}

function computeStatus(args: { intent: NucleusResponseV11["intent"]; tool_calls?: NucleusResponseV11["tool_calls"] }): NucleusResponseV11["status"] {
  if (args.intent !== "tool") return "ok";
  const calls = args.tool_calls ?? [];
  if (calls.length === 0) return "partial";
  const ok = calls.filter((c) => c.status === "ok").length;
  const err = calls.filter((c) => c.status === "error").length;
  if (err > 0 && ok === 0) return "error";
  if (err > 0 && ok > 0) return "partial";
  return "ok";
}

/* ============================================================================
 * Public API: normalize + validate
 * ========================================================================== */

export function normalizeNucleusResponse(input: unknown, opts: NormalizeOptions = {}): NucleusResponseV11 {
  const {
    preserveExtensions = true,
    defaultCitationSource = "file",
    maxAnswerChars = 20000,
    maxStdoutChars = 8000,
    maxStderrChars = 8000,
    redactSecrets = true,
    missingToolCallsBehavior = "error",
  } = opts;

  if (typeof input !== "object" || input === null) {
    // deterministic minimal error response
    const out: NucleusResponseV11 = {
      version: "nucleus.response.v1.1",
      query_id: "invalid_input",
      timestamp_utc: new Date(0).toISOString(),
      intent: "clarify",
      status: "error",
      confidence: 0.2,
      answer_text: "Invalid response payload (not an object).",
      clarify: { question: "Please resend the response as an object." },
    };
    return NucleusResponseV11Schema.parse(out);
  }

  const raw = input as Record<string, unknown>;
  const version = String(raw.version ?? "");

  // Capture unknown fields into extensions if enabled
  const extensions: Record<string, unknown> | undefined = preserveExtensions
    ? Object.fromEntries(
        Object.entries(raw).filter(([k]) => ![
          "version","query_id","timestamp_utc","intent","status","confidence","answer_text",
          "citations","tool_calls","clarify","extensions"
        ].includes(k))
      )
    : undefined;

  if (version === "nucleus.response.v1.1") {
    // Normalize inside v1.1
    const intent = (raw.intent as any) ?? "retrieve";

    const base: Partial<NucleusResponseV11> = {
      version: "nucleus.response.v1.1",
      query_id: typeof raw.query_id === "string" ? raw.query_id : "missing_query_id",
      timestamp_utc: safeIsoUtc(raw.timestamp_utc),
      intent,
      status: (raw.status as any) ?? "ok",
      confidence: typeof raw.confidence === "number" ? clamp01(raw.confidence) : 0,
      answer_text: trunc(String(raw.answer_text ?? ""), maxAnswerChars).trim() || " ",
      extensions: preserveExtensions
        ? { ...(typeof raw.extensions === "object" && raw.extensions ? (raw.extensions as any) : {}), ...extensions }
        : undefined,
    };

    // citations
    const citesIn = Array.isArray(raw.citations) ? raw.citations : [];
    const citations = normalizeCitations(citesIn, defaultCitationSource);

    // tool_calls
    const callsIn = Array.isArray(raw.tool_calls) ? raw.tool_calls : undefined;
    const tool_calls = callsIn ? normalizeToolCalls(callsIn, { maxStdoutChars, maxStderrChars, redactSecrets }) : undefined;

    // clarify
    const clarifyIn = raw.clarify;
    const clarify =
      intent === "clarify"
        ? normalizeClarify(clarifyIn, base.answer_text || "Please clarify your request.")
        : undefined;

    // status/confidence finalization
    const status = (raw.status as any) ?? computeStatus({ intent, tool_calls });
    const confidence =
      typeof raw.confidence === "number"
        ? clamp01(raw.confidence)
        : computeDefaultConfidence({ intent, status, citations: citations?.map(c => ({ confidence: c.confidence })) || [] });

    const out: NucleusResponseV11 = {
      ...(base as any),
      status,
      confidence,
      ...(citations && citations.length ? { citations } : {}),
      ...(tool_calls ? { tool_calls } : {}),
      ...(clarify ? { clarify } : {}),
    };

    return NucleusResponseV11Schema.parse(out);
  }

  // v1 -> v1.1 upgrade path
  const v1 = NucleusResponseV1LooseSchema.parse(raw);

  const intent = v1.intent;
  const answer_text = trunc(String(v1.answer_text ?? ""), maxAnswerChars).trim() || " ";

  const citations = normalizeV1Citations((v1.citations ?? []) as any, defaultCitationSource);

  // v1 had no tool_calls/status/confidence — compute deterministically
  const tool_calls =
    intent === "tool"
      ? [] // v1 didn't define tool_calls; we can't invent them
      : undefined;

  const status =
    intent === "tool"
      ? (missingToolCallsBehavior === "error" ? "error" : "partial")
      : "ok";

  const confidence = computeDefaultConfidence({ intent, status, citations });

  const out: NucleusResponseV11 = {
    version: "nucleus.response.v1.1",
    query_id: String(v1.query_id ?? "missing_query_id"),
    timestamp_utc: safeIsoUtc(v1.timestamp_utc),
    intent,
    status,
    confidence,
    answer_text,
    ...(citations.length ? { citations } : {}),
    ...(tool_calls ? { tool_calls } : {}),
    ...(intent === "clarify" ? { clarify: { question: answer_text } } : {}),
    ...(preserveExtensions ? { extensions } : {}),
  };

  return NucleusResponseV11Schema.parse(out);
}

export function validateNucleusResponseV11(input: unknown): { ok: true; value: NucleusResponseV11 } | { ok: false; errors: z.ZodIssue[] } {
  const parsed = NucleusResponseV11Schema.safeParse(input);
  if (parsed.success) return { ok: true, value: parsed.data };
  return { ok: false, errors: parsed.error.issues };
}

export function assertValidNucleusResponse(input: unknown): NucleusResponseV11 {
  return NucleusResponseV11Schema.parse(input);
}

/* ============================================================================
 * Internal normalizers
 * ========================================================================== */

function normalizeCitations(items: unknown[], defaultSource: NormalizeOptions["defaultCitationSource"]): NucleusResponseV11["citations"] {
  const out: Array<z.infer<typeof CitationSchema>> = [];

  for (const it of items) {
    if (typeof it !== "object" || it === null) continue;
    const o = it as Record<string, unknown>;
    const doc_id = typeof o.doc_id === "string" ? o.doc_id : "";
    if (!doc_id) continue;

    const source =
      typeof o.source === "string" && ["file", "web", "memory", "tool", "user"].includes(o.source)
        ? (o.source as any)
        : inferCitationSource(doc_id, defaultSource);

    const confidence = clamp01(typeof o.confidence === "number" ? o.confidence : 0);

    const quote = typeof o.quote === "string" ? trunc(o.quote, 500) : undefined;

    const locator =
      typeof o.locator === "object" && o.locator !== null
        ? CitationLocatorSchema.safeParse(o.locator).success
          ? CitationLocatorSchema.parse(o.locator)
          : undefined
        : undefined;

    const meta =
      typeof o.meta === "object" && o.meta !== null
        ? CitationMetaSchema.safeParse(o.meta).success
          ? CitationMetaSchema.parse(o.meta)
          : undefined
        : undefined;

    out.push({ doc_id, source, confidence, ...(quote ? { quote } : {}), ...(locator ? { locator } : {}), ...(meta ? { meta } : {}) });
  }

  // Dedupe by (source, doc_id, locatorKey). Keep highest confidence.
  const byKey = new Map<string, z.infer<typeof CitationSchema>>();
  for (const c of out) {
    const key = `${c.source}::${c.doc_id}::${stableLocatorKey(c.locator)}`;
    const prev = byKey.get(key);
    if (!prev || c.confidence > prev.confidence) byKey.set(key, c);
  }

  // Stable sort
  const deduped = Array.from(byKey.values()).sort((a, b) => {
    const s = a.source.localeCompare(b.source);
    if (s !== 0) return s;
    const d = a.doc_id.localeCompare(b.doc_id);
    if (d !== 0) return d;
    return stableLocatorKey(a.locator).localeCompare(stableLocatorKey(b.locator));
  });

  return deduped.length ? (deduped as any) : undefined;
}

function normalizeV1Citations(
  items: Array<{ doc_id: string; quote?: string; confidence: number }>,
  defaultSource: NormalizeOptions["defaultCitationSource"]
): Array<z.infer<typeof CitationSchema>> {
  const shaped: any[] = items.map((c) => ({
    doc_id: String(c.doc_id ?? ""),
    confidence: clamp01(Number(c.confidence ?? 0)),
    quote: typeof c.quote === "string" ? trunc(c.quote, 500) : undefined,
    source: inferCitationSource(String(c.doc_id ?? ""), defaultSource),
  }));
  return (normalizeCitations(shaped, defaultSource) ?? []) as any;
}

function normalizeToolCalls(
  items: unknown[],
  opts: { maxStdoutChars: number; maxStderrChars: number; redactSecrets: boolean }
): Array<z.infer<typeof ToolCallSchema>> {
  const out: Array<z.infer<typeof ToolCallSchema>> = [];

  for (const it of items) {
    if (typeof it !== "object" || it === null) continue;
    const o = it as Record<string, unknown>;

    const tool_id = typeof o.tool_id === "string" ? o.tool_id : "";
    if (!tool_id) continue;

    const status =
      typeof o.status === "string" && ["ok", "error", "skipped"].includes(o.status)
        ? (o.status as any)
        : "error";

    const duration_ms = typeof o.duration_ms === "number" && Number.isFinite(o.duration_ms) && o.duration_ms >= 0
      ? Math.floor(o.duration_ms)
      : undefined;

    const args_redacted =
      typeof o.args_redacted === "object" && o.args_redacted !== null
        ? sanitizeArgsRedacted(o.args_redacted as Record<string, unknown>)
        : undefined;

    const stdoutRaw = typeof o.stdout_trunc === "string" ? o.stdout_trunc : "";
    const stderrRaw = typeof o.stderr_trunc === "string" ? o.stderr_trunc : "";

    const stdout = opts.redactSecrets ? redactSensitive(stdoutRaw) : stdoutRaw;
    const stderr = opts.redactSecrets ? redactSensitive(stderrRaw) : stderrRaw;

    const stdout_trunc = stdout ? trunc(stdout, opts.maxStdoutChars) : undefined;
    const stderr_trunc = stderr ? trunc(stderr, opts.maxStderrChars) : undefined;

    const exit_code = typeof o.exit_code === "number" && Number.isFinite(o.exit_code) ? Math.trunc(o.exit_code) : undefined;

    const artifacts =
      Array.isArray(o.artifacts)
        ? o.artifacts
            .map((a) => ToolArtifactSchema.safeParse(a))
            .filter((r): r is { success: true; data: any } => r.success)
            .map((r) => r.data)
            .slice(0, 20)
        : undefined;

    let error =
      typeof o.error === "object" && o.error !== null
        ? ToolCallSchema.shape.error.safeParse(o.error).success
          ? ToolCallSchema.shape.error.parse(o.error)
          : undefined
        : undefined;

    // If status=error, ensure error object exists deterministically
    if (status === "error" && !error) {
      error = {
        code: "TOOL_ERROR",
        message: stderr_trunc ? trunc(stderr_trunc, 2000) : "Tool reported error",
      };
    }

    out.push({
      tool_id,
      status,
      ...(duration_ms !== undefined ? { duration_ms } : {}),
      ...(args_redacted ? { args_redacted } : {}),
      ...(stdout_trunc ? { stdout_trunc } : {}),
      ...(stderr_trunc ? { stderr_trunc } : {}),
      ...(exit_code !== undefined ? { exit_code } : {}),
      ...(artifacts && artifacts.length ? { artifacts } : {}),
      ...(error ? { error } : {}),
    });
  }

  // Stable order: tool_id then status then duration
  out.sort((a, b) => {
    const t = a.tool_id.localeCompare(b.tool_id);
    if (t !== 0) return t;
    const s = a.status.localeCompare(b.status);
    if (s !== 0) return s;
    const da = a.duration_ms ?? 0;
    const db = b.duration_ms ?? 0;
    return da - db;
  });

  return out;
}

function sanitizeArgsRedacted(obj: Record<string, unknown>): Record<string, string | number | boolean | string[]> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string") out[k] = trunc(v, 500);
    else if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (typeof v === "boolean") out[k] = v;
    else if (Array.isArray(v)) {
      out[k] = v
        .filter((x) => typeof x === "string")
        .map((x) => trunc(x, 200))
        .slice(0, 50);
    }
    // ignore unsupported types
  }
  return out;
}

function normalizeClarify(clarify: unknown, fallbackQuestion: string): z.infer<typeof ClarifySchema> {
  if (typeof clarify === "object" && clarify !== null) {
    const parsed = ClarifySchema.safeParse(clarify);
    if (parsed.success) return parsed.data;

    // try to salvage partial fields deterministically
    const o = clarify as Record<string, unknown>;
    const question = typeof o.question === "string" ? trunc(o.question, 2000) : trunc(fallbackQuestion, 2000);
    const choices =
      Array.isArray(o.choices)
        ? o.choices.filter((x) => typeof x === "string").map((x) => trunc(x, 200)).slice(0, 20)
        : undefined;

    return ClarifySchema.parse({ question, ...(choices ? { choices } : {}) });
  }

  return ClarifySchema.parse({ question: trunc(fallbackQuestion, 2000) });
}

/* ============================================================================
 * Example usage (keep in tests, remove in prod)
 * ========================================================================== */

// const normalized = normalizeNucleusResponse({
//   version: "nucleus.response.v1",
//   query_id: "q_12345678",
//   timestamp_utc: "2026-02-21T12:00:00Z",
//   intent: "retrieve",
//   answer_text: "Here is the answer.",
//   citations: [{ doc_id: "doc_1", confidence: 0.8, quote: "evidence" }],
// });
// console.log(normalized);
