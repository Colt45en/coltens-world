import { validateNucleusQuery } from "@world-engine/nucleus-contracts";
import type { ClarifyPlan, MemoryItem, NucleusQuery, NucleusResponse, RetrievePlan, ToolPlan } from "@world-engine/nucleus-contracts";

import { assertApproved } from "./memory/memory.js";
import { approveMemory, proposeMemory } from "./memory/approvals.js";
import { FsMemoryStore } from "./memory/store_fs.js";
import { route } from "./router/router.js";
import { loadAllowlistFromJson } from "./tools/allowlist.js";
import { runAllowlistedTool } from "./tools/runner.js";

export type NucleusDeps = {
  nowUtcIso: () => string;
  memoryRootDir: string;
  toolAllowlistJson: unknown;
  retrieve: (query: string, topK: number) => Promise<{ answer: string; citations: NucleusResponse["citations"]; trace?: NucleusResponse["trace"] }>;
};

export function createNucleus(deps: NucleusDeps) {
  const store = new FsMemoryStore({ rootDir: deps.memoryRootDir });
  const allowlist = loadAllowlistFromJson(deps.toolAllowlistJson);
  const scoreSummary = (scores: { intent: string; score: number }[]): string => scores.map((s) => `${s.intent}=${s.score}`).join(", ");

  return {
    async handle(input: unknown): Promise<NucleusResponse> {
      const v = validateNucleusQuery(input);
      if (!v.ok) {
        return {
          version: "nucleus.response.v1",
          query_id: "invalid" as NucleusQuery["query_id"],
          timestamp_utc: deps.nowUtcIso(),
          intent: "clarify",
          answer_text: "Invalid query payload. Fix schema and retry.",
          trace: v.errors.map((e, i) => ({ step: i + 1, label: "validation_error", detail: `${e.path}: ${e.message}` }))
        };
      }

      const q = v.value;
      const ts = deps.nowUtcIso();

      const { intent, plan, scores } = route(q);

      if (intent === "clarify") {
        const clarifyPlan = plan as ClarifyPlan;
        return {
          version: "nucleus.response.v1",
          query_id: q.query_id,
          timestamp_utc: ts,
          intent,
          answer_text: clarifyPlan.question,
          trace: [
            { step: 1, label: "router", detail: `Intent scoring: ${scoreSummary(scores)}` }
          ],
          plan: clarifyPlan
        };
      }

      if (intent === "retrieve") {
        const retrievePlan = plan as RetrievePlan;
        const res = await deps.retrieve(retrievePlan.query, retrievePlan.top_k);
        const response: NucleusResponse = {
          version: "nucleus.response.v1",
          query_id: q.query_id,
          timestamp_utc: ts,
          intent,
          answer_text: res.answer,
          plan: retrievePlan
        };
        if (res.citations) response.citations = res.citations;
        if (res.trace) response.trace = res.trace;
        return response;
      }

      if (intent === "memory") {
        const proposal = proposeMemory({
          statement: q.query_text,
          kind: "decision",
          evidence_refs: [],
          confidence: 0.6,
          created_at_utc: q.timestamp_utc
        });

        return {
          version: "nucleus.response.v1",
          query_id: q.query_id,
          timestamp_utc: ts,
          intent,
          answer_text: "Proposed a memory item. Approve to commit, or reject to discard.",
          plan,
          memory: {
            proposed: proposal.proposed,
            approval_required: true
          },
          trace: [
            { step: 1, label: "router", detail: `Intent scoring: ${scoreSummary(scores)}` },
            { step: 2, label: "memory_gate", detail: "Memory is not written until approved_by_user=true." }
          ]
        };
      }

      const allowTools = q.constraints?.allow_tools ?? true;
      if (!allowTools) {
        return {
          version: "nucleus.response.v1",
          query_id: q.query_id,
          timestamp_utc: ts,
          intent: "clarify",
          answer_text: "Tools are disabled by constraints. Ask for retrieval-only or enable tools.",
          trace: [{ step: 1, label: "tool_gate", detail: "allow_tools=false" }]
        };
      }

      const m = q.query_text.match(/\btool:([a-zA-Z0-9_.-]+)\b/);
      if (!m) {
        return {
          version: "nucleus.response.v1",
          query_id: q.query_id,
          timestamp_utc: ts,
          intent: "clarify",
          answer_text: "To run a tool safely, specify it explicitly like `tool:repo.typecheck` (dry-run by default).",
          trace: [{ step: 1, label: "tool_select", detail: "No explicit tool_id found in query." }],
          plan
        };
      }

      const tool_id = m[1]!;
      const toolPlan = plan as ToolPlan;
      const toolRes = await runAllowlistedTool({
        allowlist,
        tool_id,
        args: {},
        timestamp_utc: ts,
        dry_run: true
      });

      return {
        version: "nucleus.response.v1",
        query_id: q.query_id,
        timestamp_utc: ts,
        intent: "tool",
        answer_text: `Tool matched: ${toolRes.tool.title}\nDry-run preview only. Flip dry_run=false to execute.`,
        plan: { ...toolPlan, tool_id, dry_run: true },
        tool_run: {
          tool_run_id: toolRes.tool_run_id as NucleusResponse["tool_run"] extends { tool_run_id: infer T } ? T : never,
          tool_id,
          status: "skipped",
          stdout: toolRes.stdout,
          stderr: toolRes.stderr,
          exit_code: toolRes.exit_code,
          duration_ms: toolRes.duration_ms
        },
        trace: [
          { step: 1, label: "router", detail: `Intent scoring: ${scoreSummary(scores)}` },
          { step: 2, label: "allowlist", detail: `Tool exists in allowlist: ${toolRes.tool.tool_id}` },
          { step: 3, label: "dry_run", detail: `cmd=${toolRes.command_preview.cmd} args=[${toolRes.command_preview.args.join(" ")}]` }
        ]
      };
    },

    approveAndCommitMemory(item: MemoryItem, approvedAtUtc: string): MemoryItem {
      const approved = approveMemory(item, approvedAtUtc);
      assertApproved(approved);
      store.put(approved);
      return approved;
    },

    listMemory(limit = 50): MemoryItem[] {
      return store.list(limit);
    }
  };
}
