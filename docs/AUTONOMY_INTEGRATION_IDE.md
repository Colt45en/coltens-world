/\*\*

- Integration Example: IDE Web + Autonomy Loop API
-
- This example shows how to use @we/contracts in the IDE Web application
- to communicate with the Autonomy Loop Python backend.
-
- File: apps/ide-web/src/autonomy-integration.ts
- Usage:
- import { analyzeCode } from "./autonomy-integration";
- const result = await analyzeCode(codeText, "TypeScript");
  \*/

import { createAutonomyLoopClient } from "@we/contracts";

// Initialize client pointing to Autonomy Loop API
const autonomyClient = createAutonomyLoopClient(
process.env.AUTONOMY_LOOP_URL || "<http://localhost:8001>"
);

/\*\*

- Analyze code using the full Autonomy Loop (5-role pipeline).
-
- Flow:
- 1. Detective: Extract evidence from code
- 1. Alchemist: Transform into structured knowledge
- 1. Analyst: Validate against governance rules
- 1. Specialist: Persist to database with deterministic hash
- 1. PM: Generate report with insights
-
- @param code - TypeScript/JavaScript code to analyze
- @param language - Programming language hint ("TypeScript", "JavaScript", etc.)
- @returns Complete analysis artifact packet
  \*/
  export async function analyzeCode(
  code: string,
  language: string = "TypeScript"
  ): Promise<{
  evidence: Record<string, any>;
  lexicon: Record<string, any>[];
  runes: Record<string, any>[];
  plan: Record<string, any>;
  decision: Record<string, any>;
  }> {
  try {
  const result = await autonomyClient.runBatch({
  source_id: `ide:web:${Date.now()}`,
  kind: "code",
  language_hint: language,
  text: code,
  fail_on_unknown_tag: true, // Strict: reject unknown governance tags
  });

      return {
        evidence: result.EvidencePacket,
        lexicon: result.LexiconEntry,
        runes: result.RuneDecoderRow,
        plan: result.ValidatedPlan,
        decision: result.DecisionRecord,
      };

  } catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  throw new Error(
  `Autonomy Loop analysis failed: ${message}.` +
  `Ensure Autonomy Loop API is running at ${autonomyClient.constructor.name}`
  );
  }
  }

/\*\*

- Query available governance tags (process taxonomy).
  \*/
  export async function queryGovernanceTags(): Promise<
  Array<{
  tag: string;
  description: string;
  active: boolean;
  created_at: string;
  }>
  > {
  > const result = await autonomyClient.taxonomyList({
      active_only: true,
  });
  return result.tags;
  }

/\*\*

- Check determinism by replaying last N batches.
-
- Used for regression testing: ensures same input → same output.
  \*/
  export async function checkDeterminism(
  opts: { n?: number; days?: number } = {}
  ): Promise<{
  ok: boolean;
  checked: number;
  drift?: Array<{
  batch_id: string;
  drift_type: string;
  details?: Record<string, any>;
  }>;
  }> {
  return autonomyClient.replayLast({
  n: opts.n ?? 25,
  days: opts.days,
  fail_on_unknown_tag: true,
  });
  }

/\*\*

- Extract only the Evidence Packet (Detective role).
-
- Useful for quick analysis without full pipeline.
  \*/
  export async function extractEvidence(
  code: string,
  language: string = "TypeScript"
  ): Promise<Record<string, any>> {
  try {
  return await autonomyClient.ingest({
  source_id: `ide:detective:${Date.now()}`,
  kind: "code",
  language_hint: language,
  text: code,
  });
  } catch (err) {
  throw new Error(
  `Evidence extraction failed: ${err instanceof Error ? err.message : String(err)}`
  );
  }
  }

/\*\*

- Hook for use in React component.
-
- Usage:
- const { evidence, loading, error } = useAnalyzeCode(codeText);
- if (loading) return <div>Analyzing...</div>;
- if (error) return <div>Error: {error}</div>;
- return <div>{JSON.stringify(evidence, null, 2)}</div>;
  \*/
  export function useAnalyzeCode(code: string, language: string = "TypeScript") {
  const [evidence, setEvidence] = React.useState<Record<string, any> | null>(
  null
  );
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

React.useEffect(() => {
if (!code.trim()) {
setEvidence(null);
return;
}

    setLoading(true);
    setError(null);

    analyzeCode(code, language)
      .then((result) => setEvidence(result.evidence))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

}, [code, language]);

return { evidence, loading, error };
}

// Re-import React types (would be imported at top of actual file)
import React from "react";
