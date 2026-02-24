import type { DocId, MemoryId, QueryId, ToolRunId } from "./ids.js";

export type IsoUtc = string;

export type SourceType = "lexicon" | "doc" | "code" | "log" | "memory";
export type MemoryKind = "fact" | "decision" | "preference" | "pattern" | "todo";

export type RouterIntent = "retrieve" | "tool" | "memory" | "clarify";

export type NucleusQuery = {
  version: "nucleus.query.v1";
  query_id: QueryId;
  user_id: string;
  timestamp_utc: IsoUtc;
  query_text: string;
  context_refs?: DocId[];
  constraints?: {
    max_latency_ms?: number;
    allow_tools?: boolean;
    allow_memory_write?: boolean;
    require_citations?: boolean;
  };
};

export type RetrievedDoc = {
  doc_id: DocId;
  source_type: SourceType;
  source_ref: string;
  title?: string;
  text_body: string;
  tags?: string[];
  created_at_utc?: IsoUtc;
  updated_at_utc?: IsoUtc;
  commit_hash?: string;
};

export type EvidenceRef = {
  doc_id: DocId;
  quote?: string;
  span?: { start: number; end: number };
  confidence: number;
};

export type ReasonTraceStep = {
  step: number;
  label: string;
  detail: string;
  evidence?: EvidenceRef[];
};

export type MemoryItem = {
  version: "nucleus.memory_item.v1";
  memory_id: MemoryId;
  kind: MemoryKind;
  statement: string;
  evidence_refs: EvidenceRef[];
  confidence: number;
  created_at_utc: IsoUtc;
  approved_by_user: boolean;
  approved_at_utc?: IsoUtc;
  supersedes_memory_id?: MemoryId;
};

export type ToolAllowlistedArgType = "string" | "number" | "boolean" | "string[]";

export type ToolDefinition = {
  tool_id: string;
  title: string;
  description: string;
  command: string;
  args_template: string[];
  allowed_vars: Record<string, ToolAllowlistedArgType>;
  cwd?: string;
  timeout_ms?: number;
  env_allowlist?: string[];
  requires_approval: boolean;
  risk_level: "low" | "medium" | "high" | "critical";
  output_capture: "none" | "stdout" | "stderr" | "both";
  max_output_kb: number;
};

export type ToolAllowlist = {
  version: "nucleus.tool_allowlist.v1.1";
  tools: ToolDefinition[];
};

export type ToolPlan = {
  intent: "tool";
  tool_id: string;
  args: Record<string, string | number | boolean | string[]>;
  rationale: string;
  dry_run: boolean;
};

export type RetrievePlan = {
  intent: "retrieve";
  top_k: number;
  query: string;
  tags?: string[];
  rationale: string;
};

export type MemoryPlan = {
  intent: "memory";
  proposed: Omit<MemoryItem, "approved_by_user" | "approved_at_utc">;
  rationale: string;
};

export type ClarifyPlan = {
  intent: "clarify";
  question: string;
  options?: string[];
  rationale: string;
};

export type NucleusPlan = ToolPlan | RetrievePlan | MemoryPlan | ClarifyPlan;

export type NucleusResponse = {
  version: "nucleus.response.v1";
  query_id: QueryId;
  timestamp_utc: IsoUtc;
  intent: RouterIntent;
  answer_text: string;
  citations?: EvidenceRef[];
  trace?: ReasonTraceStep[];
  plan?: NucleusPlan;
  tool_run?: {
    tool_run_id: ToolRunId;
    tool_id: string;
    status: "skipped" | "started" | "succeeded" | "failed";
    stdout?: string;
    stderr?: string;
    exit_code?: number | null;
    duration_ms?: number;
  };
  memory?: {
    proposed?: MemoryItem;
    approval_required?: boolean;
  };
};
