/**
 * Unified Engine Envelope (UEE) Protocol
 *
 * Standard format for all messages routed through the Engine Router.
 */

export type UEETaskMode = "generate" | "apply" | "analyze";
export type UEETaskType = "brain_control" | "brain_train" | "lexicon_op" | "hce_run" | "scene_gen" | "analyze_sentence";

/**
 * Unified Engine Envelope: wraps task + inputs + metadata
 */
export type UnifiedEngineEnvelope = {
    task: {
        id: string;
        type: UEETaskType;
        mode: UEETaskMode;
    };
    inputs: Record<string, unknown>;
    context?: {
        parentTaskId?: string;
        sessionId?: string;
        timestamp?: number;
    };
};

/**
 * Parse and validate a UEE envelope
 */
export function parseUEE(
    input: unknown
): { ok: true; envelope: UnifiedEngineEnvelope } | { ok: false; message: string } {
    if (!input || typeof input !== "object") {
        return { ok: false, message: "Invalid input: expected object" };
    }

    const obj = input as Record<string, unknown>;

    if (!obj.task || typeof obj.task !== "object") {
        return { ok: false, message: "Invalid input: missing task object" };
    }

    const task = obj.task as Record<string, unknown>;

    if (typeof task.id !== "string" || !task.id) {
        return { ok: false, message: "Invalid task: missing or non-string id" };
    }

    if (typeof task.type !== "string" || !task.type) {
        return { ok: false, message: "Invalid task: missing or non-string type" };
    }

    if (typeof task.mode !== "string" || !["generate", "apply", "analyze"].includes(task.mode)) {
        return { ok: false, message: "Invalid task: invalid or missing mode" };
    }

    const inputs = typeof obj.inputs === "object" && obj.inputs ? (obj.inputs as Record<string, unknown>) : {};

    const contextData = typeof obj.context === "object" && obj.context ? (obj.context as UnifiedEngineEnvelope["context"]) : undefined;

    const envelope: UnifiedEngineEnvelope = {
        task: {
            id: task.id,
            type: task.type as UEETaskType,
            mode: task.mode as UEETaskMode,
        },
        inputs,
    };

    if (contextData) {
        envelope.context = contextData;
    }

    return { ok: true, envelope };
}

/**
 * Get task ID from envelope
 */
export function getTaskId(envelope: UnifiedEngineEnvelope): string {
    return envelope.task.id;
}

/**
 * Get task type from envelope
 */
export function getTaskType(envelope: UnifiedEngineEnvelope): UEETaskType {
    return envelope.task.type;
}

/**
 * Check if envelope has required inputs for its task type
 */
export function hasRequiredInputs(envelope: UnifiedEngineEnvelope): boolean {
    const { type } = envelope.task;
    const { inputs } = envelope;

    // Each task type requires specific input keys
    const requiredInputs: Record<UEETaskType, string[]> = {
        brain_control: ["brain_control"],
        brain_train: ["brain_train"],
        lexicon_op: ["lexicon_op"],
        hce_run: ["hce_run"],
        scene_gen: ["scene_gen"],
        analyze_sentence: ["analyze_sentence"],
    };

    const required = requiredInputs[type] || [];
    return required.every((key) => key in inputs);
}

/**
 * Type guard: narrow envelope to a specific task type
 */
export function narrowByTaskType<T extends UEETaskType>(
    envelope: UnifiedEngineEnvelope,
    taskType: T
): envelope is UnifiedEngineEnvelope & { task: { type: T } } {
    return envelope.task.type === taskType;
}

/**
 * Check if a field should be included in output based on mode and presence
 */
export function shouldIncludeField(
    envelope: UnifiedEngineEnvelope,
    fieldName: string
): boolean {
    // Get the value from controls or options
    const controls = (envelope as unknown as { controls?: Record<string, unknown> }).controls;
    const options = (envelope as unknown as { options?: Record<string, unknown> }).options;
    const value = controls?.[fieldName] ?? options?.[fieldName] ?? true;

    if (value === false || value === undefined || value === null) {
        return false;
    }

    return true;
}
