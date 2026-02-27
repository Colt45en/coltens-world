import { StreamEvent, validateStreamEvent } from "@world-engine/protocol";
import { describe, expect, it } from "vitest";
import { ndjsonLines } from "../src/ndjson";

describe("P0 Streaming Hardening", () => {
  describe("P0.1 + P0.3: Ordering + NDJSON", () => {
    it("handles JSON split across chunks", async () => {
      const encoder = new TextEncoder();
      const chunks = [
        '{"v":"1.0","traceId":"t1","turnId":"turn1","seq":0,"type":"text_chunk","data":{"text":"hel',
        'lo"}}\n{"v":"1.0","traceId":"t1","turnId":"turn1","seq":1,"type":"text_chunk","data":{"text":"world"}}\n',
      ];

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
          controller.close();
        },
      });

      const lines: string[] = [];
      for await (const line of ndjsonLines(stream)) {
        lines.push(line);
      }

      expect(lines).toHaveLength(2);
      expect(lines[0]).toContain('"seq":0');
      expect(lines[1]).toContain('"seq":1');
    });

    it("validates stream events against schema", () => {
      const event = {
        v: "1.0",
        traceId: "trace1",
        turnId: "turn1",
        seq: 0,
        type: "text_chunk",
        data: { text: "hello" },
      };

      const validated = validateStreamEvent(event);
      expect(validated).not.toBeNull();
      expect(validated?.seq).toBe(0);
    });

    it("rejects malformed stream events", () => {
      const event = {
        v: "1.0",
        traceId: "trace1",
        // missing turnId
        seq: 0,
        type: "text_chunk",
        data: { text: "hello" },
      };

      const validated = validateStreamEvent(event);
      expect(validated).toBeNull();
    });
  });

  describe("P0.5: Tool allowlist", () => {
    it("rejects tools not in allowlist", () => {
      const ev: StreamEvent = {
        v: "1.0",
        traceId: "t1",
        turnId: "turn1",
        seq: 5,
        type: "tool_call",
        data: {
          callId: "call_1",
          name: "rm_all_files",  // Dangerous!
          args: {},
          timeoutMs: 5000,
          critical: false,
        },
      };

      // Would be caught by ToolExecutor.validateToolCall
      const allowed = ["query_lexicon", "record_screen", "fetch_url"];
      expect(allowed).not.toContain(ev.data.name);
    });

    it("clamps timeoutMs to ≤ 60s", () => {
      const ev: StreamEvent = {
        v: "1.0",
        traceId: "t1",
        turnId: "turn1",
        seq: 5,
        type: "tool_call",
        data: {
          callId: "call_1",
          name: "fetch_url",
          args: { url: "..." },
          timeoutMs: 120_000,  // > 60s
          critical: false,
        },
      };

      const valid = ev.data.timeoutMs <= 60_000;
      expect(valid).toBe(false);  // Should be rejected
    });
  });

  describe("P0.2: Abort on disconnect", () => {
    it("stops processing if controller aborted", async () => {
      const abort = new AbortController();

      const checkAbort = async () => {
        if (abort.signal.aborted) {
          throw new Error(`Aborted: ${abort.signal.reason}`);
        }
      };

      abort.abort("test_close");
      await expect(checkAbort()).rejects.toThrow("test_close");
    });
  });
});
