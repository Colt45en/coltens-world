/**
 * NSG v1.0 Query Scorer
 *
 * Deterministic scoring for query candidate ranking.
 * Factors: confidence, segment count, root match length, lexicographic tie-break.
 */

import type { Term } from "./nsg-ast";
import { lookupLexicon, ROOTS } from "./nsg-lexicon";

/**
 * Candidate decomposition (possible morphological parse)
 */
export interface Candidate {
  segments: string[]; // ordered morphemes [prefix?, root, suffix?]
  confidence: number; // 0.0 - 1.0 (morphological certainty)
  root_match_length: number; // length of root in characters
  canonical_order: string; // "prefix-root-suffix" or similar (for tie-breaking)
  score?: number; // computed by scorer
}

/**
 * Parse the root from a term (heuristic: longest known root substring)
 */
function extractRoot(term: Term): string | null {
  if (!term.atom) return null;

  const word = term.atom.toLowerCase();

  // Try to match longest known root
  let bestRoot: string | null = null;
  let bestLen = 0;

  for (const rootKey of Object.keys(ROOTS)) {
    if (word.includes(rootKey) && rootKey.length > bestLen) {
      bestRoot = rootKey;
      bestLen = rootKey.length;
    }
  }

  return bestRoot;
}

/**
 * Score a single candidate deterministically
 *
 * Scoring factors (in order):
 * 1. Lexicon confidence (all segments)
 * 2. Root match length (longer matches score higher)
 * 3. Segment count (fewer segments score higher, simpler parse)
 * 4. Lexicographic canonical_order (tie-break)
 */
export function scoreCandidate(candidate: Candidate): number {
  // Factor 1: Average confidence of all segments
  const confidences = candidate.segments.map((seg) => {
    const entry = lookupLexicon(seg);
    return entry?.confidence ?? 0.5; // default 0.5 if unknown
  });
  const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;

  // Factor 2: Root match length (normalize to 0-1)
  const rootMatchScore = Math.min(candidate.root_match_length / 10, 1.0); // 10 chars = max

  // Factor 3: Segment count (fewer = simpler = higher score)
  const segmentScore = candidate.segments.length > 0 ? 1.0 / candidate.segments.length : 0;

  // Weighted sum (deterministic)
  // Weights chosen to prioritize confidence, then root match, then simplicity
  const score =
    avgConfidence * 0.5 + // 50% confidence
    rootMatchScore * 0.3 + // 30% root match
    segmentScore * 0.2; // 20% segmentation simplicity

  return Math.min(Math.max(score, 0), 1); // clamp to [0, 1]
}

/**
 * Rank candidates deterministically
 *
 * Algorithm:
 * 1. Score each candidate
 * 2. Sort by score (descending)
 * 3. Break ties by canonical_order (lexicographic ascending)
 */
export function rankCandidates(candidates: Candidate[]): Candidate[] {
  // Score all candidates
  const scored = candidates.map((c) => ({
    ...c,
    score: scoreCandidate(c),
  }));

  // Sort: by score descending, then by canonical_order ascending
  return scored.sort((a, b) => {
    if ((b.score ?? 0) !== (a.score ?? 0)) {
      return (b.score ?? 0) - (a.score ?? 0); // higher score first
    }
    // Tie-break: lexicographic order
    return a.canonical_order.localeCompare(b.canonical_order);
  });
}

/**
 * Generate decomposition candidates for a term (morphological analysis)
 *
 * Heuristic: try known prefix + known root + known suffix combinations
 */
export function generateCandidates(term: Term): Candidate[] {
  if (!term.atom) return [];

  const word = term.atom.toLowerCase();
  const candidates: Candidate[] = [];

  // Try root extraction (simple approach: longest known substring)
  const root = extractRoot(term);
  if (root) {
    // Try with no prefix, no suffix (simplest parse)
    const rootEntry = lookupLexicon(root, "root");
    if (rootEntry) {
      candidates.push({
        segments: [root],
        confidence:
          rootEntry.confidence + (word === root ? 0.1 : 0), // +0.1 if perfect match
        root_match_length: root.length,
        canonical_order: `root-${root}`,
      });
    }

    // Try candidate prefix patterns (if word starts with known prefix)
    for (const prefixKey of Object.keys(
      require("./nsg-lexicon").PREFIXES
    )) {
      if (word.startsWith(prefixKey) && prefixKey.length < word.length) {
        const suffix = word.slice(prefixKey.length);
        if (suffix === root) {
          // Prefix + Root (no suffix)
          const prefixEntry = lookupLexicon(prefixKey, "prefix");
          const avgConf = (
            (prefixEntry?.confidence ?? 0.5) +
            (rootEntry?.confidence ?? 0.5)
          ) / 2;

          candidates.push({
            segments: [prefixKey, root],
            confidence: avgConf,
            root_match_length: root.length,
            canonical_order: `prefix-${prefixKey}-root-${root}`,
          });
        }
      }
    }

    // Try candidate suffix patterns (if word ends with known suffix)
    for (const suffixKey of Object.keys(
      require("./nsg-lexicon").SUFFIXES
    )) {
      if (word.endsWith(suffixKey) && suffixKey.length < word.length) {
        const prefix = word.slice(0, word.length - suffixKey.length);
        if (prefix === root) {
          // Root + Suffix (no prefix)
          const suffixEntry = lookupLexicon(suffixKey, "suffix");
          const avgConf = (
            (rootEntry?.confidence ?? 0.5) +
            (suffixEntry?.confidence ?? 0.5)
          ) / 2;

          candidates.push({
            segments: [root, suffixKey],
            confidence: avgConf,
            root_match_length: root.length,
            canonical_order: `root-${root}-suffix-${suffixKey}`,
          });
        }

        // Try prefix + root + suffix
        const remaining = word.slice(0, word.length - suffixKey.length);
        for (const prefixKey of Object.keys(
          require("./nsg-lexicon").PREFIXES
        )) {
          if (remaining.startsWith(prefixKey)) {
            const candidate_root = remaining.slice(prefixKey.length);
            const rootEntry2 = lookupLexicon(candidate_root, "root");
            if (
              rootEntry2 &&
              candidate_root.length > 0 &&
              candidate_root === root
            ) {
              const prefixEntry = lookupLexicon(prefixKey, "prefix");
              const suffixEntry = lookupLexicon(suffixKey, "suffix");
              const avgConf =
                ((prefixEntry?.confidence ?? 0.5) +
                  (rootEntry2?.confidence ?? 0.5) +
                  (suffixEntry?.confidence ?? 0.5)) /
                3;

              candidates.push({
                segments: [prefixKey, candidate_root, suffixKey],
                confidence: avgConf,
                root_match_length: candidate_root.length,
                canonical_order: `prefix-${prefixKey}-root-${candidate_root}-suffix-${suffixKey}`,
              });
            }
          }
        }
      }
    }
  }

  return candidates;
}

/**
 * Query decomposition: find best candidate for a term
 * Returns { best_candidate, all_ranked_candidates }
 */
export function queryDecompose(term: Term) {
  const candidates = generateCandidates(term);
  const ranked = rankCandidates(candidates);

  return {
    term_atom: term.atom,
    best_candidate: ranked.length > 0 ? ranked[0] : null,
    ranked_candidates: ranked,
    total_candidates: candidates.length,
  };
}
