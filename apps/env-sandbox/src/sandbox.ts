/**
 * Sandbox Executor: Process Isolation with Node Permission Model
 *
 * - Spawn child processes with constrained permissions
 * - Use Node.js --allow-fs-read, --allow-fs-write, --allow-child-process
 * - Enforce resource limits (memory, disk, timeout)
 * - Audit all execution events
 */

import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { auditLog } from "./audit.js";
import type { ExecutionRequest, ExecutionResponse, Sandbox, SandboxConfig } from "./contracts.js";

/**
 * SandboxExecutor: Manages sandbox lifecycle and execution
 */
export class SandboxExecutor {
  private sandboxes: Map<string, Sandbox> = new Map();
  private workDir: string;

  constructor(workDir?: string) {
    this.workDir = workDir || path.join(os.tmpdir(), "env-sandbox-exec");
    if (!fs.existsSync(this.workDir)) {
      fs.mkdirSync(this.workDir, { recursive: true });
    }
  }

  /**
   * Create a new sandbox
   */
  createSandbox(config: SandboxConfig): Sandbox {
    const id = crypto.randomBytes(16).toString("hex");
    const sandbox: Sandbox = {
      id,
      config,
      state: "initialized",
      createdAt: new Date().toISOString(),
      metadata: {},
    };

    this.sandboxes.set(id, sandbox);

    // Audit: sandbox creation
    auditLog(
      "sandbox:create",
      "system",
      "sandbox",
      "audit",
      { sandboxId: id, policyId: config.policyId },
      "info"
    );

    return sandbox;
  }

  /**
   * Get a sandbox by ID
   */
  getSandbox(sandboxId: string): Sandbox | null {
    return this.sandboxes.get(sandboxId) || null;
  }

  /**
   * List all sandboxes
   */
  listSandboxes(): Sandbox[] {
    return Array.from(this.sandboxes.values());
  }

  /**
   * Execute code in a sandbox
   */
  async execute(request: ExecutionRequest): Promise<ExecutionResponse> {
    const sandbox = this.getSandbox(request.sandboxId);
    if (!sandbox) {
      throw new Error(`Sandbox not found: ${request.sandboxId}`);
    }

    const sandboxDir = path.join(this.workDir, request.sandboxId);
    if (!fs.existsSync(sandboxDir)) {
      fs.mkdirSync(sandboxDir, { recursive: true });
    }

    try {
      sandbox.state = "running";

      const startTime = Date.now();
      const result = await this.executeInChild(request, sandboxDir, sandbox);
      const durationMs = Date.now() - startTime;

      sandbox.state = "completed";

      // Audit: successful execution
      auditLog(
        "execution:complete",
        "sandbox",
        "process",
        "audit",
        {
          sandboxId: request.sandboxId,
          language: request.language,
          exitCode: result.exitCode,
          durationMs,
        },
        "info",
        request.sandboxId
      );

      return { ...result, durationMs };
    } catch (error) {
      sandbox.state = "failed";

      // Audit: execution failure
      auditLog(
        "execution:error",
        "sandbox",
        "process",
        "deny",
        {
          sandboxId: request.sandboxId,
          language: request.language,
          error: String(error),
        },
        "high",
        request.sandboxId,
        String(error)
      );

      return {
        ok: false,
        stdout: "",
        stderr: String(error),
        exitCode: 1,
        durationMs: Date.now() - (sandbox.createdAt ? Date.parse(sandbox.createdAt) : Date.now()),
      };
    }
  }

  /**
   * Execute in child process with Node permissions
   */
  private executeInChild(
    request: ExecutionRequest,
    sandboxDir: string,
    sandbox: Sandbox
  ): Promise<ExecutionResponse> {
    return new Promise((resolve) => {
      // Build permission flags
      const permissionFlags: string[] = [];

      if (sandbox.config.capabilities.includes("read:fs")) {
        permissionFlags.push(`--allow-fs-read=${sandboxDir}`);
      }

      if (sandbox.config.capabilities.includes("write:fs")) {
        permissionFlags.push(`--allow-fs-write=${sandboxDir}`);
      }

      if (sandbox.config.capabilities.includes("execute:child_process")) {
        permissionFlags.push("--allow-child-process");
      }

      if (sandbox.config.networkAllowed && sandbox.config.capabilities.includes("network:client")) {
        // Note: Node.js doesn't have --allow-network yet, but we track intent
      }

      // Spawn runner process
      const runner = spawn("node", [
        ...permissionFlags,
        path.join(__dirname, "runner", "nodeRunner.js"),
      ]);

      let stdout = "";
      let stderr = "";
      const timeout = setTimeout(() => {
        runner.kill();
      }, sandbox.config.timeout);

      runner.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      runner.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      runner.on("close", (exitCode) => {
        clearTimeout(timeout);

        // Parse runner output
        let result: ExecutionResponse;
        try {
          result = JSON.parse(stdout) as ExecutionResponse;
        } catch {
          result = {
            ok: false,
            stdout,
            stderr: stderr || "Failed to parse runner output",
            exitCode: exitCode || 1,
            durationMs: 0,
          };
        }

        resolve(result);
      });

      // Send execution request to runner stdin
      runner.stdin?.write(JSON.stringify(request));
      runner.stdin?.end();
    });
  }

  /**
   * Destroy a sandbox (cleanup)
   */
  destroySandbox(sandboxId: string): void {
    const sandbox = this.sandboxes.get(sandboxId);
    if (sandbox) {
      sandbox.state = "destroyed";

      // Cleanup directory
      const sandboxDir = path.join(this.workDir, sandboxId);
      if (fs.existsSync(sandboxDir)) {
        fs.rmSync(sandboxDir, { recursive: true, force: true });
      }

      // Audit: sandbox destruction
      auditLog("sandbox:destroy", "system", "sandbox", "audit", { sandboxId }, "info");
    }
  }

  /**
   * Get work directory
   */
  getWorkDir(): string {
    return this.workDir;
  }
}

