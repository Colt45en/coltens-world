import { describe, expect, it } from "vitest";
import {
    analyzeLinguisticStructure,
    getSentenceComplexity,
    isComplexSentence,
} from "../src/nlp/linguistic-parser";

describe("Linguistic Parser", () => {
  describe("analyzeLinguisticStructure", () => {
    it("identifies basic sentence structure", () => {
      const structure = analyzeLinguisticStructure("The cat sat.");

      expect(structure).toHaveProperty("sentenceType");
      expect(structure).toHaveProperty("subject");
      expect(structure).toHaveProperty("predicate");
      expect(structure).toHaveProperty("posTags");
      expect(structure).toHaveProperty("wordCount");
      expect(structure).toHaveProperty("clauseCount");
    });

    it("detects statement sentences (period)", () => {
      const structure = analyzeLinguisticStructure("The cat sat down.");
      expect(structure.sentenceType).toBe("statement");
    });

    it("detects question sentences (question mark)", () => {
      const structure = analyzeLinguisticStructure("Did the cat sit?");
      expect(structure.sentenceType).toBe("question");
    });

    it("detects exclamation sentences (exclamation mark)", () => {
      const structure = analyzeLinguisticStructure("The cat sat down!");
      expect(structure.sentenceType).toBe("exclamation");
    });

    it("extracts subject from sentence", () => {
      const structure = analyzeLinguisticStructure("The beautiful cat sat down");
      expect(structure.subject).toBeTruthy();
      expect(structure.subject?.toLowerCase()).toContain("cat");
    });

    it("extracts predicate from sentence", () => {
      const structure = analyzeLinguisticStructure("The cat sat down quickly");
      expect(structure.predicate).toBeTruthy();
      expect(structure.predicate?.toLowerCase()).toContain("sat");
    });

    it("counts words correctly", () => {
      const structure = analyzeLinguisticStructure("The quick brown fox");
      expect(structure.wordCount).toBe(4);
    });

    it("detects single clause sentences", () => {
      const structure = analyzeLinguisticStructure("The cat sat down");
      expect(structure.clauseCount).toBe(1);
    });

    it("detects multiple clauses with conjunctions", () => {
      const structure = analyzeLinguisticStructure("The cat sat and the dog jumped");
      expect(structure.clauseCount).toBeGreaterThan(1);
    });

    it("assigns POS tags to words", () => {
      const structure = analyzeLinguisticStructure("The cat sits");
      expect(structure.posTags).toHaveProperty("the");
      expect(structure.posTags).toHaveProperty("cat");
      expect(structure.posTags).toHaveProperty("sits");
    });
  });

  describe("getSentenceComplexity", () => {
    it("identifies simple sentences (single clause)", () => {
      const complexity = getSentenceComplexity("The cat sat down");
      expect(complexity).toBe("simple");
    });

    it("identifies compound sentences (two clauses)", () => {
      const complexity = getSentenceComplexity("The cat sat and the dog ran");
      expect(complexity).toBe("compound");
    });

    it("identifies complex sentences (three or more clauses)", () => {
      const complexity = getSentenceComplexity("The cat sat and the dog ran while the bird flew");
      expect(complexity).toBe("complex");
    });

    it("handles sentences with multiple conjunctions", () => {
      const complexity = getSentenceComplexity(
        "The cat sat and the dog ran but the bird flew and the fish swam"
      );
      expect(complexity).toBe("complex");
    });
  });

  describe("isComplexSentence", () => {
    it("returns false for simple sentences", () => {
      expect(isComplexSentence("The cat sat")).toBe(false);
    });

    it("returns true for compound sentences", () => {
      expect(isComplexSentence("The cat sat and the dog ran")).toBe(true);
    });

    it("returns true for sentences with many clauses", () => {
      expect(isComplexSentence("The cat sat and dog ran and bird flew")).toBe(true);
    });
  });

  describe("real world examples", () => {
    it("handles declarative sentences", () => {
      const structure = analyzeLinguisticStructure("The weather is beautiful today");
      expect(structure.sentenceType).toBe("statement");
      expect(structure.wordCount).toBe(5);
    });

    it("handles interrogative sentences", () => {
      const structure = analyzeLinguisticStructure("What time is it?");
      expect(structure.sentenceType).toBe("question");
    });

    it("handles exclamatory sentences", () => {
      const structure = analyzeLinguisticStructure("What a beautiful day!");
      expect(structure.sentenceType).toBe("exclamation");
    });

    it("handles complex real sentence", () => {
      const structure = analyzeLinguisticStructure(
        "The quick brown fox jumped over the lazy dog and ran away"
      );
      expect(structure.wordCount).toBeGreaterThan(8);
      expect(structure.clauseCount).toBeGreaterThan(1);
    });

    it("normalizes case insensitively", () => {
      const structure = analyzeLinguisticStructure("THE CAT SAT DOWN");
      expect(structure.wordCount).toBe(4);
      expect(structure.subject).toBeTruthy();
    });
  });
});
