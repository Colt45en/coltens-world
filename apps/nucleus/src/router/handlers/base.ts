/**
 * UEE Handler Base Template
 *
 * Extend this class to implement a specific task handler.
 * Provides common utilities: validation, logging, state management, audit tracking.
 *
 * Example:
 *   class MyLexiconOpHandler extends UEEHandlerBase {
 *     async execute(envelope, context) {
 *       const { lexicon_op } = envelope.inputs;
 *       // ... business logic
 *       return this.success({ lexicon_op: outputs }, audit, state_delta);
 *     }
 *   }
 */

import type { UnifiedEngineEnvelope } from "@world-engine/protocol";
import {
  narrowByTaskType
} from "@world-engine/protocol";
import { z } from "zod";
import type { UEEHandlerContext, UEEHandlerResponse } from "../uee";

/**
 * Format Zod validation errors for display
 */
function formatValidationErrors(errors: any): string {
  return errors.errors
    .map((e: any) => `${e.path.join('.')}: ${e.message}`)
    .join('\n');
}

// ============================================================================
// Base Handler Class
// ============================================================================

export abstract class UEEHandlerBase {
  protected readonly logger: Console;
  protected readonly taskType: string;

  constructor(taskType: string, logger: Console = console) {
    this.taskType = taskType;
    this.logger = logger;
  }

  // ========================================================================
  // Abstract Method (Implement in Subclass)
  // ========================================================================

  /**
   * Execute the task. Implement this in subclass.
   */
  abstract execute(
    envelope: UnifiedEngineEnvelope,
    context: UEEHandlerContext
  ): Promise<UEEHandlerResponse>;

  // ========================================================================
  // Validation Helpers
  // ========================================================================

  /**
   * Assert task type matches expected (for type narrowing)
   */
  protected assertTaskType<T extends string>(
    envelope: UnifiedEngineEnvelope,
    expected: T
  ): asserts envelope is UnifiedEngineEnvelope {
    if (envelope.task.type !== expected) {
      throw new Error(
        `Expected task type "${expected}", got "${envelope.task.type}"`
      );
    }
  }

  /**
   * Validate envelope against a Zod schema (useful for semantic validation)
   */
  protected validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
    try {
      return schema.parse(data);
    } catch (err) {
      if (err instanceof z.ZodError) {
        throw new Error(`Validation failed:\n${formatValidationErrors(err)}`);
      }
      throw err;
    }
  }

  /**
   * Validate and narrow to specific task type
   */
  protected requireInputs<T extends string>(
    envelope: UnifiedEngineEnvelope,
    taskType: T
  ): Record<T, any> {
    if (!narrowByTaskType(envelope, taskType as any)) {
      throw new Error(
        `Task type mismatch: expected ${taskType}`
      );
    }
    const inputs = envelope.inputs as Record<T, any>;
    if (!inputs[taskType]) {
      throw new Error(`Missing required inputs for task type: ${taskType}`);
    }
    return inputs;
  }

  // ========================================================================
  // Logging Helpers
  // ========================================================================

  /**
   * Log task start
   */
  protected logStart(context: UEEHandlerContext, details?: Record<string, any>): void {
    this.logger.log(
      `[${this.taskType}] START task=${context.taskId} mode=${context.mode}`,
      details || ""
    );
  }

  /**
   * Log task success
   */
  protected logSuccess(context: UEEHandlerContext, details?: Record<string, any>): void {
    this.logger.log(
      `[${this.taskType}] SUCCESS task=${context.taskId}`,
      details || ""
    );
  }

  /**
   * Log task error
   */
  protected logError(context: UEEHandlerContext, error: Error | string): void {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.error(`[${this.taskType}] ERROR task=${context.taskId}: ${message}`);
  }

  /**
   * Log debug info
   */
  protected logDebug(context: UEEHandlerContext, message: string, data?: any): void {
    if ((this.logger as any).debug) {
      (this.logger as any).debug(
        `[${this.taskType}] DEBUG task=${context.taskId}: ${message}`,
        data
      );
    }
  }

  // ========================================================================
  // Response Builders
  // ========================================================================

  /**
   * Build success response
   */
  protected success(
    context: UEEHandlerContext,
    outputs?: Record<string, unknown>,
    audit?: Record<string, unknown>,
    state_delta?: Record<string, unknown>
  ): UEEHandlerResponse {
    const response: any = {
      ok: true,
      taskId: context.taskId,
      taskType: context.taskType,
    };
    if (outputs) response.outputs = outputs;
    if (audit) response.audit = audit;
    if (state_delta) response.state_delta = state_delta;
    return response;
  }

  /**
   * Build error response
   */
  protected error(
    context: UEEHandlerContext,
    message: string,
    errors?: string[]
  ): UEEHandlerResponse {
    return {
      ok: false,
      taskId: context.taskId,
      taskType: context.taskType,
      errors: [message, ...(errors || [])],
    };
  }

  /**
   * Build error response from exception
   */
  protected errorFromException(
    context: UEEHandlerContext,
    err: unknown
  ): UEEHandlerResponse {
    const message = err instanceof Error ? err.message : String(err);
    return this.error(context, `Handler execution failed: ${message}`);
  }

  // ========================================================================
  // Audit Tracking
  // ========================================================================

  /**
   * Create audit entry for speculative items
   */
  protected createSpeculativeItem(
    id: string,
    detail: string,
    hypothesized_payoff: string,
    due_by: string
  ): Record<string, unknown> {
    return {
      id,
      detail,
      hypothesized_payoff,
      due_by,
      created_at: new Date().toISOString(),
      speculative: true,
    };
  }

  /**
   * Create foreshadow ledger entry
   */
  protected createForeshadowEntry(
    id: string,
    detail: string,
    payoff_hypothesis: string,
    due_by: string
  ): Record<string, unknown> {
    return {
      id,
      detail,
      payoff_hypothesis,
      due_by,
      speculative: true,
    };
  }

  /**
   * Create compliance audit
   */
  protected createComplianceAudit(passed: boolean, notes: string[]): Record<string, unknown> {
    return {
      passed,
      notes,
      checked_at: new Date().toISOString(),
    };
  }

  // ========================================================================
  // State Management
  // ========================================================================

  /**
   * Create state delta for story progression
   */
  protected createStateDelta(
    story_state?: Record<string, unknown>,
    lexicon_state?: Record<string, unknown>
  ): Record<string, unknown> {
    return {
      story_state,
      lexicon_state,
      delta_timestamp: new Date().toISOString(),
    };
  }

  /**
   * Merge state deltas
   */
  protected mergeStateDeltas(
    ...deltas: Record<string, unknown>[]
  ): Record<string, unknown> {
    const merged: Record<string, unknown> = {};
    for (const delta of deltas) {
      Object.assign(merged, delta);
    }
    return merged;
  }
}

// ============================================================================
// Specialized Handler Templates
// ============================================================================

/**
 * Template for Lexicon Operation handler
 */
export abstract class LexiconOpHandlerBase extends UEEHandlerBase {
  constructor(logger: Console = console) {
    super("lexicon_op", logger);
  }

  protected async executeTyped(
    envelope: UnifiedEngineEnvelope,
    context: UEEHandlerContext,
    lexicon_op: any
  ): Promise<UEEHandlerResponse> {
    throw new Error("Override executeTyped() in subclass");
  }

  async execute(
    envelope: UnifiedEngineEnvelope,
    context: UEEHandlerContext
  ): Promise<UEEHandlerResponse> {
    try {
      this.assertTaskType(envelope, "lexicon_op");
      const inputs = this.requireInputs(envelope, "lexicon_op");
      this.logStart(context, { term: inputs.lexicon_op.term });
      return await this.executeTyped(envelope, context, inputs.lexicon_op);
    } catch (err) {
      this.logError(context, err as Error);
      return this.errorFromException(context, err);
    }
  }
}

/**
 * Template for HCE Run handler
 */
export abstract class HceRunHandlerBase extends UEEHandlerBase {
  constructor(logger: Console = console) {
    super("hce_run", logger);
  }

  protected async executeTyped(
    envelope: UnifiedEngineEnvelope,
    context: UEEHandlerContext,
    hce_run: any
  ): Promise<UEEHandlerResponse> {
    throw new Error("Override executeTyped() in subclass");
  }

  async execute(
    envelope: UnifiedEngineEnvelope,
    context: UEEHandlerContext
  ): Promise<UEEHandlerResponse> {
    try {
      this.assertTaskType(envelope, "hce_run");
      const inputs = this.requireInputs(envelope, "hce_run");
      this.logStart(context, { topic: inputs.hce_run.topic });
      return await this.executeTyped(envelope, context, inputs.hce_run);
    } catch (err) {
      this.logError(context, err as Error);
      return this.errorFromException(context, err);
    }
  }
}

/**
 * Template for Scene handler
 */
export abstract class SceneHandlerBase extends UEEHandlerBase {
  constructor(logger: Console = console) {
    super("scene", logger);
  }

  protected async executeTyped(
    envelope: UnifiedEngineEnvelope,
    context: UEEHandlerContext,
    scene: any
  ): Promise<UEEHandlerResponse> {
    throw new Error("Override executeTyped() in subclass");
  }

  async execute(
    envelope: UnifiedEngineEnvelope,
    context: UEEHandlerContext
  ): Promise<UEEHandlerResponse> {
    try {
      this.assertTaskType(envelope, "scene");
      const inputs = this.requireInputs(envelope, "scene");
      this.logStart(context);
      return await this.executeTyped(envelope, context, inputs.scene);
    } catch (err) {
      this.logError(context, err as Error);
      return this.errorFromException(context, err);
    }
  }
}

/**
 * Template for Sentence Analysis handler
 */
export abstract class AnalyzeSentenceHandlerBase extends UEEHandlerBase {
  constructor(logger: Console = console) {
    super("analyze_sentence", logger);
  }

  protected async executeTyped(
    envelope: UnifiedEngineEnvelope,
    context: UEEHandlerContext,
    analyze_sentence: any
  ): Promise<UEEHandlerResponse> {
    throw new Error("Override executeTyped() in subclass");
  }

  async execute(
    envelope: UnifiedEngineEnvelope,
    context: UEEHandlerContext
  ): Promise<UEEHandlerResponse> {
    try {
      this.assertTaskType(envelope, "analyze_sentence");
      const inputs = this.requireInputs(envelope, "analyze_sentence");
      this.logStart(context);
      return await this.executeTyped(envelope, context, inputs.analyze_sentence);
    } catch (err) {
      this.logError(context, err as Error);
      return this.errorFromException(context, err);
    }
  }
}
