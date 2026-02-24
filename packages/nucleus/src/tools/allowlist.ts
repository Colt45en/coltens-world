import { validateToolAllowlist } from "@world-engine/nucleus-contracts";
import type { ToolAllowlist, ToolAllowlistedArgType, ToolDefinition } from "@world-engine/nucleus-contracts";

export function loadAllowlistFromJson(json: unknown): ToolAllowlist {
  const v = validateToolAllowlist(json);
  if (!v.ok) {
    const msg = v.errors.map((e) => `${e.path}: ${e.message}`).join("\n");
    throw new Error(`Invalid tool allowlist:\n${msg}`);
  }
  return v.value;
}

export function findTool(allowlist: ToolAllowlist, toolId: string): ToolDefinition | undefined {
  return allowlist.tools.find((t) => t.tool_id === toolId);
}

export function validateToolArgs(tool: ToolDefinition, args: Record<string, unknown>): Record<string, string | number | boolean | string[]> {
  const out: Record<string, string | number | boolean | string[]> = {};
  for (const [k, ty] of Object.entries(tool.allowed_vars)) {
    if (!(k in args)) continue;
    const v = args[k];
    if (!isAllowedType(v, ty)) {
      throw new Error(`Tool arg '${k}' expected ${ty}, got ${typeof v}`);
    }
    out[k] = v;
  }
  for (const k of Object.keys(args)) {
    if (!(k in tool.allowed_vars)) throw new Error(`Tool arg '${k}' not allowlisted for tool ${tool.tool_id}`);
  }
  return out;
}

function isAllowedType(v: unknown, ty: ToolAllowlistedArgType): v is string | number | boolean | string[] {
  if (ty === "string") return typeof v === "string";
  if (ty === "number") return typeof v === "number" && Number.isFinite(v);
  if (ty === "boolean") return typeof v === "boolean";
  if (ty === "string[]") return Array.isArray(v) && v.every((x) => typeof x === "string");
  return false;
}
