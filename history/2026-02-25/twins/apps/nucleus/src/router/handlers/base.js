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
import { narrowByTaskType } from "@world-engine/protocol";
import { z } from "zod";
/**
 * Format Zod validation errors for display
 */
function formatValidationErrors(errors) {
    return errors.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join('\n');
}
// ============================================================================
// Base Handler Class
// ============================================================================
export class UEEHandlerBase {
    logger;
    taskType;
    constructor(taskType, logger = console) {
        this.taskType = taskType;
        this.logger = logger;
    }
    // ========================================================================
    // Validation Helpers
    // ========================================================================
    /**
     * Assert task type matches expected (for type narrowing)
     */
    assertTaskType(envelope, expected) {
        if (envelope.task.type !== expected) {
            throw new Error(`Expected task type "${expected}", got "${envelope.task.type}"`);
        }
    }
    /**
     * Validate envelope against a Zod schema (useful for semantic validation)
     */
    validate(schema, data) {
        try {
            return schema.parse(data);
        }
        catch (err) {
            if (err instanceof z.ZodError) {
                throw new Error(`Validation failed:\n${formatValidationErrors(err)}`);
            }
            throw err;
        }
    }
    /**
     * Validate and narrow to specific task type
     */
    requireInputs(envelope, taskType) {
        if (!narrowByTaskType(envelope, taskType)) {
            throw new Error(`Task type mismatch: expected ${taskType}`);
        }
        const inputs = envelope.inputs;
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
    logStart(context, details) {
        this.logger.log(`[${this.taskType}] START task=${context.taskId} mode=${context.mode}`, details || "");
    }
    /**
     * Log task success
     */
    logSuccess(context, details) {
        this.logger.log(`[${this.taskType}] SUCCESS task=${context.taskId}`, details || "");
    }
    /**
     * Log task error
     */
    logError(context, error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`[${this.taskType}] ERROR task=${context.taskId}: ${message}`);
    }
    /**
     * Log debug info
     */
    logDebug(context, message, data) {
        if (this.logger.debug) {
            this.logger.debug(`[${this.taskType}] DEBUG task=${context.taskId}: ${message}`, data);
        }
    }
    // ========================================================================
    // Response Builders
    // ========================================================================
    /**
     * Build success response
     */
    success(context, outputs, audit, state_delta) {
        const response = {
            ok: true,
            taskId: context.taskId,
            taskType: context.taskType,
        };
        if (outputs)
            response.outputs = outputs;
        if (audit)
            response.audit = audit;
        if (state_delta)
            response.state_delta = state_delta;
        return response;
    }
    /**
     * Build error response
     */
    error(context, message, errors) {
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
    errorFromException(context, err) {
        const message = err instanceof Error ? err.message : String(err);
        return this.error(context, `Handler execution failed: ${message}`);
    }
    // ========================================================================
    // Audit Tracking
    // ========================================================================
    /**
     * Create audit entry for speculative items
     */
    createSpeculativeItem(id, detail, hypothesized_payoff, due_by) {
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
    createForeshadowEntry(id, detail, payoff_hypothesis, due_by) {
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
    createComplianceAudit(passed, notes) {
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
    createStateDelta(story_state, lexicon_state) {
        return {
            story_state,
            lexicon_state,
            delta_timestamp: new Date().toISOString(),
        };
    }
    /**
     * Merge state deltas
     */
    mergeStateDeltas(...deltas) {
        const merged = {};
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
export class LexiconOpHandlerBase extends UEEHandlerBase {
    constructor(logger = console) {
        super("lexicon_op", logger);
    }
    async executeTyped(envelope, context, lexicon_op) {
        throw new Error("Override executeTyped() in subclass");
    }
    async execute(envelope, context) {
        try {
            this.assertTaskType(envelope, "lexicon_op");
            const inputs = this.requireInputs(envelope, "lexicon_op");
            this.logStart(context, { term: inputs.lexicon_op.term });
            return await this.executeTyped(envelope, context, inputs.lexicon_op);
        }
        catch (err) {
            this.logError(context, err);
            return this.errorFromException(context, err);
        }
    }
}
/**
 * Template for HCE Run handler
 */
export class HceRunHandlerBase extends UEEHandlerBase {
    constructor(logger = console) {
        super("hce_run", logger);
    }
    async executeTyped(envelope, context, hce_run) {
        throw new Error("Override executeTyped() in subclass");
    }
    async execute(envelope, context) {
        try {
            this.assertTaskType(envelope, "hce_run");
            const inputs = this.requireInputs(envelope, "hce_run");
            this.logStart(context, { topic: inputs.hce_run.topic });
            return await this.executeTyped(envelope, context, inputs.hce_run);
        }
        catch (err) {
            this.logError(context, err);
            return this.errorFromException(context, err);
        }
    }
}
/**
 * Template for Scene handler
 */
export class SceneHandlerBase extends UEEHandlerBase {
    constructor(logger = console) {
        super("scene", logger);
    }
    async executeTyped(envelope, context, scene) {
        throw new Error("Override executeTyped() in subclass");
    }
    async execute(envelope, context) {
        try {
            this.assertTaskType(envelope, "scene");
            const inputs = this.requireInputs(envelope, "scene");
            this.logStart(context);
            return await this.executeTyped(envelope, context, inputs.scene);
        }
        catch (err) {
            this.logError(context, err);
            return this.errorFromException(context, err);
        }
    }
}
/**
 * Template for Sentence Analysis handler
 */
export class AnalyzeSentenceHandlerBase extends UEEHandlerBase {
    constructor(logger = console) {
        super("analyze_sentence", logger);
    }
    async executeTyped(envelope, context, analyze_sentence) {
        throw new Error("Override executeTyped() in subclass");
    }
    async execute(envelope, context) {
        try {
            this.assertTaskType(envelope, "analyze_sentence");
            const inputs = this.requireInputs(envelope, "analyze_sentence");
            this.logStart(context);
            return await this.executeTyped(envelope, context, inputs.analyze_sentence);
        }
        catch (err) {
            this.logError(context, err);
            return this.errorFromException(context, err);
        }
    }
}
