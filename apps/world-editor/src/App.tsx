import { useMemo, useState } from "react";
import { WorldRichEditor, WorldRichEditorValue } from "./editor/WorldRichEditor";

type SaveResult = {
  artifact_id: string;
  ledger_seq: number;
  ledger_entry_hash: string;
  created_at_utc: string;
  artifact_dir: string;
  sort_key: string;
  tie_break: string;
  html_sha256: string;
  text_sha256: string;
  manifest_sha256: string;
};

export default function App() {
  const [value, setValue] = useState<WorldRichEditorValue | null>(null);
  const [title, setTitle] = useState("Untitled");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<SaveResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const docId = "doc_demo_001";
  const serverBase = useMemo(() => "http://localhost:5174", []);

  async function saveArtifact() {
    if (!value) return;
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`${serverBase}/api/artifacts/save`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          docId,
          title,
          html: value.html,
          text: value.text
        })
      });
      if (!res.ok) throw new Error(await res.text());
      const out = (await res.json()) as SaveResult;
      setSaved(out);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ background: "#0b0b0b", minHeight: "100vh", color: "#fff", padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>World Engine Editor</h2>
          <div style={{ color: "#888", fontSize: 12 }}>
            UI: http://localhost:5173 • Server: http://localhost:5174
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{
              width: 280,
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid #333",
              background: "transparent",
              color: "#fff"
            }}
          />
          <button
            type="button"
            disabled={saving || !value}
            onClick={saveArtifact}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #333",
              background: saving ? "#111" : "#222",
              color: "#fff",
              cursor: saving ? "not-allowed" : "pointer"
            }}
          >
            {saving ? "Saving…" : "Save Artifact + Ledger"}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <WorldRichEditor
          docId={docId}
          title={title}
          aiEndpoint={`${serverBase}/api/ai/write`}
          onChange={(v) => setValue(v)}
        />
      </div>

      {err && (
        <div style={{ marginTop: 14, border: "1px solid #633", borderRadius: 12, padding: 12, color: "#fbb" }}>
          <b>Error:</b> {err}
        </div>
      )}

      {saved && (
        <div style={{ marginTop: 14, border: "1px solid #333", borderRadius: 12, padding: 12 }}>
          <div style={{ color: "#bbb", fontSize: 12, marginBottom: 8 }}>Last Saved Artifact</div>
          <pre style={{ whiteSpace: "pre-wrap", margin: 0, color: "#ddd", fontSize: 12 }}>
{JSON.stringify(saved, null, 2)}
          </pre>
        </div>
      )}

      <div style={{ marginTop: 14, border: "1px solid #333", borderRadius: 12, padding: 12 }}>
        <div style={{ color: "#bbb", fontSize: 12, marginBottom: 8 }}>Deterministic Live Output</div>
        <pre style={{ whiteSpace: "pre-wrap", margin: 0, color: "#ddd", fontSize: 12 }}>
{value ? JSON.stringify(value, null, 2) : "Start typing…"}
        </pre>
      </div>
    </div>
  );
}
