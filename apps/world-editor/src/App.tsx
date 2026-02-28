import { useMemo, useState } from "react";
import { WorldRichEditor, WorldRichEditorValue } from "./editor/WorldRichEditor";
import "./App.css";

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
    <div className="app-container">
      <div className="app-header">
        <div>
          <h2 className="app-title">World Engine Editor</h2>
          <div className="app-subtitle">
            UI: http://localhost:5173 • Server: http://localhost:5174
          </div>
        </div>

        <div className="app-controls">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Document title"
            className="app-input"
          />
          <button
            type="button"
            disabled={saving || !value}
            onClick={saveArtifact}
            className="app-button"
          >
            {saving ? "Saving…" : "Save Artifact + Ledger"}
          </button>
        </div>
      </div>

      <div className="app-editor-section">
        <WorldRichEditor
          docId={docId}
          title={title}
          aiEndpoint={`${serverBase}/api/ai/write`}
          onChange={(v) => setValue(v)}
        />
      </div>

      {err && (
        <div className="app-error">
          <b>Error:</b> {err}
        </div>
      )}

      {saved && (
        <div className="app-output-panel">
          <div className="app-output-label">Last Saved Artifact</div>
          <pre className="app-output-content">
{JSON.stringify(saved, null, 2)}
          </pre>
        </div>
      )}

      <div className="app-output-panel">
        <div className="app-output-label">Deterministic Live Output</div>
        <pre className="app-output-content">
{value ? JSON.stringify(value, null, 2) : "Start typing…"}
        </pre>
      </div>
    </div>
  );
}
