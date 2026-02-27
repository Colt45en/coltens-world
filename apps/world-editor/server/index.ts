// server/index.ts
// Express server: AI writing + artifact storage + hash-chained ledger

import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { deterministicWrite, governText } from "@world-engine/world-editor-shared";

import { saveArtifactBundle } from "./artifacts.js";
import { HashChainedLedger } from "./ledger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json({ limit: "8mb" }));

// ---------- deterministic storage root ----------
const WORLD_ROOT = path.join(process.cwd(), ".world");
const LEDGER_FILE = path.join(WORLD_ROOT, "ledger", "ledger.ndjson");

// ---------- ledger init ----------
const ledger = new HashChainedLedger(LEDGER_FILE);
await ledger.init();

console.log(`[world-editor ledger] initialized at ${LEDGER_FILE}`);

app.get("/health", (_req, res) => res.json({ ok: true }));

// ---------- AI write endpoint ----------
app.post("/api/ai/write", (req, res) => {
  const prompt = String(req.body?.prompt ?? "").trim();
  const context = String(req.body?.context ?? "").trim();
  const mode = String(req.body?.mode ?? "continue") as any;

  if (!prompt) return res.status(400).send("prompt is required");

  const text = deterministicWrite({ prompt, context, mode });

  // Server boundary governor pass (invariants)
  const governed = text
    .split(/\n{2,}/g)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => governText(p))
    .join("\n\n");

  return res.json({ text: governed });
});

// ---------- artifact writer endpoint ----------
app.post("/api/artifacts/save", async (req, res) => {
  try {
    const docId = String(req.body?.docId ?? "").trim();
    const title = String(req.body?.title ?? "").trim();
    const html = String(req.body?.html ?? "");
    const text = String(req.body?.text ?? "");

    if (!docId) return res.status(400).send("docId is required");
    if (!title) return res.status(400).send("title is required");
    if (!html) return res.status(400).send("html is required");

    const out = await saveArtifactBundle({
      rootDir: WORLD_ROOT,
      input: { docId, title, html, text },
      ledger
    });

    return res.json(out);
  } catch (err: any) {
    return res.status(500).send(err?.message ?? String(err));
  }
});

// ---------- ledger endpoints ----------
app.get("/ledger/status", (_req, res) => {
  const s = ledger.status();
  res.json({ ok: true, ...s });
});

app.get("/ledger/range", async (req, res) => {
  const start = Number(req.query.start ?? "1");
  const end = Number(req.query.end ?? String(ledger.status().maxSeq));
  if (!Number.isFinite(start) || !Number.isFinite(end))
    return res.status(400).send("start/end must be numbers");
  const events = await ledger.range(start, end);
  res.json({ ok: true, start, end, events });
});

app.get("/ledger/stream", async (req, res) => {
  const after_seq = Number(req.query.after_seq ?? "0");
  const limit = Number(req.query.limit ?? "200");
  if (!Number.isFinite(after_seq) || !Number.isFinite(limit))
    return res.status(400).send("after_seq/limit must be numbers");
  const events = await ledger.stream(after_seq, limit);
  res.json({ ok: true, after_seq, limit, events });
});

const port = 5174;
app.listen(port, () => {
  console.log(`[world-editor server] listening on http://localhost:${port}`);
  console.log(`[world-editor artifacts] ${path.join(WORLD_ROOT, "artifacts")}`);
});
