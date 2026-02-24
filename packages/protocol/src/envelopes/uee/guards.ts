/**
 * UEE Validation Guards
 *
 * Helper functions to safely parse, narrow, and validate UEE envelopes
 * with consistent error handling and type narrowing for runtime safety.
 */

import { z } from "zod";
import {
  TaskTypeSchema,
  UnifiedEngineEnvelopeSchema,
  type AnalyzeSentenceInput,
  type HceRunInput,
  type LexiconOpInput,
  type SceneInput,
  type TaskType,
  type UnifiedEngineEnvelope,
} from "./schema.js";

// ============================================================================
// Validation Result Types
// ============================================================================

/**
 * Parse result: either valid envelope or structured errors
 */
export type UEEParseResult =
  | { ok: true; envelope: UnifiedEngineEnvelope }
  | { ok: false; errors: z.ZodError; message: string };

/**
 * Task type narrow result
 */
export type TaskNarrowResult<T extends TaskType> =
  | { ok: true; envelope: UnifiedEngineEnvelope; typedInputs: Record<T, any> }
  | { ok: false; reason: string };

// ============================================================================
// Parse & Validate
// ============================================================================

/**
 * Parse unknown value as UEE envelope with structured error handling
 */
export function parseUEE(input: unknown): UEEParseResult {
  try {
    const envelope = UnifiedEngineEnvelopeSchema.parse(input);
    return { ok: true, envelope };
  } catch (err) {
    if (err instanceof z.ZodError) {
      const message = err.errors
        .map(
          (e) =>
            `${e.path.join(".")}: ${e.message} (${e.code})`
        )
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
export function parseUEESafe(input: unknown): UnifiedEngineEnvelope | null {
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
export function parseUEEPartial(input: unknown): UEEParseResult {
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
      envelope: partial as UnifiedEngineEnvelope,
    };
  } catch (err) {
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
export function narrowToLexiconOp(envelope: UnifiedEngineEnvelope): envelope is UnifiedEngineEnvelope & {
  inputs: { lexicon_op: LexiconOpInput };
} {
  return envelope.task.type === "lexicon_op" && !!envelope.inputs.lexicon_op;
}

/**
 * Narrow to hce_run inputs
 */
export function narrowToHceRun(envelope: UnifiedEngineEnvelope): envelope is UnifiedEngineEnvelope & {
  inputs: { hce_run: HceRunInput };
} {
  return envelope.task.type === "hce_run" && !!envelope.inputs.hce_run;
}

/**
 * Narrow to scene inputs
 */
export function narrowToScene(envelope: UnifiedEngineEnvelope): envelope is UnifiedEngineEnvelope & {
  inputs: { scene: SceneInput };
} {
  return envelope.task.type === "scene" && !!envelope.inputs.scene;
}

/**
 * Narrow to analyze_sentence inputs
 */
export function narrowToAnalyzeSentence(envelope: UnifiedEngineEnvelope): envelope is UnifiedEngineEnvelope & {
  inputs: { analyze_sentence: AnalyzeSentenceInput };
} {
  return envelope.task.type === "analyze_sentence" && !!envelope.inputs.analyze_sentence;
}

/**
 * Generic narrow: match by task type string
 * Useful for dynamic dispatch
 */
export function narrowByTaskType<T extends TaskType>(
  envelope: UnifiedEngineEnvelope,
  taskType: T
): envelope is UnifiedEngineEnvelope {
  return envelope.task.type === taskType;
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate task type string
 */
export function isValidTaskType(value: unknown): value is TaskType {
  try {
    TaskTypeSchema.parse(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if envelope has required inputs for its task type
 */
export function hasRequiredInputs(envelope: UnifiedEngineEnvelope): boolean {
  switch (envelope.task.type) {
    case "lexicon_op":
      return (
        !!envelope.inputs.lexicon_op &&
        !!envelope.inputs.lexicon_op.term &&
        !!envelope.inputs.lexicon_op.artifact &&
        !!envelope.inputs.lexicon_op.objective
      );
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
export function shouldIncludeField(
  envelope: UnifiedEngineEnvelope,
  field: "include_prose" | "include_json" | "include_audit" | "include_state_delta"
): boolean {
  return envelope.controls.return[field] === true;
}

/**
 * Get task type string for routing
 */
export function getTaskType(envelope: UnifiedEngineEnvelope): TaskType {
  return envelope.task.type;
}

/**
 * Get task ID for correlation/tracking
 */
export function getTaskId(envelope: UnifiedEngineEnvelope): string {
  return envelope.task.id;
}

/**
 * Get execution mode
 */
export function getTaskMode(
  envelope: UnifiedEngineEnvelope
): "generate" | "apply" | "analyze" {
  return envelope.task.mode;
}

// ============================================================================
// Error Formatting
// ============================================================================

/**
 * Format validation errors for user display
 */
export function formatValidationErrors(errors: z.ZodError): string {
  const grouped = new Map<string, string[]>();

  for (const err of errors.errors) {
    const field = err.path.length > 0 ? err.path[0] : "root";
    const fieldKey = String(field);
    if (!grouped.has(fieldKey)) {
      grouped.set(fieldKey, []);
    }
    grouped.get(fieldKey)!.push(err.message);
  }

  const lines: string[] = [];
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
export function summarizeParseResult(result: UEEParseResult): string {
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
export function parseBatchUEE(
  inputs: unknown[]
): { valid: UnifiedEngineEnvelope[]; invalid: (UEEParseResult & { ok: false })[] } {
  const valid: UnifiedEngineEnvelope[] = [];
  const invalid: (UEEParseResult & { ok: false })[] = [];

  for (const input of inputs) {
    const result = parseUEE(input);
    if (result.ok) {
      valid.push(result.envelope);
    } else {
      invalid.push(result);
    }
  }

  return { valid, invalid };
}

// ============================================================================
// Type Exports
// ============================================================================

export type { UnifiedEngineEnvelope } from "./schema.js";
