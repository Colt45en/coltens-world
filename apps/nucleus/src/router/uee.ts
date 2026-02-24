/**
 * Nucleus UEE Router
 *
 * Routes Unified Engine Envelope tasks to handlers by task.type.
 * Central dispatch point for task execution + orchestration.
 *
 * Architecture:
 * - ParentBusEnvelope (transport) wraps UEE payload
 * - Router dispatches by task.type
 * - Handlers return typed outputs + audit + state_delta
 * - Consistent response shape across all task types
 */

import type { UnifiedEngineEnvelope } from "@world-engine/protocol";
import {
  getTaskId,
  getTaskType,
  hasRequiredInputs,
  narrowByTaskType,
  parseUEE,
  shouldIncludeField
} from "@world-engine/protocol";
import handleBrainControl from "./handlers/brainControl";
import handleBrainTrain from "./handlers/brainTrain";

// ============================================================================
// Handler Types
// ============================================================================

/**
 * Base handler context: shared by all task handlers
 */
export interface UEEHandlerContext {
  taskId: string;
  taskType: string;
  mode: "generate" | "apply" | "analyze";
  sessionId: string;
  timestamp: number;
}

/**
 * Handler response: consistent structure across all task types
 */
export interface UEEHandlerResponse {
  ok: boolean;
  taskId: string;
  taskType: string;
  outputs?: Record<string, unknown>;
  audit?: Record<string, unknown>;
  state_delta?: { story_state?: Record<string, unknown>; lexicon_state?: Record<string, unknown> };
  errors?: string[];
}

/**
 * Handler function: receives envelope + context, returns typed response
 */
export type UEEHandler = (
  envelope: UnifiedEngineEnvelope,
  context: UEEHandlerContext
) => Promise<UEEHandlerResponse>;

/**
 * Handler registry: task type → handler
 */
interface HandlerRegistry {
  [taskType: string]: UEEHandler;
}

// ============================================================================
// Router Class
// ============================================================================

export class UEERouter {
  private handlers: HandlerRegistry = {};
  private readonly logger = console; // Replace with your logger

  constructor() {
    // Register default handlers (stubs)
    this.registerHandler("lexicon_op", this.handleLexiconOp.bind(this));
    this.registerHandler("hce_run", this.handleHceRun.bind(this));
    this.registerHandler("scene_gen", this.handleSceneGen.bind(this));
    this.registerHandler("analyze_sentence", this.handleAnalyzeSentence.bind(this));

    // Register brain handlers
    this.registerHandler("brain_control", handleBrainControl);
    this.registerHandler("brain_train", handleBrainTrain);
  }

  // ========================================================================
  // Public API
  // ========================================================================

  /**
   * Register a handler for a task type
   */
  registerHandler(taskType: string, handler: UEEHandler): void {
    this.handlers[taskType] = handler;
    this.logger.log(`[UEE Router] Registered handler for task type: ${taskType}`);
  }

  /**
   * Route and execute a UEE envelope
   */
  async route(
    input: unknown,
    sessionId: string
  ): Promise<UEEHandlerResponse> {
    // Parse
    const parseResult = parseUEE(input);
    if (!parseResult.ok) {
      return {
        ok: false,
        taskId: "unknown",
        taskType: "unknown",
        errors: [parseResult.message],
      };
    }

    const envelope = parseResult.envelope;
    const taskType = getTaskType(envelope);
    const taskId = getTaskId(envelope);

    // Validate required inputs
    if (!hasRequiredInputs(envelope)) {
      return {
        ok: false,
        taskId,
        taskType,
        errors: [`Task type "${taskType}" missing required inputs`],
      };
    }

    // Create context
    const context: UEEHandlerContext = {
      taskId,
      taskType,
      mode: envelope.task.mode,
      sessionId,
      timestamp: Date.now(),
    };

    // Dispatch
    const handler = this.handlers[taskType];
    if (!handler) {
      return {
        ok: false,
        taskId,
        taskType,
        errors: [`No handler registered for task type: ${taskType}`],
      };
    }

    try {
      this.logger.log(`[UEE Router] Routing task: ${taskType} (id=${taskId})`);
      const response = await handler(envelope, context);

      // Respect controls.return config: only include requested fields
      if (!shouldIncludeField(envelope, "include_prose")) {
        delete response.outputs;
      }
      if (!shouldIncludeField(envelope, "include_audit")) {
        delete response.audit;
      }
      if (!shouldIncludeField(envelope, "include_state_delta")) {
        delete response.state_delta;
      }

      this.logger.log(
        `[UEE Router] Task complete: ${taskType} (id=${taskId}) ok=${response.ok}`
      );
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[UEE Router] Handler error for ${taskType} (id=${taskId}):`,
        message
      );
      return {
        ok: false,
        taskId,
        taskType,
        errors: [`Handler execution failed: ${message}`],
      };
    }
  }

  /**
   * Get registered task types (useful for debugging/discovery)
   */
  getRegisteredTaskTypes(): string[] {
    return Object.keys(this.handlers).sort((a, b) => a.localeCompare(b));
  }

  // ========================================================================
  // Default Handlers (Stubs - Replace with Real Implementations)
  // ========================================================================

  /**
   * Handle lexicon_op: term definition/constraint/artifact operations
   */
  private async handleLexiconOp(
    envelope: UnifiedEngineEnvelope,
    context: UEEHandlerContext
  ): Promise<UEEHandlerResponse> {
    if (!narrowByTaskType(envelope, "lexicon_op")) {
      return this.errorResponse(context, "Expected lexicon_op task");
    }

    const lexicon_op = envelope.inputs.lexicon_op as Record<string, unknown>;
    if (!lexicon_op) {
      return this.errorResponse(context, "Missing lexicon_op inputs");
    }

    // Stub: real lexicon operation logic will be added
    const outputs = {
      term: lexicon_op.term || "unknown",
      operation: `${envelope.task.mode}:lexicon_op`,
      plan: {
        objective: lexicon_op.objective || "Not specified",
        constraints: (lexicon_op.constraints as unknown[]) || [],
        tradeoffs: (lexicon_op.tradeoffs as unknown[]) || [],
        invariants: (lexicon_op.invariants as unknown[]) || [],
      },
      actions: [
        {
          step: 1,
          do: "Process term",
          why: lexicon_op.objective || "Not specified",
          risk: "None identified yet",
          speculative: false,
        },
      ],
      result_preview: {
        before: lexicon_op.artifact || "N/A",
        after: lexicon_op.artifact || "N/A", // Will compute real after state during implementation
      },
    };

    return this.successResponse(context, { lexicon_op: outputs });
  }

  /**
   * Handle hce_run: Hierarchical-Contextual Expansion
   */
  private async handleHceRun(
    envelope: UnifiedEngineEnvelope,
    context: UEEHandlerContext
  ): Promise<UEEHandlerResponse> {
    if (!narrowByTaskType(envelope, "hce_run")) {
      return this.errorResponse(context, "Expected hce_run task");
    }

    const hce_run = envelope.inputs.hce_run as Record<string, unknown>;
    if (!hce_run) {
      return this.errorResponse(context, "Missing hce_run inputs");
    }

    // Stub: real HCE expansion logic will be added
    const outputs = {
      topic: hce_run.topic || "Not specified",
      mode: envelope.task.mode,
      roles_used: (hce_run.roles_enabled as unknown[]) || ["inner_orchestrator"],
      observations_incorporated: (hce_run.observations as unknown[]) || [],
      constraints_checked: (hce_run.constraints as unknown[]) || [],
      analysis_summary: "HCE analysis would be computed here",
    };

    return this.successResponse(context, { hce_run: outputs });
  }

  /**
   * Handle scene: narrative scene generation or analysis
   */
  private async handleSceneGen(
    envelope: UnifiedEngineEnvelope,
    context: UEEHandlerContext
  ): Promise<UEEHandlerResponse> {
    if (!narrowByTaskType(envelope, "scene_gen")) {
      return this.errorResponse(context, "Expected scene_gen task");
    }

    const { scene_gen } = envelope.inputs;
    if (!scene_gen) {
      return this.errorResponse(context, "Missing scene_gen inputs");
    }

    // Stub implementation: scene generation logic will be added
    const sceneBrief = (scene_gen as Record<string, unknown>).scene_brief as Record<string, unknown> | undefined;
    const outputs = {
      scene_generated: !!sceneBrief,
      pov: (sceneBrief?.pov as string) || "Unknown",
      prose: "Scene prose would be generated here",
      structural_notes: (sceneBrief?.style_notes as unknown[]) || [],
    };

    return this.successResponse(context, { scene_gen: outputs });
  }

  /**
   * Handle analyze_sentence: linguistic/semantic analysis
   */
  private async handleAnalyzeSentence(
    envelope: UnifiedEngineEnvelope,
    context: UEEHandlerContext
  ): Promise<UEEHandlerResponse> {
    if (!narrowByTaskType(envelope, "analyze_sentence")) {
      return this.errorResponse(context, "Expected analyze_sentence task");
    }

    const analyze_sentence = envelope.inputs.analyze_sentence as Record<string, unknown>;
    if (!analyze_sentence) {
      return this.errorResponse(context, "Missing analyze_sentence inputs");
    }

    // Stub: real sentence analysis logic will be added
    const outputs = {
      sentence: (analyze_sentence.sentence as string) || "",
      structure: "TODO: linguistic parse",
      semantics: "TODO: semantic analysis",
      sentiment: "TODO: sentiment score",
    };

    return this.successResponse(context, { analyze_sentence: outputs });
  }

  // ========================================================================
  // Response Helpers
  // ========================================================================

  private successResponse(
    context: UEEHandlerContext,
    outputs: Record<string, unknown>,
    audit?: Record<string, unknown>,
    state_delta?: Record<string, unknown>
  ): UEEHandlerResponse {
    const response: UEEHandlerResponse = {
      ok: true,
      taskId: context.taskId,
      taskType: context.taskType,
      outputs,
    };

    if (audit) {
      response.audit = audit;
    }
    if (state_delta) {
      response.state_delta = state_delta;
    }

    return response;
  }

  private errorResponse(
    context: UEEHandlerContext,
    error: string
  ): UEEHandlerResponse {
    return {
      ok: false,
      taskId: context.taskId,
      taskType: context.taskType,
      errors: [error],
    };
  }
}

// ============================================================================
// Singleton Instance (Optional)
// ============================================================================

let globalRouter: UEERouter | null = null;

/**
 * Get or create global router instance
 */
export function getUEERouter(): UEERouter {
  globalRouter ??= new UEERouter();
  return globalRouter;
}

/**
 * Reset global router (useful for testing)
 */
export function resetUEERouter(): void {
  globalRouter = null;
}
