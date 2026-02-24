// sandbox.bus.connect.ts
import type { Bus, BusEnvelopeV1 } from "./bus";
import { createEnvelopeFactory } from "./bus";
import { ToolAllowlistIndex, validateToolInputOrThrow, ToolAllowlistSchema } from "./toolAllowlist.guard";

// Minimal event typing (matches sandbox.v2.ts events)
type SandboxEvent =
  | { type: "MUTATION"; tick: number; path: string; before: unknown; after: unknown; reason?: string; by?: string }
  | { type: "SNAPSHOT"; tick: number; name: string; note?: string; stateHash: string }
  | { type: "RESTORE"; tick: number; name: string; restoredHash: string }
  | { type: "DIFF"; tick: number; a: string; b: string; changedPaths: string[] }
  | { type: "TOOL_RUN"; tick: number; tool: string; input: unknown; reason?: string; by?: string }
  | { type: "TOOL_RESULT"; tick: number; tool: string; ok: boolean; result?: unknown; error?: string }
  | { type: "SCHEDULED"; tick: number; id: string; dueTick: number; label: string }
  | { type: "TICK"; tick: number }
  | { type: "ERROR"; tick: number; message: string; context?: Record<string, unknown> }
  | { type: "MUTATION_PROPOSED"; tick: number; decisionId: string; approval: "auto" | "human" | "blocked"; reasons: string[]; actions: unknown[] }
  | { type: "MUTATION_APPROVED"; tick: number; decisionId: string; approvedBy: string; approvalReason?: string }
  | { type: "MUTATION_REJECTED"; tick: number; decisionId: string; rejectedBy: string; rejectionReason: string }
  | { type: "MUTATION_APPLIED"; tick: number; decisionId: string; success: boolean; appliedActions: unknown[]; rollbackSnapshot?: string; error?: string };

type SandboxLike = {
  on(fn: (e: SandboxEvent) => void): () => void;
  runTool(name: string, input: unknown, meta?: { reason?: string; by?: string }): unknown;
};

function severityFor(e: SandboxEvent): BusEnvelopeV1["severity"] {
  switch (e.type) {
    case "ERROR":
      return "error";
    case "MUTATION_REJECTED":
      return "warn";
    case "MUTATION_APPLIED":
      return e.success ? "info" : "error";
    case "TOOL_RESULT":
      return e.ok ? "info" : "error";
    default:
      return "info";
  }
}

// Correlate TOOL_RUN -> TOOL_RESULT with a corrId + shared spanId
function makeToolCorr() {
  const stack = new Map<string, Array<{ corrId: string; spanId: string }>>();
  return {
    push(tool: string, corrId: string, spanId: string) {
      const arr = stack.get(tool) ?? [];
      arr.push({ corrId, spanId });
      stack.set(tool, arr);
    },
    pop(tool: string) {
      const arr = stack.get(tool) ?? [];
      const last = arr.pop();
      stack.set(tool, arr);
      return last;
    },
  };
}

export function connectSandboxToBus(opts: {
  sandbox: SandboxLike;
  bus: Bus;
  source: string;
  traceId: string;
  parentSpanId?: string;
}) {
  const makeEnvelope = createEnvelopeFactory({
    source: opts.source,
    traceId: opts.traceId,
    parentSpanId: opts.parentSpanId,
  });

  const corr = makeToolCorr();

  const unsub = opts.sandbox.on((e) => {
    const sev = severityFor(e);

    // Map sandbox event types -> bus types
    const type = `sandbox.${e.type.toLowerCase().replace(/_/g, ".")}`;

    // Special handling: correlate tool run/result
    if (e.type === "TOOL_RUN") {
      const spanId = `span_tool_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`; // lightweight
      const corrId = `corr_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
      corr.push(e.tool, corrId, spanId);

      opts.bus.emit(
        makeEnvelope("sandbox.tool.run", { ...e, corrId }, { severity: sev, spanId })
      );
      return;
    }

    if (e.type === "TOOL_RESULT") {
      const c = corr.pop(e.tool);
      opts.bus.emit(
        makeEnvelope(
          "sandbox.tool.result",
          { ...e, corrId: c?.corrId },
          { severity: sev, spanId: c?.spanId }
        )
      );
      return;
    }

    // Default event passthrough
    opts.bus.emit(makeEnvelope(type, e, { severity: sev }));
  });

  return { unsubscribe: unsub };
}

export function installToolAllowlistGuard(opts: {
  sandbox: SandboxLike;
  bus?: Bus;
  source?: string;
  traceId?: string;
  parentSpanId?: string;
  allowlistJson: unknown;
}) {
  const allowlist = ToolAllowlistSchema.parse(opts.allowlistJson);
  const index = new ToolAllowlistIndex(allowlist);

  const makeEnvelope =
    opts.bus && opts.source && opts.traceId
      ? createEnvelopeFactory({ source: opts.source, traceId: opts.traceId, parentSpanId: opts.parentSpanId })
      : null;

  const original = opts.sandbox.runTool.bind(opts.sandbox);

  // Monkey-patch: enforce allowlist + input typing before tool executes
  (opts.sandbox as any).runTool = (name: string, input: unknown, meta?: { reason?: string; by?: string }) => {
    try {
      validateToolInputOrThrow(index, name, input);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      // Emit a bus event for visibility (optional)
      if (opts.bus && makeEnvelope) {
        opts.bus.emit(
          makeEnvelope(
            "sandbox.tool.blocked",
            {
              tool: name,
              message,
              meta: meta ?? null,
            },
            { severity: "error" }
          )
        );
      }

      throw new Error(message);
    }

    return original(name, input, meta);
  };

  return {
    index,
    uninstall() {
      (opts.sandbox as any).runTool = original;
    },
  };
}
