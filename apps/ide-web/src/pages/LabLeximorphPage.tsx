import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  leximorphClient,
  type LeximorphAnalyzeInput,
  type LeximorphIngestConfig,
  type LeximorphReviewAction,
} from "../bus/leximorphClient";
import { GlassPanel, NeonButton, NeonTitle } from "../ui/neon";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonRecord;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function pretty(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function pickId(row: unknown): number | null {
  const rec = asRecord(row);
  if (!rec) return null;
  const id = rec.id;
  return typeof id === "number" ? id : null;
}

function TextField(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, className, ...rest } = props;
  return (
    <label className="flex flex-col gap-1 text-xs text-white/80">
      <span className="font-mono uppercase tracking-wider text-white/60">{label}</span>
      <input
        {...rest}
        className={`rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300 ${className ?? ""}`}
      />
    </label>
  );
}

function SelectField(
  props: React.SelectHTMLAttributes<HTMLSelectElement> & {
    label: string;
    children: React.ReactNode;
  },
) {
  const { label, className, children, ...rest } = props;
  return (
    <label className="flex flex-col gap-1 text-xs text-white/80">
      <span className="font-mono uppercase tracking-wider text-white/60">{label}</span>
      <select
        {...rest}
        className={`rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300 ${className ?? ""}`}
      >
        {children}
      </select>
    </label>
  );
}

export function LabLeximorphPage() {
  const navigate = useNavigate();

  const [analyzeText, setAnalyzeText] = useState("unbelievable");
  const [language, setLanguage] = useState("english");
  const [kind, setKind] = useState("word");
  const [searchQuery, setSearchQuery] = useState("user");
  const [searchLanguage, setSearchLanguage] = useState("");
  const [searchKind, setSearchKind] = useState("");
  const [ingestRoot, setIngestRoot] = useState(".");
  const [ingestDryRun, setIngestDryRun] = useState(true);

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [analyzeResult, setAnalyzeResult] = useState<JsonRecord | null>(null);
  const [searchResult, setSearchResult] = useState<JsonRecord | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<JsonRecord | null>(null);
  const [reviewQueue, setReviewQueue] = useState<JsonRecord | null>(null);
  const [ingestResult, setIngestResult] = useState<JsonRecord | null>(null);
  const [lastRunDetail, setLastRunDetail] = useState<JsonRecord | null>(null);

  const searchItems = useMemo(() => {
    if (!searchResult) return [];
    const rows = asArray(searchResult.results ?? searchResult.items ?? searchResult.entries);
    return rows.map((row, index) => ({
      key: `${pickId(row) ?? "row"}-${index}`,
      row,
      id: pickId(row),
      entry: asRecord(row)?.entry ?? asRecord(row)?.text ?? "(unknown)",
      language: asRecord(row)?.language,
      kind: asRecord(row)?.kind,
      status: asRecord(row)?.status,
      confidence: asRecord(row)?.confidence,
    }));
  }, [searchResult]);

  const reviewItems = useMemo(() => {
    if (!reviewQueue) return [];
    return asArray(reviewQueue.items ?? reviewQueue.results ?? reviewQueue.entries);
  }, [reviewQueue]);

  async function run<T>(label: string, fn: () => Promise<T>, onOk: (value: T) => void) {
    setBusy(label);
    setError(null);
    try {
      const value = await fn();
      onOk(value);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy((current) => (current === label ? null : current));
    }
  }

  async function handleAnalyze() {
    const payload: LeximorphAnalyzeInput = {
      text: analyzeText,
      ...(language && { language }),
      ...(kind && { kind }),
      store: true,
      source_type: "ide",
    };
    await run("analyze", () => leximorphClient.analyze(payload), (result) => {
      const rec = asRecord(result) ?? {};
      setAnalyzeResult(rec);
      const id = typeof rec.id === "number" ? rec.id : null;
      if (id !== null) {
        void handleLoadEntry(id);
      }
    });
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    await run(
      "search",
      () =>
        leximorphClient.search({
          q: searchQuery.trim(),
          ...(searchLanguage && { language: searchLanguage }),
          ...(searchKind && { kind: searchKind }),
          include_parts: true,
          include_provenance: false,
          limit: 25,
        }),
      (result) => setSearchResult(asRecord(result) ?? {}),
    );
  }

  async function handleLoadEntry(id: number) {
    await run("entry", () => leximorphClient.getEntry(id), (result) => setSelectedEntry(asRecord(result) ?? {}));
  }

  async function handleLoadReviewQueue() {
    await run(
      "review-queue",
      () => leximorphClient.getReviewQueue({ limit: 20, status: "needs_review" }),
      (result) => setReviewQueue(asRecord(result) ?? {}),
    );
  }

  async function handleReviewAction(id: number, action: LeximorphReviewAction["action"]) {
    const payload: LeximorphReviewAction = { action, actor: "ide-user" };
    await run(`review-${action}`, () => leximorphClient.reviewEntry(id, payload), () => {
      void handleLoadReviewQueue();
      void handleLoadEntry(id);
    });
  }

  async function handleStartIngest() {
    const payload: LeximorphIngestConfig = {
      root_path: ingestRoot,
      dry_run: ingestDryRun,
      store: !ingestDryRun,
      extract_words: true,
      extract_identifiers: true,
      extract_html: true,
      record_provenance: true,
      max_files: 200,
      max_file_bytes: 262_144,
      requested_by: "ide",
    };
    await run("ingest", () => leximorphClient.startIngest(payload), (result) => {
      const rec = asRecord(result) ?? {};
      setIngestResult(rec);
      const runId = typeof rec.run_id === "string" ? rec.run_id : null;
      if (runId) {
        void handleLoadIngestRun(runId);
      }
    });
  }

  async function handleLoadIngestRun(runId: string) {
    await run("ingest-run", () => leximorphClient.getIngestRun(runId), (result) => setLastRunDetail(asRecord(result) ?? {}));
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <GlassPanel className="rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-[280px] flex-1">
            <NeonTitle as="h2" className="text-2xl">
              Leximorph v2 Lab
            </NeonTitle>
            <p className="text-white/60 mt-2">
              IDE-facing search/analyze/review and bounded batch ingest via Nucleus <code>/leximorph/*</code>.
            </p>
          </div>
          <div className="flex gap-2">
            <NeonButton variant="ghost" onClick={() => void handleLoadReviewQueue()} disabled={busy !== null}>
              Refresh Queue
            </NeonButton>
            <NeonButton variant="ghost" onClick={() => navigate("/")}>
              Back
            </NeonButton>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 font-mono text-xs">
          <span className="px-2 py-1 rounded-full border border-white/10 bg-white/5 text-white/70">
            Busy: {busy ?? "idle"}
          </span>
          {error ? (
            <span className="px-2 py-1 rounded-full border border-red-400/30 bg-red-500/10 text-red-200">
              {error}
            </span>
          ) : null}
        </div>
      </GlassPanel>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <GlassPanel className="rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-scifi tracking-widest text-sm text-cyan-300">Analyze</h3>
            <NeonButton onClick={() => void handleAnalyze()} disabled={busy !== null || !analyzeText.trim()}>
              Run Analyze
            </NeonButton>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <SelectField label="Language" value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="english">english</option>
              <option value="javascript">javascript</option>
              <option value="typescript">typescript</option>
              <option value="html">html</option>
            </SelectField>
            <SelectField label="Kind" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="word">word</option>
              <option value="identifier">identifier</option>
              <option value="html">html</option>
            </SelectField>
            <TextField
              label="Examples"
              readOnly
              value={kind === "identifier" ? "getUserName" : kind === "html" ? "<div class=\"user-card\">" : "unbelievable"}
            />
          </div>
          <label className="block text-xs text-white/80">
            <span className="font-mono uppercase tracking-wider text-white/60">Input</span>
            <textarea
              value={analyzeText}
              onChange={(e) => setAnalyzeText(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
              spellCheck={false}
            />
          </label>
          <pre className="rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-white/75 overflow-auto max-h-[280px]">
            {pretty(analyzeResult ?? { note: "Analyze a word, identifier, or HTML snippet." })}
          </pre>
        </GlassPanel>

        <GlassPanel className="rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-scifi tracking-widest text-sm text-cyan-300">Search</h3>
            <NeonButton onClick={() => void handleSearch()} disabled={busy !== null || !searchQuery.trim()}>
              Search
            </NeonButton>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <TextField label="Query" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            <TextField label="Language Filter" value={searchLanguage} onChange={(e) => setSearchLanguage(e.target.value)} placeholder="optional" />
            <TextField label="Kind Filter" value={searchKind} onChange={(e) => setSearchKind(e.target.value)} placeholder="optional" />
          </div>
          <div className="grid grid-cols-1 gap-2 max-h-[280px] overflow-auto pr-1">
            {searchItems.length === 0 ? (
              <div className="text-sm text-white/50 border border-white/10 rounded-xl p-3 bg-black/20">
                No search results loaded yet.
              </div>
            ) : (
              searchItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => (item.id !== null ? void handleLoadEntry(item.id) : undefined)}
                  className="text-left rounded-xl border border-white/10 bg-black/20 hover:border-cyan-300/40 hover:bg-black/30 p-3 transition-colors"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm text-cyan-200">{String(item.entry)}</span>
                    {item.id !== null ? <span className="text-[10px] text-white/50">#{item.id}</span> : null}
                    {item.language ? <span className="text-[10px] text-white/50">{String(item.language)}</span> : null}
                    {item.kind ? <span className="text-[10px] text-white/50">{String(item.kind)}</span> : null}
                    {item.status ? <span className="text-[10px] text-white/50">{String(item.status)}</span> : null}
                    {typeof item.confidence === "number" ? (
                      <span className="text-[10px] text-white/50">conf {item.confidence.toFixed(2)}</span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-xs text-white/55 truncate">
                    {pretty(item.row).replace(/\s+/g, " ").slice(0, 220)}
                  </div>
                </button>
              ))
            )}
          </div>
          <pre className="rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-white/75 overflow-auto max-h-[160px]">
            {pretty(searchResult ?? { note: "Search results JSON" })}
          </pre>
        </GlassPanel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <GlassPanel className="rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-scifi tracking-widest text-sm text-cyan-300">Entry Detail</h3>
            <div className="flex gap-2">
              {(() => {
                const entryId = typeof selectedEntry?.id === "number" ? selectedEntry.id : null;
                if (entryId === null) return null;
                return (
                  <>
                    <NeonButton
                      variant="ghost"
                      onClick={() => void handleReviewAction(entryId, "approve")}
                      disabled={busy !== null}
                    >
                      Approve
                    </NeonButton>
                    <NeonButton
                      variant="ghost"
                      onClick={() => void handleReviewAction(entryId, "reject")}
                      disabled={busy !== null}
                    >
                      Reject
                    </NeonButton>
                  </>
                );
              })()}
            </div>
          </div>
          <pre className="rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-white/75 overflow-auto min-h-[220px] max-h-[420px]">
            {pretty(selectedEntry ?? { note: "Select a search result or analyze an entry to load detail." })}
          </pre>
        </GlassPanel>

        <GlassPanel className="rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-scifi tracking-widest text-sm text-cyan-300">Review Queue</h3>
            <NeonButton variant="ghost" onClick={() => void handleLoadReviewQueue()} disabled={busy !== null}>
              Load Queue
            </NeonButton>
          </div>
          <div className="space-y-2 max-h-[220px] overflow-auto pr-1">
            {reviewItems.length === 0 ? (
              <div className="text-sm text-white/50 border border-white/10 rounded-xl p-3 bg-black/20">
                No queued entries loaded.
              </div>
            ) : (
              reviewItems.map((row, index) => {
                const rec = asRecord(row);
                const id = pickId(row);
                return (
                  <div key={`${id ?? "review"}-${index}`} className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm text-cyan-200">{String(rec?.entry ?? "(entry)")}</span>
                      {id !== null ? <span className="text-[10px] text-white/50">#{id}</span> : null}
                      {typeof rec?.confidence === "number" ? (
                        <span className="text-[10px] text-white/50">conf {(rec.confidence as number).toFixed(2)}</span>
                      ) : null}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => (id !== null ? void handleLoadEntry(id) : undefined)}
                        className="px-2 py-1 rounded border border-white/15 text-xs text-white/80 hover:border-cyan-300/40"
                      >
                        Inspect
                      </button>
                      <button
                        type="button"
                        onClick={() => (id !== null ? void handleReviewAction(id, "approve") : undefined)}
                        className="px-2 py-1 rounded border border-green-400/25 text-xs text-green-200 hover:bg-green-500/10"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => (id !== null ? void handleReviewAction(id, "reject") : undefined)}
                        className="px-2 py-1 rounded border border-red-400/25 text-xs text-red-200 hover:bg-red-500/10"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <pre className="rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-white/75 overflow-auto max-h-[180px]">
            {pretty(reviewQueue ?? { note: "Review queue JSON" })}
          </pre>
        </GlassPanel>
      </div>

      <GlassPanel className="rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-scifi tracking-widest text-sm text-cyan-300">Batch Ingest (Bounded)</h3>
          <NeonButton onClick={() => void handleStartIngest()} disabled={busy !== null || !ingestRoot.trim()}>
            {ingestDryRun ? "Dry Run" : "Start Ingest"}
          </NeonButton>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <TextField label="Root Path" value={ingestRoot} onChange={(e) => setIngestRoot(e.target.value)} />
          <SelectField label="Mode" value={ingestDryRun ? "dry" : "store"} onChange={(e) => setIngestDryRun(e.target.value === "dry")}>
            <option value="dry">dry-run</option>
            <option value="store">store</option>
          </SelectField>
          <TextField
            label="Limits"
            readOnly
            value="200 files / 256KB each"
            title="Phase-1 bounded ingest defaults from the client"
          />
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <pre className="rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-white/75 overflow-auto min-h-[160px]">
            {pretty(ingestResult ?? { note: "Ingest request result" })}
          </pre>
          <pre className="rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-white/75 overflow-auto min-h-[160px]">
            {pretty(lastRunDetail ?? { note: "Latest ingest run detail" })}
          </pre>
        </div>
      </GlassPanel>
    </div>
  );
}
