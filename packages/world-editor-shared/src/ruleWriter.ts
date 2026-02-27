/**
 * Deterministic "AI Writer" — produces stable, useful drafts
 * Can be swapped with real LLM via tool_call adapter later
 */

import { fnv1a64Hex } from "./canon";

export type AiMode = "continue" | "rewrite" | "summarize" | "expand";

export interface AiWriteInput {
  prompt: string;
  context?: string; // selected text or whole doc text
  mode: AiMode;
}

const OPENERS = [
  "Here's a clean draft that captures the intent and keeps the language tight",
  "Below is a structured pass that turns the idea into readable, publishable prose",
  "This version focuses on clarity, flow, and forward momentum"
];

const CLOSERS = [
  "If you want, we can tune the tone (formal, mythic, blunt, cinematic) without changing meaning",
  "Next step: decide whether this is an outline-first piece or a single narrative paragraph",
  "If you give me the target audience, I'll sharpen the voice and cut fluff further"
];

function pick<T>(arr: T[], seedHex: string, salt: string): T {
  const h = BigInt("0x" + fnv1a64Hex(seedHex + ":" + salt));
  const idx = Number(h % BigInt(arr.length));
  return arr[idx];
}

function extractKeywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/g)
    .filter((w) => w.length >= 4);

  const stop = new Set([
    "this", "that", "with", "from", "into", "your", "their", "what", "when", "where", "which",
    "have", "will", "also", "there", "about", "which", "some", "many", "such", "make"
  ]);
  const uniq: string[] = [];
  for (const w of words) {
    if (stop.has(w)) continue;
    if (!uniq.includes(w)) uniq.push(w);
    if (uniq.length >= 8) break;
  }
  return uniq;
}

/**
 * Generate deterministic writing output based on mode and content
 * Fully reproducible given same inputs — use as stand-in or for testing
 */
export function deterministicWrite(input: AiWriteInput): string {
  const base = (input.prompt || "").trim();
  const ctx = (input.context || "").trim();
  const seed = fnv1a64Hex(base + "||" + ctx + "||" + input.mode);

  const opener = pick(OPENERS, seed, "opener");
  const closer = pick(CLOSERS, seed, "closer");

  const kws = extractKeywords(base + " " + ctx);
  const focus = kws.length ? kws.join(", ") : "clarity, structure, and momentum";

  const title = base.length > 0 ? base : "Untitled Draft";
  const ctxLine = ctx.length ? `Context: ${ctx.slice(0, 240)}${ctx.length > 240 ? "…" : ""}` : "";

  switch (input.mode) {
    case "summarize":
      return [
        `${opener}.`,
        ctxLine ? ctxLine + "." : "",
        `Summary: This text centers on ${focus}. It establishes the main claim, supports it with concrete steps, and ends with actionable direction.`,
        `Key points:`,
        `- Goal: make the core idea readable and repeatable.`,
        `- Constraint: remove ambiguity and keep invariants stable.`,
        `- Next action: decide what must be deterministic vs what can be flexible.`,
        `${closer}.`
      ]
        .filter(Boolean)
        .join("\n");

    case "rewrite":
      return [
        `${opener}.`,
        `Rewrite target: ${title}.`,
        ctxLine ? ctxLine + "." : "",
        `Rewritten draft:`,
        `The goal is to turn the intent into output that stays correct under pressure. That means we normalize punctuation, choose stable sort keys, and encode missing-data rules explicitly. The writing remains human, but the rules underneath are machine-clean. When the system renders, it does not "guess"—it applies the same policy every time.`,
        `${closer}.`
      ]
        .filter(Boolean)
        .join("\n");

    case "expand":
      return [
        `${opener}.`,
        `Expansion target: ${title}.`,
        `Core focus: ${focus}.`,
        `Expanded draft:`,
        `Start by defining what "correct output" means for your engine: consistent punctuation, consistent separators, and predictable endings. Then define a canonical sort key that is locale-free, stable, and derived from structured facts (not the rendered text). Finally, treat missing data as first-class: decide what happens when a field is absent, and encode that policy directly. These three moves—govern, key, and rule—turn formatting from an art into an instrument.`,
        `Next: add test vectors that prove the output is stable across edits and reorderings.`,
        `${closer}.`
      ]
        .filter(Boolean)
        .join("\n");

    case "continue":
    default:
      return [
        `${opener}.`,
        `Continue target: ${title}.`,
        `Continuation:`,
        `Once the governor is in place, you can safely let humans and AI draft freely—because the output is cleaned at the boundary. That boundary is where you enforce invariants: spacing, punctuation, terminal markers, and canonical keys. The trick is to keep the creative surface flexible while keeping the renderer deterministic.`,
        `${closer}.`
      ]
        .filter(Boolean)
        .join("\n");
  }
}
