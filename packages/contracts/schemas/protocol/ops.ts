import { z } from "zod";
import { Envelope } from "./envelope";

export const OpsStartSim = Envelope(
    z.object({
        type: z.literal("ops.sim.start"),
        payload: z.object({
            mode: z.enum(["dev", "prod"]).default("dev"),
            port: z.number().int().min(1).max(65535).default(4010),
        }),
    })
);

export type OpsStartSimT = z.infer<typeof OpsStartSim>;

export const OpsStopSim = Envelope(
    z.object({
        type: z.literal("ops.sim.stop"),
        payload: z.object({}),
    })
);

export type OpsStopSimT = z.infer<typeof OpsStopSim>;

export const OpsSimStatus = Envelope(
    z.object({
        type: z.literal("ops.sim.status"),
        payload: z.object({}),
    })
);

export type OpsSimStatusT = z.infer<typeof OpsSimStatus>;

export const OpsSimStatusReply = Envelope(
    z.object({
        type: z.literal("ops.sim.status.reply"),
        payload: z.object({
            running: z.boolean(),
            port: z.number().int().min(1).max(65535).nullable(),
            pid: z.number().int().nullable(),
        }),
    })
);

export type OpsSimStatusReplyT = z.infer<typeof OpsSimStatusReply>;

export const OpsInbound = z.union([OpsStartSim, OpsStopSim, OpsSimStatus]);
export const OpsOutbound = OpsSimStatusReply;
