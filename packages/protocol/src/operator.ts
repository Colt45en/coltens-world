import { z } from "zod";

/**
 * Operator Execution Envelope
 *
 * Event fired after an operator completes execution.
 * Emitted to globalBus from sidecar back to nucleus.
 *
 * Used for:
 * - Brain operator results (patch, simulate_world_tick)
 * - IDE progress updates
 * - Memory writes trigger
 * - Audit trail
 */

export const OperatorExecutionSchema = z.object({
    operator_id: z.string().regex(/^op_[a-f0-9]{24}$/),
    operator_name: z.enum(["prompt.operator.patch", "prompt.operator.simulate_world_tick"]),
    trace_id: z.string().uuid(),
    status: z.enum(["success", "validation_error", "timeout", "execution_error"]),
    result: z.record(z.any()).optional(),
    error: z
        .object({
            code: z.string(),
            message: z.string(),
            details: z.record(z.any()).optional(),
        })
        .optional(),
    memory_writes: z
        .array(
            z.object({
                key: z.string(),
                value: z.string(),
                ttl_seconds: z.number().optional(),
            })
        )
        .optional(),
    execution_time_ms: z.number().min(0),
    deterministic_hash: z.string().optional(),
});

export type OperatorExecution = z.infer<typeof OperatorExecutionSchema>;

/**
 * OperatorExecuted envelope — dispatched on globalBus
 *
 * Type: "operator.executed"
 * Payload: OperatorExecution
 */
export const EVT_OPERATOR_EXECUTED = "operator.executed";

/**
 * OperatorStarted envelope — dispatched when operator begins
 *
 * Type: "operator.started"
 */
export const EVT_OPERATOR_STARTED = "operator.started";

export const OperatorStartedSchema = z.object({
    operator_id: z.string().regex(/^op_[a-f0-9]{24}$/),
    operator_name: z.string(),
    trace_id: z.string().uuid(),
    timeout_ms: z.number(),
});

export type OperatorStarted = z.infer<typeof OperatorStartedSchema>;

/**
 * OperatorProgress envelope — dispatched for long-running ops
 *
 * Type: "operator.progress"
 */
export const EVT_OPERATOR_PROGRESS = "operator.progress";

export const OperatorProgressSchema = z.object({
    operator_id: z.string().regex(/^op_[a-f0-9]{24}$/),
    operator_name: z.string(),
    trace_id: z.string().uuid(),
    progress_percent: z.number().min(0).max(100),
    message: z.string().optional(),
});

export type OperatorProgress = z.infer<typeof OperatorProgressSchema>;
