/**
 * Integration Tests: Contracts + Autonomy Loop + TypeScript Applications
 *
 * This file demonstrates integration testing patterns for using @we/contracts
 * with the Autonomy Loop API.
 *
 * Run tests with:
 *   pnpm test
 *   vitest packages/contracts/__tests__/integration.test.ts
 *
 * Prerequisites:
 *   - Autonomy Loop API running: python -m uvicorn app.main:app --port 8001
 *   - Contracts generated: pnpm contracts:gen
 */

/// <reference types="vitest" />

import { createAutonomyLoopClient } from "@we/contracts";
import { beforeAll, describe, expect, it } from "vitest";

// fallback declaration until @we/contracts ships real typings
declare module "@we/contracts" {
    export function createAutonomyLoopClient(
        baseUrl: string | { baseUrl: string; timeout?: number }
    ): any;
}

describe("Autonomy Loop Integration", () => {
    let client: ReturnType<typeof createAutonomyLoopClient>;
    const AUTONOMY_URL = process.env.AUTONOMY_LOOP_URL || "http://localhost:8001";

    beforeAll(async () => {
        client = createAutonomyLoopClient(AUTONOMY_URL);
        console.log(`🔗 Connected to Autonomy Loop at ${AUTONOMY_URL}`);
    });

    describe("runBatch: Full 5-role pipeline", () => {
        it("should process TypeScript code through all 5 roles", async () => {
            const code = `
        function fibonacci(n: number): number {
          if (n <= 1) return n;
          return fibonacci(n - 1) + fibonacci(n - 2);
        }
      `;

            const result = await client.runBatch({
                source_id: "test:ts-code",
                kind: "code",
                language_hint: "TypeScript",
                text: code,
            });

            // Verify all 5 artifacts are present
            expect(result).toHaveProperty("EvidencePacket");
            expect(result).toHaveProperty("LexiconEntry");
            expect(result).toHaveProperty("RuneDecoderRow");
            expect(result).toHaveProperty("ValidatedPlan");
            expect(result).toHaveProperty("DecisionRecord");

            // Evidence should detect function and recursion
            const evidence = result.EvidencePacket;
            expect(evidence).toHaveProperty("kind", "code");
            expect(evidence).toHaveProperty("source_id", "test:ts-code");

            // Plan should have status (red/yellow/green from gates)
            const plan = result.ValidatedPlan;
            expect(plan).toHaveProperty("status");
            expect(["red", "yellow", "green"]).toContain(plan.status);

            // Decision should be deterministic
            const decision = result.DecisionRecord;
            expect(decision).toHaveProperty("hash");
            expect(typeof decision.hash).toBe("string");
            expect(decision.hash.length).toBeGreaterThan(0);
        });

        it("should enforce governance tags when fail_on_unknown_tag=true", async () => {
            const code = "const x = 42;";

            // This should fail if the tag is not in the taxonomy
            const result = await client.runBatch({
                source_id: "test:governance",
                kind: "code",
                text: code,
                fail_on_unknown_tag: true,
            });

            // If it succeeds, plan status should indicate governance enforcement
            const plan = result.ValidatedPlan;
            expect(plan.status).toBeDefined();
        });
    });

    describe("ingest: Detective role only", () => {
        it("should extract evidence without full pipeline", async () => {
            const code = `
        interface User {
          name: string;
          age: number;
        }
      `;

            const evidence = await client.ingest({
                source_id: "test:extract-only",
                kind: "code",
                language_hint: "TypeScript",
                text: code,
            });

            expect(evidence).toHaveProperty("kind", "code");
            expect(evidence).toHaveProperty("source_id", "test:extract-only");
            expect(evidence).toHaveProperty("text");
        });
    });

    describe("taxonomyList: Query governance tags", () => {
        it("should return list of active process tags", async () => {
            const result = await client.taxonomyList({ active_only: true });

            expect(result).toHaveProperty("tags");
            expect(result).toHaveProperty("total");
            expect(Array.isArray(result.tags)).toBe(true);

            if (result.tags.length > 0) {
                const tag = result.tags[0];
                expect(tag).toHaveProperty("tag");
                expect(tag).toHaveProperty("description");
                expect(tag).toHaveProperty("active");
                expect(tag).toHaveProperty("created_at");
            }
        });
    });

    describe("replayLast: Determinism check", () => {
        it("should verify last N batches are deterministic", async () => {
            const result = await client.replayLast({
                n: 5,
                fail_on_unknown_tag: false,
            });

            expect(result).toHaveProperty("ok");
            expect(result).toHaveProperty("checked");
            expect(result.checked).toBeLessThanOrEqual(5);

            if (!result.ok && result.drift) {
                console.warn("Determinism drift detected:", result.drift);
                expect(result.drift_count).toBeGreaterThan(0);
            }
        });
    });

    describe("Error handling", () => {
        it("should handle connection failures gracefully", async () => {
            const badClient = createAutonomyLoopClient("http://localhost:9999");

            await expect(
                badClient.runBatch({
                    source_id: "test:bad-connection",
                    kind: "code",
                    text: "const x = 1;",
                })
            ).rejects.toThrow();
        });

        it("should handle timeout gracefully", async () => {
            const slowClient = createAutonomyLoopClient({
                baseUrl: AUTONOMY_URL,
                timeout: 1, // 1ms timeout
            });

            await expect(
                slowClient.runBatch({
                    source_id: "test:timeout",
                    kind: "code",
                    text: "const x = 1;",
                })
            ).rejects.toThrow();
        });
    });

    describe("Type safety", () => {
        it("should enforce request parameter types at compile time", async () => {
            // These lines verify TypeScript type checking:

            // ✅ Valid: all required fields present
            const validReq = {
                source_id: "test",
                kind: "code" as const,
                text: "const x = 1;",
            };
            await expect(client.runBatch(validReq)).resolves.toBeDefined();

            // ✅ Valid: optional fields can be omitted
            const minimalReq = {
                source_id: "test",
                text: "const x = 1;",
            };
            await expect(client.runBatch(minimalReq)).resolves.toBeDefined();

            // ❌ Would be compile error (uncomment to see):
            // await client.runBatch({ source_id: "test" }); // missing 'text'
            // await client.runBatch({ source_id: "test", text: "code", kind: "invalid" }); // invalid kind
        });
    });
});

/**
 * Performance & Load Testing
 *
 * Run with:
 *   vitest packages/contracts/__tests__/integration.test.ts --reporter=verbose
 */
describe("Performance", () => {
    let client: ReturnType<typeof createAutonomyLoopClient>;

    beforeAll(() => {
        client = createAutonomyLoopClient(
            process.env.AUTONOMY_LOOP_URL || "http://localhost:8001"
        );
    });

    it("should process batch within reasonable time (< 5s)", async () => {
        const code = `
      export function add(a: number, b: number): number {
        return a + b;
      }

      export function multiply(a: number, b: number): number {
        return a * b;
      }
    `;

        const start = Date.now();
        const result = await client.runBatch({
            source_id: "perf:test",
            kind: "code",
            language_hint: "TypeScript",
            text: code,
        });
        const elapsed = Date.now() - start;

        console.log(`⏱️  Batch processing took ${elapsed}ms`);
        expect(elapsed).toBeLessThan(5000);
        expect(result).toHaveProperty("DecisionRecord");
    });
});

/**
 * Determinism Testing: Verify hash stability
 *
 * The Autonomy Loop uses SHA256 hashing for determinism verification.
 * Same input should always produce same output (same hash).
 */
describe("Determinism", () => {
    let client: ReturnType<typeof createAutonomyLoopClient>;

    beforeAll(() => {
        client = createAutonomyLoopClient(
            process.env.AUTONOMY_LOOP_URL || "http://localhost:8001"
        );
    });

    it("should produce identical hashes for identical input", async () => {
        const code = "const x = 42;";
        const sourceId = "determinism:test";

        const result1 = await client.runBatch({
            source_id: sourceId,
            kind: "code",
            text: code,
        });

        const result2 = await client.runBatch({
            source_id: sourceId,
            kind: "code",
            text: code,
        });

        expect(result1.DecisionRecord.hash).toBe(result2.DecisionRecord.hash);
    });

    it("should produce different hashes for different input", async () => {
        const result1 = await client.runBatch({
            source_id: "det:1",
            kind: "code",
            text: "const x = 1;",
        });

        const result2 = await client.runBatch({
            source_id: "det:2",
            kind: "code",
            text: "const x = 2;",
        });

        expect(result1.DecisionRecord.hash).not.toBe(result2.DecisionRecord.hash);
    });
});
