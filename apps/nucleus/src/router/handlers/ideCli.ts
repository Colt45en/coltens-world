import {
    IdeCliRunRequestSchema,
    type IdeCliRunResponse,
} from "@world-engine/protocol";
import { spawn } from "node:child_process";
import path from "node:path";

function runCommand(
    command: string,
    cwd: string,
    timeoutMs: number
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
        const child = spawn(command, {
            cwd,
            shell: true,
            stdio: ["ignore", "pipe", "pipe"],
            env: process.env,
        });

        let stdout = "";
        let stderr = "";

        child.stdout?.on("data", (d) => {
            stdout += d.toString("utf8");
        });
        child.stderr?.on("data", (d) => {
            stderr += d.toString("utf8");
        });

        const killTimer = setTimeout(() => {
            stderr += `\n[timeout] killed after ${timeoutMs}ms\n`;
            child.kill("SIGKILL");
        }, timeoutMs);

        child.on("close", (code) => {
            clearTimeout(killTimer);
            resolve({ exitCode: code ?? -1, stdout, stderr });
        });
    });
}

/**
 * Safety: only allow specific (memory/lexicon) CLI scripts
 */
function isAllowedCommand(cmd: string): boolean {
    const allowed = [
        "pnpm run memory:stats",
        "pnpm run memory:query",
        "pnpm run memory:chain",
        "pnpm run lexicon:index",
        "pnpm run lexicon:validate-all",
    ];
    const trimmed = cmd.trim();
    return allowed.some((p) => trimmed.startsWith(p));
}

export async function handleIdeCliRun(raw: unknown): Promise<IdeCliRunResponse> {
    const parsed = IdeCliRunRequestSchema.safeParse(raw);
    if (!parsed.success) {
        return {
            ok: false,
            exitCode: 400,
            stdout: "",
            stderr: `Invalid request: ${parsed.error.message}`,
        };
    }

    const msg = parsed.data;
    const payload = msg.payload;
    const cwd = payload.cwd
        ? path.resolve(process.cwd(), payload.cwd)
        : process.cwd();
    const command = payload.command.trim();
    const timeoutMs = payload.timeoutMs;

    if (!isAllowedCommand(command)) {
        return {
            ok: false,
            exitCode: 126,
            stdout: "",
            stderr: `Command not allowed: "${command}"\nAllowed: memory:stats, memory:query, memory:chain, lexicon:index, lexicon:validate-all`,
        };
    }

    const { exitCode, stdout, stderr } = await runCommand(command, cwd, timeoutMs);

    return {
        ok: exitCode === 0,
        exitCode,
        stdout,
        stderr,
    };
}
