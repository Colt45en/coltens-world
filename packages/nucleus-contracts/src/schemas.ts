import type { MemoryItem, NucleusQuery, NucleusResponse, ToolAllowlist } from "./types.js";

export type ValidationError = { path: string; message: string };

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function isStr(x: unknown): x is string {
  return typeof x === "string";
}

function isNum(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

function isBool(x: unknown): x is boolean {
  return typeof x === "boolean";
}

function err(path: string, message: string): ValidationError {
  return { path, message };
}

export function validateNucleusQuery(input: unknown): { ok: true; value: NucleusQuery } | { ok: false; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  if (!isObj(input)) return { ok: false, errors: [err("$", "Expected object")] };

  if (input.version !== "nucleus.query.v1") errors.push(err("$.version", "Expected nucleus.query.v1"));
  if (!isStr(input.query_id)) errors.push(err("$.query_id", "Expected string"));
  if (!isStr(input.user_id)) errors.push(err("$.user_id", "Expected string"));
  if (!isStr(input.timestamp_utc)) errors.push(err("$.timestamp_utc", "Expected ISO UTC string"));
  if (!isStr(input.query_text)) errors.push(err("$.query_text", "Expected string"));

  if ("context_refs" in input) {
    const cr = input.context_refs;
    if (!Array.isArray(cr) || !cr.every(isStr)) errors.push(err("$.context_refs", "Expected string[]"));
  }

  if ("constraints" in input) {
    const c = input.constraints;
    if (!isObj(c)) errors.push(err("$.constraints", "Expected object"));
    else {
      if ("max_latency_ms" in c && !isNum(c.max_latency_ms)) errors.push(err("$.constraints.max_latency_ms", "Expected number"));
      if ("allow_tools" in c && !isBool(c.allow_tools)) errors.push(err("$.constraints.allow_tools", "Expected boolean"));
      if ("allow_memory_write" in c && !isBool(c.allow_memory_write)) errors.push(err("$.constraints.allow_memory_write", "Expected boolean"));
      if ("require_citations" in c && !isBool(c.require_citations)) errors.push(err("$.constraints.require_citations", "Expected boolean"));
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true, value: input as NucleusQuery };
}

export function validateNucleusResponse(input: unknown): { ok: true; value: NucleusResponse } | { ok: false; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  if (!isObj(input)) return { ok: false, errors: [err("$", "Expected object")] };
  if (input.version !== "nucleus.response.v1") errors.push(err("$.version", "Expected nucleus.response.v1"));
  if (!isStr(input.query_id)) errors.push(err("$.query_id", "Expected string"));
  if (!isStr(input.timestamp_utc)) errors.push(err("$.timestamp_utc", "Expected string"));
  if (!isStr(input.intent)) errors.push(err("$.intent", "Expected string"));
  if (!isStr(input.answer_text)) errors.push(err("$.answer_text", "Expected string"));
  return errors.length ? { ok: false, errors } : { ok: true, value: input as NucleusResponse };
}

export function validateMemoryItem(input: unknown): { ok: true; value: MemoryItem } | { ok: false; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  if (!isObj(input)) return { ok: false, errors: [err("$", "Expected object")] };
  if (input.version !== "nucleus.memory_item.v1") errors.push(err("$.version", "Expected nucleus.memory_item.v1"));
  if (!isStr(input.memory_id)) errors.push(err("$.memory_id", "Expected string"));
  if (!isStr(input.kind)) errors.push(err("$.kind", "Expected string"));
  if (!isStr(input.statement)) errors.push(err("$.statement", "Expected string"));
  if (!Array.isArray(input.evidence_refs)) errors.push(err("$.evidence_refs", "Expected array"));
  if (!isNum(input.confidence)) errors.push(err("$.confidence", "Expected number"));
  if (!isStr(input.created_at_utc)) errors.push(err("$.created_at_utc", "Expected string"));
  if (!isBool(input.approved_by_user)) errors.push(err("$.approved_by_user", "Expected boolean"));
  return errors.length ? { ok: false, errors } : { ok: true, value: input as MemoryItem };
}

export function validateToolAllowlist(input: unknown): { ok: true; value: ToolAllowlist } | { ok: false; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  if (!isObj(input)) return { ok: false, errors: [err("$", "Expected object")] };
  if (input.version !== "nucleus.tool_allowlist.v1") errors.push(err("$.version", "Expected nucleus.tool_allowlist.v1"));
  if (!Array.isArray(input.tools)) errors.push(err("$.tools", "Expected array"));
  else {
    for (let i = 0; i < input.tools.length; i += 1) {
      const t = input.tools[i];
      if (!isObj(t)) {
        errors.push(err(`$.tools[${i}]`, "Expected object"));
        continue;
      }
      if (!isStr(t.tool_id)) errors.push(err(`$.tools[${i}].tool_id`, "Expected string"));
      if (!isStr(t.title)) errors.push(err(`$.tools[${i}].title`, "Expected string"));
      if (!isStr(t.description)) errors.push(err(`$.tools[${i}].description`, "Expected string"));
      if (!isStr(t.command)) errors.push(err(`$.tools[${i}].command`, "Expected string"));
      if (!Array.isArray(t.args_template) || !t.args_template.every(isStr)) errors.push(err(`$.tools[${i}].args_template`, "Expected string[]"));
      if (!isObj(t.allowed_vars)) errors.push(err(`$.tools[${i}].allowed_vars`, "Expected object"));
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, value: input as ToolAllowlist };
}
