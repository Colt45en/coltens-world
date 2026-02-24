# Integration: @we/contracts with Nucleus

This guide shows how to integrate the **Autonomy Loop API** (type-safe via @we/contracts) into **Nucleus**, the Node.js orchestrator at the center of World Engine.

## Architecture

```
┌─────────────────────────────────────────┐
│        IDE Web (Vite + React)           │
│   Uses @we/contracts to query Nucleus   │
└──────────────┬──────────────────────────┘
               │ WebSocket
┌──────────────▼──────────────────────────┐
│      Nucleus (Node Orchestrator)        │
│   - File watching                       │
│   - Build triggering                    │
│   - Route handling                      │
│   - Autonomy Loop integration ← NEW     │
└──────────────┬──────────────────────────┘
               │ HTTP POST
┌──────────────▼──────────────────────────┐
│    Autonomy Loop API (Python FastAPI)   │
│   - Detective (Extract)                 │
│   - Alchemist (Transform)               │
│   - Analyst (Validate)                  │
│   - Specialist (Persist)                │
│   - PM (Report)                         │
└─────────────────────────────────────────┘
```

## Integration Steps

### 1. Install @we/contracts

In `apps/nucleus/package.json`:

```json
{
  "dependencies": {
    "@we/contracts": "workspace:*"
  }
}
```

Then:

```bash
pnpm install
```

### 2. Create Analysis Service in Nucleus

**File:** `apps/nucleus/src/services/autonomyService.ts`

```typescript
import { createAutonomyLoopClient } from "@we/contracts";
import type { BusEnvelope } from "@we/protocol";

export class AutonomyService {
  private client = createAutonomyLoopClient(
    process.env.AUTONOMY_LOOP_URL || "http://localhost:8001",
  );

  /**
   * Analyze a file from the workspace.
   * Called when IDE sends a request to analyze code.
   */
  async analyzeFile(
    filePath: string,
    content: string,
  ): Promise<{
    success: boolean;
    error?: string;
    analysis?: Record<string, any>;
  }> {
    try {
      const language = this.guessLanguage(filePath);
      const result = await this.client.runBatch({
        source_id: `file:${filePath}`,
        kind: "code",
        language_hint: language,
        text: content,
        fail_on_unknown_tag: true, // Strict governance
      });

      return {
        success: true,
        analysis: {
          evidence: result.EvidencePacket,
          lexicon: result.LexiconEntry,
          runes: result.RuneDecoderRow,
          plan: result.ValidatedPlan,
          decision: result.DecisionRecord,
        },
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Infer programming language from file extension.
   */
  private guessLanguage(filePath: string): string {
    const ext = filePath.split(".").pop()?.toLowerCase() || "";
    const langMap: Record<string, string> = {
      ts: "TypeScript",
      tsx: "TypeScript",
      js: "JavaScript",
      jsx: "JavaScript",
      py: "Python",
      go: "Go",
      rs: "Rust",
    };
    return langMap[ext] || "mixed";
  }
}

export const autonomyService = new AutonomyService();
```

### 3. Register with Nucleus Message Bus

**File:** `apps/nucleus/src/index.ts`

```typescript
import { bus } from "@we/bus";
import { autonomyService } from "./services/autonomyService";

// Register autonomy analysis handler
bus.subscribe("analysis", "analyze.file", async (envelope) => {
  const { filepath, content } = envelope.body;

  const result = await autonomyService.analyzeFile(filepath, content);

  return {
    ok: result.success,
    data: result.analysis,
    error: result.error,
  };
});

// Register governance query handler
bus.subscribe("analysis", "governance.tags", async () => {
  try {
    const tags = await autonomyService.client.taxonomyList({
      active_only: true,
    });
    return { ok: true, tags: tags.tags };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
});

// Register determinism check handler
bus.subscribe("analysis", "determinism.check", async () => {
  try {
    const result = await autonomyService.client.replayLast({
      n: 25,
      fail_on_unknown_tag: true,
    });
    return {
      ok: result.ok,
      checked: result.checked,
      drift: result.drift,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
});
```

### 4. IDE Web Client Usage

**File:** `apps/ide-web/src/hooks/useAnalyzeFile.ts`

```typescript
import { useCallback, useState } from "react";
import { bus } from "@we/bus";

export function useAnalyzeFile() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Record<string, any> | null>(null);

  const analyze = useCallback(async (filepath: string, content: string) => {
    setLoading(true);
    setError(null);

    try {
      const envelope = await bus.request("analysis", "analyze.file", {
        filepath,
        content,
      });

      if (envelope.data.ok) {
        setAnalysis(envelope.data.data);
      } else {
        setError(envelope.data.error || "Analysis failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  return { analyze, loading, error, analysis };
}
```

### 5. React Component

**File:** `apps/ide-web/src/components/CodeAnalyzer.tsx`

```typescript
import React from "react";
import { useAnalyzeFile } from "../hooks/useAnalyzeFile";

export function CodeAnalyzer({ filepath, content }: {
  filepath: string;
  content: string;
}) {
  const { analyze, loading, error, analysis } = useAnalyzeFile();

  React.useEffect(() => {
    if (content.trim()) {
      analyze(filepath, content);
    }
  }, [filepath, content, analyze]);

  if (loading) {
    return <div className="spinner">Analyzing code...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  if (!analysis) {
    return null;
  }

  return (
    <div className="code-analysis">
      <section>
        <h3>Plan Status</h3>
        <p>Status: <strong>{analysis.plan.status}</strong></p>
      </section>

      <section>
        <h3>Evidence</h3>
        <pre>{JSON.stringify(analysis.evidence, null, 2)}</pre>
      </section>

      <section>
        <h3>Lexicon Entries</h3>
        <ul>
          {analysis.lexicon.map((entry: any, i: number) => (
            <li key={i}>{entry.term}: {entry.definition}</li>
          ))}
        </ul>
      </section>

      <section>
        <h3>Decision</h3>
        <p>Hash: <code>{analysis.decision.hash}</code></p>
      </section>
    </div>
  );
}
```

## Running the Full Stack

### Terminal 1: Start Autonomy Loop API

```bash
cd apps/py-sidecar
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
```

### Terminal 2: Start Nucleus + IDE Web

```bash
pnpm run dev
# or individually:
pnpm -C apps/nucleus run dev
pnpm -C apps/ide-web run dev
```

### Terminal 3: Test Analysis

```bash
curl -X POST http://localhost:8001/autonomy/v1/run-batch \
  -H "content-type: application/json" \
  -d '{
    "source_id": "test:curl",
    "kind": "code",
    "language_hint": "TypeScript",
    "text": "const add = (a, b) => a + b;"
  }'
```

## Environment Configuration

**File:** `.env` (root)

```env
# Autonomy Loop API endpoint
AUTONOMY_LOOP_URL=http://localhost:8001

# Governance strictness
FAIL_ON_UNKNOWN_TAG=true

# API timeout (ms)
AUTONOMY_TIMEOUT=30000
```

## Debugging

### Check contracts are generated

```bash
pnpm contracts:check
# Safe to regenerate if needed:
pnpm contracts:gen
```

### Test Autonomy Loop directly

```bash
cd packages/contracts
pnpm test __tests__/integration.test.ts
```

### Monitor request/response flow

In TypeScript code:

```typescript
const client = createAutonomyLoopClient("http://localhost:8001");

// Add logging
const origPost = client["_post"];
client["_post"] = async (path: string, body: any) => {
  console.log(`[autonomy] POST ${path}`, JSON.stringify(body, null, 2));
  const result = await origPost.call(client, path, body);
  console.log(`[autonomy] Response`, JSON.stringify(result, null, 2));
  return result;
};
```

## Troubleshooting

| Problem                            | Solution                                                    |
| ---------------------------------- | ----------------------------------------------------------- |
| "Cannot find module @we/contracts" | Run `pnpm install` in workspace root                        |
| API timeout                        | Increase `timeout` in client config or check if API is slow |
| Type errors on RunBatchRequest     | Regenerate contracts: `pnpm contracts:gen`                  |
| 404 on /autonomy/v1/run-batch      | Ensure Autonomy Loop API is running on port 8001            |
| Governance tags unknown            | Run `pnpm contracts:check` to verify taxonomy sync          |

## See Also

- [@we/contracts README](../../packages/contracts/README.md)
- [Autonomy Loop Architecture](../../docs/BRAIN_SYSTEM.md)
- [Protocol Definitions](../../packages/protocol/src)
- [Bus Message System](../../packages/bus/src)
