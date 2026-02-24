import { spawn } from "node:child_process";

import { makeToolRunId } from "@world-engine/nucleus-contracts";
import type { ToolAllowlist, ToolDefinition } from "@world-engine/nucleus-contracts";

import { findTool, validateToolArgs } from "./allowlist.js";
import { NoopToolEventSink } from "./events.js";
import type { ToolEventSink } from "./events.js";
import { stableStringify } from "../util/stable_json.js";

function interpolate(template: string, vars: Record<string, string | number | boolean | string[]>): string {
  return template.replaceAll(/\$\{(\w+)\}/g, (_m, key) => {
    if (!(key in vars)) throw new Error(`Missing required var '${key}'`);
    const v = vars[key];
    if (Array.isArray(v)) return v.join(",");
    return String(v);
  });
}

export async function runAllowlistedTool(params: {
  allowlist: ToolAllowlist;
  tool_id: string;
  args: Record<string, unknown>;
  timestamp_utc: string;
  dry_run: boolean;
  eventSink?: ToolEventSink;
}): Promise<{
  tool_run_id: string;
  tool: ToolDefinition;
  status: "skipped" | "started" | "succeeded" | "failed";
  stdout: string;
  stderr: string;
  exit_code: number | null;
  duration_ms: number;
  command_preview: { cmd: string; args: string[]; cwd?: string };
}> {
  const sink = params.eventSink ?? new NoopToolEventSink();
  const tool = findTool(params.allowlist, params.tool_id);
  if (!tool) throw new Error(`Tool not found in allowlist: ${params.tool_id}`);

  const validatedArgs = validateToolArgs(tool, params.args);
  const argv = tool.args_template.map((a) => interpolate(a, validatedArgs));
  const argsStableJson = stableStringify({ tool_id: tool.tool_id, args: validatedArgs });
  const tool_run_id = makeToolRunId(tool.tool_id, params.timestamp_utc, argsStableJson);

  const command_preview = {
    cmd: tool.command,
    args: argv,
    ...(tool.cwd ? { cwd: tool.cwd } : {})
  };

  if (params.dry_run) {
    return {
      tool_run_id,
      tool,
      status: "skipped",
      stdout: "",
      stderr: "",
      exit_code: null,
      duration_ms: 0,
      command_preview
    };
  }

  const start = Date.now();
  sink.emit({ type: "tool.started", tool_id: tool.tool_id, at_utc: params.timestamp_utc });

  const timeoutMs = tool.timeout_ms ?? 60_000;

  return await new Promise((resolve) => {
    const child = spawn(tool.command, argv, {
      cwd: tool.cwd,
      env: filteredEnv(tool.env_allowlist),
      shell: process.platform === "win32"
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (d) => (stdout += d.toString("utf8")));
    child.stderr?.on("data", (d) => (stderr += d.toString("utf8")));

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, timeoutMs);

    child.on("close", (code) => {
      clearTimeout(timer);
      const duration_ms = Date.now() - start;
      const status: "succeeded" | "failed" = code === 0 ? "succeeded" : "failed";
      sink.emit({
        type: "tool.finished",
        tool_id: tool.tool_id,
        at_utc: new Date().toISOString(),
        status,
        exit_code: code,
        duration_ms
      });
      resolve({
        tool_run_id,
        tool,
        status,
        stdout,
        stderr,
        exit_code: code,
        duration_ms,
        command_preview
      });
    });
  });
}

function filteredEnv(allow?: string[]): NodeJS.ProcessEnv {
  if (!allow?.length) return {};
  const out: NodeJS.ProcessEnv = {};
  for (const k of allow) {
    const v = process.env[k];
    if (typeof v === "string") out[k] = v;
  }
  return out;
}
