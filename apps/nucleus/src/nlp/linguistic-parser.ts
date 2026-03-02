/**
 * Deterministic Linguistic Parser
 *
 * Analyzes sentence structure without external grammar databases.
 * Focuses on identifying:
 * - Parts of speech (noun, verb, adjective, etc.)
 * - Sentence type (statement, question, exclamation, etc.)
 * - Subject and predicate
 */

const DETERMINERS = new Set(["the", "a", "an", "this", "that", "these", "those", "my", "your", "his", "her", "its", "our", "their"]);

const COMMON_VERBS = new Set(["is", "are", "am", "was", "were", "be", "being", "been", "have", "has", "had", "do", "does", "did", "will", "would", "could", "can", "should", "may", "might", "must", "shall", "go", "goes", "went", "come", "comes", "came", "get", "gets", "got", "make", "makes", "made", "take", "takes", "took", "see", "sees", "saw", "know", "knows", "knew", "find", "finds", "found", "need", "needs", "needed", "want", "wants", "wanted", "give", "gives", "gave", "use", "uses", "used", "tell", "tells", "told", "think", "thinks", "thought", "feel", "feels", "felt", "become", "becomes", "became", "leave", "leaves", "left", "put", "puts", "turn", "turns", "turned", "start", "starts", "started", "sit", "sits", "sat", "stand", "stands", "stood", "say", "says", "said", "mean", "means", "meant", "run", "runs", "ran", "work", "works", "worked", "call", "calls", "called", "try", "tries", "tried", "ask", "asks", "asked", "show", "shows", "showed", "play", "plays", "played"]);

const COMMON_ADJECTIVES = new Set(["good", "bad", "big", "small", "new", "old", "first", "last", "long", "short", "high", "low", "same", "different", "other", "little", "large", "own", "right", "wrong", "true", "false", "real", "false", "possible", "impossible", "sure", "certain", "uncertain", "clear", "unclear", "bright", "dark", "light", "heavy", "strong", "weak", "fast", "slow", "quick", "quiet", "loud", "soft", "hard", "easy", "difficult", "simple", "complex", "rude", "polite", "kind", "cruel", "happy", "sad", "angry", "calm", "beautiful", "ugly", "clean", "dirty", "wet", "dry", "hot", "cold", "warm", "cool"]);

const PREPOSITIONS = new Set(["in", "on", "at", "by", "with", "from", "to", "for", "of", "as", "about", "through", "during", "before", "after", "above", "below", "under", "between", "among", "behind", "across", "along", "around", "against", "despite", "toward", "into", "onto", "up", "down", "out", "off"]);

const CONJUNCTIONS = new Set(["and", "or", "but", "nor", "yet", "so", "because", "if", "unless", "while", "when", "where", "why", "how", "that"]);

/**
 * Simple part-of-speech tagging (deterministic)
 */
function tagPartOfSpeech(word: string): string {
  const clean = word.toLowerCase().replace(/[^\w]/g, "");

  if (DETERMINERS.has(clean)) return "DET";
  if (COMMON_VERBS.has(clean)) return "VERB";
  if (COMMON_ADJECTIVES.has(clean)) return "ADJ";
  if (PREPOSITIONS.has(clean)) return "PREP";
  if (CONJUNCTIONS.has(clean)) return "CONJ";

  // Heuristic: words ending in -ing are verbs
  if (clean.endsWith("ing")) return "VERB";

  // Heuristic: words ending in -ed are verbs/adjectives
  if (clean.endsWith("ed")) return "VERB";

  // Heuristic: words ending in -ly are adverbs
  if (clean.endsWith("ly")) return "ADV";

  // Default: assume noun (most common)
  return "NOUN";
}

/**
 * Identify sentence type from punctuation
 */
function identifySentenceType(sentence: string): "statement" | "question" | "exclamation" | "unknown" {
  const trimmed = sentence.trim();
  const lastChar = trimmed[trimmed.length - 1];

  if (lastChar === "?") return "question";
  if (lastChar === "!") return "exclamation";
  if (lastChar === ".") return "statement";

  // Default to statement for sentences without punctuation
  return "statement";
}

/**
 * Extract potential subjects (first noun phrase)
 */
function extractSubject(words: string[]): string {
  const tags = words.map(tagPartOfSpeech);

  // Find first DET + ADJ/NOUN or just NOUN sequence
  for (let i = 0; i < tags.length; i++) {
    if (tags[i] === "NOUN") {
      let subject = words[i];

      // Look back for determiners/adjectives
      if (i > 0 && (tags[i - 1] === "DET" || tags[i - 1] === "ADJ")) {
        subject = words[i - 1] + " " + subject;
      }

      return subject;
    }
  }

  return "";
}

/**
 * Extract potential predicates (verb + object)
 */
function extractPredicate(words: string[]): string {
  const tags = words.map(tagPartOfSpeech);

  // Find first verb and collect until next sentence boundary
  for (let i = 0; i < tags.length; i++) {
    if (tags[i] === "VERB") {
      const predicate = words.slice(i).join(" ");
      return predicate;
    }
  }

  return "";
}

/**
 * Linguistic structure result
 */
export interface LinguisticStructure {
  sentenceType: "statement" | "question" | "exclamation" | "unknown";
  subject: string;
  predicate: string;
  posTags: Record<string, string>;
  wordCount: number;
  clauseCount: number;
}

/**
 * Perform linguistic analysis
 */
export function analyzeLinguisticStructure(sentence: string): LinguisticStructure {
  const words = sentence.split(/\s+/).filter(w => w.length > 0);
  const sentenceType = identifySentenceType(sentence);
  const subject = extractSubject(words);
  const predicate = extractPredicate(words);

  // Create posTags as a dictionary
  const posTags: Record<string, string> = {};
  words.forEach(word => {
    const cleanWord = word.toLowerCase().replace(/[^\w]/g, "");
    posTags[cleanWord] = tagPartOfSpeech(word);
  });

  // Estimate clause count: number of conjunctions + 1
  const clauseCount = words.filter(w => CONJUNCTIONS.has(w.toLowerCase().replace(/[^\w]/g, ""))).length + 1;

  return {
    sentenceType,
    subject,
    predicate,
    posTags,
    wordCount: words.length,
    clauseCount,
  };
}

/**
 * Check if sentence is complex (has multiple clauses)
 */
export function isComplexSentence(sentence: string): boolean {
  const analysis = analyzeLinguisticStructure(sentence);
  return analysis.clauseCount > 1;
}

/**
 * Get sentence complexity label
 */
export function getSentenceComplexity(sentence: string): "simple" | "compound" | "complex" {
  const analysis = analyzeLinguisticStructure(sentence);

  if (analysis.clauseCount <= 1) return "simple";
  if (analysis.clauseCount === 2) return "compound";
  return "complex";
}
