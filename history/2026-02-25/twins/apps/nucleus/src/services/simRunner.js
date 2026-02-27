import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
export class SimRunner extends EventEmitter {
    running = false;
    child = null;
    simId = "";
    port = 4010;
    emit(eventName, ...args) {
        return super.emit(eventName, ...args);
    }
    request(opts) {
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
    run(opts) {
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
        const sendLines = (level, chunk) => {
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
        this.child.stdout?.on("data", (c) => sendLines("stdout", c));
        this.child.stderr?.on("data", (c) => sendLines("stderr", c));
        this.child.on("exit", (code) => {
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
        this.child.on("error", (err) => {
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
    stop() {
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
    isRunning() {
        return this.running;
    }
    getStatus() {
        return {
            running: this.running,
            port: this.running ? this.port : null,
            pid: this.child?.pid ?? null,
        };
    }
}
