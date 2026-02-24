# Integration Wiring Checklist

**Quick-start guide to activate the Autonomy Loop in existing Nucleus/IDE architecture.**

---

## Phase 1: Enable Nucleus Lexicon Routes ✅

### 1.1 Update `apps/nucleus/src/index.ts`

Add import and route setup:

```typescript
import { setupLexiconRoutes } from "./routes/lexicon";

export async function startNucleus() {
  const app = Fastify({ logger: true });

  // ... existing routes ...

  // NEW: Setup lexicon routes (queries world.db)
  const dbPath = process.env.LEXICON_DB_PATH || "./world.db";
  await setupLexiconRoutes(app, dbPath);

  await app.listen({ port: 3001 });
  console.log("✅ Nucleus + Lexicon routes ready on :3001");
}
```

### 1.2 Export in Router

In `apps/nucleus/src/router/index.ts`:

```typescript
export { setupLexiconRoutes } from "../routes/lexicon";
```

---

## Phase 2: Wire IDE Lexicon Client ✅

### 2.1 Initialize Client in IDE Boot

In `apps/ide-web/src/main.tsx`:

```typescript
import { lexiconClient } from "./bus/lexiconClient";

// At app startup (after Nucleus URL known)
lexiconClient.setNucleusUrl("http://localhost:3001");
console.log("✅ Lexicon client configured");
```

### 2.2 Add Hover Tooltip Integration

In `apps/ide-web/src/ui/editor/EditorProvider.tsx`:

```typescript
import { lexiconClient } from "../../bus/lexiconClient";

export function useSymbolHover() {
  return {
    onHover: async (symbol: string, language: string) => {
      const { entries } = await lexiconClient.lookupSymbol(symbol, language);
      return entries[0]
        ? {
            title: entries[0].term,
            confidence: entries[0].overall_confidence,
            meanings: entries[0].semantic_lenses,
          }
        : null;
    },
  };
}
```

### 2.3 Add Review Queue Widget

In `apps/ide-web/src/ui/lexicon/ReviewQueuePanel.tsx`:

```typescript
import { lexiconClient } from "../../bus/lexiconClient";

export function ReviewQueuePanel() {
  const [queue, setQueue] = useState([]);

  useEffect(() => {
    const poll = setInterval(async () => {
      const items = await lexiconClient.getReviewQueue();
      setQueue(items);
    }, 5000); // Poll every 5s

    return () => clearInterval(poll);
  }, []);

  return (
    <div className="review-queue">
      <h3>Review Queue ({queue.length})</h3>
      {queue.map((item) => (
        <div key={item.queue_id} className="review-item">
          <code>{item.item_id}</code>
          <button onClick={() => approveItem(item.item_id)}>Approve</button>
        </div>
      ))}
    </div>
  );
}
```

---

## Phase 3: Integrate Brain Lexicon Tool ✅

### 3.1 Import in Brain Planning

In `packages/brain/src/planning.ts`:

```typescript
import { createBrainLexiconTool, ActionType } from "./lexicon-tool";
import { lexiconClient } from "@world-engine/lexicon";

export class PlannerWithGovernance {
  private lexTool: BrainLexiconTool;

  constructor() {
    this.lexTool = createBrainLexiconTool(lexiconClient);
  }

  async planAction(symbols: BrainSymbolContext[]): Promise<Action[]> {
    // Check governance
    const { overall_action, escalations } = await this.lexTool.enforcePolicy(symbols);

    if (overall_action === ActionType.DENY) {
      throw new Error(`BLOCKED: governance failure on ${escalations.join(", ")}`);
    }

    if (overall_action === ActionType.DEFER) {
      console.log("⏳ Waiting for lexicon review to complete...");
      return [];
    }

    // Proceed with planning (USE or SUGGEST)
    return this.buildPlan();
  }
}
```

### 3.2 Export From Brain Package

In `packages/brain/src/index.ts`:

```typescript
export { createBrainLexiconTool, ActionType } from "./lexicon-tool";
export type { GovernanceDecision, BrainSymbolContext } from "./lexicon-tool";
```

---

## Phase 4: Start Python Pipeline Server ✅

### 4.1 Verify Requirements

In `apps/py-sidecar/requirements.txt`:

```
pydantic==2.7.4
fastapi==0.104.1
uvicorn==0.24.0
```

### 4.2 Run Server

```bash
cd apps/py-sidecar
python main.py
# Output: INFO:     Uvicorn running on http://0.0.0.0:3002
```

Or as background service in monorepo:

```bash
# In pnpm task (package.json at root)
"start:sidecar": "cd apps/py-sidecar && python main.py"
```

### 4.3 Trigger Pipeline from Nucleus

In `apps/nucleus/src/router/handlers/ingest.ts`:

```typescript
import axios from "axios";

export async function handleUserCodeUpload(req: any) {
  const { file_path, language } = req.body;

  // Trigger python pipeline
  const response = await axios.post("http://localhost:3002/pipeline/run", {
    input_file: file_path,
    language: language || "TypeScript",
    objective: `User-uploaded: ${file_path}`,
    output_dir: `./indexed/${Date.now()}`,
  });

  if (response.data.success) {
    console.log(`✅ Batch ${response.data.batch_id} approved`);
    // Broadcast to IDE: new lexicon baseline available
    return { batch_id: response.data.batch_id, status: response.data.governance };
  } else {
    console.log(`⚠️ Pipeline review required`);
    return { status: "review_required", batch_id: response.data.batch_id };
  }
}
```

---

## Phase 5: Full Stack Test ✅

### Test Checklist

- [ ] **Nucleus starts**: `pnpm run dev --filter apps/nucleus`
  - Check: `curl http://localhost:3001/lexicon/status`
  - Expected: `{"status":"online","db_exists":true}`

- [ ] **IDE client loads**: `pnpm run dev --filter apps/ide-web`
  - Check: DevTools console → `lexiconClient.getStatus()`
  - Expected: `{status: "online", ...}`

- [ ] **Python sidecar runs**: `python apps/py-sidecar/main.py`
  - Check: `curl http://localhost:3002/pipeline/health`
  - Expected: `{"status":"online","db_exists":false}`

- [ ] **Trigger pipeline**: POST to `/pipeline/run` with valid input file
  - Expected: All 9 artifacts created in output_dir
  - Check: `world.db` exists with 5 tables populated

- [ ] **Brain resolves symbols**: Call `tool.resolveSymbols([...])`
  - Expected: Decisions with actions (USE, SUGGEST, ESCALATE)
  - Check: Confidence > 0.80 → action = USE

---

## Environment Variables

Set these in `.env` or export:

```bash
# Nucleus
NUCLEUS_PORT=3001
LEXICON_DB_PATH=./world.db

# IDE
VITE_NUCLEUS_URL=http://localhost:3001
VITE_SIDECAR_URL=http://localhost:3002

# Python Sidecar
SIDECAR_PORT=3002
SIDECAR_HOST=0.0.0.0
```

---

## Troubleshooting

| Issue                                 | Solution                                                            |
| ------------------------------------- | ------------------------------------------------------------------- |
| `Cannot find module: lexicon-tool.ts` | Ensure `packages/brain/src/lexicon-tool.ts` exists                  |
| `ECONNREFUSED localhost:3001`         | Start Nucleus first: `pnpm run dev --filter apps/nucleus`           |
| `ECONNREFUSED localhost:3002`         | Start sidecar: `python apps/py-sidecar/main.py`                     |
| `world.db not found`                  | Run pipeline first: `POST /pipeline/run`                            |
| `Symbol not in lexicon`               | Normal (symbol is novel). Check governance escalation.              |
| `Cache stale`                         | IDE client TTL is 30s. Clear manually: `lexiconClient.clearCache()` |

---

## Quick Commands (Monorepo)

```bash
# Full stack start
pnpm run dev

# Start individual services
pnpm run dev --filter apps/nucleus
pnpm run dev --filter apps/ide-web
python apps/py-sidecar/main.py

# Test API endpoints
curl http://localhost:3001/lexicon/status
curl http://localhost:3002/pipeline/health

# Clear lexicon cache (IDE console)
lexiconClient.clearCache()

# Query symbol
lexiconClient.lookupSymbol("useState", "TypeScript")

# Enforce governance
const tool = createBrainLexiconTool(lexiconClient);
await tool.enforcePolicy([...])
```

---

## File Reference

| File                                    | Purpose             | Edit Status              |
| --------------------------------------- | ------------------- | ------------------------ |
| `apps/nucleus/src/routes/lexicon.ts`    | Lexicon API         | ✅ Created               |
| `apps/nucleus/src/index.ts`             | Route registration  | 🔄 **Needs wiring**      |
| `apps/ide-web/src/bus/lexiconClient.ts` | Symbol cache        | ✅ Created               |
| `apps/ide-web/src/main.tsx`             | Client init         | 🔄 **Needs init**        |
| `packages/brain/src/lexicon-tool.ts`    | Governance          | ✅ Created               |
| `packages/brain/src/planning.ts`        | Planner integration | 🔄 **Needs integration** |
| `apps/py-sidecar/main.py`               | Pipeline server     | ✅ Updated               |

---

## Status

| Step                   | Status | Notes                                                                |
| ---------------------- | ------ | -------------------------------------------------------------------- |
| Nucleus routes created | ✅     | Ready to wire into index.ts                                          |
| IDE client created     | ✅     | Ready to wire into main.tsx                                          |
| Brain tool created     | ✅     | Ready to integrate in planning.ts                                    |
| Python pipeline server | ✅     | Ready to start (port 3002)                                           |
| Integration guide      | ✅     | [AUTONOMY_INTEGRATION_COMPLETE.md](AUTONOMY_INTEGRATION_COMPLETE.md) |
| Full stack test        | ⏳     | After wiring phase 1–4                                               |

---

**Next:** Wire Phase 1–4 above, then run `pnpm run dev` to activate the full governance stack.
