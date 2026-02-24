/**
 * Contract validation helpers
 * Enforces that schemas exist and matches are exhaustive
 */
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
export function requireSchema(name, schema) {
    if (schema === undefined) {
        throw new Error(`Required schema not found: ${name}`);
    }
    return schema;
}
/**
 * Parse + throw on validation error
 * More ergonomic than safeParse for contracts
 */
export function parseSchema(schema, data, context) {
    const result = schema.safeParse(data);
    if (!result.success) {
        const ctx = context ? ` (${context})` : "";
        throw new Error(`Schema validation failed${ctx}: ${result.error.message}`);
    }
    return result.data;
}
