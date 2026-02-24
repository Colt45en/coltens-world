/**
 * JSON value types (engine-owned, Prisma-independent)
 * Used for contract payloads, logs, persistence
 *
 * Why separate from Prisma: keeps engine serializable anywhere
 * (files, workers, network, redis, etc.)
 */
/**
 * Coerce unknown value to JsonValue safely
 * Throws on circular refs or non-serializable types
 */
export function coerceJsonValue(x) {
    if (x === null)
        return null;
    if (x === undefined)
        return null;
    if (typeof x === "string")
        return x;
    if (typeof x === "number") {
        if (!Number.isFinite(x))
            return null; // NaN, Infinity → null
        return x;
    }
    if (typeof x === "boolean")
        return x;
    // Date → ISO string
    if (x instanceof Date)
        return x.toISOString();
    // Array/Array-like
    if (Array.isArray(x)) {
        const seen = new WeakSet();
        const walk = (val) => {
            if (typeof val === "object" && val !== null) {
                if (seen.has(val))
                    return null; // circular
                seen.add(val);
            }
            return coerceJsonValue(val);
        };
        return x.map(walk);
    }
    // Object
    if (typeof x === "object") {
        const seen = new WeakSet();
        if (seen.has(x))
            return null; // circular
        seen.add(x);
        const result = {};
        for (const [k, v] of Object.entries(x)) {
            result[k] = coerceJsonValue(v);
        }
        return result;
    }
    // Symbol, function, other → null
    return null;
}
/**
 * Assert value is JsonObject, else throw
 */
export function requireJsonObject(x) {
    if (typeof x === "object" && x !== null && !Array.isArray(x)) {
        return x;
    }
    throw new TypeError(`Expected JsonObject, got ${typeof x}`);
}
/**
 * Assert value is JsonValue, else throw
 */
export function requireJsonValue(x) {
    const coerced = coerceJsonValue(x);
    if (coerced === null && x !== null && x !== undefined) {
        throw new TypeError(`Value is not JSON-serializable: ${typeof x}`);
    }
    return coerced;
}
