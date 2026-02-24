import { randomId } from "@world-engine/protocol";
import * as pty from "node-pty";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { PtySession } from "./ptySession";

type OpenOpts = {
    cols: number;
    rows: number;
    onData: (ptyId: string, data: string) => void;
};

export class VenoManager {
    private readonly sessions = new Map<string, PtySession>();
    private readonly sessionIndex = new Map<string, Set<string>>();

    async openVeno(sessionId: string, opts: OpenOpts): Promise<string> {
        const venoRoot = this.ensureVenoInstalled();
        const venoScript = path.join(venoRoot, "veno.sh");

        const ptyId = randomId("pty");
        const shell = process.platform === "win32" ? "powershell.exe" : "bash";

        const p = pty.spawn(shell, [], {
            name: "xterm-256color",
            cols: opts.cols,
            rows: opts.rows,
            cwd: venoRoot,
            env: {
                ...process.env,
                TERM: "xterm-256color"
            }
        });

        const sess: PtySession = { ptyId, sessionId, pty: p };
        this.sessions.set(ptyId, sess);
        if (!this.sessionIndex.has(sessionId)) this.sessionIndex.set(sessionId, new Set());
        this.sessionIndex.get(sessionId)!.add(ptyId);

        p.onData((data: string) => opts.onData(ptyId, data));

        // Launch veno
        if (process.platform === "win32") {
            // Windows: run via bash if available (Git Bash / WSL). If not, user must provide a bash env.
            p.write(`bash "${venoScript}"\r`);
        } else {
            p.write(`chmod +x "${venoScript}"\n`);
            p.write(`"${venoScript}"\n`);
        }

        return ptyId;
    }

    write(ptyId: string, data: string): void {
        const s = this.sessions.get(ptyId);
        if (!s) return;
        s.pty.write(data);
    }

    resize(ptyId: string, cols: number, rows: number): void {
        const s = this.sessions.get(ptyId);
        if (!s) return;
        try {
            s.pty.resize(Math.max(2, cols), Math.max(2, rows));
        } catch { }
    }

    closeAllForSession(sessionId: string): void {
        const ids = this.sessionIndex.get(sessionId);
        if (!ids) return;
        for (const ptyId of ids) {
            const s = this.sessions.get(ptyId);
            if (s) {
                try {
                    s.pty.kill();
                } catch { }
                this.sessions.delete(ptyId);
            }
        }
        this.sessionIndex.delete(sessionId);
    }

    private ensureVenoInstalled(): string {
        const root = path.resolve(process.cwd(), "../../tools/veno");
        const marker = path.join(root, ".veno_ready");

        if (fs.existsSync(marker)) return root;

        if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });

        // If folder empty, clone
        const isEmpty = fs.readdirSync(root).length === 0;
        if (isEmpty) {
            console.log("[nucleus] cloning veno into tools/veno ...");
            const clone = spawnSync("git", ["clone", "https://github.com/TomAwezome/veno", root], {
                stdio: "inherit"
            });
            if (clone.status !== 0) {
                throw new Error("Failed to git clone veno. Ensure git is installed and network is available.");
            }
        }

        // Install python deps
        console.log("[nucleus] installing veno python requirements ...");
        const pip = process.platform === "win32" ? "py" : "python3";
        const pipArgs = ["-m", "pip", "install", "-r", "requirements.txt"];

        const pipRun = spawnSync(pip, pipArgs, { cwd: root, stdio: "inherit" });
        if (pipRun.status !== 0) {
            throw new Error(
                "Failed to install veno requirements. Ensure Python 3 + pip are installed and available."
            );
        }

        fs.writeFileSync(marker, "ok\n", "utf8");
        console.log("[nucleus] veno ready ✅");
        return root;
    }
}
