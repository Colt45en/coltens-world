import { describe, expect, it } from "vitest";
import {
    analyzeSentiment,
    classifySentiment,
    computeSentimentScore,
    getSentimentLabel,
} from "../src/nlp/sentiment-analyzer";

describe("Sentiment Analyzer", () => {
  describe("computeSentimentScore", () => {
    it("returns 0.5 for empty string", () => {
      const score = computeSentimentScore("");
      expect(score).toBe(0.5);
    });

    it("detects positive sentiment from positive words", () => {
      const score = computeSentimentScore("I love this amazing beautiful thing");
      expect(score).toBeGreaterThan(0.7);
    });

    it("detects negative sentiment from negative words", () => {
      const score = computeSentimentScore("I hate this terrible awful thing");
      expect(score).toBeLessThan(0.3);
    });

    it("returns neutral for words without sentiment", () => {
      const score = computeSentimentScore("the quick brown fox jumps");
      expect(score).toBeCloseTo(0.5, 1);
    });

    it("applies intensifier modifiers", () => {
      const basicScore = computeSentimentScore("I like this");
      const intensifiedScore = computeSentimentScore("I really like this");
      expect(intensifiedScore).toBeGreaterThan(basicScore);
    });

    it("handles negation correctly", () => {
      const positiveScore = computeSentimentScore("This is good");
      const negatedScore = computeSentimentScore("This is not good");
      expect(negatedScore).toBeLessThan(positiveScore);
    });

    it("handles double negation", () => {
      const score = computeSentimentScore("This is not bad");
      expect(score).toBeGreaterThan(0.5);
    });
  });

  describe("classifySentiment", () => {
    it("classifies low scores as negative", () => {
      expect(classifySentiment(0.2)).toBe("negative");
    });

    it("classifies middle scores as neutral", () => {
      expect(classifySentiment(0.5)).toBe("neutral");
    });

    it("classifies high scores as positive", () => {
      expect(classifySentiment(0.8)).toBe("positive");
    });

    it("uses 0.4 as negative threshold", () => {
      expect(classifySentiment(0.39)).toBe("negative");
      expect(classifySentiment(0.41)).toBe("neutral");
    });

    it("uses 0.6 as positive threshold", () => {
      expect(classifySentiment(0.59)).toBe("neutral");
      expect(classifySentiment(0.61)).toBe("positive");
    });
  });

  describe("getSentimentLabel", () => {
    it("labels very positive for high scores", () => {
      expect(getSentimentLabel(0.9)).toBe("very positive");
    });

    it("labels positive for moderate positive", () => {
      expect(getSentimentLabel(0.7)).toBe("positive");
    });

    it("labels slightly positive for low positive", () => {
      expect(getSentimentLabel(0.65)).toBe("slightly positive");
    });

    it("labels neutral for middle", () => {
      expect(getSentimentLabel(0.5)).toBe("neutral");
    });

    it("labels slightly negative for high negative", () => {
      expect(getSentimentLabel(0.35)).toBe("slightly negative");
    });

    it("labels negative for moderate negative", () => {
      expect(getSentimentLabel(0.2)).toBe("negative");
    });

    it("labels very negative for low scores", () => {
      expect(getSentimentLabel(0.1)).toBe("very negative");
    });
  });

  describe("analyzeSentiment", () => {
    it("returns complete sentiment analysis", () => {
      const result = analyzeSentiment("I absolutely love this beautiful day");

      expect(result).toHaveProperty("score");
      expect(result).toHaveProperty("classification");
      expect(result).toHaveProperty("label");
      expect(result).toHaveProperty("confidence");
      expect(result.score).toBeGreaterThan(0.5);
      expect(result.classification).toBe("positive");
    });

    it("computes confidence based on sentiment word density", () => {
      const lowConfidence = analyzeSentiment("the quick fox");
      const highConfidence = analyzeSentiment("I love beautiful amazing wonderful things");

      expect(highConfidence.confidence).toBeGreaterThan(lowConfidence.confidence);
    });

    it("handles real sentence examples", () => {
      const happy = analyzeSentiment("I am so happy and excited about this wonderful news!");
      const sad = analyzeSentiment("This is terrible and I feel awful and miserable");

      expect(happy.classification).toBe("positive");
      expect(sad.classification).toBe("negative");
    });
  });
});
