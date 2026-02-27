# World Editor — Quick Start

## 1. Verify files are in place

```bash
cd "c:\Users\colte\colten projects\coltens world"

# Should exist:
ls apps/world-editor/
ls tooling/world-editor-server/
ls packages/world-editor-shared/
```

## 2. Install + build shared package

```bash
pnpm install
pnpm --filter @world-engine/world-editor-shared run build
```

This compiles the shared formatting kernel (canon, governor, ruleWriter).

## 3. Terminal 1: Run the AI server

```bash
pnpm --filter @world-engine/world-editor-server run dev
```

Watch for: `[world-editor-server] listening on http://localhost:5174`

## 4. Terminal 2: Run the UI

```bash
pnpm --filter @world-engine/world-editor run dev
```

Watch for: `VITE v5.x.x ready in ... ms`

## 5. Open in browser

```
http://localhost:5173
```

You should see:
- **Title input** at top
- **Rich editor** in the center (paste/type here)
- **AI Writing panel** on the right

## Smoke Test

1. Type some text with multiple spaces/bad punctuation
2. Click **"Govern Document (safe)"** → should clean it up
3. In the AI panel:
   - Select "continue" mode
   - Type: "introduce a new idea about systems"
   - Click **"Insert AI Draft (Governed)"**
   - AI draft appears below your text (governed)
4. Check the JSON output at bottom → should show:
   - `html` (rich format)
   - `governed_text` (clean plain text)
   - `sort_key` (locale-free, normalized)
   - `tie_break` (unique hash)

## Troubleshooting

### Shared package not found?
```bash
pnpm --filter @world-engine/world-editor-shared run build
```

### Port 5174 already in use?
```bash
pnpm --filter @world-engine/world-editor-server run dev -- --port 5175
# Then update aiEndpoint in App.tsx
```

### VITE errors?
```bash
pnpm --filter @world-engine/world-editor run build
```
Check for TypeScript errors.

---

## Next Steps

1. **Verify it runs** ✓
2. **Test AI endpoint**: POST to `http://localhost:5174/api/ai/write`
3. **Hook into your Nucleus/Agent Hub** (swap `deterministicWrite` for real LLM)
4. **Add artifact writer + ledger integration**
5. **Add document persistence** (save/load from DB or filesystem)

**Ready?** Just say the word!
