import { z } from "zod";
import { KeySchema, LayerNameSchema } from "./types.js";
/**
 * Env value kinds:
 * - string: raw text
 * - number: numeric
 * - boolean: true/false
 * - json: object/array (stored as stable JSON string in ENV)
 */
export const EnvValueKindSchema = z.enum(["string", "number", "boolean", "json"]);
export const EnvKeySpecSchema = z.object({
    key: KeySchema,
    kind: EnvValueKindSchema,
    description: z.string().min(1).max(500),
    default: z.union([z.string(), z.number(), z.boolean(), z.record(z.any()), z.array(z.any())]).optional(),
    allowed_layers: z.array(LayerNameSchema).optional(),
    // Optional: forbid changes unless gate(s) are satisfied
    required_gates: z.array(z.string().min(1).max(64)).optional()
});
export const EnvCodexSchema = z.object({
    meta: z.object({
        title: z.string().default("Env Codex"),
        version: z.string().regex(/^\d+\.\d+\.\d+$/).default("1.0.0"),
        created_at: z.string().datetime().optional()
    }),
    /**
     * Gates are boolean switches that policy can use.
     * Examples:
     * - resource_scarcity
     * - observer_effect
     * - production_lock
     */
    gates: z.record(z.string().min(1).max(64), z.boolean()).default({}),
    /**
     * Allowlist registry (the contract).
     */
    registry: z.array(EnvKeySpecSchema).default([]),
    /**
     * Policy rules (simple and enforceable).
     */
    policy: z.object({
        // If true, setting an unknown key fails.
        fail_on_unknown_key: z.boolean().default(true),
        // If true, missing required gate blocks change.
        enforce_gates: z.boolean().default(true),
        // Keys that cannot be changed when production_lock gate is true.
        production_locked_prefixes: z.array(z.string().min(1).max(64)).default(["PROD_", "SECRET_", "TOKEN_", "KEY_"])
    }).default({
        fail_on_unknown_key: true,
        enforce_gates: true,
        production_locked_prefixes: ["PROD_", "SECRET_", "TOKEN_", "KEY_"]
    })
});
export function codexToMap(codex) {
    const m = new Map();
    for (const spec of codex.registry)
        m.set(spec.key, spec);
    return m;
}
/**
 * Stable JSON encoding for ENV storage.
 * - deterministic key order for objects
 * - no whitespace
 */
export function stableJsonStringify(value) {
    const normalize = (v) => {
        if (Array.isArray(v))
            return v.map(normalize);
        if (v && typeof v === "object") {
            const keys = Object.keys(v).sort();
            const out = {};
            for (const k of keys)
                out[k] = normalize(v[k]);
            return out;
        }
        return v;
    };
    return JSON.stringify(normalize(value));
}
export function parseTypedValue(kind, raw) {
    switch (kind) {
        case "string":
            return raw;
        case "number": {
            const n = Number(raw);
            if (!Number.isFinite(n))
                throw new Error(`Invalid number: "${raw}"`);
            return String(n);
        }
        case "boolean": {
            const s = raw.trim().toLowerCase();
            if (s === "true" || s === "1")
                return "true";
            if (s === "false" || s === "0")
                return "false";
            throw new Error(`Invalid boolean: "${raw}" (use true/false)`);
        }
        case "json": {
            let parsed;
            try {
                parsed = JSON.parse(raw);
            }
            catch {
                throw new Error(`Invalid JSON: "${raw}"`);
            }
            return stableJsonStringify(parsed);
        }
        default:
            throw new Error(`Unknown EnvValueKind: "${kind}"`);
    }
}
