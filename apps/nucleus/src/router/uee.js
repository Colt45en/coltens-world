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
import { getTaskId, getTaskType, hasRequiredInputs, narrowByTaskType, parseUEE, shouldIncludeField } from "@world-engine/protocol";
import handleBrainControl from "./handlers/brainControl.js";
import handleBrainTrain from "./handlers/brainTrain.js";
// ============================================================================
// Router Class
// ============================================================================
export class UEERouter {
    handlers = {};
    logger = console; // Replace with your logger
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
    registerHandler(taskType, handler) {
        this.handlers[taskType] = handler;
        this.logger.log(`[UEE Router] Registered handler for task type: ${taskType}`);
    }
    /**
     * Route and execute a UEE envelope
     */
    async route(input, sessionId) {
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
        const context = {
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
            this.logger.log(`[UEE Router] Task complete: ${taskType} (id=${taskId}) ok=${response.ok}`);
            return response;
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(`[UEE Router] Handler error for ${taskType} (id=${taskId}):`, message);
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
    getRegisteredTaskTypes() {
        return Object.keys(this.handlers).sort((a, b) => a.localeCompare(b));
    }
    // ========================================================================
    // Default Handlers (Stubs - Replace with Real Implementations)
    // ========================================================================
    /**
     * Handle lexicon_op: term definition/constraint/artifact operations
     */
    async handleLexiconOp(envelope, context) {
        if (!narrowByTaskType(envelope, "lexicon_op")) {
            return this.errorResponse(context, "Expected lexicon_op task");
        }
        const lexicon_op = envelope.inputs.lexicon_op;
        if (!lexicon_op) {
            return this.errorResponse(context, "Missing lexicon_op inputs");
        }
        // Stub: real lexicon operation logic will be added
        const outputs = {
            term: lexicon_op.term || "unknown",
            operation: `${envelope.task.mode}:lexicon_op`,
            plan: {
                objective: lexicon_op.objective || "Not specified",
                constraints: lexicon_op.constraints || [],
                tradeoffs: lexicon_op.tradeoffs || [],
                invariants: lexicon_op.invariants || [],
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
    async handleHceRun(envelope, context) {
        if (!narrowByTaskType(envelope, "hce_run")) {
            return this.errorResponse(context, "Expected hce_run task");
        }
        const hce_run = envelope.inputs.hce_run;
        if (!hce_run) {
            return this.errorResponse(context, "Missing hce_run inputs");
        }
        // Stub: real HCE expansion logic will be added
        const outputs = {
            topic: hce_run.topic || "Not specified",
            mode: envelope.task.mode,
            roles_used: hce_run.roles_enabled || ["inner_orchestrator"],
            observations_incorporated: hce_run.observations || [],
            constraints_checked: hce_run.constraints || [],
            analysis_summary: "HCE analysis would be computed here",
        };
        return this.successResponse(context, { hce_run: outputs });
    }
    /**
     * Handle scene: narrative scene generation or analysis
     */
    async handleSceneGen(envelope, context) {
        if (!narrowByTaskType(envelope, "scene_gen")) {
            return this.errorResponse(context, "Expected scene_gen task");
        }
        const { scene_gen } = envelope.inputs;
        if (!scene_gen) {
            return this.errorResponse(context, "Missing scene_gen inputs");
        }
        // Stub implementation: scene generation logic will be added
        const sceneBrief = scene_gen.scene_brief;
        const outputs = {
            scene_generated: !!sceneBrief,
            pov: sceneBrief?.pov || "Unknown",
            prose: "Scene prose would be generated here",
            structural_notes: sceneBrief?.style_notes || [],
        };
        return this.successResponse(context, { scene_gen: outputs });
    }
    /**
     * Handle analyze_sentence: linguistic/semantic analysis
     */
    async handleAnalyzeSentence(envelope, context) {
        if (!narrowByTaskType(envelope, "analyze_sentence")) {
            return this.errorResponse(context, "Expected analyze_sentence task");
        }
        const analyze_sentence = envelope.inputs.analyze_sentence;
        if (!analyze_sentence) {
            return this.errorResponse(context, "Missing analyze_sentence inputs");
        }
        // Stub: real sentence analysis logic will be added
        const outputs = {
            sentence: analyze_sentence.sentence || "",
            structure: "TODO: linguistic parse",
            semantics: "TODO: semantic analysis",
            sentiment: "TODO: sentiment score",
        };
        return this.successResponse(context, { analyze_sentence: outputs });
    }
    // ========================================================================
    // Response Helpers
    // ========================================================================
    successResponse(context, outputs, audit, state_delta) {
        const response = {
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
    errorResponse(context, error) {
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
let globalRouter = null;
/**
 * Get or create global router instance
 */
export function getUEERouter() {
    globalRouter ??= new UEERouter();
    return globalRouter;
}
/**
 * Reset global router (useful for testing)
 */
export function resetUEERouter() {
    globalRouter = null;
}
