import type { IPty } from "node-pty";

export type PtySession = {
    ptyId: string;
    sessionId: string;
    pty: IPty;
};
