import { z } from "zod";
export const KeySchema = z.string().regex(/^[A-Z_][A-Z0-9_]*$/).min(1).max(128);
export const LayerNameSchema = z.enum(["prime", "subtle", "material", "data-plane"]);
export const EnvMapSchema = z.record(KeySchema, z.union([z.string(), z.number(), z.boolean()]));
export const SandboxMetaSchema = z.object({
    created_at: z.string().datetime().optional(),
});
export const SandboxStateSchema = z.object({
    meta: SandboxMetaSchema,
    activeLayer: LayerNameSchema,
    layers: z.record(LayerNameSchema, EnvMapSchema).default({
        prime: {},
        subtle: {},
        material: {},
        "data-plane": {}
    }),
    profiles: z.record(z.string().min(1).max(64), z.object({
        layer: LayerNameSchema.optional(),
        env: EnvMapSchema
    })).default({}),
    snapshots: z.record(z.string().min(1).max(64), z.object({
        created_at: z.string().datetime(),
        note: z.string().optional(),
        state: z.lazy(() => z.any()) // circular ref to SandboxState
    })).default({})
});
export const RecursiveCreationCodexSchema = z.object({
    meta: z.object({
        title: z.string(),
        version: z.string(),
        created_timestamp: z.string()
    }),
    orchestration: z.object({
        agents: z.array(z.object({
            name: z.string(),
            role: z.string()
        })).optional()
    }).optional(),
    philosophical_framework: z.object({
        roles: z.array(z.string()).optional()
    }).optional(),
    metaphysical_cosmology: z.object({
        forces: z.array(z.string()).optional()
    }).optional()
});
