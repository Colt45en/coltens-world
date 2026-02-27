/**
 * Unified Engine Envelope (UEE) Protocol
 *
 * Standard format for all messages routed through the Engine Router.
 */
/**
 * Parse and validate a UEE envelope
 */
export function parseUEE(input) {
    if (!input || typeof input !== "object") {
        return { ok: false, message: "Invalid input: expected object" };
    }
    const obj = input;
    if (!obj.task || typeof obj.task !== "object") {
        return { ok: false, message: "Invalid input: missing task object" };
    }
    const task = obj.task;
    if (typeof task.id !== "string" || !task.id) {
        return { ok: false, message: "Invalid task: missing or non-string id" };
    }
    if (typeof task.type !== "string" || !task.type) {
        return { ok: false, message: "Invalid task: missing or non-string type" };
    }
    if (typeof task.mode !== "string" || !["generate", "apply", "analyze"].includes(task.mode)) {
        return { ok: false, message: "Invalid task: invalid or missing mode" };
    }
    const inputs = typeof obj.inputs === "object" && obj.inputs ? obj.inputs : {};
    const contextData = typeof obj.context === "object" && obj.context ? obj.context : undefined;
    const envelope = {
        task: {
            id: task.id,
            type: task.type,
            mode: task.mode,
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
export function getTaskId(envelope) {
    return envelope.task.id;
}
/**
 * Get task type from envelope
 */
export function getTaskType(envelope) {
    return envelope.task.type;
}
/**
 * Check if envelope has required inputs for its task type
 */
export function hasRequiredInputs(envelope) {
    const { type } = envelope.task;
    const { inputs } = envelope;
    // Each task type requires specific input keys
    const requiredInputs = {
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
export function narrowByTaskType(envelope, taskType) {
    return envelope.task.type === taskType;
}
/**
 * Check if a field should be included in output based on mode and presence
 */
export function shouldIncludeField(envelope, fieldName) {
    // Get the value from controls or options
    const controls = envelope.controls;
    const options = envelope.options;
    const value = controls?.[fieldName] ?? options?.[fieldName] ?? true;
    if (value === false || value === undefined || value === null) {
        return false;
    }
    return true;
}
