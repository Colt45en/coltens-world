import { z } from "zod";

export const GameEntityIdSchema = z.string().min(1);
export type GameEntityId = z.infer<typeof GameEntityIdSchema>;

export const GameTickSchema = z.number().int().nonnegative();
export type GameTick = z.infer<typeof GameTickSchema>;

export const CmdMoveSchema = z
  .object({
    kind: z.literal("CmdMove"),
    tick: GameTickSchema,
    entityId: GameEntityIdSchema,
    x: z.number().min(-1).max(1),
    z: z.number().min(-1).max(1),
  })
  .strict();

export const CmdJumpSchema = z
  .object({
    kind: z.literal("CmdJump"),
    tick: GameTickSchema,
    entityId: GameEntityIdSchema,
  })
  .strict();

export const GameCommandSchema = z.discriminatedUnion("kind", [CmdMoveSchema, CmdJumpSchema]);
export type GameCommand = z.infer<typeof GameCommandSchema>;

export const EvSpawnedSchema = z
  .object({
    kind: z.literal("EvSpawned"),
    tick: GameTickSchema,
    entityId: GameEntityIdSchema,
  })
  .strict();

export const EvMovedSchema = z
  .object({
    kind: z.literal("EvMoved"),
    tick: GameTickSchema,
    entityId: GameEntityIdSchema,
    px: z.number(),
    py: z.number(),
    pz: z.number(),
  })
  .strict();

export const GameEventSchema = z.discriminatedUnion("kind", [EvSpawnedSchema, EvMovedSchema]);
export type GameEvent = z.infer<typeof GameEventSchema>;

export const GameSnapshotEntitySchema = z
  .object({
    id: GameEntityIdSchema,
    px: z.number(),
    py: z.number(),
    pz: z.number(),
    rx: z.number(),
    ry: z.number(),
    rz: z.number(),
    prefab: z.string().min(1),
  })
  .strict();

export const GameSnapshotSchema = z
  .object({
    tick: GameTickSchema,
    entities: z.array(GameSnapshotEntitySchema),
  })
  .strict();

export type GameSnapshot = z.infer<typeof GameSnapshotSchema>;
