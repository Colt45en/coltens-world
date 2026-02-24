/**
 * Metrics - Deterministic code flow analysis
 * Pure function: same input → same output (always)
 */

import { tokenize } from "./tokenize";
import { braceBalance } from "./braceBalance";

const KEYWORDS = new Set([
  "function", "return", "const", "let", "var", "if", "else", "for", "while", "class", "new",
  "try", "catch", "finally", "throw", "async", "await", "import", "export", "switch", "case",
  "do", "break", "continue", "default", "case", "of", "in", "instanceof", "typeof", "delete",
]);

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

export type FlowMetricsInput = { code: string; topN?: number };

export type FlowMetricsOutput = {
  energy: number;
  tempo: number;
  tension: number;
  remainingBraces: number;
  mismatchBraces: number;
  keywordCount: number;
  tokenCount: number;
  density: number;
  lineCount: number;
  textLength: number;
  topTokens: Array<{ token: string; count: number }>;
};

export function computeFlowMetrics(input: FlowMetricsInput): FlowMetricsOutput {
  const code = input.code ?? "";
  const topN = input.topN ?? 26;

  const textLength = code.length;
  const lineCount = Math.max(1, code.split("\n").length);

  const tokens = tokenize(code);
  const tokenCount = tokens.length;

  const { remaining, mismatch } = braceBalance(code);
  const tension = remaining + mismatch * 2;

  const sym = (code.match(/[{}()[\];,.]/g) || []).length;
  const ops = (code.match(/[=+\-*/%<>!&|]/g) || []).length;

  let keywordCount = 0;
  for (const t of tokens) {
    if (KEYWORDS.has(t)) keywordCount++;
  }

  const density = tokenCount / lineCount;

  // Energy formula: combines multiple signals
  // (same "spirit" as your POC, but fully deterministic)
  let e = 0;
  e += Math.log1p(textLength) * 0.18;
  e += Math.log1p(sym) * 0.65;
  e += Math.log1p(ops) * 0.55;
  e += Math.log1p(density) * 1.1;
  e += Math.log1p(keywordCount) * 0.9;

  // Penalize tension (unbalanced braces = stress)
  e -= tension * 0.55;

  const energy = clamp(e / 10.0, 0, 1.5);
  const tempo = clamp((sym + ops) / lineCount / 10, 0, 1);

  // Token histogram (stable sorting)
  const counts = new Map<string, number>();
  for (const tok of tokens) {
    counts.set(tok, (counts.get(tok) ?? 0) + 1);
  }

  const topTokens = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, topN)
    .map(([token, count]) => ({ token, count }));

  return {
    energy,
    tempo,
    tension,
    remainingBraces: remaining,
    mismatchBraces: mismatch,
    keywordCount,
    tokenCount,
    density,
    lineCount,
    textLength,
    topTokens,
  };
}
