/**
 * Agent Server Ledger Integration
 *
 * Implements:
 * - Checkpoint persistence (file + ledger events)
 * - Polling loop for tool.execute.request events
 * - Graceful restart recovery (reads last checkpoint)
 * - Tool execution flow (request → approve → execute → result)
 * - Idempotency guards (don't re-execute same call_id)
 */

import crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

export interface LedgerIntegrationConfig {
  ledger_url: string;
  agent_id: string;
  tool_executor: (toolName: string, input: any) => Promise<any>;
  polling_interval_ms?: number;
  checkpoint_dir?: string;
}

interface ToolExecuteRequest {
  event_id: string;
  type: "tool.execute.request";
  v: number;
  ts: string | number;
  correlation_id: string;
  call_id: string;
  producer: string;
  payload_hash: string;
  payload: {
    tool_name: string;
    input: any;
    approval_required?: boolean;
    determinism_policy?: string;
    effect_profile?: string;
  };
  seq?: number;
}

interface ApprovalRequestedEvent {
  event_id: string;
  type: "approval.requested";
  v: number;
  ts: string | number;
  correlation_id: string;
  call_id: string;
  producer: string;
  payload_hash: string;
  payload: {
    approval_id: string;
    tool_name: string;
    reason: string;
  };
}

interface ToolExecuteResult {
  event_id: string;
  type: "tool.execute.result";
  v: number;
  ts: string | number;
  correlation_id: string;
  call_id: string;
  producer: string;
  payload_hash: string;
  payload: {
    tool_name: string;
    success: boolean;
    output?: any;
    error?: string;
    executor_version: string;
    runtime: string;
    determinism_policy: string;
    effect_profile: string;
  };
}

interface CheckpointRecord {
  agent_id: string;
  after_seq: number;
  timestamp_ms: number;
}

/**
 * LedgerClient: Polls ledger, executes tools, records results
 */
export class LedgerClient {
  private config: LedgerIntegrationConfig;
  private polling_interval_ms: number;
  private checkpoint_dir: string;
  private checkpoint_file: string;
  private current_seq: number = 0;
  private polling_active: boolean = false;
  private polling_loop_id: NodeJS.Timeout | null = null;
  private processed_call_ids: Set<string> = new Set();

  constructor(config: LedgerIntegrationConfig) {
    this.config = config;
    this.polling_interval_ms = config.polling_interval_ms || 2000;
    this.checkpoint_dir = config.checkpoint_dir || "runtime/ledger-checkpoints";
    this.checkpoint_file = path.join(this.checkpoint_dir, `${config.agent_id}.checkpoint.json`);
  }

  /**
   * Initialize: load checkpoint + start polling
   */
  async initialize(): Promise<void> {
    try {
      this.loadCheckpoint();
      console.log(`[Agent] LedgerClient initialized (after_seq: ${this.current_seq})`);
      this.startPolling();
    } catch (error) {
      console.error(`[Agent] LedgerClient init failed:`, error);
      throw error;
    }
  }

  /**
   * Load checkpoint from filesystem
   * On first run, defaults to after_seq=0
   */
  private loadCheckpoint(): void {
    try {
      if (fs.existsSync(this.checkpoint_file)) {
        const data = fs.readFileSync(this.checkpoint_file, "utf-8");
        const checkpoint: CheckpointRecord = JSON.parse(data);
        this.current_seq = checkpoint.after_seq;
        console.log(`[Agent] Checkpoint loaded: after_seq=${checkpoint.after_seq}`);
      } else {
        this.current_seq = 0;
        console.log(`[Agent] No checkpoint; starting from seq=0`);
      }
    } catch (error) {
      console.warn(`[Agent] Checkpoint load failed, starting fresh:`, error);
      this.current_seq = 0;
    }
  }

  /**
   * Save checkpoint to filesystem (and optionally ledger)
   */
  private async saveCheckpoint(): Promise<void> {
    try {
      // Ensure directory exists
      if (!fs.existsSync(this.checkpoint_dir)) {
        fs.mkdirSync(this.checkpoint_dir, { recursive: true });
      }

      const checkpoint: CheckpointRecord = {
        agent_id: this.config.agent_id,
        after_seq: this.current_seq,
        timestamp_ms: Date.now(),
      };

      fs.writeFileSync(this.checkpoint_file, JSON.stringify(checkpoint, null, 2), "utf-8");

      // Optionally: append checkpoint event to ledger for audit
      await this.appendCheckpointEventToLedger(checkpoint);
    } catch (error) {
      console.warn(`[Agent] Checkpoint save failed:`, error);
      // Don't throw; polling continues
    }
  }

  /**
   * Start polling loop
   */
  private startPolling(): void {
    if (this.polling_active) return;

    this.polling_active = true;
    console.log(`[Agent] Ledger polling started (interval: ${this.polling_interval_ms}ms)`);

    this.polling_loop_id = setInterval(() => {
      this.pollOnce().catch((error) => {
        console.error(`[Agent] Polling error:`, error);
      });
    }, this.polling_interval_ms);

    // Also run immediately
    this.pollOnce().catch((error) => {
      console.error(`[Agent] Initial poll failed:`, error);
    });
  }

  /**
   * Stop polling loop
   */
  stopPolling(): void {
    if (this.polling_loop_id) {
      clearInterval(this.polling_loop_id);
      this.polling_loop_id = null;
    }
    this.polling_active = false;
    console.log(`[Agent] Ledger polling stopped`);
  }

  /**
   * Single polling cycle: fetch events, process them
   */
  private async pollOnce(): Promise<void> {
    try {
      const response = await fetch(
        `${this.config.ledger_url}/ledger/stream?after_seq=${this.current_seq}&limit=100`
      );

      if (!response.ok) {
        throw new Error(`Ledger returned ${response.status}`);
      }

      const data = (await response.json()) as { events: any[]; max_seq?: number };
      const events = data.events || [];

      if (events.length === 0) {
        return; // No new events
      }

      // Process each event
      for (const event of events) {
        await this.processEvent(event);
        this.current_seq = Math.max(this.current_seq, event.seq);
      }

      // Save checkpoint after batch
      await this.saveCheckpoint();
    } catch (error) {
      console.warn(`[Agent] Poll cycle failed:`, error);
      // Continue next cycle
    }
  }

  /**
   * Process a single event from the ledger
   */
  private async processEvent(event: any): Promise<void> {
    if (event.type === "tool.execute.request") {
      await this.onToolExecuteRequest(event as ToolExecuteRequest);
    }
  }

  /**
   * Handle tool.execute.request event
   * Flow: request → [approval if needed] → execute → result
   */
  private async onToolExecuteRequest(event: ToolExecuteRequest): Promise<void> {
    const { call_id, payload } = event;
    const { tool_name, approval_required } = payload;

    // Guard: don't re-execute same call_id
    if (this.processed_call_ids.has(call_id)) {
      console.log(`[Agent] Tool already executed: ${call_id}`);
      return;
    }

    console.log(`[Agent] Tool request: ${tool_name} (call_id: ${call_id})`);

    try {
      // Step 1: Check if approval required
      if (approval_required) {
        const approvalId = await this.requestApproval(event);
        console.log(`[Agent] Approval requested: ${approvalId}`);

        // Step 2: Wait for approval decision
        const approved = await this.waitForApproval(approvalId);

        if (!approved) {
          await this.recordToolResult(event, false, undefined, "Approval rejected");
          this.processed_call_ids.add(call_id);
          return;
        }

        console.log(`[Agent] Approval received: ${approvalId}`);
      }

      // Step 3: Execute tool
      const output = await this.config.tool_executor(tool_name, payload.input);

      // Step 4: Record result
      await this.recordToolResult(event, true, output);

      console.log(`[Agent] Tool executed successfully: ${tool_name} (call_id: ${call_id})`);

      // Mark as processed
      this.processed_call_ids.add(call_id);
    } catch (error) {
      console.error(`[Agent] Tool execution failed: ${tool_name}`, error);

      // Record failure
      await this.recordToolResult(
        event,
        false,
        undefined,
        error instanceof Error ? error.message : String(error)
      );

      this.processed_call_ids.add(call_id);
    }
  }

  /**
   * Request approval via ledger
   */
  private async requestApproval(toolRequest: ToolExecuteRequest): Promise<string> {
    const approval_id = `appr-${toolRequest.call_id}`;

    const approvalEvent: ApprovalRequestedEvent = {
      event_id: `evt-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
      type: "approval.requested",
      v: 1,
      ts: new Date().toISOString(),
      correlation_id: toolRequest.call_id,
      call_id: toolRequest.call_id,
      producer: `agent:${this.config.agent_id}`,
      payload_hash: this.hashPayload({
        approval_id,
        tool_name: toolRequest.payload.tool_name,
        reason: "Tool requires approval before execution",
      }),
      payload: {
        approval_id,
        tool_name: toolRequest.payload.tool_name,
        reason: "Tool requires approval before execution",
      },
    };

    await this.appendEventToLedger(approvalEvent);
    return approval_id;
  }

  /**
   * Wait for approval decision (polls /approvals/:id endpoint)
   * Simple polling; in production could use WebSocket
   */
  private async waitForApproval(approvalId: string, timeout_ms: number = 30000): Promise<boolean> {
    const start = Date.now();

    while (Date.now() - start < timeout_ms) {
      try {
        const response = await fetch(`${this.config.ledger_url}/approvals/${approvalId}`);

        if (response.ok) {
          const data = (await response.json()) as any;
          const approval = data.approval || data.payload || {};

          if (approval.decision === "approved") {
            return true;
          } else if (approval.decision === "rejected") {
            return false;
          } else if (approval.decision === "expired") {
            return false;
          }
        }
      } catch (error) {
        // Endpoint error; continue polling
      }

      // Wait before next check
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Timeout → deny
    console.warn(`[Agent] Approval timeout (${approvalId})`);
    return false;
  }

  /**
   * Record tool execution result
   */
  private async recordToolResult(
    toolRequest: ToolExecuteRequest,
    success: boolean,
    output?: any,
    error?: string
  ): Promise<void> {
    const resultPayload: ToolExecuteResult["payload"] = {
      tool_name: toolRequest.payload.tool_name,
      success,
      ...(output !== undefined && { output }),
      ...(error && { error }),
      executor_version: process.env.EXECUTOR_VERSION || "1.0.0",
      runtime: `Node.js ${process.version}`,
      determinism_policy: toolRequest.payload.determinism_policy || "reexec",
      effect_profile: toolRequest.payload.effect_profile || "unknown",
    };

    const resultEvent: ToolExecuteResult = {
      event_id: `evt-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
      type: "tool.execute.result",
      v: 1,
      ts: new Date().toISOString(),
      correlation_id: toolRequest.call_id,
      call_id: toolRequest.call_id,
      producer: `agent:${this.config.agent_id}`,
      payload_hash: this.hashPayload(resultPayload),
      payload: resultPayload,
    };

    await this.appendEventToLedger(resultEvent);
  }

  /**
   * Append event to ledger via HTTP
   */
  private async appendEventToLedger(event: any): Promise<void> {
    try {
      const response = await fetch(`${this.config.ledger_url}/ledger/append`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
      });

      if (!response.ok) {
        throw new Error(`Ledger returned ${response.status}`);
      }
    } catch (error) {
      console.warn(`[Agent] Failed to append event:`, error);
      throw error;
    }
  }

  /**
   * Record checkpoint event to ledger (for audit)
   */
  private async appendCheckpointEventToLedger(checkpoint: CheckpointRecord): Promise<void> {
    try {
      const event = {
        event_id: `evt-checkpoint-${checkpoint.timestamp_ms}`,
        type: "consumer.checkpoint",
        v: 1,
        ts: new Date(checkpoint.timestamp_ms).toISOString(),
        correlation_id: `checkpoint-${this.config.agent_id}`,
        producer: `agent:${this.config.agent_id}`,
        payload_hash: this.hashPayload(checkpoint),
        payload: checkpoint,
      };

      await this.appendEventToLedger(event);
    } catch (error) {
      // Don't fail if checkpoint event fails to record
      console.warn(`[Agent] Checkpoint event failed:`, error);
    }
  }

  /**
   * Simple SHA256 canonical hash
   */
  private hashPayload(payload: any): string {
    const canonical = JSON.stringify(payload, Object.keys(payload).sort());
    return crypto.createHash("sha256").update(canonical).digest("hex");
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    this.stopPolling();
    await this.saveCheckpoint();
    console.log(`[Agent] LedgerClient shutdown complete`);
  }
}

/**
 * Initialize LedgerClient and return instance
 */
export async function initializeLedgerClient(
  config: LedgerIntegrationConfig
): Promise<LedgerClient> {
  const client = new LedgerClient(config);
  await client.initialize();
  return client;
}

/**
 * Shutdown LedgerClient
 */
export async function shutdownLedgerClient(ledgerClient: LedgerClient | null): Promise<void> {
  if (ledgerClient) {
    await ledgerClient.shutdown();
  }
}
