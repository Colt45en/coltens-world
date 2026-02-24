import { z } from "zod";
import { Envelope } from "./envelope";

export const SimEntityId = z.string().min(1);
export const SimTick = z.number().int().nonnegative();

export const Vec2 = z.object({ x: z.number(), y: z.number() });
export const Vec3 = z.object({ x: z.number(), y: z.number(), z: z.number() });

export const BoxCollider = z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
});

// World metadata sent once per level load
export const SimWorldMetadata = Envelope(
    z.object({
        type: z.literal("sim.worldMetadata"),
        payload: z.object({
            levelId: z.string(),
            staticColliders: z.array(BoxCollider),
            spawnPoints: z.array(Vec3).optional(),
        }),
    })
);

export type SimWorldMetadataT = z.infer<typeof SimWorldMetadata>;

/**
 * Client -> Server
 * "I pressed W" / "move vector" / "fire" etc.
 * Server validates and applies at a specific tick boundary.
 */
export const SimInput = Envelope(
    z.object({
        type: z.literal("sim.input"),
        payload: z.object({
            playerId: SimEntityId,
            inputSeq: z.number().int().nonnegative(),
            clientTime: z.number().int(),
            move: Vec2,
            actions: z
                .object({
                    jump: z.boolean().optional(),
                    fire: z.boolean().optional(),
                })
                .default({}),
        }),
    })
);

export type SimInputT = z.infer<typeof SimInput>;

/**
 * Server -> Client
 * Authoritative snapshot. v1 = full snapshot (simple).
 * v2 = delta snapshots with baselines.
 */
export const SimSnapshot = Envelope(
    z.object({
        type: z.literal("sim.snapshot"),
        payload: z.object({
            tick: SimTick,
            serverTime: z.number().int(),
            lastProcessedInputSeq: z.number().int().nonnegative().optional(),
            entities: z.array(
                z.object({
                    id: SimEntityId,
                    pos: Vec3,
                    vel: Vec3,
                    hp: z.number().int().min(0).max(100).default(100),
                })
            ),
        }),
    })
);

export type SimSnapshotT = z.infer<typeof SimSnapshot>;

/**
 * Server -> Client ack (for reconciliation)
 */
export const SimInputAck = Envelope(
    z.object({
        type: z.literal("sim.inputAck"),
        payload: z.object({
            playerId: SimEntityId,
            inputSeq: z.number().int().nonnegative(),
            tickApplied: SimTick,
        }),
    })
);

export type SimInputAckT = z.infer<typeof SimInputAck>;

export const SimInbound = SimInput;
export const SimOutbound = z.union([SimWorldMetadata, SimSnapshot, SimInputAck]);
