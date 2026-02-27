/**
 * Nucleus handler for curriculum wheel events
 *
 * Bridges WheelRuntime (Python) with agent tool execution (Nucleus)
 * - Receives nucleus.tool_call events (from wheel)
 * - Routes to agent tool executor
 * - Sends nucleus.tool_result back via EventBus
 */

import { V1EventEnvelope, makeV1Command } from '@world-engine/protocol';
import { EventBus } from '../eventBus';
import { ToolExecutor } from '../tool/executor';

export interface WheelHandlerConfig {
  eventBus: EventBus;
  toolExecutor: ToolExecutor;
  /**
   * Trace ID for all wheel operations
   * Should match the wheel state trace_id in runtime/curriculum/wheel.state.v1.json
   */
  traceId?: string;
}

/**
 * Register curriculum wheel handler into EventBus
 * Call once during Nucleus initialization
 *
 * Example:
 * ```typescript
 * const wheelHandler = setupWheelHandler({
 *   eventBus,
 *   toolExecutor,
 *   traceId: 'trace_wheel_curriculum'
 * });
 * ```
 */
export function setupWheelHandler(config: WheelHandlerConfig): WheelEventHandler {
  const handler = new WheelEventHandler(config);
  handler.register();
  return handler;
}

export class WheelEventHandler {
  private eventBus: EventBus;
  private toolExecutor: ToolExecutor;
  private traceId: string;
  private inflight: Map<string, string> = new Map(); // callId → origTraceId

  constructor(config: WheelHandlerConfig) {
    this.eventBus = config.eventBus;
    this.toolExecutor = config.toolExecutor;
    this.traceId = config.traceId || 'trace_wheel_curriculum';
  }

  register(): void {
    // Listen for tool calls from wheel runtime
    this.eventBus.subscribe_event('nucleus.tool_call', async (env: V1EventEnvelope) => {
      await this.handleToolCall(env);
    });

    // Listen for any upstream tool results (if integrated with larger system)
    // This won't normally happen unless wheel is part of larger orchestration
    this.eventBus.subscribe_event('nucleus.tool_result', async (env: V1EventEnvelope) => {
      // Tool result came back - just log it
      // Wheel runtime will subscribe separately to handle state transitions
      console.log(`[WheelHandler] Tool result received, trace=${env.trace_id}, call_id=${env.payload.call_id}`);
    });
  }

  private async handleToolCall(env: V1EventEnvelope): Promise<void> {
    const { payload, trace_id, seq } = env;
    const { call_id, tool_name, args } = payload;

    // Only handle curriculum tools
    if (!tool_name?.startsWith('curriculum.')) {
      return;
    }

    console.log(`[WheelHandler] Handling curriculum tool: ${tool_name}, call_id=${call_id}`);

    // Guard: Don't process if already inflight
    if (this.inflight.has(call_id)) {
      console.warn(`[WheelHandler] Duplicate call_id=${call_id}, ignoring`);
      return;
    }

    this.inflight.set(call_id, trace_id);

    try {
      // Execute tool via executor
      const result = await this.toolExecutor.execute(tool_name, args);

      // Send result back as nucleus.tool_result command
      const cmd = makeV1Command({
        command_type: 'nucleus.tool_result',
        ts_ms: Date.now(),
        trace_id: trace_id || this.traceId,
        payload: {
          call_id,
          seq,
          ok: true,
          result,
        },
      });

      await this.eventBus.send_command(cmd);
    } catch (err) {
      console.error(`[WheelHandler] Tool execution failed: ${tool_name}`, err);

      const cmd = makeV1Command({
        command_type: 'nucleus.tool_result',
        ts_ms: Date.now(),
        trace_id: trace_id || this.traceId,
        payload: {
          call_id,
          seq,
          ok: false,
          result: {
            error: String(err),
            message: err instanceof Error ? err.message : 'Unknown error',
          },
        },
      });

      await this.eventBus.send_command(cmd);
    } finally {
      this.inflight.delete(call_id);
    }
  }
}
