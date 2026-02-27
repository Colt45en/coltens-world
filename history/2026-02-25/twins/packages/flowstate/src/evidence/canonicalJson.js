/**
 * Canonical JSON - Stable sorting for deterministic serialization
 */
export function sortKeys(obj) {
    if (Array.isArray(obj)) {
        return obj.map(sortKeys);
    }
    if (typeof obj === "object" && obj !== null) {
        const out = {};
        for (const k of Object.keys(obj).sort()) {
            out[k] = sortKeys(obj[k]);
        }
        return out;
    }
    return obj;
}
export function canonicalize(value) {
    return JSON.stringify(sortKeys(value));
}
