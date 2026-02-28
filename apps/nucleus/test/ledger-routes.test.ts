import { LedgerStreamQuerySchema } from "@world-engine/engine";
import { describe, expect, it } from "vitest";

describe("Ledger Artifact Routes", () => {
  describe("LedgerStreamQuery schema", () => {
    it("accepts valid query parameters", () => {
      const query = { after_seq: "0", limit: "100" };
      const parsed = LedgerStreamQuerySchema.safeParse(query);

      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.after_seq).toBe(0);
        expect(parsed.data.limit).toBe(100);
      }
    });

    it("coerces string to number for after_seq", () => {
      const query = { after_seq: "42" };
      const parsed = LedgerStreamQuerySchema.safeParse(query);

      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.after_seq).toBe(42);
        expect(typeof parsed.data.after_seq).toBe("number");
      }
    });

    it("provides default after_seq=0 when omitted", () => {
      const query = { limit: "50" };
      const parsed = LedgerStreamQuerySchema.safeParse(query);

      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.after_seq).toBe(0);
      }
    });

it("provides default limit=200 when omitted", () => {
      const query = { after_seq: "10" };
      const parsed = LedgerStreamQuerySchema.safeParse(query);

      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.limit).toBe(200);
      }
    });

    it("provides both defaults when query is empty", () => {
      const query = {};
      const parsed = LedgerStreamQuerySchema.safeParse(query);

      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.after_seq).toBe(0);
        expect(parsed.data.limit).toBe(200);
      }
    });

    it("rejects invalid number strings", () => {
      const query = { after_seq: "not-a-number" };
      const parsed = LedgerStreamQuerySchema.safeParse(query);

      expect(parsed.success).toBe(false);
    });
  });
});
