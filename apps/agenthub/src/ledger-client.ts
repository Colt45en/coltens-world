/**
 * AGENTHUB LEDGER CLIENT
 *
 * AgentHub integration with the Nucleus ledger.
 * Converts tool requests into ledger events, records approvals, emits results.
 *
 * Flow:
 * 1. AgentHub receives ToolRequest event
 * 2. If approval required → emit ApprovalRequested
 * 3. Wait for ApprovalDecision in ledger
 * 4. Execute tool
 * 5. Emit ToolResult with hashes + artifacts
 *
 * All state is in the ledger; AgentHub is stateless.
 */

import axios from 'axios';
import { EventEmitter } from 'node:events';
import {
  AnyEvent,
  ToolExecuteRequest,
  ToolExecuteResult,
  ApprovalRequested,
  ApprovalDecision,
  canonicalJSON,
  isToolRequest,
  isApprovalDecision,
} from '@world-engine/ledger-contracts';
import crypto from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';

export interface LedgerClientConfig {
  ledger_url: string;
  agent_id: string;
  poll_interval_ms?: number;
  timeout_ms?: number;
}

/**
 * LedgerClient: AgentHub's interface to the deterministic ledger.
 */
export class LedgerClient extends EventEmitter {
  private readonly config: LedgerClientConfig;
  private lastSeq: number = 0;
  private pollHandle?: NodeJS.Timer;

  constructor(config: LedgerClientConfig) {
    super();
    this.config = config;
  }

  /**
   * Start polling for new events.
   */
  public startPolling(): void {
    const interval = this.config.poll_interval_ms ?? 500;

    this.pollHandle = setInterval(async () => {
      try {
        const events = await this.fetchNewEvents();
        for (const event of events) {
          this.emit('event', event);
        }
      } catch (error) {
        this.emit('error', error);
      }
    }, interval);
  }

  /**
   * Stop polling.
   */
  public stopPolling(): void {
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
    }
  }

  /**
   * Fetch events after the last known seq.
   */
  private async fetchNewEvents(): Promise<AnyEvent[]> {
    const url = `${this.config.ledger_url}/ledger/stream?after_seq=${this.lastSeq}`;
    const response = await axios.get(url);

    if (!response.data.success) {
      throw new Error(`Ledger fetch failed: ${response.data.error}`);
    }

    const events: AnyEvent[] = response.data.events;
    if (events.length > 0) {
      this.lastSeq = events[events.length - 1].seq!;
    }

    return events;
  }

  /**
   * Subscribe to tool requests and handle them.
   *
   * This handler:
   * 1. Checks if approval is required
   * 2. If yes, emits ApprovalRequested and waits for ApprovalDecision
   * 3. If approved (or not required), executes the tool
   * 4. Emits ToolResult with hashes + artifacts
   */
  public onToolRequest(
    handler: (request: ToolExecuteRequest) => Promise<any>
  ): void {
    this.on('event', async (event: AnyEvent) => {
      if (!isToolRequest(event)) return;

      try {
        const request = event;

        // Step 1: Check approval requirement
        if (request.payload.tool.approval_policy.required) {
          // Step 2: Emit ApprovalRequested
          const approval_id = this.generateApprovalId(request.call_id);
          const approved_event: Omit<ApprovalRequested, 'seq'> = {
            event_id: uuidv4(),
            type: 'approval.requested',
            v: 1,
            ts: new Date().toISOString(),
            correlation_id: request.correlation_id,
            call_id: request.call_id,
            producer: this.config.agent_id,
            payload_hash: '', // Will be computed by ledger
            payload: {
              approval_id,
              policy_id: request.payload.tool.approval_policy.policy_id ?? 'default',
              tool_id: request.payload.tool.id,
              tool_input: request.payload.input,
              reason: `Approval required for ${request.payload.tool.id}`,
            },
          };

          await this.appendEvent(approved_event);

          // Step 3: Wait for approval decision
          const decision = await this.waitForApproval(approval_id);
          if (decision.payload.decision !== 'approved') {
            // Rejection or expiration
            const result: Omit<ToolExecuteResult, 'seq'> = {
              event_id: uuidv4(),
              type: 'tool.execute.result',
              v: 1,
              ts: new Date().toISOString(),
              correlation_id: request.correlation_id,
              call_id: request.call_id,
              producer: this.config.agent_id,
              payload_hash: '',
              payload: {
                status: 'error',
                error: {
                  code: 'APPROVAL_DENIED',
                  message: `Approval decision: ${decision.payload.decision}`,
                },
              },
            };
            await this.appendEvent(result);
            return;
          }
        }

        // Step 4: Execute the tool
        const startTime = Date.now();
        let toolResult: any;
        let error: any = null;

        try {
          toolResult = await handler(request);
        } catch (e) {
          error = e;
        }

        const duration_ms = Date.now() - startTime;

        // Step 5: Emit ToolResult
        const result: Omit<ToolExecuteResult, 'seq'> = {
          event_id: uuidv4(),
          type: 'tool.execute.result',
          v: 1,
          ts: new Date().toISOString(),
          correlation_id: request.correlation_id,
          call_id: request.call_id,
          producer: this.config.agent_id,
          payload_hash: '',
          payload: {
            status: error ? 'error' : 'ok',
            output: toolResult,
            error: error ? {
              code: 'TOOL_ERROR',
              message: error.message,
              stack: error.stack,
            } : null,
            evidence: {
              duration_ms,
              output_hash: toolResult
                ? crypto
                    .createHash('sha256')
                    .update(JSON.stringify(toolResult))
                    .digest('hex')
                : undefined,
            },
          },
        };

        await this.appendEvent(result);
      } catch (error) {
        this.emit('error', error);
      }
    });
  }

  /**
   * Wait for an approval decision with timeout.
   */
  private async waitForApproval(
    approval_id: string,
    timeout_ms?: number
  ): Promise<ApprovalDecision> {
    const deadline = Date.now() + (timeout_ms ?? this.config.timeout_ms ?? 60000);

    while (Date.now() < deadline) {
      const events = await this.fetchNewEvents();
      for (const event of events) {
        if (isApprovalDecision(event) && event.payload.approval_id === approval_id) {
          return event;
        }
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error(`Approval timeout: ${approval_id}`);
  }

  /**
   * Append an event to the ledger.
   */
  public async appendEvent(
    event: Omit<AnyEvent, 'seq' | 'payload_hash'>
  ): Promise<number> {
    const payload_hash = crypto
      .createHash('sha256')
      .update(canonicalJSON(event.payload))
      .digest('hex');

    const fullEvent = {
      ...event,
      payload_hash,
    };

    const url = `${this.config.ledger_url}/ledger/append`;
    const response = await axios.post(url, fullEvent);

    if (!response.data.success) {
      throw new Error(`Ledger append failed: ${response.data.error}`);
    }

    return response.data.seqs[0];
  }

  /**
   * Generate a deterministic approval_id.
   */
  private generateApprovalId(call_id: string): string {
    const hash = crypto
      .createHash('sha256')
      .update(`appr_${call_id}`)
      .digest('hex')
      .substring(0, 16);
    return `appr_${hash}`;
  }

  /**
   * Get the history of a call.
   */
  public async getCallHistory(call_id: string): Promise<AnyEvent[]> {
    const url = `${this.config.ledger_url}/ledger/call/${call_id}`;
    const response = await axios.get(url);

    if (!response.data.success) {
      throw new Error(`Ledger fetch failed: ${response.data.error}`);
    }

    return response.data.events;
  }
}

/**
 * Example usage in AgentHub:
 *
 * const client = new LedgerClient({
 *   ledger_url: 'http://localhost:3000',
 *   agent_id: 'agenthub',
 * });
 *
 * client.onToolRequest(async (request) => {
 *   const tool = getTool(request.payload.tool.id);
 *   return await tool.execute(request.payload.input.args);
 * });
 *
 * client.startPolling();
 */
