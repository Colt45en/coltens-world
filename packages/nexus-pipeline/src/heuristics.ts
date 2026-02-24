import type { CandidateFeatures } from "./types";
import { clamp, jaccardSimilarity, tokenizeLoose } from "./utils";

export function readabilityHeuristic(text: string): number {
    const lines = text.split("\n");
    const lineCount = lines.length || 1;
    const maxLen = Math.max(...lines.map(l => l.length), 0);
    const avgLen = lines.reduce((a, l) => a + l.length, 0) / lineCount;

    const braceCount = (text.match(/[{}]/g) || []).length;
    const parenCount = (text.match(/[()]/g) || []).length;
    const semis = (text.match(/;/g) || []).length;

    const lenPenalty = clamp((avgLen - 38) / 60, 0, 1) * 0.35 + clamp((maxLen - 90) / 120, 0, 1) * 0.25;
    const nestPenalty = clamp((braceCount + parenCount) / 40, 0, 1) * 0.30;
    const punctPenalty = clamp(semis / 20, 0, 1) * 0.10;

    return clamp(1.0 - (lenPenalty + nestPenalty + punctPenalty), 0, 1);
}

export function modularityHeuristic(text: string): number {
    const exports = /\bexport\s+(function|const)\b/i.test(text) ? 1 : 0;
    const namedFn = /\bfunction\s+[A-Za-z_$][\w$]*\b/.test(text) ? 1 : 0;
    const hasUsage = /\/\/\s*Usage/i.test(text) ? 1 : 0;
    const hasSections = /<style>|<\/style>|\/\*/i.test(text) ? 1 : 0;

    const lineCount = text.split("\n").length || 1;
    const sizeGate = clamp((lineCount - 4) / 12, 0, 1);

    return clamp(0.20 + exports * 0.35 + namedFn * 0.20 + hasUsage * 0.10 + hasSections * 0.10 + sizeGate * 0.05, 0, 1);
}

export function minimalDiffHeuristic(text: string, input: string): number {
    const a = tokenizeLoose(input);
    const b = tokenizeLoose(text);
    return clamp(jaccardSimilarity(a, b), 0, 1);
}

export function mixHintWithHeuristic(hint: number | undefined, heuristic: number): number {
    const h = (typeof hint === "number") ? hint : 0.5;
    return clamp(h * 0.55 + heuristic * 0.45, 0, 1);
}

export function computeFeatures(rendered: string, input: string, hints?: Partial<CandidateFeatures>): CandidateFeatures {
    return {
        readability: mixHintWithHeuristic(hints?.readability, readabilityHeuristic(rendered)),
        modularity: mixHintWithHeuristic(hints?.modularity, modularityHeuristic(rendered)),
        minimal_diff: mixHintWithHeuristic(hints?.minimal_diff, minimalDiffHeuristic(rendered, input)),
    };
}
