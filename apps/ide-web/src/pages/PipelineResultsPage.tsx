import React, { useEffect, useMemo, useState } from "react";

type IndexRow = { name: string; exists: boolean; size: number; mtimeMs: number };
type IndexResp = { rootDir: string; index: IndexRow[] };

function prettyBytes(n: number) {
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

function fmtTime(ms: number) {
  if (!ms) return "";
  const d = new Date(ms);
  return d.toLocaleString();
}

async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return (await r.json()) as T;
}

async function fetchText(url: string): Promise<string> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return await r.text();
}

const DEFAULT_TABS = [
  { key: "evidence_packet.json", label: "📊 Evidence" },
  { key: "decision_record.json", label: "✅ Decision" },
  { key: "validated_plan.json", label: "🎯 Plan" },
] as const;

export default function PipelineResultsPage() {
  const [index, setIndex] = useState<IndexResp | null>(null);
  const [tab, setTab] = useState<string>(DEFAULT_TABS[0]!.key);
  const [content, setContent] = useState<any>(null);
  const [raw, setRaw] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const available = useMemo(() => {
    const map = new Map<string, IndexRow>();
    for (const row of index?.index ?? []) map.set(row.name, row);
    return map;
  }, [index]);

  // Load index on mount
  useEffect(() => {
    let alive = true;
    setError("");
    setLoading(true);

    fetchJson<IndexResp>("/api/pipeline/results/index")
      .then((d) => {
        if (!alive) return;
        setIndex(d);
        // Pick first existing tab
        for (const t of DEFAULT_TABS) {
          if (d.index.some((x) => x.name === t.key && x.exists)) {
            setTab(t.key);
            break;
          }
        }
      })
      .catch((e) => alive && setError(String(e)))
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, []);

  // Load file content when tab changes
  useEffect(() => {
    let alive = true;
    setError("");
    setContent(null);
    setRaw("");

    const row = available.get(tab);
    if (!row?.exists) return;

    (async () => {
      try {
        const t = await fetchText(
          `/api/pipeline/results/file/${encodeURIComponent(tab)}`
        );
        if (!alive) return;
        setRaw(t);
        if (tab.endsWith(".log")) {
          setContent(null);
        } else {
          setContent(JSON.parse(t));
        }
      } catch (e) {
        if (!alive) return;
        setError(String(e));
      }
    })();

    return () => {
      alive = false;
    };
  }, [tab, available]);

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        width: "100%",
        background: "#1e1e1e",
        color: "#e0e0e0",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Sidebar */}
      <aside
        style={{
          width: 300,
          borderRight: "1px solid rgba(255,255,255,0.12)",
          padding: 16,
          overflowY: "auto",
          background: "#252525",
        }}
      >
        <div
          style={{
            fontWeight: 700,
            marginBottom: 12,
            fontSize: 14,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          📋 Pipeline Results
        </div>

        {error ? (
          <div style={{ color: "#ff6b6b", whiteSpace: "pre-wrap", fontSize: 12 }}>
            ❌ {error}
          </div>
        ) : null}

        {loading ? (
          <div style={{ opacity: 0.6, fontSize: 12 }}>Loading…</div>
        ) : (
          <>
            <div
              style={{
                opacity: 0.7,
                fontSize: 11,
                marginBottom: 12,
                fontFamily: "monospace",
              }}
            >
              Root: {index?.rootDir ? index.rootDir.split(/[/\\]/).pop() : "…"}
            </div>

            {/* Quick tabs */}
            <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
              {DEFAULT_TABS.map((t) => {
                const ok = available.get(t.key)?.exists;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    disabled={!ok}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 6,
                      border: "1px solid rgba(255,255,255,0.18)",
                      background:
                        tab === t.key ? "rgba(88,166,255,0.2)" : "transparent",
                      color:
                        tab === t.key
                          ? "#58a6ff"
                          : ok
                            ? "#e0e0e0"
                            : "#666",
                      opacity: ok ? 1 : 0.4,
                      cursor: ok ? "pointer" : "not-allowed",
                      fontSize: 12,
                      fontWeight: tab === t.key ? 600 : 400,
                      transition: "all 150ms",
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* All files list */}
            <div
              style={{
                fontWeight: 600,
                marginBottom: 8,
                opacity: 0.85,
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: 0.3,
              }}
            >
              All Files
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {(index?.index ?? []).map((row) => (
                <button
                  key={row.name}
                  onClick={() => setTab(row.name)}
                  disabled={!row.exists}
                  style={{
                    textAlign: "left",
                    padding: "8px 10px",
                    borderRadius: 6,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background:
                      tab === row.name
                        ? "rgba(88,166,255,0.15)"
                        : "rgba(0,0,0,0.2)",
                    color: tab === row.name ? "#58a6ff" : "#e0e0e0",
                    opacity: row.exists ? 1 : 0.25,
                    cursor: row.exists ? "pointer" : "not-allowed",
                    fontSize: 11,
                    transition: "all 150ms",
                  }}
                >
                  <div style={{ fontFamily: "monospace" }}>{row.name}</div>
                  {row.exists && (
                    <div
                      style={{
                        fontSize: 10,
                        opacity: 0.6,
                        marginTop: 2,
                        display: "flex",
                        gap: 8,
                      }}
                    >
                      <span>{prettyBytes(row.size)}</span>
                      <span>{fmtTime(row.mtimeMs)}</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </aside>

      {/* Main content */}
      <main
        style={{
          flex: 1,
          padding: 20,
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 16,
            paddingBottom: 12,
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <div
            style={{
              fontWeight: 700,
              fontFamily: "monospace",
              fontSize: 14,
            }}
          >
            {tab}
          </div>
          <div style={{ fontSize: 12, opacity: 0.6 }}>
            {available.get(tab)?.exists ? "✅ loaded" : "❌ missing"}
          </div>
        </div>

        {error ? (
          <div style={{ color: "#ff6b6b", whiteSpace: "pre-wrap", fontSize: 12 }}>
            ❌ Error: {error}
          </div>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            flex: 1,
          }}
        >
          {/* Pretty-printed JSON/text */}
          <section
            style={{
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              padding: 12,
              overflow: "auto",
              background: "rgba(0,0,0,0.3)",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 12 }}>
              📄 Formatted
            </div>
            <pre
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontSize: 11,
                fontFamily: "monospace",
                color: "#d4d4d4",
              }}
            >
              {content ? JSON.stringify(content, null, 2) : raw ? raw : "…"}
            </pre>
          </section>

          {/* Raw */}
          <section
            style={{
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              padding: 12,
              overflow: "auto",
              background: "rgba(0,0,0,0.3)",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 12 }}>
              📋 Raw
            </div>
            <pre
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontSize: 11,
                fontFamily: "monospace",
                opacity: 0.85,
                color: "#b4b4b4",
              }}
            >
              {raw || "…"}
            </pre>
          </section>
        </div>
      </main>
    </div>
  );
}
