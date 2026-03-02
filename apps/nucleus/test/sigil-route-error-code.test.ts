import { handleToolExecuteSigilCompileV1 } from "@world-engine/engine";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { routeToolSigilCompileV1 } from "../src/routes/tools/sigil.compile.v1";

vi.mock("@world-engine/engine", async () => {
  const { z } = await import("zod");

  const HEX8_OR_64 = /^(?:[0-9a-f]{8}|[0-9a-f]{64})$/i;
  const HEX_COLOR = /^#[0-9a-f]{6}$/i;

  const SigilProgramV1 = z
    .object({
      kind: z.literal("sigil.program"),
      v: z.literal(1),
      roles: z
        .object({
          prefixes: z.array(z.string()),
          roots: z.array(z.string()),
          suffixes: z.array(z.string()),
        })
        .strict(),
      ops: z
        .object({
          link: z.boolean(),
          flow: z.boolean(),
          fuse: z.boolean(),
        })
        .strict(),
      style: z
        .object({
          size: z.number().int().min(200).max(1200),
          pad: z.number().int().min(0).max(200),
          stroke: z.number().min(0.5).max(20),
          fg: z.string().regex(HEX_COLOR),
        })
        .strict(),
      symmetry: z.number().int().min(3).max(24).nullable(),
      seed_hex: z.string().regex(HEX8_OR_64).nullable(),
    })
    .strict();

  const ToolExecuteV1 = z
    .object({
      kind: z.literal("tool.execute"),
      v: z.literal(1),
      tool: z.string(),
      input: z.unknown(),
      request_id: z.string().min(1).max(200).optional(),
    })
    .strict();

  const SigilCompileToolExecuteV1 = ToolExecuteV1.extend({
    tool: z.literal("sigil.compile.v1"),
    input: z
      .object({
        program: SigilProgramV1,
        outputs: z
          .object({
            svg: z.boolean(),
            recipe: z.boolean(),
            ledger_ndjson: z.boolean(),
          })
          .strict()
          .optional(),
      })
      .strict(),
  }).strict();

  const sha256Hex = (s: string): string => {
    return "h".repeat(64 - Math.min(63, s.length)) + String(Math.min(63, s.length));
  };

  return {
    ToolExecuteV1,
    SigilCompileToolExecuteV1,
    normalizeProgramV1: (p: unknown) => p,
    stableStringify: (x: unknown) => JSON.stringify(x),
    sha256Hex,
    handleToolExecuteSigilCompileV1: vi.fn(),
  };
});

const mockedHandleToolExecuteSigilCompileV1 = vi.mocked(handleToolExecuteSigilCompileV1);

function buildSigilToolExecuteRequestBody() {
  return {
    kind: "tool.execute",
    v: 1,
    tool: "sigil.compile.v1",
    request_id: "sigil-test-0001",
    input: {
      program: {
        kind: "sigil.program",
        v: 1,
        roles: { prefixes: ["re"], roots: ["struct"], suffixes: ["ion"] },
        ops: { link: false, flow: true, fuse: false },
        style: { size: 600, pad: 40, stroke: 5.5, fg: "#0ea5e9" },
        symmetry: 9,
        seed_hex: "a1b2c3d4",
      },
      outputs: { svg: false, recipe: false, ledger_ndjson: false },
    },
  };
}

describe("sigil.compile.v1 route failed-event behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("emits failed ledger payload with top-level error_code matching nested error.code", async () => {
    mockedHandleToolExecuteSigilCompileV1.mockRejectedValueOnce(new Error("compiler exploded"));

    const append = vi.fn().mockResolvedValue({ seq: 1, entry_hash: "x" });
    const ledger = { append } as any;

    const req = new Request("http://localhost/tools/sigil.compile.v1", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildSigilToolExecuteRequestBody()),
    });

    const res = await routeToolSigilCompileV1(req, ledger);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("TOOL_FAILED");

    expect(append).toHaveBeenCalledTimes(1);
    const appended = append.mock.calls[0][0];
    expect(appended.type).toBe("sigil.compile.failed");
    expect(appended.payload.error_code).toBe("TOOL_FAILED");
    expect(appended.payload.error.code).toBe("TOOL_FAILED");
    expect(appended.payload.error_code).toBe(appended.payload.error.code);
  });

  it("returns original tool failure response even when ledger append fails", async () => {
    mockedHandleToolExecuteSigilCompileV1.mockRejectedValueOnce(new Error("compiler exploded"));

    const append = vi.fn().mockRejectedValue(new Error("ledger unavailable"));
    const ledger = { append } as any;

    const req = new Request("http://localhost/tools/sigil.compile.v1", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildSigilToolExecuteRequestBody()),
    });

    const res = await routeToolSigilCompileV1(req, ledger);
    const json = await res.json();

    expect(append).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(400);
    expect(json.kind).toBe("tool.result");
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("TOOL_FAILED");
    expect(json.error.message).toContain("compiler exploded");
  });
});
