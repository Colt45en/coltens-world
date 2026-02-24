import { z } from "zod";
/**
 * Build Evidence contracts (compiler-truth facts).
 * Deterministic JSON is enforced by canonicalization at emit-time (Nucleus).
 */
export const IsoDateTimeSchema = z.string().datetime();
export const SemVerSchema = z.string().regex(/^\d+\.\d+\.\d+$/, "Expected semver like 1.2.3");
export const StableIdSchema = z
    .string()
    .min(3)
    .max(128)
    .regex(/^[a-z0-9][a-z0-9._:-]*$/i, "StableId must be URL/filename-safe.");
export const CompilerSchema = z.enum(["vite", "singlefile-esbuild"]);
export const BuildStatusSchema = z.enum(["passed", "failed"]);
export const FileOutputSchema = z.object({
    path: z.string().min(1), // normalized posix path relative to repo root or build root
    bytes: z.number().int().nonnegative(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/i),
});
export const TypecheckResultSchema = z.object({
    ran: z.boolean(),
    passed: z.boolean(),
    errors: z.array(z.string()).default([]),
});
export const ModuleGraphSchema = z.object({
    kind: z.enum(["vite-manifest", "esbuild-metafile", "none"]),
    nodes: z.number().int().nonnegative(),
    edges: z.number().int().nonnegative(),
    entrypoints: z.array(z.string()).default([]),
    // adjacency list: from -> [to...]
    imports: z.record(z.array(z.string())).default({}),
});
export const BuildEvidencePacketSchema = z.object({
    schemaVersion: SemVerSchema, // e.g. "1.0.0"
    id: StableIdSchema, // deterministic stable id
    ts: IsoDateTimeSchema,
    compiler: CompilerSchema,
    status: BuildStatusSchema,
    // scope
    repoRoot: z.string().min(1),
    buildRoot: z.string().min(1), // project root used for build (e.g. apps/ide-web)
    outDir: z.string().min(1), // dist dir used/produced
    mode: z.string().min(1).default("production"),
    // evidence
    typecheck: TypecheckResultSchema,
    outputs: z.array(FileOutputSchema).default([]),
    bundle_hash: z.string().regex(/^[a-f0-9]{64}$/i),
    module_graph: ModuleGraphSchema,
    // errors
    buildErrors: z.array(z.string()).default([]),
    // optional repeat build for stability proof
    determinism: z
        .object({
        ranTwice: z.boolean(),
        hashStable: z.boolean(),
        first_hash: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
        second_hash: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
    })
        .default({ ranTwice: false, hashStable: false }),
});
/**
 * Optional bus message shapes (if you want these over WS bus)
 */
export const BuildEvidenceRequestSchema = z.object({
    compiler: CompilerSchema,
    buildRoot: z.string().min(1),
    outDir: z.string().min(1).optional(),
    mode: z.string().min(1).optional(),
    runTypecheck: z.boolean().optional(),
    runTwice: z.boolean().optional(),
});
