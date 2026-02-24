import { z } from "zod";
export const WorldGraphEntityZ = z.object({
    id: z.string(),
    name: z.string(),
    components: z.record(z.record(z.union([z.number(), z.string(), z.boolean()]))).optional(),
});
export const WorldGraphSystemZ = z.object({
    name: z.string(),
    every: z.number().positive(),
});
export const WorldGraphStateZ = z.object({
    time: z.number(),
    entities: z.array(WorldGraphEntityZ),
    systems: z.array(WorldGraphSystemZ),
    events_processed: z.number().int().nonnegative(),
});
export const WorldGraphGetWorldStatePayloadZ = z.object({});
export const WorldGraphStartSimulationPayloadZ = z.object({
    speed: z.number().positive().optional(),
});
export const WorldGraphPauseSimulationPayloadZ = z.object({});
export const WorldGraphResetWorldPayloadZ = z.object({});
export const WorldGraphSetSpeedPayloadZ = z.object({
    speed: z.number().positive(),
});
export const WorldGraphGenerateWorldPayloadZ = z.object({
    description: z.string().min(1),
});
export const WorldGraphWorldStatePayloadZ = z.object({
    state: WorldGraphStateZ,
});
export const WorldGraphSimulationStepPayloadZ = z.object({
    step: z.object({
        step: z.number().int().nonnegative(),
        timestamp: z.number().int().nonnegative(),
    }),
    world_state: WorldGraphStateZ,
});
export const WorldGraphSimulationEventPayloadZ = z.object({
    event: z.object({
        timestamp: z.number().int().nonnegative(),
        level: z.enum(["info", "warning", "success", "error"]).default("info"),
        message: z.string(),
    }),
});
export const WorldGraphSuccessPayloadZ = z.object({
    message: z.string(),
});
export const WorldGraphErrorPayloadZ = z.object({
    message: z.string(),
});
