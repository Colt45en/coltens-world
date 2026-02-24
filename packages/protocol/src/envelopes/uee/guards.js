/**
 * UEE Validation Guards
 *
 * Helper functions to safely parse, narrow, and validate UEE envelopes
 * with consistent error handling and type narrowing for runtime safety.
 */
import { z } from "zod";
import { TaskTypeSchema, UnifiedEngineEnvelopeSchema, } from "./schema.js";
// ============================================================================
// Parse & Validate
// ============================================================================
/**
 * Parse unknown value as UEE envelope with structured error handling
 */
export function parseUEE(input) {
    try {
        const envelope = UnifiedEngineEnvelopeSchema.parse(input);
        return { ok: true, envelope };
    }
    catch (err) {
        if (err instanceof z.ZodError) {
            const message = err.errors
                .map((e) => `${e.path.join(".")}: ${e.message} (${e.code})`)
                .join("\n");
            return { ok: false, errors: err, message };
        }
        return {
            ok: false,
            errors: new z.ZodError([]),
            message: `Unknown error: ${err instanceof Error ? err.message : String(err)}`,
        };
    }
}
/**
 * Safe parse: logs issues but doesn't throw
 */
export function parseUEESafe(input) {
    const result = parseUEE(input);
    if (!result.ok) {
        console.error("[UEE] Parse failed:", result.message);
        return null;
    }
    return result.envelope;
}
/**
 * Partial parse: validate minimum required fields (contract + task + inputs + controls)
 * Useful for early validation before full semantic check
 */
export function parseUEEPartial(input) {
    try {
        const partial = z
            .object({
            contract: z.object({ name: z.literal("UnifiedEngineEnvelope"), version: z.string() }),
            task: z.object({ type: TaskTypeSchema, mode: z.enum(["generate", "apply", "analyze"]), id: z.string() }),
            inputs: z.record(z.unknown()),
            controls: z.object({ use_connectors: z.boolean(), max_words: z.number(), detail_level: z.enum(["low", "medium", "high"]), return: z.record(z.unknown()) }),
        })
            .strict()
            .parse(input);
        return {
            ok: true,
            envelope: partial,
        };
    }
    catch (err) {
        if (err instanceof z.ZodError) {
            const message = err.errors
                .map((e) => `${e.path.join(".")}: ${e.message}`)
                .join("\n");
            return { ok: false, errors: err, message };
        }
        return {
            ok: false,
            errors: new z.ZodError([]),
            message: `Partial parse failed: ${err instanceof Error ? err.message : String(err)}`,
        };
    }
}
// ============================================================================
// Type Narrowing
// ============================================================================
/**
 * Narrow to lexicon_op inputs
 */
export function narrowToLexiconOp(envelope) {
    return envelope.task.type === "lexicon_op" && !!envelope.inputs.lexicon_op;
}
/**
 * Narrow to hce_run inputs
 */
export function narrowToHceRun(envelope) {
    return envelope.task.type === "hce_run" && !!envelope.inputs.hce_run;
}
/**
 * Narrow to scene inputs
 */
export function narrowToScene(envelope) {
    return envelope.task.type === "scene" && !!envelope.inputs.scene;
}
/**
 * Narrow to analyze_sentence inputs
 */
export function narrowToAnalyzeSentence(envelope) {
    return envelope.task.type === "analyze_sentence" && !!envelope.inputs.analyze_sentence;
}
/**
 * Generic narrow: match by task type string
 * Useful for dynamic dispatch
 */
export function narrowByTaskType(envelope, taskType) {
    return envelope.task.type === taskType;
}
// ============================================================================
// Validation Helpers
// ============================================================================
/**
 * Validate task type string
 */
export function isValidTaskType(value) {
    try {
        TaskTypeSchema.parse(value);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Check if envelope has required inputs for its task type
 */
export function hasRequiredInputs(envelope) {
    switch (envelope.task.type) {
        case "lexicon_op":
            return (!!envelope.inputs.lexicon_op &&
                !!envelope.inputs.lexicon_op.term &&
                !!envelope.inputs.lexicon_op.artifact &&
                !!envelope.inputs.lexicon_op.objective);
        case "hce_run":
            return !!envelope.inputs.hce_run && !!envelope.inputs.hce_run.topic;
        case "scene":
            return !!envelope.inputs.scene && !!envelope.inputs.scene.scene_brief;
        case "analyze_sentence":
            return !!envelope.inputs.analyze_sentence && !!envelope.inputs.analyze_sentence.sentence;
        default:
            // Custom task type: lenient (assume handler knows requirements)
            return true;
    }
}
/**
 * Check if outputs should be included in response (based on controls.return)
 */
export function shouldIncludeField(envelope, field) {
    return envelope.controls.return[field] === true;
}
/**
 * Get task type string for routing
 */
export function getTaskType(envelope) {
    return envelope.task.type;
}
/**
 * Get task ID for correlation/tracking
 */
export function getTaskId(envelope) {
    return envelope.task.id;
}
/**
 * Get execution mode
 */
export function getTaskMode(envelope) {
    return envelope.task.mode;
}
// ============================================================================
// Error Formatting
// ============================================================================
/**
 * Format validation errors for user display
 */
export function formatValidationErrors(errors) {
    const grouped = new Map();
    for (const err of errors.errors) {
        const field = err.path.length > 0 ? err.path[0] : "root";
        const fieldKey = String(field);
        if (!grouped.has(fieldKey)) {
            grouped.set(fieldKey, []);
        }
        grouped.get(fieldKey).push(err.message);
    }
    const lines = [];
    for (const [field, msgs] of grouped.entries()) {
        lines.push(`${field}:`);
        for (const msg of msgs) {
            lines.push(`  - ${msg}`);
        }
    }
    return lines.join("\n");
}
/**
 * Summarize parse result for logging
 */
export function summarizeParseResult(result) {
    if (result.ok) {
        return `✅ UEE valid: task=${result.envelope.task.type} id=${result.envelope.task.id}`;
    }
    return `❌ UEE invalid: ${result.message}`;
}
// ============================================================================
// Batch Operations
// ============================================================================
/**
 * Parse multiple UEE envelopes, return successes + errors separately
 */
export function parseBatchUEE(inputs) {
    const valid = [];
    const invalid = [];
    for (const input of inputs) {
        const result = parseUEE(input);
        if (result.ok) {
            valid.push(result.envelope);
        }
        else {
            invalid.push(result);
        }
    }
    return { valid, invalid };
}
