import { z } from "zod";

export const WorldGraphEntityZ = z.object({
  id: z.string(),
  name: z.string(),
  components: z.record(z.record(z.union([z.number(), z.string(), z.boolean()]))).optional(),
});

export type WorldGraphEntity = z.infer<typeof WorldGraphEntityZ>;

export const WorldGraphSystemZ = z.object({
  name: z.string(),
  every: z.number().positive(),
});

export type WorldGraphSystem = z.infer<typeof WorldGraphSystemZ>;

export const WorldGraphStateZ = z.object({
  time: z.number(),
  entities: z.array(WorldGraphEntityZ),
  systems: z.array(WorldGraphSystemZ),
  events_processed: z.number().int().nonnegative(),
});

export type WorldGraphState = z.infer<typeof WorldGraphStateZ>;

export const WorldGraphGetWorldStatePayloadZ = z.object({});
export type WorldGraphGetWorldStatePayload = z.infer<typeof WorldGraphGetWorldStatePayloadZ>;

export const WorldGraphStartSimulationPayloadZ = z.object({
  speed: z.number().positive().optional(),
});
export type WorldGraphStartSimulationPayload = z.infer<typeof WorldGraphStartSimulationPayloadZ>;

export const WorldGraphPauseSimulationPayloadZ = z.object({});
export type WorldGraphPauseSimulationPayload = z.infer<typeof WorldGraphPauseSimulationPayloadZ>;

export const WorldGraphResetWorldPayloadZ = z.object({});
export type WorldGraphResetWorldPayload = z.infer<typeof WorldGraphResetWorldPayloadZ>;

export const WorldGraphSetSpeedPayloadZ = z.object({
  speed: z.number().positive(),
});
export type WorldGraphSetSpeedPayload = z.infer<typeof WorldGraphSetSpeedPayloadZ>;

export const WorldGraphGenerateWorldPayloadZ = z.object({
  description: z.string().min(1),
});
export type WorldGraphGenerateWorldPayload = z.infer<typeof WorldGraphGenerateWorldPayloadZ>;

export const WorldGraphWorldStatePayloadZ = z.object({
  state: WorldGraphStateZ,
});
export type WorldGraphWorldStatePayload = z.infer<typeof WorldGraphWorldStatePayloadZ>;

export const WorldGraphSimulationStepPayloadZ = z.object({
  step: z.object({
    step: z.number().int().nonnegative(),
    timestamp: z.number().int().nonnegative(),
  }),
  world_state: WorldGraphStateZ,
});
export type WorldGraphSimulationStepPayload = z.infer<typeof WorldGraphSimulationStepPayloadZ>;

export const WorldGraphSimulationEventPayloadZ = z.object({
  event: z.object({
    timestamp: z.number().int().nonnegative(),
    level: z.enum(["info", "warning", "success", "error"]).default("info"),
    message: z.string(),
  }),
});
export type WorldGraphSimulationEventPayload = z.infer<typeof WorldGraphSimulationEventPayloadZ>;

export const WorldGraphSuccessPayloadZ = z.object({
  message: z.string(),
});
export type WorldGraphSuccessPayload = z.infer<typeof WorldGraphSuccessPayloadZ>;

export const WorldGraphErrorPayloadZ = z.object({
  message: z.string(),
});
export type WorldGraphErrorPayload = z.infer<typeof WorldGraphErrorPayloadZ>;
