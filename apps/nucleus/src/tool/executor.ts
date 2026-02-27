/**
 * apps/nucleus/src/tool/executor.ts
 *
 * Tool execution orchestrator:
 * - query_lexicon: server-side (calls Python sidecar)
 * - record_screen: client-side (sends command to IDE, waits for effect)
 * - agent_*: routed to agent sidescar with constraint pre-validation
 *
 * CONSTRAINT VALIDATION:
 * All agent tools are validated against active constraints before dispatch.
 * Constraints come from: wheel curriculum, world genesis, physics, representation invariants.
 */

import { nowMs, randomId } from "@world-engine/protocol";
import type { AnyEnv, ToolCall, ToolEffectEnv } from "./types";

export interface ConstraintViolation {
  constraint_id: string;
  rule: string;
  tool_name: string;
  violation_detail: string;
}

/**
 * Constraint registry tracks active constraints from curriculum, world genesis, physics, etc.
 * Validators enforce these before tool dispatch.
 */
export interface ConstraintStore {
  getActive(): ConstraintViolation[];
  validate(toolName: string, args: any): ConstraintViolation[];
}

export class ToolExecutor {
  // Map toolCallId -> resolver for IDE tool.effect.v1 responses
  private pending = new Map<
    string,
    {
      resolve: (e: ToolEffectEnv) => void;
      reject: (err: Error) => void;
      timeout: NodeJS.Timeout;
    }
  >();

  constructor(
    private sendToIde: (env: AnyEnv) => void, // broadcast to IDE WS client(s)
    private emitToIde: (env: AnyEnv) => void, // send result to IDE (same as sendToIde typically)
    private HUB_INSTANCE_ID: string = "nucleus_1",
    private constraintStore?: ConstraintStore // optional constraint validator
  ) {}

  async execute(traceId: string, sessionId: string, call: ToolCall): Promise<ToolEffectEnv> {
    if (call.name === "query_lexicon") {
      return await this.execQueryLexicon(traceId, sessionId, call);
    }
    if (call.name === "record_screen") {
      return await this.execRecordScreenViaIde(traceId, sessionId, call);
    }
    if (call.name.startsWith("agent_")) {
      // CONSTRAINT VALIDATION: pre-check before dispatching to agent
      if (this.constraintStore) {
        const violations = this.constraintStore.validate(call.name, call.args || {});
        if (violations.length > 0) {
          return this.rejectToolWithConstraintViolation(traceId, sessionId, call, violations);
        }
      }
      return await this.execAgentTool(traceId, sessionId, call);
    }

    return {
      v: 2,
      type: "tool.effect.v1",
      id: randomId("srv"),
      ts: nowMs(),
      from: { role: "nucleus", instanceId: this.HUB_INSTANCE_ID },
      sessionId,
      traceId,
      payload: {
        toolCallId: call.toolCallId,
        name: call.name as any,
        status: "error",
        error: { message: `Unknown tool: ${call.name}` },
      },
    };
  }

  // ----- server-side tool: query_lexicon -----
  private async execQueryLexicon(
    traceId: string,
    sessionId: string,
    call: ToolCall
  ): Promise<ToolEffectEnv> {
    const LEXICON_ENDPOINT = process.env.LEXICON_ENDPOINT || "http://127.0.0.1:3000";
    try {
      const term = String(call.args?.term ?? "");
      const k = Number(call.args?.k ?? 5);

      const res = await fetch(`${LEXICON_ENDPOINT}/leximorph/query`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ term, k }),
      });

      if (!res.ok) {
        throw new Error(`lexicon/query failed: ${res.status} ${res.statusText}`);
      }
      const data = await res.json();

      const env: ToolEffectEnv = {
        v: 2,
        type: "tool.effect.v1",
        id: randomId("srv"),
        ts: nowMs(),
        from: { role: "nucleus", instanceId: this.HUB_INSTANCE_ID },
        sessionId,
        traceId,
        payload: {
          toolCallId: call.toolCallId,
          name: "query_lexicon",
          status: "ok",
          result: data,
        },
      };
      this.emitToIde(env);
      return env;
    } catch (e: any) {
      const env: ToolEffectEnv = {
        v: 2,
        type: "tool.effect.v1",
        id: randomId("srv"),
        ts: nowMs(),
        from: { role: "nucleus", instanceId: this.HUB_INSTANCE_ID },
        sessionId,
        traceId,
        payload: {
          toolCallId: call.toolCallId,
          name: "query_lexicon",
          status: "error",
          error: { message: String(e?.message ?? e) },
        },
      };
      this.emitToIde(env);
      return env;
    }
  }

  /**
   * Reject a tool call due to constraint violations.
   * Emits constraint violation details to IDE and logs for auditing.
   */
  private rejectToolWithConstraintViolation(
    traceId: string,
    sessionId: string,
    call: ToolCall,
    violations: ConstraintViolation[]
  ): ToolEffectEnv {
    const env: ToolEffectEnv = {
      v: 2,
      type: "tool.effect.v1",
      id: randomId("srv"),
      ts: nowMs(),
      from: { role: "nucleus", instanceId: this.HUB_INSTANCE_ID },
      sessionId,
      traceId,
      payload: {
        toolCallId: call.toolCallId,
        name: call.name,
        status: "error",
        error: {
          message: `Tool rejected: ${violations.length} constraint violation(s)`,
          violations: violations.map((v) => ({
            constraint_id: v.constraint_id,
            rule: v.rule,
            detail: v.violation_detail,
          })),
        },
      },
    };
    this.emitToIde(env);
    return env;
  }

  // ----- server-side tool: agent tools -----
  private async execAgentTool(
    traceId: string,
    sessionId: string,
    call: ToolCall
  ): Promise<ToolEffectEnv> {
    const AGENT_ENDPOINT = process.env.AGENT_ENDPOINT || "http://127.0.0.1:3001";
    try {
      const res = await fetch(`${AGENT_ENDPOINT}/execute_tool`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tool_name: call.name,
          args: call.args || {},
        }),
      });

      if (!res.ok) {
        throw new Error(`agent tool failed: ${res.status} ${res.statusText}`);
      }
      const data = await res.json();

      const env: ToolEffectEnv = {
        v: 2,
        type: "tool.effect.v1",
        id: randomId("srv"),
        ts: nowMs(),
        from: { role: "nucleus", instanceId: this.HUB_INSTANCE_ID },
        sessionId,
        traceId,
        payload: {
          toolCallId: call.toolCallId,
          name: call.name,
          status: "ok",
          result: data,
        },
      };
      this.emitToIde(env);
      return env;
    } catch (e: any) {
      const env: ToolEffectEnv = {
        v: 2,
        type: "tool.effect.v1",
        id: randomId("srv"),
        ts: nowMs(),
        from: { role: "nucleus", instanceId: this.HUB_INSTANCE_ID },
        sessionId,
        traceId,
        payload: {
          toolCallId: call.toolCallId,
          name: call.name,
          status: "error",
          error: { message: String(e?.message ?? e) },
        },
      };
      this.emitToIde(env);
      return env;
    }
  }

  // ----- client-side tool: record_screen -----
  private async execRecordScreenViaIde(
    traceId: string,
    sessionId: string,
    call: ToolCall
  ): Promise<ToolEffectEnv> {
    const commandEnv: AnyEnv = {
      v: 2,
      type: "tool.command.v1",
      id: randomId("srv"),
      ts: nowMs(),
      from: { role: "nucleus", instanceId: this.HUB_INSTANCE_ID },
      sessionId,
      traceId,
      payload: call,
    };
    this.sendToIde(commandEnv);

    return await new Promise<ToolEffectEnv>((resolve, reject) => {
      const timeoutMs = Number(call.args?.timeoutMs ?? 60_000);
      const timeout = setTimeout(() => {
        this.pending.delete(call.toolCallId);
        reject(new Error(`record_screen timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pending.set(call.toolCallId, { resolve, reject, timeout });
    }).catch((err) => {
      const env: ToolEffectEnv = {
        v: 2,
        type: "tool.effect.v1",
        id: randomId("srv"),
        ts: nowMs(),
        from: { role: "nucleus", instanceId: this.HUB_INSTANCE_ID },
        sessionId,
        traceId,
        payload: {
          toolCallId: call.toolCallId,
          name: "record_screen",
          status: "error",
          error: { message: String(err?.message ?? err) },
        },
      };
      this.emitToIde(env);
      return env;
    });
  }

  // Called by Nucleus when IDE sends tool.effect.v1 back
  handleToolEffectFromIde(env: ToolEffectEnv) {
    const tcid = env.payload?.toolCallId;
    if (!tcid) return;

    const pending = this.pending.get(tcid);
    if (!pending) return;

    clearTimeout(pending.timeout);
    this.pending.delete(tcid);
    pending.resolve(env);
  }

  // ============================================================================
  // P0.5: Tool allowlist + argument validation
  // ============================================================================

  private readonly TOOL_ALLOWLIST = new Set([
    "record_screen",
    "query_lexicon",
    "update_memory",
    "query_memory",
    "fetch_url",
    "analyze_code",
    // Add real tools as they're implemented
  ]);

  private readonly MAX_TOOL_ARG_SIZE = 256 * 1024; // 256KB

  private validateToolCall(
    name: string,
    args: Record<string, any>
  ): { ok: boolean; error?: string } {
    // P0.5.1: Allowlist check
    if (!this.TOOL_ALLOWLIST.has(name)) {
      return { ok: false, error: `Tool not in allowlist: ${name}` };
    }

    // P0.5.2: Argument size clamp
    const argSize = JSON.stringify(args).length;
    if (argSize > this.MAX_TOOL_ARG_SIZE) {
      return { ok: false, error: `Tool args exceed ${this.MAX_TOOL_ARG_SIZE} bytes` };
    }

    // P0.5.3: Timeout clamp
    const timeout = (args.timeoutMs ?? 15_000) as number;
    if (timeout > 60_000) {
      return { ok: false, error: `Timeout must be ≤ 60s` };
    }

    return { ok: true };
  }
}
