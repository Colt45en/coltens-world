# 📝 World Engine Editor Pack

A **contract-first**, **deterministic** rich text editor integrated with the World Engine ecosystem.

## Architecture

```
apps/world-editor/              ← React + TipTap UI + Express server
├── src/
│   ├── App.tsx                 ← Main component + Save Artifact button
│   ├── main.tsx                ← React entry point
│   ├── shared/
│   │   └── stable.ts           ← stableStringify + sha256Hex (deterministic hashing)
│   └── editor/
│       └── WorldRichEditor.tsx ← Rich editor component (with title prop)
├── server/
│   ├── index.ts                ← Express server (AI write + artifact save + ledger)
│   ├── ledger.ts               ← HashChainedLedger (append-only NDJSON)
│   └── artifacts.ts            ← Artifact bundling + persistence
├── package.json
├── tsconfig.json
├── vite.config.ts
└── index.html

packages/world-editor-shared/   ← Formatting kernel (shared)
├── src/
│   ├── canon.ts                ← Canonical sort keys + hashing
│   ├── governor.ts             ← Punctuation enforcement
│   ├── ruleWriter.ts           ← Deterministic "AI" writer
│   └── index.ts                ← Public exports
├── package.json
└── tsconfig.json
```

Storage structure:
```
.world/
  ├── artifacts/
  │   ├── <docId>/
  │   │   ├── latest.json        ← Latest artifact pointer
  │   │   └── <timestamp>_<hash>/
  │   │       ├── artifact.json  ← Manifest (title, sort key, hashes)
  │   │       ├── content.html   ← Full HTML snapshot
  │   │       └── content.txt    ← Governed plain text snapshot
  │   └── …
  └── ledger/
      └── ledger.ndjson          ← Hash-chained event log (append-only)

## Features

### 1. **Rich Text Editing** (TipTap)
- Bold, italic, headings, lists, blockquotes, code blocks
- Paste auto-governance (cleans input)
- Selection-aware operations

### 2. **Formatting Kernel**
- **Governor**: Enforces consistent spacing, terminal punctuation, punctuation rules
- **Canon**: Locale-free sort keys + deterministic hashing
- **RuleWriter**: Deterministic AI draft generator (changeable to real LLM later)

### 3. **AI Writing Panel**
- **Modes**: `continue`, `rewrite`, `summarize`, `expand`
- Selection-aware context (uses selected text or whole doc)
- Output always governed before insertion
- Currently deterministic (swap endpoint for real LLM)

### 4. **Artifact Writer** ✨
- **Save Artifact button**: Persists editor snapshot to disk
- **Deterministic naming**: Artifact ID is SHA256 hash of content (content-addressed)
- **Bundle format**: `artifact.json` (metadata) + `content.html` + `content.txt` (governed plain text)
- **Canonical indexing**: Includes `sort_key` + `tie_break` for deterministic ordering
- **Latest pointer**: `latest.json` per doc for quick access to current version

### 5. **Hash-Chained Ledger** 🧱
- **Append-only NDJSON**: `prev_hash` + `entry_hash` creates tamper-evident chain
- **Monotonic sequence**: `seq` ensures chronological ordering
- **Event types**: `"artifact.write"` (extensible for other events)
- **APIs**:
  - `GET /ledger/status` → current ledger state (maxSeq, lastHash)
  - `GET /ledger/range?start=1&end=10` → slice of ledger entries
  - `GET /ledger/stream?after_seq=5&limit=200` → streaming from a point

### 6. **Continuous Output**
- HTML (rich format)
- Governed plain text (deterministic)
- Canonical sort key (stable across edits)
- Tiebreaker hash (unique identification)

## Running It

### Install dependencies
```bash
cd "coltens world"
pnpm install
```

### Terminal 1: Run world-editor server (AI + artifacts + ledger)
```bash
pnpm --filter @world-engine/world-editor run dev:server
```
Listens on `http://localhost:5174`

Endpoints:
- `POST /api/ai/write` → AI writing with option to pick mode
- `POST /api/artifacts/save` → Save current editor snapshot
- `GET /ledger/status` → Ledger metadata
- `GET /ledger/range` → Query ledger entries
- `GET /ledger/stream` → Stream ledger from a point

Storage: `.world/artifacts/` and `.world/ledger/ledger.ndjson`

### Terminal 2: Run UI
```bash
pnpm --filter @world-engine/world-editor run dev
```
Listens on `http://localhost:5173`

### Open in browser
```
http://localhost:5173
```

Click **"Save Artifact + Ledger"** to persist editor state to disk and append event to ledger.

---

## API Endpoints

### AI Writing: `POST /api/ai/write`

```json
{
  "prompt": "write an intro paragraph about deterministic systems",
  "context": "optional: selected text or doc excerpt",
  "mode": "continue" | "rewrite" | "summarize" | "expand"
}
```

**Response:**
```json
{
  "text": "Here's a clean draft that captures... [governed output]"
}
```

### Artifact Save: `POST /api/artifacts/save`

```json
{
  "docId": "doc_demo_001",
  "title": "My Document",
  "html": "<p>Rich HTML here…</p>",
  "text": "Plain text here…"
}
```

**Response:**
```json
{
  "artifact_id": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "doc_id": "doc_demo_001",
  "created_at_utc": "2026-02-26T15:30:45.123Z",
  "sort_key": "my document plain text",
  "tie_break": "a1b2c3d4e5f6g7h8",
  "html_sha256": "abcd1234…",
  "text_sha256": "efgh5678…",
  "manifest_sha256": "ijkl9012…",
  "artifact_dir": ".world/artifacts/doc_demo_001/2026-02-26T15-30-45-123Z_a1b2c3d4…",
  "ledger_seq": 42,
  "ledger_entry_hash": "sha256(prev_hash + entry_data)"
}
```

### Ledger Status: `GET /ledger/status`

**Response:**
```json
{
  "ok": true,
  "filePath": ".world/ledger/ledger.ndjson",
  "maxSeq": 42,
  "lastHash": "sha256…"
}
```

### Ledger Range: `GET /ledger/range?start=1&end=10`

**Response:**
```json
{
  "ok": true,
  "start": 1,
  "end": 10,
  "events": [
    {
      "seq": 1,
      "ts_utc": "2026-02-26T15:30:44.000Z",
      "type": "artifact.write",
      "doc_id": "doc_demo_001",
      "artifact_id": "a1b2c3d4…",
      "payload": { "title": "My Document", … },
      "payload_hash": "…",
      "prev_hash": "0",
      "entry_hash": "sha256(…)"
    },
    …
  ]
}
```

### Ledger Stream: `GET /ledger/stream?after_seq=5&limit=200`

**Response:**
```json
{
  "ok": true,
  "after_seq": 5,
  "limit": 200,
  "events": [ … ]
}
```

---

## API: AI Writing Endpoint (Legacy Format)

**POST** `http://localhost:5174/api/ai/write`

```json
{
  "prompt": "write an intro paragraph about deterministic systems",
  "context": "optional: selected text or doc excerpt",
  "mode": "continue" | "rewrite" | "summarize" | "expand"
}
```

**Response:**
```json
{
  "text": "Here's a clean draft that captures... [governed output]"
}
```

---

## Contract Integration (Next Steps)

### Swap Deterministic Writer → Real LLM

Currently uses `deterministicWrite()` from `ruleWriter.ts`. To integrate with Nucleus/Agent Hub:

1. In `tooling/world-editor-server/src/index.ts`, replace the call:
   ```typescript
   // OLD:
   const text = deterministicWrite({ prompt, context, mode });

   // NEW: Call Nucleus tool_call
   const response = await agent.tools.llm.complete({
     prompt,
     context,
     // ... map mode to your tool params
   });
   const text = response.result.text;
   ```

2. Add the request to your message envelope + trace protocol

3. The governor remains the same—output cleaning is contract-agnostic

### Artifact Ledger Hooks

Store editor output → deterministic artifact:

```typescript
const artifact = {
  id: generateId(),
  html: value.html,
  governed_text: value.governed_text,
  sort_key: value.sort_key,
  tie_break: value.tie_break,
  content_hash: sha256(value.governed_text),
  timestamp: nowIso()
};

// Write to ledger:
await ledger.artifacts.append(artifact);
```

---

## Testing Determinism

The governor output is **reproducible**—same input always produces same output:

```typescript
const text = "hello   world    !"; // messy spacing
const governed = governText(text);
// → "Hello world." (normalized)

// Call 1000 times, get same result ✓
```

Sort keys are **stable across edits**:

```typescript
const v1 = buildCanonicalSortKey(["My Doc", "First paragraph"], "doc_123");
// key: "my doc first paragraph", tie: "a1b2c3d4e5f6g7h8"

// Edit the doc, regenerate:
const v2 = buildCanonicalSortKey(["My Doc", "First paragraph (edited)"], "doc_123");
// key: "my doc first paragraph edited", tie: "a1b2c3d4e5f6g7h8" (same!)
```

---

## Code Style

This project follows your monorepo conventions:

- **Exports**: Public APIs via `src/index.ts`
- **Boundaries**: Packages don't import from apps
- **Dependencies**: One-way (apps → packages, no cycles)
- **Determinism**: No wall-clock time in core logic
- **Testing**: Deterministic input/output assertions preferred

---

## Next Steps

What would you like to add?

- [x] Artifact writer + ledger hooks ← **just added!**
- [ ] Artifact read/export APIs
- [ ] Ledger verification endpoint (recompute chain, prove no mutation)
- [ ] Integrate with Nucleus tool_call protocol
- [ ] Document save/load from DB
- [ ] Real LLM endpoint (OpenAI, Claude, etc.)
- [ ] HTML export with styling
- [ ] Version history + diff tracking
- [ ] Collaborative editing (y.js adapter)

---

## Invariants Enforced

✅ **Deterministic boundaries**: Human-written + AI-generated text → server-governed on save
✅ **Content-addressed artifacts**: Artifact ID = SHA256 hash of manifest (same content → same ID)
✅ **Append-only ledger**: No mutations, only new events; hash chain proves integrity
✅ **Reproducible sorting**: `sort_key` + `tie_break` enable deterministic ordering across systems
✅ **Localized, governed output**: All text normalized per Governor rules (spacing, punctuation, terminal markers)

---
