import { z } from "zod";
import { Envelope } from "./envelope";
export const OpsStartSim = Envelope(z.object({
    type: z.literal("ops.sim.start"),
    payload: z.object({
        mode: z.enum(["dev", "prod"]).default("dev"),
        port: z.number().int().min(1).max(65535).default(4010),
    }),
}));
export const OpsStopSim = Envelope(z.object({
    type: z.literal("ops.sim.stop"),
    payload: z.object({}),
}));
export const OpsSimStatus = Envelope(z.object({
    type: z.literal("ops.sim.status"),
    payload: z.object({}),
}));
export const OpsSimStatusReply = Envelope(z.object({
    type: z.literal("ops.sim.status.reply"),
    payload: z.object({
        running: z.boolean(),
        port: z.number().int().min(1).max(65535).nullable(),
        pid: z.number().int().nullable(),
    }),
}));
export const OpsInbound = z.union([OpsStartSim, OpsStopSim, OpsSimStatus]);
export const OpsOutbound = OpsSimStatusReply;
