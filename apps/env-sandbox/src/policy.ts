import { codexToMap } from "./contracts";
import type { EnvCodex, EnvKeySpec } from "./contracts";
import type { LayerName } from "./types";

export type PolicyContext = {
    codex: EnvCodex;
    activeGates: Record<string, boolean>;
};

export function enforceKeyPolicy(args: {
    ctx: PolicyContext;
    key: string;
    layer: LayerName;
    failOnUnknownOverride?: boolean;
}): { spec?: EnvKeySpec } {
    const { ctx, key, layer, failOnUnknownOverride } = args;

    const map = codexToMap(ctx.codex);
    const spec = map.get(key);

    const failUnknown = failOnUnknownOverride ?? ctx.codex.policy.fail_on_unknown_key;
    if (!spec) {
        if (failUnknown) throw new Error(`Unknown key "${key}" (not in Env Codex registry).`);
        return {};
    }

    if (spec.allowed_layers && spec.allowed_layers.length > 0) {
        if (!spec.allowed_layers.includes(layer)) {
            throw new Error(`Key "${key}" cannot be set on layer "${layer}". Allowed: ${spec.allowed_layers.join(", ")}`);
        }
    }

    // Production lock gate: if enabled, restrict sensitive prefixes.
    if (ctx.activeGates["production_lock"]) {
        const prefixes = ctx.codex.policy.production_locked_prefixes ?? [];
        if (prefixes.some((p) => key.startsWith(p))) {
            throw new Error(`Key "${key}" is locked while gate production_lock=true.`);
        }
    }

    // Required gates for this key
    if (ctx.codex.policy.enforce_gates && spec.required_gates?.length) {
        const missing = spec.required_gates.filter((g) => !ctx.activeGates[g]);
        if (missing.length) {
            throw new Error(`Key "${key}" requires gate(s): ${missing.join(", ")} (enable them first).`);
        }
    }

    return { spec };
}
