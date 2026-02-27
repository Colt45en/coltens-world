import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { buildCanonicalSortKey, governMultiParagraph, governText } from "@world-engine/world-editor-shared";
import { useMemo, useState } from "react";

type AiMode = "continue" | "rewrite" | "summarize" | "expand";

export interface WorldRichEditorValue {
  html: string;
  text: string;
  governed_text: string;
  sort_key: string;
  tie_break: string;
}

export function WorldRichEditor(props: {
  docId: string;
  initialHtml?: string;
  title?: string;
  onChange?: (v: WorldRichEditorValue) => void;
  aiEndpoint?: string; // default "http://localhost:5174/api/ai/write"
}) {
  const [title, setTitle] = useState(props.title ?? "Untitled");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiMode, setAiMode] = useState<AiMode>("continue");
  const [busy, setBusy] = useState(false);
  const aiEndpoint = props.aiEndpoint ?? "http://localhost:5174/api/ai/write";

  const editor = useEditor({
    extensions: [StarterKit],
    content: props.initialHtml ?? "<p>Write here…</p>",
    editorProps: {
      attributes: {
        style:
          "min-height: 280px; padding: 12px; outline: none; border: 1px solid #333; border-radius: 12px; line-height: 1.5;"
      },
      handlePaste(view, event) {
        // Auto-govern pasted plain text to keep the document clean.
        const text = event.clipboardData?.getData("text/plain");
        if (text && text.trim()) {
          event.preventDefault();
          const governed = governMultiParagraph(text);
          view.dispatch(view.state.tr.insertText(governed));
          return true;
        }
        return false;
      }
    },
    onUpdate({ editor }) {
      emit(editor);
    }
  });

  const toolbar = useMemo(() => {
    if (!editor) return null;

    const btn = (label: string, onClick: () => void, active?: boolean) => (
      <button
        type="button"
        onClick={onClick}
        style={{
          padding: "6px 10px",
          borderRadius: 10,
          border: "1px solid #333",
          background: active ? "#222" : "transparent",
          color: "#fff",
          cursor: "pointer"
        }}
      >
        {label}
      </button>
    );

    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        {btn("B", () => editor.chain().focus().toggleBold().run(), editor.isActive("bold"))}
        {btn("I", () => editor.chain().focus().toggleItalic().run(), editor.isActive("italic"))}
        {btn("H1", () => editor.chain().focus().toggleHeading({ level: 1 }).run(), editor.isActive("heading", { level: 1 }))}
        {btn("• List", () => editor.chain().focus().toggleBulletList().run(), editor.isActive("bulletList"))}
        {btn("1. List", () => editor.chain().focus().toggleOrderedList().run(), editor.isActive("orderedList"))}
        {btn("Quote", () => editor.chain().focus().toggleBlockquote().run(), editor.isActive("blockquote"))}
        {btn("Code", () => editor.chain().focus().toggleCodeBlock().run(), editor.isActive("codeBlock"))}

        <div style={{ width: 12 }} />

        {btn("Govern Selection", () => governSelection(editor))}
        {btn("Govern Document (safe)", () => governDocumentSafe(editor))}
      </div>
    );
  }, [editor]);

  function emit(ed: any) {
    const html = ed.getHTML();
    const text = ed.getText();

    // A governed plain-text view of the document (useful for indexing/search/export)
    const governed_text = governMultiParagraph(text);

    const { key: sort_key, tie: tie_break } = buildCanonicalSortKey(
      [title, governed_text.slice(0, 256)],
      props.docId
    );

    props.onChange?.({ html, text, governed_text, sort_key, tie_break });
  }

  async function runAiInsert() {
    if (!editor) return;
    const prompt = aiPrompt.trim();
    if (!prompt) return;

    setBusy(true);
    try {
      const selectionText = editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, "\n");
      const context = selectionText.trim().length ? selectionText : editor.getText();

      const res = await fetch(aiEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt, context, mode: aiMode })
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || `AI request failed: ${res.status}`);
      }

      const data = (await res.json()) as { text: string };

      // Always govern AI output before inserting.
      const governed = governMultiParagraph(data.text);

      if (editor.state.selection.empty) {
        editor.chain().focus().insertContent(governed).run();
      } else {
        // Replace selection with governed text (marks inside selection will be replaced).
        editor.chain().focus().insertContentAt(editor.state.selection, governed).run();
      }

      setAiPrompt("");
    } finally {
      setBusy(false);
    }
  }

  if (!editor) return null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16 }}>
      <div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
          <label style={{ color: "#bbb", fontSize: 12 }}>Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{
              flex: 1,
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid #333",
              background: "transparent",
              color: "#fff"
            }}
          />
        </div>

        {toolbar}
        <EditorContent editor={editor} />
        <div style={{ marginTop: 10, color: "#888", fontSize: 12 }}>
          Paste is auto-governed. "Govern Document (safe)" only normalizes blocks that have no inline marks (so it won't destroy styling).
        </div>
      </div>

      <div style={{ border: "1px solid #333", borderRadius: 12, padding: 12 }}>
        <div style={{ color: "#bbb", fontSize: 12, marginBottom: 8 }}>AI Writing Panel</div>

        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <select
            value={aiMode}
            onChange={(e) => setAiMode(e.target.value as AiMode)}
            style={{
              flex: 1,
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid #333",
              background: "transparent",
              color: "#fff"
            }}
          >
            <option value="continue">Continue</option>
            <option value="rewrite">Rewrite selection/doc</option>
            <option value="summarize">Summarize</option>
            <option value="expand">Expand</option>
          </select>
        </div>

        <textarea
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          placeholder="Tell the AI what to write…"
          style={{
            width: "100%",
            minHeight: 140,
            resize: "vertical",
            padding: 10,
            borderRadius: 10,
            border: "1px solid #333",
            background: "transparent",
            color: "#fff"
          }}
        />

        <button
          type="button"
          disabled={busy}
          onClick={runAiInsert}
          style={{
            width: "100%",
            marginTop: 10,
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #333",
            background: busy ? "#111" : "#222",
            color: "#fff",
            cursor: busy ? "not-allowed" : "pointer"
          }}
        >
          {busy ? "Writing…" : "Insert AI Draft (Governed)"}
        </button>

        <div style={{ marginTop: 10, color: "#777", fontSize: 12 }}>
          Selection-aware: if you highlight text, AI will use it as context. Otherwise it uses the whole document text.
        </div>
      </div>
    </div>
  );
}

function governSelection(editor: any) {
  const { from, to } = editor.state.selection;
  const selected = editor.state.doc.textBetween(from, to, "\n");
  const governed = governMultiParagraph(selected);

  editor.chain().focus().insertContentAt({ from, to }, governed).run();
}

/**
 * Safe document governance:
 * - Walk blocks; only replace blocks that have a single text node with no marks.
 * - Prevents destroying bold/italic spans.
 */
function governDocumentSafe(editor: any) {
  const tr = editor.state.tr;
  const doc = editor.state.doc;

  const replacements: { from: number; to: number; text: string }[] = [];

  doc.descendants((node: any, pos: number) => {
    // Only paragraphs/headings/blockquote paragraphs etc.
    const isTextBlock = node.isTextblock && (node.type.name === "paragraph" || node.type.name === "heading" || node.type.name === "blockquote");
    if (!isTextBlock) return true;

    // If it has any marks inside, skip (safe mode)
    let hasMarks = false;
    node.descendants((child: any) => {
      if (child.isText && child.marks && child.marks.length > 0) hasMarks = true;
      return true;
    });
    if (hasMarks) return true;

    const text = node.textContent ?? "";
    const governed = governText(text);

    if (governed !== text.trim() && text.trim().length > 0) {
      // Replace the whole content of the block (inside node)
      const from = pos + 1;
      const to = pos + node.nodeSize - 1;
      replacements.push({ from, to, text: governed });
    }

    return true;
  });

  // Apply from bottom to top so positions remain valid
  replacements.sort((a, b) => b.from - a.from);
  for (const r of replacements) tr.insertText(r.text, r.from, r.to);

  editor.view.dispatch(tr);
}
