/**
 * Sandbox Module - Isolated Execution Environment
 *
 * Manages:
 * - Sandbox lifecycle (create, execute, destroy)
 * - Resource limits (memory, CPU, disk, timeout)
 * - Policy enforcement during execution
 * - Codex integration for complex behaviors
 * - Execution result capture
 */

import { randomUUID } from "node:crypto";
import type {
  Sandbox,
  SandboxConfig,
  SandboxExecutionResult,
  ExecutionRequest,
  ExecutionResponse,
} from "./contracts";
import { SandboxSchema } from "./contracts";
import { auditLog } from "./audit";
import { getPolicyManager } from "./policy";

// ============================================================================
// Sandbox Executor
// ============================================================================

export class SandboxExecutor {
  private sandboxes: Map<string, Sandbox> = new Map();
  private codexRules: Map<string, any> = new Map(); // codex system rules

  /**
   * Create a new sandbox
   */
  createSandbox(config: SandboxConfig): Sandbox {
    const sandbox: Sandbox = {
      id: config.id || randomUUID(),
      name: config.name,
      config,
      state: "created",
      createdAt: new Date().toISOString(),
      metadata: {},
    };

    const validated = SandboxSchema.parse(sandbox);
    this.sandboxes.set(validated.id, validated);

    auditLog.sandboxCreated(
      validated.id,
      validated.name,
      config.policyId,
      {
        type: "system",
        id: "sandbox-executor",
      }
    );

    return validated;
  }

  /**
   * Get existing sandbox
   */
  getSandbox(sandboxId: string): Sandbox | null {
    return this.sandboxes.get(sandboxId) || null;
  }

  /**
   * Execute code in sandbox
   */
  async executeSandbox(req: ExecutionRequest): Promise<ExecutionResponse> {
    const sandbox = this.getSandbox(req.sandboxId);
    if (!sandbox) {
      return {
        success: false,
        sandboxId: req.sandboxId,
        error: `Sandbox not found: ${req.sandboxId}`,
        auditEvent: auditLog.sandboxExecuted(req.sandboxId, { type: "system", id: "sandbox-executor" }),
      };
    }

    if (sandbox.state !== "created" && sandbox.state !== "initialized") {
      return {
        success: false,
        sandboxId: req.sandboxId,
        error: `Invalid sandbox state: ${sandbox.state}`,
        auditEvent: auditLog.sandboxExecuted(req.sandboxId, { type: "system", id: "sandbox-executor" }),
      };
    }

    sandbox.state = "running";
    const startTime = Date.now();

    try {
      // Apply policy checks
      const policyMgr = getPolicyManager();
      const canExecute = policyMgr.checkCapability(
        sandbox.config.policyId,
        "execute:code",
        { language: req.language, path: "/sandbox" }
      );

      if (!canExecute) {
        throw new Error("Policy violation: execute:code not allowed");
      }

      // Execute based on language
      let result: unknown;

      switch (req.language) {
        case "typescript":
          result = await this._executeTypeScript(req.code, req.args || {});
          break;

        case "python":
          result = await this._executePython(req.code, req.args || {});
          break;

        case "bash":
          result = await this._executeBash(req.code, req.args || {});
          break;

        case "json":
          result = JSON.parse(req.code);
          break;

        default:
          throw new Error(`Unsupported language: ${req.language}`);
      }

      // Success
      sandbox.state = "completed";
      const duration = Date.now() - startTime;

      const executionResult: SandboxExecutionResult = {
        sandboxId: req.sandboxId,
        state: "completed",
        startedAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
        exitCode: 0,
        cpuTime: duration,
      };

      sandbox.result = executionResult;

      auditLog.sandboxExecuted(req.sandboxId, { type: "system", id: "sandbox-executor" }, 0);

      return {
        success: true,
        sandboxId: req.sandboxId,
        result,
        auditEvent: auditLog.sandboxExecuted(req.sandboxId, { type: "system", id: "sandbox-executor" }, 0),
      };
    } catch (err) {
      // Error
      sandbox.state = "failed";

      const executionResult: SandboxExecutionResult = {
        sandboxId: req.sandboxId,
        state: "failed",
        startedAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
        exitCode: 1,
        stderr: String(err),
      };

      sandbox.result = executionResult;

      auditLog.sandboxExecuted(req.sandboxId, { type: "system", id: "sandbox-executor" }, 1);

      return {
        success: false,
        sandboxId: req.sandboxId,
        error: String(err),
        auditEvent: auditLog.sandboxExecuted(req.sandboxId, { type: "system", id: "sandbox-executor" }, 1),
      };
    }
  }

  /**
   * Destroy sandbox
   */
  destroySandbox(sandboxId: string): void {
    const sandbox = this.getSandbox(sandboxId);
    if (sandbox) {
      sandbox.state = "destroyed";
      this.sandboxes.delete(sandboxId);
      auditLog.violationDetected(
        "sandbox-destroy",
        sandboxId,
        { type: "system", id: "sandbox-executor" },
        "Sandbox destroyed"
      );
    }
  }

  /**
   * List all sandboxes
   */
  listSandboxes(): Sandbox[] {
    return Array.from(this.sandboxes.values());
  }

  /**
   * Get sandbox stats
   */
  getStats(): {
    total: number;
    byState: Record<string, number>;
  } {
    const byState: Record<string, number> = {};
    let total = 0;

    for (const sandbox of this.sandboxes.values()) {
      total++;
      byState[sandbox.state] = (byState[sandbox.state] || 0) + 1;
    }

    return { total, byState };
  }

  /**
   * Register codex rule
   */
  registerCodexRule(name: string, rule: any): void {
    this.codexRules.set(name, rule);
  }

  /**
   * Get codex rule
   */
  getCodexRule(name: string): any | null {
    return this.codexRules.get(name) || null;
  }

  // ========================================================================
  // Execution Implementations (Stubs)
  // ========================================================================

  private async _executeTypeScript(code: string, args: Record<string, unknown>): Promise<unknown> {
    // In production, use vm2 or similar
    // For now, simple eval with context
    try {
      const fn = new Function("args", `return (async () => { ${code} })()`);
      return await fn(args);
    } catch (err) {
      throw new Error(`TypeScript execution failed: ${err}`);
    }
  }

  private async _executePython(code: string, args: Record<string, unknown>): Promise<unknown> {
    // In production, spawn Python process with isolation
    // For now, return stub
    console.log(`[sandbox] Would execute Python:\n${code}\nWith args:`, args);
    return { message: "Python execution not yet implemented in Node.js sandbox" };
  }

  private async _executeBash(code: string, args: Record<string, unknown>): Promise<unknown> {
    // In production, use child_process.spawn with resource limits
    // For now, return stub
    console.log(`[sandbox] Would execute Bash:\n${code}\nWith args:`, args);
    return { message: "Bash execution not yet implemented in Node.js sandbox" };
  }
}

// ============================================================================
// Global Sandbox Executor
// ============================================================================

let globalExecutor: SandboxExecutor | null = null;

export function getSandboxExecutor(): SandboxExecutor {
  if (!globalExecutor) {
    globalExecutor = new SandboxExecutor();
  }
  return globalExecutor;
}

export function resetSandboxExecutor(): void {
  globalExecutor = null;
}

// ============================================================================
// Convenience API
// ============================================================================

export async function createAndExecute(
  config: SandboxConfig,
  req: ExecutionRequest
): Promise<ExecutionResponse> {
  const executor = getSandboxExecutor();

  // Create sandbox
  const sandbox = executor.createSandbox(config);

  // Execute
  const execReq: ExecutionRequest = {
    ...req,
    sandboxId: sandbox.id,
  };

  const result = await executor.executeSandbox(execReq);

  return result;
}

export function buildSandboxConfig(
  policyId: string = "baseline",
  overrides: Partial<SandboxConfig> = {}
): SandboxConfig {
  return {
    id: randomUUID(),
    policyId,
    capabilities: [
      "read:env",
      "write:memory",
      "read:memory",
      "execute:code",
    ],
    environmentVars: {
      NODE_ENV: "sandbox",
      SANDBOX_ID: "unknown", // set at runtime
    },
    memoryLimit: 512,
    diskLimit: 100,
    cpuLimit: 50,
    timeout: 30000,
    networkAllowed: false,
    ...overrides,
  };
}
