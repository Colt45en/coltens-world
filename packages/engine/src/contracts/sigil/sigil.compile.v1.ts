/* eslint-disable no-redeclare */
import { z } from "zod";

const HEX64 = /^[0-9a-f]{64}$/i;
const HEX8_OR_64 = /^(?:[0-9a-f]{8}|[0-9a-f]{64})$/i;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export const SigilOpsV1 = z
  .object({
    link: z.boolean(),
    flow: z.boolean(),
    fuse: z.boolean(),
  })
  .strict();

export type SigilOpsV1 = z.infer<typeof SigilOpsV1>;

export const SigilRolesV1 = z
  .object({
    prefixes: z.array(z.string()),
    roots: z.array(z.string()),
    suffixes: z.array(z.string()),
  })
  .strict();

export type SigilRolesV1 = z.infer<typeof SigilRolesV1>;

export const SigilStyleV1 = z
  .object({
    size: z.number().int().min(200).max(1200),
    pad: z.number().int().min(0).max(200),
    stroke: z.number().min(0.5).max(20),
    fg: z.string().regex(HEX_COLOR),
  })
  .strict();

export type SigilStyleV1 = z.infer<typeof SigilStyleV1>;

export const SigilProgramV1 = z
  .object({
    kind: z.literal("sigil.program"),
    v: z.literal(1),

    roles: SigilRolesV1,
    ops: SigilOpsV1,
    style: SigilStyleV1,

    symmetry: z.number().int().min(3).max(24).nullable(),
    seed_hex: z.string().regex(HEX8_OR_64).nullable(),
  })
  .strict();

export type SigilProgramV1 = z.infer<typeof SigilProgramV1>;

export const SigilPathV1 = z
  .object({
    type: z.number().int().min(1).max(5),
    ring: z.number(),
    angle: z.number(),
    d: z.string(),
    stroke_width: z.number(),
    opacity: z.number().min(0).max(1),
  })
  .strict();

export type SigilPathV1 = z.infer<typeof SigilPathV1>;

export const SigilArtifactV1 = z
  .object({
    kind: z.literal("sigil.artifact"),
    v: z.literal(1),

    program_hash: z.string().regex(HEX64),

    seed_u32: z.number().int().min(0).max(0xffffffff),
    symmetry: z.number().int().min(3).max(24),

    base_rot_rad: z.number(),
    rings: z
      .object({
        outer: z.number(),
        mid: z.number(),
        inner: z.number(),
      })
      .strict(),

    paths: z.array(SigilPathV1),
    program: SigilProgramV1,
  })
  .strict();

export type SigilArtifactV1 = z.infer<typeof SigilArtifactV1>;

export const SigilCompileToolNameV1 = z.literal("sigil.compile.v1");

export const SigilCompileInputV1 = z
  .object({
    program: SigilProgramV1,
    outputs: z
      .object({
        svg: z.boolean(),
        recipe: z.boolean(),
        ledger_ndjson: z.boolean(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type SigilCompileInputV1 = z.infer<typeof SigilCompileInputV1>;

export const SigilRecipeV1 = z
  .object({
    kind: z.literal("sigil.recipe"),
    v: z.literal(1),
    program_hash: z.string().regex(HEX64),
    artifact_hash: z.string().regex(HEX64),
    program: SigilProgramV1,
  })
  .strict();

export type SigilRecipeV1 = z.infer<typeof SigilRecipeV1>;

export const SigilCompileOutputV1 = z
  .object({
    program_hash: z.string().regex(HEX64),
    artifact_hash: z.string().regex(HEX64),
    artifact: SigilArtifactV1,

    svg: z.string().optional(),
    recipe: SigilRecipeV1.optional(),
    ledger_ndjson: z.string().optional(),
  })
  .strict();

export type SigilCompileOutputV1 = z.infer<typeof SigilCompileOutputV1>;

export const ToolExecuteV1 = z
  .object({
    kind: z.literal("tool.execute"),
    v: z.literal(1),
    tool: z.string(),
    input: z.unknown(),
    request_id: z.string().min(1).max(200).optional(),
  })
  .strict();

export type ToolExecuteV1 = z.infer<typeof ToolExecuteV1>;

export const ToolResultV1 = z
  .object({
    kind: z.literal("tool.result"),
    v: z.literal(1),
    tool: z.string(),
    ok: z.boolean(),
    output: z.unknown().optional(),
    error: z
      .object({
        code: z.string(),
        message: z.string(),
      })
      .strict()
      .optional(),
    request_id: z.string().min(1).max(200).optional(),
  })
  .strict();

export type ToolResultV1 = z.infer<typeof ToolResultV1>;

export const SigilCompileToolExecuteV1 = ToolExecuteV1.extend({
  tool: SigilCompileToolNameV1,
  input: SigilCompileInputV1,
}).strict();

export type SigilCompileToolExecuteV1 = z.infer<typeof SigilCompileToolExecuteV1>;

export const SigilCompileToolResultV1 = ToolResultV1.extend({
  tool: SigilCompileToolNameV1,
  ok: z.literal(true),
  output: SigilCompileOutputV1,
}).strict();

export type SigilCompileToolResultV1 = z.infer<typeof SigilCompileToolResultV1>;

export const SIGIL_PROGRAM_EXAMPLE_V1: SigilProgramV1 = {
  kind: "sigil.program",
  v: 1,
  roles: {
    prefixes: ["re"],
    roots: ["struct"],
    suffixes: ["ion"],
  },
  ops: {
    link: false,
    flow: true,
    fuse: false,
  },
  style: {
    size: 600,
    pad: 40,
    stroke: 5.5,
    fg: "#0ea5e9",
  },
  symmetry: 9,
  seed_hex: "a1b2c3d4",
};
