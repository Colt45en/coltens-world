/**
 * Deterministic Lexicon-based Sentiment Analyzer
 *
 * Uses keyword matching to compute sentiment score (0-1 range).
 * No external APIs or neural networks - fully deterministic.
 *
 * Architecture:
 * - Positive terms: joy, success, love, beautiful, etc.
 * - Negative terms: fail, hate, ugly, sad, etc.
 * - Intensifiers: very, extremely, absolutely (multiply weight)
 * - Negators: not, no, never (flip score)
 */

const POSITIVE_TERMS: Record<string, number> = {
  // High intensity (0.8-1.0)
  love: 0.95,
  beloved: 0.95,
  joy: 0.93,
  beautiful: 0.92,
  excellent: 0.91,
  amazing: 0.90,
  wonderful: 0.90,
  perfect: 0.89,
  great: 0.85,
  good: 0.75,
  like: 0.72,
  nice: 0.70,
  happy: 0.88,
  thrilled: 0.92,
  delighted: 0.90,
  brilliant: 0.89,
  superb: 0.88,
  fantastic: 0.87,
  awesome: 0.86,
  lovely: 0.84,
  magnificent: 0.83,
  glorious: 0.82,
  fabulous: 0.81,
  outstanding: 0.80,
  splendid: 0.79,
  remarkable: 0.78,
  impressive: 0.77,
  delightful: 0.76,
  success: 0.80,
  succeeded: 0.79,
  triumph: 0.85,
  victory: 0.84,
  win: 0.75,
  achieve: 0.70,
  hope: 0.65,
  inspired: 0.75,
  peaceful: 0.72,
  calm: 0.68,
  trust: 0.70,
};

const NEGATIVE_TERMS: Record<string, number> = {
  // High intensity (0.8-1.0)
  hate: 0.95,
  hateful: 0.94,
  despise: 0.93,
  awful: 0.92,
  terrible: 0.91,
  horrible: 0.90,
  disgusting: 0.89,
  ugly: 0.85,
  bad: 0.75,
  sad: 0.84,
  depressed: 0.87,
  miserable: 0.86,
  sick: 0.80,
  angry: 0.82,
  furious: 0.88,
  enraged: 0.89,
  disgusted: 0.87,
  disappointed: 0.75,
  frustrated: 0.73,
  annoyed: 0.65,
  irritated: 0.70,
  anxious: 0.72,
  worried: 0.70,
  scared: 0.75,
  terrified: 0.88,
  afraid: 0.80,
  fail: 0.82,
  failed: 0.81,
  failure: 0.80,
  disaster: 0.88,
  catastrophe: 0.89,
  crisis: 0.85,
  problem: 0.60,
  issue: 0.50,
  difficult: 0.55,
  hard: 0.50,
  struggle: 0.65,
  pain: 0.75,
  suffer: 0.80,
  loss: 0.70,
  lost: 0.72,
  broken: 0.68,
  shattered: 0.80,
  destroyed: 0.85,
};

const INTENSIFIERS = {
  very: 1.3,
  extremely: 1.4,
  absolutely: 1.5,
  incredibly: 1.4,
  deeply: 1.3,
  highly: 1.2,
  quite: 1.1,
  really: 1.2,
  so: 1.1,
  too: 1.15,
  much: 1.1,
};

const NEGATORS = new Set(["not", "no", "never", "neither", "nor", "isn't", "aren't", "wasn't", "weren't", "don't", "doesn't", "didn't", "won't", "wouldn't", "can't", "couldn't", "shouldn't", "haven't", "hasn't", "hadn't"]);

const CONTEXT_WINDOW = 3; // Look 3 words before/after for context

/**
 * Compute sentiment score for a sentence (0-1 where 0.5 is neutral)
 */
export function computeSentimentScore(sentence: string): number {
  if (!sentence || typeof sentence !== "string") {
    return 0.5; // Neutral if invalid
  }

  const words = sentence.toLowerCase().split(/\s+/);
  let totalScore = 0;
  let totalWeight = 0;

  for (let i = 0; i < words.length; i++) {
    const cleanWord = words[i].replace(/[^\w]/g, "");

    // Check for positive terms
    if (POSITIVE_TERMS[cleanWord]) {
      let weight = POSITIVE_TERMS[cleanWord];

      // Apply intensifiers from context window
      for (let j = Math.max(0, i - CONTEXT_WINDOW); j < i; j++) {
        const contextWord = words[j].replace(/[^\w]/g, "");
        const intensifier = INTENSIFIERS[contextWord as keyof typeof INTENSIFIERS];
        if (intensifier) {
          weight = Math.min(weight * intensifier, 1.0);
        }
      }

      // Check for negators (reverse sentiment)
      let hasNegator = false;
      for (let j = Math.max(0, i - CONTEXT_WINDOW); j < i; j++) {
        if (NEGATORS.has(words[j].replace(/[^\w]/g, ""))) {
          hasNegator = true;
          break;
        }
      }

      if (hasNegator) {
        weight = 1.0 - weight; // Flip to negative side
      }

      totalScore += weight;
      totalWeight += 1;
    }
    // Check for negative terms
    else if (NEGATIVE_TERMS[cleanWord]) {
      let weight = NEGATIVE_TERMS[cleanWord];

      // Apply intensifiers from context window
      for (let j = Math.max(0, i - CONTEXT_WINDOW); j < i; j++) {
        const contextWord = words[j].replace(/[^\w]/g, "");
        const intensifier = INTENSIFIERS[contextWord as keyof typeof INTENSIFIERS];
        if (intensifier) {
          weight = Math.min(weight * intensifier, 1.0);
        }
      }

      // Check for negators (reverse sentiment)
      let hasNegator = false;
      for (let j = Math.max(0, i - CONTEXT_WINDOW); j < i; j++) {
        if (NEGATORS.has(words[j].replace(/[^\w]/g, ""))) {
          hasNegator = true;
          break;
        }
      }

      const negativeScore = 1.0 - weight; // Flip to negative side (low score)
      if (hasNegator) {
        // Double negation: "not bad" → positive
        totalScore += 1.0 - negativeScore;
      } else {
        totalScore += negativeScore;
      }
      totalWeight += 1;
    }
  }

  // If no sentiment terms found, return neutral
  if (totalWeight === 0) {
    return 0.5;
  }

  const avgScore = totalScore / totalWeight;
  // Clamp to [0, 1]
  return Math.min(Math.max(avgScore, 0), 1);
}

/**
 * Classify sentiment as positive/neutral/negative
 */
export function classifySentiment(score: number): "positive" | "neutral" | "negative" {
  if (score < 0.4) return "negative";
  if (score > 0.6) return "positive";
  return "neutral";
}

/**
 * Get sentiment label with intensity
 */
export function getSentimentLabel(score: number): string {
  const classification = classifySentiment(score);

  if (classification === "positive") {
    if (score > 0.8) return "very positive";
    if (score > 0.65) return "positive";
    if (score > 0.55) return "slightly positive";
  } else if (classification === "negative") {
    if (score < 0.15) return "very negative";
    if (score < 0.3) return "negative";
    if (score < 0.45) return "slightly negative";
  }

  return "neutral";
}

/**
 * Sentiment analysis result
 */
export interface SentimentAnalysis {
  score: number;
  classification: "positive" | "neutral" | "negative";
  label: string;
  confidence: number; // 0-1, based on how many sentiment terms found
}

/**
 * Perform complete sentiment analysis
 */
export function analyzeSentiment(sentence: string): SentimentAnalysis {
  const words = sentence.toLowerCase().split(/\s+/);
  const sentimentTermCount = words.filter(w => {
    const clean = w.replace(/[^\w]/g, "");
    return POSITIVE_TERMS[clean] || NEGATIVE_TERMS[clean];
  }).length;

  const score = computeSentimentScore(sentence);
  const classification = classifySentiment(score);
  const label = getSentimentLabel(score);
  const confidence = Math.min(sentimentTermCount / Math.max(words.length, 1), 1);

  return {
    score,
    classification,
    label,
    confidence,
  };
}
