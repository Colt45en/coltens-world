import { spawn, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";

export type SimEvent =
    | { type: "start"; simId: string; port: number }
    | { type: "log"; simId: string; level: "info" | "stdout" | "stderr"; line: string; ts: number }
    | { type: "done"; simId: string; ok: boolean; code: number | null; ts: number };

export class SimRunner extends EventEmitter {
    private running = false;
    private child: ChildProcess | null = null;
    private simId: string = "";
    private port: number = 4010;

    emit(eventName: string | symbol, ...args: unknown[]): boolean {
        return super.emit(eventName, ...args);
    }

    request(opts: {
        mode: "dev" | "prod";
        port: number;
    }): void {
        if (this.running) {
            this.emit("log", {
                type: "log",
                simId: this.simId,
                level: "info",
                line: "[sim] Already running, stop first",
                ts: Date.now(),
            });
            return;
        }

        this.run(opts);
    }

    private run(opts: { mode: "dev" | "prod"; port: number }) {
        this.simId = `sim-${Date.now()}`;
        this.port = opts.port;
        this.running = true;

        this.emit("start", {
            type: "start",
            simId: this.simId,
            port: this.port,
        });

        const isDev = opts.mode === "dev";
        const cmd = isDev ? "tsx" : "node";
        const args = isDev ? ["watch", "src/index.ts"] : ["dist/index.ts"];
        const cwd = "apps/sim-server";
        const env = { ...process.env, SIM_PORT: String(opts.port) };

        this.child = spawn(cmd, args, {
            cwd,
            env,
            stdio: ["ignore", "pipe", "pipe"],
        });

        const sendLines = (level: "stdout" | "stderr", chunk: Buffer) => {
            const lines = chunk.toString("utf8").split("\n");
            for (const line of lines) {
                if (line.trim()) {
                    this.emit("log", {
                        type: "log",
                        simId: this.simId,
                        level,
                        line,
                        ts: Date.now(),
                    });
                }
            }
        };

        this.child.stdout?.on("data", (c: Buffer) => sendLines("stdout", c));
        this.child.stderr?.on("data", (c: Buffer) => sendLines("stderr", c));

        this.child.on("exit", (code: number | null) => {
            this.running = false;
            this.child = null;
            this.emit("done", {
                type: "done",
                simId: this.simId,
                ok: code === 0,
                code,
                ts: Date.now(),
            });
        });

        this.child.on("error", (err: Error) => {
            this.running = false;
            this.emit("log", {
                type: "log",
                simId: this.simId,
                level: "stderr",
                line: `[error] ${err.message}`,
                ts: Date.now(),
            });
            this.child = null;
        });
    }

    stop(): void {
        if (!this.running || !this.child) {
            this.emit("log", {
                type: "log",
                simId: this.simId,
                level: "info",
                line: "[sim] Not running",
                ts: Date.now(),
            });
            return;
        }

        this.emit("log", {
            type: "log",
            simId: this.simId,
            level: "info",
            line: "[sim] stopping...",
            ts: Date.now(),
        });

        this.child.kill("SIGTERM");
    }

    isRunning(): boolean {
        return this.running;
    }

    getStatus(): { running: boolean; port: number | null; pid: number | null } {
        return {
            running: this.running,
            port: this.running ? this.port : null,
            pid: this.child?.pid ?? null,
        };
    }
}
