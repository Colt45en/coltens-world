# Memory Chain: Concept Tracing Guide

## Overview

The **Memory Chain** CLI traces a concept through your knowledge artifacts to show how beliefs evolved over time. It links:

```
Concept mentioned
    ↓
Reasoning mode selected
    ↓
Decision made
    ↓
Outcome recorded
    ↓
Belief updated
```

Perfect for:

- Auditing how an idea evolved
- Understanding confidence growth
- Replaying reasoning paths
- Validating decision quality

## Installation

Memory chain is built into the core CLI tools. No additional setup needed.

## Usage

### Basic: Human-readable chain

```bash
pnpm run memory:chain -- --file .brain/memory/knowledge.ndjson --concept "webgpu"
```

Output:

```
📊 Memory Chain for "webgpu"

Length: 3 mentions
Timeline: 2026-02-11T10:30:00Z → 2026-02-12T14:45:00Z

  Concept "webgpu" mentioned 3 times
  First: 2026-02-11T10:30:00Z
  Last: 2026-02-12T14:45:00Z
  Reasoning modes: deductive, mixed, abductive
  Confidence increased from 50% to 75%

────────────────────────────────────────────────────────────────────────────────

[1] 2026-02-11T10:30:00Z
    Artifact: KA_20260211103000z
    Mention: "exploring webgpu renderer initialization"
    Reasoning: mixed
    Outcome: "Created WebGPU async factory pattern with fallback"
    Confidence: 50%

[2] 2026-02-11T15:20:00Z
    Artifact: KA_20260211152000z
    Mention: "webgpu initialization performance concerns"
    Reasoning: deductive
    Outcome: "Verified async init prevents render-before-ready"
    Confidence: 65%

[3] 2026-02-12T14:45:00Z
    Artifact: KA_20260212144500z
    Mention: "webgpu fallback to webgl for unsupported browsers"
    Reasoning: abductive
    Outcome: "Error handling ensures graceful degradation"
    Confidence: 75%

────────────────────────────────────────────────────────────────────────────────
✅ Chain complete: 3 links traced
```

### JSON: Complete chain structure

```bash
pnpm run memory:chain -- --file .brain/memory/knowledge.ndjson --concept "webgpu" --json
```

Output:

```json
{
  "concept": "webgpu",
  "firstMention": "2026-02-11T10:30:00.000Z",
  "lastMention": "2026-02-12T14:45:00.000Z",
  "chainLength": 3,
  "links": [
    {
      "artifactId": "KA_20260211103000z",
      "createdAt": "2026-02-11T10:30:00.000Z",
      "concept": "webgpu",
      "mention": "exploring webgpu renderer initialization",
      "reasoningMode": "mixed",
      "decision": "Create WebGPU async factory pattern",
      "outcome": "Created WebGPU async factory pattern with fallback",
      "beliefBefore": ["Async rendering needed"],
      "beliefAfter": ["Factory pattern handles async lifecycle"],
      "confidence": 0.5
    },
    ...
  ],
  "beliefEvolution": [
    "Concept \"webgpu\" mentioned 3 times",
    "First: 2026-02-11T10:30:00.000Z",
    ...
  ]
}
```

### JSONL: Stream chain links

```bash
pnpm run memory:chain -- --file .brain/memory/knowledge.ndjson --concept "webgpu" --jsonl
```

Each line is a `ChainLink`:

```jsonl
{"artifactId":"KA_20260211103000z","createdAt":"2026-02-11T10:30:00.000Z",...}
{"artifactId":"KA_20260211152000z","createdAt":"2026-02-11T15:20:00.000Z",...}
{"artifactId":"KA_20260212144500z","createdAt":"2026-02-12T14:45:00.000Z",...}
```

Perfect for piping to other tools:

```bash
pnpm run memory:chain -- --file .brain/memory/knowledge.ndjson --concept "webgpu" --jsonl | grep -c '"reasoningMode":"deductive"'
```

## Data Structure

### ChainLink

```typescript
{
  artifactId: string;           // KnowledgeArtifact ID
  createdAt: string;            // ISO datetime

  concept: string;              // What was discussed
  mention: string;              // Where it appeared (snippet)
  reasoningMode: string;        // "deductive" | "inductive" | "abductive" | "mixed"
  decision: string;             // What was decided
  outcome: string;              // What resulted

  beliefBefore: string[];       // Assumptions before
  beliefAfter: string[];        // Facts after
  confidence: number;           // 0.0 to 1.0 (increases over chain)
}
```

### MemoryChain

```typescript
{
  concept: string;              // The concept traced
  firstMention: string;         // When first seen (ISO)
  lastMention: string;          // When last seen (ISO)
  chainLength: number;          // Count of mentions
  links: ChainLink[];           // All links in order
  beliefEvolution: string[];    // Human-readable summary
}
```

## Practical Examples

### Trace performance optimization ideas

```bash
pnpm run memory:chain -- --file .brain/memory/knowledge.ndjson --concept "zero-alloc"
```

Shows how the idea evolved from hypothesis to validated solution.

### Track API contract changes

```bash
pnpm run memory:chain -- --file .brain/memory/knowledge.ndjson --concept "BusEnvelope" --json | jq '.links | map(.reasoning Mode)'
```

Review what reasoning was used for each API change.

### Find confidence in a decision

```bash
pnpm run memory:chain -- --file .brain/memory/knowledge.ndjson --concept "streaming" --json | jq '.links[-1].confidence'
```

Check final confidence score (0.0 = unsure, 1.0 = confident).

### Export decision timeline

```bash
pnpm run memory:chain -- --file .brain/memory/knowledge.ndjson --concept "lexicon" --json > concept_lexicon.json
# Use in your IDE or docs
```

## Integration with IDE Panel

Wire the chain viewer into your MemoryPanel:

```tsx
import { useState } from "react";

export function ChainViewerTab() {
  const [concept, setConcept] = useState("webgpu");
  const [chain, setChain] = useState(null);

  const loadChain = async () => {
    const cmd = `pnpm run memory:chain -- --file .brain/memory/knowledge.ndjson --concept ${concept} --json`;
    const output = execSync(cmd, { encoding: "utf8" });
    setChain(JSON.parse(output));
  };

  return (
    <div>
      <input
        value={concept}
        onChange={(e) => setConcept(e.target.value)}
        placeholder="Enter concept"
      />
      <button onClick={loadChain}>Trace Concept</button>

      {chain && (
        <div>
          <h3>Chain: {chain.concept}</h3>
          <p>
            Length: {chain.chainLength} | Confidence:{" "}
            {(chain.links[-1].confidence * 100).toFixed(0)}%
          </p>

          {chain.links.map((link, i) => (
            <div key={i} style={{ border: "1px solid #ccc", padding: "8px", margin: "8px 0" }}>
              <strong>[{i + 1}]</strong> {link.createdAt.slice(0, 10)}
              <br />
              Mode: {link.reasoningMode} | Confidence: {(link.confidence * 100).toFixed(0)}%
              <br />
              Outcome: {link.outcome}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

## Performance Notes

- Chains with 100+ links remain O(n) fast
- Streaming (`--jsonl`) is best for large datasets
- Confidence scores are heuristic (based on fact count); tune as needed

## Next Steps

- [ ] Add reverse links (artifact → all concepts mentioned)
- [ ] Drill-down: click link → expand full artifact
- [ ] Confidence anomaly detection (sudden drops)
- [ ] Export chain as markdown/PDF report
