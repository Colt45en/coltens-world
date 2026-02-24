/**
 * Contract validation helpers
 * Enforces that schemas exist and matches are exhaustive
 */

import { z } from "zod";

/**
 * Require a Zod schema to exist, else throw
 * Prevents "possibly undefined" errors at runtime
 *
 * @example
 * const SimInputSchema = requireSchema(
 *   "sim.input",
 *   z.object({ playerId: z.string(), move: z.object({ x: z.number() }) })
 * );
 */
export function requireSchema<T extends z.ZodTypeAny>(
    name: string,
    schema: T | undefined
): T {
    if (schema === undefined) {
        throw new Error(`Required schema not found: ${name}`);
    }
    return schema;
}

/**
 * Parse + throw on validation error
 * More ergonomic than safeParse for contracts
 */
export function parseSchema<T extends z.ZodTypeAny>(
    schema: T,
    data: unknown,
    context?: string
): z.infer<T> {
    const result = schema.safeParse(data);
    if (!result.success) {
        const ctx = context ? ` (${context})` : "";
        throw new Error(`Schema validation failed${ctx}: ${result.error.message}`);
    }
    return result.data;
}
