import type { NucleusQuery, RouterIntent } from "@world-engine/nucleus-contracts";

export type RouteScore = {
  intent: RouterIntent;
  impact: number;
  complexity: number;
  score: number;
  reason: string;
};

function clampScore(n: number): number {
  return Math.max(1, Math.min(10, n));
}

export function scoreIntents(q: NucleusQuery): RouteScore[] {
  const text = q.query_text.toLowerCase();

  const wantsTool = /\b(run|build|test|lint|typecheck|export|generate|create file|pnpm|npm|script)\b/.test(text);
  const wantsMemory = /\b(remember|save this|store this|add to memory|decision|we decided)\b/.test(text);
  const wantsRetrieve = /\b(what is|where is|show me|find|explain|summarize|docs|spec)\b/.test(text) || text.length > 0;

  const constraints = q.constraints ?? {};
  const allowTools = constraints.allow_tools ?? true;
  const allowMemory = constraints.allow_memory_write ?? true;

  const scores: RouteScore[] = [];

  if (wantsRetrieve) {
    const impact = 10;
    const complexity = 4;
    scores.push({ intent: "retrieve", impact, complexity, score: impact - complexity, reason: "Natural language request → evidence retrieval" });
  }

  if (wantsTool && allowTools) {
    const impact = 9;
    const complexity = 6;
    scores.push({ intent: "tool", impact, complexity, score: impact - complexity, reason: "User asked to run/generate/build; allowlisted tool runner can satisfy" });
  }

  if (wantsMemory && allowMemory) {
    const impact = 8;
    const complexity = 5;
    scores.push({ intent: "memory", impact, complexity, score: impact - complexity, reason: "User requests persistence; memory requires approval gate" });
  }

  const ambiguous = /\b(it|that|this)\b/.test(text) && text.split(/\s+/).length < 6;

  if (ambiguous) {
    const impact = 7;
    const complexity = 2;
    scores.push({ intent: "clarify", impact, complexity, score: impact - complexity, reason: "Too ambiguous; ask a targeted question to avoid wrong action" });
  }

  for (const s of scores) {
    s.impact = clampScore(s.impact);
    s.complexity = clampScore(s.complexity);
    s.score = s.impact - s.complexity;
  }

  return scores.sort((a, b) => (b.score - a.score) || (a.intent.localeCompare(b.intent)));
}

export function chooseBestIntent(scores: RouteScore[]): RouterIntent {
  if (!scores.length) return "retrieve";
  return scores[0]!.intent;
}
