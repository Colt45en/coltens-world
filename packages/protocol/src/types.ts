import { z } from "zod";
import { type BrainChatDelta, type BrainChatDone, type BrainChatError, type BrainChatRequest } from "./chat";
import type {
    WorldGraphErrorPayload,
    WorldGraphGenerateWorldPayload,
    WorldGraphGetWorldStatePayload,
    WorldGraphPauseSimulationPayload,
    WorldGraphResetWorldPayload,
    WorldGraphSetSpeedPayload,
    WorldGraphSimulationEventPayload,
    WorldGraphSimulationStepPayload,
    WorldGraphStartSimulationPayload,
    WorldGraphSuccessPayload,
    WorldGraphWorldStatePayload,
} from "./contracts/worldGraph";

import type { IdeCliRunRequest, IdeCliRunResponse, IdeFsReadRequest, IdeFsReadResponse } from "./ide";

export const SessionIdSchema = z.string().min(1);
export type SessionId = z.infer<typeof SessionIdSchema>;

export const TraceIdSchema = z.string().min(1);
export type TraceId = z.infer<typeof TraceIdSchema>;

export type SystemHello = {
    requestedRole: "ide" | "preview";
};

export type SystemWelcome = {
    assignedInstanceId: string;
    caps: string[];
    serverTimeMs: number;
    policy?: {
        maxPayloadBytes: number;
        clockSkewMs: number;
        nonceTtlMs: number;
        rateLimit: {
            bucketMax: number;
            refillPerSec: number;
        };
    };
};

export type PtyOpen = {
    program: "veno";
    cols: number;
    rows: number;
};

export type PtyOpened = {
    ptyId: string;
};

export type PtyResize = {
    ptyId: string;
    cols: number;
    rows: number;
};

export type PtyInput = {
    ptyId: string;
    data: string; // raw keystrokes
};

export type PtyOutput = {
    ptyId: string;
    data: string; // raw terminal bytes (utf-8 string)
};

export type PreviewStats = {
    fps: number;
    frameMs: number;
};

export type PreviewPing = {
    n: number;
};

export type PreviewPong = {
    n: number;
};

export type FilesChanged = {
    path: string;
    kind: "add" | "change" | "unlink";
    ts: number;
};

export type SimStart = {
    simId: string;
    port: number;
};

export type SimLog = {
    level: "info" | "stdout" | "stderr";
    line: string;
    ts: number;
};

export type SimDone = {
    ok: boolean;
    code: number | null;
    durationMs: number;
};

export type OpsSimStart = {
    mode: "dev" | "prod";
    port: number;
};

export type OpsSimStop = {
    // empty
};

export type OpsSimStatus = {
    // empty
};

export type OpsSimStatusReply = {
    running: boolean;
    port: number | null;
    pid: number | null;
};

// IDE types are imported from ./ide (which has the authoritative Zod schemas)
export type { IdeCliRunRequest, IdeCliRunResponse, IdeFsReadRequest, IdeFsReadResponse };

export type MessageMap = {
    "system.hello": SystemHello;
    "system.welcome": SystemWelcome;

    "pty.open": PtyOpen;
    "pty.opened": PtyOpened;
    "pty.resize": PtyResize;
    "pty.input": PtyInput;
    "pty.output": PtyOutput;

    "preview.stats": PreviewStats;
    "preview.ping": PreviewPing;
    "preview.pong": PreviewPong;

    "files.changed": FilesChanged;

    "sim.start": SimStart;
    "sim.log": SimLog;
    "sim.done": SimDone;

    "ops.sim.start": OpsSimStart;
    "ops.sim.stop": OpsSimStop;
    "ops.sim.status": OpsSimStatus;
    "ops.sim.status.reply": OpsSimStatusReply;

    "ide.cli.run.request": IdeCliRunRequest;
    "ide.cli.run.response": IdeCliRunResponse;
    "ide.fs.read.request": IdeFsReadRequest;
    "ide.fs.read.response": IdeFsReadResponse;

    "uee": unknown;
    "uee.response": unknown;
    "uee.error": { error: string };

    "brain.chat": BrainChatRequest;
    "brain.chat.delta": BrainChatDelta;
    "brain.chat.done": BrainChatDone;
    "brain.chat.error": BrainChatError;

    "world.graph.get_world_state": WorldGraphGetWorldStatePayload;
    "world.graph.start_simulation": WorldGraphStartSimulationPayload;
    "world.graph.pause_simulation": WorldGraphPauseSimulationPayload;
    "world.graph.reset_world": WorldGraphResetWorldPayload;
    "world.graph.set_speed": WorldGraphSetSpeedPayload;
    "world.graph.generate_world": WorldGraphGenerateWorldPayload;

    "world.graph.world_state": WorldGraphWorldStatePayload;
    "world.graph.simulation_step": WorldGraphSimulationStepPayload;
    "world.graph.simulation_event": WorldGraphSimulationEventPayload;
    "world.graph.success": WorldGraphSuccessPayload;
    "world.graph.error": WorldGraphErrorPayload;
};
