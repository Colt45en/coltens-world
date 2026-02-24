// toolAllowlist.guard.ts
import { z } from "zod";

export const ToolAllowlistSchema = z
  .object({
    version: z.literal("nucleus.tool_allowlist.v1"),
    tools: z.array(
      z
        .object({
          tool_id: z.string().min(1),
          title: z.string().min(1),
          description: z.string().min(1),
          command: z.string().min(1),
          args_template: z.array(z.string()),
          allowed_vars: z.record(z.enum(["string", "number", "boolean", "string[]"])),
          cwd: z.string().optional(),
          timeout_ms: z.number().optional(),
          env_allowlist: z.array(z.string()).optional(),
        })
        .strict()
    ),
  })
  .strict();

export type ToolAllowlist = z.infer<typeof ToolAllowlistSchema>;
export type AllowedVarType = "string" | "number" | "boolean" | "string[]";

export class ToolAllowlistIndex {
  private byId = new Map<string, ToolAllowlist["tools"][number]>();

  constructor(public readonly allowlist: ToolAllowlist) {
    for (const t of allowlist.tools) {
      this.byId.set(t.tool_id, t);
    }
  }

  get(toolId: string) {
    return this.byId.get(toolId);
  }

  has(toolId: string) {
    return this.byId.has(toolId);
  }

  listToolIds() {
    return Array.from(this.byId.keys()).sort();
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function typeMatches(v: unknown, t: AllowedVarType): boolean {
  switch (t) {
    case "string":
      return typeof v === "string";
    case "number":
      return typeof v === "number" && Number.isFinite(v);
    case "boolean":
      return typeof v === "boolean";
    case "string[]":
      return Array.isArray(v) && v.every((x) => typeof x === "string");
  }
}

export function validateToolInputOrThrow(
  index: ToolAllowlistIndex,
  toolId: string,
  input: unknown
) {
  const tool = index.get(toolId);
  if (!tool) {
    throw new Error(`ToolAllowlist denied tool "${toolId}" (not in allowlist)`);
  }

  if (!isPlainObject(input)) {
    throw new Error(`Tool "${toolId}" requires object input (got ${Array.isArray(input) ? "array" : typeof input})`);
  }

  const allowed = tool.allowed_vars;

  for (const [k, v] of Object.entries(input)) {
    const expected = allowed[k];
    if (!expected) {
      throw new Error(`Tool "${toolId}" denied input key "${k}" (not declared in allowed_vars)`);
    }
    if (!typeMatches(v, expected)) {
      throw new Error(`Tool "${toolId}" key "${k}" type mismatch: expected ${expected}`);
    }
  }

  // Optional: enforce bounded input (prevents huge payloads)
  const keyCount = Object.keys(input).length;
  if (keyCount > 64) throw new Error(`Tool "${toolId}" input too large (${keyCount} keys)`);
}
