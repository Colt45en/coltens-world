import { deterministicWrite, governMultiParagraph } from "@world-engine/world-editor-shared";
import cors from "cors";
import express from "express";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

/**
 * AI Writing Endpoint
 * POST /api/ai/write
 *
 * Body:
 *   - prompt: string (what to write)
 *   - context?: string (selected/doc text for context)
 *   - mode?: 'continue' | 'rewrite' | 'summarize' | 'expand'
 *
 * Response:
 *   - text: string (governed AI output)
 */
app.post("/api/ai/write", (req, res) => {
  try {
    const prompt = String(req.body?.prompt ?? "").trim();
    const context = String(req.body?.context ?? "").trim();
    const mode = String(req.body?.mode ?? "continue") as any;

    if (!prompt) {
      return res.status(400).json({ error: "prompt is required" });
    }

    // Generate AI text using deterministic writer
    const text = deterministicWrite({ prompt, context, mode });

    // Server-side governance pass (extra safety + consistent invariants)
    const governed = governMultiParagraph(text);

    return res.json({ text: governed });
  } catch (err) {
    console.error("AI write error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

const port = 5174;
app.listen(port, () => {
  console.log(`[world-editor-server] listening on http://localhost:${port}`);
  console.log(`  POST /api/ai/write — Generate governed AI drafts`);
  console.log(`  GET  /health — Health check`);
});
