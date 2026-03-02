/**
 * Natural Language Processing Module for Nucleus
 *
 * Provides deterministic text analysis capabilities:
 * - Sentiment analysis (lexicon-based)
 * - Linguistic parsing (structure analysis)
 * - Semantic extraction (in progress)
 */

export {
    analyzeSentiment,
    classifySentiment,
    computeSentimentScore,
    getSentimentLabel,
    type SentimentAnalysis
} from "./sentiment-analyzer";

export {
    analyzeLinguisticStructure,
    getSentenceComplexity,
    isComplexSentence,
    type LinguisticStructure
} from "./linguistic-parser";
